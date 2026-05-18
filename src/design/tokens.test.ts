import { describe, it, expect } from 'vitest';
import { colors, typography, motion, spacing } from './tokens';

describe('design tokens', () => {
  it('exposes the Obsidian dark palette', () => {
    expect(colors.bg.void).toBe('#EFEAE0');
    expect(colors.bg.app).toBe('#F4EFE6');
    expect(colors.bg.editor).toBe('#E8E2D6');
    expect(colors.bg.tabBar).toBe('#DDD5C6');
  });

  it('exposes text + accent colors', () => {
    expect(colors.text.primary).toBe('#1A1612');
    expect(colors.text.secondary).toBe('#6B645C');
    expect(colors.text.muted).toBe('#9B948A');
    expect(colors.accent.amber).toBe('#f59e0b');
    expect(colors.accent.blue).toBe('#4f8ef7');
  });

  it('exposes border tokens as rgba strings', () => {
    expect(colors.border.faint).toBe('rgba(26,22,18,0.07)');
    expect(colors.border.subtle).toBe('rgba(26,22,18,0.11)');
    expect(colors.border.visible).toBe('rgba(26,22,18,0.18)');
  });

  it('exposes typography size scale', () => {
    expect(typography.size.label).toBe('9px');
    expect(typography.size.ui).toBe('11px');
    expect(typography.size.body).toBe('13px');
    expect(typography.size.editor).toBe('13px');
  });

  it('exposes motion durations in seconds (for motion/react)', () => {
    expect(motion.duration.instant).toBe(0.1);
    expect(motion.duration.fast).toBe(0.2);
    expect(motion.duration.base).toBe(0.32);
    expect(motion.duration.slow).toBe(0.55);
    expect(motion.duration.cinematic).toBe(1.1);
  });

  it('exposes easing curves as cubic-bezier arrays', () => {
    expect(motion.ease.standard).toEqual([0.22, 1, 0.36, 1]);
    expect(motion.ease.entrance).toEqual([0.16, 1, 0.3, 1]);
    expect(motion.ease.exit).toEqual([0.7, 0, 0.84, 0]);
  });

  it('exposes spacing scale in px', () => {
    expect(spacing.activityBar).toBe(48);
    expect(spacing.sidebar).toBe(260);
    expect(spacing.chatPanel).toBe(360);
    expect(spacing.statusBar).toBe(28);
  });
});
