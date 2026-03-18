import { Link } from 'react-router-dom';
import type { AssetType } from '@/models/types';
import { ASSET_TYPE_LABELS, ASSET_TYPE_COLORS } from '@/models/types';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface CategoryCardProps {
  type: AssetType;
  assetCount: number;
  incomePerMonth: number | null;
  portfolioSharePercent: number;
}

export function CategoryCard({ type, assetCount, incomePerMonth, portfolioSharePercent }: CategoryCardProps) {
  const color = ASSET_TYPE_COLORS[type];
  const label = ASSET_TYPE_LABELS[type];

  return (
    <Link
      to={`/category/${type}`}
      className="flex items-center justify-between py-3 border-b border-[rgba(200,180,140,0.04)] transition-colors active:bg-[var(--way-stone)]"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-[3px] h-[22px] rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
        <div>
          <div className="text-[13px] text-[var(--way-text)]">{label}</div>
          <div className="font-mono text-[9px] text-[var(--way-muted)]">
            {assetCount} {assetCount === 1 ? 'позиция' : assetCount < 5 ? 'позиции' : 'позиций'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="font-mono text-[12px] font-medium text-[var(--way-gold)]">{formatCurrency(incomePerMonth)}</div>
          <div className="font-mono text-[9px] text-[var(--way-muted)]">{formatPercent(portfolioSharePercent)}</div>
        </div>
        <span className="text-[var(--way-shadow)]">›</span>
      </div>
    </Link>
  );
}
