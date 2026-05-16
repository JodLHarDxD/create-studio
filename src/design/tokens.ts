export const colors = {
  bg: {
    true: '#000000',
    app: '#0a0a0a',
    editor: '#1e1e1e',
    tabBar: '#252526',
    panelBorder: '#3c3c3c',
  },
  text: {
    primary: '#f5f5f4',
    main: '#cccccc',
    muted: '#858585',
  },
  accent: {
    blue: '#007acc',
    green: '#22c55e',
    red: '#ef4444',
    yellow: '#eab308',
  },
  border: {
    subtle: 'rgba(255,255,255,0.1)',
    visible: 'rgba(255,255,255,0.2)',
    strong: 'rgba(255,255,255,1)',
  },
} as const;

export const typography = {
  size: {
    label: '8px',
    ui: '10px',
    body: '12px',
    editor: '13px',
  },
  tracking: {
    widest: '0.2em',
    cinematic: '0.4em',
  },
} as const;

export const spacing = {
  activityBar: 56,
  sidebar: 280,
  chatPanel: 380,
  statusBar: 24,
  terminalPanel: 176,
} as const;

export const motion = {
  duration: {
    instant: 0.12,
    fast: 0.24,
    base: 0.36,
    slow: 0.6,
    cinematic: 1.2,
  },
  ease: {
    standard: [0.22, 1, 0.36, 1] as const,
    entrance: [0.16, 1, 0.3, 1] as const,
    exit: [0.7, 0, 0.84, 0] as const,
    spring: { type: 'spring' as const, stiffness: 260, damping: 28 },
  },
} as const;
