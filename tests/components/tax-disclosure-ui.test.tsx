import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroIncome } from '@/components/main/hero-income';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { AddPaymentForm } from '@/components/payments/add-payment-form';
import { NdflSettings } from '@/components/settings/ndfl-settings';
import { clearAllData } from '@/services/app-settings';
import { db } from '@/db/database';
import { createAssetDraft } from '@/services/asset-factory';

describe('tax disclosure UI', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it('marks the main income as shown after NDFL', () => {
    render(
      <HeroIncome
        income={12000}
        yieldPercent={8.2}
        totalValue={500000}
        mode="month"
        onToggle={vi.fn()}
        onSync={vi.fn()}
        syncing={false}
        lastSyncAt={null}
        animate={false}
      />,
    );

    expect(screen.getByText('расчётный пассивный доход')).toBeInTheDocument();
    expect(screen.getByText('после НДФЛ')).toBeInTheDocument();
  });

  it('marks the income stat block as shown after NDFL', () => {
    render(
      <StatBlocks
        incomePerMonth={12000}
        totalValue={500000}
        yieldPercent={8.2}
        portfolioSharePercent={40}
        isManualIncome={false}
      />,
    );

    expect(screen.getByText('Доход/мес')).toBeInTheDocument();
    expect(screen.getByText('после НДФЛ')).toBeInTheDocument();
    expect(screen.getByText('факт')).toBeInTheDocument();
  });

  it('asks for manual payment amounts before NDFL', () => {
    render(
      <AddPaymentForm
        assetId={1}
        paymentType="dividend"
        currency="RUB"
        onAdd={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('До НДФЛ')).toHaveAccessibleName('Сумма выплаты до НДФЛ, RUB');
  });

  it('explains in settings that payments are stored before tax and income is shown after tax', async () => {
    await db.assets.add(createAssetDraft({
      type: 'Акции',
      name: 'Сбер',
      dataSource: 'manual',
    }));

    render(<NdflSettings />);

    expect(await screen.findByText('НДФЛ с дохода')).toBeInTheDocument();
    expect(screen.getByText('Выплаты хранятся до налога. Доход и доходность считаются после применения ставки.')).toBeInTheDocument();
  });
});
