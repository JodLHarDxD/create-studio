import React from 'react';
import { ArrowLeft, Hash } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';

export default function ContextHeader() {
  const { activeContext, setActiveContext } = useChat();
  if (!activeContext) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px', borderBottom: '1px solid var(--border-chat)',
      background: 'var(--bg-card)',
    }}>
      <button
        onClick={() => setActiveContext(null)}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-2-chat)', cursor: 'pointer' }}
      ><ArrowLeft size={16} /></button>
      <Hash size={14} style={{ color: 'var(--text-3-chat)' }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1-chat)' }}>
        {activeContext.title}
      </span>
    </div>
  );
}
