# Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two-phase onboarding: guided first-launch tour (7 steps) + contextual page tips on first visit.

**Architecture:** Custom SVG overlay + Floating UI positioning. `FirstLaunchTour` manages phase 1 as a state machine. `PageTip` is a reusable component for phase 2. Shared primitives: `CoachOverlay` (SVG spotlight), `CoachArrow` (dashed curve with marker), `CoachTooltip` (organic-shaped tooltip). `OnboardingContext` bridges the tour with AppShell's drawer.

**Tech Stack:** React 19, SVG (even-odd fill for cutout), @floating-ui/react-dom (already installed via Radix), CSS transitions, localStorage for state persistence.

**Spec:** `docs/superpowers/specs/2026-03-25-onboarding-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/components/onboarding/svg-utils.ts` | Pure functions: organic path generation, Bézier curve computation |
| `src/components/onboarding/CoachOverlay.tsx` | Full-screen SVG overlay with spotlight cutout + gold glow |
| `src/components/onboarding/CoachArrow.tsx` | Dashed gold SVG arrow with auto-oriented marker |
| `src/components/onboarding/CoachTooltip.tsx` | Organic-shaped tooltip, Floating UI positioning |
| `src/components/onboarding/PageTip.tsx` | Phase 2 wrapper: overlay + arrow + tooltip, localStorage gating |
| `src/components/onboarding/FirstLaunchTour.tsx` | Phase 1 state machine: 7 steps, test asset logic |
| `src/components/onboarding/MockMainPage.tsx` | Static HTML replica of filled main page for step 1 |
| `src/contexts/onboarding-context.tsx` | Context for drawer open/close bridge between tour and AppShell |
| `src/components/layout/app-shell.tsx` | **Modify:** subscribe to OnboardingContext for drawer control |
| `src/App.tsx` | **Modify:** mount OnboardingContext + FirstLaunchTour |
| `src/pages/payments-page.tsx` | **Modify:** add PageTip |
| `src/pages/category-page.tsx` | **Modify:** add PageTip |
| `src/pages/asset-detail-page.tsx` | **Modify:** add PageTip |
| `src/pages/settings-page.tsx` | **Modify:** add reset button |
| `tests/components/onboarding/svg-utils.test.ts` | Tests for pure SVG utility functions |

---

### Task 1: SVG Utility Functions

Pure functions for organic path generation and arrow curves. These have no React dependency — perfect for TDD.

**Files:**
- Create: `src/components/onboarding/svg-utils.ts`
- Test: `tests/components/onboarding/svg-utils.test.ts`

- [ ] **Step 1: Write tests for `buildOrganicSpotlightPath`**

This function takes a DOMRect + viewport size and returns an SVG path string with even-odd fill rule (full viewport rect + organic cutout around the target).

```ts
// tests/components/onboarding/svg-utils.test.ts
import { describe, it, expect } from 'vitest';
import { buildOrganicSpotlightPath, buildArrowCurve } from '@/components/onboarding/svg-utils';

describe('buildOrganicSpotlightPath', () => {
  it('returns SVG path with M command for outer rect and inner cutout', () => {
    const rect = { x: 100, y: 50, width: 200, height: 40 };
    const viewport = { width: 400, height: 800 };
    const path = buildOrganicSpotlightPath(rect, viewport, 10);
    // Outer rect starts at 0,0
    expect(path).toMatch(/^M0,0/);
    // Contains curve commands for organic shape
    expect(path).toContain('C');
    // Closes with Z
    expect(path).toMatch(/Z$/);
  });

  it('adds padding around the target rect', () => {
    const rect = { x: 100, y: 50, width: 200, height: 40 };
    const viewport = { width: 400, height: 800 };
    const path10 = buildOrganicSpotlightPath(rect, viewport, 10);
    const path20 = buildOrganicSpotlightPath(rect, viewport, 20);
    // Different padding = different paths
    expect(path10).not.toEqual(path20);
  });
});

describe('buildArrowCurve', () => {
  it('returns from/to points and a Bézier path', () => {
    const result = buildArrowCurve(
      { x: 150, y: 300 }, // tooltip center
      { x: 150, y: 100 }, // target center
    );
    expect(result.path).toMatch(/^M/);
    expect(result.path).toContain('C');
    expect(result.tipAngle).toBeDefined();
  });

  it('produces different curves for different positions', () => {
    const a = buildArrowCurve({ x: 50, y: 300 }, { x: 300, y: 50 });
    const b = buildArrowCurve({ x: 200, y: 400 }, { x: 100, y: 100 });
    expect(a.path).not.toEqual(b.path);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run tests/components/onboarding/svg-utils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `svg-utils.ts`**

```ts
// src/components/onboarding/svg-utils.ts

