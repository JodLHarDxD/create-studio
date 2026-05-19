export function canonicalDMPair(a: string, b: string): { user_a_id: string; user_b_id: string } {
  if (a === b) throw new Error('canonicalDMPair: ids must differ');
  return a < b ? { user_a_id: a, user_b_id: b } : { user_a_id: b, user_b_id: a };
}
