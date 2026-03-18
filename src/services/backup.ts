import { db } from '@/db/database';

const FREQUENCY_DEFAULTS: Record<string, number> = {
  stock: 1, bond: 2, fund: 12, realestate: 12, deposit: 12, other: 12,
};

export async function exportAllData(): Promise<string> {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    assets: await db.assets.toArray(),
    paymentHistory: await db.paymentHistory.toArray(),
    importRecords: await db.importRecords.toArray(),
    settings: await db.table('settings').toArray(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Невалидный формат: некорректный JSON');
  }

  if (!data || typeof data !== 'object' || !Array.isArray(data.assets)) {
    throw new Error('Невалидный формат: отсутствует массив assets');
  }

  const settingsTable = db.table('settings');

  // Rehydrate Date fields before writing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assets = (data.assets as any[]).map((a: any) => ({
    ...a,
    createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
    updatedAt: a.updatedAt ? new Date(a.updatedAt) : new Date(),
    nextExpectedDate: a.nextExpectedDate ? new Date(a.nextExpectedDate) : undefined,
    nextExpectedCutoffDate: a.nextExpectedCutoffDate ? new Date(a.nextExpectedCutoffDate) : undefined,
    nextExpectedCreditDate: a.nextExpectedCreditDate ? new Date(a.nextExpectedCreditDate) : undefined,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentHistory = ((data.paymentHistory as any[] | undefined) ?? []).map((h: any) => ({
    ...h,
    date: h.date ? new Date(h.date) : new Date(),
  }));

  // Backward compat: migrate old format with paymentSchedules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let migratedAssets: any[] = assets;
  if ((data.paymentSchedules as unknown[] | undefined)?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scheduleByAssetId = new Map<number, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of data.paymentSchedules as any[]) {
      scheduleByAssetId.set(s.assetId as number, s);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    migratedAssets = assets.map((asset: any) => {
      if (asset.frequencyPerYear != null) return asset;
      const schedule = scheduleByAssetId.get(asset.id as number);
      const type = asset.type as string;
      const ds = asset.dataSource as string;
      return {
        ...asset,
        frequencyPerYear: schedule?.frequencyPerYear ?? FREQUENCY_DEFAULTS[type] ?? 12,
        frequencySource: schedule?.dataSource === 'moex' ? 'moex' : 'manual',
        moexFrequency: schedule?.dataSource === 'moex' ? schedule.frequencyPerYear : undefined,
        paymentPerUnitSource: schedule?.activeMetric === 'forecast' && schedule?.forecastMethod === 'manual' ? 'manual' : 'fact',
        paymentPerUnit: schedule?.activeMetric === 'forecast' && schedule?.forecastMethod === 'manual' ? schedule.forecastAmount : undefined,
        quantitySource: ds === 'import' ? 'import' : 'manual',
        importedQuantity: ds === 'import' ? asset.quantity : undefined,
        nextExpectedDate: schedule?.nextExpectedDate ? new Date(schedule.nextExpectedDate as string) : undefined,
        nextExpectedCutoffDate: schedule?.nextExpectedCutoffDate ? new Date(schedule.nextExpectedCutoffDate as string) : undefined,
        nextExpectedCreditDate: schedule?.nextExpectedCreditDate ? new Date(schedule.nextExpectedCreditDate as string) : undefined,
      };
    });
  }

  await db.transaction('rw', db.assets, db.paymentHistory, db.importRecords, settingsTable, async () => {
    await db.assets.clear();
    await db.paymentHistory.clear();
    await db.importRecords.clear();
    await settingsTable.clear();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (migratedAssets.length) await db.assets.bulkAdd(migratedAssets as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (paymentHistory.length) await db.paymentHistory.bulkAdd(paymentHistory as any);
    if ((data.importRecords as unknown[] | undefined)?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.importRecords.bulkAdd(data.importRecords as any);
    }
    if ((data.settings as unknown[] | undefined)?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of data.settings as any[]) await settingsTable.put(s);
    }
  });
}