interface Rect {
  x: number; y: number; width: number; height: number;
}
interface Point {
  x: number; y: number;
}
interface Viewport {
  width: number; height: number;
}

/**
 * Builds SVG path for dark overlay with organic cutout.
 * Uses even-odd fill rule: outer rect (full viewport) + inner organic blob.
 */
export function buildOrganicSpotlightPath(
  target: Rect,
  viewport: Viewport,
  padding = 10,
): string {
  const { width: vw, height: vh } = viewport;

  // Padded rect
  const x = target.x - padding;
  const y = target.y - padding;
  const w = target.width + padding * 2;
  const h = target.height + padding * 2;

  // Control point offsets for organic feel (subtle wobble)
  const wo = w * 0.04; // wobble amplitude
  const ho = h * 0.06;

  // Outer rect (clockwise)
  const outer = `M0,0 L${vw},0 L${vw},${vh} L0,${vh} Z`;

  // Inner organic blob (counter-clockwise for even-odd cutout)
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;

  // 8-point organic ellipse with cubic bezier wobble
  const inner = [
    `M${cx},${y - ho}`,
    `C${cx + rx * 0.55 + wo},${y - ho} ${x + w + wo},${cy - ry * 0.55 - ho} ${x + w + wo},${cy}`,
    `C${x + w + wo},${cy + ry * 0.55 + ho} ${cx + rx * 0.55 - wo},${y + h + ho} ${cx},${y + h + ho}`,
    `C${cx - rx * 0.55 - wo},${y + h + ho} ${x - wo},${cy + ry * 0.55 - ho} ${x - wo},${cy}`,
    `C${x - wo},${cy - ry * 0.55 + ho} ${cx - rx * 0.55 + wo},${y - ho} ${cx},${y - ho}`,
    'Z',
  ].join(' ');

  return `${outer} ${inner}`;
}

/**
 * Builds Bézier curve path from tooltip to target, returns:
 * - path: SVG path string (M...C...)
 * - tipPoint: endpoint on target side (where arrowhead goes)
 * - tipAngle: angle in degrees at the tip for marker orientation
 */
export function buildArrowCurve(
  from: Point,
  to: Point,
): { path: string; tipPoint: Point; tipAngle: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Shorten the path slightly so marker doesn't overshoot
  const shortenBy = 4;
  const ratio = Math.max(0, (dist - shortenBy) / dist);
  const tipPoint = {
    x: from.x + dx * ratio,
    y: from.y + dy * ratio,
  };

  // Control points: perpendicular offset for organic curve
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const offset = dist * 0.12; // curve amount

  const cp1 = {
    x: mid.x + perpX * offset + dx * -0.15,
    y: mid.y + perpY * offset + dy * -0.15,
  };
  const cp2 = {
    x: mid.x + perpX * offset * 0.5 + dx * 0.15,
    y: mid.y + perpY * offset * 0.5 + dy * 0.15,
  };

  const path = `M${from.x},${from.y} C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${tipPoint.x},${tipPoint.y}`;

  // Tip angle from last control point to tip
  const tipAngle = Math.atan2(tipPoint.y - cp2.y, tipPoint.x - cp2.x) * (180 / Math.PI);

  return { path, tipPoint, tipAngle };
}

/**
 * Builds SVG path for organic tooltip background shape.
 */
