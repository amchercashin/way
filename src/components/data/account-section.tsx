import { useState, useEffect, useRef, useCallback } from 'react';
import type { Account, Holding } from '@/models/account';
import type { Asset } from '@/models/types';
import { formatCurrency } from '@/lib/utils';
import { updateHolding, deleteHolding } from '@/hooks/use-holdings';
import { updateAsset } from '@/hooks/use-assets';
import { updateAccount, deleteAccount } from '@/hooks/use-accounts';
import { InlineCell } from './inline-cell';
import { TypeCombobox } from './type-combobox';
import { AddAssetSheet } from './add-asset-sheet';

interface AccountSectionProps {
  account: Account;
  holdings: Holding[];
  assets: Asset[];
  onImport: () => void;
  highlightAssetId?: number;
}

export function AccountSection({ account, holdings, assets, onImport, highlightAssetId }: AccountSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [addAssetOpen, setAddAssetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const highlightRowRef = useRef<HTMLDivElement>(null);

  // Auto-expand and scroll to highlighted row
  useEffect(() => {
    if (highlightAssetId != null) {
      setExpanded(true);
      // Wait for DOM to update after expanding
      requestAnimationFrame(() => {
        highlightRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [highlightAssetId]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [menuOpen, closeMenu]);

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
    <div className="border border-[var(--hi-shadow)]/50 rounded-xl" data-onboarding="account-section">
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
        className={`w-full bg-[var(--hi-stone)] px-3 py-3 flex items-center justify-between cursor-pointer rounded-t-xl ${!expanded ? 'rounded-b-xl' : ''}`}
        data-onboarding="account-header"
        data-expanded={String(expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[var(--hi-text)] text-[length:var(--hi-text-caption)] flex-shrink-0">{expanded ? '▾' : '▸'}</span>
          <span
            className="font-semibold text-[length:var(--hi-text-heading)] text-[var(--hi-text)] truncate min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <InlineCell
              value={account.name}
              onSave={(v) => account.id != null && updateAccount(account.id, { name: v })}
            />
          </span>
          {statusLabel && (
            <span className={`${statusColor} px-1 py-0.5 rounded text-[length:var(--hi-text-micro)] flex-shrink-0`}>
              {statusLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-[var(--hi-ash)] text-[length:var(--hi-text-body)]">{formatCurrency(totalValue)}</span>
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="border border-[var(--hi-shadow)] text-[var(--hi-ash)] px-2 py-0.5 rounded text-[length:var(--hi-text-body)] min-h-[36px] flex items-center justify-center"
              data-onboarding="account-menu-btn"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--hi-stone)] border border-[var(--hi-shadow)] rounded-md shadow-lg z-50 min-w-[140px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onImport();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--hi-text)] hover:bg-[var(--hi-void)] transition-colors rounded-t-md"
                >
                  Импорт
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    if (window.confirm(`Удалить счёт "${account.name}" и все его позиции?`)) {
                      await deleteAccount(account.id!);
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-[var(--hi-void)] transition-colors rounded-b-md"
                >
                  Удалить счёт
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div>
          {(() => { let globalHoldingIdx = 0; return Array.from(typeGroups.entries()).map(([type, items]) => {
            const groupValue = items.reduce((sum, { asset, holding }) => {
              const price = asset.currentPrice ?? holding.averagePrice ?? 0;
              return sum + price * holding.quantity;
            }, 0);

            return (
              <div key={type}>
                {/* Type sub-header */}
                <div className="flex justify-between items-center px-3 pt-4 pb-1.5 bg-[var(--hi-void)]">
                  <span className="text-[var(--hi-ash)] text-[length:var(--hi-text-heading)] uppercase tracking-wider min-w-0" onClick={(e) => e.stopPropagation()}>
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
                  <span className="text-[var(--hi-muted)] text-[length:var(--hi-text-body)]">{formatCurrency(groupValue)}</span>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[1fr_5rem_4rem_4rem_1.5rem] gap-x-2 px-3 text-[length:var(--hi-text-caption)] text-[var(--hi-muted)]">
                  <span>Бумага</span>
                  <span className="text-right">Кол-во</span>
                  <span className="text-right">Цена пок.</span>
                  <span className="text-right">Стоимость</span>
                  <span></span>
                </div>

                {/* Rows */}
                {items.map(({ asset, holding }) => {
                  const isFirstHolding = globalHoldingIdx === 0;
                  globalHoldingIdx++;
                  const price = asset.currentPrice ?? holding.averagePrice ?? 0;
                  const rowValue = price * holding.quantity;
                  const isHighlighted = highlightAssetId != null && asset.id === highlightAssetId;
                  return (
                    <div
                      key={holding.id}
                      ref={isHighlighted ? highlightRowRef : undefined}
                      className={`grid grid-cols-[1fr_5rem_4rem_4rem_1.5rem] gap-x-2 px-3 items-baseline border-t border-[var(--hi-void)] text-[length:var(--hi-text-body)]${isHighlighted ? ' animate-highlight-pulse' : ''}`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--hi-text)] truncate">{asset.name}</div>
                        {(asset.ticker || asset.isin) && (
                          <div className="text-[var(--hi-muted)] text-[length:var(--hi-text-micro)] truncate">
                            {[asset.ticker, asset.isin].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <span
                        className="text-right text-[var(--hi-text)] tabular-nums"
                        {...(isFirstHolding && { 'data-onboarding': 'holding-quantity' })}
                      >
                        <InlineCell
                          value={String(holding.quantity)}
                          displayValue={Number(holding.quantity).toLocaleString('ru-RU')}
                          type="number"
                          onSave={(v) => {
                            const num = parseFloat(v);
                            if (!isNaN(num) && holding.id != null) {
                              updateHolding(holding.id, { quantity: num, quantitySource: 'manual' });
                            }
                          }}
                        />
                      </span>
                      <span className="text-right text-[var(--hi-ash)] tabular-nums">
                        <InlineCell
                          value={holding.averagePrice != null ? holding.averagePrice.toFixed(0) : ''}
                          displayValue={holding.averagePrice != null ? `${Number(holding.averagePrice).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽` : ''}
                          type="number"
                          onSave={(v) => {
                            const num = parseFloat(v);
                            if (holding.id != null) {
                              updateHolding(holding.id, { averagePrice: v === '' ? undefined : (isNaN(num) ? undefined : num) });
                            }
                          }}
                        />
                      </span>
                      <span className="text-right text-[var(--hi-ash)] tabular-nums">
                        {formatCurrency(rowValue)}
                      </span>
                      <button
                        {...(isFirstHolding && { 'data-onboarding': 'holding-delete' })}
                        onClick={async () => {
                          if (window.confirm(`Удалить ${asset.ticker ?? asset.name} из счёта?`)) {
                            await deleteHolding(holding.id!);
                          }
                        }}
                        className="text-red-400/50 hover:text-red-300/70 transition-colors text-[length:var(--hi-text-title)] min-w-[36px] min-h-[36px]"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          }); })()}

          {/* Add asset button */}
          <div className="px-3 py-2">
            <button
              onClick={() => setAddAssetOpen(true)}
              className="w-full border border-dashed border-[var(--hi-shadow)] text-[var(--hi-muted)] py-1.5 rounded-md text-[length:var(--hi-text-body)] hover:bg-[var(--hi-stone)] transition-colors"
              data-onboarding="add-asset-btn"
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
