import { db } from '@/db/database';

export interface AppSettings {
  defaultPeriod: 'month' | 'year';
}

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await db.table('settings').toArray();
  const map = new Map(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    defaultPeriod: (map.get('defaultPeriod') ?? 'month') as 'month' | 'year',
  };
}

export async function updateAppSetting(key: string, value: string): Promise<void> {
  await db.table('settings').put({ key, value });
}

export async function clearAllData(): Promise<void> {
  await db.delete();
  await db.open();
}
