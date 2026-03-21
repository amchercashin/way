import { useLiveQuery } from 'dexie-react-hooks';
import Dexie from 'dexie';
import { db } from '@/db/database';
import type { PaymentHistory } from '@/models/types';

export function usePaymentHistory(assetId: number) {
  return useLiveQuery(
    () => db.paymentHistory.where('[assetId+date]')
      .between([assetId, Dexie.minKey], [assetId, Dexie.maxKey])
      .toArray(),
    [assetId],
    [],
  );
}

export function useAllPaymentHistory() {
  return useLiveQuery(() => db.paymentHistory.toArray(), [], []);
}

export async function toggleExcluded(id: number): Promise<void> {
  const record = await db.paymentHistory.get(id);
  if (record) {
    await db.paymentHistory.update(id, { excluded: !record.excluded });
  }
}

export async function deletePayment(id: number): Promise<void> {
  await db.paymentHistory.delete(id);
}

export async function addPayment(payment: Omit<PaymentHistory, 'id'>): Promise<void> {
  await db.paymentHistory.add(payment);
}
