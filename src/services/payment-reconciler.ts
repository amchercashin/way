import { db } from '@/db/database';
import type { DataSource } from '@/models/types';

const PAYMENT_SOURCE_PRIORITY: Record<string, DataSource[]> = {
  'Акции': ['dohod', 'moex'],
  'Облигации': ['moex'],
  'Фонды': ['moex'],
};

export async function reconcilePayments(
  assetId: number,
  assetType: string,
): Promise<void> {
  const all = await db.paymentHistory.where('assetId').equals(assetId).toArray();
  if (all.length === 0) return;

  const priority = PAYMENT_SOURCE_PRIORITY[assetType];
  if (!priority) return;

  // Find authoritative source: first with ≥1 non-forecast fact record
  let authSource: DataSource | null = null;
  for (const source of priority) {
    if (all.some(r => r.dataSource === source && !r.isForecast)) {
      authSource = source;
      break;
    }
  }
  if (!authSource) return;

  // Collect authority dates (fact records only)
  const authorityDates = new Set(
    all.filter(r => r.dataSource === authSource && !r.isForecast).map(r => r.date.getTime()),
  );

  // Lower-priority sources
  const authIndex = priority.indexOf(authSource);
  const lowerSources = new Set(priority.slice(authIndex + 1));

  // Update excluded flag on lower-priority records
  const updates: { id: number; excluded: boolean }[] = [];
  for (const record of all) {
    if (record.dataSource === 'manual') continue;
    if (record.dataSource === authSource) continue;
    if (!lowerSources.has(record.dataSource)) continue;
    if (record.isForecast) continue;

    const shouldExclude = !authorityDates.has(record.date.getTime());
    const currentlyExcluded = record.excluded ?? false;
    if (shouldExclude !== currentlyExcluded) {
      updates.push({ id: record.id!, excluded: shouldExclude });
    }
  }

  if (updates.length > 0) {
    await db.transaction('rw', db.paymentHistory, async () => {
      for (const u of updates) {
        await db.paymentHistory.update(u.id, { excluded: u.excluded });
      }
    });
  }
}
