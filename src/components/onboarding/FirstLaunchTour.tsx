import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOnboarding } from '@/contexts/onboarding-context';
import { useAssets, addAsset } from '@/hooks/use-assets';
import { syncSingleAsset } from '@/services/moex-sync';
import { db } from '@/db/database';
import { withViewTransition } from '@/lib/view-transition';
import { CoachOverlay } from './CoachOverlay';
import { CoachTooltip } from './CoachTooltip';
import { MockMainPage } from './MockMainPage';

const STORAGE_KEY = 'hi-onboarding-done';
const TOTAL_STEPS = 7;

export function FirstLaunchTour() {
  const [step, setStep] = useState(0);
  const { setActive, setDrawerOpen } = useOnboarding();
  const assets = useAssets();
  const navigate = useNavigate();
  const location = useLocation();

  const syncSucceededRef = useRef(true);
  const endingRef = useRef(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const spotlightTargetRef = useRef<HTMLElement | null>(null);

  // ---- Boot: check localStorage, start after splash delay ----
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const timer = setTimeout(() => {
      setStep(1);
      setActive(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Route guard ----
  useEffect(() => {
    if (step === 0) return;
    const allowed = ['/', '/data'];
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const path = location.pathname.replace(base, '') || '/';
    if (!allowed.includes(path) && !endingRef.current) {
      endTour();
    }
  }, [location.pathname, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- End tour (skip) ----
  const endTour = useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;

    setDrawerOpen(false);
    setActive(false);
    setStep(0);
    localStorage.setItem(STORAGE_KEY, '1');
    withViewTransition(() => navigate('/'));
  }, [navigate, setActive, setDrawerOpen]);

  // ---- Step 3 & 7: spotlight on hamburger ----
  useEffect(() => {
    if (step !== 3 && step !== 7) return;
    const el = document.querySelector<HTMLElement>('[data-onboarding="hamburger"]');
    if (el) {
      setSpotlightRect(el.getBoundingClientRect());
      spotlightTargetRef.current = el;
    }
  }, [step]);

  const handleStep3Click = useCallback(() => {
    setDrawerOpen(true);
    // Wait for drawer to render, then find "Данные" and move spotlight
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[data-onboarding="menu-data"]');
      if (el) {
        const full = el.getBoundingClientRect();
        // Narrow rect to icon+label area (link is full-width but text is left-aligned)
        setSpotlightRect(new DOMRect(full.x, full.y, Math.min(140, full.width), full.height));
        spotlightTargetRef.current = el;
      }
      setStep(4);
    }, 500);
  }, [setDrawerOpen]);

  // ---- Step 4: click overlay to navigate to /data ----
  const handleStep4Click = useCallback(() => {
    setDrawerOpen(false);
    setSpotlightRect(null);
    withViewTransition(() => navigate('/data'));
    setTimeout(() => setStep(5), 400);
  }, [navigate, setDrawerOpen]);

  // ---- Step 5 tap ----
  const handleStep5Tap = useCallback(() => {
    if (assets.length > 0) {
      withViewTransition(() => navigate('/'));
      setTimeout(() => setStep(7), 400);
      return;
    }
    setStep(6);
  }, [assets.length, navigate]);

  // ---- Step 6: create test asset ----
  const handleCreateTestAsset = useCallback(async () => {
    try {
      const now = new Date();
      const existingAccounts = await db.accounts.toArray();
      let accountId: number;
      if (existingAccounts.length > 0) {
        accountId = existingAccounts[0].id!;
      } else {
        accountId = (await db.accounts.add({
          name: 'Основной',
          createdAt: now,
          updatedAt: now,
        })) as number;
      }

      const assetId = await addAsset({
        type: 'Акции',
        name: 'Мосбиржа',
        ticker: 'MOEX',
        dataSource: 'manual',
        paymentPerUnitSource: 'fact',
        frequencyPerYear: 1,
        frequencySource: 'moex',
      });
      await db.holdings.add({
        accountId,
        assetId,
        quantity: 1000,
        quantitySource: 'manual',
        createdAt: now,
        updatedAt: now,
      });

      // Navigate to main page and show step 7 immediately
      withViewTransition(() => navigate('/'));
      setTimeout(() => setStep(7), 400);

      // Sync from MOEX in background
      syncSingleAsset(assetId)
        .then((r) => { syncSucceededRef.current = r.success; })
        .catch(() => { syncSucceededRef.current = false; });
    } catch {
      syncSucceededRef.current = false;
      setStep(7);
    }
  }, [navigate]);

  // ---- Step 7: finish tour (user deletes test data manually) ----
  const handleFinish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setActive(false);
    setStep(0);
  }, [setActive]);

  if (step === 0) return null;

  // Skip button — pointer-events-auto so it's clickable even when overlay has passThrough
  const skipButton = (
    <button
      onClick={endTour}
      className="fixed bottom-10 right-5 z-[9003] pointer-events-auto font-mono text-[var(--hi-ash)]"
      style={{ fontSize: 'var(--hi-text-micro)' }}
    >
      пропустить
    </button>
  );

  const tapHint = (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9003] font-mono text-[var(--hi-ash)]"
      style={{ fontSize: 'var(--hi-text-micro)', letterSpacing: '0.05em' }}
    >
      нажмите для продолжения
    </div>
  );

  let content: React.ReactNode = null;

  switch (step) {
    case 1:
      content = (
        <>
          <div className="fixed inset-0 z-[8999]">
            <MockMainPage />
          </div>
          <CoachOverlay targetRect={null} onClick={() => setStep(2)}>
            <div className="absolute inset-0 bg-black/40" />
            <CoachTooltip
              text="Так выглядит приложение с данными"
              stepIndex={1}
              totalSteps={TOTAL_STEPS}
            />
          </CoachOverlay>
          {tapHint}
          {skipButton}
        </>
      );
      break;

    case 2:
      // Real empty page is visible behind the overlay (no MockMainPage)
      content = (
        <>
          <CoachOverlay targetRect={null} onClick={() => setStep(3)}>
            <CoachTooltip
              text="А пока здесь пусто. Давайте это исправим!"
              stepIndex={2}
              totalSteps={TOTAL_STEPS}
            />
          </CoachOverlay>
          {tapHint}
          {skipButton}
        </>
      );
      break;

    case 3: {
      const tooltipTop = spotlightRect ? spotlightRect.top : 16;
      content = (
        <>
          <CoachOverlay targetRect={spotlightRect} onClick={handleStep3Click}>
            <CoachTooltip
              text="Нажмите для доступа к меню"
              stepIndex={3}
              totalSteps={TOTAL_STEPS}
              top={tooltipTop}
            />
          </CoachOverlay>
          {skipButton}
        </>
      );
      break;
    }

    case 4: {
      // Center tooltip vertically on "Данные" item (~38px = half tooltip height)
      const tipTop4 = spotlightRect
        ? spotlightRect.top + spotlightRect.height / 2 - 38
        : 120;
      content = (
        <>
          <CoachOverlay targetRect={spotlightRect} onClick={handleStep4Click}>
            <CoachTooltip
              text="Управление портфелем — здесь"
              stepIndex={4}
              totalSteps={TOTAL_STEPS}
              top={tipTop4}
              left={spotlightRect ? spotlightRect.right + 16 : 160}
            />
          </CoachOverlay>
          {skipButton}
        </>
      );
      break;
    }

    case 5:
      content = (
        <>
          <CoachOverlay targetRect={null} onClick={handleStep5Tap}>
            <CoachTooltip
              text="Импортируйте брокерский отчёт или добавьте активы вручную"
              subtitle="Для биржевых активов выплаты подтянутся автоматически"
              stepIndex={5}
              totalSteps={TOTAL_STEPS}
            />
          </CoachOverlay>
          {tapHint}
          {skipButton}
        </>
      );
      break;

    case 6:
      content = (
        <>
          <CoachOverlay targetRect={null}>
            <div className="fixed inset-0 z-[9001] flex items-center justify-center">
              <div className="w-[280px] bg-[var(--hi-stone)] rounded-lg p-5 border border-[rgba(200,180,140,0.12)]">
                <div
                  className="text-[var(--hi-text)] font-sans leading-relaxed"
                  style={{ fontSize: 'var(--hi-text-body)' }}
                >
                  Добавим 1000 акций Мосбиржи (MOEX) для примера!
                </div>
                <div
                  className="mt-1 text-[var(--hi-muted)] italic"
                  style={{ fontSize: 'var(--hi-text-caption)' }}
                >
                  Удалить можно в любой момент
                </div>
                <button
                  onClick={handleCreateTestAsset}
                  className="mt-4 w-full py-2.5 rounded-lg bg-[rgba(200,180,140,0.1)] text-[var(--hi-gold)] font-sans border border-[rgba(200,180,140,0.12)] transition-colors hover:bg-[rgba(200,180,140,0.15)]"
                  style={{ fontSize: 'var(--hi-text-body)' }}
                >
                  Добавить
                </button>
                <div
                  className="mt-2 text-center font-mono text-[var(--hi-muted)]"
                  style={{ fontSize: 'var(--hi-text-micro)' }}
                >
                  6 / {TOTAL_STEPS}
                </div>
              </div>
            </div>
          </CoachOverlay>
          {skipButton}
        </>
      );
      break;

    case 7:
      content = (
        <>
          <CoachOverlay targetRect={spotlightRect}>
            <div className="fixed inset-0 z-[9001] flex items-center justify-center">
              <div className="w-[280px] bg-[#2a2520] rounded-lg p-5 border border-[rgba(200,180,140,0.25)] shadow-[0_0_24px_rgba(200,180,140,0.12)]">
                <div
                  className="text-[#e0d5c5] font-sans leading-relaxed"
                  style={{ fontSize: 'var(--hi-text-body)' }}
                >
                  {syncSucceededRef.current
                    ? 'Вот так выглядит расчёт дохода. Чтобы удалить тестовые данные, зайдите на вкладку Данные через меню'
                    : 'Данные с биржи загрузятся позже. Чтобы удалить тестовые данные, зайдите на вкладку Данные через меню'}
                </div>
                <button
                  onClick={handleFinish}
                  className="mt-4 w-full py-2.5 rounded-lg bg-[rgba(200,180,140,0.1)] text-[var(--hi-gold)] font-sans border border-[rgba(200,180,140,0.12)] transition-colors hover:bg-[rgba(200,180,140,0.15)]"
                  style={{ fontSize: 'var(--hi-text-body)' }}
                >
                  Супер!
                </button>
                <div
                  className="mt-2 text-center font-mono text-[#a09080]"
                  style={{ fontSize: 'var(--hi-text-micro)' }}
                >
                  7 / {TOTAL_STEPS}
                </div>
              </div>
            </div>
          </CoachOverlay>
        </>
      );
      break;
  }

  return createPortal(content, document.body);
}
