import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { exportAllData, importAllData } from '@/services/backup';

describe('backup', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('exports and imports data round-trip', async () => {
    const now = new Date();
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 800, dataSource: 'manual', createdAt: now, updatedAt: now,
    });
    await db.paymentSchedules.add({
      assetId: 1, frequencyPerYear: 1, lastPaymentAmount: 34.84, dataSource: 'moex',
    });

    const json = await exportAllData();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.assets).toHaveLength(1);

    await db.assets.clear();
    await db.paymentSchedules.clear();
    expect(await db.assets.count()).toBe(0);

    await importAllData(json);
    expect(await db.assets.count()).toBe(1);
    expect(await db.paymentSchedules.count()).toBe(1);
    const asset = (await db.assets.toArray())[0];
    expect(asset.ticker).toBe('SBER');
  });

  it('exports empty database', async () => {
    const json = await exportAllData();
    expect(JSON.parse(json).assets).toHaveLength(0);
  });

  it('import clears existing data before restoring', async () => {
    await db.assets.add({
      type: 'stock', name: 'Old', quantity: 1,
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
    });
    const json = JSON.stringify({
      version: 1, exportedAt: new Date().toISOString(),
      assets: [], paymentSchedules: [], paymentHistory: [],
      importRecords: [], settings: [],
    });
    await importAllData(json);
    expect(await db.assets.count()).toBe(0);
  });
});
