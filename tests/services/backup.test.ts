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
      quantity: 800, quantitySource: 'manual',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'manual', createdAt: now, updatedAt: now,
    });

    const json = await exportAllData();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(2);
    expect(parsed.assets).toHaveLength(1);
    expect(parsed.paymentSchedules).toBeUndefined();

    await db.assets.clear();
    expect(await db.assets.count()).toBe(0);

    await importAllData(json);
    expect(await db.assets.count()).toBe(1);
    const asset = (await db.assets.toArray())[0];
    expect(asset.ticker).toBe('SBER');
    expect(asset.frequencyPerYear).toBe(1);
  });

  it('exports empty database', async () => {
    const json = await exportAllData();
    expect(JSON.parse(json).assets).toHaveLength(0);
  });

  it('migrates old backup with paymentSchedules into Asset fields', async () => {
    const oldBackup = {
      version: 1,
      assets: [{
        id: 1, type: 'stock', ticker: 'SBER', name: 'Сбербанк',
        quantity: 800, dataSource: 'import',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }],
      paymentSchedules: [{
        id: 1, assetId: 1, frequencyPerYear: 1,
        lastPaymentAmount: 50, dataSource: 'moex',
        activeMetric: 'forecast', forecastMethod: 'manual', forecastAmount: 42,
      }],
      paymentHistory: [],
      importRecords: [],
      settings: [],
    };
    await importAllData(JSON.stringify(oldBackup));

    const assets = await db.assets.toArray();
    expect(assets).toHaveLength(1);
    expect(assets[0].frequencyPerYear).toBe(1);
    expect(assets[0].frequencySource).toBe('moex');
    expect(assets[0].moexFrequency).toBe(1);
    expect(assets[0].paymentPerUnitSource).toBe('manual');
    expect(assets[0].paymentPerUnit).toBe(42);
    expect(assets[0].quantitySource).toBe('import');
    expect(assets[0].importedQuantity).toBe(800);
  });

  it('rejects invalid JSON', async () => {
    await expect(importAllData('not json')).rejects.toThrow('Невалидный формат');
  });

  it('rejects JSON without assets array', async () => {
    await expect(importAllData(JSON.stringify({ foo: 'bar' }))).rejects.toThrow('Невалидный формат');
  });

  it('rejects JSON with non-array assets', async () => {
    await expect(importAllData(JSON.stringify({ assets: 'string' }))).rejects.toThrow('Невалидный формат');
  });

  it('preserves existing data when import validation fails', async () => {
    const now = new Date();
    await db.assets.add({
      type: 'stock', ticker: 'KEEP', name: 'Keep Me',
      quantity: 1, quantitySource: 'manual',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'manual', createdAt: now, updatedAt: now,
    });

    await expect(importAllData('not json')).rejects.toThrow();
    expect(await db.assets.count()).toBe(1);
    const kept = (await db.assets.toArray())[0];
    expect(kept.ticker).toBe('KEEP');
  });

  it('rehydrates Date fields from ISO strings on import', async () => {
    const now = new Date();
    await db.assets.add({
      type: 'stock', ticker: 'SBER', name: 'Сбербанк',
      quantity: 800, quantitySource: 'manual',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'manual', createdAt: now, updatedAt: now,
    });
    await db.paymentHistory.add({
      assetId: 1, amount: 34.84, date: new Date('2025-07-18'),
      type: 'dividend', dataSource: 'moex',
    });

    const json = await exportAllData();
    await importAllData(json);

    const history = await db.paymentHistory.toArray();
    expect(history[0].date).toBeInstanceOf(Date);
    expect(history[0].date.getTime()).toBe(new Date('2025-07-18').getTime());

    const assets = await db.assets.toArray();
    expect(assets[0].createdAt).toBeInstanceOf(Date);
  });

  it('import clears existing data before restoring', async () => {
    await db.assets.add({
      type: 'stock', name: 'Old', quantity: 1,
      quantitySource: 'manual', paymentPerUnitSource: 'fact',
      frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
    });
    const json = JSON.stringify({
      version: 2, exportedAt: new Date().toISOString(),
      assets: [], paymentHistory: [],
      importRecords: [], settings: [],
    });
    await importAllData(json);
    expect(await db.assets.count()).toBe(0);
  });
});
