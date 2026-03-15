import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { HeroIncome } from '@/components/main/hero-income';
import { CategoryCard } from '@/components/main/category-card';
import { IncomeChart } from '@/components/shared/income-chart';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { useMoexSync } from '@/hooks/use-moex-sync';

function formatSyncTime(date: Date): string {
  const d = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const t = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${d}, ${t}`;
}

export function MainPage() {
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const { portfolio, categories } = usePortfolioStats();
  const { syncing, lastSyncAt, error, sync } = useMoexSync();

  const income =
    mode === 'month'
      ? portfolio.totalIncomePerMonth
      : portfolio.totalIncomePerYear;

  const refreshButton = (
    <button
      onClick={() => sync()}
      disabled={syncing}
      className="text-gray-400 text-base disabled:opacity-50"
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
        <div className="text-center text-gray-600 text-[10px] -mt-2 mb-2">
          MOEX: {formatSyncTime(lastSyncAt)}
        </div>
      )}

      {error && (
        <div className="text-center text-red-400 text-[10px] mb-2">{error}</div>
      )}

      <div className="mt-4">
        {categories.length === 0 && (
          <div className="text-center text-gray-600 text-sm py-12">
            Пока нет активов. Добавьте первый актив через меню ☰
          </div>
        )}
        {categories.map((cat) => (
          <CategoryCard
            key={cat.type}
            type={cat.type}
            assetCount={cat.assetCount}
            incomePerMonth={cat.totalIncomePerMonth}
            portfolioSharePercent={cat.portfolioSharePercent}
          />
        ))}
      </div>

      <IncomeChart
        categories={categories.map((cat) => ({
          type: cat.type,
          incomePerMonth: cat.totalIncomePerMonth,
        }))}
        cagr={null}
      />
    </AppShell>
  );
}
