import { db } from '@/db/database';

export async function exportAllData(): Promise<string> {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    assets: await db.assets.toArray(),
    paymentSchedules: await db.paymentSchedules.toArray(),
    paymentHistory: await db.paymentHistory.toArray(),
    importRecords: await db.importRecords.toArray(),
    settings: await db.table('settings').toArray(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json);
  const settingsTable = db.table('settings');
  await db.transaction('rw', db.assets, db.paymentSchedules, db.paymentHistory, db.importRecords, settingsTable, async () => {
    await db.assets.clear();
    await db.paymentSchedules.clear();
    await db.paymentHistory.clear();
    await db.importRecords.clear();
    await settingsTable.clear();
    if (data.assets?.length) await db.assets.bulkAdd(data.assets);
    if (data.paymentSchedules?.length) await db.paymentSchedules.bulkAdd(data.paymentSchedules);
    if (data.paymentHistory?.length) await db.paymentHistory.bulkAdd(data.paymentHistory);
    if (data.importRecords?.length) await db.importRecords.bulkAdd(data.importRecords);
    if (data.settings?.length) {
      for (const s of data.settings) await settingsTable.put(s);
    }
  });
}
