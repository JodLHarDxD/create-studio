import { describe, it, expect } from 'vitest';
import { colors, typography, motion, spacing } from './tokens';

describe('design tokens', () => {
  it('exposes the canonical VSCode dark palette', () => {
    expect(colors.bg.app).toBe('#0a0a0a');
    expect(colors.bg.editor).toBe('#1e1e1e');
    expect(colors.bg.tabBar).toBe('#252526');
    expect(colors.bg.true).toBe('#000000');
  });

  it('exposes text + accent colors', () => {
    expect(colors.text.primary).toBe('#f5f5f4');
    expect(colors.text.main).toBe('#cccccc');
    expect(colors.text.muted).toBe('#858585');
    expect(colors.accent.blue).toBe('#007acc');
  });

  it('exposes border tokens as rgba strings', () => {
    expect(colors.border.subtle).toBe('rgba(255,255,255,0.1)');
    expect(colors.border.visible).toBe('rgba(255,255,255,0.2)');
  });

  it('exposes typography size scale', () => {
    expect(typography.size.label).toBe('8px');
    expect(typography.size.ui).toBe('10px');
    expect(typography.size.body).toBe('12px');
    expect(typography.size.editor).toBe('13px');
  });

  it('exposes motion durations in seconds (for motion/react)', () => {
    expect(motion.duration.instant).toBe(0.12);
    expect(motion.duration.fast).toBe(0.24);
    expect(motion.duration.base).toBe(0.36);
    expect(motion.duration.slow).toBe(0.6);
    expect(motion.duration.cinematic).toBe(1.2);
  });

  it('exposes easing curves as cubic-bezier arrays', () => {
    expect(motion.ease.standard).toEqual([0.22, 1, 0.36, 1]);
    expect(motion.ease.entrance).toEqual([0.16, 1, 0.3, 1]);
    expect(motion.ease.exit).toEqual([0.7, 0, 0.84, 0]);
  });

  it('exposes spacing scale in px', () => {
    expect(spacing.activityBar).toBe(56);
    expect(spacing.sidebar).toBe(280);
    expect(spacing.chatPanel).toBe(380);
    expect(spacing.statusBar).toBe(24);
  });
});
