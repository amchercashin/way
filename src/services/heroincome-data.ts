import type { DividendHistoryRow } from './moex-api';

const BASE_URL = 'https://raw.githubusercontent.com/amchercashin/heroincome-data/main/data';
const FETCH_TIMEOUT = 5000;

interface DohodPayment {
  recordDate: string;
  declaredDate: string | null;
  amount: number | null;
  year: number | null;
  isForecast: boolean;
}

interface DohodTickerData {
  ticker: string;
  scrapedAt: string;
  source: string;
  payments: DohodPayment[];
}

interface DohodIndex {
  updatedAt: string;
  tickerCount: number;
  tickers: string[];
}

export interface DohodDividendRow {
  date: Date;
  amount: number;
  isForecast: boolean;
}

// ---- Fund distribution types ----

interface FundDistributionRaw {
  paymentDate: string;
  recordDate: string;
  unitPrice: number;
  amountBeforeTax: number;
  amountAfterTax: number;
  yieldPrc: number;
  status: string;
}

interface FundDistributionData {
  isin: string;
  ticker: string | null;
  name: string;
  managementCompany: string;
  scrapedAt: string;
  distributions: FundDistributionRaw[];
}

interface FundIndex {
  updatedAt: string;
  fundsCount: number;
  funds: string[];
}

// ---- Caches ----

let cachedStockIndex: DohodIndex | null | undefined; // undefined = not fetched
let cachedFundIndex: FundIndex | null | undefined;

export function resetDohodCache(): void {
  cachedStockIndex = undefined;
  cachedFundIndex = undefined;
}

// ---- Shared fetch ----

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ---- Stock dohod ----

async function fetchDohodIndex(): Promise<DohodIndex | null> {
  if (cachedStockIndex !== undefined) return cachedStockIndex;
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/stocks/dohod/index.json`);
    if (!res.ok) { cachedStockIndex = null; return null; }
    cachedStockIndex = (await res.json()) as DohodIndex;
    return cachedStockIndex;
  } catch {
    cachedStockIndex = null;
    return null;
  }
}

export async function isDohodAvailable(ticker: string): Promise<boolean> {
  const index = await fetchDohodIndex();
  if (!index) return false;
  return index.tickers.includes(ticker.toUpperCase());
}

export async function fetchDohodDividends(ticker: string): Promise<DohodDividendRow[] | null> {
  const available = await isDohodAvailable(ticker);
  if (!available) return null;
  try {
    const upperTicker = ticker.toUpperCase();
    const res = await fetchWithTimeout(`${BASE_URL}/stocks/dohod/${upperTicker}.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as DohodTickerData;
    return data.payments
      .filter((p) => p.amount != null)
      .map((p) => ({ date: new Date(p.recordDate), amount: p.amount!, isForecast: p.isForecast }));
  } catch {
    return null;
  }
}

// ---- Fund distributions ----

async function fetchFundIndex(): Promise<FundIndex | null> {
  if (cachedFundIndex !== undefined) return cachedFundIndex;
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/funds/index.json`);
    if (!res.ok) { cachedFundIndex = null; return null; }
    cachedFundIndex = (await res.json()) as FundIndex;
    return cachedFundIndex;
  } catch {
    cachedFundIndex = null;
    return null;
  }
}

export async function findFundKey(ticker?: string, isin?: string): Promise<string | null> {
  const index = await fetchFundIndex();
  if (!index) return null;
  if (ticker) {
    const upper = ticker.toUpperCase();
    if (index.funds.includes(upper)) return upper;
  }
  if (isin) {
    const upper = isin.toUpperCase();
    if (index.funds.includes(upper)) return upper;
  }
  return null;
}

export async function fetchFundDistributions(key: string): Promise<DividendHistoryRow[] | null> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/funds/distributions/${key}.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as FundDistributionData;
    return data.distributions
      .filter((d) => d.amountBeforeTax != null && d.amountBeforeTax > 0)
      .map((d) => ({
        date: new Date(d.recordDate),
        amount: d.amountBeforeTax,
      }));
  } catch {
    return null;
  }
}
