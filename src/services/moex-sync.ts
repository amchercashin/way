import Dexie from 'dexie';
import { db } from '@/db/database';
import type { Asset, PaymentHistory, DataSource } from '@/models/types';
import type { DividendHistoryRow, StockPriceResult, BondDataResult } from './moex-api';
import {
  resolveSecurityInfo,
  fetchBondData,
  fetchDividends,
  fetchCouponHistory,
  fetchBatchStockPrices,
  fetchBatchBondData,
  calcDividendFrequency,
  chunk,
} from './moex-api';
import {
  fetchDohodDividends,
  isDohodAvailable,
  resetDohodCache,
  findFundKey,
  fetchFundDistributions,
} from '@/services/heroincome-data';

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
  warnings: string[];
}

interface ResolvedAsset {
  asset: Asset;
  secid: string;
  boardId: string;
  market: 'shares' | 'bonds';
}

export function isSyncable(asset: Asset): boolean {
  return !!(asset.ticker || asset.isin || asset.moexSecid)
    && ['Акции', 'Облигации', 'Фонды'].includes(asset.type);
}

export async function syncAllAssets(options?: { pricesOnly?: boolean }): Promise<SyncResult> {
  const assets = await db.assets.toArray();
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, errors: [], warnings: [] };
  resetDohodCache();

  // Filter syncable assets
  const syncable = assets.filter(isSyncable);
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
  const pricesOnly = options?.pricesOnly ?? false;
  const enrichTasks = resolved.map((ra) => () => enrichAsset(ra, priceMap.get(ra.secid), { pricesOnly }));
  const enrichResults = await runWithConcurrency(enrichTasks, 3);

  for (let i = 0; i < enrichResults.length; i++) {
    const r = enrichResults[i];
    if (r.status === 'fulfilled') {
      result.synced++;
      result.warnings.push(...r.value);
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

export async function syncSingleAsset(assetId: number): Promise<{ success: boolean; error?: string }> {
  const asset = await db.assets.get(assetId);
  if (!asset || !isSyncable(asset)) return { success: false };

  try {
    // Phase 1: Resolve
    const ra = await resolveAndCache(asset);
    if (!ra) return { success: false, error: 'Не найден на MOEX' };

    // Phase 2: Batch prices (single asset)
    const priceData = await fetchGroupPrices({
      market: ra.market,
      boardId: ra.boardId,
      secids: [ra.secid],
    });

    // Phase 3: Enrich
    await enrichAsset(ra, priceData.get(ra.secid));
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
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
    if (asset.isin) info = await resolveSecurityInfo(asset.isin);
    if (!info && asset.ticker) info = await resolveSecurityInfo(asset.ticker);
  }
  if (!info) return null;

  // Cache resolved fields + auto-fill ticker from secid if missing
  const cacheUpdates: Partial<Asset> = {
    moexSecid: info.secid,
    moexBoardId: info.primaryBoardId,
    moexMarket: info.market,
  };
  if (!asset.ticker) {
    cacheUpdates.ticker = info.secid;
  }
  await db.assets.update(asset.id!, cacheUpdates);

  return {
    asset: { ...asset, ...cacheUpdates },
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
  options?: { pricesOnly?: boolean },
): Promise<string[]> {
  if (ra.market === 'bonds') {
    return enrichBond(ra, priceData as BondDataResult | undefined, options);
  } else {
    return enrichStock(ra, priceData as StockPriceResult | undefined, options);
  }
}

async function enrichStock(
  ra: ResolvedAsset,
  priceData: StockPriceResult | undefined,
  options?: { pricesOnly?: boolean },
): Promise<string[]> {
  const warnings: string[] = [];

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

  if (options?.pricesOnly) return warnings;

  const ticker = ra.asset.ticker ?? ra.secid;

  // ---- Fund distribution path (heroincome-data > moex) ----
  if (ra.asset.type === 'Фонды') {
    const fundKey = await findFundKey(ra.asset.ticker, ra.asset.isin);
    let fundRows: Awaited<ReturnType<typeof fetchFundDistributions>> = null;
    if (fundKey) {
      fundRows = await fetchFundDistributions(fundKey);
    }

    if (fundRows && fundRows.length > 0) {
      // heroincome-data covers this fund — remove old moex distribution records
      const oldMoex = await db.paymentHistory
        .where('assetId').equals(ra.asset.id!)
        .filter(r => r.dataSource === 'moex' && r.type === 'distribution')
        .toArray();
      if (oldMoex.length > 0) {
        await db.paymentHistory.bulkDelete(oldMoex.map(r => r.id!));
      }
      await writePaymentHistory(ra.asset.id!, fundRows, 'distribution', 'dohod');
    } else {
      // Fallback to MOEX
      const divInfo = await fetchDividends(ra.secid);
      if (divInfo) {
        await writePaymentHistory(ra.asset.id!, divInfo.history, 'distribution', 'moex');
      }
    }

    // Recalculate frequency from non-forecast DB records
    const dbRecords = await db.paymentHistory
      .where('[assetId+date]')
      .between([ra.asset.id!, Dexie.minKey], [ra.asset.id!, Dexie.maxKey])
      .toArray();
    const activeDates = dbRecords
      .filter((r) => !r.isForecast)
      .map((r) => r.date)
      .sort((a, b) => a.getTime() - b.getTime());

    const frequencyPerYear = activeDates.length >= 2
      ? calcDividendFrequency(activeDates)
      : undefined;

    if (frequencyPerYear != null) {
      await updateMoexAssetFields(ra.asset, { frequencyPerYear });
    } else if (activeDates.length === 0 && !fundRows) {
      warnings.push(`${ticker}: распределения не загружены`);
    }

    return warnings;
  }

  // ---- Stock dividend path (dohod > moex) ----
  const dohodAvailable = await isDohodAvailable(ticker);

  let dohodRows: Awaited<ReturnType<typeof fetchDohodDividends>> = null;
  if (dohodAvailable) {
    dohodRows = await fetchDohodDividends(ticker);
  }

  let divInfo: Awaited<ReturnType<typeof fetchDividends>> = null;

  if (dohodRows) {
    // dohod covers this asset — remove old moex dividend records
    const oldMoex = await db.paymentHistory
      .where('assetId').equals(ra.asset.id!)
      .filter(r => r.dataSource === 'moex' && r.type === 'dividend')
      .toArray();
    if (oldMoex.length > 0) {
      await db.paymentHistory.bulkDelete(oldMoex.map(r => r.id!));
    }

    // Write dohod facts + forecasts
    const facts = dohodRows.filter((r) => !r.isForecast);
    const forecasts = dohodRows.filter((r) => r.isForecast);
    if (facts.length > 0) {
      await writePaymentHistory(ra.asset.id!, facts, 'dividend', 'dohod');
    }
    if (forecasts.length > 0) {
      await writePaymentHistory(ra.asset.id!, forecasts, 'dividend', 'dohod', true);
    }
  } else {
    // Fallback to MOEX
    divInfo = await fetchDividends(ra.secid);
    if (divInfo) {
      await writePaymentHistory(ra.asset.id!, divInfo.history, 'dividend', 'moex');
    }
  }

  // Recalculate frequency from non-forecast DB records
  const dbRecords = await db.paymentHistory
    .where('[assetId+date]')
    .between([ra.asset.id!, Dexie.minKey], [ra.asset.id!, Dexie.maxKey])
    .toArray();
  const activeDates = dbRecords
    .filter((r) => !r.isForecast)
    .map((r) => r.date)
    .sort((a, b) => a.getTime() - b.getTime());

  const frequencyPerYear = activeDates.length >= 2
    ? calcDividendFrequency(activeDates)
    : (divInfo?.summary.frequencyPerYear ?? undefined);

  // nextExpectedCutoffDate: prefer dohod forecast, then MOEX
  let nextExpectedCutoffDate: Date | undefined;
  if (dohodRows) {
    const now = new Date();
    const nextForecast = dohodRows
      .filter((r) => r.isForecast && r.date > now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    if (nextForecast) {
      nextExpectedCutoffDate = nextForecast.date;
    }
  }
  if (!nextExpectedCutoffDate) {
    nextExpectedCutoffDate = divInfo?.summary.nextExpectedCutoffDate ?? undefined;
  }

  if (frequencyPerYear != null) {
    await updateMoexAssetFields(ra.asset, { frequencyPerYear, nextExpectedCutoffDate });
  } else if (activeDates.length === 0 && !dohodRows && !divInfo) {
    warnings.push(`${ticker}: дивиденды не загружены`);
  }

  return warnings;
}

async function enrichBond(
  ra: ResolvedAsset,
  priceData: BondDataResult | undefined,
  options?: { pricesOnly?: boolean },
): Promise<string[]> {
  const warnings: string[] = [];

  // If no batch data, try individual fetch as fallback
  const bondData = priceData ?? await fetchBondData(ra.secid, ra.boardId);
  if (!bondData) throw new Error('Нет данных на MOEX');

  const pricePercent = bondData.currentPrice ?? bondData.prevPrice;
  if (pricePercent != null) {
    await db.assets.update(ra.asset.id!, {
      currentPrice: bondData.faceValue * (pricePercent / 100),
      faceValue: bondData.faceValue,
      accruedInterest: bondData.accruedInterest,
      updatedAt: new Date(),
    });
  }

  if (options?.pricesOnly) return warnings;

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
  } else {
    // Coupon fetch returned empty — warn if no existing coupons
    const existing = await db.paymentHistory
      .where('[assetId+date]')
      .between([ra.asset.id!, Dexie.minKey], [ra.asset.id!, Dexie.maxKey])
      .count();
    if (existing === 0) {
      const ticker = ra.asset.ticker ?? ra.secid;
      warnings.push(`${ticker}: купоны не загружены`);
    }
  }

  return warnings;
}

async function writePaymentHistory(
  assetId: number,
  rows: DividendHistoryRow[],
  type: PaymentHistory['type'],
  dataSource: DataSource = 'moex',
  isForecast?: boolean,
): Promise<void> {
  const existing = await db.paymentHistory
    .where('[assetId+date]')
    .between([assetId, Dexie.minKey], [assetId, Dexie.maxKey])
    .toArray();

  // Dedup by date + dataSource: same source should not duplicate its own records
  const existingKeys = new Set(
    existing.map((r) => `${r.date.getTime()}:${r.dataSource}`),
  );

  const newRecords = rows
    .filter((r) => !existingKeys.has(`${r.date.getTime()}:${dataSource}`))
    .map((r) => ({
      assetId,
      amount: r.amount,
      date: r.date,
      type,
      dataSource,
      ...(isForecast ? { isForecast: true } : {}),
    }));

  if (newRecords.length > 0) {
    await db.paymentHistory.bulkAdd(newRecords);
  }
}

// ============ Payment-only sync ============

export async function deleteManualPayments(assetId: number): Promise<number> {
  const manual = await db.paymentHistory
    .where('assetId').equals(assetId)
    .filter(p => p.dataSource === 'manual')
    .toArray();
  if (manual.length > 0) {
    await db.paymentHistory.bulkDelete(manual.map(p => p.id!));
  }
  return manual.length;
}

export async function syncAssetPayments(assetId: number): Promise<{ success: boolean; error?: string }> {
  const asset = await db.assets.get(assetId);
  if (!asset || !isSyncable(asset)) return { success: false, error: 'Не синхронизируемый актив' };

  try {
    const ra = await resolveAndCache(asset);
    if (!ra) return { success: false, error: 'Не найден на MOEX' };

    if (ra.market === 'bonds') {
      const couponHistory = await fetchCouponHistory(ra.secid);
      if (couponHistory.length > 0) {
        await writePaymentHistory(ra.asset.id!, couponHistory, 'coupon');
      }
    } else if (ra.asset.type === 'Фонды') {
      // Fund distribution path (heroincome-data > moex)
      const fundKey = await findFundKey(ra.asset.ticker, ra.asset.isin);
      let fundRows: Awaited<ReturnType<typeof fetchFundDistributions>> = null;
      if (fundKey) {
        fundRows = await fetchFundDistributions(fundKey);
      }

      if (fundRows && fundRows.length > 0) {
        const oldMoex = await db.paymentHistory
          .where('assetId').equals(ra.asset.id!)
          .filter(r => r.dataSource === 'moex' && r.type === 'distribution')
          .toArray();
        if (oldMoex.length > 0) {
          await db.paymentHistory.bulkDelete(oldMoex.map(r => r.id!));
        }
        await writePaymentHistory(ra.asset.id!, fundRows, 'distribution', 'dohod');
      } else {
        const divInfo = await fetchDividends(ra.secid);
        if (divInfo) {
          await writePaymentHistory(ra.asset.id!, divInfo.history, 'distribution', 'moex');
        }
      }

      const dbRecords = await db.paymentHistory
        .where('[assetId+date]')
        .between([ra.asset.id!, Dexie.minKey], [ra.asset.id!, Dexie.maxKey])
        .toArray();
      const activeDates = dbRecords
        .filter((r) => !r.isForecast)
        .map((r) => r.date)
        .sort((a, b) => a.getTime() - b.getTime());
      if (activeDates.length >= 2) {
        const frequencyPerYear = calcDividendFrequency(activeDates);
        await updateMoexAssetFields(ra.asset, { frequencyPerYear });
      }
    } else {
      // Stock dividend path (dohod > moex)
      const ticker = ra.asset.ticker ?? ra.secid;
      const dohodAvailable = await isDohodAvailable(ticker);

      let dohodRows: Awaited<ReturnType<typeof fetchDohodDividends>> = null;
      if (dohodAvailable) {
        dohodRows = await fetchDohodDividends(ticker);
      }

      if (dohodRows) {
        // dohod covers this asset — remove old moex dividend records
        const oldMoex = await db.paymentHistory
          .where('assetId').equals(ra.asset.id!)
          .filter(r => r.dataSource === 'moex' && r.type === 'dividend')
          .toArray();
        if (oldMoex.length > 0) {
          await db.paymentHistory.bulkDelete(oldMoex.map(r => r.id!));
        }

        const facts = dohodRows.filter((r) => !r.isForecast);
        const forecasts = dohodRows.filter((r) => r.isForecast);
        if (facts.length > 0) {
          await writePaymentHistory(ra.asset.id!, facts, 'dividend', 'dohod');
        }
        if (forecasts.length > 0) {
          await writePaymentHistory(ra.asset.id!, forecasts, 'dividend', 'dohod', true);
        }
      } else {
        const divInfo = await fetchDividends(ra.secid);
        if (divInfo) {
          await writePaymentHistory(ra.asset.id!, divInfo.history, 'dividend', 'moex');
        }
      }

      const dbRecords = await db.paymentHistory
        .where('[assetId+date]')
        .between([ra.asset.id!, Dexie.minKey], [ra.asset.id!, Dexie.maxKey])
        .toArray();
      const activeDates = dbRecords
        .filter((r) => !r.isForecast)
        .map((r) => r.date)
        .sort((a, b) => a.getTime() - b.getTime());
      if (activeDates.length >= 2) {
        const frequencyPerYear = calcDividendFrequency(activeDates);
        await updateMoexAssetFields(ra.asset, { frequencyPerYear });
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ============ Helpers ============

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
