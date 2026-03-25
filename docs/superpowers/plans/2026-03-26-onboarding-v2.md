# Onboarding v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two-phase onboarding: guided first-launch tour (7 steps) + contextual page tips on first visit. CSS flashlight spotlight, no arrows.

**Architecture:** CSS `radial-gradient` overlay for spotlight effect. `FirstLaunchTour` manages phase 1 as a state machine. `PageTip` is reusable for phase 2. `CoachTooltip` uses Floating UI + organic SVG shape. `OnboardingContext` bridges tour with AppShell drawer.

**Tech Stack:** React 19, CSS radial-gradient, @floating-ui/react-dom (already installed via Radix), Dexie, localStorage.

**Spec:** `docs/superpowers/specs/2026-03-26-onboarding-design-v2.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/components/onboarding/CoachOverlay.tsx` | CSS div with radial-gradient flashlight spotlight |
| `src/components/onboarding/CoachTooltip.tsx` | Organic-shaped tooltip with Floating UI positioning |
| `src/components/onboarding/MockMainPage.tsx` | Static HTML replica of filled main page for step 1 |
| `src/components/onboarding/FirstLaunchTour.tsx` | Phase 1 state machine: 7 steps, test asset logic |
| `src/components/onboarding/PageTip.tsx` | Phase 2 wrapper: overlay + tooltip, localStorage gating |
| `src/contexts/onboarding-context.tsx` | Context for drawer control + onboarding active state |
| `src/components/layout/app-shell.tsx` | **Modify:** subscribe to OnboardingContext for drawer control |
| `src/components/layout/drawer-menu.tsx` | **Modify:** add `data-onboarding="menu-data"` to "Данные" link |
| `src/App.tsx` | **Modify:** mount OnboardingContext + FirstLaunchTour |
| `src/pages/payments-page.tsx` | **Modify:** add PageTip |
| `src/pages/category-page.tsx` | **Modify:** add PageTip |
| `src/pages/asset-detail-page.tsx` | **Modify:** add PageTip |
| `src/pages/settings-page.tsx` | **Modify:** add reset button |

---

### Task 1: OnboardingContext

Context that bridges the tour with AppShell's drawer. Provides `drawerOpen`/`setDrawerOpen` when onboarding is active.

**Files:**
- Create: `src/contexts/onboarding-context.tsx`

- [ ] **Step 1: Create OnboardingContext**

```tsx
// src/contexts/onboarding-context.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface OnboardingContextValue {
  /** Whether onboarding tour is currently active */
  active: boolean;
  setActive: (v: boolean) => void;
  /** Drawer state controlled by onboarding tour */
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <OnboardingContext.Provider value={{ active, setActive, drawerOpen, setDrawerOpen }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/contexts/onboarding-context.tsx
git commit -m "feat(onboarding): add OnboardingContext for drawer bridge"
```

---

### Task 2: CoachOverlay (Flashlight Spotlight)

CSS div with `radial-gradient` — two layers: shadow + warm light. No SVG, no borders.

**Files:**
- Create: `src/components/onboarding/CoachOverlay.tsx`

- [ ] **Step 1: Create CoachOverlay**

