# Income Model Redesign: факт/ручной вместо факт/прогноз

## Контекст

Текущая модель дохода использует двойную систему факт/прогноз с decay-хелпером, forecastAmount, forecastMethod и отдельной таблицей PaymentSchedule. Это сложно для пользователя и избыточно архитектурно. Переход к упрощённой модели с двумя режимами: расчётный на основе факта (ф) и ручной ввод (р).

## Решения

- Понятие «прогноз» уходит полностью — decay, forecastAmount, forecastMethod удаляются
- Таблица `paymentSchedules` упраздняется, все поля переезжают в `assets`
- Доход всегда считается по единой формуле: `paymentPerUnit × frequencyPerYear × quantity / 12`
- Каждое из трёх полей (выплата на шт., количество, частота) имеет собственный источник данных
- Общий индикатор дохода: **ф** если все поля из API/импорта, **р** если хотя бы одно ручное

## 1. Модель данных

### Asset (обновлённый интерфейс)

```ts
interface Asset {
  // --- без изменений ---
  id?: number
  type: AssetType
  ticker?: string
  isin?: string
  moexSecid?: string
  name: string
  currency?: string
  emitter?: string
  securityCategory?: string
  issueInfo?: string
  dataSource: DataSource
  createdAt: Date
  updatedAt: Date
  averagePrice?: number
  currentPrice?: number
  faceValue?: number

  // --- quantity с источником ---
  quantity: number
  quantitySource: 'import' | 'manual'
  importedQuantity?: number              // для кнопки «вернуться к импорту»

  // --- выплата на шт. ---
  paymentPerUnit?: number                // хранится ТОЛЬКО при source = 'manual'
  paymentPerUnitSource: 'fact' | 'manual'

  // --- частота ---
  frequencyPerYear: number               // дефолт без MOEX: акции=1, облигации=2, фонды=12
  frequencySource: 'moex' | 'manual'
  moexFrequency?: number                 // для кнопки «вернуться к MOEX»

  // --- перенесено из PaymentSchedule ---
  nextExpectedDate?: Date
  nextExpectedCutoffDate?: Date
  nextExpectedCreditDate?: Date
}
```

### PaymentHistory — без изменений

```ts
interface PaymentHistory {
  id?: number
  assetId: number
  amount: number          // per-unit
  date: Date
  type: 'dividend' | 'coupon' | 'rent' | 'interest' | 'distribution' | 'other'
  dataSource: DataSource
}
```

### PaymentSchedule — удаляется

## 2. Логика расчёта дохода

### Расчёт paymentPerUnit в режиме «ф»

```
если frequencyPerYear >= 12 (ежемесячные):
  paymentPerUnit = последняя выплата из paymentHistory

если frequencyPerYear < 12 (реже чем ежемесячно):
  paymentPerUnit = сумма выплат за последние 12 мес / frequencyPerYear
```

Пояснение: деление на `frequencyPerYear` (а не на фактическое количество выплат в окне) — by design. Формула `paymentPerUnit × frequencyPerYear × quantity / 12` даёт `сумма_за_12_мес × quantity / 12`, что и есть целевой месячный доход. Если за 12 мес было больше или меньше выплат чем frequencyPerYear, paymentPerUnit будет «средневзвешенной» — но итоговый доход корректен.

Если история пуста и `paymentPerUnitSource === 'fact'` → paymentPerUnit = 0, доход = 0. Это ожидаемо для новых активов до первой выплаты.

### Единая формула дохода

```
incomePerMonth = paymentPerUnit × frequencyPerYear × quantity / 12
incomePerYear  = paymentPerUnit × frequencyPerYear × quantity
```

### Определение paymentPerUnit

```
если paymentPerUnitSource === 'manual':
  paymentPerUnit = asset.paymentPerUnit (сохранённое значение)

если paymentPerUnitSource === 'fact':
  paymentPerUnit = calcFactPaymentPerUnit(history, frequencyPerYear, now)
  если history пуста → 0
```

### Общий индикатор ф/р

```
isManual = paymentPerUnitSource === 'manual'
        || quantitySource === 'manual'
        || frequencySource === 'manual'

indicator = isManual ? 'р' : 'ф'
```

## 3. UI — страница актива

### Stat blocks (верх страницы)

- Доход/мес, Стоимость, Доходность, Доля — как сейчас
- Индикатор **ф** или **р** рядом с доходом (один бейдж вместо двух)
- Доход/мес **не** редактируется напрямую

### IncomeMetricPanel — удаляется полностью

### Редактируемые поля (под stat blocks)

Три поля с per-field индикатором источника:

1. **Количество** — значение + бейдж `import`/`manual`
   - При редактировании и сохранении: `quantitySource = 'manual'`
   - Кнопка при редактировании: «Вернуться к импорту» (если `importedQuantity` есть)

2. **Выплата на шт.** — значение + бейдж `ф`/`р`
   - В режиме ф: показывает расчётное значение из истории, подпись «расчёт из истории выплат»
   - При редактировании и сохранении: `paymentPerUnitSource = 'manual'`, значение сохраняется в `paymentPerUnit`
   - Кнопка при редактировании: «Вернуться к расчёту на основе факта»

3. **Частота** — значение + бейдж `moex`/`manual`
   - При редактировании и сохранении: `frequencySource = 'manual'`
   - Кнопка при редактировании: «Вернуться к MOEX» (если `moexFrequency` есть)

### ExpectedPayment — адаптация пропсов

`ExpectedPayment` сейчас принимает `PaymentSchedule` как проп. Переписать на приём полей из Asset:
- `nextExpectedDate`, `nextExpectedCutoffDate`, `nextExpectedCreditDate`
- `paymentPerUnit` (вычисленное значение, не из asset напрямую) и `quantity` для расчёта ожидаемой суммы

