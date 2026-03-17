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
      className="block bg-[#1a1a2e] rounded-xl p-3 mb-1.5 active:bg-[#222244] transition-colors"
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="text-sm font-semibold text-white">{asset.ticker ?? asset.name}</span>
          {asset.ticker && (
            <span className="text-xs text-gray-600 ml-2">{asset.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[#4ecca3]">{formatCurrency(incomePerMonth)}</span>
          <span className={`text-[9px] px-1 py-0.5 rounded font-semibold ${
            isManual
              ? 'bg-[#431407] text-[#fb923c]'
              : 'bg-[#14532d] text-[#4ade80]'
          }`}>
            {isManual ? 'р' : 'ф'}
          </span>
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-gray-600 mt-1">
        <span>
          {asset.quantity} шт · {formatCurrency(value)}
        </span>
        <span>
          <span className="bg-[#e9c46a22] text-[#e9c46a] px-1.5 py-0.5 rounded text-[10px]">
            {formatFrequency(asset.frequencyPerYear)}
          </span>
          {' '}
          {formatCurrency(incomePerYear)}/год
        </span>
      </div>
    </Link>
  );
}
