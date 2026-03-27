import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { updateAppSetting, getNdflRates, updateNdflRate } from '@/services/app-settings';

describe('app-settings', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('persists and reads a setting', async () => {
    await updateAppSetting('someKey', 'someValue');
    const rows = await db.table('settings').toArray();
    expect(rows).toContainEqual({ key: 'someKey', value: 'someValue' });
  });

  describe('ndfl rates', () => {
    it('returns empty map when no rates are set', async () => {
      const rates = await getNdflRates();
      expect(rates.size).toBe(0);
    });

    it('stores and retrieves a rate for a category', async () => {
      await updateNdflRate('Акции', 13);
      const rates = await getNdflRates();
      expect(rates.get('Акции')).toBe(13);
    });

    it('handles multiple categories independently', async () => {
      await updateNdflRate('Акции', 13);
      await updateNdflRate('Облигации', 15);
      await updateNdflRate('Вклады', 0);
      const rates = await getNdflRates();
      expect(rates.get('Акции')).toBe(13);
      expect(rates.get('Облигации')).toBe(15);
      expect(rates.get('Вклады')).toBe(0);
    });

    it('overwrites previous rate for same category', async () => {
      await updateNdflRate('Акции', 13);
      await updateNdflRate('Акции', 15);
      const rates = await getNdflRates();
      expect(rates.get('Акции')).toBe(15);
    });

    it('ignores non-ndfl settings keys', async () => {
      await updateAppSetting('defaultPeriod', 'year');
      await updateNdflRate('Акции', 13);
      const rates = await getNdflRates();
      expect(rates.size).toBe(1);
      expect(rates.has('Акции')).toBe(true);
    });

    it('handles custom fractional rates', async () => {
      await updateNdflRate('Недвижимость', 6.5);
      const rates = await getNdflRates();
      expect(rates.get('Недвижимость')).toBe(6.5);
    });
  });
});
