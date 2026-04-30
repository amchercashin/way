import { useState, useEffect, useRef } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { HeroIncome } from '@/components/main/hero-income';
import { CategoryCard } from '@/components/main/category-card';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { useSyncContext } from '@/contexts/sync-context';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { InstallButton } from '@/components/install-button';

let hasVisitedMainPage = false;

export function MainPage() {
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const { portfolio, categories, isLoading } = usePortfolioStats();
  const { syncing, lastSyncAt, error, triggerSync } = useSyncContext();
  const animate = useRef(!hasVisitedMainPage).current;
  const install = useInstallPrompt();

  useEffect(() => { hasVisitedMainPage = true; }, []);

  const income =
    mode === 'month'
      ? portfolio.totalIncomePerMonth
      : portfolio.totalIncomePerYear;

  return (
    <AppShell>
      <HeroIncome
        income={income}
        yieldPercent={portfolio.yieldPercent}
        totalValue={portfolio.totalValue}
        mode={mode}
        onToggle={() => setMode((m) => (m === 'month' ? 'year' : 'month'))}
        onSync={() => triggerSync()}
        syncing={syncing}
        lastSyncAt={lastSyncAt}
        animate={animate}
      />

      {error && (
        <div className="text-center text-[var(--destructive)] text-[length:var(--hi-text-micro)] mb-2">{error}</div>
      )}

      <div className="mt-4">
        {!isLoading && categories.length === 0 && (
          <div className="text-center text-[var(--hi-muted)] text-[length:var(--hi-text-body)] py-12">
            Пока нет активов. Добавьте первый актив через меню ☰
          </div>
        )}
        {categories.map((cat, i) => (
          <div key={cat.type} style={animate ? { animation: `hi-fade-slide-right 0.5s ease-out ${0.7 + i * 0.15}s both` } : undefined}>
            <CategoryCard
              type={cat.type}
              assetCount={cat.assetCount}
              income={mode === 'month' ? cat.totalIncomePerMonth : cat.totalIncomePerYear}
              yieldPercent={cat.yieldPercent}
            />
          </div>
        ))}
      </div>

      {install.showButton && (
        <InstallButton
          platform={install.platform}
          autoLaunchGuide={install.autoLaunchGuide}
          onInstall={install.promptInstall}
          onDismiss={install.dismiss}
          onIosSeen={install.markIosSeen}
        />
      )}
    </AppShell>
  );
}
