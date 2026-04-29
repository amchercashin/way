import type { Asset, DataSource } from '@/models/types';
import { getDefaultFrequency } from '@/models/account';
import { normalizeCurrency } from './exchange-rates';

export interface CreateAssetDraftInput {
  type: string;
  ticker?: string;
  isin?: string;
  name: string;
  currency?: string;
  currentPrice?: number;
  faceValue?: number;
  accruedInterest?: number;
  emitter?: string;
  securityCategory?: string;
  issueInfo?: string;
  dataSource: DataSource;
  paymentPerUnit?: number;
  paymentPerUnitSource?: Asset['paymentPerUnitSource'];
  frequencyPerYear?: number;
  frequencySource?: Asset['frequencySource'];
  now?: Date;
}

export function createAssetDraft(input: CreateAssetDraftInput): Omit<Asset, 'id'> {
  const now = input.now ?? new Date();
  const frequencyPerYear = input.frequencyPerYear ?? getDefaultFrequency(input.type) ?? 12;

  return {
    type: input.type,
    ticker: input.ticker,
    isin: input.isin,
    name: input.name,
    currency: normalizeCurrency(input.currency),
    currentPrice: input.currentPrice,
    faceValue: input.faceValue,
    accruedInterest: input.accruedInterest,
    emitter: input.emitter,
    securityCategory: input.securityCategory,
    issueInfo: input.issueInfo,
    dataSource: input.dataSource,
    paymentPerUnit: input.paymentPerUnit,
    paymentPerUnitSource: input.paymentPerUnitSource ?? 'fact',
    frequencyPerYear,
    frequencySource: input.frequencySource ?? 'manual',
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeAssetDefaults<T extends Partial<Asset>>(asset: T): T & {
  currency: string;
  frequencySource: Asset['frequencySource'];
} {
  return {
    ...asset,
    currency: normalizeCurrency(asset.currency),
    frequencySource: asset.frequencySource ?? 'manual',
  };
}
