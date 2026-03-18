import Dexie from 'dexie';
import { db } from '@/db/database';
import type { Asset, PaymentHistory } from '@/models/types';
import type { DividendHistoryRow, StockPriceResult, BondDataResult } from './moex-api';
import {
  resolveSecurityInfo,
  fetchBondData,
  fetchDividends,
  fetchCouponHistory,
  fetchBatchStockPrices,
  fetchBatchBondData,
  chunk,
} from './moex-api';

// ============ Concurrency Helper ============

export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      try {
        const value = await tasks[index]();
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
}

interface ResolvedAsset {
  asset: Asset;
  secid: string;
  boardId: string;
  market: 'shares' | 'bonds';
}

export async function syncAllAssets(): Promise<SyncResult> {
  const assets = await db.assets.toArray();
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, errors: [] };

  // Filter syncable assets
  const syncable = assets.filter(
    (a) => (a.ticker || a.isin || a.moexSecid) && ['stock', 'bond', 'fund'].includes(a.type),
  );
  result.skipped = assets.length - syncable.length;

  // Phase 1: Resolve — resolve secid/boardId/market with concurrency=5
  const resolved: ResolvedAsset[] = [];
  const resolveTasks = syncable.map((asset) => () => resolveAndCache(asset));
  const resolveResults = await runWithConcurrency(resolveTasks, 5);

  for (let i = 0; i < resolveResults.length; i++) {
    const r = resolveResults[i];
    if (r.status === 'fulfilled' && r.value) {
      resolved.push(r.value);
    } else {
      result.failed++;
      const ticker = syncable[i].ticker ?? syncable[i].isin ?? 'unknown';
      const reason = r.status === 'rejected'
        ? (r.reason instanceof Error ? r.reason.message : String(r.reason))
        : 'Не найден на MOEX';
      result.errors.push(`${ticker}: ${reason}`);
    }
  }

  // Phase 2: Batch prices — group by market+board, fetch in parallel
  const groups = groupByMarketAndBoard(resolved);
  const priceMap = new Map<string, StockPriceResult | BondDataResult>();

  await Promise.all(
    groups.map(async (group) => {
      const batchResult = await fetchGroupPrices(group);
      for (const [secid, data] of batchResult) {
        priceMap.set(secid, data);
      }
    }),
  );

  // Phase 3: Enrich — write prices + fetch dividends/coupons with concurrency=3
  const enrichTasks = resolved.map((ra) => () => enrichAsset(ra, priceMap.get(ra.secid)));
  const enrichResults = await runWithConcurrency(enrichTasks, 3);

  for (let i = 0; i < enrichResults.length; i++) {
    const r = enrichResults[i];
    if (r.status === 'fulfilled') {
      result.synced++;
    } else {
      result.failed++;
      const ticker = resolved[i].asset.ticker ?? resolved[i].secid;
      const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
      result.errors.push(`${ticker}: ${reason}`);
    }
  }

  if (result.synced > 0) {
    await db
      .table('settings')
      .put({ key: 'lastSyncAt', value: new Date().toISOString() });
  }

  return result;
}

export async function getLastSyncAt(): Promise<Date | null> {
  const setting = await db.table('settings').get('lastSyncAt');
  return setting ? new Date(setting.value) : null;
}

// ============ Phase 1: Resolve ============

async function resolveAndCache(asset: Asset): Promise<ResolvedAsset | null> {
  // Use cached values if all three are present
  if (asset.moexSecid && asset.moexBoardId && asset.moexMarket) {
    return {
      asset,
      secid: asset.moexSecid,
      boardId: asset.moexBoardId,
      market: asset.moexMarket,
    };
  }

  // Resolve from API
  let info = null;
  if (asset.moexSecid) {
    info = await resolveSecurityInfo(asset.moexSecid);
  } else {
    if (asset.ticker) info = await resolveSecurityInfo(asset.ticker);
    if (!info && asset.isin) info = await resolveSecurityInfo(asset.isin);
  }
  if (!info) return null;

  // Cache all three fields
  await db.assets.update(asset.id!, {
    moexSecid: info.secid,
    moexBoardId: info.primaryBoardId,
    moexMarket: info.market,
  });

  return {
    asset: { ...asset, moexSecid: info.secid, moexBoardId: info.primaryBoardId, moexMarket: info.market },
    secid: info.secid,
    boardId: info.primaryBoardId,
    market: info.market,
  };
}

