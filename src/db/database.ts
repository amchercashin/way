import Dexie, { type EntityTable } from 'dexie';
import type { Asset, PaymentHistory, ImportRecord } from '@/models/types';
import type { Account, Holding } from '@/models/account';

const FREQUENCY_DEFAULTS: Record<string, number> = {
  'Акции': 1, 'Облигации': 2, 'Фонды': 12,
  'Недвижимость': 12, 'Вклады': 12, 'Крипта': 12,
  // Keep old enum keys for v4 upgrade function
  stock: 1, bond: 2, fund: 12, realestate: 12, deposit: 12, other: 12,
};

class CashFlowDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  assets!: EntityTable<Asset, 'id'>;
  holdings!: EntityTable<Holding, 'id'>;
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
    this.version(2).stores({
      assets: '++id, type, ticker, isin',
    });
    this.version(3).stores({
      assets: '++id, type, ticker, isin',
      paymentSchedules: '++id, assetId',
      paymentHistory: '++id, [assetId+date]',
      importRecords: '++id, date',
      settings: 'key',
    });
    this.version(4)
      .stores({
        assets: '++id, type, ticker, isin',
        paymentSchedules: null,
        paymentHistory: '++id, [assetId+date]',
        importRecords: '++id, date',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        const schedules = await tx.table('paymentSchedules').toArray();
        const scheduleByAssetId = new Map<number, Record<string, unknown>>();
        for (const s of schedules) {
          scheduleByAssetId.set(s.assetId, s);
        }

        await tx.table('assets').toCollection().modify((asset: Record<string, unknown>) => {
          const schedule = scheduleByAssetId.get(asset.id as number);

          if (schedule) {
            asset.frequencyPerYear = schedule.frequencyPerYear;
            const isFromMoex = schedule.dataSource === 'moex';
            asset.frequencySource = isFromMoex ? 'moex' : 'manual';
            asset.moexFrequency = isFromMoex ? schedule.frequencyPerYear : undefined;

            asset.nextExpectedDate = schedule.nextExpectedDate;
            asset.nextExpectedCutoffDate = schedule.nextExpectedCutoffDate;
            asset.nextExpectedCreditDate = schedule.nextExpectedCreditDate;

            const wasManualForecast =
              schedule.activeMetric === 'forecast' &&
              schedule.forecastMethod === 'manual' &&
              schedule.forecastAmount != null;
            asset.paymentPerUnitSource = wasManualForecast ? 'manual' : 'fact';
            asset.paymentPerUnit = wasManualForecast ? schedule.forecastAmount : undefined;
          } else {
            const type = asset.type as string;
            asset.frequencyPerYear = FREQUENCY_DEFAULTS[type] ?? 12;
            asset.frequencySource = 'manual';
            asset.paymentPerUnitSource = 'fact';
          }

          const ds = asset.dataSource as string;
          asset.quantitySource = ds === 'import' ? 'import' : 'manual';
          asset.importedQuantity = ds === 'import' ? asset.quantity : undefined;
        });
      });
    this.version(5)
      .stores({
        accounts: '++id',
        assets: '++id, type, ticker, isin',
        holdings: '++id, accountId, assetId, &[accountId+assetId]',
        paymentHistory: '++id, [assetId+date]',
        importRecords: '++id, date',
        settings: 'key',
      })
      .upgrade(async (tx) => {
        await tx.table('assets').clear();
        await tx.table('paymentHistory').clear();
        await tx.table('importRecords').clear();
      });
  }
}

export const db = new CashFlowDB();
