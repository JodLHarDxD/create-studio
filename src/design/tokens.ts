export const colors = {
  // Obsidian surface scale
  bg: {
    void:    '#EFEAE0',
    app:     '#F4EFE6',
    surface: '#0e0e0e',
    raised:  '#141414',
    editor:  '#E8E2D6',
    tabBar:  '#DDD5C6',
  },
  // Warm text
  text: {
    primary:  '#1A1612',
    secondary: '#6B645C',
    muted:    '#9B948A',
    dim:      '#C4BDB1',
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
    green:  '#4A6B3A',
    red:    '#B53C2A',
    yellow: '#C99A2E',
  },
  // Borders
  border: {
    faint:   'rgba(26,22,18,0.07)',
    subtle:  'rgba(26,22,18,0.11)',
    visible: 'rgba(26,22,18,0.18)',
    amber:   'rgba(245,158,11,0.3)',
  },
} as const;

export const typography = {
  font: {
    sans:    '"Inter", ui-sans-serif, system-ui, sans-serif',
    display: '"Fraunces", "Iowan Old Style", Georgia, serif',
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

export const chatTokens = {
  bg: {
    base:     '#0E1014',
    card:     '#1A1D24',
    elevated: '#222630',
  },
  text: {
    primary:   '#FFFFFF',
    secondary: '#A8ADB8',
    tertiary:  '#6B7080',
  },
  accent: {
    lavender: '#C5B8FF',
    cream:    '#E8E2A8',
    success:  '#7ED4A8',
    danger:   '#FF8B8B',
  },
  border: 'rgba(255,255,255,0.06)',
  radius: {
    card: 16,
    chip: 10,
  },
  font: {
    sans: '"Inter", "General Sans", ui-sans-serif, system-ui, sans-serif',
  },
} as const;
