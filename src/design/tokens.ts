export const colors = {
  // Obsidian surface scale
  bg: {
    void:    '#030303',
    app:     '#080808',
    surface: '#0e0e0e',
    raised:  '#141414',
    editor:  '#1e1e1e',
    tabBar:  '#252526',
  },
  // Warm text
  text: {
    primary:  '#f7f3ee',
    secondary: '#a09590',
    muted:    '#5e5855',
    dim:      '#3a3836',
    active:   '#ffffff',
  },
  // Signature accent: warm amber
  accent: {
    amber:    '#f59e0b',
    amberDim: 'rgba(245,158,11,0.12)',
    amberGlow:'rgba(245,158,11,0.06)',
    blue:     '#4f8ef7',
    blueDim:  'rgba(79,142,247,0.12)',
  },
  // Semantic
  status: {
    green:  '#4ade80',
    red:    '#f87171',
    yellow: '#fbbf24',
  },
  // Borders
  border: {
    faint:   'rgba(255,255,255,0.05)',
    subtle:  'rgba(255,255,255,0.09)',
    visible: 'rgba(255,255,255,0.16)',
    amber:   'rgba(245,158,11,0.3)',
  },
} as const;

export const typography = {
  font: {
    sans:    '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    display: '"Syne", ui-sans-serif, system-ui, sans-serif',
    mono:    '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  },
  size: {
    label:  '9px',
    ui:     '11px',
    body:   '13px',
    editor: '13px',
  },
  tracking: {
    widest: '0.18em',
    wide:   '0.1em',
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
    standard: [0.22, 1, 0.36, 1] as const,
    entrance: [0.16, 1, 0.3, 1]  as const,
    exit:     [0.7, 0, 0.84, 0]  as const,
    spring:   { type: 'spring' as const, stiffness: 280, damping: 30 },
  },
} as const;
