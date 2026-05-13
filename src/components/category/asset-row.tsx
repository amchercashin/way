import { TransitionLink } from '@/components/ui/transition-link';
import type { Asset } from '@/models/types';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { CalculatedAssetStats } from '@/services/portfolio-calculator';

interface AssetRowProps {
  asset: Asset;
  stats: CalculatedAssetStats;
}

export function AssetRow({ asset, stats }: AssetRowProps) {
  const isManual = asset.paymentPerUnitSource === 'manual';

  return (
    <TransitionLink
      to={`/asset/${asset.id}`}
      className="block py-3 border-b border-[rgba(200,180,140,0.04)] transition-colors active:bg-[var(--hi-stone)]"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="text-[length:var(--hi-text-body)] font-medium text-[var(--hi-text)] truncate">{asset.name}</div>
          {(asset.ticker || asset.isin) && (
            <div className="text-[length:var(--hi-text-caption)] text-[var(--hi-muted)] mt-0.5">
              {[asset.ticker, asset.isin].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="font-mono text-[length:var(--hi-text-body)] font-medium text-[var(--hi-gold)]">{formatCurrency(stats.incomePerMonth)}</span>
            <span className={`font-mono text-[length:var(--hi-text-caption)] px-1.5 py-0.5 rounded min-w-[52px] text-center ${
              isManual
                ? 'bg-[rgba(90,85,72,0.15)] text-[var(--hi-ash)]'
                : 'bg-[rgba(200,180,140,0.1)] text-[var(--hi-gold)]'
            }`}>
              {isManual ? 'ручной' : 'факт'}
            </span>
          </div>
          {stats.yieldPercent != null && (
            <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)] text-right mt-0.5">
              {formatPercent(stats.yieldPercent)} годовых
            </div>
          )}
          <div className="font-mono text-[length:var(--hi-text-micro)] text-[var(--hi-ash)] text-right">
            после НДФЛ
          </div>
        </div>
      </div>
      <div className="font-mono text-[length:var(--hi-text-caption)] text-[var(--hi-muted)] mt-1">
        {stats.totalQuantity} шт · {formatCurrency(stats.value)}
      </div>
    </TransitionLink>
  );
}
