import type { Channel, Message } from '@/lib/supabaseClient';

export const DEMO_CHANNEL_ID = 'demo-ch-general' as const;

export const DEMO_CHANNELS: Channel[] = [
  {
    id: DEMO_CHANNEL_ID,
    project_id: 'demo',
    name: 'general',
    description: 'Project chat',
    created_by: 'demo-1',
    archived: false,
    created_at: new Date().toISOString(),
  },
];

export const DEMO_MESSAGES: Message[] = [
  {
    id: 'dm1',
    context_type: 'channel',
    context_id: DEMO_CHANNEL_ID,
    author_id: 'demo-1',
    body: 'Welcome to the CREATstudio chat. Type away.',
    command: null,
    replies_to: null,
    model_id: null,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    edited_at: null,
  },
  {
    id: 'dm2',
    context_type: 'channel',
    context_id: DEMO_CHANNEL_ID,
    author_id: 'demo-2',
    body: 'Setting up RAG pipeline now.',
    command: null,
    replies_to: null,
    model_id: null,
    created_at: new Date(Date.now() - 1800_000).toISOString(),
    edited_at: null,
  },
];
