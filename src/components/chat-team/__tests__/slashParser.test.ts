import { describe, it, expect } from 'vitest';
import { parseSlashCommand } from '../lib/slashParser';

describe('parseSlashCommand', () => {
  it('detects /ai at start with prompt', () => {
    expect(parseSlashCommand('/ai hello there')).toEqual({ command: 'ai', prompt: 'hello there' });
  });
  it('returns null when no slash', () => {
    expect(parseSlashCommand('hello /ai world')).toBeNull();
  });
  it('returns null when command unknown', () => {
    expect(parseSlashCommand('/foo bar')).toBeNull();
  });
  it('handles slash with no prompt', () => {
    expect(parseSlashCommand('/ai')).toEqual({ command: 'ai', prompt: '' });
    expect(parseSlashCommand('/ai ')).toEqual({ command: 'ai', prompt: '' });
  });
  it('trims surrounding whitespace before parsing', () => {
    expect(parseSlashCommand('  /ai hi  ')).toEqual({ command: 'ai', prompt: 'hi' });
  });
});
