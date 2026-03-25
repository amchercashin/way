// Static replica of the main page with sample data — used in onboarding step 1.
// No hooks, no interactivity, no data fetching — pure presentational.

export function MockMainPage() {
  // Pre-formatted values matching the real formatters:
  // formatCurrencyFull(42380) → "₽ 42 380" (ru-RU locale uses non-breaking space)
  // formatPercent(8.2) → "8.2%"
  // formatCurrency(516400) → "₽ 516K"
  // formatCurrency(31200) → "₽ 31K"
  // formatCurrency(11180) → "₽ 11K"
  // formatPercent(6.0) → "6.0%"
  // formatPercent(4.3) → "4.3%"
  //
  // Color tokens:
  // Акции → #c8b48c
  // Облигации → #8b7355

  return (
    <div className="h-[100vh] h-[100dvh] flex flex-col overflow-hidden bg-[var(--hi-void)] text-[var(--hi-text)]">
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-5 pb-2"
        style={{ paddingTop: 'max(38px, env(safe-area-inset-top))' }}
      >
        <div>
          <button
            className="text-[var(--hi-ash)] text-[length:var(--hi-text-nav)] min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Открыть меню"
          >
            ☰
          </button>
        </div>
        {/* no title in center */}
        <div>
          <div className="w-5" />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none px-5 pb-8">
        {/* HeroIncome */}
        <div className="text-center mb-4">
          {/* Big number */}
          <div className="font-serif text-[length:var(--hi-text-display)] font-light text-[var(--hi-gold)] tracking-tight">
            ₽&nbsp;42&nbsp;380
          </div>

          {/* Label */}
          <div className="font-mono text-[length:var(--hi-text-caption)] uppercase tracking-[0.3em] text-[var(--hi-ash)] mt-1">
            расчётный пассивный доход
          </div>

          {/* Meta line */}
          <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)] mt-0.5 flex items-center justify-center gap-1.5">
            <span>доходность 8.2% · портфель ₽ 516K</span>
            <span className="text-[var(--hi-ash)] text-[length:var(--hi-text-caption)]">⟳</span>
          </div>

          {/* МЕС/ГОД toggle — ГОД active */}
          <div>
            <div className="mt-3 inline-flex border border-[rgba(200,180,140,0.12)] rounded overflow-hidden">
              <span className="px-4 py-2 font-mono text-[length:var(--hi-text-caption)] tracking-[0.15em] transition-colors text-[var(--hi-ash)]">
                МЕС
              </span>
              <span className="px-4 py-2 font-mono text-[length:var(--hi-text-caption)] tracking-[0.15em] transition-colors bg-[rgba(200,180,140,0.08)] text-[var(--hi-gold)]">
                ГОД
              </span>
            </div>
          </div>
        </div>

        {/* Category cards */}
        <div className="mt-4">
          {/* Акции */}
          <div className="flex items-center justify-between py-3 border-b border-[rgba(200,180,140,0.04)]">
            <div className="flex items-center gap-2.5">
              <div className="w-[3px] h-[22px] rounded-sm flex-shrink-0" style={{ backgroundColor: '#c8b48c' }} />
              <div>
                <div className="text-[length:var(--hi-text-heading)] text-[var(--hi-text)]">Акции</div>
                <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)]">3 позиции</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="font-mono text-[length:var(--hi-text-body)] font-medium text-[var(--hi-gold)]">₽ 31K</div>
                <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)]">6.0%</div>
              </div>
              <span className="text-[var(--hi-shadow)]">›</span>
            </div>
          </div>

          {/* Облигации */}
          <div className="flex items-center justify-between py-3 border-b border-[rgba(200,180,140,0.04)]">
            <div className="flex items-center gap-2.5">
              <div className="w-[3px] h-[22px] rounded-sm flex-shrink-0" style={{ backgroundColor: '#8b7355' }} />
              <div>
                <div className="text-[length:var(--hi-text-heading)] text-[var(--hi-text)]">Облигации</div>
                <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)]">5 позиций</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="font-mono text-[length:var(--hi-text-body)] font-medium text-[var(--hi-gold)]">₽ 11K</div>
                <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)]">4.3%</div>
              </div>
              <span className="text-[var(--hi-shadow)]">›</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
