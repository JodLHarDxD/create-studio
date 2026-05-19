import React, { useState } from 'react';
import { Hash, Plus } from 'lucide-react';
import type { Channel } from '@/lib/supabaseClient';
import { useChat, contextKey } from '@/contexts/ChatContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import NewChannelModal from './NewChannelModal';

interface Props {
  channels: Channel[];
  onRefetchChannels: () => void;
}

export default function ContextList({ channels, onRefetchChannels }: Props) {
  const { userRole } = useWorkspace();
  const { activeContext, setActiveContext, unreadMap } = useChat();
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
        color: 'var(--text-3-chat)', textTransform: 'uppercase',
        padding: '8px 8px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Channels</span>
        {userRole === 'ADMIN' && (
          <button
            onClick={() => setNewOpen(true)}
            title="New channel"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-3-chat)', cursor: 'pointer' }}
          ><Plus size={12} /></button>
        )}
      </div>

      {channels.filter(c => !c.archived).map(c => {
        const key = contextKey('channel', c.id);
        const u = unreadMap[key]?.unread ?? 0;
        const isActive = activeContext?.type === 'channel' && activeContext.id === c.id;
        return (
          <button
            key={c.id}
            onClick={() => setActiveContext({ type: 'channel', id: c.id, title: c.name })}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 'var(--radius-chip)',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              color: isActive ? 'var(--text-1-chat)' : 'var(--text-2-chat)',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              fontSize: 13, fontWeight: u > 0 ? 600 : 400,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Hash size={13} style={{ opacity: 0.6 }} />
              {c.name}
            </span>
            {u > 0 && (
              <span className="tabular" style={{
                background: 'var(--accent)', color: '#09090b',
                fontSize: 10, fontWeight: 700, padding: '1px 6px',
                borderRadius: 999, minWidth: 16, textAlign: 'center',
              }}>{u}</span>
            )}
          </button>
        );
      })}

      <NewChannelModal
        isOpen={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={onRefetchChannels}
      />
    </div>
  );
}
