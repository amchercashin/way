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
  const data = JSON.parse(json);
  const settingsTable = db.table('settings');
  await db.transaction('rw', db.assets, db.paymentHistory, db.importRecords, settingsTable, async () => {
    await db.assets.clear();
    await db.paymentHistory.clear();
    await db.importRecords.clear();
    await settingsTable.clear();

    let assets = data.assets ?? [];

    // Backward compat: migrate old format with paymentSchedules
    if (data.paymentSchedules?.length) {
      const scheduleByAssetId = new Map<number, Record<string, unknown>>();
      for (const s of data.paymentSchedules) {
        scheduleByAssetId.set(s.assetId, s);
      }
      assets = assets.map((asset: Record<string, unknown>) => {
        if (asset.frequencyPerYear != null) return asset; // already migrated
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
          nextExpectedDate: schedule?.nextExpectedDate,
          nextExpectedCutoffDate: schedule?.nextExpectedCutoffDate,
          nextExpectedCreditDate: schedule?.nextExpectedCreditDate,
        };
      });
    }

    if (assets.length) await db.assets.bulkAdd(assets);
    if (data.paymentHistory?.length) await db.paymentHistory.bulkAdd(data.paymentHistory);
    if (data.importRecords?.length) await db.importRecords.bulkAdd(data.importRecords);
    if (data.settings?.length) {
      for (const s of data.settings) await settingsTable.put(s);
    }
  });
}
