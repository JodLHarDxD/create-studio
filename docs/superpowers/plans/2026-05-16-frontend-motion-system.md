# TeamForge Frontend Design System & Motion Graphics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate TeamForge's frontend from a working VSCode-style IDE to a frontier-level visual experience: centralized design tokens, reusable motion primitives, cinematic Login with WebGL background, animated view transitions, and a feedback primitive layer (toasts + skeletons).

**Architecture:** Add a `src/design/` module that owns tokens and motion variants — every component consumes from here, removing magic hex strings and ad-hoc animation configs. Add a `src/components/effects/` module for WebGL/visual effects. Add `src/components/ui/` for primitive UI (Toast, Skeleton). Layer enhancements onto the existing component tree without touching state contracts (`WorkspaceContext` is untouched). Vitest is added for testing logic-heavy primitives (toast queue, token getters); visual changes are gated by `npm run lint` (tsc) and a manual verification checklist per task.

**Tech Stack:** React 18, TypeScript 5.5, Tailwind v4 (`@tailwindcss/vite`), `motion` v12 (already installed), `three` + `@react-three/fiber` + `@react-three/drei` (new), Vitest + Testing Library (new — logic tests only).

**Aesthetic constraints (non-negotiable, from `src/CLAUDE.md`):**
- No `rounded-lg` / `rounded-xl` — only `rounded-sm` or no rounding (sharp aesthetic)
- No shadows — flat dark IDE
- Color palette restricted to: `#000`, `#0a0a0a`, `#1e1e1e`, `#252526`, `#cccccc`, `#858585`, `#f5f5f4`, `#007acc` (VSCode blue), `#3c3c3c`
- Typography: `font-black uppercase tracking-widest` for labels, mono for code
- Never use Tailwind named colors (`text-gray-400` etc.) — explicit hex only
- Motion package is `motion`, imported as `from 'motion/react'` (NOT `framer-motion`)

---

## File Structure

**Create:**
- `src/design/tokens.ts` — typed design tokens (colors, typography, spacing, motion durations/easings)
- `src/design/motion.ts` — reusable motion variants and transition presets
- `src/design/index.ts` — barrel export
- `src/design/tokens.test.ts` — unit tests for token getters
- `src/components/effects/WebGLBackground.tsx` — Three.js shader-based animated background for Login
- `src/components/effects/NoiseOverlay.tsx` — film-grain SVG overlay (static, low-cost)
- `src/components/ui/Toast.tsx` — single toast component
- `src/components/ui/ToastProvider.tsx` — provider + context + queue
- `src/components/ui/Skeleton.tsx` — animated skeleton primitive
- `src/components/ui/Toast.test.tsx` — toast queue logic tests
- `vitest.config.ts` — Vitest configuration
- `src/test/setup.ts` — Testing Library setup

**Modify:**
- `package.json` — add `three`, `@react-three/fiber`, `@react-three/drei`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@types/three`
- `src/index.css` — add design tokens to `@theme`, add noise/grain keyframes
- `src/App.tsx` — wrap `<Shell />` in `<ToastProvider>`
- `src/components/auth/Login.tsx` — wrap with `<WebGLBackground />`, add motion entrance variants
- `src/components/layout/Shell.tsx` — add view transitions (AnimatePresence around center panel), activity-bar `layoutId` indicator, status bar dot pulse
- `src/components/explorer/Explorer.tsx` — wrap task list items with `layout` prop for FLIP animation on status changes

**Out of scope (Phase 2+):**
- Backend changes, auth flow changes, RBAC changes (handled in separate plans)
- Real-time presence/cursor visualization
- Command palette (Cmd+K)
- Chat message streaming animation
- Dashboard chart animations beyond Recharts defaults

---

## Phase 1 — Foundations: Tokens, Motion Primitives, Test Scaffold

### Task 1: Install new dependencies

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add runtime deps**

Run from `d:\creat studio`:

```powershell
npm install three@^0.169.0 @react-three/fiber@^8.17.10 @react-three/drei@^9.114.3
```

- [ ] **Step 2: Add dev deps**

```powershell
npm install -D vitest@^2.1.0 @testing-library/react@^16.0.1 @testing-library/jest-dom@^6.5.0 jsdom@^25.0.0 @types/three@^0.169.0
```

- [ ] **Step 3: Verify install**

Run: `npm ls three @react-three/fiber vitest`
Expected: All three resolved without `UNMET DEPENDENCY` warnings.

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json
git commit -m "chore: add three.js, R3F, and vitest deps for design system"
```

