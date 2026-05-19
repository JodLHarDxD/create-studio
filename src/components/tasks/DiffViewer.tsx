import React, { useState, useEffect, useMemo } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabaseClient';
import { X, Loader2, FileDiff, Folder, ChevronDown, ChevronRight, Radio } from 'lucide-react';
import JSZip from 'jszip';

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'c',
    css: 'css', scss: 'scss', html: 'html', json: 'json', yaml: 'yaml',
    yml: 'yaml', md: 'markdown', sql: 'sql', sh: 'shell', toml: 'ini',
  };
  return map[ext] || 'plaintext';
}

type FileMap = Map<string, string>;

async function extractZip(url: string): Promise<FileMap> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const map: FileMap = new Map();
  const jobs: Promise<void>[] = [];
  zip.forEach((path, file) => {
    if (!file.dir) {
      jobs.push(file.async('string').then(content => { map.set(path, content); }));
    }
  });
  await Promise.all(jobs);
  return map;
}

type DiffEntry = { path: string; original: string; patched: string; changed: boolean };

function buildDiffList(orig: FileMap, patched: FileMap): DiffEntry[] {
  const allPaths = new Set([...orig.keys(), ...patched.keys()]);
  const entries: DiffEntry[] = [];
  allPaths.forEach(path => {
    const o = orig.get(path) ?? '';
    const p = patched.get(path) ?? '';
    entries.push({ path, original: o, patched: p, changed: o !== p });
  });
  return entries.sort((a, b) => {
    if (a.changed !== b.changed) return a.changed ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
}

// ─── Hierarchical diff tree ───────────────────────────────────────────────────

interface DiffTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children: DiffTreeNode[];
  entry?: DiffEntry;
  changedCount: number;
}

function buildDiffTree(diffs: DiffEntry[]): DiffTreeNode[] {
  const root: DiffTreeNode = { name: '', path: '', type: 'dir', children: [], changedCount: 0 };

  for (const diff of diffs) {
    const parts = diff.path.replace(/^\//, '').split('/');
    let node = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      const dirPath = parts.slice(0, i + 1).join('/');
      let child = node.children.find(c => c.name === seg && c.type === 'dir');
      if (!child) {
        child = { name: seg, path: dirPath, type: 'dir', children: [], changedCount: 0 };
        node.children.push(child);
      }
      node = child;
    }

    const fileName = parts[parts.length - 1];
    node.children.push({
      name: fileName,
      path: diff.path,
      type: 'file',
      children: [],
      entry: diff,
      changedCount: diff.changed ? 1 : 0,
    });
  }

  function computeChanged(n: DiffTreeNode): number {
    if (n.type === 'file') { n.changedCount = n.entry?.changed ? 1 : 0; return n.changedCount; }
    n.changedCount = n.children.reduce((sum, c) => sum + computeChanged(c), 0);
    return n.changedCount;
  }
  computeChanged(root);

  function sortNode(n: DiffTreeNode) {
    n.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      if (a.changedCount !== b.changedCount) return b.changedCount - a.changedCount;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sortNode);
  }
  sortNode(root);

  return root.children;
}

// ─── Tree item component ──────────────────────────────────────────────────────

