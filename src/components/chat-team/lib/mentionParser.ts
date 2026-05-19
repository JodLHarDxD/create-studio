import type { Profile } from '@/lib/supabaseClient';

export function extractMentions(text: string, users: Profile[]): string[] {
  const ids = new Set<string>();
  const re = /@(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const handle = m[1].toLowerCase();
    const u = users.find(u => u.full_name.split(/\s+/)[0]?.toLowerCase() === handle);
    if (u) ids.add(u.id);
  }
  return Array.from(ids);
}