---

### Task 2: Vitest configuration

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 2: Create `src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 3: Add scripts to `package.json`**

In the `"scripts"` object, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Smoke test the runner**

Run: `npx vitest run --reporter=verbose`
Expected: Exits 0 with "No test files found, exiting with code 0" — confirms config loads.

- [ ] **Step 5: Commit**

```powershell
git add vitest.config.ts src/test/setup.ts package.json
git commit -m "chore: configure vitest with jsdom + testing-library"
```

---

### Task 3: Design tokens module (test-first)

**Files:**
- Create: `src/design/tokens.ts`
- Create: `src/design/tokens.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/design/tokens.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 7 failing tests (module not found).

- [ ] **Step 3: Implement `src/design/tokens.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All 7 tests pass.

- [ ] **Step 5: Type-check**

Run: `npm run lint`
Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```powershell
git add src/design/tokens.ts src/design/tokens.test.ts
git commit -m "feat(design): add typed design tokens module"
```

---

### Task 4: Motion variants library

**Files:**
- Create: `src/design/motion.ts`
- Create: `src/design/index.ts`

- [ ] **Step 1: Create `src/design/motion.ts`**

```typescript
import type { Variants, Transition } from 'motion/react';
import { motion as motionTokens } from './tokens';

export const transitions = {
  fast: { duration: motionTokens.duration.fast, ease: motionTokens.ease.standard } as Transition,
  base: { duration: motionTokens.duration.base, ease: motionTokens.ease.standard } as Transition,
  slow: { duration: motionTokens.duration.slow, ease: motionTokens.ease.standard } as Transition,
  cinematic: { duration: motionTokens.duration.cinematic, ease: motionTokens.ease.entrance } as Transition,
  spring: motionTokens.ease.spring as Transition,
};

export const variants = {
  fadeUp: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: transitions.base },
    exit: { opacity: 0, y: -8, transition: transitions.fast },
  } satisfies Variants,

  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: transitions.base },
    exit: { opacity: 0, transition: transitions.fast },
  } satisfies Variants,

  scaleIn: {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: transitions.base },
    exit: { opacity: 0, scale: 0.98, transition: transitions.fast },
  } satisfies Variants,

  slideRight: {
    hidden: { x: -16, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: transitions.base },
    exit: { x: 16, opacity: 0, transition: transitions.fast },
  } satisfies Variants,

  cinematicReveal: {
    hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: transitions.cinematic,
    },
  } satisfies Variants,

  staggerContainer: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  } satisfies Variants,

  staggerChild: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: transitions.fast },
  } satisfies Variants,
};
```

- [ ] **Step 2: Create barrel `src/design/index.ts`**

```typescript
export * from './tokens';
export * from './motion';
```

- [ ] **Step 3: Type-check**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```powershell
git add src/design/motion.ts src/design/index.ts
git commit -m "feat(design): add motion variants library"
```

---

### Task 5: Sync tokens into Tailwind v4 `@theme`

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Read current file**

Confirm the existing `@theme` block contains only `--font-sans` and `--font-mono`.

- [ ] **Step 2: Extend `@theme` with token CSS variables**

Replace the existing `@theme { ... }` block with:

```css
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --color-bg-true: #000000;
  --color-bg-app: #0a0a0a;
  --color-bg-editor: #1e1e1e;
  --color-bg-tabbar: #252526;
  --color-panel-border: #3c3c3c;

  --color-text-primary: #f5f5f4;
  --color-text-main: #cccccc;
  --color-text-muted: #858585;
  --color-accent-blue: #007acc;
}
```

- [ ] **Step 3: Append grain keyframes after the `.border-subtle` rule**

At the bottom of `src/index.css`, append:

```css
@keyframes grain-shift {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-2%, -3%); }
  20% { transform: translate(-4%, 2%); }
  30% { transform: translate(2%, -4%); }
  40% { transform: translate(-2%, 5%); }
  50% { transform: translate(-4%, 2%); }
  60% { transform: translate(3%, 0%); }
  70% { transform: translate(0%, 3%); }
  80% { transform: translate(-3%, 4%); }
  90% { transform: translate(2%, -3%); }
}

