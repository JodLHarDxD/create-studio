import React, { useEffect, useRef } from 'react';
import type { Message, Profile } from '@/lib/supabaseClient';
import MessageItem from './MessageItem';

interface Props {
  messages: Message[];
  users: Profile[];
  currentUserId: string | null;
}

export default function MessageList({ messages, users, currentUserId }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div
      ref={scrollRef}
      style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}
    >
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3-chat)', fontSize: 12 }}>
          No messages yet. Be the first.
        </div>
      )}
      {messages.map(m => {
        const author = users.find(u => u.id === m.author_id) ?? null;
        return (
          <MessageItem
            key={m.id}
            message={m}
            author={author}
            isMine={m.author_id === currentUserId}
          />
        );
      })}
    </div>
  );
}
