import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  fetchDohodDividends,
  isDohodAvailable,
  resetDohodCache,
  findFundKey,
  fetchFundDistributions,
} from '@/services/heroincome-data';

const MOCK_INDEX = {
  updatedAt: '2026-03-31T14:22:20Z',
  tickerCount: 3,
  tickers: ['LKOH', 'SBER', 'GAZP'],
};

const MOCK_LKOH = {
  ticker: 'LKOH',
  scrapedAt: '2026-03-31T14:22:20Z',
  source: 'dohod.ru',
  payments: [
    { recordDate: '2026-01-12', declaredDate: '2025-11-21', amount: 397.0, year: 2025, isForecast: false },
    { recordDate: '2026-05-04', declaredDate: null, amount: 278.0, year: null, isForecast: true },
    { recordDate: '2025-06-10', declaredDate: '2025-04-01', amount: null, year: 2024, isForecast: false },
  ],
};

const MOCK_FUND_INDEX = {
  updatedAt: '2026-04-03T06:52:41Z',
  fundsCount: 2,
  funds: ['PLZ5', 'RU000A1068X9'],
};

const MOCK_PLZ5_DISTRIBUTIONS = {
  isin: 'RU000A1022Z1',
  ticker: 'PLZ5',
  name: 'ПАРУС-ОЗН',
  managementCompany: 'Parus',
  scrapedAt: '2026-04-03T06:52:38Z',
  distributions: [
    {
      paymentDate: '2026-03-13',
      recordDate: '2026-02-27',
      unitPrice: 8100.0,
      amountBeforeTax: 72.45,
      amountAfterTax: 63.03,
      yieldPrc: 10.7,
      status: 'paid',
    },
    {
      paymentDate: '2026-02-12',
      recordDate: '2026-01-30',
      unitPrice: 8100.0,
      amountBeforeTax: 68.9,
      amountAfterTax: 59.94,
      yieldPrc: 10.2,
      status: 'paid',
    },
  ],
};

function mockFetchResponses(responses: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string) => {
    for (const [pattern, data] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
      }
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
}

