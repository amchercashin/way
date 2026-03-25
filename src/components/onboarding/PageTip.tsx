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
