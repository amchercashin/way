import { TransitionLink } from '@/components/ui/transition-link';
import { getTypeColor } from '@/models/account';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface CategoryCardProps {
  type: string;
  assetCount: number;
  income: number | null;
  yieldPercent: number;
}

export function CategoryCard({ type, assetCount, income, yieldPercent }: CategoryCardProps) {
  const color = getTypeColor(type);

  return (
    <TransitionLink
      to={`/category/${encodeURIComponent(type)}`}
      className="flex items-center justify-between py-3 border-b border-[rgba(200,180,140,0.04)] transition-colors active:bg-[var(--hi-stone)]"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-[3px] h-[22px] rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
        <div>
          <div className="text-[length:var(--hi-text-heading)] text-[var(--hi-text)]">{type}</div>
          <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)]">
            {assetCount} {assetCount === 1 ? 'позиция' : assetCount < 5 ? 'позиции' : 'позиций'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="font-mono text-[length:var(--hi-text-body)] font-medium text-[var(--hi-gold)]">{formatCurrency(income)}</div>
          <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)]">{formatPercent(yieldPercent)}</div>
          <div className="font-mono text-[length:var(--hi-text-micro)] text-[var(--hi-ash)]">после НДФЛ</div>
        </div>
        <span className="text-[var(--hi-shadow)]">›</span>
      </div>
    </TransitionLink>
  );
}
