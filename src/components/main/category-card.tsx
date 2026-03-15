import { Link } from 'react-router-dom';
import type { AssetType } from '@/models/types';
import { ASSET_TYPE_LABELS, ASSET_TYPE_COLORS } from '@/models/types';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface CategoryCardProps {
  type: AssetType;
  assetCount: number;
  incomePerMonth: number;
  portfolioSharePercent: number;
}

export function CategoryCard({ type, assetCount, incomePerMonth, portfolioSharePercent }: CategoryCardProps) {
  const color = ASSET_TYPE_COLORS[type];
  const label = ASSET_TYPE_LABELS[type];

  return (
    <Link
      to={`/category/${type}`}
      className="flex items-center justify-between bg-[#1a1a2e] rounded-xl p-3.5 mb-2 active:bg-[#222244] transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <div>
          <div className="text-sm font-medium text-white">{label}</div>
          <div className="text-[11px] text-gray-600">
            {assetCount} {assetCount === 1 ? 'позиция' : assetCount < 5 ? 'позиции' : 'позиций'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-sm font-semibold text-[#4ecca3]">{formatCurrency(incomePerMonth)}</div>
          <div className="text-[11px] text-gray-600">{formatPercent(portfolioSharePercent)}</div>
        </div>
        <span className="text-gray-700">›</span>
      </div>
    </Link>
  );
}
