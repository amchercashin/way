import type { AssetType } from '@/models/types';

export interface ImportAssetRow {
  ticker?: string;
  isin?: string;
  name: string;
  type: AssetType;
  quantity: number;
  averagePrice?: number;
  currentPrice?: number;
  faceValue?: number;
  currency?: string;
  emitter?: string;
  securityCategory?: string;
  issueInfo?: string;
  lastPaymentAmount?: number;
  frequencyPerYear?: number;
}

const TYPE_MAP: Record<string, AssetType> = {
  акция: 'stock', акции: 'stock', stock: 'stock',
  облигация: 'bond', облигации: 'bond', bond: 'bond',
  фонд: 'fund', etf: 'fund', бпиф: 'fund', fund: 'fund',
  недвижимость: 'realestate', realestate: 'realestate',
  вклад: 'deposit', deposit: 'deposit',
  прочее: 'other', other: 'other',
};

export function parseTypeLabel(label: string): AssetType {
  return TYPE_MAP[label.trim().toLowerCase()] ?? 'other';
}

interface ColumnMap {
  ticker?: number;
  name?: number;
  type?: number;
  quantity?: number;
  averagePrice?: number;
  lastPaymentAmount?: number;
  frequencyPerYear?: number;
}

const HEADER_PATTERNS: [keyof ColumnMap, RegExp][] = [
  ['ticker', /тикер|ticker|secid/i],
  ['name', /назван|name|наименование/i],
  ['type', /тип|type/i],
  ['quantity', /кол[- ]?во|количество|qty|quantity|шт/i],
  ['averagePrice', /ср\.?\s*цена|средн.*цена|avg.*price|цена|price/i],
  ['lastPaymentAmount', /посл\.?\s*выплат|last.*payment|дивиденд|купон|выплата|payment/i],
  ['frequencyPerYear', /частот|frequency|freq|раз.*год/i],
];

function mapHeaders(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (let i = 0; i < headers.length; i++) {
    for (const [field, pattern] of HEADER_PATTERNS) {
      if (pattern.test(headers[i]) && map[field] === undefined) {
        map[field] = i;
        break;
      }
    }
  }
  return map;
}

function parseNumber(s: string): number | undefined {
  if (!s || !s.trim()) return undefined;
  const cleaned = s.trim().replace(/\s/g, '').replace(',', '.');
  const num = Number(cleaned);
  return isNaN(num) || num <= 0 ? undefined : num;
}

function cellsToRow(cells: string[], colMap: ColumnMap): ImportAssetRow | null {
  const name = colMap.name !== undefined ? cells[colMap.name]?.trim() : undefined;
  if (!name) return null;

  const quantity = colMap.quantity !== undefined ? parseNumber(cells[colMap.quantity]) : undefined;
  if (!quantity) return null;

  return {
    ticker: colMap.ticker !== undefined ? cells[colMap.ticker]?.trim() || undefined : undefined,
    name,
    type: colMap.type !== undefined ? parseTypeLabel(cells[colMap.type]) : 'other',
    quantity,
    averagePrice: colMap.averagePrice !== undefined ? parseNumber(cells[colMap.averagePrice]) : undefined,
    lastPaymentAmount: colMap.lastPaymentAmount !== undefined ? parseNumber(cells[colMap.lastPaymentAmount]) : undefined,
    frequencyPerYear: colMap.frequencyPerYear !== undefined ? parseNumber(cells[colMap.frequencyPerYear]) : undefined,
  };
}

function splitTableRow(line: string): string[] {
  const cells = line.split('|').map((c) => c.trim());
  if (cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isSeparatorLine(line: string): boolean {
  return /^\s*\|?\s*[-:\s|]+\s*\|?\s*$/.test(line);
}

export function parseMDTable(text: string): ImportAssetRow[] {
  const lines = text.trim().split('\n');
  const tableLines = lines.filter((l) => l.includes('|'));
  if (tableLines.length < 2) return [];

  const headerLine = tableLines[0];
  if (isSeparatorLine(headerLine)) return [];

  const headers = splitTableRow(headerLine);
  const colMap = mapHeaders(headers);
  if (colMap.name === undefined) return [];

  const rows: ImportAssetRow[] = [];
  for (let i = 1; i < tableLines.length; i++) {
    if (isSeparatorLine(tableLines[i])) continue;
    const cells = splitTableRow(tableLines[i]);
    const row = cellsToRow(cells, colMap);
    if (row) rows.push(row);
  }
  return rows;
}

function splitCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCSV(text: string): ImportAssetRow[] {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]);
  const colMap = mapHeaders(headers);
  if (colMap.name === undefined) return [];

  const rows: ImportAssetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const row = cellsToRow(cells, colMap);
    if (row) rows.push(row);
  }
  return rows;
}
