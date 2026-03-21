import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { computeImportDiff } from '@/services/import-diff';
import { applyImportDiff } from '@/services/import-applier';
import type { ImportAssetRow } from '@/services/import-parser';

describe('applyImportDiff (account-scoped)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates account when accountId is null', async () => {
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800, averagePrice: 298.60 },
    ];
    const diff = await computeImportDiff(rows, null);
    const { record, accountId } = await applyImportDiff(diff, 'sber_html', 'Сбер 40R9B');

    expect(accountId).toBeGreaterThan(0);
    const account = await db.accounts.get(accountId);
    expect(account).toBeDefined();
    expect(account!.name).toBe('Сбер 40R9B');
    expect(record.accountId).toBe(accountId);
  });

  it('creates assets and holdings for added items', async () => {
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800,
        averagePrice: 298.60, lastPaymentAmount: 34.84, frequencyPerYear: 1 },
      { ticker: 'LKOH', name: 'Лукойл', type: 'Акции', quantity: 10 },
    ];
    const diff = await computeImportDiff(rows, null);
    const { record, accountId } = await applyImportDiff(diff, 'ai_import', 'Тестовый');

    expect(record.itemsAdded).toBe(2);

    const assets = await db.assets.toArray();
    expect(assets).toHaveLength(2);
    const sber = assets.find(a => a.ticker === 'SBER')!;
    expect(sber.name).toBe('Сбербанк');
    expect(sber.dataSource).toBe('import');
    expect(sber.paymentPerUnit).toBe(34.84);
    expect(sber.paymentPerUnitSource).toBe('manual');
    expect(sber.frequencyPerYear).toBe(1);
    expect(sber.frequencySource).toBeUndefined();

    const holdings = await db.holdings.where('accountId').equals(accountId).toArray();
    expect(holdings).toHaveLength(2);
    const sberHolding = holdings.find(h => h.assetId === sber.id)!;
    expect(sberHolding.quantity).toBe(800);
    expect(sberHolding.quantitySource).toBe('import');
    expect(sberHolding.importedQuantity).toBe(800);
    expect(sberHolding.averagePrice).toBe(298.60);
  });

  it('reuses existing asset when adding holding to new account', async () => {
    // Pre-existing asset (from another account)
    const existingAssetId = await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк Обновлённый', type: 'Акции', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, null);
    const { accountId } = await applyImportDiff(diff, 'csv', 'Новый счёт');

    // Should NOT create a new asset — reuse existing
    const assets = await db.assets.toArray();
    expect(assets).toHaveLength(1);
    expect(assets[0].id).toBe(existingAssetId);
    expect(assets[0].name).toBe('Сбербанк Обновлённый'); // updated

    const holdings = await db.holdings.where('accountId').equals(accountId).toArray();
    expect(holdings).toHaveLength(1);
    expect(holdings[0].assetId).toBe(existingAssetId);
  });

  it('updates holdings on re-import (changed items)', async () => {
    const accId = await db.accounts.add({ name: 'Тест', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId = await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    const holdingId = await db.holdings.add({
      accountId: accId, assetId, quantity: 500, quantitySource: 'import',
      importedQuantity: 500, averagePrice: 250,
      createdAt: new Date(), updatedAt: new Date(),
    }) as number;

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800, averagePrice: 298.60 },
    ];
    const diff = await computeImportDiff(rows, accId);
    const { record } = await applyImportDiff(diff, 'sber_html');

    expect(record.itemsChanged).toBe(1);

    const holding = await db.holdings.get(holdingId);
    expect(holding!.quantity).toBe(800);
    expect(holding!.importedQuantity).toBe(800);
    expect(holding!.averagePrice).toBe(298.60);
  });

  it('deletes removed holdings and cleans up orphaned assets', async () => {
    const accId = await db.accounts.add({ name: 'Тест', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId1 = await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    const assetId2 = await db.assets.add({
      type: 'Акции', ticker: 'LKOH', name: 'Лукойл',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.holdings.add({
      accountId: accId, assetId: assetId1, quantity: 800, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });
    await db.holdings.add({
      accountId: accId, assetId: assetId2, quantity: 10, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });
    // Add payment history for LKOH to verify cleanup
    await db.paymentHistory.add({
      assetId: assetId2, amount: 500, date: new Date(),
      type: 'dividend', dataSource: 'import',
    });

    // Re-import: only SBER remains, LKOH removed
    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800 },
    ];
    const diff = await computeImportDiff(rows, accId);
    const { record } = await applyImportDiff(diff, 'sber_html');

    expect(record.itemsUnchanged).toBe(1);
    expect(record.itemsRemoved).toBe(1);

    // LKOH holding should be deleted
    const holdings = await db.holdings.where('accountId').equals(accId).toArray();
    expect(holdings).toHaveLength(1);
    expect(holdings[0].assetId).toBe(assetId1);

    // LKOH asset should be deleted (orphaned)
    const assets = await db.assets.toArray();
    expect(assets).toHaveLength(1);
    expect(assets[0].ticker).toBe('SBER');

    // LKOH payment history should be deleted
    const payments = await db.paymentHistory.toArray();
    expect(payments).toHaveLength(0);
  });

  it('keeps asset when removing holding if another account holds it', async () => {
    const accId1 = await db.accounts.add({ name: 'Счёт 1', createdAt: new Date(), updatedAt: new Date() }) as number;
    const accId2 = await db.accounts.add({ name: 'Счёт 2', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId = await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.holdings.add({
      accountId: accId1, assetId, quantity: 800, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });
    await db.holdings.add({
      accountId: accId2, assetId, quantity: 100, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });

    // Re-import into accId1 with empty report → SBER removed from accId1
    const diff = await computeImportDiff([], accId1);
    await applyImportDiff(diff, 'sber_html');

    // Holding removed from accId1
    const h1 = await db.holdings.where('accountId').equals(accId1).toArray();
    expect(h1).toHaveLength(0);

    // But asset still exists because accId2 still holds it
    const assets = await db.assets.toArray();
    expect(assets).toHaveLength(1);
    expect(assets[0].ticker).toBe('SBER');

    // accId2 holding untouched
    const h2 = await db.holdings.where('accountId').equals(accId2).toArray();
    expect(h2).toHaveLength(1);
  });

  it('creates ImportRecord with correct counts', async () => {
    const accId = await db.accounts.add({ name: 'Тест', createdAt: new Date(), updatedAt: new Date() }) as number;
    const assetId = await db.assets.add({
      type: 'Акции', ticker: 'SBER', name: 'Сбербанк',
      paymentPerUnitSource: 'fact', frequencyPerYear: 1, frequencySource: 'manual',
      dataSource: 'import', createdAt: new Date(), updatedAt: new Date(),
    }) as number;
    await db.holdings.add({
      accountId: accId, assetId, quantity: 500, quantitySource: 'import',
      createdAt: new Date(), updatedAt: new Date(),
    });

    const rows: ImportAssetRow[] = [
      { ticker: 'SBER', name: 'Сбербанк', type: 'Акции', quantity: 800 },
      { ticker: 'LKOH', name: 'Лукойл', type: 'Акции', quantity: 10 },
    ];
    const diff = await computeImportDiff(rows, accId);
    await applyImportDiff(diff, 'ai_import');

    const records = await db.importRecords.toArray();
    expect(records).toHaveLength(1);
    expect(records[0].source).toBe('ai_import');
    expect(records[0].accountId).toBe(accId);
    expect(records[0].itemsChanged).toBe(1);  // SBER quantity changed
    expect(records[0].itemsAdded).toBe(1);    // LKOH new
    expect(records[0].itemsUnchanged).toBe(0);
    expect(records[0].itemsRemoved).toBe(0);
  });
});