describe('heroincome-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDohodCache();
  });

  describe('isDohodAvailable', () => {
    it('returns true for ticker in index', async () => {
      mockFetchResponses({ 'stocks/dohod/index.json': MOCK_INDEX });
      expect(await isDohodAvailable('LKOH')).toBe(true);
    });

    it('returns false for ticker not in index', async () => {
      mockFetchResponses({ 'stocks/dohod/index.json': MOCK_INDEX });
      expect(await isDohodAvailable('UNKNOWN')).toBe(false);
    });

    it('returns false when index fetch fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      expect(await isDohodAvailable('LKOH')).toBe(false);
    });

    it('caches index — second call does not fetch again', async () => {
      mockFetchResponses({ 'stocks/dohod/index.json': MOCK_INDEX });
      await isDohodAvailable('LKOH');
      await isDohodAvailable('SBER');
      const indexCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('stocks/dohod/index.json'));
      expect(indexCalls).toHaveLength(1);
    });

    it('normalizes ticker to uppercase', async () => {
      mockFetchResponses({ 'stocks/dohod/index.json': MOCK_INDEX });
      expect(await isDohodAvailable('lkoh')).toBe(true);
    });
  });

  describe('fetchDohodDividends', () => {
    it('parses fact and forecast rows correctly', async () => {
      mockFetchResponses({ 'stocks/dohod/index.json': MOCK_INDEX, 'stocks/dohod/LKOH.json': MOCK_LKOH });
      const rows = await fetchDohodDividends('LKOH');
      expect(rows).not.toBeNull();
      expect(rows).toHaveLength(2); // amount: null filtered
      expect(rows![0].amount).toBe(397.0);
      expect(rows![0].date).toEqual(new Date('2026-01-12'));
      expect(rows![0].isForecast).toBe(false);
      expect(rows![1].amount).toBe(278.0);
      expect(rows![1].isForecast).toBe(true);
    });

    it('returns null for ticker not in index', async () => {
      mockFetchResponses({ 'stocks/dohod/index.json': MOCK_INDEX });
      expect(await fetchDohodDividends('UNKNOWN')).toBeNull();
    });

    it('returns null when ticker fetch fails', async () => {
      mockFetchResponses({ 'stocks/dohod/index.json': MOCK_INDEX });
      expect(await fetchDohodDividends('LKOH')).toBeNull();
    });
  });

  describe('resetDohodCache', () => {
    it('clears both stock and fund caches', async () => {
      mockFetchResponses({
        'stocks/dohod/index.json': MOCK_INDEX,
        'funds/index.json': MOCK_FUND_INDEX,
      });
      await isDohodAvailable('LKOH');
      await findFundKey('PLZ5');
      resetDohodCache();
      await isDohodAvailable('SBER');
      await findFundKey('PLZ5');
      const stockIndexCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('stocks/dohod/index.json'));
      const fundIndexCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('funds/index.json'));
      expect(stockIndexCalls).toHaveLength(2);
      expect(fundIndexCalls).toHaveLength(2);
    });
  });

  describe('findFundKey', () => {
    it('returns ticker when found in fund index', async () => {
      mockFetchResponses({ 'funds/index.json': MOCK_FUND_INDEX });
      expect(await findFundKey('PLZ5')).toBe('PLZ5');
    });

    it('returns ISIN when found in fund index', async () => {
      mockFetchResponses({ 'funds/index.json': MOCK_FUND_INDEX });
      expect(await findFundKey(undefined, 'RU000A1068X9')).toBe('RU000A1068X9');
    });

    it('prefers ticker match over ISIN', async () => {
      mockFetchResponses({ 'funds/index.json': MOCK_FUND_INDEX });
      expect(await findFundKey('PLZ5', 'RU000A1068X9')).toBe('PLZ5');
    });

    it('returns null when neither ticker nor ISIN found', async () => {
      mockFetchResponses({ 'funds/index.json': MOCK_FUND_INDEX });
      expect(await findFundKey('UNKNOWN', 'RU999999')).toBeNull();
    });

    it('returns null when fund index fetch fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      expect(await findFundKey('PLZ5')).toBeNull();
    });

    it('normalizes to uppercase', async () => {
      mockFetchResponses({ 'funds/index.json': MOCK_FUND_INDEX });
      expect(await findFundKey('plz5')).toBe('PLZ5');
    });

    it('caches fund index separately from stock index', async () => {
      mockFetchResponses({
        'stocks/dohod/index.json': MOCK_INDEX,
        'funds/index.json': MOCK_FUND_INDEX,
      });
      await isDohodAvailable('LKOH');
      await findFundKey('PLZ5');
      const indexCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('index.json'));
      expect(indexCalls).toHaveLength(2); // one stock, one fund
    });
  });

  describe('fetchFundDistributions', () => {
    it('parses distributions with amountBeforeTax and recordDate', async () => {
      mockFetchResponses({ 'funds/distributions/PLZ5.json': MOCK_PLZ5_DISTRIBUTIONS });
      const rows = await fetchFundDistributions('PLZ5');
      expect(rows).not.toBeNull();
      expect(rows).toHaveLength(2);
      expect(rows![0].amount).toBe(72.45);
      expect(rows![0].date).toEqual(new Date('2026-02-27'));
      expect(rows![1].amount).toBe(68.9);
      expect(rows![1].date).toEqual(new Date('2026-01-30'));
    });

    it('has no isForecast field on rows', async () => {
      mockFetchResponses({ 'funds/distributions/PLZ5.json': MOCK_PLZ5_DISTRIBUTIONS });
      const rows = await fetchFundDistributions('PLZ5');
      expect(rows![0]).not.toHaveProperty('isForecast');
    });

    it('filters out zero/null amountBeforeTax', async () => {
      mockFetchResponses({
        'funds/distributions/TEST.json': {
          ...MOCK_PLZ5_DISTRIBUTIONS,
          distributions: [
            ...MOCK_PLZ5_DISTRIBUTIONS.distributions,
            { paymentDate: '2025-12-13', recordDate: '2025-11-28', unitPrice: 8100, amountBeforeTax: 0, amountAfterTax: 0, yieldPrc: 0, status: 'paid' },
          ],
        },
      });
      const rows = await fetchFundDistributions('TEST');
      expect(rows).toHaveLength(2);
    });

    it('returns null when distribution file not found', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });
      expect(await fetchFundDistributions('UNKNOWN')).toBeNull();
    });
  });
});
