import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { computeImportDiff, type ImportDiff, type ImportMode, type DiffItem } from '@/services/import-diff';
import { applyImportDiff } from '@/services/import-applier';
import type { ImportAssetRow } from '@/services/import-parser';
import type { ImportRecord } from '@/models/types';

const STATUS_STYLES = {
  added: { bg: 'bg-[rgba(200,180,140,0.1)]', border: 'border-[rgba(200,180,140,0.08)]', label: 'Новый', text: 'text-[var(--way-gold)]' },
  changed: { bg: 'bg-[rgba(139,115,85,0.12)]', border: 'border-[rgba(139,115,85,0.15)]', label: 'Обновлён', text: 'text-[var(--way-earth)]' },
  unchanged: { bg: 'bg-[rgba(90,85,72,0.1)]', border: 'border-[rgba(200,180,140,0.08)]', label: 'Без изменений', text: 'text-[var(--way-ash)]' },
  conflict: { bg: 'bg-[rgba(184,65,58,0.15)]', border: 'border-[rgba(184,65,58,0.2)]', label: 'Конфликт', text: 'text-[var(--destructive)]' },
};

export function ImportPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    mode: ImportMode;
    rows: ImportAssetRow[];
    source: string;
  } | null;

  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [resolutions, setResolutions] = useState<Map<number, 'import' | 'keep'>>(new Map());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!state) return;
    computeImportDiff(state.rows, state.mode).then(setDiff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) {
    return (
      <AppShell title="Ошибка">
        <div className="text-[var(--way-ash)] text-sm text-center py-12">Нет данных для предпросмотра.</div>
      </AppShell>
    );
  }

  const handleApply = async () => {
    if (!diff) return;
    setApplying(true);
    await applyImportDiff(diff, state.source as ImportRecord['source'], resolutions);
    navigate('/');
  };

  const toggleResolution = (index: number) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      next.set(index, next.get(index) === 'import' ? 'keep' : 'import');
      return next;
    });
  };

  const backButton = (
    <button onClick={() => navigate(-1)} className="text-[var(--way-ash)] text-lg" aria-label="Назад">‹</button>
  );

  if (!diff) {
    return <AppShell leftAction={backButton} title="Загрузка..."><div /></AppShell>;
  }

  const actionableCount = diff.summary.added + diff.summary.changed +
    [...resolutions.values()].filter((v) => v === 'import').length;

  return (
    <AppShell leftAction={backButton} title="Предпросмотр">
      <div className="flex flex-wrap gap-3 text-xs mb-4">
        {diff.summary.added > 0 && (
          <span className="text-[var(--way-gold)]">+{diff.summary.added} новых</span>
        )}
        {diff.summary.changed > 0 && (
          <span className="text-[var(--way-earth)]">~{diff.summary.changed} обновлено</span>
        )}
        {diff.summary.unchanged > 0 && (
          <span className="text-[var(--way-ash)]">={diff.summary.unchanged} без изменений</span>
        )}
        {diff.summary.conflicts > 0 && (
          <span className="text-[var(--destructive)]">⚠{diff.summary.conflicts} конфликтов</span>
        )}
      </div>

      <div className="space-y-2 mb-6">
        {diff.items.map((item, i) => (
          <DiffItemRow
            key={i}
            item={item}
            resolution={resolutions.get(i)}
            onToggle={item.status === 'conflict' ? () => toggleResolution(i) : undefined}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="flex-1 border-[rgba(200,180,140,0.08)] text-[var(--way-ash)]"
        >
          Отмена
        </Button>
        <Button
          onClick={handleApply}
          disabled={applying || actionableCount === 0}
          className="flex-1 border border-[rgba(200,180,140,0.2)] text-[var(--way-gold)] bg-transparent hover:bg-[rgba(200,180,140,0.06)] font-semibold"
        >
          {applying ? 'Применяю...' : `Применить (${actionableCount})`}
        </Button>
      </div>
    </AppShell>
  );
}

function DiffItemRow({ item, resolution, onToggle }: {
  item: DiffItem;
  resolution?: 'import' | 'keep';
  onToggle?: () => void;
}) {
  const style = STATUS_STYLES[item.status];
  const displayName = item.imported.ticker
    ? `${item.imported.ticker} · ${item.imported.name}`
    : item.imported.name;

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg p-3`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[var(--way-text)] text-sm font-medium">{displayName}</span>
        <span className={`text-[10px] ${style.text}`}>{style.label}</span>
      </div>

      <div className="text-[var(--way-ash)] text-[11px]">
        {item.imported.quantity} шт
        {item.imported.currentPrice != null && ` · ₽${item.imported.currentPrice}`}
        {item.imported.averagePrice != null && item.imported.currentPrice == null && ` · ₽${item.imported.averagePrice}`}
        {item.imported.lastPaymentAmount != null && ` · выплата ₽${item.imported.lastPaymentAmount}`}
        {item.imported.isin && ` · ${item.imported.isin}`}
      </div>

      {item.changes.length > 0 && (
        <div className="mt-1 text-[10px] text-[var(--way-ash)]">
          {item.changes.map((c) => (
            <span key={c.field} className="mr-2">
              {c.field}: {String(c.oldValue ?? '—')} → {String(c.newValue ?? '—')}
            </span>
          ))}
        </div>
      )}

      {item.status === 'conflict' && onToggle && (
        <button
          onClick={onToggle}
          className="mt-2 text-[11px] px-2 py-1 rounded bg-[var(--way-stone)]"
        >
          {resolution === 'import'
            ? '✓ Использовать импорт'
            : '⊘ Оставить текущее'}
        </button>
      )}
    </div>
  );
}
