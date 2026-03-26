import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CoachOverlay } from './CoachOverlay';
import { CoachTooltip } from './CoachTooltip';

const STORAGE_KEY = 'hi-tip-payments';
const TOTAL_STEPS = 5;

export function PaymentsTour() {
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  // Boot: poll for first type-section to appear in DOM
  useEffect(() => {
    if (!localStorage.getItem('hi-onboarding-done')) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const id = setInterval(() => {
      const el = document.querySelector<HTMLElement>('[data-onboarding="type-section"]');
      if (el) {
        clearInterval(id);
        const rect = el.getBoundingClientRect();
        const valueRect = new DOMRect(
          rect.x + 10,
          rect.top + 32,
          Math.min(140, rect.width * 0.45),
          22,
        );
        setSpotlightRect(valueRect);
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

  // Step 1 → 2: expand first category + first asset
  const handleStep1 = useCallback(() => {
    const toggle = document.querySelector<HTMLElement>('[data-onboarding="type-section-toggle"]');
    if (toggle && toggle.getAttribute('data-expanded') === 'false') {
      toggle.click();
    }
    setTimeout(() => {
      const header = document.querySelector<HTMLElement>('[data-onboarding="asset-header"]');
      if (header && header.getAttribute('data-expanded') === 'false') {
        header.click();
      }
      setTimeout(() => {
        setSpotlightRect(null);
        setStep(2);
      }, 100);
    }, 100);
  }, []);

  // Step 2 → 3: spotlight on "+ выплата"
  const handleStep2 = useCallback(() => {
    const btn = document.querySelector<HTMLElement>('[data-onboarding="add-payment-btn"]');
    setSpotlightRect(btn ? btn.getBoundingClientRect() : null);
    setStep(3);
  }, []);

  // Step 3 → 4: spotlight on ⊘ exclude button
  const handleStep3 = useCallback(() => {
    const btn = document.querySelector<HTMLElement>('[data-onboarding="exclude-btn"]');
    setSpotlightRect(btn ? btn.getBoundingClientRect() : null);
    setStep(4);
  }, []);

  // Step 4 → 5: spotlight on ⟳ sync button
  const handleStep4 = useCallback(() => {
    const btn = document.querySelector<HTMLElement>('[data-onboarding="asset-sync-btn"]');
    setSpotlightRect(btn ? btn.getBoundingClientRect() : null);
    setStep(5);
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
      const tooltipTop = spotlightRect
        ? spotlightRect.top + spotlightRect.height / 2 - 38
        : undefined;
      const tooltipLeft = spotlightRect
        ? Math.min(spotlightRect.right - 40, window.innerWidth - 280 - 16)
        : undefined;
      content = (
        <CoachOverlay targetRect={spotlightRect} onClick={handleStep1}>
          <CoachTooltip
            text="История выплат – здесь всегда будет то, что вы добавили на странице Данные"
            stepIndex={1}
            totalSteps={TOTAL_STEPS}
            top={tooltipTop}
            left={tooltipLeft}
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
            text="Всё раскрывается!"
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
            text="Выплату можно добавить"
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
        ? spotlightRect.top + spotlightRect.height / 2 - 38
        : undefined;
      const left4 = spotlightRect ? 16 : undefined;
      content = (
        <CoachOverlay targetRect={spotlightRect} onClick={handleStep4}>
          <CoachTooltip
            text="А можно и удалить"
            subtitle="Первое нажатие вычеркнёт платёж – он останется, но не будет учитываться. Его можно вернуть или удалить окончательно."
            stepIndex={4}
            totalSteps={TOTAL_STEPS}
            top={top4}
            left={left4}
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
            text="Выплаты всегда можно пересинхронизировать с биржи"
            subtitle="Это может стереть какие-то выплаты, которые были добавлены вручную."
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
