import { TransitionLink } from '@/components/ui/transition-link';
import type { Asset } from '@/models/types';
import { formatCurrency, formatFrequency } from '@/lib/utils';
import { calcAssetIncomePerMonth } from '@/services/income-calculator';

interface AssetRowProps {
  asset: Asset;
  paymentPerUnit: number;
  totalQuantity: number;
}

export function AssetRow({ asset, paymentPerUnit, totalQuantity }: AssetRowProps) {
  const incomePerMonth = calcAssetIncomePerMonth(
    totalQuantity,
    paymentPerUnit,
    asset.frequencyPerYear,
  );
  const incomePerYear = incomePerMonth * 12;
  const value = asset.currentPrice != null
    ? asset.currentPrice * totalQuantity
    : null;

  const isManual =
    asset.paymentPerUnitSource === 'manual' ||
    asset.frequencySource === 'manual';

  return (
    <TransitionLink
      to={`/asset/${asset.id}`}
      className="block py-3 border-b border-[rgba(200,180,140,0.04)] transition-colors active:bg-[var(--way-stone)]"
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="text-[length:var(--way-text-heading)] font-medium text-[var(--way-text)]">{asset.ticker ?? asset.name}</span>
          {asset.ticker && (
            <span className="text-[length:var(--way-text-body)] text-[var(--way-muted)] ml-2">{asset.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[length:var(--way-text-body)] font-medium text-[var(--way-gold)]">{formatCurrency(incomePerMonth)}</span>
          <span className={`font-mono text-[length:var(--way-text-caption)] px-1.5 py-0.5 rounded ${
            isManual
              ? 'bg-[rgba(90,85,72,0.15)] text-[var(--way-ash)]'
              : 'bg-[rgba(200,180,140,0.1)] text-[var(--way-gold)]'
          }`}>
            {isManual ? 'ручной' : 'факт'}
          </span>
        </div>
      </div>
      <div className="flex justify-between font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)] mt-1">
        <span>{totalQuantity} шт · {formatCurrency(value)}</span>
        <span>
          <span className="bg-[rgba(139,115,85,0.12)] text-[var(--way-earth)] px-1.5 py-0.5 rounded text-[length:var(--way-text-caption)]">
            {formatFrequency(asset.frequencyPerYear)}
          </span>
          {' '}
          <span className="text-[length:var(--way-text-caption)]">{formatCurrency(incomePerYear)}/год</span>
        </span>
      </div>
    </TransitionLink>
  );
}
