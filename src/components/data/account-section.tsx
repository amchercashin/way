import { useState } from 'react';
import type { Account, Holding } from '@/models/account';
import type { Asset } from '@/models/types';
import { formatCurrency } from '@/lib/utils';
import { updateHolding } from '@/hooks/use-holdings';
import { updateAsset } from '@/hooks/use-assets';
import { updateAccount } from '@/hooks/use-accounts';
import { InlineCell } from './inline-cell';
import { TypeCombobox } from './type-combobox';
import { AddAssetSheet } from './add-asset-sheet';

interface AccountSectionProps {
  account: Account;
  holdings: Holding[];
  assets: Asset[];
}

export function AccountSection({ account, holdings, assets }: AccountSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [addAssetOpen, setAddAssetOpen] = useState(false);

  // Compute total value
  const totalValue = holdings.reduce((sum, h) => {
    const asset = assets.find(a => a.id === h.assetId);
    const price = asset?.currentPrice ?? h.averagePrice ?? 0;
    return sum + price * h.quantity;
  }, 0);

  // Derive status: "импорт" if all holdings from import, "ручной" if any manual
  const hasManual = holdings.some(h => h.quantitySource === 'manual');
  const statusLabel = holdings.length === 0 ? null : hasManual ? 'ручной' : 'импорт';
  const statusColor = hasManual
    ? 'bg-[#5a5a2d] text-[#baba6b]'
    : 'bg-[#2d5a2d] text-[#6bba6b]';

  // Collect all unique types for combobox suggestions
  const allTypes = [...new Set(assets.map(a => a.type))];

  // Group holdings by asset type
  const typeGroups = new Map<string, { asset: Asset; holding: Holding }[]>();
  for (const h of holdings) {
    const asset = assets.find(a => a.id === h.assetId);
    if (!asset) continue;
    const group = typeGroups.get(asset.type) ?? [];
    group.push({ asset, holding: h });
    typeGroups.set(asset.type, group);
  }

  return (
    <div className="border border-[var(--way-shadow)]/50 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-[var(--way-stone)] px-3 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[var(--way-text)] text-xs flex-shrink-0">{expanded ? '▾' : '▸'}</span>
          <span
            className="font-semibold text-[15px] text-[var(--way-text)] truncate"
            onClick={(e) => e.stopPropagation()}
          >
            <InlineCell
              value={account.name}
              onSave={(v) => account.id != null && updateAccount(account.id, { name: v })}
            />
          </span>
          {statusLabel && (
            <span className={`${statusColor} px-1.5 py-0.5 rounded text-[10px] flex-shrink-0`}>
              {statusLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-[var(--way-ash)] text-[13px]">{formatCurrency(totalValue)}</span>
          <span
            className="border border-[var(--way-shadow)] text-[var(--way-ash)] px-2 py-0.5 rounded text-[11px]"
            onClick={(e) => { e.stopPropagation(); /* TODO: import flow Task 15 */ }}
          >
            Импорт
          </span>
          <span
            className="border border-[var(--way-shadow)] text-[var(--way-ash)] px-2 py-0.5 rounded text-[11px]"
            onClick={(e) => { e.stopPropagation(); /* TODO: menu Task 14 */ }}
          >
            ⋯
          </span>
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div>
          {Array.from(typeGroups.entries()).map(([type, items]) => {
            const groupValue = items.reduce((sum, { asset, holding }) => {
              const price = asset.currentPrice ?? holding.averagePrice ?? 0;
              return sum + price * holding.quantity;
            }, 0);

            return (
              <div key={type}>
                {/* Type sub-header */}
                <div className="flex justify-between items-center px-3 py-1.5 bg-[var(--way-void)]">
                  <span className="text-[var(--way-ash)] text-[11px] uppercase tracking-wider" onClick={(e) => e.stopPropagation()}>
                    <TypeCombobox
                      value={type}
                      existingTypes={allTypes}
                      onSave={(newType) => {
                        for (const { asset } of items) {
                          if (asset.id != null) {
                            updateAsset(asset.id, { type: newType });
                          }
                        }
                      }}
                    />
                  </span>
                  <span className="text-[var(--way-muted)] text-[11px]">{formatCurrency(groupValue)}</span>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-3 py-1 text-[11px] text-[var(--way-muted)]">
                  <span>Тикер</span>
                  <span className="text-right w-14">Кол-во</span>
                  <span className="text-right w-16">Цена пок.</span>
                  <span className="text-right w-16">Стоимость</span>
                </div>

                {/* Rows */}
                {items.map(({ asset, holding }) => {
                  const price = asset.currentPrice ?? holding.averagePrice ?? 0;
                  const rowValue = price * holding.quantity;
                  return (
                    <div key={holding.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-3 py-2 border-t border-[var(--way-void)] text-[13px]">
                      <div className="min-w-0">
                        {asset.ticker ? (
                          <>
                            <div className="font-medium text-[var(--way-text)] truncate">{asset.ticker}</div>
                            <div className="text-[var(--way-muted)] text-[11px] truncate">
                              <InlineCell
                                value={asset.name}
                                onSave={(v) => asset.id != null && updateAsset(asset.id, { name: v })}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="font-medium text-[var(--way-text)] truncate">
                            <InlineCell
                              value={asset.name}
                              onSave={(v) => asset.id != null && updateAsset(asset.id, { name: v })}
                            />
                          </div>
                        )}
                      </div>
                      <span className="text-right text-[var(--way-text)] tabular-nums w-14">
                        <InlineCell
                          value={String(holding.quantity)}
                          type="number"
                          onSave={(v) => {
                            const num = parseFloat(v);
                            if (!isNaN(num) && holding.id != null) {
                              updateHolding(holding.id, { quantity: num, quantitySource: 'manual' });
                            }
                          }}
                        />
                      </span>
                      <span className="text-right text-[var(--way-ash)] tabular-nums w-16">
                        <InlineCell
                          value={holding.averagePrice != null ? holding.averagePrice.toFixed(0) : ''}
                          type="number"
                          onSave={(v) => {
                            const num = parseFloat(v);
                            if (holding.id != null) {
                              updateHolding(holding.id, { averagePrice: v === '' ? undefined : (isNaN(num) ? undefined : num) });
                            }
                          }}
                        />
                      </span>
                      <span className="text-right text-[var(--way-ash)] tabular-nums w-16">
                        {formatCurrency(rowValue)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Add asset button */}
          <div className="px-3 py-2">
            <button
              onClick={() => setAddAssetOpen(true)}
              className="w-full border border-dashed border-[var(--way-shadow)] text-[var(--way-muted)] py-1.5 rounded-md text-xs hover:bg-[var(--way-stone)] transition-colors"
            >
              + Добавить актив
            </button>
          </div>
        </div>
      )}

      <AddAssetSheet
        open={addAssetOpen}
        onClose={() => setAddAssetOpen(false)}
        accountId={account.id!}
        existingTypes={allTypes}
      />
    </div>
  );
}
