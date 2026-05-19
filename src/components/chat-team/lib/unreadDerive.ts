import type { Message } from '@/lib/supabaseClient';

export function deriveUnread(
  messages: Pick<Message, 'id' | 'author_id' | 'created_at'>[],
  lastReadAt: string | null,
  myId: string,
): number {
  const threshold = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return messages.filter(
    m => m.author_id !== myId && new Date(m.created_at).getTime() > threshold,
  ).length;
}
