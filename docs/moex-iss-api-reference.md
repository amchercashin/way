# MOEX ISS API Reference

Справочник API Информационно-статистического сервера Московской Биржи для проекта passive-income-tracker.

**Base URL:** `https://iss.moex.com/iss`
**Formats:** `.json`, `.xml`, `.csv`, `.html` (добавляется в конец URL перед `?`)
**Auth:** Без аутентификации данные приходят с 15-минутной задержкой (кроме индексов). Для нашего приложения это приемлемо.
**Encoding:** UTF-8 (JSON/XML/HTML), windows-1251 (CSV)

## Official docs

- Overview: https://www.moex.com/a2193
- Developer Guide PDF (v1.4): https://www.moex.com/files/4gspnsx9er8s7wg65ve3ccg1ch
- Methods reference (online): https://iss.moex.com/iss/reference/
- Global index (engines, markets, boards): https://iss.moex.com/iss/index.json

---

## 1. System Parameters (applicable to all requests)

| Parameter | Values | Description |
|-----------|--------|-------------|
| `iss.meta` | `on`\|`off` | Включать ли метаинформацию (типы/размеры полей). Мы используем `off` |
| `iss.data` | `on`\|`off` | Включать ли данные |
| `iss.only` | `block1,block2` | Вернуть только указанные блоки |
| `<block>.columns` | `COL1,COL2` | Состав полей для блока. Можно `first.columns`, `second.columns` |
| `iss.json` | `compact`\|`extended` | Формат JSON. По умолчанию compact |
| `iss.dp` | `comma`\|`point` | Десятичный разделитель (CSV) |

---

## 2. Response Format (JSON compact)

```json
{
  "blockName": {
    "columns": ["COL1", "COL2", ...],
    "data": [
      [val1, val2, ...],
      [val1, val2, ...]
    ]
  }
}
```

Каждый ответ содержит один или несколько **блоков**. Каждый блок — массив `columns` + двумерный массив `data`.

---

## 3. Pagination

Два механизма:

### a) Simple (start parameter)
Для эндпоинтов с параметром `start`. Данные приходят порциями (обычно 20 строк для некоторых, 100 для history).
```
?start=0  → первые N строк
?start=N  → следующие N строк
...пока data не пустой
```

### b) Cursor block
Для history-эндпоинтов доступен блок `history.cursor`:
- `INDEX` — текущая позиция (= start)
- `TOTAL` — общее количество строк
- `PAGESIZE` — размер страницы (default 100, можно 50/20/10/5/1)

Цикл: пока `INDEX + PAGESIZE < TOTAL`, увеличивать `start` на `PAGESIZE`.

---

## 4. URL Hierarchy

```
/iss
  /engines/{engine}           → stock, currency, futures, ...
    /markets/{market}         → shares, bonds, index, ...
      /boards/{board}         → TQBR, TQOB, TQCB, TQTF, ...
        /securities/{secid}
      /boardgroups/{group}
        /securities/{secid}
      /securities/{secid}
  /securities                 → search
  /securities/{secid}         → spec/description
  /history/...                → historical data
```

### Key Engines
| ID | Name | Description |
|----|------|-------------|
| 1 | `stock` | Фондовый рынок (акции, облигации, фонды) |
| 2 | `state` | Государственные ценные бумаги |
| 3 | `currency` | Валютный рынок |
| 4 | `futures` | Срочный рынок |

### Key Markets (engine=stock)
| Market | Description |
|--------|-------------|
| `shares` | Акции, ETF, паи |
| `bonds` | Облигации |
| `index` | Индексы |

### Key Boards
| Board | Market | Description |
|-------|--------|-------------|
| `TQBR` | shares | Т+: Акции и ДР — основной режим |
| `TQTF` | shares | Т+: ETF/БПИФ |
| `TQPI` | shares | Т+: Акции ПИР (внесписочные) |
| `TQOB` | bonds | Т+: Гособлигации (ОФЗ) |
| `TQCB` | bonds | Т+: Корпоративные облигации |
| `EQOB` | bonds | Облигации Д (гос.) |
| `EQRP` | bonds | РЕПО |

---

## 5. Endpoints Used in Project

### 5.1 Security Search / Resolve

**Endpoint:** `GET /iss/securities.json`
**Reference:** https://iss.moex.com/iss/reference/205
**Used in:** `resolveSecurityInfo()`

```
/iss/securities.json?q=SBER&securities.columns=secid,primary_boardid,group,is_traded
```

**Parameters:**
| Param | Description |
|-------|-------------|
| `q` | Поиск по тикеру, ISIN, названию (мин. 3 символа) |
| `engine` | Фильтр по engine |
| `market` | Фильтр по market |
| `is_trading` | `1` — только торгуемые |
| `limit` | 5, 10, 20, или 100 (default 100) |
| `start` | Пагинация |

