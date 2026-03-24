// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { enrichFromMoex, mapMoexMarketToType } from '@/services/moex-enrich';
import type { ImportAssetRow } from '@/services/import-parser';

// Mock resolveSecurityFull
vi.mock('@/services/moex-api', () => ({
  resolveSecurityFull: vi.fn(),
}));
import { resolveSecurityFull } from '@/services/moex-api';
const mockResolve = vi.mocked(resolveSecurityFull);

afterEach(() => vi.resetAllMocks());

describe('mapMoexMarketToType', () => {
  it('maps bonds to Облигации', () => {
    expect(mapMoexMarketToType('bonds', 'TQCB')).toBe('Облигации');
  });

  it('maps shares on TQTF to Фонды', () => {
    expect(mapMoexMarketToType('shares', 'TQTF')).toBe('Фонды');
  });

  it('maps shares on TQIF to Фонды', () => {
    expect(mapMoexMarketToType('shares', 'TQIF')).toBe('Фонды');
  });

  it('maps shares on TQPI to Фонды', () => {
    expect(mapMoexMarketToType('shares', 'TQPI')).toBe('Фонды');
  });

  it('maps shares on TQBR to Акции', () => {
    expect(mapMoexMarketToType('shares', 'TQBR')).toBe('Акции');
  });
});

describe('enrichFromMoex', () => {
  it('fills type and ticker for Прочее row with ISIN', async () => {
    mockResolve.mockResolvedValueOnce({
      secid: 'RU000A10CFM8', primaryBoardId: 'TQIF', market: 'shares',
      shortName: 'ЗПИФ Тест', emitter: 'УК Тест',
    });

    const rows: ImportAssetRow[] = [{
      isin: 'RU000A10CFM8', name: 'RU000A10CFM8', type: 'Прочее',
      quantity: 389,
    }];

    const result = await enrichFromMoex(rows);
    expect(result[0].type).toBe('Фонды');
    expect(result[0].ticker).toBe('RU000A10CFM8');
    expect(result[0].name).toBe('ЗПИФ Тест');
    expect(result[0].emitter).toBe('УК Тест');
  });

  it('does NOT overwrite existing type/ticker/name', async () => {
    mockResolve.mockResolvedValueOnce({
      secid: 'GAZP', primaryBoardId: 'TQBR', market: 'shares',
      shortName: 'Газпром', emitter: 'ПАО Газпром',
    });

    const rows: ImportAssetRow[] = [{
      isin: 'RU0007661625', ticker: 'GAZP', name: 'ГАЗПРОМ ао',
      type: 'Акции', quantity: 100, emitter: 'Газпром ПАО',
    }];

    const result = await enrichFromMoex(rows);
    expect(result[0].type).toBe('Акции');
    expect(result[0].ticker).toBe('GAZP');
    expect(result[0].name).toBe('ГАЗПРОМ ао');
    expect(result[0].emitter).toBe('Газпром ПАО');
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('skips rows without ISIN', async () => {
    const rows: ImportAssetRow[] = [{
      name: 'Недвижимость', type: 'Прочее', quantity: 1,
    }];

    const result = await enrichFromMoex(rows);
    expect(result[0].type).toBe('Прочее');
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('handles MOEX returning null gracefully', async () => {
    mockResolve.mockResolvedValueOnce(null);

    const rows: ImportAssetRow[] = [{
      isin: 'RU000XXXXXXX', name: 'RU000XXXXXXX', type: 'Прочее',
      quantity: 10,
    }];

    const result = await enrichFromMoex(rows);
    expect(result[0].type).toBe('Прочее');
    expect(result[0].name).toBe('RU000XXXXXXX');
  });

  it('fills ticker when ticker equals ISIN (fund case)', async () => {
    mockResolve.mockResolvedValueOnce({
      secid: 'TMOS', primaryBoardId: 'TQTF', market: 'shares',
      shortName: 'Тинькофф iMOEX',
    });

    const rows: ImportAssetRow[] = [{
      isin: 'RU000A101X76', ticker: 'RU000A101X76', name: 'Тинькофф iMOEX',
      type: 'Фонды', quantity: 50,
    }];

    const result = await enrichFromMoex(rows);
    expect(result[0].ticker).toBe('TMOS');
  });

  it('handles network error gracefully', async () => {
    mockResolve.mockRejectedValueOnce(new Error('timeout'));

    const rows: ImportAssetRow[] = [{
      isin: 'RU000A10CFM8', name: 'RU000A10CFM8', type: 'Прочее',
      quantity: 389,
    }];

    const result = await enrichFromMoex(rows);
    expect(result[0].type).toBe('Прочее');
  });
});
