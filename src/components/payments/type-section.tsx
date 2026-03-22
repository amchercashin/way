import { useState, useEffect } from 'react';
import type { Asset, PaymentHistory } from '@/models/types';
import { AssetPayments } from './asset-payments';

interface TypeSectionProps {
  type: string;
  assets: Asset[];
  paymentsByAsset: Map<number, PaymentHistory[]>;
  highlightAssetId?: number;
}

export function TypeSection({ type, assets, paymentsByAsset, highlightAssetId }: TypeSectionProps) {
  const hasHighlight = highlightAssetId != null && assets.some(a => a.id === highlightAssetId);
  const [expanded, setExpanded] = useState(hasHighlight);

  useEffect(() => {
    if (hasHighlight) setExpanded(true);
  }, [hasHighlight]);

  const totalPayments = assets.reduce((sum, a) => sum + (paymentsByAsset.get(a.id!)?.length ?? 0), 0);

  return (
    <div className="border border-[var(--way-shadow)]/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-[var(--way-stone)] px-3 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-[var(--way-text)] text-[length:var(--way-text-body)]">{expanded ? '▾' : '▸'}</span>
          <span className="font-semibold text-[length:var(--way-text-heading)] text-[var(--way-text)]">{type}</span>
        </div>
        <span className="text-[var(--way-ash)] text-[length:var(--way-text-body)]">
          {assets.length} {assets.length === 1 ? 'актив' : 'активов'} · {totalPayments} выплат
        </span>
      </button>

      {expanded && (
        <div>
          {assets.map((asset) => (
            <AssetPayments
              key={asset.id}
              asset={asset}
              payments={paymentsByAsset.get(asset.id!) ?? []}
              isHighlighted={highlightAssetId === asset.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
