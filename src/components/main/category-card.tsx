import { TransitionLink } from '@/components/ui/transition-link';
import { getTypeColor } from '@/models/account';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface CategoryCardProps {
  type: string;
  assetCount: number;
  incomePerMonth: number | null;
  portfolioSharePercent: number;
}

export function CategoryCard({ type, assetCount, incomePerMonth, portfolioSharePercent }: CategoryCardProps) {
  const color = getTypeColor(type);

  return (
    <TransitionLink
      to={`/category/${encodeURIComponent(type)}`}
      className="flex items-center justify-between py-3 border-b border-[rgba(200,180,140,0.04)] transition-colors active:bg-[var(--way-stone)]"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-[3px] h-[22px] rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
        <div>
          <div className="text-[length:var(--way-text-heading)] text-[var(--way-text)]">{type}</div>
          <div className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)]">
            {assetCount} {assetCount === 1 ? 'позиция' : assetCount < 5 ? 'позиции' : 'позиций'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="font-mono text-[length:var(--way-text-body)] font-medium text-[var(--way-gold)]">{formatCurrency(incomePerMonth)}</div>
          <div className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)]">{formatPercent(portfolioSharePercent)}</div>
        </div>
        <span className="text-[var(--way-shadow)]">›</span>
      </div>
    </TransitionLink>
  );
}
