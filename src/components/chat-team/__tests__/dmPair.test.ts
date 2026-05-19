import { describe, it, expect } from 'vitest';
import { canonicalDMPair } from '../lib/dmPair';

describe('canonicalDMPair', () => {
  it('orders smaller uuid as user_a', () => {
    expect(canonicalDMPair('bbb', 'aaa')).toEqual({ user_a_id: 'aaa', user_b_id: 'bbb' });
  });
  it('preserves order when already canonical', () => {
    expect(canonicalDMPair('aaa', 'bbb')).toEqual({ user_a_id: 'aaa', user_b_id: 'bbb' });
  });
  it('throws when identical', () => {
    expect(() => canonicalDMPair('aaa', 'aaa')).toThrow();
  });
});
