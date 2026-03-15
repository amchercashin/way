import Dexie, { type EntityTable } from 'dexie';
import type { Asset, PaymentSchedule, PaymentHistory, ImportRecord } from '@/models/types';

class CashFlowDB extends Dexie {
  assets!: EntityTable<Asset, 'id'>;
  paymentSchedules!: EntityTable<PaymentSchedule, 'id'>;
  paymentHistory!: EntityTable<PaymentHistory, 'id'>;
  importRecords!: EntityTable<ImportRecord, 'id'>;

  constructor() {
    super('CashFlowDB');
    this.version(1).stores({
      assets: '++id, type, ticker',
      paymentSchedules: '++id, assetId',
      paymentHistory: '++id, assetId, date',
      importRecords: '++id, date',
      settings: 'key',
    });
  }
}

export const db = new CashFlowDB();
