import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { X, Save, Loader2, FilePlus } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getStoredKeys } from '@/lib/aiModels';

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

export default function EditorPanel() {
  const { activeFile, activeProject, setActiveFile, userRole, loginState, refetchFiles } = useWorkspace();
  const [localContent, setLocalContent] = useState(activeFile?.content || '');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (activeFile) { setLocalContent(activeFile.content); setIsDirty(false); }
  }, [activeFile?.id]);

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-[#858585]">
        <div className="text-center space-y-4">
          <div className="text-[60px] font-black tracking-tighter opacity-5 leading-none">AI</div>
          <div className="text-[11px] uppercase tracking-widest font-bold">Select a file to begin</div>
          <div className="text-[10px] opacity-40">or create a new file from the explorer</div>
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

  const handleSave = async () => {
    if (!activeFile || !activeProject) return;
    if (loginState === 'guest') { alert('Guest mode: read-only'); return; }

    setSaving(true);
    try {
      // Save content to Supabase
      const { error } = await supabase.from('project_files')
        .update({ content: localContent, updated_at: new Date().toISOString() })
        .eq('id', activeFile.id);
      if (error) throw error;

      // Also trigger backend to regenerate vector embedding
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
      }).catch(() => {}); // Non-blocking — embedding failure shouldn't block save

      setIsDirty(false);
      await refetchFiles();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally { setSaving(false); }
  };

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeFile, localContent]);

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