```tsx
// src/components/onboarding/CoachOverlay.tsx
interface CoachOverlayProps {
  /** Target element rect for spotlight center. If null — uniform dark overlay. */
  targetRect: DOMRect | null;
  /** Padding around target in px */
  padding?: number;
  /** Whether clicks pass through to elements behind */
  passThrough?: boolean;
  /** Called when user taps overlay (only when passThrough=false) */
  onClick?: () => void;
  children?: React.ReactNode;
}

export function CoachOverlay({
  targetRect,
  padding = 20,
  passThrough = false,
  onClick,
  children,
}: CoachOverlayProps) {
  // Center and radii of the spotlight ellipse
  const cx = targetRect ? targetRect.x + targetRect.width / 2 : -9999;
  const cy = targetRect ? targetRect.y + targetRect.height / 2 : -9999;
  const rx = targetRect ? targetRect.width / 2 + padding : 0;
  const ry = targetRect ? targetRect.height / 2 + padding : 0;

  const shadowGradient = targetRect
    ? `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, transparent 0%, transparent 20%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.82) 80%, rgba(0,0,0,0.88) 100%)`
    : 'rgba(0,0,0,0.82)';

  const warmGradient = targetRect
    ? `radial-gradient(ellipse ${rx * 0.75}px ${ry * 0.75}px at ${cx}px ${cy}px, rgba(255,248,230,0.07) 0%, rgba(255,240,210,0.03) 40%, transparent 65%)`
    : 'none';

  return (
    <div
      className="fixed inset-0 z-[9000]"
      style={{
        pointerEvents: passThrough ? 'none' : 'auto',
        touchAction: 'manipulation',
      }}
      onClick={passThrough ? undefined : onClick}
    >
      {/* Shadow layer */}
      <div
        className="absolute inset-0 transition-all duration-300 ease-in-out"
        style={{ background: shadowGradient, pointerEvents: 'none' }}
      />
      {/* Warm light layer */}
      {targetRect && (
        <div
          className="absolute inset-0 transition-all duration-300 ease-in-out"
          style={{ background: warmGradient, pointerEvents: 'none' }}
        />
      )}
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
git commit -m "feat(onboarding): add CoachOverlay with CSS radial-gradient flashlight"
```

---

### Task 3: CoachTooltip

Organic-shaped SVG background + Floating UI positioning. Shows text + step counter.

**Files:**
- Create: `src/components/onboarding/CoachTooltip.tsx`

- [ ] **Step 1: Create CoachTooltip**

```tsx
// src/components/onboarding/CoachTooltip.tsx
import { useRef, useEffect, useState, type RefObject } from 'react';
import { useFloating, offset, flip, shift } from '@floating-ui/react-dom';

interface CoachTooltipProps {
  /** Target element for positioning. If null — centered on screen. */
  targetRef: RefObject<HTMLElement | null> | null;
  text: string;
  /** Optional secondary line (smaller text) */
  subtitle?: string;
  stepIndex?: number;
  totalSteps?: number;
}

/** SVG path for organic tooltip background with subtle wobble */
function buildTooltipPath(w: number, h: number): string {
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

export function CoachTooltip({
  targetRef,
  text,
  subtitle,
  stepIndex,
  totalSteps,
}: CoachTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 280, height: 80 });

  // Floating UI positioning (only when target exists)
  const { floatingStyles, refs } = useFloating({
    placement: 'bottom',
    middleware: [offset(16), flip(), shift({ padding: 16 })],
    elements: {
      reference: targetRef?.current,
    },
  });

  // Measure tooltip size for SVG background
  useEffect(() => {
    if (tooltipRef.current) {
      const { width, height } = tooltipRef.current.getBoundingClientRect();
      setSize({ width: Math.ceil(width), height: Math.ceil(height) });
    }
  }, [text, subtitle]);

  const positioned = targetRef?.current != null;

  const tooltipContent = (
    <div
      ref={(el) => {
        (tooltipRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        refs.setFloating(el);
      }}
      className="animate-[hi-fade-scale-in_0.2s_ease-out_both]"
      style={{
        ...(positioned ? floatingStyles : {}),
        position: positioned ? 'fixed' : 'fixed',
        ...(positioned
          ? {}
          : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
        zIndex: 9002,
        width: 280,
        pointerEvents: 'none',
      }}
    >
      {/* Organic SVG background */}
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="absolute inset-0"
        style={{ overflow: 'visible' }}
      >
        <path
          d={buildTooltipPath(size.width, size.height)}
          fill="var(--hi-stone)"
          stroke="rgba(200,180,140,0.18)"
          strokeWidth={1}
        />
      </svg>

      {/* Text content */}
      <div className="relative p-4">
        <div
          className="text-[var(--hi-text)] font-sans leading-relaxed"
          style={{ fontSize: 'var(--hi-text-body)' }}
        >
          {text}
        </div>
        {subtitle && (
          <div
            className="mt-1 text-[var(--hi-muted)] italic"
            style={{ fontSize: 'var(--hi-text-caption)' }}
          >
            {subtitle}
          </div>
        )}
        {stepIndex != null && totalSteps != null && (
          <div
            className="mt-2 font-mono text-[var(--hi-muted)]"
            style={{ fontSize: 'var(--hi-text-micro)' }}
          >
            {stepIndex} / {totalSteps}
          </div>
        )}
      </div>
    </div>
  );

  return tooltipContent;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/CoachTooltip.tsx
git commit -m "feat(onboarding): add CoachTooltip with organic SVG shape + Floating UI"
```

