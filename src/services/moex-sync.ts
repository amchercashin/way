import Dexie from 'dexie';
import { db } from '@/db/database';
import type { Asset, PaymentHistory } from '@/models/types';
import type { DividendHistoryRow } from './moex-api';
import {
  resolveSecurityInfo,
  fetchStockPrice,
  fetchBondData,
  fetchDividends,
  fetchCouponHistory,
} from './moex-api';

export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export async function syncAllAssets(): Promise<SyncResult> {
  const assets = await db.assets.toArray();
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, errors: [] };

  for (const asset of assets) {
    if ((!asset.ticker && !asset.isin && !asset.moexSecid) || !['stock', 'bond', 'fund'].includes(asset.type)) {
      result.skipped++;
      continue;
    }

    try {
      await syncSingleAsset(asset);
      result.synced++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${asset.ticker}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await db
    .table('settings')
    .put({ key: 'lastSyncAt', value: new Date().toISOString() });

  return result;
}

export async function getLastSyncAt(): Promise<Date | null> {
  const setting = await db.table('settings').get('lastSyncAt');
  return setting ? new Date(setting.value) : null;
}

async function syncSingleAsset(asset: Asset): Promise<void> {
  let secid = asset.moexSecid;
  let boardId: string;
  let market: 'shares' | 'bonds';

  if (secid) {
    const info = await resolveSecurityInfo(secid);
    if (!info) throw new Error('Не найден на MOEX');
    boardId = info.primaryBoardId;
    market = info.market;
  } else {
    let info = asset.ticker
      ? await resolveSecurityInfo(asset.ticker)
      : null;
    if (!info && asset.isin) {
      info = await resolveSecurityInfo(asset.isin);
    }
    if (!info) throw new Error('Не найден на MOEX');

    secid = info.secid;
    boardId = info.primaryBoardId;
    market = info.market;

    await db.assets.update(asset.id!, { moexSecid: secid });
  }

  if (market === 'bonds') {
    await syncBond(secid, asset, boardId);
  } else {
    await syncStock(secid, asset, boardId);
  }
}

async function syncStock(secid: string, asset: Asset, boardId: string): Promise<void> {
  const price = await fetchStockPrice(secid, boardId);
  if (price) {
    const currentPrice = price.currentPrice ?? price.prevPrice;
    if (currentPrice != null) {
      await db.assets.update(asset.id!, {
        currentPrice,
        updatedAt: new Date(),
      });
    }
  }

  const divInfo = await fetchDividends(secid);
  if (divInfo) {
    await writePaymentHistory(asset.id!, divInfo.history, 'dividend');
    await updateMoexAssetFields(asset, {
      frequencyPerYear: divInfo.summary.frequencyPerYear,
      nextExpectedCutoffDate: divInfo.summary.nextExpectedCutoffDate ?? undefined,
    });
  }
}

async function syncBond(secid: string, asset: Asset, boardId: string): Promise<void> {
  const bondData = await fetchBondData(secid, boardId);
  if (!bondData) throw new Error('Нет данных на MOEX');

  const pricePercent = bondData.currentPrice ?? bondData.prevPrice;
  if (pricePercent != null) {
    await db.assets.update(asset.id!, {
      currentPrice: bondData.faceValue * (pricePercent / 100),
      faceValue: bondData.faceValue,
      updatedAt: new Date(),
    });
  }

  const frequencyPerYear =
    bondData.couponPeriod > 0
      ? Math.round(365 / bondData.couponPeriod)
      : 2;

  await updateMoexAssetFields(asset, {
    frequencyPerYear,
    nextExpectedDate: bondData.nextCouponDate
      ? new Date(bondData.nextCouponDate)
      : undefined,
  });

  const couponHistory = await fetchCouponHistory(secid);
  if (couponHistory.length > 0) {
    await writePaymentHistory(asset.id!, couponHistory, 'coupon');
  }
}

async function writePaymentHistory(
  assetId: number,
  rows: DividendHistoryRow[],
  type: PaymentHistory['type'],
): Promise<void> {
  const existing = await db.paymentHistory
    .where('[assetId+date]')
    .between([assetId, Dexie.minKey], [assetId, Dexie.maxKey])
    .toArray();

  const existingDates = new Set(existing.map((r) => r.date.getTime()));

  const newRecords = rows
    .filter((r) => !existingDates.has(r.date.getTime()))
    .map((r) => ({
      assetId,
      amount: r.amount,
      date: r.date,
      type,
      dataSource: 'moex' as const,
    }));

  if (newRecords.length > 0) {
    await db.paymentHistory.bulkAdd(newRecords);
  }
}

async function updateMoexAssetFields(
  asset: Asset,
  data: {
    frequencyPerYear: number;
    nextExpectedDate?: Date;
    nextExpectedCutoffDate?: Date;
  },
): Promise<void> {
  const updates: Partial<Asset> = {};

  updates.moexFrequency = data.frequencyPerYear;

  if (asset.frequencySource !== 'manual') {
    updates.frequencyPerYear = data.frequencyPerYear;
    updates.frequencySource = 'moex';
  }

  if (data.nextExpectedDate) updates.nextExpectedDate = data.nextExpectedDate;
  if (data.nextExpectedCutoffDate) updates.nextExpectedCutoffDate = data.nextExpectedCutoffDate;

  await db.assets.update(asset.id!, updates);
}
