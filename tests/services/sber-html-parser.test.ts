import { describe, it, expect } from 'vitest';
import { parseSberHTML, classifySberCategory } from '@/services/sber-html-parser';

const MINIMAL_SBER_HTML = `
<html>
<HEAD><META http-equiv="Content-Type" content="text/html; charset=UTF-8"></HEAD>
<body>
<p style="line-height:0.7;">
  <br>Портфель Ценных Бумаг</br>
  <br>Торговый код: TEST</br>
</p>
<table border="1" cellspacing="0" cellpadding="3">
  <tr class="table-header">
    <td class="c" colspan="3">Основной рынок</td>
    <td class="c" colspan="5">Начало периода</td>
    <td class="c" colspan="5">Конец периода</td>
    <td class="c" colspan="2">Изменение за период</td>
    <td class="c" colspan="3">Плановые показатели</td>
  </tr>
  <tr class="table-header">
    <td class="c">Наименование</td><td class="c">ISIN</td><td class="c">Валюта</td>
    <td class="c">Кол-во</td><td class="c">Номинал</td><td class="c">Рыноч. цена</td>
    <td class="c">Рыноч. стоимость</td><td class="c">НКД</td>
    <td class="c">Кол-во</td><td class="c">Номинал</td><td class="c">Рыноч. цена</td>
    <td class="c">Рыноч. стоимость</td><td class="c">НКД</td>
    <td class="c">Кол-во</td><td class="c">Рыноч. стоимость</td>
    <td class="c">Зачисления</td><td class="c">Списания</td><td class="c">Остаток</td>
  </tr>
  <tr class="rn">
    <td class="row-number">1</td><td class="row-number">2</td><td class="row-number">3</td>
    <td class="row-number">4</td><td class="row-number">5</td><td class="row-number">6</td>
    <td class="row-number">7</td><td class="row-number">8</td><td class="row-number">9</td>
    <td class="row-number">10</td><td class="row-number">11</td><td class="row-number">12</td>
    <td class="row-number">13</td><td class="row-number">14</td><td class="row-number">15</td>
    <td class="row-number">16</td><td class="row-number">17</td><td class="row-number">18</td>
  </tr>
  <tr>
    <td class="l" colspan="18">Площадка: Фондовый рынок</td>
  </tr>
  <tr>
    <td class="l">ОФЗ 29010</td><td class="c">RU000A0JV4Q1</td><td class="c">RUB</td>
    <td>100</td><td>1 000</td><td>105.5</td><td>105 500</td><td>1 000</td>
    <td>100</td><td>1 000</td><td>106.2</td><td>106 200</td><td>1 100</td>
    <td>0</td><td>700</td><td>0</td><td>0</td><td>100</td>
  </tr>
  <tr>
    <td class="l">ГАЗПРОМ ао</td><td class="c">RU0007661625</td><td class="c">RUB</td>
    <td>500</td><td>5</td><td>128.5</td><td>64 250</td><td>0</td>
    <td>500</td><td>5</td><td>130.27</td><td>65 135</td><td>0</td>
    <td>0</td><td>885</td><td>0</td><td>0</td><td>500</td>
  </tr>
  <tr>
    <td class="l">ПАРУС-ДВН</td><td class="c">RU000A1068X9</td><td class="c">RUB</td>
    <td>50</td><td></td><td>1 100</td><td>55 000</td><td>0</td>
    <td>50</td><td></td><td>1 150</td><td>57 500</td><td>0</td>
    <td>0</td><td>2 500</td><td>0</td><td>0</td><td>50</td>
  </tr>
  <tr class="summary-row">
    <td class="fontBold" colspan="6">Итого, RUB</td>
    <td>224 750</td><td>1 000</td><td></td><td></td><td></td>
    <td>228 835</td><td>1 100</td><td></td><td>4 085</td>
    <td></td><td></td><td></td>
  </tr>
</table>

<p>
  <br>Справочник Ценных Бумаг</br>
</p>
<table border="1" cellspacing="0" cellpadding="3">
  <tr class="table-header">
    <td class="c">Наименование</td><td class="c">Код</td><td class="c">ISIN</td>
    <td class="c">Эмитент</td><td class="c">Вид, Категория, Тип</td><td class="c">Выпуск</td>
  </tr>
  <tr class="rn">
    <td class="row-number">1</td><td class="row-number">2</td><td class="row-number">3</td>
    <td class="row-number">4</td><td class="row-number">5</td><td class="row-number">6</td>
  </tr>
  <tr>
    <td class="l">ОФЗ 29010</td><td class="c">SU29010RMFS4</td><td class="c">RU000A0JV4Q1</td>
    <td class="c">Минфин РФ</td><td class="c">Государственная облигация</td><td class="c">29010RMFS</td>
  </tr>
  <tr>
    <td class="l">ГАЗПРОМ ао</td><td class="c">GAZP</td><td class="c">RU0007661625</td>
    <td class="c">"Газпром", ПАО</td><td class="c">Обыкновенная акция</td><td class="c">1-02-00028-A</td>
  </tr>
  <tr>
    <td class="l">ПАРУС-ДВН</td><td class="c">RU000A1068X9</td><td class="c">RU000A1068X9</td>
    <td class="c">ПАРУС УА</td><td class="c">Фонд закрытого типа</td><td class="c">4434-СД</td>
  </tr>
</table>
</body>
</html>`;