.grain-overlay {
  animation: grain-shift 8s steps(10) infinite;
  pointer-events: none;
  mix-blend-mode: overlay;
  opacity: 0.06;
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev` and open `http://localhost:5173`.
Expected: App renders unchanged (tokens are additive). No console warnings.

- [ ] **Step 5: Commit**

```powershell
git add src/index.css
git commit -m "feat(design): expose token CSS variables in tailwind @theme + grain keyframes"
```

---

## Phase 2 — Cinematic Login: WebGL Background

### Task 6: WebGL background component

**Files:**
- Create: `src/components/effects/WebGLBackground.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

// Shader: slowly-rotating noise gradient, monochrome, low-contrast.
// Matches sharp dark VSCode aesthetic — no rainbow, no flashy effects.
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  // Simplex-ish hash noise (cheap)
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.05;
    float n = noise(uv * 3.0 + vec2(t, -t * 0.7));
    n += 0.5 * noise(uv * 6.0 + vec2(-t * 1.3, t));
    n *= 0.5;

    // Radial vignette toward center
    float dist = distance(uv, vec2(0.5));
    float vignette = smoothstep(0.9, 0.2, dist);

    // Subtle blue tint on the high end (VSCode accent)
    vec3 base = vec3(0.04, 0.04, 0.05);
    vec3 highlight = vec3(0.0, 0.48, 0.80) * 0.06;
    vec3 color = base + n * 0.08 + highlight * n;
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function ShaderPlane() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
      />
    </mesh>
  );
}

export default function WebGLBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        dpr={[1, 1.5]}
      >
        <ShaderPlane />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```powershell
git add src/components/effects/WebGLBackground.tsx
git commit -m "feat(effects): add Three.js shader background"
```

---

### Task 7: Noise overlay component

**Files:**
- Create: `src/components/effects/NoiseOverlay.tsx`

- [ ] **Step 1: Create the component**

```typescript
// SVG-based film grain. Static SVG + CSS animation (set in index.css as .grain-overlay).
// Costs nothing per frame after first paint.
export default function NoiseOverlay() {
  return (
    <div className="fixed inset-0 z-10 grain-overlay" aria-hidden="true">
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/components/effects/NoiseOverlay.tsx
git commit -m "feat(effects): add SVG grain overlay"
```

---

### Task 8: Cinematic Login entrance

**Files:**
- Modify: `src/components/auth/Login.tsx`

- [ ] **Step 1: Read the current Login.tsx**

Confirm imports include `React, useState`, `supabase`, `useWorkspace`, `Loader2, Zap`.

- [ ] **Step 2: Replace the file with the cinematic version**

Full replacement contents:

```typescript
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Loader2, Zap } from 'lucide-react';
import { variants, transitions } from '@/design';
import WebGLBackground from '@/components/effects/WebGLBackground';
import NoiseOverlay from '@/components/effects/NoiseOverlay';

export default function Login() {
  const { setLoginState, setCurrentUserId, setUserRole, setProfile } = useWorkspace();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (mode === 'register') {
        const { data, error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) throw signUpErr;
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id, email, full_name: fullName, role,
          });
          setCurrentUserId(data.user.id);
          setUserRole(role);
          setProfile({ id: data.user.id, email, full_name: fullName, role, created_at: new Date().toISOString() });
          setLoginState('logged_in');
        }
      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
        if (data.user) {
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
          setCurrentUserId(data.user.id);
          if (prof) { setUserRole(prof.role); setProfile(prof); }
          setLoginState('logged_in');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally { setLoading(false); }
  };

  const handleGuest = () => {
    setCurrentUserId('demo-1'); setUserRole('ADMIN'); setLoginState('guest');
    setProfile({ id: 'demo-1', email: 'admin@kinetix.os', full_name: 'Admin Demo', role: 'ADMIN', created_at: new Date().toISOString() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden">
      <WebGLBackground />
      <NoiseOverlay />

      <motion.div
        variants={variants.cinematicReveal}
        initial="hidden"
        animate="visible"
        className="relative z-20 w-[420px] border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md"
      >
        <motion.div
          variants={variants.staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={variants.staggerChild} className="p-8 border-b border-white/10 flex items-center gap-4">
            <div className="w-8 h-8 bg-white flex items-center justify-center">
              <Zap size={16} className="text-black" fill="black" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.3em]">Kinetix OS</div>
              <div className="text-[9px] uppercase tracking-widest opacity-40">Developer Workspace</div>
            </div>
          </motion.div>

          <div className="p-8">
            <motion.div variants={variants.staggerChild} className="flex gap-1 mb-8 border border-white/10 p-1">
              {(['login', 'register'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(''); }}
                  className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${mode === m ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}>
                  {m === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </motion.div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={transitions.fast}
                className="mb-4 p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-mono"
              >
                {error}
              </motion.div>
            )}

            <motion.form variants={variants.staggerChild} onSubmit={handleAuth} className="flex flex-col gap-3">
              {mode === 'register' && (
                <>
                  <input type="text" placeholder="FULL NAME" value={fullName}
                    onChange={e => setFullName(e.target.value)} required
                    className="bg-black border border-white/20 p-3 text-[11px] uppercase tracking-wider text-white outline-none focus:border-white/60 transition-colors" />
                  <select value={role} onChange={e => setRole(e.target.value as any)}
                    className="bg-black border border-white/20 p-3 text-[11px] uppercase tracking-wider text-white outline-none focus:border-white/60">
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </>
              )}
              <input type="email" placeholder="EMAIL ADDRESS" value={email}
                onChange={e => setEmail(e.target.value)} required
                className="bg-black border border-white/20 p-3 text-[11px] uppercase tracking-wider text-white outline-none focus:border-white/60 transition-colors" />
              <input type="password" placeholder="PASSWORD" value={password}
                onChange={e => setPassword(e.target.value)} required minLength={6}
                className="bg-black border border-white/20 p-3 text-[11px] uppercase tracking-wider text-white outline-none focus:border-white/60 transition-colors" />
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={transitions.fast}
                className="mt-2 bg-white text-black py-4 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-white/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                {mode === 'login' ? 'Authenticate' : 'Create Account'}
              </motion.button>
            </motion.form>

            <motion.div variants={variants.staggerChild} className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6">
              <button onClick={handleGuest} className="text-[9px] uppercase tracking-widest font-bold text-yellow-500/50 hover:text-yellow-500 transition-colors">
                Demo Guest Access (Admin View)
              </button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Open `http://localhost:5173` in a private window (so you're logged out).
Expected:
- Background: dark animated noise gradient with subtle blue accent
- Grain overlay: faint, drifting
- Login card: fades up with blur clearing, children stagger in
- Submit button: scales slightly on hover/tap
- Mode toggle still works
- No console errors

- [ ] **Step 5: Commit**

```powershell
git add src/components/auth/Login.tsx
git commit -m "feat(auth): cinematic Login with WebGL background + motion entrance"
```

---

## Phase 3 — Shell & List Animations

### Task 9: View transitions in Shell

**Files:**
- Modify: `src/components/layout/Shell.tsx`

- [ ] **Step 1: Read the current Shell.tsx**

Confirm imports already include `motion, AnimatePresence` from `motion/react`.

- [ ] **Step 2: Replace the imports block**

Replace lines 1-11 (`import React...` through `import { motion, AnimatePresence } from 'motion/react';`) with:

```typescript
import React, { useState } from 'react';
import { FileCode, BarChart3, UserCircle, LogOut, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import Explorer from '../explorer/Explorer';
import EditorPanel from '../editor/EditorPanel';
import ChatPanel from '../chat/ChatPanel';
import Dashboard from '../dashboard/Dashboard';
import Login from '../auth/Login';
import Profile from '../profile/Profile';
import { motion, AnimatePresence } from 'motion/react';
import { variants, transitions } from '@/design';
```

(Note: `Settings` import removed — it was unused.)

- [ ] **Step 3: Replace the activity bar buttons block**

Find the `.map(({ v, icon: Icon, label }) => (` block (around line 34) and replace the entire `<button>` JSX inside it with:

```typescript
          <button key={v} onClick={() => setView(v)} title={label}
            className={cn("p-2.5 transition-all hover:opacity-100 relative",
              view === v ? "text-white opacity-100" : "text-[#858585] opacity-40")}>
            {view === v && (
              <motion.div
                layoutId="activeViewIndicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white"
                transition={transitions.spring}
              />
            )}
            <Icon size={22} strokeWidth={1.5} />
          </button>
```

The only change is wrapping the indicator `<div>` in `<motion.div layoutId="activeViewIndicator" ... transition={transitions.spring}>`. This makes the white indicator slide between activity bar items on view change.

- [ ] **Step 4: Wrap the center panel in AnimatePresence**

Find the block starting `{view === 'editor' ? (` (around line 71) and replace the entire view-switching JSX (lines 71-95) with:

```typescript
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              variants={variants.fadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex-1 flex flex-col min-h-0"
            >
              {view === 'editor' ? (
                <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <EditorPanel />
                  </div>
                  {/* Terminal panel */}
                  <div className="h-44 border-t border-[#3c3c3c] bg-[#1e1e1e] flex flex-col shrink-0">
                    <div className="flex items-center space-x-6 px-4 py-1 border-b border-[#2d2d2d]">
                      {['TERMINAL', 'OUTPUT', 'PROBLEMS', 'DEBUG CONSOLE'].map((tab, i) => (
                        <button key={tab} className={cn("text-[10px] pb-0.5 font-medium tracking-normal",
                          i === 0 ? "text-[#cccccc] border-b border-[#cccccc]" : "text-[#858585] hover:text-[#cccccc]")}>
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] opacity-80 custom-scrollbar whitespace-pre-wrap">
                      <span className="text-[#858585]">$ </span>npm run dev{"\n"}
                      <span className="text-green-400">  VITE v5.0.0  ready in 847 ms{"\n\n"}</span>
                      <span className="text-blue-400">  ➜  Local:   </span>http://localhost:5173/{"\n"}
                      <span className="text-[#858585]">  ➜  Network: use --host to expose{"\n"}</span>
                      <span className="text-[#858585]">  ➜  Role: {userRole}{"\n"}</span>
                    </div>
                  </div>
                </div>
              ) : view === 'dashboard' ? <Dashboard /> : <Profile />}
            </motion.div>
          </AnimatePresence>
```

- [ ] **Step 5: Replace the status bar dot with a pulsing motion div**

Find:

```typescript
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
```

Replace with:

```typescript
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-green-500"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
```

- [ ] **Step 6: Type-check**

Run: `npm run lint`
Expected: No errors. (If `Settings` was used elsewhere in the file, restore that import.)

- [ ] **Step 7: Manual verification**

Run: `npm run dev`. Log in (or use guest).
Expected:
- Activity bar indicator slides between icons with spring physics when switching views
- Center panel fade-ups on view change (editor → dashboard → profile)
- Status bar green dot pulses gently
- Sidebar / chat panel still slide open from existing AnimatePresence (no regression)

- [ ] **Step 8: Commit**

```powershell
git add src/components/layout/Shell.tsx
git commit -m "feat(shell): view transitions + activity bar layoutId + status pulse"
```

---

### Task 10: Animate Explorer task list (FLIP on status change)

**Files:**
- Modify: `src/components/explorer/Explorer.tsx`

- [ ] **Step 1: Read Explorer.tsx end-to-end to locate the task list render**

Open `src/components/explorer/Explorer.tsx` and find the section that renders the filtered `visibleTasks` array (look for `visibleTasks.map(...)`). Copy down (in your scratch notes):
1. The exact `className` string on the wrapping element for each task
2. All event handlers (`onClick`, `onMouseEnter`, etc.) on that wrapping element
3. Any `key` prop value (should be `task.id`)

You will preserve all three when converting to `<motion.div>` in Step 3.

- [ ] **Step 2: Add motion imports at top of file**

Add to imports:

```typescript
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
```

- [ ] **Step 3: Wrap the task list container with `<LayoutGroup>` and convert each task item**

Locate the task list `.map()` block. Wrap the parent `.map()` in `<LayoutGroup>` and `<AnimatePresence>`:

```typescript
<LayoutGroup>
  <AnimatePresence initial={false}>
    {visibleTasks.map(task => (
      <motion.div
        key={task.id}
        layout
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="[EXISTING_CLASSNAME_FROM_ORIGINAL_DIV]"
      >
        {/* existing task item JSX */}
      </motion.div>
    ))}
  </AnimatePresence>
</LayoutGroup>
```

Replace `[EXISTING_CLASSNAME_FROM_ORIGINAL_DIV]` with whatever className was on the original wrapping `<div>` for each task in the current Explorer.tsx. Preserve all event handlers and children unchanged.

- [ ] **Step 4: Type-check**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Use guest mode. Change a task's status (TODO → IN_PROGRESS → DONE).
Expected:
- Task items reorder smoothly when filter/sort changes
- New tasks slide in from the left
- Deleted tasks slide out to the right
- No layout jank, no flicker

- [ ] **Step 6: Commit**

```powershell
git add src/components/explorer/Explorer.tsx
git commit -m "feat(explorer): FLIP animations for task list reorders"
```

---

## Phase 4 — Feedback Primitives

### Task 11: Toast queue + provider (test-first)

**Files:**
- Create: `src/components/ui/ToastProvider.tsx`
- Create: `src/components/ui/Toast.tsx`
- Create: `src/components/ui/Toast.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/ui/Toast.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastProvider';

function Trigger({ message, variant }: { message: string; variant?: 'info' | 'success' | 'error' }) {
  const { push } = useToast();
  return <button onClick={() => push({ message, variant })}>fire</button>;
}

describe('Toast', () => {
  it('renders a toast when push is called', () => {
    render(
      <ToastProvider>
        <Trigger message="Saved" variant="success" />
      </ToastProvider>
    );
    act(() => { screen.getByText('fire').click(); });
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('removes the toast after the duration elapses', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger message="Hello" />
      </ToastProvider>
    );
    act(() => { screen.getByText('fire').click(); });
    expect(screen.getByText('Hello')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4500); });
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('throws when useToast is called outside provider', () => {
    function Orphan() { useToast(); return null; }
    // Suppress console.error noise from React's expected error boundary log
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 3 failing tests (modules not found).

- [ ] **Step 3: Create `src/components/ui/Toast.tsx`**

```typescript
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { transitions } from '@/design';

export type ToastVariant = 'info' | 'success' | 'error';

const ICON = { info: Info, success: CheckCircle2, error: AlertCircle };
const ACCENT = {
  info: 'border-white/20 text-white',
  success: 'border-green-500/40 text-green-400',
  error: 'border-red-500/40 text-red-400',
};

export interface ToastProps {
  id: string;
  message: string;
  variant?: ToastVariant;
  onDismiss: (id: string) => void;
}

export default function Toast({ id, message, variant = 'info', onDismiss }: ToastProps) {
  const Icon = ICON[variant];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={transitions.base}
      className={`flex items-center gap-3 bg-[#0a0a0a] border ${ACCENT[variant]} px-4 py-3 min-w-[280px] max-w-[400px]`}
    >
      <Icon size={14} strokeWidth={2} />
      <span className="flex-1 text-[11px] uppercase tracking-wider font-bold">{message}</span>
      <button onClick={() => onDismiss(id)} className="opacity-40 hover:opacity-100 transition-opacity">
        <X size={12} />
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 4: Create `src/components/ui/ToastProvider.tsx`**

```typescript
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import Toast, { ToastVariant } from './Toast';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  push: (input: { message: string; variant?: ToastVariant; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback<ToastContextValue['push']>(({ message, variant = 'info', durationMs = DEFAULT_DURATION_MS }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, message, variant }]);
    if (durationMs > 0) {
      setTimeout(() => dismiss(id), durationMs);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-2 items-end" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map(t => (
            <Toast key={t.id} id={t.id} message={t.message} variant={t.variant} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: All 3 toast tests pass plus the existing 7 token tests.

- [ ] **Step 6: Type-check**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 7: Commit**

```powershell
git add src/components/ui/Toast.tsx src/components/ui/ToastProvider.tsx src/components/ui/Toast.test.tsx
git commit -m "feat(ui): toast queue with motion enter/exit animations"
```

---

### Task 12: Mount ToastProvider in App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace App.tsx contents**

```typescript
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { ToastProvider } from './components/ui/ToastProvider';
import Shell from './components/layout/Shell';

export default function App() {
  return (
    <WorkspaceProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </WorkspaceProvider>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```powershell
git add src/App.tsx
git commit -m "feat(app): mount ToastProvider above Shell"
```

---

### Task 13: Skeleton primitive

**Files:**
- Create: `src/components/ui/Skeleton.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { motion } from 'motion/react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export default function Skeleton({ width = '100%', height = 12, className = '' }: SkeletonProps) {
  return (
    <motion.div
      style={{ width, height }}
      className={`bg-white/5 ${className}`}
      animate={{ opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```powershell
git add src/components/ui/Skeleton.tsx
git commit -m "feat(ui): add animated Skeleton primitive"
```

---

## Phase 5 — Verification & Documentation

### Task 14: Full-stack verification

**Files:** None — verification only.

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (10+ tests across tokens + toast).

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: 0 TypeScript errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: Build succeeds. Bundle size warning is acceptable (Three.js adds ~150KB gzipped — fine for the use case).

- [ ] **Step 4: Manual verification matrix**

Open `npm run dev` and walk through:

| Scenario | Expected behavior |
|----------|-------------------|
| Logged-out view | WebGL background animates, grain overlay drifts, Login card fades up with stagger |
| Submit button hover/tap | Subtle scale 1.01 / 0.99 with fast transition |
| Guest login | Smooth transition into Shell (no jarring cut) |
| Switch editor → dashboard → profile | Activity bar indicator slides with spring; center panel fade-ups |
| Status bar | Green dot pulses gently |
| Task status change in Explorer | Task list reorders with FLIP; no flicker |
| `useToast().push({ message: 'Test' })` (via temporary button) | Toast slides up from bottom right, auto-dismisses after 4s |
| Console | No errors, no React warnings |

- [ ] **Step 5: Commit any docs/screenshots if produced**

Skip if no artifacts.

---

### Task 15: Update CLAUDE.md to document the new modules

**Files:**
- Modify: `src/CLAUDE.md` (append a new section)

- [ ] **Step 1: Append to `src/CLAUDE.md`**

Add this section at the end of the file (after the "Common Bugs & Fixes" section):

```markdown
---

## Design System (`src/design/`)

All components should consume tokens from `@/design` instead of inlining hex values.

```typescript
import { colors, motion, variants, transitions } from '@/design';
```

- `colors` — typed palette (bg/text/accent/border)
- `typography` — size + tracking scale
- `spacing` — pixel layout constants
- `motion` — durations (seconds) + easing curves
- `variants` — reusable Motion variants (`fadeUp`, `scaleIn`, `cinematicReveal`, `staggerContainer`, `staggerChild`)
- `transitions` — preset Transition objects (`fast`, `base`, `slow`, `cinematic`, `spring`)

## Effects (`src/components/effects/`)

- `WebGLBackground` — Three.js shader noise gradient, used in Login
- `NoiseOverlay` — SVG film grain, layered on top of WebGL bg

## UI Primitives (`src/components/ui/`)

- `<Toast>` + `<ToastProvider>` + `useToast()` hook — push with `{ message, variant, durationMs? }`
- `<Skeleton width height />` — animated loading placeholder

## Testing

- Run: `npm test` (Vitest, jsdom)
- Logic tests live next to source: `tokens.test.ts`, `Toast.test.tsx`
- Visual changes are not unit-tested — verify in browser per the manual matrix in the implementation plan
```

- [ ] **Step 2: Commit**

```powershell
git add src/CLAUDE.md
git commit -m "docs: document design system, effects, and UI primitives modules"
```

---

## Implementation Phases Summary

| Phase | Tasks | Outcome |
|-------|-------|---------|
| **1. Foundations** | 1–5 | Dependencies installed, Vitest configured, tokens + motion primitives module, Tailwind `@theme` sync, grain keyframes |
| **2. Cinematic Login** | 6–8 | WebGL shader background, grain overlay, Login entrance animation |
| **3. Shell Animations** | 9–10 | Activity bar `layoutId` indicator, view transitions, Explorer task list FLIP |
| **4. Feedback Primitives** | 11–13 | Toast queue + provider, Skeleton component |
| **5. Verification** | 14–15 | Full build + manual matrix, CLAUDE.md docs |

**Total tasks:** 15
**Estimated steps:** ~75 bite-sized (2-5 min each)
**Working software at each phase boundary:** Yes — each phase merges cleanly without breaking the app.

---

## Deferred to Future Plans

- **Auth + RBAC plan** — tighten Supabase Auth, RLS audit, profile editing UX
- **Backend AI plan** — multi-model streaming, RAG retrieval optimization
- **DB + deployment plan** — migration tooling, real-time presence, Railway/Vercel CI hardening
- **Phase-2 frontend plan** — Command palette (Cmd+K), chat message streaming, dashboard chart animations, real-time cursors

These deserve their own plans — each produces independently testable software.