export function buildTooltipPath(width: number, height: number): string {
  const w = width;
  const h = height;
  const wo = w * 0.02;
  const ho = h * 0.04;

  return [
    `M${14 + wo},${5 - ho}`,
    `C${28},${2} ${60},${1} ${w * 0.38},${2 + ho}`,
    `C${w * 0.58},${3} ${w * 0.77},${2.5 - ho} ${w * 0.88},${2}`,
    `C${w * 0.95},${1.5} ${w - 2},${4 + ho} ${w - 1},${10}`,
    `C${w},${18} ${w},${h * 0.35} ${w - 1},${h * 0.5}`,
    `C${w - 2},${h * 0.65} ${w - 4},${h * 0.78} ${w - 6},${h * 0.88}`,
    `C${w - 8},${h * 0.95} ${w * 0.94},${h - 1} ${w * 0.88},${h}`,
    `C${w * 0.7},${h + ho} ${w * 0.38},${h + ho} ${w * 0.19},${h - 1}`,
    `C${w * 0.09},${h - 2} ${12},${h * 0.95} ${7},${h * 0.88}`,
    `C${3},${h * 0.78} ${2},${h * 0.63} ${2},${h * 0.48}`,
    `C${2},${h * 0.33} ${3},${h * 0.18} ${5 + wo},${h * 0.1}`,
    `C${8},${5} ${11},${4 + ho} ${14 + wo},${5 - ho}`,
    'Z',
  ].join(' ');
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx vitest run tests/components/onboarding/svg-utils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/svg-utils.ts tests/components/onboarding/svg-utils.test.ts
git commit -m "feat(onboarding): add SVG utility functions for overlay, arrow, tooltip paths"
```

---

### Task 2: CoachOverlay Component

SVG overlay with spotlight cutout and gold glow.

**Files:**
- Create: `src/components/onboarding/CoachOverlay.tsx`

- [ ] **Step 1: Create CoachOverlay**

```tsx
// src/components/onboarding/CoachOverlay.tsx
import { useState, useEffect, useCallback, type RefObject } from 'react';
import { buildOrganicSpotlightPath } from './svg-utils';

interface CoachOverlayProps {
  /** Target element to spotlight. If null, full dark overlay (no cutout). */
  targetRef: RefObject<HTMLElement | null> | null;
  /** Called when user taps anywhere on overlay */
  onClick?: () => void;
  children?: React.ReactNode;
}

export function CoachOverlay({ targetRef, onClick, children }: CoachOverlayProps) {
  const [path, setPath] = useState('');
  const [glowPath, setGlowPath] = useState('');

  const updatePath = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const viewport = { width: vw, height: vh };

    if (!targetRef?.current) {
      // Full dark overlay, no cutout
      setPath(`M0,0 L${vw},0 L${vw},${vh} L0,${vh} Z`);
      setGlowPath('');
      return;
    }

    const rect = targetRef.current.getBoundingClientRect();
    const p = buildOrganicSpotlightPath(rect, viewport, 10);
    setPath(p);

    // Glow border = inner part only (reuse organic path logic)
    const parts = p.split(' Z ');
    if (parts.length > 1) {
      setGlowPath(parts[1]?.replace(/ Z$/, '') ?? '');
    }
  }, [targetRef]);

  useEffect(() => {
    updatePath();

    const observer = targetRef?.current
      ? new ResizeObserver(updatePath)
      : null;
    if (observer && targetRef?.current) observer.observe(targetRef.current);

    window.addEventListener('resize', updatePath);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updatePath);
    };
  }, [updatePath, targetRef]);

  return (
    <div
      className="fixed inset-0 z-[9000]"
      onClick={onClick}
      style={{ touchAction: 'none' }}
    >
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <filter id="hi-coach-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor="#c8b48c" floodOpacity="0.1" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {path && (
          <path
            d={path}
            fill="rgba(0,0,0,0.75)"
            fillRule="evenodd"
            style={{ transition: 'all 300ms ease-in-out' }}
          />
        )}
        {glowPath && (
          <path
            d={glowPath}
            fill="none"
            stroke="rgba(200,180,140,0.2)"
            strokeWidth={1}
            filter="url(#hi-coach-glow)"
            style={{ transition: 'all 300ms ease-in-out' }}
          />
        )}
      </svg>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/CoachOverlay.tsx
git commit -m "feat(onboarding): add CoachOverlay with SVG spotlight cutout"
```

---

### Task 3: CoachArrow Component

Dashed gold SVG arrow with animated body and static marker-end tip.

**Files:**
- Create: `src/components/onboarding/CoachArrow.tsx`

- [ ] **Step 1: Create CoachArrow**

```tsx
// src/components/onboarding/CoachArrow.tsx
import { buildArrowCurve } from './svg-utils';