// ============ Phase 2: Batch Prices ============

interface PriceGroup {
  market: 'shares' | 'bonds';
  boardId: string;
  secids: string[];
}

function groupByMarketAndBoard(resolved: ResolvedAsset[]): PriceGroup[] {
  const map = new Map<string, PriceGroup>();
  for (const ra of resolved) {
    const key = `${ra.market}:${ra.boardId}`;
    let group = map.get(key);
    if (!group) {
      group = { market: ra.market, boardId: ra.boardId, secids: [] };
      map.set(key, group);
    }
    group.secids.push(ra.secid);
  }
  return Array.from(map.values());
}

async function fetchGroupPrices(
  group: PriceGroup,
): Promise<Map<string, StockPriceResult | BondDataResult>> {
  const result = new Map<string, StockPriceResult | BondDataResult>();
  const chunks = chunk(group.secids, 10);

  await Promise.all(
    chunks.map(async (secidChunk) => {
      const batchResult =
        group.market === 'bonds'
          ? await fetchBatchBondData(secidChunk, group.boardId)
          : await fetchBatchStockPrices(secidChunk, group.boardId);
      for (const [secid, data] of batchResult) {
        result.set(secid, data);
      }
    }),
  );

  return result;
}

// ============ Phase 3: Enrich ============

async function enrichAsset(
  ra: ResolvedAsset,
  priceData: StockPriceResult | BondDataResult | undefined,
): Promise<void> {
  if (ra.market === 'bonds') {
    await enrichBond(ra, priceData as BondDataResult | undefined);
  } else {
    await enrichStock(ra, priceData as StockPriceResult | undefined);
  }
}

async function enrichStock(
  ra: ResolvedAsset,
  priceData: StockPriceResult | undefined,
): Promise<void> {
  // Write price from Phase 2 batch data
  if (priceData) {
    const currentPrice = priceData.currentPrice ?? priceData.prevPrice;
    if (currentPrice != null) {
      await db.assets.update(ra.asset.id!, {
        currentPrice,
        updatedAt: new Date(),
      });
    }
  }

  // Fetch dividends (not batchable)
  const divInfo = await fetchDividends(ra.secid);
  if (divInfo) {
    await writePaymentHistory(ra.asset.id!, divInfo.history, 'dividend');
    await updateMoexAssetFields(ra.asset, {
      frequencyPerYear: divInfo.summary.frequencyPerYear,
      nextExpectedCutoffDate: divInfo.summary.nextExpectedCutoffDate ?? undefined,
    });
  }
}

async function enrichBond(
  ra: ResolvedAsset,
  priceData: BondDataResult | undefined,
): Promise<void> {
  // If no batch data, try individual fetch as fallback
  const bondData = priceData ?? await fetchBondData(ra.secid, ra.boardId);
  if (!bondData) throw new Error('Нет данных на MOEX');

  const pricePercent = bondData.currentPrice ?? bondData.prevPrice;
  if (pricePercent != null) {
    await db.assets.update(ra.asset.id!, {
      currentPrice: bondData.faceValue * (pricePercent / 100),
      faceValue: bondData.faceValue,
      updatedAt: new Date(),
    });
  }

  const frequencyPerYear =
    bondData.couponPeriod > 0
      ? Math.min(Math.round(365 / bondData.couponPeriod), 52)
      : 2;

  await updateMoexAssetFields(ra.asset, {
    frequencyPerYear,
    nextExpectedDate: bondData.nextCouponDate
      ? new Date(bondData.nextCouponDate)
      : undefined,
  });

  // Fetch coupon history (not batchable)
  const couponHistory = await fetchCouponHistory(ra.secid);
  if (couponHistory.length > 0) {
    await writePaymentHistory(ra.asset.id!, couponHistory, 'coupon');
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
