export interface SlashInvocation {
  command: 'ai';
  prompt: string;
}

const KNOWN: ReadonlyArray<'ai'> = ['ai'];

export function parseSlashCommand(text: string): SlashInvocation | null {
  const t = text.trim();
  if (!t.startsWith('/')) return null;
  const space = t.indexOf(' ');
  const head = (space === -1 ? t.slice(1) : t.slice(1, space)).toLowerCase();
  if (!KNOWN.includes(head as 'ai')) return null;
  const prompt = space === -1 ? '' : t.slice(space + 1).trim();
  return { command: head as 'ai', prompt };
}
