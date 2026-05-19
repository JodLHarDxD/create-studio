/**
 * Dark Luxury Editorial Cinematic — design tokens
 * Source of truth for visual constants.
 * Mirror durable values into the @theme block in src/index.css.
 */

export const colors = {
  // Obsidian surface scale (zinc-based)
  bg: {
    void:     '#09090b',  // zinc-950 — root canvas under WebGL
    app:      '#0a0a0c',  // app surface above WebGL
    surface:  '#18181b',  // zinc-900 — panels
    raised:   '#1c1c20',  // raised cards
    editor:   '#0a0a0c',  // Monaco frame
    tabBar:   '#101013',  // tab strip
    overlay:  'rgba(9,9,11,0.72)', // modal scrim
  },
  // Zinc text scale
  text: {
    primary:   '#f4f4f5', // zinc-100
    secondary: '#d4d4d8', // zinc-300
    muted:     '#a1a1aa', // zinc-400
    dim:       '#71717a', // zinc-500
    faint:     '#52525b', // zinc-600
    active:    '#ffffff',
    inverse:   '#09090b',
  },
  // Cinematic accents
  accent: {
    emerald:     '#34d399', // primary signal — emerald-400
    emeraldDim:  'rgba(52,211,153,0.10)',
    emeraldGlow: 'rgba(52,211,153,0.35)',
    violet:      '#8b5cf6', // secondary — violet-500
    violetDim:   'rgba(139,92,246,0.10)',
    violetGlow:  'rgba(139,92,246,0.30)',
    amber:       '#fbbf24', // warning only
    amberDim:    'rgba(251,191,36,0.10)',
  },
  // Semantic
  status: {
    green:  '#34d399',
    red:    '#f87171',
    yellow: '#fbbf24',
    blue:   '#60a5fa',
  },
  // Hairline borders
  border: {
    faint:   'rgba(255,255,255,0.04)',
    subtle:  'rgba(255,255,255,0.06)',
    visible: 'rgba(255,255,255,0.12)',
    strong:  'rgba(255,255,255,0.22)',
    accent:  'rgba(52,211,153,0.40)',
  },
} as const;

export const typography = {
  font: {
    sans:    '"Inter", ui-sans-serif, system-ui, sans-serif',
    display: '"Playfair Display", "Iowan Old Style", Georgia, serif',
    mono:    '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  },
  size: {
    micro:  '9px',
    label:  '10px',
    ui:     '11px',
    body:   '13px',
    editor: '13px',
    h3:     '20px',
    h2:     '28px',
    h1:     '48px',
    hero:   '72px',
  },
  tracking: {
    hyperWide: '0.25em',
    widest:    '0.20em',
    wide:      '0.15em',
    base:      '0.08em',
    tight:     '-0.015em',
  },
  weight: {
    light:    300,
    regular:  400,
    medium:   500,
    semibold: 600,
  },
} as const;

export const spacing = {
  activityBar: 48,
  sidebar:     260,
  chatPanel:   360,
  statusBar:   28,
} as const;

export const motion = {
  duration: {
    instant:   0.1,
    fast:      0.2,
    base:      0.32,
    slow:      0.55,
    cinematic: 1.1,
  },
  ease: {
    // Cinematic ease — design.md signature curve
    standard: [0.16, 1, 0.3, 1]  as const,
    entrance: [0.16, 1, 0.3, 1]  as const,
    exit:     [0.7, 0, 0.84, 0]  as const,
    spring:   { type: 'spring' as const, stiffness: 280, damping: 30 },
  },
} as const;

/** Legacy chat tokens kept for back-compat; merged into main dark theme. */
export const chatTokens = {
  bg: {
    base:     colors.bg.void,
    card:     colors.bg.surface,
    elevated: colors.bg.raised,
  },
  text: {
    primary:   colors.text.primary,
    secondary: colors.text.muted,
    tertiary:  colors.text.dim,
  },
  accent: {
    lavender: colors.accent.violet,
    cream:    colors.accent.emerald,
    success:  colors.status.green,
    danger:   colors.status.red,
  },
  border: colors.border.subtle,
  radius: { card: 2, chip: 2 },
  font: { sans: typography.font.sans },
} as const;