interface CoachArrowProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export function CoachArrow({ from, to }: CoachArrowProps) {
  const { path, tipPoint } = buildArrowCurve(from, to);

  // Split: animated body (all but last ~20px) + static tip with marker
  // For simplicity, draw full path dashed + short solid segment at end
  const dx = tipPoint.x - from.x;
  const dy = tipPoint.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const tipLen = Math.min(20, dist * 0.15);
  const tipRatio = tipLen / dist;
  const tipStart = {
    x: tipPoint.x - dx * tipRatio,
    y: tipPoint.y - dy * tipRatio,
  };

  const markerId = `hi-arrow-${Math.round(from.x)}-${Math.round(from.y)}`;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 9001 }}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 12 10"
          refX="11"
          refY="5"
          markerWidth="10"
          markerHeight="8"
          orient="auto"
        >
          <line x1="0" y1="1" x2="11" y2="5" stroke="#c8b48c" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
          <line x1="0" y1="9" x2="11" y2="5" stroke="#c8b48c" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        </marker>
      </defs>

      {/* Animated dashed body */}
      <path
        d={path}
        fill="none"
        stroke="#c8b48c"
        strokeWidth={1.8}
        strokeDasharray="8,5"
        strokeLinecap="round"
        opacity={0.6}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="26"
          to="0"
          dur="2s"
          repeatCount="indefinite"
        />
      </path>

      {/* Static tip segment with marker-end */}
      <path
        d={`M${tipStart.x},${tipStart.y} L${tipPoint.x},${tipPoint.y}`}
        fill="none"
        stroke="#c8b48c"
        strokeWidth={1.8}
        strokeLinecap="round"
        opacity={0.6}
        markerEnd={`url(#${markerId})`}
      />
    </svg>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/CoachArrow.tsx