**Response block `securities`:**
| Column | Type | Description |
|--------|------|-------------|
| `secid` | string | Тикер / идентификатор |
| `primary_boardid` | string | Основной режим торгов (TQBR, TQOB, ...) |
| `group` | string | Группа: `stock_shares`, `stock_bonds`, `stock_ppif`, ... |
| `is_traded` | int | 1 = торгуется, 0 = нет |

**Наш код:** ищем exact match по secid с `is_traded=1`, fallback на первый `is_traded=1`.

---

### 5.2 Stock Price (Shares)

**Endpoint:** `GET /iss/engines/stock/markets/shares/boards/{board}/securities/{secid}.json`
**Reference:** https://iss.moex.com/iss/reference/359
**Used in:** `fetchStockPrice()`

```
/engines/stock/markets/shares/boards/TQBR/securities/SBER.json
  ?marketdata.columns=SECID,LAST,LCURRENTPRICE
  &securities.columns=SECID,PREVPRICE
```

**Response blocks:**

Block `securities` (static, doesn't change during trading day):
| Column | Description |
|--------|-------------|
| `SECID` | Тикер |
| `PREVPRICE` | Цена закрытия предыдущей сессии |
| `SHORTNAME` | Краткое название |

Block `marketdata` (dynamic):
| Column | Description |
|--------|-------------|
| `SECID` | Тикер |
| `LAST` | Цена последней сделки |
| `LCURRENTPRICE` | Текущая рыночная цена (может отличаться от LAST) |

Block `dataversion`:
| Column | Description |
|--------|-------------|
| `data_version` | Версия данных |
| `seqnum` | Sequence number для инкрементальных обновлений |
| `trade_date` | Дата торгов (YYYY-MM-DD) |

**Наш код:** `currentPrice = LAST ?? LCURRENTPRICE`, `prevPrice = PREVPRICE`.

---

### 5.3 Bond Data

**Endpoint:** `GET /iss/engines/stock/markets/bonds/boards/{board}/securities/{secid}.json`
**Reference:** https://iss.moex.com/iss/reference/359
**Used in:** `fetchBondData()`

```
/engines/stock/markets/bonds/boards/TQOB/securities/SU26238RMFS4.json
  ?marketdata.columns=SECID,LAST,LCURRENTPRICE
  &securities.columns=SECID,PREVPRICE,FACEVALUE,COUPONVALUE,NEXTCOUPON,COUPONPERIOD
```

**Response block `securities`:**
| Column | Type | Description |
|--------|------|-------------|
| `SECID` | string | Идентификатор |
| `PREVPRICE` | number | Цена закрытия (% от номинала) |
| `FACEVALUE` | number | Номинальная стоимость (руб.) |
| `COUPONVALUE` | number | Размер купона (руб.) |
| `NEXTCOUPON` | string | Дата следующего купона (YYYY-MM-DD) |
| `COUPONPERIOD` | number | Купонный период (дней) |

Block `marketdata`: аналогично shares.

Block `marketdata_yields` (дополнительный для облигаций):
| Column | Description |
|--------|-------------|
| `EFFECTIVEYIELD` | Эффективная доходность (%) |
| `DURATION` | Дюрация (дней) |
| `ZSPREADBP` | Z-спред (б.п.) |
| `GSPREADBP` | G-спред (б.п.) |

**Наш код:** Цена облигации = % от номинала. `currentPrice = LAST ?? LCURRENTPRICE`.

---

### 5.4 Dividend History

**Endpoint:** `GET /iss/securities/{secid}/dividends.json`
**Reference:** нет в iss/reference (undocumented, но работает стабильно)
**Used in:** `fetchDividends()`

```
/iss/securities/SBER/dividends.json?iss.meta=off
```

**Response block `dividends`:**
| Column | Type | Description |
|--------|------|-------------|
| `secid` | string | Тикер |
| `isin` | string | ISIN код |
| `registryclosedate` | string | Дата закрытия реестра (YYYY-MM-DD) |
| `value` | number | Размер дивиденда на акцию |
| `currencyid` | string | Валюта (SUR = RUB) |

**Пагинация:** Поддерживается через `dividends.start`. Наш код использует `fetchAllISSPages()` с шагом 20.

**Наш код:** Фильтрует записи с `registryclosedate != null && value != null`. Сортирует по дате. Вычисляет частоту выплат из интервалов между датами.

---

### 5.5 Bond Coupon Schedule (Bondization)

**Endpoint:** `GET /iss/securities/{secid}/bondization.json`
**Reference:** нет в iss/reference (undocumented, но работает стабильно)
**Used in:** `fetchCouponHistory()`

```
/iss/securities/SU26238RMFS4/bondization.json?iss.only=coupons
```

**Response block `coupons`:**
| Column | Type | Description |
|--------|------|-------------|
| `isin` | string | ISIN |
| `name` | string | Название |
| `issuevalue` | number | Объём выпуска |
| `coupondate` | string | Дата выплаты купона (YYYY-MM-DD) |
| `recorddate` | string | Дата фиксации реестра |
| `startdate` | string | Начало купонного периода |
| `initialfacevalue` | number | Начальный номинал |
| `facevalue` | number | Текущий номинал |
| `faceunit` | string | Валюта номинала |
| `value` | number | Размер купона (в валюте номинала) |
| `valueprc` | number | Купонная ставка (%) |
| `value_rub` | number | Размер купона в рублях |
| `secid` | string | Идентификатор бумаги |
| `primary_boardid` | string | Основной режим торгов |

**Response block `amortizations`** (если не фильтровать `iss.only`):
| Column | Description |
|--------|-------------|
| `amortdate` | Дата амортизации |
| `facevalue` | Номинал после амортизации |
| `value` | Размер выплаты |
| `value_rub` | Выплата в рублях |

**Response block `offers`** (оферты, если есть):
| Column | Description |
|--------|-------------|
| `offerdate` | Дата оферты |
| `offerdatestart`/`offerdateend` | Период подачи заявок |
| `offertype` | Тип оферты |

**Наш код:** Берёт только `coupons`, фильтрует `coupondate <= now && value_rub != null`.

---

## 6. Other Useful Endpoints (not yet used)

### 6.1 Security Description
```
GET /iss/securities/{secid}.json
```
Blocks: `description` (все поля инструмента), `boards` (на каких режимах торгуется).

### 6.2 Candles (OHLCV)
```
GET /iss/engines/{engine}/markets/{market}/securities/{secid}/candles.json
  ?from=2024-01-01&till=2024-12-31&interval=24
```
Reference: https://iss.moex.com/iss/reference/341

Intervals: `1` (1мин), `10` (10мин), `60` (1ч), `24` (1день), `7` (1нед), `31` (1мес), `4` (1квартал).

### 6.3 Historical Trading Data
```
GET /iss/history/engines/stock/markets/shares/securities/{secid}.json
  ?from=2024-01-01&till=2024-12-31
```
Reference: https://iss.moex.com/iss/reference/439

### 6.4 Index Analytics (составы индексов)
```
GET /iss/statistics/engines/stock/markets/index/analytics/{indexid}/tickers.json
```
Reference: https://iss.moex.com/iss/reference/141

### 6.5 Corporate Actions — Dividends (CCI, newer API)
```
GET /iss/cci/corp-actions/dividends.json
GET /iss/cci/corp-actions/dividends/{corp_action_id}.json
```
Reference: https://iss.moex.com/iss/reference/921, /927

### 6.6 Corporate Actions — Coupons (CCI)
```
GET /iss/cci/corp-actions/coupons.json
GET /iss/cci/corp-actions/coupons/{corp_action_id}.json
```
Reference: https://iss.moex.com/iss/reference/917, /915

### 6.7 CB Exchange Rates
```
GET /iss/statistics/engines/currency/markets/selt/rates.json
```
Reference: https://iss.moex.com/iss/reference/169

### 6.8 Stock Splits
```
GET /iss/statistics/engines/stock/splits/{secid}.json
```
Reference: https://iss.moex.com/iss/reference/57

---

## 7. Board → Market Mapping (from our code)

```typescript
const BOARD_TO_MARKET: Record<string, 'shares' | 'bonds'> = {
  TQBR: 'shares',   // Акции
  TQTF: 'shares',   // ETF
  TQPI: 'shares',   // ПИР
  TQOB: 'bonds',    // ОФЗ
  TQCB: 'bonds',    // Корп. облигации
};
```

Fallback: если board не в таблице, определяем по `group`:
- `*bond*` → bonds
- `*share*` / `*ppif*` → shares

---

## 8. Error Handling

- HTTP 500-504: Временные проблемы сервера. Следует повторить запрос через небольшой промежуток.
- Пустой блок data (columns есть, data = []): значение `start` превышает количество строк — конец пагинации.
- `null` значения в полях: нормально, означают отсутствие данных (например, `LAST = null` если торгов ещё не было).

---

## 9. Notes

- Без аутентификации реал-тайм данные приходят с **15-минутной задержкой** (кроме индексов). Для нашего трекера портфеля это приемлемо.
- Дивиденды и bondization — **не пагинированные в обычном смысле**: размер порции по умолчанию 20, наш код итерирует с `{block}.start`.
- Цены облигаций на MOEX — **в процентах от номинала** (например, 60.075 = 60.075% × 1000₽ = 600.75₽).
- `LAST` — последняя сделка, `LCURRENTPRICE` — текущая расчётная цена (может быть в отсутствие сделок).
- `PREVPRICE` — цена закрытия предыдущей сессии.