---

### Task 4: MockMainPage

Static replica of the main page with sample data for step 1. React component mirroring HeroIncome + category cards.

**Files:**
- Create: `src/components/onboarding/MockMainPage.tsx`

- [ ] **Step 1: Create MockMainPage**

Replicate the structure from `src/pages/main-page.tsx` and `src/components/income/hero-income.tsx`, but with hardcoded data. Must visually match the real main page.

Read `src/components/income/hero-income.tsx` and `src/components/income/category-card.tsx` for exact class names and layout. Use the same Tailwind classes and CSS variables.

Content:
- Header: ☰ (left), "Мой доход" title (center), ⟳ (right)
- HeroIncome: `42 380 ₽`, `8.2% · 516 400 ₽`, МЕС/ГОД toggle
- Categories: Акции (3, 31 200 ₽), Облигации (5, 11 180 ₽)

```tsx
// src/components/onboarding/MockMainPage.tsx
// Static replica — read hero-income.tsx and category-card.tsx for exact classes
export function MockMainPage() {
  // ... replicate exact UI with hardcoded data
  // No interactivity, no hooks, pure presentational
}
```

**Important:** Read the real components before writing this. Match class names exactly.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/MockMainPage.tsx
git commit -m "feat(onboarding): add MockMainPage with sample data for step 1"
```

---

### Task 5: FirstLaunchTour (State Machine)

The core component. State machine managing 7 steps, test asset creation/deletion, drawer control.

**Files:**
- Create: `src/components/onboarding/FirstLaunchTour.tsx`

**Dependencies:** CoachOverlay, CoachTooltip, MockMainPage, OnboardingContext

- [ ] **Step 1: Create FirstLaunchTour**

```tsx
// src/components/onboarding/FirstLaunchTour.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { addAsset, deleteAsset } from '@/hooks/use-assets';
import { syncSingleAsset } from '@/services/moex-sync';
import { withViewTransition } from '@/lib/view-transition';
import { useOnboarding } from '@/contexts/onboarding-context';
import { CoachOverlay } from './CoachOverlay';
import { CoachTooltip } from './CoachTooltip';
import { MockMainPage } from './MockMainPage';

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function FirstLaunchTour() {
  const [step, setStep] = useState<Step>(0);
  const { setActive, setDrawerOpen } = useOnboarding();
  const navigate = useNavigate();
  const location = useLocation();

  // Refs to real DOM elements for spotlight targeting
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Test asset tracking
  const testAssetIdRef = useRef<number | null>(null);
  const testAccountIdRef = useRef<number | null>(null);
  const syncSucceededRef = useRef(true);

  // Check if DB has real assets (for re-trigger: skip steps 6-7)
  const assetCount = useLiveQuery(() => db.assets.count()) ?? 0;
  const skipTestAssetSteps = assetCount > 0;

  useEffect(() => {
    if (localStorage.getItem('hi-onboarding-done')) return;
    // Wait for splash to finish
    const timer = setTimeout(() => setStep(1), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Register as active onboarding
  useEffect(() => {
    setActive(step > 0 && step < 8);
  }, [step, setActive]);

  // Route guard: if user navigates away unexpectedly, end tour
  useEffect(() => {
    if (step === 0) return;
    const expectedRoutes: Record<number, string> = {
      1: '/', 2: '/', 3: '/', 4: '/', 5: '/data', 6: '/data', 7: '/',
    };
    const expected = expectedRoutes[step];
    if (expected && !location.pathname.startsWith(expected)) {
      endTour();
    }
  }, [location.pathname, step]);

  const endTour = useCallback(async () => {
    // Cleanup test asset if created
    if (testAssetIdRef.current) {
      try { await deleteAsset(testAssetIdRef.current); } catch {}
    }
    // Cleanup test account if created and empty
    if (testAccountIdRef.current) {
      const holdingsCount = await db.holdings
        .where('accountId').equals(testAccountIdRef.current).count();
      if (holdingsCount === 0) {
        await db.accounts.delete(testAccountIdRef.current);
      }
    }
    setDrawerOpen(false);
    localStorage.setItem('hi-onboarding-done', '1');
    setStep(0);
    if (location.pathname !== '/') {
      withViewTransition(() => navigate('/'));
    }
  }, [location.pathname, navigate, setDrawerOpen]);

  // Step handlers
  const handleStep1Tap = () => setStep(2);
  const handleStep2Tap = () => setStep(3);

  const handleStep3 = useCallback(() => {
    // Find hamburger button in DOM
    const btn = document.querySelector('[data-onboarding="hamburger"]');
    if (btn) setTargetRect(btn.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (step === 3) handleStep3();
  }, [step, handleStep3]);

  // Step 3: user clicks hamburger → open drawer → step 4
  const handleHamburgerClick = useCallback(() => {
    setDrawerOpen(true);
    // Wait for drawer animation, then find "Данные" item
    setTimeout(() => {
      const dataItem = document.querySelector('[data-onboarding="menu-data"]');
      if (dataItem) setTargetRect(dataItem.getBoundingClientRect());
      setStep(4);
    }, 350);
  }, [setDrawerOpen]);

  // Step 4: user clicks "Данные" → close drawer → navigate → step 5
  const handleDataClick = useCallback(() => {
    setDrawerOpen(false);
    setTargetRect(null);
    withViewTransition(() => navigate('/data'));
    setTimeout(() => setStep(5), 400);
  }, [navigate, setDrawerOpen]);

  // Listen for real clicks on hamburger/data during steps 3-4
  useEffect(() => {
    if (step === 3) {
      const btn = document.querySelector('[data-onboarding="hamburger"]');
      if (btn) {
        const handler = () => handleHamburgerClick();
        btn.addEventListener('click', handler);
        return () => btn.removeEventListener('click', handler);
      }
    }
    if (step === 4) {
      const item = document.querySelector('[data-onboarding="menu-data"]');
      if (item) {
        const handler = (e: Event) => { e.preventDefault(); handleDataClick(); };
        item.addEventListener('click', handler);
        return () => item.removeEventListener('click', handler);
      }
    }
  }, [step, handleHamburgerClick, handleDataClick]);

  const handleStep5Tap = () => {
    if (skipTestAssetSteps) {
      // DB already has assets — skip test asset creation/deletion
      localStorage.setItem('hi-onboarding-done', '1');
      setStep(0);
      return;
    }
    setStep(6);
  };

  const handleAddTestAsset = useCallback(async () => {
    // Find or create account
    const accounts = await db.accounts.toArray();
    let accountId: number;
    if (accounts.length > 0) {
      accountId = accounts[0].id!;
    } else {
      const now = new Date();
      accountId = (await db.accounts.add({ name: 'Основной', createdAt: now, updatedAt: now })) as number;
      testAccountIdRef.current = accountId;
    }

    // Create asset
    const assetId = await addAsset({
      type: 'Акции',
      ticker: 'MOEX',
      name: 'Мосбиржа',
      dataSource: 'manual',
      paymentPerUnitSource: 'fact',
      frequencyPerYear: 1,
      frequencySource: 'moex',
    });
    testAssetIdRef.current = assetId;

    // Create holding
    const now = new Date();
    await db.holdings.add({
      accountId,
      assetId,
      quantity: 1000,
      quantitySource: 'manual',
      createdAt: now,
      updatedAt: now,
    });

    // Sync from MOEX (track success for step 7 text)
    syncSingleAsset(assetId)
      .then((r) => { syncSucceededRef.current = r.success; })
      .catch(() => { syncSucceededRef.current = false; });

    // Navigate to main page
    withViewTransition(() => navigate('/'));
    setTimeout(() => setStep(7), 2000);
  }, [navigate]);

  const handleDeleteAndStart = useCallback(async () => {
    if (testAssetIdRef.current) {
      await deleteAsset(testAssetIdRef.current);
      testAssetIdRef.current = null;
    }
    if (testAccountIdRef.current) {
      const holdingsCount = await db.holdings
        .where('accountId').equals(testAccountIdRef.current).count();
      if (holdingsCount === 0) {
        await db.accounts.delete(testAccountIdRef.current);
        testAccountIdRef.current = null;
      }
    }
    localStorage.setItem('hi-onboarding-done', '1');
    setStep(0);
  }, []);

  if (step === 0) return null;

  const skipButton = (
    <button
      onClick={endTour}
      className="fixed bottom-10 right-5 z-[9003] font-mono text-[var(--hi-ash)]"
      style={{ fontSize: 'var(--hi-text-micro)' }}
    >
      пропустить
    </button>
  );

  const bottomHint = (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9003] font-mono text-[var(--hi-ash)]"
      style={{ fontSize: 'var(--hi-text-micro)', letterSpacing: '0.05em' }}
    >
      нажмите для продолжения
    </div>
  );

  return createPortal(
    <>
      {/* Step 1: Mockup overlay */}
      {step === 1 && (
        <CoachOverlay targetRect={null} onClick={handleStep1Tap}>
          <div className="fixed inset-0 z-[9001]">
            <MockMainPage />
            <div className="absolute inset-0 bg-black/40" />
            <CoachTooltip
              targetRef={null}
              text="Так выглядит приложение с данными"
              stepIndex={1}
              totalSteps={7}
            />
          </div>
          {bottomHint}
          {skipButton}
        </CoachOverlay>
      )}

      {/* Step 2: Empty state */}
      {step === 2 && (
        <CoachOverlay targetRect={null} onClick={handleStep2Tap}>
          <CoachTooltip
            targetRef={null}
            text="А пока здесь пусто. Давайте это исправим!"
            stepIndex={2}
            totalSteps={7}
          />
          {bottomHint}
          {skipButton}
        </CoachOverlay>
      )}

      {/* Step 3: Spotlight on hamburger */}
      {step === 3 && (
        <CoachOverlay targetRect={targetRect} passThrough>
          <CoachTooltip
            targetRef={{ current: document.querySelector('[data-onboarding="hamburger"]') } as any}
            text="Нажмите для доступа к меню"
            stepIndex={3}
            totalSteps={7}
          />
          {skipButton}
        </CoachOverlay>
      )}

      {/* Step 4: Spotlight on "Данные" in drawer */}
      {step === 4 && (
        <CoachOverlay targetRect={targetRect} passThrough>
          <CoachTooltip
            targetRef={{ current: document.querySelector('[data-onboarding="menu-data"]') } as any}
            text="Управление портфелем — здесь"
            stepIndex={4}
            totalSteps={7}
          />
          {skipButton}
        </CoachOverlay>
      )}

      {/* Step 5: Data page tooltip */}
      {step === 5 && (
        <CoachOverlay targetRect={null} onClick={handleStep5Tap}>
          <CoachTooltip
            targetRef={null}
            text="Импортируйте брокерский отчёт или добавьте активы вручную"
            subtitle="Для биржевых активов выплаты подтянутся автоматически"
            stepIndex={5}
            totalSteps={7}
          />
          {bottomHint}
          {skipButton}
        </CoachOverlay>
      )}

      {/* Step 6: Add test asset */}
      {step === 6 && (
        <CoachOverlay targetRect={null}>
          <div className="fixed inset-0 z-[9001] flex items-center justify-center">
            <div className="w-[280px] bg-[var(--hi-stone)] rounded-lg p-5 border border-[rgba(200,180,140,0.12)]">
              <div
                className="text-[var(--hi-text)] font-sans leading-relaxed"
                style={{ fontSize: 'var(--hi-text-body)' }}
              >
                Добавим 1000 акций Мосбиржи (MOEX) для примера?
              </div>
              <div
                className="mt-1 text-[var(--hi-muted)] italic"
                style={{ fontSize: 'var(--hi-text-caption)' }}
              >
                Удалить можно в любой момент
              </div>
              <button
                onClick={handleAddTestAsset}
                className="mt-4 w-full py-2.5 rounded-lg bg-[rgba(200,180,140,0.1)] text-[var(--hi-gold)] font-sans border border-[rgba(200,180,140,0.12)] transition-colors hover:bg-[rgba(200,180,140,0.15)]"
                style={{ fontSize: 'var(--hi-text-body)' }}
              >
                Добавить
              </button>
              <div
                className="mt-2 text-center font-mono text-[var(--hi-muted)]"
                style={{ fontSize: 'var(--hi-text-micro)' }}
              >
                6 / 7
              </div>
            </div>
          </div>
          {skipButton}
        </CoachOverlay>
      )}

      {/* Step 7: Delete test asset */}
      {step === 7 && (
        <CoachOverlay targetRect={null}>
          <div className="fixed inset-0 z-[9001] flex items-center justify-center">
            <div className="w-[280px] bg-[var(--hi-stone)] rounded-lg p-5 border border-[rgba(200,180,140,0.12)]">
              <div
                className="text-[var(--hi-text)] font-sans leading-relaxed"
                style={{ fontSize: 'var(--hi-text-body)' }}
              >
                {syncSucceededRef.current
                  ? 'Вот как выглядит расчёт дохода. Удаляем тестовый актив — начните со своих данных!'
                  : 'Данные с биржи загрузятся позже. Пока доход не рассчитан — это нормально. Удаляем тестовый актив — начните со своих данных!'}
              </div>
              <button
                onClick={handleDeleteAndStart}
                className="mt-4 w-full py-2.5 rounded-lg bg-[rgba(200,180,140,0.1)] text-[var(--hi-gold)] font-sans border border-[rgba(200,180,140,0.12)] transition-colors hover:bg-[rgba(200,180,140,0.15)]"
                style={{ fontSize: 'var(--hi-text-body)' }}
              >
                Удалить и начать
              </button>
              <div
                className="mt-2 text-center font-mono text-[var(--hi-muted)]"
                style={{ fontSize: 'var(--hi-text-micro)' }}
              >
                7 / 7
              </div>
            </div>
          </div>
          {skipButton}
        </CoachOverlay>
      )}
    </>,
    document.body,
  );
}
```

**Key implementation notes:**
- `data-onboarding="hamburger"` and `data-onboarding="menu-data"` attributes must be added to AppShell and DrawerMenu (done in Task 7)
- `syncSingleAsset` imported directly from `@/services/moex-sync` to bypass context guard
- Test asset cleanup tracked via refs, not state (survives re-renders)
- Route guard ends tour if user navigates unexpectedly

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors (may have warnings about unused `hasAssets` — will be used in skip logic refinement)

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/FirstLaunchTour.tsx
git commit -m "feat(onboarding): add FirstLaunchTour state machine (7 steps)"
```

---

### Task 6: PageTip (Phase 2)

Reusable component for contextual page tips. Shows overlay + tooltip on first visit.

**Files:**
- Create: `src/components/onboarding/PageTip.tsx`

- [ ] **Step 1: Create PageTip**

```tsx
// src/components/onboarding/PageTip.tsx
import { useState, useEffect, useCallback, type RefObject } from 'react';
import { CoachOverlay } from './CoachOverlay';
import { CoachTooltip } from './CoachTooltip';

interface PageTipProps {
  storageKey: string;
  targetRef: RefObject<HTMLElement | null>;
  text: string;
}

export function PageTip({ storageKey, targetRef, text }: PageTipProps) {
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // Only show if onboarding is done and this tip hasn't been shown
    if (!localStorage.getItem('hi-onboarding-done')) return;
    if (localStorage.getItem(storageKey)) return;
    if (!targetRef.current) return;

    // Delay slightly to let page render
    const timer = setTimeout(() => {
      if (targetRef.current) {
        setTargetRect(targetRef.current.getBoundingClientRect());
        setVisible(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [storageKey, targetRef]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
  }, [storageKey]);

  if (!visible) return null;

  return (
    <CoachOverlay targetRect={targetRect} onClick={handleDismiss}>
      <CoachTooltip targetRef={targetRef} text={text} />
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9003] font-mono text-[var(--hi-ash)]"
        style={{ fontSize: 'var(--hi-text-micro)', letterSpacing: '0.05em' }}
      >
        нажмите для продолжения
      </div>
    </CoachOverlay>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/PageTip.tsx
git commit -m "feat(onboarding): add PageTip for phase 2 contextual tips"
```

---

### Task 7: Integration (App.tsx, AppShell, DrawerMenu, Pages)

Wire everything together. Add `data-onboarding` attributes, mount providers, add PageTips to pages, add reset button to settings.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/layout/drawer-menu.tsx`
- Modify: `src/pages/payments-page.tsx`
- Modify: `src/pages/category-page.tsx`
- Modify: `src/pages/asset-detail-page.tsx`
- Modify: `src/pages/settings-page.tsx`

- [ ] **Step 1: Modify App.tsx — add OnboardingProvider + FirstLaunchTour**

Wrap `SyncProvider` with `OnboardingProvider`. Add `FirstLaunchTour` after `Routes`.

```tsx
// Add imports:
import { OnboardingProvider } from '@/contexts/onboarding-context';
import { FirstLaunchTour } from '@/components/onboarding/FirstLaunchTour';

// Wrap SyncProvider:
<OnboardingProvider>
  <SyncProvider>
    <Routes>...</Routes>
    <FirstLaunchTour />
  </SyncProvider>
</OnboardingProvider>
```

- [ ] **Step 2: Modify app-shell.tsx — subscribe to OnboardingContext for drawer**

When onboarding is active, use `drawerOpen`/`setDrawerOpen` from context. Add `data-onboarding="hamburger"` to the hamburger button.

```tsx
// Add import:
import { useOnboarding } from '@/contexts/onboarding-context';

// In component body:
const { active: onboardingActive, drawerOpen: obDrawerOpen, setDrawerOpen: obSetDrawerOpen } = useOnboarding();
const [localDrawerOpen, setLocalDrawerOpen] = useState(false);
const drawerOpen = onboardingActive ? obDrawerOpen : localDrawerOpen;
const setDrawerOpen = onboardingActive ? obSetDrawerOpen : setLocalDrawerOpen;

// Add data-onboarding attribute to hamburger button
<button data-onboarding="hamburger" ...>☰</button>
```

- [ ] **Step 3: Modify drawer-menu.tsx — add data-onboarding to "Данные"**

```tsx
// On the "Данные" TransitionLink:
<TransitionLink
  data-onboarding={item.path === '/data' ? 'menu-data' : undefined}
  ...
>
```

- [ ] **Step 4: Modify payments-page.tsx — add PageTip**

```tsx
import { useRef } from 'react';
import { PageTip } from '@/components/onboarding/PageTip';

// In component:
const listRef = useRef<HTMLDivElement>(null);

// Wrap the payment list container with ref:
<div ref={listRef}>...</div>

// Add PageTip:
<PageTip
  storageKey="hi-tip-payments"
  targetRef={listRef}
  text="История выплат. Для биржевых активов подтягивается с MOEX, но можно добавить и вручную"
/>
```

- [ ] **Step 5: Modify category-page.tsx — add PageTip**

```tsx
import { useRef } from 'react';
import { PageTip } from '@/components/onboarding/PageTip';

// In component:
const firstAssetRef = useRef<HTMLDivElement>(null);

// On first AssetRow wrapper:
// Wrap first item with ref

// Add PageTip:
<PageTip
  storageKey="hi-tip-category"
  targetRef={firstAssetRef}
  text="Доход и доходность — по каждому активу отдельно. Нажмите для подробностей"
/>
```

- [ ] **Step 6: Modify asset-detail-page.tsx — add PageTip**

```tsx
import { useRef } from 'react';
import { PageTip } from '@/components/onboarding/PageTip';

// In component:
const paymentFieldRef = useRef<HTMLDivElement>(null);

// On the "Выплата на шт. / год" AssetField wrapper:
<div ref={paymentFieldRef}>
  <AssetField label="Выплата на шт. / год" ... />
</div>

// Add PageTip:
<PageTip
  storageKey="hi-tip-asset"
  targetRef={paymentFieldRef}
  text="Для биржевых активов годовой доход рассчитан по последним выплатам. Но можно указать и вручную — полезно если знаете точнее"
/>
```

- [ ] **Step 7: Modify settings-page.tsx — add reset button**

```tsx
// Add a "Сбросить подсказки" button in the settings section:
<button
  onClick={() => {
    localStorage.removeItem('hi-onboarding-done');
    localStorage.removeItem('hi-tip-payments');
    localStorage.removeItem('hi-tip-category');
    localStorage.removeItem('hi-tip-asset');
    // Optional: show confirmation toast or just visual feedback
  }}
  className="w-full py-3 rounded-lg border border-[rgba(200,180,140,0.08)] text-[var(--hi-ash)] transition-colors hover:text-[var(--hi-gold)] hover:border-[rgba(200,180,140,0.15)]"
  style={{ fontSize: 'var(--hi-text-body)' }}
>
  Сбросить подсказки
</button>
```

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/components/layout/app-shell.tsx src/components/layout/drawer-menu.tsx \
  src/pages/payments-page.tsx src/pages/category-page.tsx src/pages/asset-detail-page.tsx \
  src/pages/settings-page.tsx
git commit -m "feat(onboarding): integrate tour + page tips + settings reset"
```

---

### Task 8: Visual Tuning and End-to-End Testing

Run the app, walk through the entire onboarding flow, take screenshots, adjust visual parameters.

**Files:**
- May modify: `CoachOverlay.tsx`, `CoachTooltip.tsx`, `FirstLaunchTour.tsx`

- [ ] **Step 1: Clear localStorage and test full flow**

1. Open browser DevTools → Application → Local Storage
2. Delete `hi-onboarding-done`, `hi-splash-seen`
3. Reload app
4. Walk through all 7 steps
5. Screenshot each step

- [ ] **Step 2: Tune spotlight parameters**

Adjust in CoachOverlay.tsx:
- Shadow gradient opacity stops (currently 0.15/0.55/0.82/0.88)
- Warm light intensity (currently 0.07/0.03)
- Ellipse padding (currently 20px)
- Transition duration (currently 300ms)

Compare against brainstorm reference: `.superpowers/brainstorm/32077-1774470571/flashlight-tuning.html` (option B)

- [ ] **Step 3: Tune tooltip positioning and shape**

- Verify Floating UI places tooltip near target without overlap
- Adjust offset (currently 16px) if needed
- Check organic shape looks good at different content lengths

- [ ] **Step 4: Test edge cases**

1. Press back button during step 4 → tour should end cleanly
2. Kill network → step 6 should still create asset (income = 0₽)
3. Reset from settings → re-trigger tour
4. Re-trigger with existing assets → steps 6-7 should be skipped

- [ ] **Step 5: Test PageTips (Phase 2)**

1. Complete tour
2. Visit /payments → tip should appear
3. Dismiss → refresh → tip should not reappear
4. Visit /category/:type → tip on first asset
5. Visit /asset/:id → tip on payment field

- [ ] **Step 6: Commit final adjustments**

```bash
git add src/components/onboarding/ src/contexts/onboarding-context.tsx
git commit -m "feat(onboarding): visual tuning and edge case fixes"
```