describe('sber-html-parser', () => {
  it('parses portfolio positions from Sber HTML report', () => {
    const rows = parseSberHTML(MINIMAL_SBER_HTML);
    expect(rows).toHaveLength(3);
  });

  it('extracts stock with all reference fields', () => {
    const rows = parseSberHTML(MINIMAL_SBER_HTML);
    const gazp = rows.find((r) => r.ticker === 'GAZP');
    expect(gazp).toBeDefined();
    expect(gazp!.name).toBe('ГАЗПРОМ ао');
    expect(gazp!.type).toBe('Акции');
    expect(gazp!.quantity).toBe(500);
    expect(gazp!.currentPrice).toBe(130.27);
    expect(gazp!.faceValue).toBeUndefined();
    expect(gazp!.isin).toBe('RU0007661625');
    expect(gazp!.currency).toBe('RUB');
    expect(gazp!.emitter).toBe('"Газпром", ПАО');
    expect(gazp!.securityCategory).toBe('Обыкновенная акция');
    expect(gazp!.issueInfo).toBe('1-02-00028-A');
  });

  it('converts bond price from % to rubles with reference data', () => {
    const rows = parseSberHTML(MINIMAL_SBER_HTML);
    const bond = rows.find((r) => r.ticker === 'SU29010RMFS4');
    expect(bond).toBeDefined();
    expect(bond!.name).toBe('ОФЗ 29010');
    expect(bond!.type).toBe('Облигации');
    expect(bond!.quantity).toBe(100);
    expect(bond!.currentPrice).toBe(1062);
    expect(bond!.faceValue).toBe(1000);
    expect(bond!.isin).toBe('RU000A0JV4Q1');
    expect(bond!.currency).toBe('RUB');
    expect(bond!.emitter).toBe('Минфин РФ');
    expect(bond!.securityCategory).toBe('Государственная облигация');
    expect(bond!.issueInfo).toBe('29010RMFS');
  });

  it('parses fund with ISIN as ticker', () => {
    const rows = parseSberHTML(MINIMAL_SBER_HTML);
    const fund = rows.find((r) => r.name === 'ПАРУС-ДВН');
    expect(fund).toBeDefined();
    expect(fund!.ticker).toBe('RU000A1068X9');
    expect(fund!.isin).toBe('RU000A1068X9');
    expect(fund!.type).toBe('Фонды');
    expect(fund!.quantity).toBe(50);
    expect(fund!.currentPrice).toBe(1150);
    expect(fund!.emitter).toBe('ПАРУС УА');
    expect(fund!.securityCategory).toBe('Фонд закрытого типа');
  });

  it('returns empty array for non-Sber HTML', () => {
    const rows = parseSberHTML('<html><body><p>Hello</p></body></html>');
    expect(rows).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    const rows = parseSberHTML('');
    expect(rows).toHaveLength(0);
  });

  it('skips summary rows and platform headers', () => {
    const rows = parseSberHTML(MINIMAL_SBER_HTML);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => !r.name.startsWith('Итого'))).toBe(true);
  });

  it('falls back to ISIN when portfolio name differs from reference', () => {
    const html = MINIMAL_SBER_HTML
      // Portfolio table has "ПАРУС-ДВН (комб.)" but reference has "ПАРУС-ДВН"
      .replace(
        '<td class="l">ПАРУС-ДВН</td><td class="c">RU000A1068X9</td><td class="c">RUB</td>\n    <td>50</td>',
        '<td class="l">ПАРУС-ДВН (комб.)</td><td class="c">RU000A1068X9</td><td class="c">RUB</td>\n    <td>50</td>',
      );
    const rows = parseSberHTML(html);
    const fund = rows.find((r) => r.name === 'ПАРУС-ДВН (комб.)');
    expect(fund).toBeDefined();
    expect(fund!.ticker).toBe('RU000A1068X9');
    expect(fund!.type).toBe('Фонды');
    expect(fund!.emitter).toBe('ПАРУС УА');
  });

  it('converts bond price correctly via ISIN fallback', () => {
    const html = MINIMAL_SBER_HTML
      // Portfolio has "ОФЗ-29010" but reference has "ОФЗ 29010"
      .replace(
        '<td class="l">ОФЗ 29010</td><td class="c">RU000A0JV4Q1</td><td class="c">RUB</td>\n    <td>100</td><td>1 000</td><td>105.5</td>',
        '<td class="l">ОФЗ-29010</td><td class="c">RU000A0JV4Q1</td><td class="c">RUB</td>\n    <td>100</td><td>1 000</td><td>105.5</td>',
      );
    const rows = parseSberHTML(html);
    const bond = rows.find((r) => r.name === 'ОФЗ-29010');
    expect(bond).toBeDefined();
    expect(bond!.type).toBe('Облигации');
    // Bond price converted from % of face value: 1000 * 106.2 / 100 = 1062
    expect(bond!.currentPrice).toBe(1062);
    expect(bond!.faceValue).toBe(1000);
  });

  it('classifies "Фонд комбинированного типа" as Фонды', () => {
    const html = MINIMAL_SBER_HTML
      .replace('Фонд закрытого типа', 'Фонд комбинированного типа');
    const rows = parseSberHTML(html);
    const fund = rows.find((r) => r.name === 'ПАРУС-ДВН');
    expect(fund!.type).toBe('Фонды');
  });
});

describe('classifySberCategory', () => {
  it.each([
    ['Обыкновенная акция', 'Акции'],
    ['Привилегированная акция', 'Акции'],
    ['Государственная облигация', 'Облигации'],
    ['Корпоративная облигация', 'Облигации'],
    ['Облигация', 'Облигации'],
    ['Муниципальная облигация', 'Облигации'],
    ['Структурная облигация', 'Облигации'],
    ['Фонд закрытого типа', 'Фонды'],
    ['Фонд открытого типа', 'Фонды'],
    ['Биржевой паевой инвестиционный фонд', 'Фонды'],
    ['Фонд комбинированного типа', 'Фонды'],
    ['Инвестиционный пай', 'Фонды'],
    ['Депозитарная расписка', 'Прочее'],
    ['', 'Прочее'],
  ])('classifies "%s" as "%s"', (input, expected) => {
    expect(classifySberCategory(input)).toBe(expected);
  });
});
