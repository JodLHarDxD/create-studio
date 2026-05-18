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
        <div className="flex-1 flex items-center justify-center overflow-auto p-8 bg-[#E8E2D6]">
          <img src={objectUrl} alt={name} className="max-w-full max-h-full object-contain" />
        </div>
      );
    }
    if (mimeType.startsWith('audio/')) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-[#E8E2D6]">
          <div className="text-[32px] opacity-10">♫</div>
          <div className="text-[11px] text-[#6B645C] uppercase tracking-widest">{name}</div>
          <audio src={objectUrl} controls className="w-80" style={{ colorScheme: 'dark' }} />
        </div>
      );
    }
    if (mimeType.startsWith('video/')) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#F4EFE6] overflow-hidden">
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#E8E2D6]">
      {/* Tab bar */}
      <div className="h-9 flex items-center shrink-0" style={{ background: '#DDD5C6', borderBottom: '1px solid #E8E2D6' }}>
        <div className="h-full px-4 flex items-center gap-2" style={{ background: '#ECE6DA', borderBottom: '1px solid rgba(26,22,18,0.10)' }}>
          <span className="truncate max-w-[200px]" style={{ fontSize: 12, color: '#1A1612', fontFamily: '"Inter", sans-serif' }}>{name}</span>
          <button onClick={onClose} className="p-0.5 transition-opacity" style={{ opacity: 0.3, color: '#1A1612' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}>
            <X size={12} />
          </button>
        </div>
        <span className="ml-auto px-4" style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#9B948A', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {lang} · LOCAL
        </span>
      </div>

      {/* Breadcrumb */}
      <div className="h-6 flex items-center px-4 shrink-0" style={{ background: '#E8E2D6', borderBottom: '1px solid #DDD5C6', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#9B948A' }}>
        <span className="truncate">{path}</span>
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
      <div className="flex-1 flex items-center justify-center bg-[#E8E2D6]">
        <div className="text-center" style={{ userSelect: 'none' }}>
          <div style={{ fontFamily: '"Fraunces", serif', fontWeight: 800, fontSize: 80, letterSpacing: '-0.04em', lineHeight: 1, color: '#1A1612', opacity: 0.04, marginBottom: 20 }}>CS</div>
          <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#C4BDB1', marginBottom: 6 }}>Open a folder or select a file</div>
          <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#C4BDB1', opacity: 0.5 }}>Use the explorer to browse local or cloud files</div>
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#E8E2D6]">
      {/* Tab bar */}
      <div className="h-9 flex items-center shrink-0" style={{ background: '#DDD5C6', borderBottom: '1px solid #E8E2D6' }}>
        <div className="h-full px-4 flex items-center gap-2" style={{ background: '#ECE6DA', borderBottom: '1px solid rgba(26,22,18,0.10)' }}>
          <span className="truncate max-w-[180px]" style={{ fontSize: 12, color: '#1A1612', fontFamily: '"Inter", sans-serif', fontStyle: isDirty ? 'italic' : 'normal' }}>
            {activeFile.file_name}{isDirty ? ' ●' : ''}
          </span>
        </div>
        <div className="ml-auto px-4 flex items-center gap-3">
          <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#9B948A', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{lang}</span>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 transition-all"
            style={{ fontSize: 9, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: isDirty ? '#BF4A2A' : '#9B948A', padding: '3px 8px', border: `1px solid ${isDirty ? 'rgba(191,74,42,0.3)' : 'transparent'}`, opacity: saving ? 0.5 : 1 }}>
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="h-6 flex items-center px-4 shrink-0" style={{ background: '#E8E2D6', borderBottom: '1px solid #DDD5C6', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#9B948A' }}>
        <span className="truncate">{activeProject?.name} › {activeFile.path || activeFile.file_name}</span>
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
