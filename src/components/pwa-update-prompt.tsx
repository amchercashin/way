import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between gap-3 rounded-lg border border-[var(--way-gold)]/20 bg-[var(--way-stone)] px-4 py-3 shadow-lg sm:left-auto sm:right-4 sm:max-w-sm">
      <p className="text-[length:var(--way-text-body)] text-[var(--way-text)]">
        Доступно обновление
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => setNeedRefresh(false)}
          className="rounded px-3 py-1.5 text-[length:var(--way-text-body)] text-[var(--way-ash)] hover:text-[var(--way-text)] transition-colors"
        >
          Позже
        </button>
        <button
          onClick={() => updateServiceWorker(true)}
          className="rounded bg-[var(--way-gold)] px-3 py-1.5 text-[length:var(--way-text-body)] font-medium text-[var(--way-void)] hover:bg-[var(--way-earth)] transition-colors"
        >
          Обновить
        </button>
      </div>
    </div>
  );
}
