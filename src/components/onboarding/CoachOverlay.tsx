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
  const cx = targetRect ? targetRect.x + targetRect.width / 2 : 0;
  const cy = targetRect ? targetRect.y + targetRect.height / 2 : 0;
  const rx = targetRect ? targetRect.width / 2 + padding : 0;
  const ry = targetRect ? targetRect.height / 2 + padding : 0;

  return (
    <div
      className="fixed inset-0 z-[9000]"
      style={{
        pointerEvents: passThrough ? 'none' : 'auto',
        touchAction: 'manipulation',
      }}
      onClick={passThrough ? undefined : onClick}
    >
      {/* Warm spotlight glow on target */}
      {targetRect && (
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-300"
          style={{
            background: `radial-gradient(ellipse ${rx * 2.5}px ${ry * 2.5}px at ${cx}px ${cy}px, rgba(200,180,140,0.18) 0%, rgba(200,180,140,0.06) 40%, transparent 70%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}
