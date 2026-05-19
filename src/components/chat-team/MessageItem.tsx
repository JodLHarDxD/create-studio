import React from 'react';
import type { Message, Profile } from '@/lib/supabaseClient';

interface Props {
  message: Message;
  author: Profile | null;
  isMine: boolean;
}

export default function MessageItem({ message, author, isMine: _isMine }: Props) {
  const ts = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isBot = author?.is_bot === true;

  return (
    <div style={{ padding: '8px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: isBot ? 'rgba(197,184,255,0.15)' : 'rgba(255,255,255,0.06)',
        border: isBot ? '1px solid rgba(197,184,255,0.4)' : '1px solid var(--border-chat)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 600, color: 'var(--text-2-chat)',
        flexShrink: 0,
      }}>
        {isBot ? '🤖' : author?.full_name?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1-chat)' }}>
            {author?.full_name ?? 'Unknown'}
          </span>
          <span className="tabular" style={{ fontSize: 11, color: 'var(--text-3-chat)' }}>{ts}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2-chat)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2 }}>
          {message.body}
        </div>
      </div>
    </div>
  );
}
