import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import Dexie from 'dexie';
import { db } from '@/db/database';

vi.mock('@/services/moex-api', () => ({
  resolveSecurityInfo: vi.fn(),
  fetchStockPrice: vi.fn(),
  fetchBondData: vi.fn(),
  fetchDividends: vi.fn(),
  fetchCouponHistory: vi.fn().mockResolvedValue([]),
  fetchBatchStockPrices: vi.fn().mockResolvedValue(new Map()),
  fetchBatchBondData: vi.fn().mockResolvedValue(new Map()),
  chunk: vi.fn((arr: unknown[], size: number) => {
    const result: unknown[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }),
}));

import {
  resolveSecurityInfo,
  fetchDividends,
  fetchBatchStockPrices,
  fetchBatchBondData,
} from '@/services/moex-api';
import { syncAllAssets, getLastSyncAt } from '@/services/moex-sync';

const ASSET_DEFAULTS = {
  paymentPerUnitSource: 'fact' as const,
  frequencyPerYear: 1,
  frequencySource: 'manual' as const,
};

describe('syncAllAssets', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete();
    await db.open();
  });

  it('syncs stock: updates price and writes frequency to asset', async () => {
    const assetId = (await db.assets.add({
      type: 'Акции',
      ticker: 'SBER',
      name: 'Сбербанк',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
      frequencySource: 'moex' as const,
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['SBER', { currentPrice: 317.63, prevPrice: 316.65 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 1, nextExpectedCutoffDate: null },
      history: [{ date: new Date('2025-07-18'), amount: 34.84 }],
    });

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(317.63);
    expect(asset!.moexFrequency).toBe(1);
    expect(asset!.frequencyPerYear).toBe(1);
    expect(asset!.frequencySource).toBe('moex');
  });

  it('syncs bond: converts price from % to rub, updates frequency on asset', async () => {
    const assetId = (await db.assets.add({
      type: 'Облигации',
      ticker: 'SU26238RMFS4',
      name: 'ОФЗ 26238',
      faceValue: 1000,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
      frequencyPerYear: 2,
      frequencySource: 'moex' as const,
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SU26238RMFS4',
      primaryBoardId: 'TQOB',
      market: 'bonds',
    });
    (fetchBatchBondData as Mock).mockResolvedValue(
      new Map([['SU26238RMFS4', {
        currentPrice: 61.5,
        prevPrice: 61.107,
        faceValue: 1000,
        accruedInterest: 23.45,
        couponValue: 35.4,
        nextCouponDate: '2026-06-03',
        couponPeriod: 182,
      }]]),
    );

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(615); // 1000 * 61.5 / 100
    expect(asset!.faceValue).toBe(1000);
    expect(asset!.accruedInterest).toBe(23.45);
    expect(asset!.moexFrequency).toBe(2);
    expect(asset!.frequencyPerYear).toBe(2); // 365/182 ≈ 2
    expect(asset!.frequencySource).toBe('moex');
    expect(asset!.nextExpectedDate).toEqual(new Date('2026-06-03'));
  });

  it('skips non-exchange assets (realestate, deposit, other)', async () => {
    await db.assets.add({
      type: 'Недвижимость',
      name: 'Квартира',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
      frequencyPerYear: 12,
    });

    const result = await syncAllAssets();

    expect(result.skipped).toBe(1);
    expect(result.synced).toBe(0);
    expect(resolveSecurityInfo).not.toHaveBeenCalled();
  });

  it('skips assets without ticker', async () => {
    await db.assets.add({
      type: 'Акции',
      name: 'Какая-то акция',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
    });

    const result = await syncAllAssets();
    expect(result.skipped).toBe(1);
  });

  it('does not overwrite manual frequency on asset', async () => {
    const assetId = (await db.assets.add({
      type: 'Акции',
      ticker: 'SBER',
      name: 'Сбербанк',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
      frequencyPerYear: 4,
      frequencySource: 'manual' as const,
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['SBER', { currentPrice: 317.63, prevPrice: 316.65 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 1, nextExpectedCutoffDate: null },
      history: [{ date: new Date('2025-07-18'), amount: 34.84 }],
    });

    await syncAllAssets();

    const asset = await db.assets.get(assetId);
    // Manual frequency is preserved
    expect(asset!.frequencyPerYear).toBe(4);
    expect(asset!.frequencySource).toBe('manual');
    // But moexFrequency is still stored for reference
    expect(asset!.moexFrequency).toBe(1);
  });

  it('updates price but keeps asset fields when dividends fetch fails', async () => {
    const assetId = (await db.assets.add({
      type: 'Акции',
      ticker: 'SBER',
      name: 'Сбербанк',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['SBER', { currentPrice: 317.63, prevPrice: 316.65 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue(null);

    await syncAllAssets();

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(317.63);
    // No moex frequency written when dividends fetch returns null
    expect(asset!.moexFrequency).toBeUndefined();
  });

  it('updates existing moex frequency on asset with fresh data', async () => {
    const assetId = (await db.assets.add({
      type: 'Акции',
      ticker: 'SBER',
      name: 'Сбербанк',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
      frequencyPerYear: 1,
      frequencySource: 'moex' as const,
      moexFrequency: 1,
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['SBER', { currentPrice: 317.63, prevPrice: 316.65 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 2, nextExpectedCutoffDate: null },
      history: [{ date: new Date('2025-07-18'), amount: 34.84 }],
    });

    await syncAllAssets();

    const asset = await db.assets.get(assetId);
    expect(asset!.frequencyPerYear).toBe(2);
    expect(asset!.moexFrequency).toBe(2);
    expect(asset!.frequencySource).toBe('moex');
  });

  it('reports failed asset when API returns null', async () => {
    await db.assets.add({
      type: 'Акции',
      ticker: 'UNKNOWN',
      name: 'Unknown Stock',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
    });

    (resolveSecurityInfo as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('saves lastSyncAt timestamp when at least one asset synced', async () => {
    await db.assets.add({
      type: 'Акции', ticker: 'SBER', moexSecid: 'SBER', moexBoardId: 'TQBR', moexMarket: 'shares',
      name: 'Сбербанк', dataSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(), ...ASSET_DEFAULTS,
    });
    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['SBER', { currentPrice: 300, prevPrice: 298 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();
    expect(result.synced).toBe(1);

    const lastSync = await getLastSyncAt();
    expect(lastSync).not.toBeNull();
  });

  it('does not save lastSyncAt when no assets synced', async () => {
    const result = await syncAllAssets();
    expect(result.synced).toBe(0);

    const lastSync = await getLastSyncAt();
    expect(lastSync).toBeNull();
  });

  it('resolves by ISIN when ticker resolution fails', async () => {
    const assetId = (await db.assets.add({
      type: 'Фонды',
      ticker: 'RU000A1068X9',
      isin: 'RU000A1068X9',
      name: 'ПАРУС-ДВН',
      currentPrice: 1100,
      dataSource: 'import',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
    })) as number;

    (resolveSecurityInfo as Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        secid: 'RU000A1068X9',
        primaryBoardId: 'TQTF',
        market: 'shares',
      });
    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['RU000A1068X9', { currentPrice: 1150, prevPrice: 1100 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);
    expect(resolveSecurityInfo).toHaveBeenCalledTimes(2);

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(1150);
    expect(asset!.moexSecid).toBe('RU000A1068X9');
  });

  it('uses cached moexSecid/boardId/market and skips resolveSecurityInfo', async () => {
    const assetId = (await db.assets.add({
      type: 'Акции',
      ticker: 'SBER',
      moexSecid: 'SBER',
      moexBoardId: 'TQBR',
      moexMarket: 'shares',
      name: 'Сбербанк',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
    })) as number;

    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['SBER', { currentPrice: 320.0, prevPrice: 318.0 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);
    // When all three cached fields are present, resolveSecurityInfo is NOT called
    expect(resolveSecurityInfo).not.toHaveBeenCalled();

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(320.0);
  });

  it('resolves and caches boardId/market when only moexSecid present', async () => {
    const assetId = (await db.assets.add({
      type: 'Акции',
      ticker: 'SBER',
      moexSecid: 'SBER',
      name: 'Сбербанк',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['SBER', { currentPrice: 320.0, prevPrice: 318.0 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);
    // Called once because moexBoardId/moexMarket were missing
    expect(resolveSecurityInfo).toHaveBeenCalledTimes(1);
    expect(resolveSecurityInfo).toHaveBeenCalledWith('SBER');

    // Verify boardId and market are now cached
    const asset = await db.assets.get(assetId);
    expect(asset!.moexBoardId).toBe('TQBR');
    expect(asset!.moexMarket).toBe('shares');
  });

  it('writes dividend rows to paymentHistory on stock sync', async () => {
    const assetId = (await db.assets.add({
      type: 'Акции', name: 'Sber', ticker: 'SBER', moexSecid: 'SBER',
      dataSource: 'moex', createdAt: new Date(), updatedAt: new Date(),
      ...ASSET_DEFAULTS,
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({ secid: 'SBER', primaryBoardId: 'TQBR', market: 'shares' });
    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['SBER', { currentPrice: 300, prevPrice: 298 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 1, nextExpectedCutoffDate: null },
      history: [
        { date: new Date('2024-07-11'), amount: 33.3 },
        { date: new Date('2025-07-18'), amount: 34.84 },
      ],
    });

    await syncAllAssets();

    const records = await db.paymentHistory.where('[assetId+date]').between([assetId, Dexie.minKey], [assetId, Dexie.maxKey]).toArray();
    expect(records).toHaveLength(2);
    expect(records[0].amount).toBe(33.3);
    expect(records[0].type).toBe('dividend');
    expect(records[0].dataSource).toBe('moex');
  });

  it('deduplicates payment history on re-sync', async () => {
    const assetId = (await db.assets.add({
      type: 'Акции', name: 'Sber', ticker: 'SBER', moexSecid: 'SBER',
      dataSource: 'moex', createdAt: new Date(), updatedAt: new Date(),
      ...ASSET_DEFAULTS,
    })) as number;

    await db.paymentHistory.add({
      assetId, amount: 33.3, date: new Date('2024-07-11'),
      type: 'dividend', dataSource: 'moex',
    });

    (resolveSecurityInfo as Mock).mockResolvedValue({ secid: 'SBER', primaryBoardId: 'TQBR', market: 'shares' });
    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['SBER', { currentPrice: 300, prevPrice: 298 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 1, nextExpectedCutoffDate: null },
      history: [
        { date: new Date('2024-07-11'), amount: 33.3 },
        { date: new Date('2025-07-18'), amount: 34.84 },
      ],
    });

    await syncAllAssets();

    const records = await db.paymentHistory.where('[assetId+date]').between([assetId, Dexie.minKey], [assetId, Dexie.maxKey]).toArray();
    expect(records).toHaveLength(2); // not 3
  });

  it('syncs asset with ISIN but no ticker', async () => {
    const assetId = (await db.assets.add({
      type: 'Облигации',
      isin: 'RU000A0JV4Q1',
      name: 'ОФЗ 29010',
      dataSource: 'import',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...ASSET_DEFAULTS,
      frequencyPerYear: 2,
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SU29010RMFS4',
      primaryBoardId: 'TQOB',
      market: 'bonds',
    });
    (fetchBatchBondData as Mock).mockResolvedValue(
      new Map([['SU29010RMFS4', {
        currentPrice: 105.5,
        prevPrice: 105.0,
        faceValue: 1000,
        couponValue: 44.88,
        nextCouponDate: '2026-06-18',
        couponPeriod: 182,
      }]]),
    );

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(1055);
    expect(asset!.moexSecid).toBe('SU29010RMFS4');
  });

  it('groups assets by market+board for batch pricing', async () => {
    // Two stocks on TQBR — should be fetched in one batch
    await db.assets.add({
      type: 'Акции', ticker: 'SBER', moexSecid: 'SBER', moexBoardId: 'TQBR', moexMarket: 'shares',
      name: 'Сбербанк', dataSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(), ...ASSET_DEFAULTS,
    });
    await db.assets.add({
      type: 'Акции', ticker: 'GAZP', moexSecid: 'GAZP', moexBoardId: 'TQBR', moexMarket: 'shares',
      name: 'Газпром', dataSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(), ...ASSET_DEFAULTS,
    });

    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([
        ['SBER', { currentPrice: 320, prevPrice: 318 }],
        ['GAZP', { currentPrice: 150, prevPrice: 148 }],
      ]),
    );
    (fetchDividends as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();

    expect(result.synced).toBe(2);
    expect(resolveSecurityInfo).not.toHaveBeenCalled();
    // Should call fetchBatchStockPrices once (both on TQBR)
    expect(fetchBatchStockPrices).toHaveBeenCalledTimes(1);
    expect((fetchBatchStockPrices as Mock).mock.calls[0][0]).toEqual(
      expect.arrayContaining(['SBER', 'GAZP']),
    );
  });

  it('isolates errors: one asset failing does not block others', async () => {
    await db.assets.add({
      type: 'Акции', ticker: 'GOOD', moexSecid: 'GOOD', moexBoardId: 'TQBR', moexMarket: 'shares',
      name: 'Good Stock', dataSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(), ...ASSET_DEFAULTS,
    });
    await db.assets.add({
      type: 'Акции', ticker: 'BAD',
      name: 'Bad Stock', dataSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(), ...ASSET_DEFAULTS,
    });

    // BAD fails resolve, GOOD succeeds
    (resolveSecurityInfo as Mock).mockResolvedValue(null);
    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['GOOD', { currentPrice: 100, prevPrice: 99 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();

    // BAD failed at resolve, GOOD should still sync
    expect(result.failed).toBe(1);
    expect(result.synced).toBe(1);
  });

  it('handles mixed stock+bond portfolio', async () => {
    await db.assets.add({
      type: 'Акции', ticker: 'SBER', moexSecid: 'SBER', moexBoardId: 'TQBR', moexMarket: 'shares',
      name: 'Сбербанк', dataSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(), ...ASSET_DEFAULTS,
    });
    await db.assets.add({
      type: 'Облигации', ticker: 'SU26238RMFS4', moexSecid: 'SU26238RMFS4', moexBoardId: 'TQOB', moexMarket: 'bonds',
      name: 'ОФЗ 26238', dataSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(), ...ASSET_DEFAULTS,
    });

    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['SBER', { currentPrice: 320, prevPrice: 318 }]]),
    );
    (fetchBatchBondData as Mock).mockResolvedValue(
      new Map([['SU26238RMFS4', {
        currentPrice: 61.5, prevPrice: 61.107,
        faceValue: 1000, couponValue: 35.4,
        nextCouponDate: '2026-06-03', couponPeriod: 182,
      }]]),
    );
    (fetchDividends as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();

    expect(result.synced).toBe(2);
    expect(fetchBatchStockPrices).toHaveBeenCalledTimes(1);
    expect(fetchBatchBondData).toHaveBeenCalledTimes(1);
  });
});
