import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOnboarding } from '@/contexts/onboarding-context';
import { useAssets, addAsset, deleteAsset } from '@/hooks/use-assets';
import { syncSingleAsset } from '@/services/moex-sync';
import { db } from '@/db/database';
import { withViewTransition } from '@/lib/view-transition';
import { CoachOverlay } from './CoachOverlay';
import { CoachTooltip } from './CoachTooltip';
import { MockMainPage } from './MockMainPage';

const STORAGE_KEY = 'hi-onboarding-done';
const TOTAL_STEPS = 7;
const TEST_TICKER = 'MOEX';
const TEST_ASSET_NAME = 'МосБиржа';
const TEST_ACCOUNT_NAME = '__onboarding__';
const TEST_QUANTITY = 10;

export function FirstLaunchTour() {
  const [step, setStep] = useState(0);
  const { setActive, setDrawerOpen } = useOnboarding();
  const assets = useAssets();
  const navigate = useNavigate();
  const location = useLocation();

  // Refs that persist across renders without causing re-renders
  const testAssetIdRef = useRef<number | null>(null);
  const testAccountIdRef = useRef<number | null>(null);
  const syncSucceededRef = useRef(false);
  const endingRef = useRef(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const spotlightTargetRef = useRef<HTMLElement | null>(null);

  // ---- Boot: check localStorage, start after delay ----
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const timer = setTimeout(() => {
      setStep(1);
      setActive(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Route guard: end tour if user navigates unexpectedly ----
  useEffect(() => {
    if (step === 0) return;
    // Allow / and /data during tour
    const allowed = ['/', '/data'];
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const path = location.pathname.replace(base, '') || '/';
    if (!allowed.includes(path) && !endingRef.current) {
      endTour();
    }
  }, [location.pathname, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- End tour: cleanup + navigate home ----
  const endTour = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;

    // Delete test asset if created
    if (testAssetIdRef.current) {
      try {
        await deleteAsset(testAssetIdRef.current);
      } catch {
        // ignore
      }
    }
    // Delete test account if created
    if (testAccountIdRef.current) {
      try {
        await db.accounts.delete(testAccountIdRef.current);
      } catch {
        // ignore
      }
    }

    setDrawerOpen(false);
    setActive(false);
    setStep(0);
    localStorage.setItem(STORAGE_KEY, '1');

    withViewTransition(() => {
      navigate('/');
    });
  }, [navigate, setActive, setDrawerOpen]);

  // ---- Step 3: spotlight on hamburger ----
  useEffect(() => {
    if (step !== 3) return;
    const el = document.querySelector<HTMLElement>('[data-onboarding="hamburger"]');
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setSpotlightRect(rect);
    spotlightTargetRef.current = el;

    const handleClick = () => {
      setDrawerOpen(true);
      // Small delay for drawer animation
      setTimeout(() => setStep(4), 300);
    };
    el.addEventListener('click', handleClick, { once: true });
    return () => el.removeEventListener('click', handleClick);
  }, [step, setDrawerOpen]);

  // ---- Step 4: spotlight on "Данные" menu item ----
  useEffect(() => {
    if (step !== 4) return;
    // Wait a tick for drawer to render
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[data-onboarding="menu-data"]');
      if (!el) return;

      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
      spotlightTargetRef.current = el;

      const handleClick = () => {
        setDrawerOpen(false);
        withViewTransition(() => {
          navigate('/data');
        });
        setTimeout(() => setStep(5), 400);
      };
      el.addEventListener('click', handleClick, { once: true });
      return () => el.removeEventListener('click', handleClick);
    }, 200);
    return () => clearTimeout(timer);
  }, [step, navigate, setDrawerOpen]);

  // ---- Step 5 tap handler ----
  const handleStep5Tap = useCallback(() => {
    // If user already has assets, skip step 6-7
    if (assets.length > 0) {
      endTour();
    } else {
      setStep(6);
    }
  }, [assets.length, endTour]);

  // ---- Step 6: create test asset ----
  const handleCreateTestAsset = useCallback(async () => {
    try {
      // Create account if needed
      const now = new Date();
      const existingAccounts = await db.accounts.toArray();
      let accountId: number;
      if (existingAccounts.length > 0) {
        accountId = existingAccounts[0].id!;
      } else {
        accountId = (await db.accounts.add({
          name: TEST_ACCOUNT_NAME,
          createdAt: now,
          updatedAt: now,
        })) as number;
        testAccountIdRef.current = accountId;
      }

      // Create asset
      const assetId = await addAsset({
        type: 'Акции',
        name: TEST_ASSET_NAME,
        ticker: TEST_TICKER,
        dataSource: 'manual',
        paymentPerUnitSource: 'fact',
        frequencyPerYear: 1,
        frequencySource: 'moex',
      });
      testAssetIdRef.current = assetId;

      // Create holding
      await db.holdings.add({
        accountId,
        assetId,
        quantity: TEST_QUANTITY,
        quantitySource: 'manual',
        createdAt: now,
        updatedAt: now,
      });

      // Try to sync from MOEX
      const result = await syncSingleAsset(assetId);
      syncSucceededRef.current = result.success;
    } catch {
      syncSucceededRef.current = false;
    }
    setStep(7);
  }, []);

  // ---- Step 7: delete test asset and finish ----
  const handleDeleteAndFinish = useCallback(async () => {
    await endTour();
  }, [endTour]);

  // ---- Render nothing if inactive ----
  if (step === 0) return null;

  // ---- Build step content ----
  let content: React.ReactNode = null;

  // Helper for skip button
  const skipButton = (
    <button
      onClick={endTour}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9003] font-mono text-[var(--hi-muted)] underline underline-offset-4"
      style={{ fontSize: 'var(--hi-text-caption)' }}
    >
      пропустить
    </button>
  );

  const tapHint = (
    <div
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[9003] font-mono text-[var(--hi-ash)] animate-pulse"
      style={{ fontSize: 'var(--hi-text-micro)' }}
    >
      нажмите для продолжения
    </div>
  );

  switch (step) {
    // Step 1: Mockup overlay
    case 1:
      content = (
        <>
          {/* Mockup page behind overlay */}
          <div className="fixed inset-0 z-[8999]">
            <MockMainPage />
          </div>
          <CoachOverlay targetRect={null} onClick={() => setStep(2)}>
            <CoachTooltip
              targetRef={null}
              text="Это HeroIncome - приложение для учёта пассивного дохода от инвестиций"
              subtitle="Акции, облигации, фонды, вклады, недвижимость"
              stepIndex={1}
              totalSteps={TOTAL_STEPS}
            />
          </CoachOverlay>
          {tapHint}
          {skipButton}
        </>
      );
      break;

    // Step 2: Empty state tooltip
    case 2:
      content = (
        <>
          <div className="fixed inset-0 z-[8999]">
            <MockMainPage />
          </div>
          <CoachOverlay targetRect={null} onClick={() => setStep(3)}>
            <CoachTooltip
              targetRef={null}
              text="Здесь будет ваш расчётный годовой доход. Давайте настроим!"
              stepIndex={2}
              totalSteps={TOTAL_STEPS}
            />
          </CoachOverlay>
          {tapHint}
          {skipButton}
        </>
      );
      break;

    // Step 3: Spotlight on hamburger menu
    case 3:
      content = (
        <>
          <CoachOverlay targetRect={spotlightRect} passThrough>
            <CoachTooltip
              targetRef={spotlightTargetRef as React.RefObject<HTMLElement | null>}
              text="Нажмите на меню"
              stepIndex={3}
              totalSteps={TOTAL_STEPS}
            />
          </CoachOverlay>
          {skipButton}
        </>
      );
      break;

    // Step 4: Spotlight on "Данные" drawer item
    case 4:
      content = (
        <>
          <CoachOverlay targetRect={spotlightRect} passThrough>
            <CoachTooltip
              targetRef={spotlightTargetRef as React.RefObject<HTMLElement | null>}
              text='Откройте раздел "Данные"'
              stepIndex={4}
              totalSteps={TOTAL_STEPS}
            />
          </CoachOverlay>
          {skipButton}
        </>
      );
      break;

    // Step 5: Tooltip on /data page
    case 5:
      content = (
        <>
          <CoachOverlay targetRect={null} onClick={handleStep5Tap}>
            <CoachTooltip
              targetRef={null}
              text="Здесь вы импортируете данные из брокерских отчётов или добавляете активы вручную"
              stepIndex={5}
              totalSteps={TOTAL_STEPS}
            />
          </CoachOverlay>
          {tapHint}
          {skipButton}
        </>
      );
      break;

    // Step 6: Add test asset card
    case 6:
      content = (
        <>
          <CoachOverlay targetRect={null}>
            <div
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9003] w-[280px] rounded-xl p-5"
              style={{
                backgroundColor: 'var(--hi-stone)',
                border: '1px solid rgba(200,180,140,0.12)',
              }}
            >
              <div
                className="text-[var(--hi-text)] font-sans leading-relaxed mb-1"
                style={{ fontSize: 'var(--hi-text-body)' }}
              >
                Добавить {TEST_QUANTITY} акций {TEST_TICKER} для примера?
              </div>
              <div
                className="text-[var(--hi-muted)] mb-4"
                style={{ fontSize: 'var(--hi-text-caption)' }}
              >
                Загрузим данные с Московской биржи
              </div>
              <button
                onClick={handleCreateTestAsset}
                className="w-full py-2.5 rounded-lg font-mono text-[var(--hi-void)] transition-colors"
                style={{
                  fontSize: 'var(--hi-text-body)',
                  backgroundColor: 'var(--hi-gold)',
                }}
              >
                Добавить
              </button>
              <div
                className="font-mono text-[var(--hi-muted)] mt-3 text-center"
                style={{ fontSize: 'var(--hi-text-micro)' }}
              >
                6 / {TOTAL_STEPS}
              </div>
            </div>
          </CoachOverlay>
          {skipButton}
        </>
      );
      break;

    // Step 7: Delete test asset card
    case 7:
      content = (
        <>
          <CoachOverlay targetRect={null}>
            <div
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9003] w-[280px] rounded-xl p-5"
              style={{
                backgroundColor: 'var(--hi-stone)',
                border: '1px solid rgba(200,180,140,0.12)',
              }}
            >
              <div
                className="text-[var(--hi-text)] font-sans leading-relaxed mb-1"
                style={{ fontSize: 'var(--hi-text-body)' }}
              >
                {syncSucceededRef.current
                  ? 'Данные загружены! Удалить тестовый актив и начать с чистого листа?'
                  : 'Актив создан, но синхронизация не удалась. Удалить тестовый актив?'}
              </div>
              <div
                className="text-[var(--hi-muted)] mb-4"
                style={{ fontSize: 'var(--hi-text-caption)' }}
              >
                Импортируйте свой реальный портфель в разделе "Данные"
              </div>
              <button
                onClick={handleDeleteAndFinish}
                className="w-full py-2.5 rounded-lg font-mono transition-colors border"
                style={{
                  fontSize: 'var(--hi-text-body)',
                  color: 'var(--hi-text)',
                  borderColor: 'rgba(200,180,140,0.18)',
                  backgroundColor: 'transparent',
                }}
              >
                Удалить и завершить
              </button>
              <div
                className="font-mono text-[var(--hi-muted)] mt-3 text-center"
                style={{ fontSize: 'var(--hi-text-micro)' }}
              >
                7 / {TOTAL_STEPS}
              </div>
            </div>
          </CoachOverlay>
          {skipButton}
        </>
      );
      break;
  }

  return createPortal(content, document.body);
}
