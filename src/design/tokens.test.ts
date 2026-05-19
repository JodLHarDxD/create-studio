import { describe, it, expect } from 'vitest';
import { colors, typography, motion, spacing } from './tokens';

describe('design tokens — dark luxury cinematic', () => {
  it('exposes the obsidian dark palette', () => {
    expect(colors.bg.void).toBe('#09090b');
    expect(colors.bg.app).toBe('#0a0a0c');
    expect(colors.bg.surface).toBe('#18181b');
    expect(colors.bg.raised).toBe('#1c1c20');
    expect(colors.bg.editor).toBe('#0a0a0c');
    expect(colors.bg.tabBar).toBe('#101013');
  });

  it('exposes zinc text scale', () => {
    expect(colors.text.primary).toBe('#f4f4f5');
    expect(colors.text.secondary).toBe('#d4d4d8');
    expect(colors.text.muted).toBe('#a1a1aa');
    expect(colors.text.dim).toBe('#71717a');
  });

  it('exposes cinematic accents', () => {
    expect(colors.accent.emerald).toBe('#34d399');
    expect(colors.accent.violet).toBe('#8b5cf6');
  });

  it('exposes border tokens as rgba strings', () => {
    expect(colors.border.faint).toBe('rgba(255,255,255,0.04)');
    expect(colors.border.subtle).toBe('rgba(255,255,255,0.06)');
    expect(colors.border.visible).toBe('rgba(255,255,255,0.12)');
  });

  it('exposes typography size scale', () => {
    expect(typography.size.micro).toBe('9px');
    expect(typography.size.ui).toBe('11px');
    expect(typography.size.body).toBe('13px');
    expect(typography.size.editor).toBe('13px');
  });

  it('uses Playfair Display as the editorial serif', () => {
    expect(typography.font.display).toContain('Playfair Display');
    expect(typography.font.sans).toContain('Inter');
    expect(typography.font.mono).toContain('JetBrains Mono');
  });

  it('exposes motion durations in seconds', () => {
    expect(motion.duration.instant).toBe(0.1);
    expect(motion.duration.fast).toBe(0.2);
    expect(motion.duration.base).toBe(0.32);
    expect(motion.duration.slow).toBe(0.55);
    expect(motion.duration.cinematic).toBe(1.1);
  });

  it('uses the cinematic ease curve from design.md', () => {
    expect(motion.ease.entrance).toEqual([0.16, 1, 0.3, 1]);
    expect(motion.ease.standard).toEqual([0.16, 1, 0.3, 1]);
  });

  it('exposes spacing scale in px', () => {
    expect(spacing.activityBar).toBe(48);
    expect(spacing.sidebar).toBe(260);
    expect(spacing.chatPanel).toBe(360);
    expect(spacing.statusBar).toBe(28);
  });
});
