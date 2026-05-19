import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Message, MessageContextType } from '@/lib/supabaseClient';

export function useMessages(type: MessageContextType | null, id: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!type || !id) { setMessages([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('context_type', type)
        .eq('context_id', id)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) console.error('useMessages fetch:', error);
      if (data) setMessages(data as Message[]);
    } finally {
      setLoading(false);
    }
  }, [type, id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!type || !id) return;
    const channel = supabase
      .channel(`msg:${type}:${id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages',
          filter: `context_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Message;
          if (m.context_type !== type) return;
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages',
          filter: `context_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Message;
          if (m.context_type !== type) return;
          setMessages(prev => prev.map(x => x.id === m.id ? m : x));
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages',
          filter: `context_id=eq.${id}` },
        (payload) => {
          const m = payload.old as Message;
          setMessages(prev => prev.filter(x => x.id !== m.id));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [type, id]);

  return { messages, loading, refetch: fetchMessages };
}
