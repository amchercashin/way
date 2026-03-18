import { Link } from 'react-router-dom';
import type { Asset } from '@/models/types';
import { formatCurrency, formatFrequency } from '@/lib/utils';
import { calcAssetIncomePerMonth } from '@/services/income-calculator';

interface AssetRowProps {
  asset: Asset;
  paymentPerUnit: number;
}

export function AssetRow({ asset, paymentPerUnit }: AssetRowProps) {
  const incomePerMonth = calcAssetIncomePerMonth(
    asset.quantity,
    paymentPerUnit,
    asset.frequencyPerYear,
  );
  const incomePerYear = incomePerMonth * 12;
  const value = (asset.currentPrice ?? asset.averagePrice) != null
    ? (asset.currentPrice ?? asset.averagePrice)! * asset.quantity
    : null;

  const isManual =
    asset.paymentPerUnitSource === 'manual' ||
    asset.quantitySource === 'manual' ||
    asset.frequencySource === 'manual';

  return (
    <Link
      to={`/asset/${asset.id}`}
      className="block py-3 border-b border-[rgba(200,180,140,0.04)] transition-colors active:bg-[var(--way-stone)]"
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="text-[13px] font-medium text-[var(--way-text)]">{asset.ticker ?? asset.name}</span>
          {asset.ticker && (
            <span className="text-[11px] text-[var(--way-muted)] ml-2">{asset.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[12px] font-medium text-[var(--way-gold)]">{formatCurrency(incomePerMonth)}</span>
          <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded ${
            isManual
              ? 'bg-[rgba(90,85,72,0.15)] text-[var(--way-ash)]'
              : 'bg-[rgba(200,180,140,0.1)] text-[var(--way-gold)]'
          }`}>
            {isManual ? 'ручной' : 'факт'}
          </span>
        </div>
      </div>
      <div className="flex justify-between font-mono text-[9px] text-[var(--way-muted)] mt-1">
        <span>{asset.quantity} шт · {formatCurrency(value)}</span>
        <span>
          <span className="bg-[rgba(139,115,85,0.12)] text-[var(--way-earth)] px-1.5 py-0.5 rounded text-[9px]">
            {formatFrequency(asset.frequencyPerYear)}
          </span>
          {' '}
          {formatCurrency(incomePerYear)}/год
        </span>
      </div>
    </Link>
  );
}
