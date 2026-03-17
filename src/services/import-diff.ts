import { db } from '@/db/database';
import type { Asset } from '@/models/types';
import type { ImportAssetRow } from './import-parser';

export type ImportMode = 'update' | 'add';

export interface DiffChange {
  field: string;
  oldValue: string | number | undefined;
  newValue: string | number | undefined;
}

export interface DiffItem {
  status: 'added' | 'changed' | 'unchanged' | 'conflict';
  imported: ImportAssetRow;
  existingAsset?: Asset;
  changes: DiffChange[];
}

export interface ImportDiff {
  mode: ImportMode;
  items: DiffItem[];
  summary: {
    added: number;
    changed: number;
    unchanged: number;
    conflicts: number;
  };
}

export async function computeImportDiff(
  rows: ImportAssetRow[],
  mode: ImportMode,
): Promise<ImportDiff> {
  const existingAssets = await db.assets.toArray();
  const byTicker = new Map<string, Asset>();
  const byIsin = new Map<string, Asset>();
  for (const asset of existingAssets) {
    if (asset.ticker) byTicker.set(asset.ticker, asset);
    if (asset.isin) byIsin.set(asset.isin, asset);
  }

  const items: DiffItem[] = [];

  for (const row of rows) {
    const existing =
      (row.ticker ? byTicker.get(row.ticker) : undefined) ??
      (row.isin ? byIsin.get(row.isin) : undefined);

    if (!existing) {
      items.push({ status: 'added', imported: row, changes: [] });
    } else if (mode === 'add') {
      items.push({ status: 'unchanged', imported: row, existingAsset: existing, changes: [] });
    } else {
      const changes = compareFields(row, existing);
      if (changes.length === 0) {
        items.push({ status: 'unchanged', imported: row, existingAsset: existing, changes: [] });
      } else if (existing.dataSource === 'manual') {
        items.push({ status: 'conflict', imported: row, existingAsset: existing, changes });
      } else {
        items.push({ status: 'changed', imported: row, existingAsset: existing, changes });
      }
    }
  }

  return {
    mode,
    items,
    summary: {
      added: items.filter((i) => i.status === 'added').length,
      changed: items.filter((i) => i.status === 'changed').length,
      unchanged: items.filter((i) => i.status === 'unchanged').length,
      conflicts: items.filter((i) => i.status === 'conflict').length,
    },
  };
}

function compareFields(
  row: ImportAssetRow,
  existing: Asset,
): DiffChange[] {
  const changes: DiffChange[] = [];

  if (row.quantity !== existing.quantity) {
    changes.push({ field: 'quantity', oldValue: existing.quantity, newValue: row.quantity });
  }
  if (row.averagePrice != null && row.averagePrice !== existing.averagePrice) {
    changes.push({ field: 'averagePrice', oldValue: existing.averagePrice, newValue: row.averagePrice });
  }
  if (row.currentPrice != null && row.currentPrice !== existing.currentPrice) {
    changes.push({ field: 'currentPrice', oldValue: existing.currentPrice, newValue: row.currentPrice });
  }
  if (row.name !== existing.name) {
    changes.push({ field: 'name', oldValue: existing.name, newValue: row.name });
  }
  if (row.lastPaymentAmount != null && row.lastPaymentAmount !== existing.paymentPerUnit) {
    changes.push({ field: 'paymentPerUnit', oldValue: existing.paymentPerUnit, newValue: row.lastPaymentAmount });
  }
  if (row.frequencyPerYear != null && row.frequencyPerYear !== existing.frequencyPerYear) {
    changes.push({ field: 'frequencyPerYear', oldValue: existing.frequencyPerYear, newValue: row.frequencyPerYear });
  }

  return changes;
}
