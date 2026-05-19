import React, { useEffect, useState, useCallback } from 'react';
import { supabase, Channel } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useChat } from '@/contexts/ChatContext';
import { useMessages } from './hooks/useMessages';
import { useUnread } from './hooks/useUnread';
import ContextList from './ContextList';
import ContextHeader from './ContextHeader';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';

export const DEMO_CHANNEL_ID = 'demo-ch-general' as const;

const DEMO_CHANNELS: Channel[] = [
  { id: DEMO_CHANNEL_ID, project_id: 'demo', name: 'general', description: 'Project chat',
    created_by: 'demo-1', archived: false, created_at: new Date().toISOString() },
];

export default function TeamChatPanel() {
  const { activeProject, users, currentUserId, loginState } = useWorkspace();
  const { activeContext } = useChat();
  const { markRead } = useUnread();
  const [channels, setChannels] = useState<Channel[]>([]);

  const fetchChannels = useCallback(async () => {
    if (loginState === 'guest') { setChannels(DEMO_CHANNELS); return; }
    if (!activeProject) return;
    const { data } = await supabase.from('channels')
      .select('*')
      .eq('project_id', activeProject.id)
      .order('created_at');
    if (data) setChannels(data as Channel[]);
  }, [activeProject, loginState]);

  useEffect(() => {
    if (loginState !== 'guest') setChannels([]);
  }, [activeProject, loginState]);
  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  // Realtime channel list updates
  useEffect(() => {
    if (!activeProject || loginState === 'guest') return;
    const ch = supabase.channel(`channels:${activeProject.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'channels', filter: `project_id=eq.${activeProject.id}` },
        () => fetchChannels())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchChannels, loginState]);

  const { messages } = useMessages(activeContext?.type ?? null, activeContext?.id ?? null);

  // Mark read on context open + when new messages arrive while open
  useEffect(() => {
    if (!activeContext) return;
    markRead(activeContext.type, activeContext.id);
  }, [activeContext, messages.length, markRead]);

  return (
    <div data-skin="chat-dark" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-base)',
      borderLeft: '1px solid var(--border-chat)',
    }}>
      {!activeContext && (
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border-chat)',
          fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-1-chat)',
        }}>Team Chat</div>
      )}

      {!activeContext ? (
        <ContextList channels={channels} onRefetchChannels={fetchChannels} />
      ) : (
        <>
          <ContextHeader />
          <MessageList
            messages={messages}
            users={users}
            currentUserId={currentUserId}
          />
          <MessageComposer
            contextType={activeContext.type}
            contextId={activeContext.id}
          />
        </>
      )}
    </div>
  );
}
