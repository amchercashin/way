import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { HeroIncome } from '@/components/main/hero-income';
import { CategoryCard } from '@/components/main/category-card';
import { IncomeChart } from '@/components/shared/income-chart';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';

export function MainPage() {
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const { portfolio, categories } = usePortfolioStats();

  const income = mode === 'month' ? portfolio.totalIncomePerMonth : portfolio.totalIncomePerYear;

  return (
    <AppShell rightAction={<span className="text-gray-400 text-base">⟳</span>}>
      <HeroIncome
        income={income}
        yieldPercent={portfolio.yieldPercent}
        totalValue={portfolio.totalValue}
        mode={mode}
        onToggle={() => setMode((m) => (m === 'month' ? 'year' : 'month'))}
      />

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

      <IncomeChart cagr={null} />
    </AppShell>
  );
}
