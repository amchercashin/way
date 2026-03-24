import { db } from '@/db/database';
import type { ImportRecord } from '@/models/types';
import { getDefaultFrequency } from '@/models/account';
import type { ImportAssetRow } from './import-parser';
import type { ImportDiff } from './import-diff';

export async function applyImportDiff(
  diff: ImportDiff,
  source: ImportRecord['source'],
  accountName?: string,
): Promise<{ record: ImportRecord; accountId: number; newAssetIds: number[] }> {
  let itemsAdded = 0, itemsChanged = 0, itemsUnchanged = 0, itemsRemoved = 0;
  let accountId = diff.accountId;
  const newAssetIds: number[] = [];

  await db.transaction('rw', [db.accounts, db.assets, db.holdings, db.paymentHistory, db.importRecords], async () => {
    if (accountId == null) {
      const now = new Date();
      accountId = await db.accounts.add({ name: accountName!, createdAt: now, updatedAt: now }) as number;
    }

    for (const item of diff.items) {
      switch (item.status) {
        case 'added': {
          let assetId: number;
          if (item.existingAsset) {
            assetId = item.existingAsset.id!;
            await updateAssetFields(assetId, item.imported!);
          } else {
            assetId = await createAsset(item.imported!);
            newAssetIds.push(assetId);
          }
          const now = new Date();
          await db.holdings.add({
            accountId: accountId!, assetId,
            quantity: item.imported!.quantity,
            quantitySource: 'import' as const,
            importedQuantity: item.imported!.quantity,
            averagePrice: item.imported!.averagePrice,
            createdAt: now, updatedAt: now,
          });
          itemsAdded++;
          break;
        }
        case 'changed': {
          await db.holdings.update(item.existingHolding!.id!, {
            quantity: item.imported!.quantity,
            quantitySource: 'import' as const,
            importedQuantity: item.imported!.quantity,
            averagePrice: item.imported!.averagePrice ?? item.existingHolding!.averagePrice,
            updatedAt: new Date(),
          });
          await updateAssetFields(item.existingAsset!.id!, item.imported!);
          itemsChanged++;
          break;
        }
        case 'removed': {
          await db.holdings.delete(item.existingHolding!.id!);
          const remaining = await db.holdings.where('assetId').equals(item.existingHolding!.assetId).count();
          if (remaining === 0) {
            await db.paymentHistory.where('assetId').equals(item.existingHolding!.assetId).delete();
            await db.assets.delete(item.existingHolding!.assetId);
          }
          itemsRemoved++;
          break;
        }
        case 'unchanged':
          itemsUnchanged++;
          break;
      }
    }

    await db.importRecords.add({
      date: new Date(), source, accountId: accountId!,
      itemsAdded, itemsChanged, itemsUnchanged, itemsRemoved,
    } as ImportRecord);
  });

  const record = {
    date: new Date(), source, accountId: accountId!,
    itemsAdded, itemsChanged, itemsUnchanged, itemsRemoved,
  } as ImportRecord;
  return { record, accountId: accountId!, newAssetIds };
}

async function createAsset(row: ImportAssetRow): Promise<number> {
  const freq = row.frequencyPerYear ?? getDefaultFrequency(row.type) ?? 12;
  const now = new Date();
  return await db.assets.add({
    type: row.type, ticker: row.ticker, isin: row.isin, name: row.name,
    currentPrice: row.currentPrice ?? row.averagePrice, faceValue: row.faceValue,
    currency: row.currency, emitter: row.emitter,
    securityCategory: row.securityCategory, issueInfo: row.issueInfo,
    paymentPerUnit: row.lastPaymentAmount ?? undefined,
    paymentPerUnitSource: row.lastPaymentAmount ? 'manual' : 'fact',
    frequencyPerYear: freq,
    dataSource: 'import', createdAt: now, updatedAt: now,
  } as any) as number;
}

async function updateAssetFields(assetId: number, row: ImportAssetRow): Promise<void> {
  const updates: Record<string, unknown> = {
    name: row.name, dataSource: 'import', updatedAt: new Date(),
  };
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
  }
  await db.assets.update(assetId, updates);
}
