import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';

const NDFL_PREFIX = 'ndfl-';
const EMPTY_MAP = new Map<string, number>();

export function useNdflRates(): Map<string, number> {
  const rates = useLiveQuery(async () => {
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
  }, []);

  return rates ?? EMPTY_MAP;
}
