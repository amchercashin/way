import { db } from '@/db/database';

const NDFL_PREFIX = 'ndfl-';

export async function updateAppSetting(key: string, value: string): Promise<void> {
  await db.table('settings').put({ key, value });
}

export async function clearAllData(): Promise<void> {
  await db.delete();
  await db.open();
}

export async function getNdflRates(): Promise<Map<string, number>> {
  const rows: { key: string; value: string }[] = await db.table('settings').toArray();
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.key.startsWith(NDFL_PREFIX)) {
      const category = row.key.slice(NDFL_PREFIX.length);
      const rate = Number(row.value);
      if (isFinite(rate)) map.set(category, rate);
    }
  }
  return map;
}

export async function updateNdflRate(category: string, rate: number): Promise<void> {
  await db.table('settings').put({ key: `${NDFL_PREFIX}${category}`, value: String(rate) });
}
