import { describe, it, expect } from 'vitest';
import {
  parseMDTable,
  parseCSV,
  parseTypeLabel,
} from '@/services/import-parser';

describe('parseTypeLabel', () => {
  it('maps Russian labels to AssetType', () => {
    expect(parseTypeLabel('акция')).toBe('stock');
    expect(parseTypeLabel('Облигация')).toBe('bond');
    expect(parseTypeLabel('фонд')).toBe('fund');
    expect(parseTypeLabel('ETF')).toBe('fund');
    expect(parseTypeLabel('вклад')).toBe('deposit');
    expect(parseTypeLabel('недвижимость')).toBe('realestate');
    expect(parseTypeLabel('прочее')).toBe('other');
  });

  it('maps English labels', () => {
    expect(parseTypeLabel('stock')).toBe('stock');
    expect(parseTypeLabel('bond')).toBe('bond');
  });

  it('defaults to other for unknown types', () => {
    expect(parseTypeLabel('xyz')).toBe('other');
    expect(parseTypeLabel('')).toBe('other');
  });
});

describe('parseMDTable', () => {
  it('parses standard Markdown table', () => {
    const text = `
| Тикер | Название | Тип | Кол-во | Ср.цена | Посл.выплата | Частота |
|-------|----------|-----|--------|---------|--------------|---------|
| SBER | Сбербанк | акция | 800 | 298.60 | 34.84 | 1 |
| LKOH | Лукойл | акция | 10 | 6750 | 498 | 1 |
`;
    const rows = parseMDTable(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      ticker: 'SBER',
      name: 'Сбербанк',
      type: 'stock',
      quantity: 800,
      averagePrice: 298.60,
      lastPaymentAmount: 34.84,
      frequencyPerYear: 1,
    });
    expect(rows[1].ticker).toBe('LKOH');
    expect(rows[1].quantity).toBe(10);
  });

  it('handles Russian comma decimals', () => {
    const text = `
| Тикер | Название | Тип | Кол-во | Ср.цена | Посл.выплата | Частота |
|-------|----------|-----|--------|---------|--------------|---------|
| SBER | Сбербанк | акция | 800 | 298,60 | 34,84 | 1 |
`;
    const rows = parseMDTable(text);
    expect(rows[0].averagePrice).toBe(298.60);
    expect(rows[0].lastPaymentAmount).toBe(34.84);
  });

  it('handles missing optional fields', () => {
    const text = `
| Название | Тип | Кол-во |
|----------|-----|--------|
| Квартира | недвижимость | 1 |
`;
    const rows = parseMDTable(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].ticker).toBeUndefined();
    expect(rows[0].averagePrice).toBeUndefined();
    expect(rows[0].type).toBe('realestate');
  });

  it('handles alternative header names from AI', () => {
    const text = `
| Ticker | Name | Type | Quantity | Avg Price | Last Payment | Frequency |
|--------|------|------|----------|-----------|--------------|-----------|
| SBER | Sberbank | stock | 800 | 298.60 | 34.84 | 1 |
`;
    const rows = parseMDTable(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].ticker).toBe('SBER');
  });

  it('extracts table from surrounding text', () => {
    const text = `
Here is the converted table:

| Тикер | Название | Тип | Кол-во | Ср.цена | Посл.выплата | Частота |
|-------|----------|-----|--------|---------|--------------|---------|
| SBER | Сбербанк | акция | 800 | 298.60 | 34.84 | 1 |

Let me know if you need anything else!
`;
    const rows = parseMDTable(text);
    expect(rows).toHaveLength(1);
  });

  it('returns empty array for invalid input', () => {
    expect(parseMDTable('')).toEqual([]);
    expect(parseMDTable('no table here')).toEqual([]);
  });

  it('skips rows with missing required fields (name, quantity)', () => {
    const text = `
| Тикер | Название | Тип | Кол-во |
|-------|----------|-----|--------|
| SBER | | акция | 800 |
| LKOH | Лукойл | акция | |
| GAZP | Газпром | акция | 100 |
`;
    const rows = parseMDTable(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].ticker).toBe('GAZP');
  });
});

describe('parseCSV', () => {
  it('parses CSV with headers', () => {
    const text = `Тикер,Название,Тип,Кол-во,Ср.цена,Посл.выплата,Частота
SBER,Сбербанк,акция,800,298.60,34.84,1
LKOH,Лукойл,акция,10,6750,498,1`;
    const rows = parseCSV(text);
    expect(rows).toHaveLength(2);
    expect(rows[0].ticker).toBe('SBER');
    expect(rows[0].quantity).toBe(800);
  });

  it('returns empty array for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });

  it('handles quoted fields with commas in CSV', () => {
    const csv = `Тикер,Название,Тип,Количество,Ср. цена
SBER,"Сбербанк, привилегированная",Акция,800,317.63
GAZP,Газпром,Акция,200,150.00`;
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Сбербанк, привилегированная');
    expect(rows[0].quantity).toBe(800);
    expect(rows[1].name).toBe('Газпром');
  });
});
