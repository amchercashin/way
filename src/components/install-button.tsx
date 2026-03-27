import { useState } from 'react';
import type { Platform } from '@/hooks/use-install-prompt';
import { IosInstallGuide } from '@/components/ios-install-guide';

interface InstallButtonProps {
  platform: Platform;
  autoLaunchGuide: boolean;
  onInstall: () => void;
  onDismiss: () => void;
  onIosSeen: () => void;
}

export function InstallButton({
  platform,
  autoLaunchGuide,
  onInstall,
  onDismiss,
  onIosSeen,
}: InstallButtonProps) {
  const [guideOpen, setGuideOpen] = useState(autoLaunchGuide);

  function handleClick() {
    if (platform === 'android') {
      onInstall();
    } else {
      setGuideOpen(true);
    }
  }

  function handleCloseGuide() {
    setGuideOpen(false);
    onIosSeen();
  }

  return (
    <>
      <div
        className="fixed left-4 right-4 z-50 flex items-center justify-between rounded-xl border border-[var(--hi-gold)]/15 bg-[var(--hi-stone)] px-4 py-3"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          animation: 'hi-fade-slide-up 0.4s ease-out both, hi-a2hs-glow 3s ease-in-out 0.4s infinite',
        }}
      >
        <button
          onClick={handleClick}
          className="flex items-center gap-2.5 min-w-0"
        >
          <span className="text-lg shrink-0">📲</span>
          <span className="text-[length:var(--hi-text-body)] text-[var(--hi-gold)] truncate">
            Установить приложение
          </span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="shrink-0 p-1 text-[var(--hi-ash)] text-[length:var(--hi-text-heading)] active:text-[var(--hi-text)] transition-colors"
          aria-label="Скрыть"
        >
          ✕
        </button>
      </div>

      {guideOpen && <IosInstallGuide onClose={handleCloseGuide} />}
    </>
  );
}
