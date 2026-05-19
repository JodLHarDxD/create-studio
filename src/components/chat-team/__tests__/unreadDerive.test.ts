import { describe, it, expect } from 'vitest';
import { deriveUnread } from '../lib/unreadDerive';

const me = 'me';
const t = (offsetMin: number) => new Date(Date.now() + offsetMin * 60_000).toISOString();

describe('deriveUnread', () => {
  it('counts messages newer than last_read_at, excluding own', () => {
    const msgs = [
      { id: '1', author_id: me, created_at: t(-10) },
      { id: '2', author_id: 'other', created_at: t(-5) },
      { id: '3', author_id: 'other', created_at: t(-1) },
    ];
    expect(deriveUnread(msgs as any, t(-7), me)).toBe(2);
  });
  it('returns 0 when no last_read_at provided (epoch fallback) but only own msgs', () => {
    const msgs = [{ id: '1', author_id: me, created_at: t(-1) }];
    expect(deriveUnread(msgs as any, null, me)).toBe(0);
  });
  it('counts everything if last_read_at is epoch', () => {
    const msgs = [
      { id: '1', author_id: 'a', created_at: t(-1) },
      { id: '2', author_id: 'b', created_at: t(-2) },
    ];
    expect(deriveUnread(msgs as any, null, me)).toBe(2);
  });
});
