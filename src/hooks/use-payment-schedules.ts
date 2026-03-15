import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { PaymentSchedule } from '@/models/types';

export function usePaymentSchedule(assetId: number) {
  const schedule = useLiveQuery(
    () => db.paymentSchedules.where('assetId').equals(assetId).first(),
    [assetId],
  );
  return schedule;
}

export function useAllPaymentSchedules() {
  const schedules = useLiveQuery(() => db.paymentSchedules.toArray()) ?? [];
  return schedules;
}

export async function upsertPaymentSchedule(
  assetId: number,
  data: Omit<PaymentSchedule, 'id' | 'assetId'>,
): Promise<void> {
  const existing = await db.paymentSchedules.where('assetId').equals(assetId).first();
  if (existing) {
    await db.paymentSchedules.update(existing.id!, { ...data });
  } else {
    await db.paymentSchedules.add({ ...data, assetId });
  }
}
