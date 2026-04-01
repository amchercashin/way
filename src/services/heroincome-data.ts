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

let cachedIndex: DohodIndex | null | undefined; // undefined = not fetched

export function resetDohodCache(): void {
  cachedIndex = undefined;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchDohodIndex(): Promise<DohodIndex | null> {
  if (cachedIndex !== undefined) return cachedIndex;
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/index.json`);
    if (!res.ok) { cachedIndex = null; return null; }
    cachedIndex = (await res.json()) as DohodIndex;
    return cachedIndex;
  } catch {
    cachedIndex = null;
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
    const res = await fetchWithTimeout(`${BASE_URL}/dividends/${upperTicker}.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as DohodTickerData;
    return data.payments
      .filter((p) => p.amount != null)
      .map((p) => ({ date: new Date(p.recordDate), amount: p.amount!, isForecast: p.isForecast }));
  } catch {
    return null;
  }
}
