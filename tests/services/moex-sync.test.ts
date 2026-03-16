import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { db } from '@/db/database';

vi.mock('@/services/moex-api', () => ({
  resolveSecurityInfo: vi.fn(),
  fetchStockPrice: vi.fn(),
  fetchBondData: vi.fn(),
  fetchDividends: vi.fn(),
  fetchCouponHistory: vi.fn().mockResolvedValue([]),
}));

import {
  resolveSecurityInfo,
  fetchStockPrice,
  fetchBondData,
  fetchDividends,
  fetchCouponHistory,
} from '@/services/moex-api';
import { syncAllAssets, getLastSyncAt } from '@/services/moex-sync';

describe('syncAllAssets', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete();
    await db.open();
  });

  it('syncs stock: updates price and creates payment schedule', async () => {
    const assetId = (await db.assets.add({
      type: 'stock',
      ticker: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchStockPrice as Mock).mockResolvedValue({
      currentPrice: 317.63,
      prevPrice: 316.65,
    });
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

    const schedule = await db.paymentSchedules
      .where('assetId')
      .equals(assetId)
      .first();
    expect(schedule).toBeDefined();
    expect(schedule!.lastPaymentAmount).toBe(34.84);
    expect(schedule!.frequencyPerYear).toBe(1);
    expect(schedule!.dataSource).toBe('moex');
  });

  it('syncs bond: converts price from % to rub, updates coupon', async () => {
    const assetId = (await db.assets.add({
      type: 'bond',
      ticker: 'SU26238RMFS4',
      name: 'ОФЗ 26238',
      quantity: 50,
      faceValue: 1000,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SU26238RMFS4',
      primaryBoardId: 'TQOB',
      market: 'bonds',
    });
    (fetchBondData as Mock).mockResolvedValue({
      currentPrice: 61.5,
      prevPrice: 61.107,
      faceValue: 1000,
      couponValue: 35.4,
      nextCouponDate: '2026-06-03',
      couponPeriod: 182,
    });

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(615); // 1000 * 61.5 / 100
    expect(asset!.faceValue).toBe(1000);

    const schedule = await db.paymentSchedules
      .where('assetId')
      .equals(assetId)
      .first();
    expect(schedule!.lastPaymentAmount).toBe(35.4);
    expect(schedule!.frequencyPerYear).toBe(2); // 365/182 ≈ 2
    expect(schedule!.dataSource).toBe('moex');
  });

  it('skips non-exchange assets (realestate, deposit, other)', async () => {
    await db.assets.add({
      type: 'realestate',
      name: 'Квартира',
      quantity: 1,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await syncAllAssets();

    expect(result.skipped).toBe(1);
    expect(result.synced).toBe(0);
    expect(resolveSecurityInfo).not.toHaveBeenCalled();
  });

  it('skips assets without ticker', async () => {
    await db.assets.add({
      type: 'stock',
      name: 'Какая-то акция',
      quantity: 100,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await syncAllAssets();
    expect(result.skipped).toBe(1);
  });

  it('does not overwrite manual payment schedule', async () => {
    const assetId = (await db.assets.add({
      type: 'stock',
      ticker: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    await db.paymentSchedules.add({
      assetId,
      frequencyPerYear: 2,
      lastPaymentAmount: 99.99,
      dataSource: 'manual',
    });

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchStockPrice as Mock).mockResolvedValue({
      currentPrice: 317.63,
      prevPrice: 316.65,
    });
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 1, nextExpectedCutoffDate: null },
      history: [{ date: new Date('2025-07-18'), amount: 34.84 }],
    });

    await syncAllAssets();

    const schedule = await db.paymentSchedules
      .where('assetId')
      .equals(assetId)
      .first();
    expect(schedule!.lastPaymentAmount).toBe(99.99);
    expect(schedule!.dataSource).toBe('manual');
  });

  it('updates price but keeps schedule when dividends fetch fails', async () => {
    const assetId = (await db.assets.add({
      type: 'stock',
      ticker: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchStockPrice as Mock).mockResolvedValue({
      currentPrice: 317.63,
      prevPrice: 316.65,
    });
    (fetchDividends as Mock).mockResolvedValue(null);

    await syncAllAssets();

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(317.63);

    const schedule = await db.paymentSchedules
      .where('assetId')
      .equals(assetId)
      .first();
    expect(schedule).toBeUndefined();
  });

  it('updates existing moex schedule with fresh data', async () => {
    const assetId = (await db.assets.add({
      type: 'stock',
      ticker: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    await db.paymentSchedules.add({
      assetId,
      frequencyPerYear: 1,
      lastPaymentAmount: 25.0,
      dataSource: 'moex',
    });

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchStockPrice as Mock).mockResolvedValue({
      currentPrice: 317.63,
      prevPrice: 316.65,
    });
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 1, nextExpectedCutoffDate: null },
      history: [{ date: new Date('2025-07-18'), amount: 34.84 }],
    });

    await syncAllAssets();

    const schedules = await db.paymentSchedules
      .where('assetId')
      .equals(assetId)
      .toArray();
    expect(schedules).toHaveLength(1);
    expect(schedules[0].lastPaymentAmount).toBe(34.84);
    expect(schedules[0].dataSource).toBe('moex');
  });

  it('reports failed asset when API returns null', async () => {
    await db.assets.add({
      type: 'stock',
      ticker: 'UNKNOWN',
      name: 'Unknown Stock',
      quantity: 10,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (resolveSecurityInfo as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('saves lastSyncAt timestamp', async () => {
    await syncAllAssets();
    const lastSync = await getLastSyncAt();
    expect(lastSync).not.toBeNull();
  });

  it('resolves by ISIN when ticker resolution fails', async () => {
    const assetId = (await db.assets.add({
      type: 'fund',
      ticker: 'RU000A1068X9',
      isin: 'RU000A1068X9',
      name: 'ПАРУС-ДВН',
      quantity: 186,
      currentPrice: 1100,
      dataSource: 'import',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    (resolveSecurityInfo as Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        secid: 'RU000A1068X9',
        primaryBoardId: 'TQTF',
        market: 'shares',
      });
    (fetchStockPrice as Mock).mockResolvedValue({
      currentPrice: 1150,
      prevPrice: 1100,
    });
    (fetchDividends as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);
    expect(resolveSecurityInfo).toHaveBeenCalledTimes(2);

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(1150);
    expect(asset!.moexSecid).toBe('RU000A1068X9');
  });

  it('uses cached moexSecid for resolution', async () => {
    await db.assets.add({
      type: 'stock',
      ticker: 'SBER',
      moexSecid: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchStockPrice as Mock).mockResolvedValue({
      currentPrice: 320.0,
      prevPrice: 318.0,
    });
    (fetchDividends as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);
    // Uses cached secid directly (1 call, not ticker→ISIN chain)
    expect(resolveSecurityInfo).toHaveBeenCalledTimes(1);
    expect(resolveSecurityInfo).toHaveBeenCalledWith('SBER');
  });

  it('writes dividend rows to paymentHistory on stock sync', async () => {
    const assetId = await db.assets.add({
      type: 'stock', name: 'Sber', ticker: 'SBER', moexSecid: 'SBER',
      quantity: 100, dataSource: 'moex', createdAt: new Date(), updatedAt: new Date(),
    });

    (resolveSecurityInfo as Mock).mockResolvedValue({ secid: 'SBER', primaryBoardId: 'TQBR', market: 'shares' });
    (fetchStockPrice as Mock).mockResolvedValue({ currentPrice: 300, prevPrice: 298 });
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 1, nextExpectedCutoffDate: null },
      history: [
        { date: new Date('2024-07-11'), amount: 33.3 },
        { date: new Date('2025-07-18'), amount: 34.84 },
      ],
    });

    await syncAllAssets();

    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    expect(records).toHaveLength(2);
    expect(records[0].amount).toBe(33.3);
    expect(records[0].type).toBe('dividend');
    expect(records[0].dataSource).toBe('moex');
  });

  it('deduplicates payment history on re-sync', async () => {
    const assetId = await db.assets.add({
      type: 'stock', name: 'Sber', ticker: 'SBER', moexSecid: 'SBER',
      quantity: 100, dataSource: 'moex', createdAt: new Date(), updatedAt: new Date(),
    });

    await db.paymentHistory.add({
      assetId, amount: 33.3, date: new Date('2024-07-11'),
      type: 'dividend', dataSource: 'moex',
    });

    (resolveSecurityInfo as Mock).mockResolvedValue({ secid: 'SBER', primaryBoardId: 'TQBR', market: 'shares' });
    (fetchStockPrice as Mock).mockResolvedValue({ currentPrice: 300, prevPrice: 298 });
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 1, nextExpectedCutoffDate: null },
      history: [
        { date: new Date('2024-07-11'), amount: 33.3 },
        { date: new Date('2025-07-18'), amount: 34.84 },
      ],
    });

    await syncAllAssets();

    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    expect(records).toHaveLength(2); // not 3
  });

  it('syncs asset with ISIN but no ticker', async () => {
    const assetId = (await db.assets.add({
      type: 'bond',
      isin: 'RU000A0JV4Q1',
      name: 'ОФЗ 29010',
      quantity: 100,
      dataSource: 'import',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SU29010RMFS4',
      primaryBoardId: 'TQOB',
      market: 'bonds',
    });
    (fetchBondData as Mock).mockResolvedValue({
      currentPrice: 105.5,
      prevPrice: 105.0,
      faceValue: 1000,
      couponValue: 44.88,
      nextCouponDate: '2026-06-18',
      couponPeriod: 182,
    });

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(1055);
    expect(asset!.moexSecid).toBe('SU29010RMFS4');
  });
});
