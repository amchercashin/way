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
    if (!localStorage.getItem('hi-onboarding-done')) return;
    if (localStorage.getItem(storageKey)) return;

    // Target element may not be in DOM yet (async data from IndexedDB).
    // Poll until it appears, then show the tip.
    const id = setInterval(() => {
      if (targetRef.current) {
        clearInterval(id);
        setTargetRect(targetRef.current.getBoundingClientRect());
        setVisible(true);
      }
    }, 300);

    const timeout = setTimeout(() => clearInterval(id), 5000);

    return () => {
      clearInterval(id);
      clearTimeout(timeout);
    };
  }, [storageKey, targetRef]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
  }, [storageKey]);

  if (!visible || !targetRect) return null;

  // Vertically center tooltip on target (~38px = half tooltip height estimate)
  const tooltipTop = targetRect.top + targetRect.height / 2 - 38;
  // Position tooltip to the right, leaving 16px from viewport edge
  const tooltipLeft = Math.min(
    targetRect.right - 40,
    window.innerWidth - 280 - 16,
  );

  // Spotlight on the value "₽ XX,XX" (p-3=12px + label~17px + mb-1=4px ≈ 33px offset)
  const valueRect = new DOMRect(
    targetRect.x + 10,
    targetRect.top + 32,
    Math.min(140, targetRect.width * 0.45),
    22,
  );

  return (
    <CoachOverlay targetRect={valueRect} onClick={handleDismiss}>
      <CoachTooltip text={text} top={tooltipTop} left={tooltipLeft} />
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9003] font-mono text-[var(--hi-ash)]"
        style={{ fontSize: 'var(--hi-text-micro)', letterSpacing: '0.05em' }}
      >
        нажмите для продолжения
      </div>
    </CoachOverlay>
  );
}
