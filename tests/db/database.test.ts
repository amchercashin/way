import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import type { Asset } from '@/models/types';

describe('Database', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('adds and retrieves an asset', async () => {
    const asset: Asset = {
      type: 'stock',
      ticker: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      averagePrice: 298.6,
      currentPrice: 308.2,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const id = await db.assets.add(asset);
    const retrieved = await db.assets.get(id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.ticker).toBe('SBER');
    expect(retrieved!.quantity).toBe(800);
  });

  it('adds and retrieves payment schedule', async () => {
    const assetId = await db.assets.add({
      type: 'stock',
      name: 'Сбербанк',
      ticker: 'SBER',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.paymentSchedules.add({
      assetId: assetId as number,
      frequencyPerYear: 1,
      lastPaymentAmount: 186,
      dataSource: 'manual',
    });

    const schedules = await db.paymentSchedules
      .where('assetId')
      .equals(assetId as number)
      .toArray();

    expect(schedules).toHaveLength(1);
    expect(schedules[0].lastPaymentAmount).toBe(186);
  });

  it('queries assets by type', async () => {
    const now = new Date();
    await db.assets.bulkAdd([
      { type: 'stock', name: 'Сбер', ticker: 'SBER', quantity: 100, dataSource: 'manual', createdAt: now, updatedAt: now },
      { type: 'stock', name: 'Лукойл', ticker: 'LKOH', quantity: 10, dataSource: 'manual', createdAt: now, updatedAt: now },
      { type: 'bond', name: 'ОФЗ 26238', ticker: 'SU26238', quantity: 50, dataSource: 'manual', createdAt: now, updatedAt: now },
    ]);

    const stocks = await db.assets.where('type').equals('stock').toArray();
    expect(stocks).toHaveLength(2);

    const bonds = await db.assets.where('type').equals('bond').toArray();
    expect(bonds).toHaveLength(1);
  });
});