git commit -m "feat(onboarding): add CoachArrow with animated dashes and auto-oriented marker"
```

---

### Task 4: CoachTooltip Component

Organic-shaped tooltip positioned via Floating UI.

**Files:**
- Create: `src/components/onboarding/CoachTooltip.tsx`

- [ ] **Step 1: Check Floating UI API availability**

Run: `node -e "const m = require('@floating-ui/react-dom'); console.log(Object.keys(m).filter(k => ['computePosition','offset','flip','shift','autoUpdate'].includes(k)))"`
Expected: List should include `computePosition`, `offset`, `flip`, `shift`, `autoUpdate`
If missing: `npm install @floating-ui/react-dom` (should already be there)

- [ ] **Step 2: Create CoachTooltip**

```tsx
// src/components/onboarding/CoachTooltip.tsx
import { useState, useEffect, type RefObject } from 'react';
import { computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/react-dom';
import { buildTooltipPath } from './svg-utils';

interface CoachTooltipProps {
  targetRef: RefObject<HTMLElement | null> | null;
  text: string;
  subtext?: string;
  stepIndex?: number;
  totalSteps?: number;
}

export function CoachTooltip({ targetRef, text, subtext, stepIndex, totalSteps }: CoachTooltipProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [tooltipEl, setTooltipEl] = useState<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ width: 268, height: 80 });

  useEffect(() => {
    if (!targetRef?.current || !tooltipEl) {
      // Center on screen if no target
      setPos({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      return;
    }

    const cleanup = autoUpdate(targetRef.current, tooltipEl, () => {
      computePosition(targetRef.current!, tooltipEl, {
        placement: 'bottom',
        middleware: [offset(24), flip(), shift({ padding: 16 })],
      }).then(({ x, y }) => setPos({ x, y }));
    });

    return cleanup;
  }, [targetRef, tooltipEl]);

  useEffect(() => {
    if (tooltipEl) {
      setDims({
        width: tooltipEl.offsetWidth,
        height: tooltipEl.offsetHeight,
      });
    }
  }, [tooltipEl, text]);

  const bgPath = buildTooltipPath(dims.width, dims.height);

  return (
    <div
      ref={setTooltipEl}
      className="fixed z-[9002] w-[268px] pointer-events-none"
      style={{
        left: targetRef?.current ? pos.x : '50%',
        top: targetRef?.current ? pos.y : pos.y,
        transform: targetRef?.current ? undefined : 'translateX(-50%)',
        animation: 'hi-fade-scale-in 200ms ease-out',
      }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        preserveAspectRatio="none"
      >
        <path
          d={bgPath}
          fill="var(--hi-stone)"
          stroke="rgba(200,180,140,0.18)"
          strokeWidth={1}
        />
      </svg>
      <div className="relative z-10 p-3 px-5">
        <div className="text-[var(--hi-text)] font-sans text-[length:var(--hi-text-body)] leading-relaxed">
          {text}
        </div>
        {subtext && (
          <div className="text-[var(--hi-ash)] font-sans text-[length:var(--hi-text-caption)] mt-1 italic">
            {subtext}
          </div>
        )}
        {stepIndex != null && totalSteps != null && (
          <div className="mt-2 text-[var(--hi-muted)] font-mono text-[length:var(--hi-text-micro)]">
            {stepIndex} / {totalSteps}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/CoachTooltip.tsx
git commit -m "feat(onboarding): add CoachTooltip with organic SVG background and Floating UI"
```

---

### Task 5: OnboardingContext

Context to bridge FirstLaunchTour with AppShell's drawer open/close state.

**Files:**
- Create: `src/contexts/onboarding-context.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create OnboardingContext**

```tsx
// src/contexts/onboarding-context.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface OnboardingContextValue {
  /** Whether the first-launch tour is currently active */
  tourActive: boolean;
  setTourActive: (active: boolean) => void;
  /** Request to open/close the drawer from the tour */
  drawerRequested: boolean;
  requestDrawerOpen: () => void;
  requestDrawerClose: () => void;
  /** Refs to menu elements for spotlight targeting */
  menuButtonRef: React.RefObject<HTMLElement | null> | null;
  setMenuButtonRef: (ref: React.RefObject<HTMLElement | null>) => void;
  dataMenuItemRef: React.RefObject<HTMLElement | null> | null;
  setDataMenuItemRef: (ref: React.RefObject<HTMLElement | null>) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [tourActive, setTourActive] = useState(false);
  const [drawerRequested, setDrawerRequested] = useState(false);
  const [menuButtonRef, setMenuButtonRef] = useState<React.RefObject<HTMLElement | null> | null>(null);
  const [dataMenuItemRef, setDataMenuItemRef] = useState<React.RefObject<HTMLElement | null> | null>(null);

  const requestDrawerOpen = useCallback(() => setDrawerRequested(true), []);
  const requestDrawerClose = useCallback(() => setDrawerRequested(false), []);

  return (
    <OnboardingContext.Provider
      value={{
        tourActive, setTourActive,
        drawerRequested, requestDrawerOpen, requestDrawerClose,
        menuButtonRef, setMenuButtonRef,
        dataMenuItemRef, setDataMenuItemRef,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be within OnboardingProvider');
  return ctx;
}
```

- [ ] **Step 2: Wire into App.tsx**

In `src/App.tsx`, wrap content with `OnboardingProvider` (inside BrowserRouter, outside SyncProvider):

```tsx
import { OnboardingProvider } from '@/contexts/onboarding-context';

// Inside BrowserRouter:
<OnboardingProvider>
  <SyncProvider>
    <Routes>...</Routes>
  </SyncProvider>
</OnboardingProvider>
```

- [ ] **Step 3: Wire AppShell to OnboardingContext**

In `src/components/layout/app-shell.tsx`:
- Import `useOnboarding`
- Sync `drawerRequested` to Sheet open state
- Register `menuButtonRef` via `useRef` + `setMenuButtonRef`
- The ☰ button gets a ref that is registered in context

Refer to existing code structure: AppShell manages `drawerOpen` state via `useState`. Add an effect that syncs `drawerRequested`:

```tsx
const onboarding = useOnboarding();

useEffect(() => {
  if (onboarding.tourActive) {
    setDrawerOpen(onboarding.drawerRequested);
  }
}, [onboarding.drawerRequested, onboarding.tourActive]);

// Register menu button ref
const menuBtnRef = useRef<HTMLButtonElement>(null);
useEffect(() => {
  onboarding.setMenuButtonRef(menuBtnRef);
}, []);
```

Also in `DrawerMenu`: register `dataMenuItemRef` on the «Данные» TransitionLink.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/contexts/onboarding-context.tsx src/App.tsx src/components/layout/app-shell.tsx src/components/layout/drawer-menu.tsx
git commit -m "feat(onboarding): add OnboardingContext and wire to AppShell drawer"
```

---

### Task 6: MockMainPage Component

Static HTML replica of the main page with example data, shown on step 1.

**Files:**
- Create: `src/components/onboarding/MockMainPage.tsx`

- [ ] **Step 1: Create MockMainPage**

Build a static React component that visually replicates the main page. Must use the exact same CSS variables, fonts, and layout structure as the real `MainPage`. Content is hardcoded:
- Income: 42 380 ₽
- Yield: 8.2% · Portfolio: 516 400 ₽
- Categories: Акции (3, 31 200 ₽), Облигации (5, 11 180 ₽)

Reference `src/pages/main-page.tsx` and `src/components/income/hero-income.tsx` for exact class names and structure.

**Important:** This is a pixel-perfect copy. Read the real components and replicate their HTML/CSS exactly, with hardcoded data instead of hooks.

- [ ] **Step 2: Visual verification**

Start dev server (`npm run dev`), temporarily render `<MockMainPage />` on screen, take a screenshot, compare with real main page filled with data. They must match.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/MockMainPage.tsx
git commit -m "feat(onboarding): add MockMainPage static replica for tour step 1"
```

---

### Task 7: FirstLaunchTour — Steps 1-2 (Mockup + Empty State)

The main phase 1 component. Start with steps 1-2 (simpler, no real UI interaction).

**Files:**
- Create: `src/components/onboarding/FirstLaunchTour.tsx`
- Modify: `src/App.tsx` (mount)

- [ ] **Step 1: Create FirstLaunchTour with steps 1-2**

State machine: `step` state (0 = inactive, 1-7 = active steps).
On mount: check `localStorage.getItem('hi-onboarding-done')` — if set, don't render.
Renders as portal to `document.body`.

Step 1: `<MockMainPage />` with dark overlay + centered text.
Step 2: Overlay fades out mockup, shows centered tooltip over real (empty) app.

Include:
- «Пропустить» button on every step
- «нажмите для продолжения» footer text
- Step counter (N / 7)

- [ ] **Step 2: Mount in App.tsx**

After `</Routes>`, add `<FirstLaunchTour />` inside SyncProvider.

- [ ] **Step 3: Visual verification**

Clear `localStorage` (`hi-onboarding-done`, `hi-splash-seen`), reload app. Verify:
1. Splash plays, then step 1 shows mockup with overlay text
2. Tap → step 2 shows empty state with tooltip
3. «Пропустить» works

Take screenshots.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/FirstLaunchTour.tsx src/App.tsx
git commit -m "feat(onboarding): add FirstLaunchTour steps 1-2 (mockup + empty state)"
```

---

### Task 8: FirstLaunchTour — Steps 3-5 (Menu → Data Page)

Interactive steps: spotlight on ☰, spotlight on «Данные» in drawer, tooltip on /data.

**Files:**
- Modify: `src/components/onboarding/FirstLaunchTour.tsx`

- [ ] **Step 1: Implement steps 3-5**

Step 3: `CoachOverlay` with `targetRef` = menu button ref from OnboardingContext. `CoachArrow` from tooltip to ☰. `CoachTooltip` with «Нажмите для доступа к меню». On click on ☰ area → `requestDrawerOpen()` + advance to step 4.

Step 4: `CoachOverlay` with `targetRef` = data menu item ref from OnboardingContext. `CoachArrow` from tooltip to «Данные». On click on «Данные» → `requestDrawerClose()` + `navigate('/data')` + advance to step 5.

Step 5: On /data page, `CoachTooltip` centered with text about import/manual entry. Tap anywhere → advance to step 6.

Listen to route changes (`useLocation`): if route doesn't match expected for current step, abort tour.

- [ ] **Step 2: Visual verification**

Clear localStorage, reload. Walk through steps 1-5:
- Step 3: spotlight on ☰, arrow, tap ☰ opens drawer
- Step 4: spotlight on «Данные», tap navigates to /data
- Step 5: tooltip on data page

Take screenshots at each step.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/FirstLaunchTour.tsx
git commit -m "feat(onboarding): add steps 3-5 (menu spotlight → data page)"
```

---

### Task 9: FirstLaunchTour — Steps 6-7 (Test Asset)

Add and remove test asset.

**Files:**
- Modify: `src/components/onboarding/FirstLaunchTour.tsx`

- [ ] **Step 1: Implement steps 6-7**

Step 6: Card overlay with «Добавим 1000 акций Мосбиржи (MOEX)?» and «Добавить» button.
On click:
```ts
import { addAsset } from '@/hooks/use-assets';
import { addHolding } from '@/hooks/use-holdings';
import { addAccount } from '@/hooks/use-accounts';
import { db } from '@/db/database';

// Check for existing accounts
const accounts = await db.accounts.toArray();
const accountId = accounts.length > 0
  ? accounts[0].id!
  : await addAccount('Мой счёт');

const assetId = await addAsset({
  name: 'Мосбиржа',
  ticker: 'MOEX',
  type: 'Акции',
  dataSource: 'manual',
  paymentPerUnitSource: 'fact',
  frequencyPerYear: 1,
  frequencySource: 'manual',
});

await addHolding({
  accountId,
  assetId,
  quantity: 1000,
  quantitySource: 'manual',
});

// Trigger MOEX sync (fire and forget)
syncAsset(assetId);
```
Store `assetId` and `accountId` (if newly created) in component state for cleanup.
Navigate to `/`, wait 2 seconds, advance to step 7.

Step 7: Card overlay with calculated income visible behind it. Text: «Вот как выглядит расчёт дохода...» + «Удалить и начать» button. If sync failed (income = 0), add subtext: «Данные с биржи загрузятся позже».

On click «Удалить и начать»:
```ts
await deleteAsset(assetId);
// Delete account if we created it and it's now empty
if (createdAccount) {
  const remainingHoldings = await db.holdings.where('accountId').equals(accountId).count();
  if (remainingHoldings === 0) await deleteAccount(accountId);
}
localStorage.setItem('hi-onboarding-done', '1');
```

Skip logic: if `hi-onboarding-done` was reset but DB has assets → skip steps 6-7, go straight to done after step 5.

- [ ] **Step 2: Visual verification**

Full tour walkthrough. Verify:
- Step 6 adds asset correctly (check via dev tools → IndexedDB)
- Main page shows income after sync
- Step 7 deletes asset cleanly
- App returns to empty state

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/FirstLaunchTour.tsx
git commit -m "feat(onboarding): add steps 6-7 (test asset add/remove)"
```

---

### Task 10: PageTip Component + Phase 2 Integration

Reusable component for contextual tips + add to 3 pages.

**Files:**
- Create: `src/components/onboarding/PageTip.tsx`
- Modify: `src/pages/payments-page.tsx`
- Modify: `src/pages/category-page.tsx`
- Modify: `src/pages/asset-detail-page.tsx`

- [ ] **Step 1: Create PageTip**

```tsx
// src/components/onboarding/PageTip.tsx
import { useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CoachOverlay } from './CoachOverlay';
import { CoachArrow } from './CoachArrow';
import { CoachTooltip } from './CoachTooltip';

interface PageTipProps {
  storageKey: string;
  targetRef: RefObject<HTMLElement | null>;
  text: string;
}

export function PageTip({ storageKey, targetRef, text }: PageTipProps) {
  const [dismissed, setDismissed] = useState(() =>
    !!localStorage.getItem(storageKey) || !localStorage.getItem('hi-onboarding-done')
  );

  if (dismissed || !targetRef.current) return null;

  const handleDismiss = () => {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  const targetRect = targetRef.current.getBoundingClientRect();
  const targetCenter = {
    x: targetRect.x + targetRect.width / 2,
    y: targetRect.y + targetRect.height / 2,
  };
  // Tooltip is below target, arrow points up
  const tooltipCenter = {
    x: targetCenter.x,
    y: targetRect.bottom + 60,
  };

  return createPortal(
    <CoachOverlay targetRef={targetRef} onClick={handleDismiss}>
      <CoachArrow from={tooltipCenter} to={targetCenter} />
      <CoachTooltip targetRef={targetRef} text={text} />
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9002]">
        <span className="text-[var(--hi-ash)] font-mono text-[length:var(--hi-text-micro)] tracking-wider">
          нажмите для продолжения
        </span>
      </div>
    </CoachOverlay>,
    document.body,
  );
}
```

- [ ] **Step 2: Add PageTip to PaymentsPage**

In `src/pages/payments-page.tsx`:
- Add `useRef` for the payment list container
- Render `<PageTip storageKey="hi-tip-payments" targetRef={listRef} text="История выплат. Для биржевых активов подтягивается с MOEX, но можно добавить и вручную" />`

- [ ] **Step 3: Add PageTip to CategoryPage**

In `src/pages/category-page.tsx`:
- Add `useRef` for the first asset row
- Render `<PageTip storageKey="hi-tip-category" targetRef={firstRowRef} text="Доход и доходность — по каждому активу отдельно. Нажмите для подробностей" />`

- [ ] **Step 4: Add PageTip to AssetDetailPage**

In `src/pages/asset-detail-page.tsx`:
- Add `useRef` for the «Выплата на шт. / год» field
- Render `<PageTip storageKey="hi-tip-asset" targetRef={incomeFieldRef} text="Для биржевых активов годовой доход рассчитан по последним выплатам. Но можно указать и вручную — полезно если знаете точнее" />`

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 6: Visual verification**

Navigate to each page with tips cleared from localStorage. Verify:
- Tip shows with overlay + arrow + tooltip
- Tap dismisses and sets localStorage key
- Tip doesn't show on second visit
- Tip doesn't show if `hi-onboarding-done` is not set

- [ ] **Step 7: Commit**

```bash
git add src/components/onboarding/PageTip.tsx src/pages/payments-page.tsx src/pages/category-page.tsx src/pages/asset-detail-page.tsx
git commit -m "feat(onboarding): add PageTip component and integrate on 3 pages"
```

---

### Task 11: Settings Reset Button

Add «Сбросить подсказки» to settings page.

**Files:**
- Modify: `src/pages/settings-page.tsx`

- [ ] **Step 1: Add reset button**

In the settings page, before the «Опасная зона» section, add a new section:

```tsx
<div className="mt-6">
  <h3 className="text-[length:var(--hi-text-caption)] uppercase tracking-[0.3em] text-[var(--hi-shadow)] font-mono mb-3">
    Онбординг
  </h3>
  <Button
    variant="outline"
    onClick={() => {
      localStorage.removeItem('hi-onboarding-done');
      localStorage.removeItem('hi-tip-payments');
      localStorage.removeItem('hi-tip-category');
      localStorage.removeItem('hi-tip-asset');
      setStatus('Подсказки сброшены');
    }}
  >
    Сбросить подсказки
  </Button>
</div>
```

- [ ] **Step 2: Visual verification**

Open settings, click reset, verify localStorage is cleared. Navigate to home — onboarding should start (but skip test asset steps if assets exist).

- [ ] **Step 3: Commit**

```bash
git add src/pages/settings-page.tsx
git commit -m "feat(onboarding): add reset onboarding button to settings"
```

---

### Task 12: Full Integration Test + Visual Polish

End-to-end walkthrough and visual tweaks.

**Files:**
- Potentially any onboarding file for adjustments

- [ ] **Step 1: Full clean walkthrough**

Clear all localStorage. Reload app. Walk through complete flow:
1. Splash → Step 1 (mockup) → Step 2 (empty) → Step 3 (☰) → Step 4 (Данные) → Step 5 (/data) → Step 6 (add MOEX) → Step 7 (delete) → done
2. Visit /payments → tip shows → dismiss
3. Visit /category/Акции → tip shows (if assets exist) → dismiss
4. Visit /asset/:id → tip shows (if asset exists) → dismiss
5. Settings → reset → tour restarts without step 6-7

Take screenshots at each step.

- [ ] **Step 2: Fix any visual issues**

Check:
- Arrow orientation on all steps (marker orient="auto" should handle it)
- Tooltip positioning (no overlap with target)
- Organic shapes look correct (not clipped, not distorted)
- Animations smooth (fade, transition between steps)
- Safe-area insets respected on iOS
- «Пропустить» visible but not intrusive

- [ ] **Step 3: Test edge cases**

- Browser back during step 4 → tour should abort cleanly
- Resize during spotlight → should update position
- Slow network during sync → step 7 shows fallback text

- [ ] **Step 4: Run full test suite**

Run: `npm run test`
Expected: All existing tests pass, new svg-utils tests pass

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(onboarding): visual polish and integration fixes"
```
