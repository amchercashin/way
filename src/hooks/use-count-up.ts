import { useState, useEffect, useRef } from 'react';

export function useCountUp(target: number | null, duration = 1200): number | null {
  const [current, setCurrent] = useState<number | null>(null);
  const prevTarget = useRef<number | null>(null);

  useEffect(() => {
    if (target == null) {
      setCurrent(null);
      prevTarget.current = null;
      return;
    }

    if (target === prevTarget.current) return;
    prevTarget.current = target;

    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCurrent(Math.round(eased * target!));
      if (t < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return current;
}
