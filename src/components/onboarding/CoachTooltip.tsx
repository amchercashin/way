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
      reference: targetRef?.current ?? null,
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
        tooltipRef.current = el;
        refs.setFloating(el);
      }}
      className="animate-[hi-fade-scale-in_0.2s_ease-out_both]"
      style={{
        ...(positioned ? floatingStyles : {}),
        position: 'fixed',
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
