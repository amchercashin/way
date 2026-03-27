import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CoachOverlay } from './CoachOverlay';
import { CoachTooltip } from './CoachTooltip';

const STORAGE_KEY = 'hi-tip-data';
const TOTAL_STEPS = 5;

function unionRect(...rects: DOMRect[]): DOMRect {
  const left = Math.min(...rects.map(r => r.left));
  const top = Math.min(...rects.map(r => r.top));
  const right = Math.max(...rects.map(r => r.right));
  const bottom = Math.max(...rects.map(r => r.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

export function DataTour() {
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  // Boot: poll for first account-section to appear in DOM
  useEffect(() => {
    if (!localStorage.getItem('hi-onboarding-done')) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const id = setInterval(() => {
      const el = document.querySelector<HTMLElement>('[data-onboarding="account-section"]');
      if (el) {
        clearInterval(id);
        const header = el.querySelector<HTMLElement>('[data-onboarding="account-header"]');
        if (header) {
          setSpotlightRect(header.getBoundingClientRect());
        }
        setStep(1);
      }
    }, 300);

    const timeout = setTimeout(() => clearInterval(id), 5000);
    return () => { clearInterval(id); clearTimeout(timeout); };
  }, []);

  const endTour = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setStep(0);
  }, []);

  // Step 1 → 2: expand first account accordion
  const handleStep1 = useCallback(() => {
    const header = document.querySelector<HTMLElement>('[data-onboarding="account-header"]');
    if (header && header.getAttribute('data-expanded') === 'false') {
      header.click();
    }
    setTimeout(() => {
      setSpotlightRect(null);
      setStep(2);
    }, 150);
  }, []);

  // Step 2 → 3: spotlight on account menu button ⋯
  const handleStep2 = useCallback(() => {
    const btn = document.querySelector<HTMLElement>('[data-onboarding="account-menu-btn"]');
    setSpotlightRect(btn ? btn.getBoundingClientRect() : null);
    setStep(3);
  }, []);

  // Step 3 → 4: scroll down to "add account" button, spotlight it
  const handleStep3 = useCallback(() => {
    const btn = document.querySelector<HTMLElement>('[data-onboarding="add-account-btn"]');
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        setSpotlightRect(btn.getBoundingClientRect());
        setStep(4);
      }, 400);
    } else {
      setStep(4);
    }
  }, []);

  // Step 4 → 5: scroll up to expanded account, spotlight editing zone
  const handleStep4 = useCallback(() => {
    const addAssetBtn = document.querySelector<HTMLElement>('[data-onboarding="add-asset-btn"]');
    const scrollTarget = addAssetBtn ?? document.querySelector<HTMLElement>('[data-onboarding="account-section"]');
    if (scrollTarget) {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      const quantityEl = document.querySelector<HTMLElement>('[data-onboarding="holding-quantity"]');
      const deleteEl = document.querySelector<HTMLElement>('[data-onboarding="holding-delete"]');
      const addBtn = document.querySelector<HTMLElement>('[data-onboarding="add-asset-btn"]');

      const rects = [quantityEl, deleteEl, addBtn]
        .filter((el): el is HTMLElement => el !== null)
        .map(el => el.getBoundingClientRect());

      setSpotlightRect(rects.length > 0 ? unionRect(...rects) : null);
      setStep(5);
    }, 400);
  }, []);

  // Step 5 → end
  const handleStep5 = useCallback(() => {
    endTour();
  }, [endTour]);

  if (step === 0) return null;

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
    case 1: {
      content = (
        <CoachOverlay targetRect={spotlightRect} onClick={handleStep1}>
          <CoachTooltip
            text="Ваш портфель по счетам и активам."
            stepIndex={1}
            totalSteps={TOTAL_STEPS}
          />
          {tapHint}
          {skipButton}
        </CoachOverlay>
      );
      break;
    }

    case 2:
      content = (
        <CoachOverlay targetRect={null} onClick={handleStep2}>
          <CoachTooltip
            text="Всё раскрывается"
            subtitle="Для типов Акции и Облигации выплаты подтянутся с биржи, если введены корректные данные."
            stepIndex={2}
            totalSteps={TOTAL_STEPS}
          />
          {tapHint}
          {skipButton}
        </CoachOverlay>
      );
      break;

    case 3: {
      const top3 = spotlightRect
        ? spotlightRect.top + spotlightRect.height / 2 - 38
        : undefined;
      content = (
        <CoachOverlay targetRect={spotlightRect} onClick={handleStep3}>
          <CoachTooltip
            text="Можно импортировать из отчётов брокера"
            subtitle="Обновив существующий счёт"
            stepIndex={3}
            totalSteps={TOTAL_STEPS}
            top={top3}
            left={16}
          />
          {tapHint}
          {skipButton}
        </CoachOverlay>
      );
      break;
    }

    case 4: {
      const top4 = spotlightRect
        ? spotlightRect.bottom + 20
        : undefined;
      content = (
        <CoachOverlay targetRect={spotlightRect} onClick={handleStep4}>
          <CoachTooltip
            text="Можно импортировать из отчётов брокера"
            subtitle={"Или создав новый\n(там же можно добавить счёт вручную)"}
            stepIndex={4}
            totalSteps={TOTAL_STEPS}
            top={top4}
          />
          {tapHint}
          {skipButton}
        </CoachOverlay>
      );
      break;
    }

    case 5: {
      const top5 = spotlightRect
        ? spotlightRect.bottom + 20
        : undefined;
      content = (
        <CoachOverlay targetRect={spotlightRect} onClick={handleStep5}>
          <CoachTooltip
            text="Значения можно поменять вручную, а актив удалить или добавить"
            stepIndex={5}
            totalSteps={TOTAL_STEPS}
            top={top5}
          />
          {tapHint}
          {skipButton}
        </CoachOverlay>
      );
      break;
    }
  }

  return createPortal(content, document.body);
}
