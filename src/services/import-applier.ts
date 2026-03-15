import { db } from '@/db/database';
import type { ImportRecord } from '@/models/types';
import type { ImportAssetRow } from './import-parser';
import type { ImportDiff } from './import-diff';

export async function applyImportDiff(
  diff: ImportDiff,
  source: ImportRecord['source'],
  resolutions: Map<number, 'import' | 'keep'>,
): Promise<ImportRecord> {
  let itemsAdded = 0;
  let itemsChanged = 0;
  let itemsUnchanged = 0;

  await db.transaction('rw', db.assets, db.paymentSchedules, async () => {
    for (let i = 0; i < diff.items.length; i++) {
      const item = diff.items[i];

      switch (item.status) {
        case 'added': {
          const now = new Date();
          const assetId = (await db.assets.add({
            type: item.imported.type,
            ticker: item.imported.ticker,
            name: item.imported.name,
            quantity: item.imported.quantity,
            averagePrice: item.imported.averagePrice,
            currentPrice: item.imported.averagePrice,
            dataSource: 'import',
            createdAt: now,
            updatedAt: now,
          })) as number;

          if (item.imported.lastPaymentAmount) {
            await db.paymentSchedules.add({
              assetId,
              frequencyPerYear: item.imported.frequencyPerYear ?? 1,
              lastPaymentAmount: item.imported.lastPaymentAmount,
              dataSource: 'import',
            });
          }
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
  await db.assets.update(assetId, {
    quantity: row.quantity,
    averagePrice: row.averagePrice,
    name: row.name,
    dataSource: 'import',
    updatedAt: new Date(),
  });

  if (row.lastPaymentAmount) {
    const existing = await db.paymentSchedules.where('assetId').equals(assetId).first();
    const scheduleData = {
      frequencyPerYear: row.frequencyPerYear ?? existing?.frequencyPerYear ?? 1,
      lastPaymentAmount: row.lastPaymentAmount,
      dataSource: 'import' as const,
    };

    if (existing) {
      await db.paymentSchedules.update(existing.id!, scheduleData);
    } else {
      await db.paymentSchedules.add({ assetId, ...scheduleData });
    }
  }
}
