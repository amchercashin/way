interface CoachTooltipProps {
  text: string;
  /** Optional secondary line (smaller text) */
  subtitle?: string;
  stepIndex?: number;
  totalSteps?: number;
  /** Override vertical position (px from top). Default: vertically centered. */
  top?: number;
  /** Override horizontal position (px from left). Tooltip left edge starts here. */
  left?: number;
}

export function CoachTooltip({
  text,
  subtitle,
  stepIndex,
  totalSteps,
  top,
  left,
}: CoachTooltipProps) {
  const centered = left == null;
  return (
    <div
      className={`fixed z-[9002] animate-[hi-fade-scale-in_0.2s_ease-out_both] rounded-lg bg-[#2a2520] border border-[rgba(200,180,140,0.25)] pointer-events-none shadow-[0_0_24px_rgba(200,180,140,0.12)] ${centered ? 'inset-x-0 mx-auto' : ''}`}
      style={{
        width: 'min(280px, calc(100vw - 32px))',
        ...(top != null
          ? { top: `${top}px` }
          : { top: 0, bottom: 0, marginBlock: 'auto', height: 'fit-content' }),
        ...(left != null && { left: `${left}px` }),
      }}
    >
      <div className="p-4">
        <div
          className="text-[#e0d5c5] font-sans leading-relaxed"
          style={{ fontSize: 'var(--hi-text-body)' }}
        >
          {text}
        </div>
        {subtitle && (
          <div
            className="mt-1 text-[#a09080] italic"
            style={{ fontSize: 'var(--hi-text-caption)' }}
          >
            {subtitle}
          </div>
        )}
        {stepIndex != null && totalSteps != null && (
          <div
            className="mt-2 font-mono text-[#a09080]"
            style={{ fontSize: 'var(--hi-text-micro)' }}
          >
            {stepIndex} / {totalSteps}
          </div>
        )}
      </div>
    </div>
  );
}
