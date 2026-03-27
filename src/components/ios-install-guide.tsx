import { useState, useCallback } from 'react';

interface IosInstallGuideProps {
  onClose: () => void;
}

const TOTAL_STEPS = 4;

const fingerBase: React.CSSProperties = {
  position: 'absolute',
  fontSize: 28,
  pointerEvents: 'none',
  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
};

function ListItem({ icon, label, highlight }: { icon: string; label: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${highlight ? 'bg-[#3a3a3c]' : ''}`}>
      <span className="text-[16px]">{icon}</span>
      <span className="text-[14px] text-[#e5e5e7]">{label}</span>
    </div>
  );
}

function ListDivider() {
  return <div className="h-px bg-[#38383a] ml-[44px]" />;
}

/** Step 1: Tap three-dot menu in Safari bottom bar */
function StepSafariDots() {
  return (
    <div className="relative h-[220px] bg-[#2a2520] rounded-xl overflow-hidden border border-[rgba(200,180,140,0.08)]">
      {/* Safari address bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1c1b18]">
        <div className="flex-1 bg-[#2a2824] rounded-lg px-3 py-1.5 text-[10px] text-[#8e8e93] font-mono truncate">
          heroincome.github.io/heroincome
        </div>
      </div>

      {/* Page content placeholder */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-[10px] text-[#5a5548] text-center w-full mt-6">
          Содержимое страницы
        </div>
      </div>

      {/* Safari bottom toolbar */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#1c1b18] border-t border-[#38383a] px-2 py-2">
        <div className="flex justify-around items-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#48484a" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="14" height="14" rx="2"/></svg>
          <div className="relative">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#0a84ff">
              <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
            </svg>
            <span
              className="animate-[a2hs-tap_2s_ease-in-out_infinite]"
              style={{ ...fingerBase, bottom: -36, left: -4 }}
            >
              👆
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Step 2: Tap "Поделиться..." in the context menu */
function StepShareButton() {
  return (
    <div className="relative h-[220px] bg-[#2a2520] rounded-xl overflow-hidden border border-[rgba(200,180,140,0.08)]">
      <div className="mt-4 mx-3">
        <div className="bg-[#2c2c2e] rounded-xl overflow-hidden">
          <ListItem icon="📋" label="Скопировать" />
          <ListDivider />
          <ListItem icon="🔖" label="Добавить закладку" />
          <ListDivider />
          <ListItem icon="📄" label="Добавить в список для чтения" />
          <ListDivider />
          <div className="relative">
            <ListItem icon="📤" label="Поделиться…" highlight />
            <span
              className="animate-[a2hs-tap_2s_ease-in-out_infinite]"
              style={{ ...fingerBase, top: 4, right: 24 }}
            >
              👆
            </span>
          </div>
          <ListDivider />
          <ListItem icon="⊘" label="Скрыть IP-адрес" />
        </div>
      </div>
    </div>
  );
}

/** Step 3: Tap "На экран Домой" in the share sheet */
function StepAddToHome() {
  return (
    <div className="relative h-[220px] bg-[#2a2520] rounded-xl overflow-hidden border border-[rgba(200,180,140,0.08)]">
      <div className="mt-3 mx-3">
        <div className="bg-[#2c2c2e] rounded-t-xl px-4 py-2.5 flex items-center justify-between border-b border-[#38383a]">
          <span className="text-[11px] text-[#8e8e93]">heroincome.github.io</span>
        </div>
        <div className="bg-[#2c2c2e] rounded-b-xl overflow-hidden">
          <ListItem icon="📋" label="Скопировать" />
          <ListDivider />
          <ListItem icon="🖨" label="Напечатать" />
          <ListDivider />
          <div className="relative">
            <ListItem icon="➕" label={'На экран «Домой»'} highlight />
            <span
              className="animate-[a2hs-tap_2s_ease-in-out_0.6s_infinite]"
              style={{ ...fingerBase, top: 2, right: 24 }}
            >
              👆
            </span>
          </div>
          <ListDivider />
          <ListItem icon="📑" label="Добавить закладку" />
        </div>
      </div>
    </div>
  );
}

/** Step 4: Tap "Добавить" in the confirmation dialog */
function StepConfirmAdd() {
  return (
    <div className="relative h-[220px] bg-[#2a2520] rounded-xl overflow-hidden border border-[rgba(200,180,140,0.08)]">
      <div className="mt-3 mx-3">
        <div className="bg-[#2c2c2e] rounded-t-xl px-4 py-2.5 flex items-center justify-between border-b border-[#38383a]">
          <span className="text-[14px] text-[#0a84ff]">Отменить</span>
          <span className="text-[14px] text-[#e5e5e7] font-medium">{'На экран «Домой»'}</span>
          <div className="relative">
            <span className="text-[14px] text-[#0a84ff] font-semibold">Добавить</span>
            <span
              className="animate-[a2hs-tap_2s_ease-in-out_infinite]"
              style={{ ...fingerBase, top: -8, right: -32 }}
            >
              👆
            </span>
          </div>
        </div>
        <div className="bg-[#2c2c2e] rounded-b-xl p-4 flex items-center gap-3">
          <div className="w-[52px] h-[52px] rounded-xl bg-[#0c0b09] border border-[#38383a] flex items-center justify-center text-[16px] font-bold text-[#c8b48c] shrink-0">
            HI!
          </div>
          <div className="min-w-0">
            <div className="bg-[#3a3a3c] rounded-md px-2 py-1 text-[14px] text-[#e5e5e7]">HeroIncome</div>
            <div className="text-[12px] text-[#8e8e93] mt-1 truncate">heroincome.github.io</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [StepSafariDots, StepShareButton, StepAddToHome, StepConfirmAdd];

const CAPTIONS = [
  'Нажмите «⋯» в панели Safari',
  'Нажмите «Поделиться…»',
  'Выберите «На экран Домой»',
  'Нажмите «Добавить»',
];

export function IosInstallGuide({ onClose }: IosInstallGuideProps) {
  const [step, setStep] = useState(0);

  const advance = useCallback(() => {
    if (step >= TOTAL_STEPS - 1) {
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, onClose]);

  const StepComponent = STEPS[step];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9000] bg-black/60 animate-[hi-fade-in_0.2s_ease-out_both]"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[9001] bg-[var(--hi-stone)] rounded-t-2xl animate-[hi-fade-slide-up_0.3s_ease-out_both]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        onClick={advance}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-9 h-1 rounded-full bg-[var(--hi-shadow)]" />
        </div>

        {/* Step indicator */}
        <div className="text-center mb-4">
          <span className="font-mono text-[length:var(--hi-text-micro)] text-[var(--hi-ash)]">
            {step + 1} / {TOTAL_STEPS}
          </span>
        </div>

        {/* Animation area */}
        <div className="px-4 mb-4">
          <StepComponent />
        </div>

        {/* Caption */}
        <div className="text-center px-4">
          <div className="text-[length:var(--hi-text-body)] text-[var(--hi-gold)] font-medium">
            {CAPTIONS[step]}
          </div>
          <div className="text-[length:var(--hi-text-micro)] text-[var(--hi-ash)] mt-2">
            Нажмите, чтобы продолжить
          </div>
        </div>
      </div>
    </>
  );
}
