import React, { useState, useRef } from 'react';
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

export default function TaskDetail({ task, onClose, onViewDiff }: Props) {
  const { loginState, currentUserId, userRole, refetchTasks, setDiffTask, setDiffMode } = useWorkspace();
  const [uploading, setUploading] = useState(false);
  const [downloadingOrig, setDownloadingOrig] = useState(false);
  const [downloadingPatch, setDownloadingPatch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = userRole === 'ADMIN';
  const canUploadPatch = loginState !== 'guest' && (
    isAdmin || task.assignee_id === currentUserId
  );

  const handleDownloadOriginal = async () => {
    if (!task.original_zip_path) return;
    setDownloadingOrig(true);
    try {
      const url = await getSignedUrl(task.original_zip_path);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${task.title.replace(/\s+/g, '-')}-original.zip`;
        a.click();
      }
    } finally { setDownloadingOrig(false); }
  };

  const handleDownloadPatched = async () => {
    if (!task.patched_zip_path) return;
    setDownloadingPatch(true);
    try {
      const url = await getSignedUrl(task.patched_zip_path);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${task.title.replace(/\s+/g, '-')}-patched.zip`;
        a.click();
      }
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
        patched_zip_path: path,
        status: 'DONE',
        updated_at: new Date().toISOString(),
      }).eq('id', task.id);
      if (updateErr) throw updateErr;

      await refetchTasks();
      onClose();
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally { setUploading(false); }
  };

  const hasBothZips = task.original_zip_path && task.patched_zip_path;

  const statusColor = task.status === 'DONE'
    ? 'bg-[#1A1612] text-[#F4EFE6] border-[#1A1612]'
    : task.status === 'IN_PROGRESS'
    ? 'text-[#2A4A6B] border-[#2A4A6B]/30'
    : 'text-[#9B948A] border-[rgba(26,22,18,0.10)]';

  const priorityColor = task.priority === 'HIGH'
    ? 'text-[#B53C2A]' : task.priority === 'LOW'
    ? 'text-[#9B948A]' : 'text-[#C99A2E]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
      <div className="w-[560px] max-h-[85vh] bg-[#EFEAE0] border border-[rgba(26,22,18,0.10)] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-[rgba(26,22,18,0.10)] shrink-0">
          <div className="flex-1 pr-4">
            <div className="text-[9px] uppercase tracking-widest opacity-30 mb-2">Task Detail</div>
            <h2 className="text-[13px] font-black uppercase tracking-wide leading-tight">{task.title}</h2>
          </div>
          <button onClick={onClose} className="opacity-40 hover:opacity-100 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
          {/* Status + Priority */}
          <div className="flex items-center gap-3">
            <span className={cn('text-[8px] font-black uppercase tracking-widest px-2 py-1 border', statusColor)}>
              {task.status.replace('_', ' ')}
            </span>
            {task.priority && (
              <span className={cn('text-[8px] font-black uppercase tracking-widest', priorityColor)}>
                {task.priority} priority
              </span>
            )}
            {task.due_date && (
              <span className="text-[9px] opacity-30 ml-auto">
                Due {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <div className="text-[9px] uppercase tracking-widest opacity-30 mb-2">Description</div>
              <p className="text-[12px] text-[#1A1612]/80 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* URL */}
          {task.url && (
            <div>
              <div className="text-[9px] uppercase tracking-widest opacity-30 mb-2">Reference URL</div>
              <a href={task.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-[11px] text-[#2A4A6B] hover:text-[#1A3A5B] break-all">
                <ExternalLink size={12} className="shrink-0" />
                {task.url}
              </a>
            </div>
          )}

          {/* Original ZIP */}
          <div>
            <div className="text-[9px] uppercase tracking-widest opacity-30 mb-2">Codebase (Original)</div>
            {task.original_zip_path ? (
              <button onClick={handleDownloadOriginal} disabled={downloadingOrig}
                className="flex items-center gap-2 border border-[rgba(26,22,18,0.18)] px-4 py-2.5 text-[10px] uppercase tracking-widest font-bold hover:border-[rgba(26,22,18,0.07)]0 transition-colors disabled:opacity-40">
                {downloadingOrig ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                Download original.zip
              </button>
            ) : (
              <div className="text-[10px] opacity-20 uppercase tracking-widest">No ZIP attached</div>
            )}
          </div>

          {/* Patched ZIP upload */}
          {canUploadPatch && task.status !== 'DONE' && (
            <div>
              <div className="text-[9px] uppercase tracking-widest opacity-30 mb-2">Upload Patched Codebase</div>
              <div className="text-[9px] opacity-20 mb-3 uppercase tracking-wider">
                Uploading marks this task as DONE
              </div>
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                className="border border-dashed border-[rgba(26,22,18,0.18)] p-5 flex items-center gap-3 cursor-pointer hover:border-[#1A1612]/40 transition-colors">
                {uploading ? (
                  <><Loader2 size={14} className="animate-spin opacity-60" /><span className="text-[10px] opacity-40">Uploading…</span></>
                ) : (
                  <><Upload size={14} className="opacity-30" /><span className="text-[10px] text-[#9B948A] uppercase tracking-widest">Upload patched .zip</span></>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".zip" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadPatch(f); }} />
            </div>
          )}

          {/* Patched ZIP — download for admin, confirmation for member */}
          {task.patched_zip_path && (
            <div>
              <div className="text-[9px] uppercase tracking-widest opacity-30 mb-2">Patched Codebase</div>
              {isAdmin ? (
                <button onClick={handleDownloadPatched} disabled={downloadingPatch}
                  className="flex items-center gap-2 border border-[rgba(26,22,18,0.18)] px-4 py-2.5 text-[10px] uppercase tracking-widest font-bold hover:border-[rgba(26,22,18,0.07)]0 transition-colors disabled:opacity-40">
                  {downloadingPatch ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  Download patched.zip
                </button>
              ) : (
                <div className="flex items-center gap-2 text-[10px] text-[#6B645C]">
                  <File size={12} className="opacity-60" />
                  <span>patched.zip uploaded</span>
                  <span className="ml-auto text-[8px] uppercase tracking-widest text-[#9B948A]/60">✓ Submitted</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-[rgba(26,22,18,0.10)] flex items-center gap-3 shrink-0">
            {/* Live progress — IN_PROGRESS task with original ZIP */}
          {task.status === 'IN_PROGRESS' && task.original_zip_path && (
            <button
              onClick={() => { setDiffMode('live'); setDiffTask(task); onClose(); }}
              className="flex items-center gap-2 border border-[#007acc]/50 text-[#007acc] font-black uppercase tracking-widest text-[10px] px-5 py-3 hover:bg-[#007acc]/10">
              <Radio size={13} className="animate-pulse" />
              Live Changes
            </button>
          )}
          {hasBothZips && (
            <button
              onClick={() => { setDiffMode('zip'); setDiffTask(task); onClose(); }}
              className="flex items-center gap-2 bg-[#1A1612] text-[#F4EFE6] font-black uppercase tracking-widest text-[10px] px-5 py-3 hover:bg-[#1A1612]/90">
              <GitCompare size={13} />
              View Diff
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 border border-[rgba(26,22,18,0.18)] text-[10px] uppercase tracking-widest font-bold py-3 hover:border-[rgba(26,22,18,0.07)]0 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