function DiffTreeItem({
  node, depth, selected, onSelect,
}: {
  node: DiffTreeNode;
  depth: number;
  selected: DiffEntry | null;
  onSelect: (e: DiffEntry) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2 || node.changedCount > 0);

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setExpanded(p => !p)}
          className="w-full flex items-center gap-1.5 py-[3px] outline-none transition-colors"
          style={{ paddingLeft: `${depth * 12 + 6}px`, fontSize: 11, color: '#a1a1aa', fontFamily: '"Inter", sans-serif' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {expanded
            ? <ChevronDown size={11} style={{ color: '#71717a', flexShrink: 0 }} />
            : <ChevronRight size={11} style={{ color: '#71717a', flexShrink: 0 }} />}
          <Folder size={11} style={{ color: '#34d399', opacity: 0.7, flexShrink: 0 }} />
          <span className="truncate flex-1 text-left">{node.name}</span>
          {node.changedCount > 0 && (
            <span className="mr-2" style={{ fontSize: 9, background: 'rgba(52,211,153,0.12)', color: '#34d399', padding: '0 5px', fontFamily: '"JetBrains Mono", monospace' }}>
              {node.changedCount}
            </span>
          )}
        </button>
        {expanded && node.children.map(child => (
          <DiffTreeItem key={child.path || child.name} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  const isSelected = selected?.path === node.entry?.path;
  const isNew = node.entry && !node.entry.original && node.entry.patched;
  const isDeleted = node.entry && node.entry.original && !node.entry.patched;
  const isModified = node.entry?.changed && !isNew && !isDeleted;

  const fileColor = isModified ? '#34d399' : isNew ? '#a3e635' : isDeleted ? '#f87171' : '#a1a1aa';

  return (
    <button
      onClick={() => node.entry && onSelect(node.entry)}
      className="w-full flex items-center gap-1.5 py-[3px] text-left outline-none transition-colors"
      style={{
        paddingLeft: `${depth * 12 + 22}px`,
        background: isSelected ? 'rgba(52,211,153,0.08)' : 'transparent',
        borderLeft: isSelected ? '2px solid #34d399' : '2px solid transparent',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      <span className="truncate flex-1" style={{ fontSize: 11, color: fileColor, fontFamily: '"Inter", sans-serif' }}>
        {node.name}
      </span>
      {isModified && <span className="mr-2 shrink-0" style={{ fontSize: 9, color: 'rgba(52,211,153,0.6)', fontFamily: '"JetBrains Mono", monospace' }}>M</span>}
      {isNew && <span className="mr-2 shrink-0" style={{ fontSize: 9, color: 'rgba(163,230,53,0.6)', fontFamily: '"JetBrains Mono", monospace' }}>A</span>}
      {isDeleted && <span className="mr-2 shrink-0" style={{ fontSize: 9, color: 'rgba(248,113,113,0.6)', fontFamily: '"JetBrains Mono", monospace' }}>D</span>}
    </button>
  );
}

// ─── Main DiffViewer ──────────────────────────────────────────────────────────

export default function DiffViewer() {
  const { diffTask, diffMode, setDiffTask } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [selected, setSelected] = useState<DiffEntry | null>(null);

  const tree = useMemo(() => buildDiffTree(diffs), [diffs]);
  const changedCount = diffs.filter(d => d.changed).length;
  const isLive = diffMode === 'live';

  useEffect(() => {
    if (!diffTask?.original_zip_path) return;

    setLoading(true);
    setError('');
    setLoadingMsg('Downloading original…');

    const load = async () => {
      const { data: origSigned } = await supabase.storage
        .from('task-files')
        .createSignedUrl(diffTask.original_zip_path!, 3600);
      if (!origSigned?.signedUrl) throw new Error('Could not sign original ZIP URL');

      const origMap = await extractZip(origSigned.signedUrl);

      let patchedMap: FileMap;

      if (isLive) {
        setLoadingMsg('Fetching live progress…');
        const manifestPath = `tasks/${diffTask.id}/live-manifest.json`;
        const { data: manifestSigned } = await supabase.storage
          .from('task-files')
          .createSignedUrl(manifestPath, 3600);
        if (!manifestSigned?.signedUrl) throw new Error('No live changes uploaded yet. Member must open and sync the folder.');
        const res = await fetch(manifestSigned.signedUrl);
        if (!res.ok) throw new Error('No live changes uploaded yet. Member must open and sync the folder.');
        const manifest: Record<string, string> = await res.json();
        patchedMap = new Map(Object.entries(manifest));
      } else {
        if (!diffTask.patched_zip_path) throw new Error('No patched ZIP available');
        setLoadingMsg('Downloading patched ZIP…');
        const { data: patchedSigned } = await supabase.storage
          .from('task-files')
          .createSignedUrl(diffTask.patched_zip_path, 3600);
        if (!patchedSigned?.signedUrl) throw new Error('Could not sign patched ZIP URL');
        patchedMap = await extractZip(patchedSigned.signedUrl);
      }

      setLoadingMsg('Computing diff…');
      const list = buildDiffList(origMap, patchedMap);
      setDiffs(list);
      setSelected(list.find(d => d.changed) ?? list[0] ?? null);
    };

    load().catch(err => setError(err.message)).finally(() => { setLoading(false); setLoadingMsg(''); });
  }, [diffTask?.id, diffMode]);

  if (!diffTask) return null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
      {/* Tab bar */}
      <div className="h-10 flex items-center shrink-0 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-md">
        <div className="h-full px-4 flex items-center gap-2 border-r border-white/[0.06] bg-zinc-900/40">
          <FileDiff size={13} style={{ color: '#34d399', opacity: 0.8 }} strokeWidth={1.5} />
          <span className="truncate max-w-[220px] text-[13px] text-zinc-100">{diffTask.title}</span>
          {isLive && (
            <span className="flex items-center gap-1 text-[9px] text-violet-300 border border-violet-400/40 px-1.5 py-0.5 font-mono tracking-[0.20em]">
              <Radio size={8} className="animate-pulse" /> LIVE
            </span>
          )}
          {!isLive && changedCount > 0 && (
            <span className="text-[9px] bg-emerald-400 text-zinc-950 px-1.5 py-0.5 font-mono font-semibold">
              {changedCount} changed
            </span>
          )}
          <button
            onClick={() => setDiffTask(null)}
            className="p-0.5 text-zinc-500 hover:text-red-400 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
        <span className="ml-auto px-4 text-[9px] font-mono text-emerald-400 tracking-[0.25em] uppercase">
          {isLive ? 'LIVE DIFF' : 'DIFF VIEW'}
        </span>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <Loader2 size={20} className="animate-spin text-emerald-400/70" />
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">{loadingMsg || 'Loading…'}</span>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="p-4 border border-red-400/30 bg-red-500/[0.06] text-red-300 text-[12px] font-mono max-w-sm text-center leading-relaxed">
            {error}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* File tree */}
          <div className="w-64 shrink-0 flex flex-col overflow-hidden bg-zinc-950/60 border-r border-white/[0.06]">
            <div className="px-4 py-2.5 shrink-0 border-b border-white/[0.06] font-mono text-[10px] tracking-[0.20em] uppercase text-zinc-500">
              {diffs.length} files · <span className="text-emerald-400">{changedCount} modified</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
              {tree.map(node => (
                <DiffTreeItem
                  key={node.path || node.name}
                  node={node}
                  depth={0}
                  selected={selected}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </div>

          {/* Monaco Diff */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selected ? (
              <>
                <div className="h-7 flex items-center px-4 bg-zinc-950/60 text-zinc-300 text-[11px] shrink-0 border-b border-white/[0.06]">
                  <span className="text-zinc-500 truncate font-mono tracking-[0.10em]">{selected.path}</span>
                  <span className="ml-auto text-[9px] text-emerald-400 font-mono uppercase tracking-[0.25em]">{getLanguage(selected.path)}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <DiffEditor
                    height="100%"
                    language={getLanguage(selected.path)}
                    theme="vs-dark"
                    original={selected.original}
                    modified={selected.patched}
                    options={{
                      fontSize: 13,
                      fontFamily: 'JetBrains Mono, Consolas, "Courier New", monospace',
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      padding: { top: 12 },
                      lineHeight: 20,
                      readOnly: true,
                      renderSideBySide: true,
                      scrollbar: { vertical: 'visible', horizontal: 'visible' },
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-600 text-[11px] font-mono uppercase tracking-[0.25em]">
                Select a file to compare
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
