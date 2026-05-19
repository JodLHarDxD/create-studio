import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { MessageContextType } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useChat, contextKey } from '@/contexts/ChatContext';

export function useUnread() {
  const { currentUserId, activeProject } = useWorkspace();
  const { unreadMap, setUnreadMap } = useChat();

  const refetchSummary = useCallback(async () => {
    if (!currentUserId || !activeProject) return;
    const { data, error } = await supabase.rpc('get_unread_summary', {
      p_user: currentUserId,
      p_project: activeProject.id,
    });
    if (error) { console.warn('unread summary:', error); return; }
    const map: Record<string, { unread: number; mentions: number }> = {};
    for (const row of (data || [])) {
      map[contextKey(row.context_type as MessageContextType, row.context_id)] = {
        unread: row.unread,
        mentions: row.mentions,
      };
    }
    setUnreadMap(map);
  }, [currentUserId, activeProject, setUnreadMap]);

  useEffect(() => { refetchSummary(); }, [refetchSummary]);

  useEffect(() => {
    if (!activeProject) setUnreadMap({});
  }, [activeProject, setUnreadMap]);

  const markRead = useCallback(async (type: MessageContextType, id: string) => {
    if (!currentUserId) return;
    setUnreadMap(prev => ({ ...prev, [contextKey(type, id)]: { unread: 0, mentions: 0 } }));
    const { error } = await supabase.from('read_state').upsert({
      user_id: currentUserId,
      context_type: type,
      context_id: id,
      last_read_at: new Date().toISOString(),
    }, { onConflict: 'user_id,context_type,context_id' });
    if (error) console.warn('markRead upsert failed:', error);
  }, [currentUserId, setUnreadMap]);

  return { unreadMap, refetchSummary, markRead };
}
