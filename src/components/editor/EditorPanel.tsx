import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { X, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getStoredKeys } from '@/lib/aiModels';
import { LocalFileView } from '@/lib/supabaseClient';

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'c',
    css: 'css', scss: 'scss', html: 'html', json: 'json', yaml: 'yaml',
    yml: 'yaml', md: 'markdown', sql: 'sql', sh: 'shell', toml: 'ini',
    rb: 'ruby', php: 'php', swift: 'swift', kt: 'kotlin', dart: 'dart',
    vue: 'html', svelte: 'html', xml: 'xml', r: 'r', lua: 'lua',
  };
  return map[ext] || 'plaintext';
}

function LocalFileViewer({ file, onClose }: { file: LocalFileView; onClose: () => void }) {
  const { mimeType, name, content, objectUrl, path } = file;
  const lang = getLanguage(name);

  const renderContent = () => {
    if (mimeType.startsWith('image/')) {
      return (
        <div className="flex-1 flex items-center justify-center overflow-auto p-8 bg-zinc-950">
          <img src={objectUrl} alt={name} className="max-w-full max-h-full object-contain" />
        </div>
      );
    }
    if (mimeType.startsWith('audio/')) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-zinc-950">
          <div className="text-[80px] opacity-10 text-emerald-400 font-display italic">♫</div>
          <div className="text-[11px] text-zinc-500 uppercase tracking-[0.25em] font-mono">{name}</div>
          <audio src={objectUrl} controls className="w-80" style={{ colorScheme: 'dark' }} />
        </div>
      );
    }
    if (mimeType.startsWith('video/')) {
      return (
        <div className="flex-1 flex items-center justify-center bg-zinc-950 overflow-hidden">
          <video src={objectUrl} controls className="max-w-full max-h-full" />
        </div>
      );
    }
    if (mimeType === 'application/pdf') {
      return <iframe src={objectUrl} className="flex-1 border-none w-full" title={name} />;
    }
    return (
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={lang}
          theme="vs-dark"
          value={content}
          options={{
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Consolas, "Courier New", monospace',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12 },
            lineHeight: 20,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            wordWrap: 'on',
            tabSize: 2,
            readOnly: true,
            scrollbar: { vertical: 'visible', horizontal: 'visible' },
          }}
        />
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
      {/* Tab bar */}
      <div className="h-10 flex items-center shrink-0 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-md">
        <div className="h-full px-4 flex items-center gap-2 border-r border-white/[0.06] bg-zinc-900/40">
          <span className="truncate max-w-[200px] text-[12px] text-zinc-200">{name}</span>
          <button
            onClick={onClose}
            className="p-0.5 transition-colors text-zinc-500 hover:text-red-400"
          >
            <X size={12} />
          </button>
        </div>
        <span className="ml-auto px-4 text-[9px] font-mono text-emerald-400 tracking-[0.25em] uppercase">
          {lang} · LOCAL
        </span>
      </div>

      {/* Breadcrumb */}
      <div className="h-7 flex items-center px-4 shrink-0 border-b border-white/[0.06] text-[10px] font-mono text-zinc-500 tracking-[0.10em] bg-zinc-950/60">
        <span className="truncate">{path}</span>
      </div>

      {renderContent()}
    </div>
  );
}

export default function EditorPanel() {
  const { activeFile, activeProject, setActiveFile, loginState, refetchFiles, localActiveFile, setLocalActiveFile } = useWorkspace();
  const [localContent, setLocalContent] = useState(activeFile?.content || '');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (activeFile) { setLocalContent(activeFile.content); setIsDirty(false); }
  }, [activeFile?.id]);

  const handleSave = async () => {
    if (!activeFile || !activeProject) return;
    if (loginState === 'guest') { alert('Guest mode: read-only'); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from('project_files')
        .update({ content: localContent, updated_at: new Date().toISOString() })
        .eq('id', activeFile.id);
      if (error) throw error;

      const stored = getStoredKeys();
      const apiUrl = stored.baseUrl || import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const { data: session } = await supabase.auth.getSession();

      await fetch(`${apiUrl}/api/ai/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}` } : {}),
        },
        body: JSON.stringify({
          file_id: activeFile.id,
          project_id: activeProject.id,
          file_name: activeFile.file_name,
          path: activeFile.path,
          content: localContent,
          google_key: stored.google || null,
        }),
      }).catch(() => {});

      setIsDirty(false);
      await refetchFiles();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally { setSaving(false); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeFile, localContent]);

  if (localActiveFile) {
    return (
      <LocalFileViewer
        file={localActiveFile}
        onClose={() => {
          if (localActiveFile.objectUrl) URL.revokeObjectURL(localActiveFile.objectUrl);
          setLocalActiveFile(null);
        }}
      />
    );
  }

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950/40">
        <div className="text-center select-none">
          <div
            className="font-display italic text-emerald-400/[0.06]"
            style={{ fontSize: 200, lineHeight: 1, letterSpacing: '-0.04em' }}
          >
            creat
          </div>
          <div className="mt-6 text-[10px] font-mono text-zinc-500 tracking-[0.25em] uppercase">
            Open a folder or select a file
          </div>
          <div className="mt-2 text-[9px] font-mono text-zinc-600 tracking-[0.20em] uppercase">
            Use the explorer to browse local or cloud files
          </div>
        </div>
      </div>
    );
  }

  const handleEditorChange = (value: string | undefined) => {
    const v = value || '';
    setLocalContent(v);
    setActiveFile({ ...activeFile, content: v });
    setIsDirty(true);
  };

  const lang = getLanguage(activeFile.file_name);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
      {/* Tab bar */}
      <div className="h-10 flex items-center shrink-0 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-md">
        <div className="h-full px-4 flex items-center gap-2 border-r border-white/[0.06] bg-zinc-900/40">
          <span
            className="truncate max-w-[200px] text-[12px] text-zinc-200"
            style={{ fontStyle: isDirty ? 'italic' : 'normal' }}
          >
            {activeFile.file_name}
            {isDirty && <span className="ml-1.5 text-emerald-400">●</span>}
          </span>
        </div>
        <div className="ml-auto px-4 flex items-center gap-4">
          <span className="text-[9px] font-mono text-zinc-500 tracking-[0.25em] uppercase">{lang}</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 transition-all text-[9px] font-mono tracking-[0.25em] uppercase px-3 py-1 border"
            style={{
              color: isDirty ? '#34d399' : '#71717a',
              borderColor: isDirty ? 'rgba(52,211,153,0.40)' : 'transparent',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="h-7 flex items-center px-4 shrink-0 border-b border-white/[0.06] text-[10px] font-mono text-zinc-500 tracking-[0.10em] bg-zinc-950/60">
        <span className="truncate">{activeProject?.name} <span className="text-emerald-400/60 mx-1.5">›</span> {activeFile.path || activeFile.file_name}</span>
      </div>

      {/* Monaco */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={lang}
          theme="vs-dark"
          value={localContent}
          onChange={handleEditorChange}
          options={{
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Consolas, "Courier New", monospace',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12 },
            lineHeight: 20,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            wordWrap: 'on',
            tabSize: 2,
            scrollbar: { vertical: 'visible', horizontal: 'visible' },
          }}
        />
      </div>
    </div>
  );
}
