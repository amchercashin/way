import { useState, useEffect } from 'react';
import type { Asset, PaymentHistory } from '@/models/types';
import { AssetPayments } from './asset-payments';
import { isSyncable, syncAssetPayments, deleteManualPayments } from '@/services/moex-sync';

const SYNCABLE_TYPES = ['Акции', 'Облигации', 'Фонды'];

interface TypeSectionProps {
  type: string;
  assets: Asset[];
  paymentsByAsset: Map<number, PaymentHistory[]>;
  highlightAssetId?: number;
}

export function TypeSection({ type, assets, paymentsByAsset, highlightAssetId }: TypeSectionProps) {
  const hasHighlight = highlightAssetId != null && assets.some(a => a.id === highlightAssetId);
  const [expanded, setExpanded] = useState(hasHighlight);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (hasHighlight) setExpanded(true);
  }, [hasHighlight]);

  const totalPayments = assets.reduce((sum, a) => sum + (paymentsByAsset.get(a.id!)?.length ?? 0), 0);
  const showSync = SYNCABLE_TYPES.includes(type);

  const allPayments = showSync
    ? assets.flatMap(a => paymentsByAsset.get(a.id!) ?? [])
    : [];
  const manualCount = allPayments.filter(p => p.dataSource === 'manual').length;
  const hasManual = manualCount > 0;
  const allMoex = allPayments.length > 0 && !hasManual;

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (syncing) return;

    if (hasManual) {
      const ok = window.confirm(`Ручные выплаты (${manualCount} шт.) будут удалены при синхронизации с MOEX. Продолжить?`);
      if (!ok) return;
    }

    setSyncing(true);
    try {
      const syncableAssets = assets.filter(isSyncable);
      for (const asset of syncableAssets) {
        if (hasManual) await deleteManualPayments(asset.id!);
        await syncAssetPayments(asset.id!);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="border border-[var(--hi-shadow)]/50 rounded-xl overflow-hidden" data-onboarding="type-section">
      <button
        onClick={() => setExpanded(!expanded)}
        data-onboarding="type-section-toggle"
        data-expanded={String(expanded)}
        className="w-full bg-[var(--hi-stone)] px-3 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-[var(--hi-text)] text-[length:var(--hi-text-body)]">{expanded ? '▾' : '▸'}</span>
          <span className="font-semibold text-[length:var(--hi-text-heading)] text-[var(--hi-text)]">{type}</span>
          {showSync && allPayments.length > 0 && (
            <span className={`text-[length:var(--hi-text-micro)] px-1 py-0.5 rounded ${
              allMoex
                ? 'bg-[#2d5a2d] text-[#6bba6b]'
                : 'bg-[#5a5a2d] text-[#baba6b]'
            }`}>
              {allMoex ? 'moex' : 'ручной'}
            </span>
          )}
          {showSync && (
            <span
              role="button"
              onClick={handleSync}
              className={`text-[var(--hi-ash)] text-[length:var(--hi-text-title)] hover:text-[var(--hi-gold)] transition-colors ml-1.5 ${syncing ? 'opacity-50' : ''}`}
              title="Синхронизировать выплаты категории с MOEX"
            >
              <span className={syncing ? 'inline-block animate-spin' : ''}>⟳</span>
            </span>
          )}
        </div>
        <span className="text-[var(--hi-ash)] text-[length:var(--hi-text-body)]">
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
