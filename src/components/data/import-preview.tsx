import { useState } from 'react';
import type { ImportDiff, DiffItem } from '@/services/import-diff';

interface ImportPreviewProps {
  diff: ImportDiff;
}

export function ImportPreview({ diff }: ImportPreviewProps) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const { summary } = diff;

  const added = diff.items.filter(i => i.status === 'added');
  const changed = diff.items.filter(i => i.status === 'changed');
  const removed = diff.items.filter(i => i.status === 'removed');
  const unchanged = diff.items.filter(i => i.status === 'unchanged');

  return (
    <div>
      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap mb-3 text-xs">
        {summary.added > 0 && (
          <span className="bg-[#1a2a1a] border border-[#2d5a2d] text-[#6bba6b] px-2.5 py-1 rounded-full">
            +{summary.added} новых
          </span>
        )}
        {summary.changed > 0 && (
          <span className="bg-[#2a2a1a] border border-[#5a5a2d] text-[#baba6b] px-2.5 py-1 rounded-full">
            {summary.changed} изменено
          </span>
        )}
        {summary.removed > 0 && (
          <span className="bg-[#2a1a1a] border border-[#5a2d2d] text-[#ba6b6b] px-2.5 py-1 rounded-full">
            &minus;{summary.removed} удалён
          </span>
        )}
        {summary.unchanged > 0 && (
          <span className="bg-[#1a1a1a] border border-[var(--way-shadow)] text-[var(--way-muted)] px-2.5 py-1 rounded-full">
            {summary.unchanged} ок
          </span>
        )}
      </div>

      {/* Diff table */}
      <div className="space-y-0.5">
        {/* Added */}
        {added.map((item, i) => (
          <DiffRow key={`a-${i}`} item={item} />
        ))}
        {/* Changed */}
        {changed.map((item, i) => (
          <DiffRow key={`c-${i}`} item={item} />
        ))}
        {/* Removed */}
        {removed.map((item, i) => (
          <DiffRow key={`r-${i}`} item={item} />
        ))}
        {/* Unchanged (collapsed) */}
        {unchanged.length > 0 && !showUnchanged && (
          <button
            onClick={() => setShowUnchanged(true)}
            className="w-full py-2 text-center text-[var(--way-muted)] text-xs"
          >
            &#x25B8; {unchanged.length} без изменений
          </button>
        )}
        {showUnchanged && unchanged.map((item, i) => (
          <DiffRow key={`u-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function DiffRow({ item }: { item: DiffItem }) {
  const borderColor = {
    added: 'border-l-[#6bba6b]',
    changed: 'border-l-[#baba6b]',
    removed: 'border-l-[#ba6b6b]',
    unchanged: 'border-l-transparent',
  }[item.status];

  const bgColor = {
    added: 'bg-[#181e18]',
    changed: 'bg-[#1e1e18]',
    removed: 'bg-[#1e1818]',
    unchanged: '',
  }[item.status];

  const ticker = item.imported?.ticker ?? item.existingAsset?.ticker ?? '\u2014';
  const name = item.imported?.name ?? item.existingAsset?.name ?? '';
  const isRemoved = item.status === 'removed';

  // Quantity display
  const oldQty = item.existingHolding?.quantity;
  const newQty = item.imported?.quantity;

  // Average price display
  const oldPrice = item.existingHolding?.averagePrice;
  const newPrice = item.imported?.averagePrice;

  return (
    <div className={`${bgColor} ${borderColor} border-l-3 rounded px-2 py-1.5 flex items-center justify-between text-[13px]`}>
      <div className="min-w-0">
        <span className={`font-medium ${isRemoved ? 'text-[var(--way-muted)] line-through' : 'text-[var(--way-text)]'}`}>
          {ticker}
        </span>
        {name && ticker !== name && (
          <span className={`ml-1 text-[11px] ${isRemoved ? 'text-[var(--way-muted)]' : 'text-[var(--way-ash)]'}`}>
            {name}
          </span>
        )}
      </div>
      <div className="flex gap-3 text-right flex-shrink-0 ml-2">
        {/* Quantity */}
        <DiffValue oldVal={oldQty} newVal={newQty} status={item.status} suffix=" шт" />
        {/* Price */}
        <DiffValue oldVal={oldPrice} newVal={newPrice} status={item.status} suffix="₽" />
      </div>
    </div>
  );
}

function DiffValue({ oldVal, newVal, status, suffix = '' }: {
  oldVal?: number;
  newVal?: number;
  status: DiffItem['status'];
  suffix?: string;
}) {
  if (status === 'added') {
    return <span className="text-[#6bba6b] font-semibold">{newVal}{suffix}</span>;
  }
  if (status === 'removed') {
    return <span className="text-[var(--way-muted)] line-through text-xs">{oldVal}{suffix}</span>;
  }
  if (oldVal === newVal || newVal == null) {
    return <span className="text-[var(--way-ash)]">{oldVal ?? '\u2014'}{oldVal != null ? suffix : ''}</span>;
  }
  return (
    <span>
      <span className="text-[var(--way-muted)] line-through text-[11px]">{oldVal}{suffix}</span>
      {' '}
      <span className="text-[#baba6b] font-semibold">{newVal}{suffix}</span>
    </span>
  );
}
