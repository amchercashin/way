import { describe, expect, it } from 'vitest';
import { createAssetDraft, normalizeAssetDefaults } from '@/services/asset-factory';

describe('asset-factory', () => {
  it('creates imported assets with explicit currency and source fields', () => {
    const now = new Date('2026-04-28T10:00:00Z');

    const asset = createAssetDraft({
      type: 'Акции',
      ticker: 'SBER',
      name: 'Сбербанк',
      dataSource: 'import',
      currentPrice: 300,
      now,
    });

    expect(asset).toMatchObject({
      type: 'Акции',
      ticker: 'SBER',
      name: 'Сбербанк',
      currency: 'RUB',
      dataSource: 'import',
      paymentPerUnitSource: 'fact',
      frequencyPerYear: 1,
      frequencySource: 'manual',
      createdAt: now,
      updatedAt: now,
    });
  });

  it('normalizes legacy assets without currency or frequency source', () => {
    const asset = normalizeAssetDefaults({
      type: 'Фонды',
      name: 'Фонд',
      dataSource: 'manual',
      paymentPerUnitSource: 'fact',
      frequencyPerYear: 12,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(asset.currency).toBe('RUB');
    expect(asset.frequencySource).toBe('manual');
  });
});
