import { describe, it, expect } from 'vitest';
import { deriveUnread } from '../lib/unreadDerive';

const me = 'me';
// Static ISO strings — no wall-clock dependency
const T0 = '2025-01-01T00:00:00.000Z'; // baseline (used as lastReadAt)
const T1 = '2025-01-01T00:05:00.000Z'; // 5 min after T0
const T2 = '2025-01-01T00:10:00.000Z'; // 10 min after T0
const T_BEFORE = '2024-12-31T23:55:00.000Z'; // 5 min before T0

describe('deriveUnread', () => {
  it('counts messages newer than last_read_at, excluding own', () => {
    const msgs = [
      { id: '1', author_id: me, created_at: T_BEFORE }, // own, before threshold — excluded
      { id: '2', author_id: 'other', created_at: T1 },  // other, after threshold — counted
      { id: '3', author_id: 'other', created_at: T2 },  // other, after threshold — counted
    ];
    expect(deriveUnread(msgs as any, T0, me)).toBe(2);
  });
  it('returns 0 when no last_read_at provided (epoch fallback) but only own msgs', () => {
    const msgs = [{ id: '1', author_id: me, created_at: T1 }];
    expect(deriveUnread(msgs as any, null, me)).toBe(0);
  });
  it('counts everything if last_read_at is null (epoch fallback)', () => {
    const msgs = [
      { id: '1', author_id: 'a', created_at: T1 },
      { id: '2', author_id: 'b', created_at: T2 },
    ];
    expect(deriveUnread(msgs as any, null, me)).toBe(2);
  });
});
