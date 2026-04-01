import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { reconcilePayments } from '@/services/payment-reconciler';

describe('reconcilePayments', () => {
  let assetId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    assetId = (await db.assets.add({
      type: 'Акции', ticker: 'GAZP', name: 'Газпром',
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
      paymentPerUnitSource: 'fact' as const, frequencyPerYear: 1, frequencySource: 'moex' as const,
    })) as number;
  });

  it('excludes MOEX-only payment when dohod is authoritative', async () => {
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'dohod' },
      { assetId, amount: 8, date: new Date('2023-07-18'), type: 'dividend', dataSource: 'dohod' },
    ]);
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'moex' },
      { assetId, amount: 8, date: new Date('2023-07-18'), type: 'dividend', dataSource: 'moex' },
      { assetId, amount: 5, date: new Date('2022-10-20'), type: 'dividend', dataSource: 'moex' },
    ]);

    await reconcilePayments(assetId, 'Акции');

    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    const moexExtra = records.find(r => r.dataSource === 'moex' && r.date.getTime() === new Date('2022-10-20').getTime());
    expect(moexExtra!.excluded).toBe(true);

    const moexMatched = records.filter(r => r.dataSource === 'moex' && !r.excluded);
    expect(moexMatched).toHaveLength(2);

    const dohodRecords = records.filter(r => r.dataSource === 'dohod');
    expect(dohodRecords.every(r => !r.excluded)).toBe(true);
  });

  it('falls back to MOEX when dohod has no records', async () => {
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'moex' },
      { assetId, amount: 8, date: new Date('2023-07-18'), type: 'dividend', dataSource: 'moex' },
    ]);

    await reconcilePayments(assetId, 'Акции');

    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    expect(records.every(r => !r.excluded)).toBe(true);
  });

  it('never touches manual records', async () => {
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'dohod' },
      { assetId, amount: 99, date: new Date('2020-01-01'), type: 'dividend', dataSource: 'manual' },
    ]);

    await reconcilePayments(assetId, 'Акции');

    const manual = await db.paymentHistory.where('assetId').equals(assetId)
      .filter(r => r.dataSource === 'manual').toArray();
    expect(manual).toHaveLength(1);
    expect(manual[0].excluded).toBeUndefined();
  });

  it('does not use forecast records as authorityDates', async () => {
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'dohod' },
      { assetId, amount: 5, date: new Date('2025-05-04'), type: 'dividend', dataSource: 'dohod', isForecast: true },
    ]);
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'moex' },
      { assetId, amount: 3, date: new Date('2022-10-20'), type: 'dividend', dataSource: 'moex' },
    ]);

    await reconcilePayments(assetId, 'Акции');

    const moexOrphan = (await db.paymentHistory.where('assetId').equals(assetId).toArray())
      .find(r => r.dataSource === 'moex' && r.date.getTime() === new Date('2022-10-20').getTime());
    expect(moexOrphan!.excluded).toBe(true);
  });

  it('restores previously auto-excluded record when authority now matches', async () => {
    await db.paymentHistory.add({
      assetId, amount: 10, date: new Date('2024-07-18'),
      type: 'dividend', dataSource: 'moex', excluded: true,
    });
    await db.paymentHistory.add({
      assetId, amount: 10, date: new Date('2024-07-18'),
      type: 'dividend', dataSource: 'dohod',
    });

    await reconcilePayments(assetId, 'Акции');

    const moexRecord = (await db.paymentHistory.where('assetId').equals(assetId).toArray())
      .find(r => r.dataSource === 'moex');
    expect(moexRecord!.excluded).toBe(false);
  });

  it('uses MOEX as authority for bonds (no dohod source)', async () => {
    const bondId = (await db.assets.add({
      type: 'Облигации', ticker: 'SU26238', name: 'ОФЗ 26238',
      dataSource: 'manual', createdAt: new Date(), updatedAt: new Date(),
      paymentPerUnitSource: 'fact' as const, frequencyPerYear: 2, frequencySource: 'moex' as const,
    })) as number;

    await db.paymentHistory.bulkAdd([
      { assetId: bondId, amount: 35.4, date: new Date('2024-06-03'), type: 'coupon', dataSource: 'moex' },
      { assetId: bondId, amount: 35.4, date: new Date('2024-12-03'), type: 'coupon', dataSource: 'moex' },
    ]);

    await reconcilePayments(bondId, 'Облигации');

    const records = await db.paymentHistory.where('assetId').equals(bondId).toArray();
    expect(records.every(r => !r.excluded)).toBe(true);
  });

  it('handles empty payment history gracefully', async () => {
    await reconcilePayments(assetId, 'Акции');
    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    expect(records).toHaveLength(0);
  });
});
