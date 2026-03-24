import { TransitionLink } from '@/components/ui/transition-link';
import type { Asset } from '@/models/types';
import { formatCurrency } from '@/lib/utils';
import { calcAssetIncomePerMonth } from '@/services/income-calculator';

interface AssetRowProps {
  asset: Asset;
  annualIncome: number;
  totalQuantity: number;
}

export function AssetRow({ asset, annualIncome, totalQuantity }: AssetRowProps) {
  const incomePerMonth = calcAssetIncomePerMonth(totalQuantity, annualIncome);
  const value = asset.currentPrice != null
    ? asset.currentPrice * totalQuantity
    : null;

  const isManual = asset.paymentPerUnitSource === 'manual';

  return (
    <TransitionLink
      to={`/asset/${asset.id}`}
      className="block py-3 border-b border-[rgba(200,180,140,0.04)] transition-colors active:bg-[var(--way-stone)]"
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[length:var(--way-text-body)] font-medium text-[var(--way-text)]">{asset.name}</div>
          {(asset.ticker || asset.isin) && (
            <div className="text-[length:var(--way-text-caption)] text-[var(--way-muted)] mt-0.5">
              {[asset.ticker, asset.isin].filter(Boolean).join(' · ')}
            </div>
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
      <div className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)] mt-1">
        {totalQuantity} шт · {formatCurrency(value)}
      </div>
    </TransitionLink>
  );
}
