import React, { useState, useEffect } from 'react';
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

// ─── Local file viewer ────────────────────────────────────────────────────────

function LocalFileViewer({ file, onClose }: { file: LocalFileView; onClose: () => void }) {
  const { mimeType, name, content, objectUrl, path } = file;
  const lang = getLanguage(name);

  const renderContent = () => {
    if (mimeType.startsWith('image/')) {
      return (
        <div className="flex-1 flex items-center justify-center overflow-auto p-8 bg-[#1e1e1e]">
          <img src={objectUrl} alt={name} className="max-w-full max-h-full object-contain" />
        </div>
      );
    }
    if (mimeType.startsWith('audio/')) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-[#1e1e1e]">
          <div className="text-[32px] opacity-10">♫</div>
          <div className="text-[11px] text-[#858585] uppercase tracking-widest">{name}</div>
          <audio src={objectUrl} controls className="w-80" style={{ colorScheme: 'dark' }} />
        </div>
      );
    }
    if (mimeType.startsWith('video/')) {
      return (
        <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
          <video src={objectUrl} controls className="max-w-full max-h-full" />
        </div>
      );
    }
    if (mimeType === 'application/pdf') {
      return (
        <iframe src={objectUrl} className="flex-1 border-none w-full" title={name} />
      );
    }
    // Code / text
    return (
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={lang}
          theme="vs-dark"
          value={content}
          options={{
            fontSize: 13,
            fontFamily: 'Consolas, "Courier New", monospace',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 8 },
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1e1e1e]">
      {/* Tab bar */}
      <div className="h-9 bg-[#252526] flex items-center shrink-0 border-b border-[#1e1e1e]">
        <div className="h-full px-4 bg-[#1e1e1e] flex items-center gap-2 text-[13px] text-[#cccccc] border-t-2 border-[#007acc]">
          <span className="truncate max-w-[200px]">{name}</span>
          <button onClick={onClose} className="opacity-40 hover:opacity-100 hover:bg-[#333333] rounded p-0.5">
            <X size={13} />
          </button>
        </div>
        <span className="ml-auto px-4 text-[9px] font-mono text-[#858585] uppercase tracking-widest">
          {lang} · LOCAL
        </span>
      </div>

      {/* Breadcrumb */}
      <div className="h-6 flex items-center px-4 bg-[#1e1e1e] text-[#cccccc] text-[11px] shrink-0 border-b border-[#252526]">
        <span className="opacity-40 truncate">{path}</span>
      </div>

      {renderContent()}
    </div>
  );
}

// ─── Supabase file editor ─────────────────────────────────────────────────────

export default function EditorPanel() {
  const { activeFile, activeProject, setActiveFile, userRole, loginState, refetchFiles, localActiveFile, setLocalActiveFile } = useWorkspace();
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

  // Ctrl+S — must be before early returns
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeFile, localContent]);

  // ── Show local file viewer if one is active ──
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
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-[#858585]">
        <div className="text-center space-y-4">
          <div className="text-[60px] font-black tracking-tighter opacity-5 leading-none">AI</div>
          <div className="text-[11px] uppercase tracking-widest font-bold">Open a folder or select a file</div>
          <div className="text-[10px] opacity-40">Use the explorer to browse local files or cloud files</div>
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1e1e1e]">
      {/* Tab bar */}
      <div className="h-9 bg-[#252526] flex items-center shrink-0 border-b border-[#1e1e1e]">
        <div className="h-full px-4 bg-[#1e1e1e] flex items-center gap-2 text-[13px] text-[#cccccc] border-t-2 border-[#007acc]">
          <span className={`truncate max-w-[180px] ${isDirty ? 'italic' : ''}`}>{activeFile.file_name}{isDirty ? ' ●' : ''}</span>
          <button className="opacity-0 hover:opacity-100 hover:bg-[#333333] rounded p-0.5"><X size={13} /></button>
        </div>
        <div className="ml-auto px-4 flex items-center gap-3">
          <span className="text-[9px] uppercase font-mono text-[#858585]">{lang}</span>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 text-[#cccccc] hover:text-white p-1 rounded hover:bg-[#333333] text-[10px] uppercase tracking-widest font-bold disabled:opacity-40">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {!saving && <span className="hidden sm:inline">Save</span>}
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="h-6 flex items-center px-4 bg-[#1e1e1e] text-[#cccccc] text-[11px] shrink-0 border-b border-[#252526]">
        <span className="opacity-50">{activeProject?.name} › {activeFile.path || activeFile.file_name}</span>
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
            fontFamily: 'Consolas, "Courier New", monospace',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 8 },
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
