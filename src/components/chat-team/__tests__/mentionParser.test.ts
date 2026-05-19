import { describe, it, expect } from 'vitest';
import { extractMentions } from '../lib/mentionParser';

const users = [
  { id: 'u1', full_name: 'Alice', email: 'a@x' },
  { id: 'u2', full_name: 'Bob Stone', email: 'b@x' },
];

describe('extractMentions', () => {
  it('finds single @user by full_name token match', () => {
    expect(extractMentions('hey @Alice can you check', users as any)).toEqual(['u1']);
  });
  it('matches first word of multi-word name', () => {
    expect(extractMentions('@Bob have a sec?', users as any)).toEqual(['u2']);
  });
  it('returns empty when no @', () => {
    expect(extractMentions('plain text', users as any)).toEqual([]);
  });
  it('deduplicates repeated mentions', () => {
    expect(extractMentions('@Alice @Alice', users as any)).toEqual(['u1']);
  });
  it('ignores unknown @names', () => {
    expect(extractMentions('@Ghost', users as any)).toEqual([]);
  });
});
