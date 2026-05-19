import React, { createContext, useContext, useState } from 'react';
import type { Task, MessageContextType } from '@/lib/supabaseClient';

export interface ActiveContext {
  type: MessageContextType;
  id: string;
  title: string;
}

interface UnreadEntry { unread: number; mentions: number; }
export type UnreadMap = Record<string, UnreadEntry>;     // key = `${type}:${id}`

interface ChatContextType {
  activeContext: ActiveContext | null;
  setActiveContext: React.Dispatch<React.SetStateAction<ActiveContext | null>>;
  activeTaskThread: Task | null;
  setActiveTaskThread: React.Dispatch<React.SetStateAction<Task | null>>;
  unreadMap: UnreadMap;
  setUnreadMap: React.Dispatch<React.SetStateAction<UnreadMap>>;
  onlineUserIds: Set<string>;
  setOnlineUserIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const Ctx = createContext<ChatContextType | undefined>(undefined);

export function contextKey(type: MessageContextType, id: string): string {
  return `${type}:${id}`;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [activeContext, setActiveContext] = useState<ActiveContext | null>(null);
  const [activeTaskThread, setActiveTaskThread] = useState<Task | null>(null);
  const [unreadMap, setUnreadMap] = useState<UnreadMap>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  return (
    <Ctx.Provider value={{
      activeContext, setActiveContext,
      activeTaskThread, setActiveTaskThread,
      unreadMap, setUnreadMap,
      onlineUserIds, setOnlineUserIds,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useChat() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChat must be used within ChatProvider');
  return v;
}
