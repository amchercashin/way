import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { db } from '@/db/database';
import { addHolding } from '@/hooks/use-holdings';
import { getTypeSuggestions, getDefaultFrequency } from '@/models/account';
import type { Asset } from '@/models/types';

interface AddAssetSheetProps {
  open: boolean;
  onClose: () => void;
  accountId: number;
  existingTypes: string[];
}

export function AddAssetSheet({ open, onClose, accountId, existingTypes }: AddAssetSheetProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Акции');
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');

  const suggestions = getTypeSuggestions(existingTypes);

  const handleAdd = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(avgPrice) || undefined;

    // Find existing asset by ticker
    let assetId: number;
    const trimmedTicker = ticker.trim().toUpperCase();
    const existing = trimmedTicker
      ? await db.assets.where('ticker').equals(trimmedTicker).first()
      : undefined;

    if (existing) {
      assetId = existing.id!;
    } else {
      const now = new Date();
      const freq = getDefaultFrequency(type) ?? 12;
      assetId = (await db.assets.add({
        type,
        ticker: trimmedTicker || undefined,
        name: trimmedName,
        currentPrice: price,
        paymentPerUnitSource: 'fact',
        frequencyPerYear: freq,
        frequencySource: 'manual',
        dataSource: 'manual',
        createdAt: now,
        updatedAt: now,
      } as Asset)) as number;
    }

    await addHolding({
      accountId,
      assetId,
      quantity: qty,
      quantitySource: 'manual',
      averagePrice: price,
    });

    // Reset form
    setName('');
    setType('Акции');
    setTicker('');
    setQuantity('');
    setAvgPrice('');
    onClose();
  };

  const inputCls =
    'w-full bg-[var(--way-stone)] border border-[var(--way-shadow)] rounded-lg px-3 py-2 text-sm text-[var(--way-text)] placeholder:text-[var(--way-muted)] outline-none focus:border-[var(--way-gold)]';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="bg-[var(--way-void)] border-t-[var(--way-shadow)]">
        <SheetHeader>
          <SheetTitle className="text-[var(--way-text)]">Добавить актив</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-[var(--way-ash)] block mb-1">Название *</label>
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
            <label className="text-xs text-[var(--way-ash)] block mb-1">Тип</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              {suggestions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-[var(--way-ash)] block mb-1">Тикер</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="SBER"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--way-ash)] block mb-1">Кол-во</label>
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
              <label className="text-xs text-[var(--way-ash)] block mb-1">Цена пок.</label>
              <input
                type="text"
                inputMode="decimal"
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                placeholder="250"
                className={inputCls}
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            className="w-full bg-[var(--way-stone)] text-[var(--way-text)] py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--way-shadow)] transition-colors disabled:opacity-40"
          >
            Добавить
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