### PaymentHistoryChart — без изменений

## 4. UI — страница категории (список активов)

- В строке каждого актива рядом с доходом/мес — бейдж **ф** (зелёный) или **р** (оранжевый)
- «р» визуально выделяется оранжевым цветом — обращает внимание
- «ф» спокойный зелёный

## 5. Синхронизация MOEX

При `syncAllAssets()`:

1. **PaymentHistory** — как сейчас, добавляются новые записи с дедупликацией по дате

2. **Asset — цены** — `currentPrice` обновляется как сейчас

3. **Asset — частота:**
   - `frequencySource === 'moex'` → обновляем `frequencyPerYear` и `moexFrequency`
   - `frequencySource === 'manual'` → обновляем только `moexFrequency`, `frequencyPerYear` не трогаем

4. **Asset — выплата на шт.:**
   - `paymentPerUnitSource === 'fact'` → ничего не храним, пересчитается из обновлённой истории
   - `paymentPerUnitSource === 'manual'` → не трогаем

5. **Asset — даты следующей выплаты** — обновляем всегда (информационные поля)

### Кнопки «вернуться к...»

- «Вернуться к расчёту на основе факта» → `paymentPerUnitSource = 'fact'`, `paymentPerUnit = undefined`
- «Вернуться к MOEX» → `frequencySource = 'moex'`, `frequencyPerYear = moexFrequency`
- «Вернуться к импорту» → `quantitySource = 'import'`, `quantity = importedQuantity`

## 6. Миграция данных (Dexie v4)

### Перенос из paymentSchedules в assets

Для каждой записи paymentSchedule:
- `frequencyPerYear` → `asset.frequencyPerYear`
- `frequencySource` = `schedule.dataSource === 'moex' ? 'moex' : 'manual'` (dataSource 'import' → 'manual')
- `moexFrequency` = `frequencyPerYear` если source был moex
- `nextExpectedDate`, `nextExpectedCutoffDate`, `nextExpectedCreditDate` → asset
- `paymentPerUnitSource` = `schedule.activeMetric === 'forecast' && schedule.forecastMethod === 'manual' ? 'manual' : 'fact'`
- `paymentPerUnit` = `schedule.forecastAmount` если paymentPerUnitSource = manual

### Assets без paymentSchedule

- `frequencyPerYear`: акции=1, облигации=2, фонды=12, остальные типы (deposit, realestate, other)=12
- `frequencySource: 'manual'`
- `paymentPerUnitSource: 'fact'`
- `quantitySource` = `asset.dataSource === 'import' ? 'import' : 'manual'`
- `importedQuantity` = `asset.quantity` если dataSource = import

### Удаление таблицы

Таблица `paymentSchedules` удаляется в миграции v4.

## 7. Удаляемый код

- `src/components/asset-detail/income-metric-panel.tsx` — целиком
- `src/hooks/use-payment-schedules.ts` — целиком
- `calcDecayAverage()` из income-calculator.ts
- `calcMainNumber()` из income-calculator.ts
- `calcFactPerMonth()` из income-calculator.ts (заменяется на `calcFactPaymentPerUnit` с другой семантикой: per-unit, без умножения на quantity)
- Типы `forecastMethod`, `forecastAmount`, `activeMetric`, `PaymentSchedule` из types.ts
- Тесты для удалённых функций в `tests/services/income-calculator.test.ts`, `tests/db/database.test.ts`, `tests/services/backup.test.ts`, `tests/services/import-applier.test.ts`, `tests/services/moex-sync.test.ts`

## 8. Переписываемый код

- `income-calculator.ts` — новая функция `calcFactPaymentPerUnit(history, frequencyPerYear, now)`, удаление старых
- `asset-detail-page.tsx` — убрать IncomeMetricPanel, переделать поля на новые с per-field источниками
- `use-portfolio-stats.ts` — считать доход через единую формулу из asset полей
- `moex-sync.ts` — писать в asset вместо paymentSchedule
- `stat-blocks.tsx` — индикатор ф/р вместо ф/п
- `category-page.tsx` — добавить бейдж ф/р в строку актива
- `asset-row.tsx` — убрать зависимость от PaymentSchedule, получать доход из asset полей или вычисленного значения
- `expected-payment.tsx` — переписать пропсы с PaymentSchedule на поля Asset + вычисленный paymentPerUnit
- `asset-field.tsx` — расширить: поддержка разных типов источников ('fact'|'manual', 'moex'|'manual', 'import'|'manual'), опциональная кнопка «вернуться к...»
- `import-diff.ts` — читать frequency/payment из asset вместо paymentSchedules
- `import-applier.ts` — писать frequency/payment напрямую в asset вместо создания paymentSchedules записей
- `add-asset-page.tsx` — сохранять paymentPerUnit, frequencyPerYear и source-поля напрямую в asset (вместо upsertPaymentSchedule)
- `use-assets.ts` — убрать db.paymentSchedules из транзакции deleteAsset
- `category-page.tsx` — убрать useAllPaymentSchedules, добавить бейдж ф/р, передавать доход из asset полей
- `backup.ts` — экспорт/импорт без paymentSchedules; при импорте старого формата (с paymentSchedules) — применить ту же логику миграции что в секции 6
- `database.ts` — миграция v4
- `types.ts` — обновить Asset интерфейс, удалить PaymentSchedule

Примечание: `calcAssetIncomePerYear` и `calcAssetIncomePerMonth` уже реализуют целевую формулу — они остаются без изменений.
