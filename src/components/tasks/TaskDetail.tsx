import { useState, useRef } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { X, ExternalLink, Download, Upload, File, Loader2, GitCompare, Radio } from 'lucide-react';
import { supabase, Task } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

interface Props {
  task: Task;
  onClose: () => void;
  onViewDiff: (task: Task) => void;
}

async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('task-files').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export default function TaskDetail({ task, onClose }: Props) {
  const { loginState, currentUserId, userRole, refetchTasks, setDiffTask, setDiffMode } = useWorkspace();
  const [uploading, setUploading] = useState(false);
  const [downloadingOrig, setDownloadingOrig] = useState(false);
  const [downloadingPatch, setDownloadingPatch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = userRole === 'ADMIN';
  const canUploadPatch = loginState !== 'guest' && (isAdmin || task.assignee_id === currentUserId);

  const handleDownloadOriginal = async () => {
    if (!task.original_zip_path) return;
    setDownloadingOrig(true);
    try {
      const url = await getSignedUrl(task.original_zip_path);
      if (url) { const a = document.createElement('a'); a.href = url; a.download = `${task.title.replace(/\s+/g, '-')}-original.zip`; a.click(); }
    } finally { setDownloadingOrig(false); }
  };

  const handleDownloadPatched = async () => {
    if (!task.patched_zip_path) return;
    setDownloadingPatch(true);
    try {
      const url = await getSignedUrl(task.patched_zip_path);
      if (url) { const a = document.createElement('a'); a.href = url; a.download = `${task.title.replace(/\s+/g, '-')}-patched.zip`; a.click(); }
    } finally { setDownloadingPatch(false); }
  };

  const handleUploadPatch = async (file: File) => {
    if (!file || loginState === 'guest') return;
    setUploading(true);
    try {
      const path = `tasks/${task.id}/patched.zip`;
      const { error: upErr } = await supabase.storage.from('task-files').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { error: updateErr } = await supabase.from('tasks').update({
        patched_zip_path: path, status: 'DONE', updated_at: new Date().toISOString(),
      }).eq('id', task.id);
      if (updateErr) throw updateErr;

      await refetchTasks();
      onClose();
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally { setUploading(false); }
  };

  const hasBothZips = task.original_zip_path && task.patched_zip_path;

  const statusColor =
    task.status === 'DONE'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/40'
      : task.status === 'IN_PROGRESS'
        ? 'text-violet-300 border-violet-400/40 bg-violet-500/[0.06]'
        : 'text-zinc-500 border-white/10';

  const priorityColor =
    task.priority === 'HIGH' ? 'text-red-300'
    : task.priority === 'LOW' ? 'text-zinc-500'
    : 'text-amber-300';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(9,9,11,0.72)', backdropFilter: 'blur(12px) saturate(1.2)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-[580px] max-h-[85vh] bg-zinc-950/95 border border-white/[0.10] flex flex-col backdrop-blur-2xl shadow-deep"
      >
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-white/[0.06] shrink-0">
          <div className="flex-1 pr-4">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-emerald-400/80 mb-2">
              Task Detail
            </div>
            <h2 className="font-display italic text-zinc-100 leading-tight" style={{ fontSize: 22, fontWeight: 400 }}>
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-red-400 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
          {/* Status + Priority */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cn('text-[9px] font-mono tracking-[0.25em] uppercase px-2 py-1 border', statusColor)}>
              {task.status.replace('_', ' ')}
            </span>
            {task.priority && (
              <span className={cn('text-[9px] font-mono tracking-[0.25em] uppercase', priorityColor)}>
                {task.priority} priority
              </span>
            )}
            {task.due_date && (
              <span className="text-[10px] text-zinc-500 font-mono ml-auto tracking-[0.10em]">
                Due {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>

          {task.description && (
            <div>
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-2">Description</div>
              <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {task.url && (
            <div>
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-2">Reference URL</div>
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[12px] text-emerald-400 hover:text-emerald-300 break-all"
              >
                <ExternalLink size={12} className="shrink-0" strokeWidth={1.5} />
                {task.url}
              </a>
            </div>
          )}

          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-2">Codebase (Original)</div>
            {task.original_zip_path ? (
              <button
                onClick={handleDownloadOriginal}
                disabled={downloadingOrig}
                className="flex items-center gap-2 border border-white/[0.18] px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.20em] text-zinc-200 hover:border-emerald-400/40 hover:text-emerald-300 transition-colors disabled:opacity-40"
              >
                {downloadingOrig ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} strokeWidth={1.5} />}
                Download original.zip
              </button>
            ) : (
              <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.20em]">No ZIP attached</div>
            )}
          </div>

          {canUploadPatch && task.status !== 'DONE' && (
            <div>
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-2">Upload Patched Codebase</div>
              <div className="text-[9px] text-zinc-600 mb-3 uppercase tracking-[0.15em] font-mono">
                Uploading marks this task as DONE
              </div>
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                className="border border-dashed border-white/[0.18] p-5 flex items-center gap-3 cursor-pointer hover:border-emerald-400/40 hover:bg-emerald-500/[0.04] transition-colors"
              >
                {uploading ? (
                  <><Loader2 size={14} className="animate-spin text-emerald-400" /><span className="text-[10px] text-emerald-300 font-mono tracking-wide">Uploading…</span></>
                ) : (
                  <><Upload size={14} className="text-zinc-500" strokeWidth={1.5} /><span className="text-[10px] text-zinc-500 uppercase tracking-[0.20em] font-mono">Upload patched .zip</span></>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadPatch(f); }} />
            </div>
          )}

          {task.patched_zip_path && (
            <div>
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-2">Patched Codebase</div>
              {isAdmin ? (
                <button
                  onClick={handleDownloadPatched}
                  disabled={downloadingPatch}
                  className="flex items-center gap-2 border border-emerald-400/40 px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.20em] text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                >
                  {downloadingPatch ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} strokeWidth={1.5} />}
                  Download patched.zip
                </button>
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <File size={12} className="text-emerald-400" strokeWidth={1.5} />
                  <span>patched.zip uploaded</span>
                  <span className="ml-auto text-[9px] font-mono uppercase tracking-[0.20em] text-emerald-300">✓ Submitted</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/[0.06] flex items-center gap-3 shrink-0">
          {task.status === 'IN_PROGRESS' && task.original_zip_path && (
            <button
              onClick={() => { setDiffMode('live'); setDiffTask(task); onClose(); }}
              className="flex items-center gap-2 border border-violet-400/50 text-violet-300 font-mono uppercase tracking-[0.25em] text-[10px] px-5 py-3 hover:bg-violet-500/10 transition-colors"
            >
              <Radio size={13} className="animate-pulse" strokeWidth={1.5} />
              Live Changes
            </button>
          )}
          {hasBothZips && (
            <button
              onClick={() => { setDiffMode('zip'); setDiffTask(task); onClose(); }}
              className="flex items-center gap-2 bg-emerald-400 text-zinc-950 font-mono uppercase tracking-[0.25em] text-[10px] px-5 py-3 hover:bg-emerald-300 transition-colors"
            >
              <GitCompare size={13} strokeWidth={1.8} />
              View Diff
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 border border-white/[0.10] text-[10px] font-mono uppercase tracking-[0.20em] text-zinc-300 py-3 hover:border-white/[0.30] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
