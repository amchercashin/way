import { db } from '@/db/database';
import type { ImportRecord } from '@/models/types';
import type { ImportAssetRow } from './import-parser';
import type { ImportDiff } from './import-diff';

const FREQUENCY_DEFAULTS: Record<string, number> = {
  stock: 1, bond: 2, fund: 12, realestate: 12, deposit: 12, other: 12,
};

export async function applyImportDiff(
  diff: ImportDiff,
  source: ImportRecord['source'],
  resolutions: Map<number, 'import' | 'keep'>,
): Promise<ImportRecord> {
  let itemsAdded = 0;
  let itemsChanged = 0;
  let itemsUnchanged = 0;

  await db.transaction('rw', db.assets, async () => {
    for (let i = 0; i < diff.items.length; i++) {
      const item = diff.items[i];

      switch (item.status) {
        case 'added': {
          const now = new Date();
          const freq = item.imported.frequencyPerYear ?? FREQUENCY_DEFAULTS[item.imported.type] ?? 12;
          await db.assets.add({
            type: item.imported.type,
            ticker: item.imported.ticker,
            isin: item.imported.isin,
            name: item.imported.name,
            quantity: item.imported.quantity,
            quantitySource: 'import',
            importedQuantity: item.imported.quantity,
            averagePrice: item.imported.averagePrice,
            currentPrice: item.imported.currentPrice ?? item.imported.averagePrice,
            faceValue: item.imported.faceValue,
            currency: item.imported.currency,
            emitter: item.imported.emitter,
            securityCategory: item.imported.securityCategory,
            issueInfo: item.imported.issueInfo,
            paymentPerUnit: item.imported.lastPaymentAmount ?? undefined,
            paymentPerUnitSource: item.imported.lastPaymentAmount ? 'manual' : 'fact',
            frequencyPerYear: freq,
            frequencySource: 'manual',
            dataSource: 'import',
            createdAt: now,
            updatedAt: now,
          });
          itemsAdded++;
          break;
        }

        case 'changed': {
          await updateAsset(item.existingAsset!.id!, item.imported);
          itemsChanged++;
          break;
        }

        case 'conflict': {
          const resolution = resolutions.get(i) ?? 'keep';
          if (resolution === 'import') {
            await updateAsset(item.existingAsset!.id!, item.imported);
            itemsChanged++;
          } else {
            itemsUnchanged++;
          }
          break;
        }

        case 'unchanged':
          itemsUnchanged++;
          break;
      }
    }
  });

  const record: Omit<ImportRecord, 'id'> = {
    date: new Date(),
    source,
    mode: diff.mode,
    itemsChanged,
    itemsAdded,
    itemsUnchanged,
  };

  await db.importRecords.add(record as ImportRecord);
  return record as ImportRecord;
}

async function updateAsset(assetId: number, row: ImportAssetRow): Promise<void> {
  const updates: Record<string, unknown> = {
    quantity: row.quantity,
    quantitySource: 'import',
    importedQuantity: row.quantity,
    name: row.name,
    dataSource: 'import',
    updatedAt: new Date(),
  };
  if (row.averagePrice != null) updates.averagePrice = row.averagePrice;
  if (row.currentPrice != null) updates.currentPrice = row.currentPrice;
  if (row.faceValue != null) updates.faceValue = row.faceValue;
  if (row.isin) updates.isin = row.isin;
  if (row.currency) updates.currency = row.currency;
  if (row.emitter) updates.emitter = row.emitter;
  if (row.securityCategory) updates.securityCategory = row.securityCategory;
  if (row.issueInfo) updates.issueInfo = row.issueInfo;
  if (row.lastPaymentAmount != null) {
    updates.paymentPerUnit = row.lastPaymentAmount;
    updates.paymentPerUnitSource = 'manual';
  }
  if (row.frequencyPerYear != null) {
    updates.frequencyPerYear = row.frequencyPerYear;
    updates.frequencySource = 'manual';
  }
  await db.assets.update(assetId, updates);
}
