import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  fetchDohodDividends,
  isDohodAvailable,
  resetDohodCache,
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
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      expect(await isDohodAvailable('LKOH')).toBe(true);
    });

    it('returns false for ticker not in index', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      expect(await isDohodAvailable('UNKNOWN')).toBe(false);
    });

    it('returns false when index fetch fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      expect(await isDohodAvailable('LKOH')).toBe(false);
    });

    it('caches index — second call does not fetch again', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      await isDohodAvailable('LKOH');
      await isDohodAvailable('SBER');
      const indexCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('index.json'));
      expect(indexCalls).toHaveLength(1);
    });

    it('normalizes ticker to uppercase', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      expect(await isDohodAvailable('lkoh')).toBe(true);
    });
  });

  describe('fetchDohodDividends', () => {
    it('parses fact and forecast rows correctly', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX, 'dividends/LKOH.json': MOCK_LKOH });
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
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      expect(await fetchDohodDividends('UNKNOWN')).toBeNull();
    });

    it('returns null when ticker fetch fails', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      expect(await fetchDohodDividends('LKOH')).toBeNull();
    });
  });

  describe('resetDohodCache', () => {
    it('clears cache so next call fetches again', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      await isDohodAvailable('LKOH');
      resetDohodCache();
      await isDohodAvailable('SBER');
      const indexCalls = mockFetch.mock.calls.filter((c: unknown[]) => (c[0] as string).includes('index.json'));
      expect(indexCalls).toHaveLength(2);
    });
  });
});
