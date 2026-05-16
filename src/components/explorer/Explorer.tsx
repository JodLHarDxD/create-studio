import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, FilePlus, UploadCloud, FolderUp } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import NewTaskModal from '../tasks/NewTaskModal';
import { supabase } from '@/lib/supabaseClient';
import JSZip from 'jszip';

export default function Explorer() {
  const { activeProject, files, tasks, activeFile, setActiveFile, loginState, currentUserId, users, userRole, setTasks, refetchFiles, refetchTasks } = useWorkspace();
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'TODO' | 'DONE'>('ALL');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(true);

  const isAdmin = userRole === 'ADMIN';

  // RBAC: members see only their assigned tasks
  const visibleTasks = isAdmin
    ? tasks
    : tasks.filter(t => t.assignee_id === currentUserId);

  const filteredTasks = visibleTasks.filter(t => {
    if (taskFilter === 'TODO') return t.status !== 'DONE';
    if (taskFilter === 'DONE') return t.status === 'DONE';
    return true;
  });

  const updateTask = async (taskId: string, updates: any) => {
    if (loginState === 'guest') {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
      return;
    }
    await supabase.from('tasks').update(updates).eq('id', taskId);
    await refetchTasks();
  };

  const handleNewFile = async () => {
    if (loginState === 'guest') { alert('Guest mode: read-only'); return; }
    if (!activeProject) return;
    const name = prompt('File path (e.g. src/utils.ts):');
    if (!name) return;
    await supabase.from('project_files').insert({
      project_id: activeProject.id,
      file_name: name.split('/').pop() || name,
      path: name,
      content: '',
    });
    await refetchFiles();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (loginState === 'guest') { alert('Guest mode: read-only'); return; }
    if (!activeProject || !e.target.files?.length) return;

    const inserts: any[] = [];
    for (const file of Array.from(e.target.files)) {
      if (file.name.endsWith('.zip')) {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        for (const [relPath, entry] of Object.entries(contents.files)) {
          if (!entry.dir && !relPath.includes('node_modules/') && !relPath.includes('.git/') && !/\.(png|jpg|ico|svg|DS_Store)$/.test(relPath)) {
            const content = await entry.async('text').catch(() => '');
            inserts.push({ project_id: activeProject.id, file_name: relPath.split('/').pop() || relPath, path: relPath, content });
          }
        }
      } else {
        const text = await file.text().catch(() => '');
        const relPath = (file as any).webkitRelativePath || file.name;
        if (!relPath.includes('node_modules/') && !relPath.includes('.git/')) {
          inserts.push({ project_id: activeProject.id, file_name: file.name, path: relPath, content: text });
        }
      }
    }

    if (inserts.length) { await supabase.from('project_files').insert(inserts); await refetchFiles(); }
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full text-[13px] font-sans text-[#cccccc] overflow-hidden">
      <div className="px-4 py-2 text-[10px] uppercase tracking-widest font-black text-white/40 shrink-0">Explorer</div>

      {/* Files section */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer group"
          onClick={() => setFilesExpanded(p => !p)}>
          <div className="flex items-center gap-1 font-bold">
            {filesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="uppercase text-[10px] tracking-wider">{activeProject?.name || '—'}</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <button title="New File" onClick={handleNewFile} className="p-1 hover:bg-[#333] rounded"><FilePlus size={13} /></button>
            <label title="Upload File/ZIP" className="cursor-pointer p-1 hover:bg-[#333] rounded">
              <UploadCloud size={13} />
              <input type="file" multiple accept=".zip,text/*,application/json" className="hidden" onChange={handleFileUpload} />
            </label>
            <label title="Upload Folder" className="cursor-pointer p-1 hover:bg-[#333] rounded">
              <FolderUp size={13} />
              <input type="file" multiple className="hidden" {...({ webkitdirectory: 'true', directory: 'true' } as any)} onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        {filesExpanded && (
          <div className="flex flex-col max-h-48 overflow-y-auto custom-scrollbar">
            {files.map(file => (
              <button key={file.id} onClick={() => setActiveFile(file)}
                className={cn("w-full flex items-center gap-2 pl-6 pr-2 py-[3px] cursor-pointer outline-none border-none text-left text-[12px]",
                  activeFile?.id === file.id ? "bg-[#37373d] text-white" : "text-[#cccccc] hover:bg-[#2a2d2e]")}>
                <span className="truncate">{file.path || file.file_name}</span>
              </button>
            ))}
            {files.length === 0 && <div className="pl-6 py-2 text-[11px] opacity-30 italic">No files yet</div>}
          </div>
        )}
      </div>

      {/* Tasks section */}
      <div className="mt-2 flex-1 overflow-y-auto custom-scrollbar flex flex-col border-t border-[#333]">
        <div className="flex items-center justify-between px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer group shrink-0"
          onClick={() => setTasksExpanded(p => !p)}>
          <div className="flex items-center gap-1 font-bold">
            {tasksExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="uppercase text-[10px] tracking-wider">Tasks</span>
            <span className="text-[9px] opacity-30 ml-1">({filteredTasks.length})</span>
          </div>
          {isAdmin && (
            <button onClick={e => { e.stopPropagation(); setIsTaskModalOpen(true); }}
              className="p-1 hover:bg-[#333] rounded opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={13} /></button>
          )}
        </div>

        {tasksExpanded && (
          <>
            <div className="flex gap-2 px-6 mb-2 mt-1 shrink-0">
              {(['ALL', 'TODO', 'DONE'] as const).map(f => (
                <button key={f} onClick={() => setTaskFilter(f)}
                  className={cn("text-[9px] uppercase tracking-wider px-1", taskFilter === f ? "text-white border-b border-white" : "text-[#858585] hover:text-[#cccccc]")}>
                  {f}
                </button>
              ))}
            </div>

            <div className="flex flex-col">
              {filteredTasks.map(task => {
                const isMine = task.assignee_id === currentUserId;
                const isUnassigned = !task.assignee_id;
                const assignee = users.find(u => u.id === task.assignee_id);

                return (
                  <div key={task.id} className="flex flex-col pl-6 pr-2 py-1.5 hover:bg-[#2a2d2e] group border-b border-white/3">
                    <div className="flex items-start gap-2">
                      <div className={cn("w-2 h-2 mt-1.5 rounded-sm shrink-0",
                        task.status === 'DONE' ? "bg-green-500" : task.status === 'IN_PROGRESS' ? "bg-[#007acc]" : "border border-[#858585]")} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className={cn("truncate text-[12px]", task.status === 'DONE' && "text-[#858585] line-through")}>{task.title}</span>
                        {task.description && <span className="text-[10px] text-[#858585] line-clamp-1 mt-0.5">{task.description}</span>}
                        {assignee && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-3.5 h-3.5 rounded-full bg-[#3c3c3c] text-white flex items-center justify-center text-[9px]">{assignee.full_name[0]}</div>
                            <span className="text-[10px] text-[#858585]">{assignee.full_name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-4 mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                      {isAdmin && (
                        <select value={task.assignee_id || ''} onChange={e => updateTask(task.id, { assignee_id: e.target.value || null })}
                          className="bg-[#3c3c3c] border border-[#3c3c3c] text-[10px] p-0.5 outline-none rounded">
                          <option value="">Unassigned</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                        </select>
                      )}
                      {isAdmin && (
                        <select value={task.status} onChange={e => updateTask(task.id, { status: e.target.value })}
                          className="bg-[#3c3c3c] border border-[#3c3c3c] text-[10px] p-0.5 outline-none rounded">
                          <option value="TODO">TODO</option>
                          <option value="IN_PROGRESS">IN PROGRESS</option>
                          <option value="DONE">DONE</option>
                        </select>
                      )}
                      {!isAdmin && isUnassigned && task.status !== 'DONE' && (
                        <button onClick={() => updateTask(task.id, { assignee_id: currentUserId, status: 'IN_PROGRESS' })}
                          className="text-[10px] bg-[#007acc] text-white px-2 py-0.5 rounded">Take Task</button>
                      )}
                      {!isAdmin && isMine && task.status === 'IN_PROGRESS' && (
                        <button onClick={() => updateTask(task.id, { status: 'DONE' })}
                          className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded">Mark Done</button>
                      )}
                      {!isAdmin && isMine && task.status === 'TODO' && (
                        <button onClick={() => updateTask(task.id, { status: 'IN_PROGRESS' })}
                          className="text-[10px] border border-[#007acc] text-[#007acc] px-2 py-0.5 rounded">Start</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredTasks.length === 0 && <div className="pl-6 py-4 text-[10px] opacity-30 italic">No tasks</div>}
            </div>
          </>
        )}
      </div>

      <NewTaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} />
    </div>
  );
}
