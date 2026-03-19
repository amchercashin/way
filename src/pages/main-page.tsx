import { useState, useEffect, useRef } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { HeroIncome } from '@/components/main/hero-income';
import { CategoryCard } from '@/components/main/category-card';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { useMoexSync } from '@/hooks/use-moex-sync';
import { getAppSettings } from '@/services/app-settings';

function formatSyncTime(date: Date): string {
  const d = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const t = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${d}, ${t}`;
}

export function MainPage() {
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const { portfolio, categories } = usePortfolioStats();
  const { syncing, lastSyncAt, error, sync } = useMoexSync();
  const autoSyncDone = useRef(false);
  useEffect(() => {
    if (autoSyncDone.current) return;
    autoSyncDone.current = true;
    getAppSettings().then((s) => {
      if (s.autoMoexSync) sync();
    });
  }, []);

  useEffect(() => {
    getAppSettings().then((s) => setMode(s.defaultPeriod));
  }, []);

  const income =
    mode === 'month'
      ? portfolio.totalIncomePerMonth
      : portfolio.totalIncomePerYear;

  const refreshButton = (
    <button
      onClick={() => sync()}
      disabled={syncing}
      className="text-[var(--way-ash)] text-base disabled:opacity-50"
      aria-label="Обновить данные MOEX"
    >
      <span className={syncing ? 'inline-block animate-spin' : ''}>⟳</span>
    </button>
  );

  return (
    <AppShell rightAction={refreshButton}>
      <HeroIncome
        income={income}
        yieldPercent={portfolio.yieldPercent}
        totalValue={portfolio.totalValue}
        mode={mode}
        onToggle={() => setMode((m) => (m === 'month' ? 'year' : 'month'))}
      />

      {lastSyncAt && (
        <div className="text-center text-[var(--way-muted)] text-[10px] -mt-2 mb-2">
          MOEX: {formatSyncTime(lastSyncAt)}
        </div>
      )}

      {error && (
        <div className="text-center text-[var(--destructive)] text-[10px] mb-2">{error}</div>
      )}

      <div className="mt-4">
        {categories.length === 0 && (
          <div className="text-center text-[var(--way-muted)] text-sm py-12">
            Пока нет активов. Добавьте первый актив через меню ☰
          </div>
        )}
        {categories.map((cat, i) => (
          <div key={cat.type} style={{ animation: `way-fade-slide-right 0.5s ease-out ${0.7 + i * 0.15}s both` }}>
            <CategoryCard
              type={cat.type}
              assetCount={cat.assetCount}
              incomePerMonth={cat.totalIncomePerMonth}
              portfolioSharePercent={cat.portfolioSharePercent}
            />
          </div>
        ))}
      </div>

    </AppShell>
  );
}
