import React, { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { MessageContextType } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Props {
  contextType: MessageContextType;
  contextId: string;
}

export default function MessageComposer({ contextType, contextId }: Props) {
  const { currentUserId, loginState } = useWorkspace();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // synchronous guard against keydown repeat races

  const send = async () => {
    const body = value.trim();
    if (!body || !currentUserId || sendingRef.current) return;
    if (loginState === 'guest') {
      setValue('');
      return;
    }
    sendingRef.current = true;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      context_type: contextType,
      context_id: contextId,
      author_id: currentUserId,
      body,
    });
    sendingRef.current = false;
    setSending(false);
    if (error) { console.error('send:', error); return; }
    setValue('');
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{
      borderTop: '1px solid var(--border-chat)',
      padding: 12,
      display: 'flex',
      gap: 8,
      alignItems: 'flex-end',
      background: 'var(--bg-card)',
    }}>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKey}
        placeholder="Type a message…"
        rows={1}
        style={{
          flex: 1, resize: 'none', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-chat)', borderRadius: 'var(--radius-chip)',
          color: 'var(--text-1-chat)', fontFamily: 'inherit', fontSize: 13,
          padding: '8px 12px', maxHeight: 120, outline: 'none',
        }}
      />
      <button
        onClick={send}
        disabled={sending || !value.trim()}
        style={{
          width: 36, height: 36, borderRadius: 'var(--radius-chip)',
          background: 'var(--accent)', color: '#09090b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', opacity: value.trim() ? 1 : 0.4,
        }}
      >
        <Send size={16} />
      </button>
    </div>
  );
}
