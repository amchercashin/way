import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { db } from '@/db/database';
import { addHolding } from '@/hooks/use-holdings';
import { getTypeSuggestions, getDefaultFrequency } from '@/models/account';
import { useSyncContext } from '@/contexts/sync-context';
import { createAssetDraft } from '@/services/asset-factory';

interface AddAssetSheetProps {
  open: boolean;
  onClose: () => void;
  accountId: number;
  existingTypes: string[];
}

const EXCHANGE_TYPES = new Set(['Акции', 'Облигации', 'Фонды', 'Крипта']);
const CURRENCY_OPTIONS = ['RUB', 'USD', 'EUR', 'CNY'] as const;

export function AddAssetSheet({ open, onClose, accountId, existingTypes }: AddAssetSheetProps) {
  const { syncAsset } = useSyncContext();
  const [name, setName] = useState('');
  const [type, setType] = useState('Акции');
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [currency, setCurrency] = useState('RUB');

  const suggestions = getTypeSuggestions(existingTypes);
  const isExchangeType = EXCHANGE_TYPES.has(type);

  const handleAdd = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const qty = parseFloat(quantity) || 0;
    const totalCost = parseFloat(avgPrice) || undefined;
    const perUnit = totalCost != null && qty > 0 ? totalCost / qty : totalCost;

    // Find existing asset by ticker
    let assetId: number;
    const trimmedTicker = isExchangeType ? ticker.trim().toUpperCase() : '';
    const existing = trimmedTicker
      ? await db.assets.where('ticker').equals(trimmedTicker).first()
      : undefined;

    if (existing) {
      assetId = existing.id!;
    } else {
      const now = new Date();
      const freq = getDefaultFrequency(type) ?? 12;
      assetId = (await db.assets.add(createAssetDraft({
        type,
        ticker: trimmedTicker || undefined,
        name: trimmedName,
        currentPrice: perUnit,
        currency,
        paymentPerUnitSource: 'fact',
        frequencyPerYear: freq,
        frequencySource: 'manual',
        dataSource: 'manual',
        now,
      }))) as number;
    }

    await addHolding({
      accountId,
      assetId,
      quantity: qty,
      quantitySource: 'manual',
      averagePrice: perUnit,
    });

    // Reset form
    setName('');
    setType('Акции');
    setTicker('');
    setQuantity('');
    setAvgPrice('');
    setCurrency('RUB');
    onClose();
    syncAsset(assetId); // fire-and-forget
  };

  const inputCls =
    'w-full bg-[var(--hi-stone)] border border-[var(--hi-shadow)] rounded-lg px-3 py-2 text-base text-[var(--hi-text)] placeholder:text-[var(--hi-muted)] outline-none focus:border-[var(--hi-gold)]';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="bg-[var(--hi-void)] border-t-[var(--hi-shadow)]">
        <SheetHeader>
          <SheetTitle className="text-[var(--hi-text)]">Добавить актив</SheetTitle>
          <SheetDescription className="sr-only">Добавление нового актива в счёт</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-[length:var(--hi-text-body)] text-[var(--hi-ash)] block mb-1">Название *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Сбербанк"
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label className="text-[length:var(--hi-text-body)] text-[var(--hi-ash)] block mb-1">Тип</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              {suggestions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[length:var(--hi-text-body)] text-[var(--hi-ash)] block mb-1">Валюта</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className={`grid ${isExchangeType ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
            {isExchangeType && (
              <div>
                <label className="text-[length:var(--hi-text-body)] text-[var(--hi-ash)] block mb-1">Тикер *</label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="SBER"
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className="text-[length:var(--hi-text-body)] text-[var(--hi-ash)] block mb-1">Кол-во</label>
              <input
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[length:var(--hi-text-body)] text-[var(--hi-ash)] block mb-1">Стоимость пок.</label>
              <input
                type="text"
                inputMode="decimal"
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                placeholder="25 000"
                className={inputCls}
              />
              {(() => {
                const q = parseFloat(quantity);
                const t = parseFloat(avgPrice);
                return q > 1 && t > 0 ? (
                  <div className="text-[length:var(--hi-text-micro)] text-[var(--hi-muted)] mt-0.5">
                    {Math.round(t / q).toLocaleString('ru-RU')} ₽/шт
                  </div>
                ) : null;
              })()}
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!name.trim() || (isExchangeType && !ticker.trim())}
            className="w-full bg-[var(--hi-stone)] text-[var(--hi-text)] py-2.5 rounded-lg text-[length:var(--hi-text-body)] font-medium hover:bg-[var(--hi-shadow)] transition-colors disabled:opacity-40"
          >
            Добавить
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
