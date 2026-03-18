# Wabi-Sabi Redesign — Спецификация

## Обзор

Полный визуальный редизайн PWA «Путь» (passive-income-tracker) в стилистике Wabi-Sabi — дзен-минимализм с тёплыми земляными тонами. Затрагивает все экраны приложения.

**Название приложения:** «Путь» (было «CashFlow»)

## Палитра

| Токен | Hex | Применение |
|-------|-----|------------|
| `--way-void` | `#0c0b09` | Фон страниц |
| `--way-stone` | `#1a1815` | Фон карточек, инпутов |
| `--way-gold` | `#c8b48c` | Акцент: суммы дохода, активные элементы |
| `--way-earth` | `#8b7355` | Вторичные маркеры |
| `--way-ash` | `#5a5548` | Иконки, вторичный текст |
| `--way-shadow` | `#3a3530` | Метки секций, разделители |
| `--way-text` | `#b0a898` | Основной текст |
| `--way-muted` | `#4a4540` | Приглушённый текст |

Все hardcoded цвета (`#0d1117`, `#1a1a2e`, `#4ecca3`, etc.) заменяются на CSS-переменные.

### Маппинг shadcn/ui токенов

shadcn-компоненты (Sheet, Select, Button, Input, etc.) используют семантические CSS-переменные из `.dark` блока. Маппинг:

| shadcn token | Значение | way-токен |
|---|---|---|
| `--background` | `#0c0b09` | `--way-void` |
| `--foreground` | `#b0a898` | `--way-text` |
| `--card` | `#1a1815` | `--way-stone` |
| `--card-foreground` | `#b0a898` | `--way-text` |
| `--primary` | `#c8b48c` | `--way-gold` |
| `--primary-foreground` | `#0c0b09` | `--way-void` |
| `--secondary` | `#1a1815` | `--way-stone` |
| `--secondary-foreground` | `#b0a898` | `--way-text` |
| `--muted` | `#1a1815` | `--way-stone` |
| `--muted-foreground` | `#4a4540` | `--way-muted` |
| `--accent` | `#1a1815` | `--way-stone` |
| `--accent-foreground` | `#b0a898` | `--way-text` |
| `--border` | `rgba(200,180,140,0.08)` | — |
| `--input` | `#1a1815` | `--way-stone` |
| `--ring` | `#c8b48c` | `--way-gold` |
| `--destructive` | `#b8413a` | — (оставить красный для удаления) |

## Типографика

| Роль | Шрифт | Где |
|------|-------|-----|
| Суммы, заголовки страниц | Cormorant Garamond 300/400 | HeroIncome amount, drawer title, page titles |
| Метки, данные, бейджи | IBM Plex Mono 300/400/500 | Labels, values, toggle, chart labels |
| Основной текст UI | DM Sans 300/400/500 | Category names, asset names, menu items |

Шрифты подключаются через `@fontsource` (npm-пакеты). Cormorant Garamond не имеет variable-font версии — использовать `@fontsource/cormorant-garamond` со статическими весами (300, 400).

## Компоненты

### AppShell (layout)

- Фон: `--way-void`
- Header: flex between, padding `max(38px, env(safe-area-inset-top)) 20px 0` (safe-area для iOS PWA)
- Кнопка меню: стандартный бургер (☰), цвет `--way-ash`
- Текст заголовка: DM Sans 14px, `--way-text`

### HeroIncome (main page)

- Метка «расчётный пассивный доход»: IBM Plex Mono 9px, caps, letter-spacing 0.3em, `--way-ash`
- Сумма: Cormorant Garamond 44-48px weight 300, `--way-gold`
- Мета-строка (доходность · портфель): IBM Plex Mono 10px, `--way-muted`
- Toggle мес/год: border `rgba(200,180,140,0.12)`, border-radius 4px, active фон `rgba(200,180,140,0.08)` + текст `--way-gold`

### CategoryCard (main page)

- Фон: нет (прозрачный, разделение через border-bottom `rgba(200,180,140,0.04)`)
- Маркер: вертикальная полоска 3×22px, border-radius 1px, цвета из earth-палитры по типу актива
- Название: DM Sans 13px, `--way-text`
- Счётчик: IBM Plex Mono 9px, `--way-muted`
- Доход: IBM Plex Mono 12px, `--way-gold`
- Доля: IBM Plex Mono 9px, `--way-muted`

### StatBlocks (category + asset detail)

- Grid 2×2, gap 8px
- Фон: `rgba(200,180,140,0.03)`, border `rgba(200,180,140,0.04)`, radius 8px
- Метка: IBM Plex Mono 8px caps, `--way-shadow`
- Значение: IBM Plex Mono 14px weight 500, `--way-text` (accent-значения в `--way-gold`)
- Бейдж источника (доход/мес): те же стили что в AssetField — «факт» / «ручной» приглушёнными плашками

### AssetField (asset detail)

- Метка: IBM Plex Mono 10px, `--way-ash`
- Значение: IBM Plex Mono 14px, `--way-text`
- Бейджи источников:
  - **Факт**: фон `rgba(200,180,140,0.1)`, текст `--way-gold`, IBM Plex Mono 8px, слово «факт»
  - **Ручной**: фон `rgba(90,85,72,0.15)`, текст `--way-ash`, IBM Plex Mono 8px, слово «ручной»
- Subtitle: IBM Plex Mono 9px, `--way-muted`
- Кнопка сброса: текст `--way-ash`, hover `--way-gold`

### PaymentHistoryChart

- Фон контейнера: нет (или `rgba(200,180,140,0.02)`)
- Метка CAGR: IBM Plex Mono 8px caps, `--way-shadow`
- Бары: градиент от `rgba(200,180,140,0.15)` (старые годы) до `#c8b48c` (текущий)
- Подписи годов: IBM Plex Mono 8px, `--way-shadow`
- Анимация: бары растут снизу вверх с staggered delay

### DrawerMenu

- Фон: `--way-void`, border-right `--way-stone`
- Заголовок «Путь»: Cormorant Garamond 18px weight 300, `--way-gold`
- Секции: IBM Plex Mono 8px caps, letter-spacing 0.3em, `--way-shadow`
- Пункты: DM Sans 13px, `--way-text`, hover фон `--way-stone`
- Иконки: Lucide React, stroke-width=1.2, размер 16px, цвет `--way-ash`
- Emoji убираются, заменяются на Lucide: BarChart3, Download, Settings, Save
- Пункт «Календарь выплат» (/calendar) — мёртвая ссылка, убрать из меню до реализации

### ExpectedPayment (asset detail)

- Контейнер: border `rgba(200,180,140,0.08)`, radius 8px, без фонового градиента
- Заголовок «Ожидаемая выплата»: IBM Plex Mono 10px caps, `--way-gold`
- Метки строк (дата, сумма): IBM Plex Mono 9px, `--way-muted`
- Значения: IBM Plex Mono 13px, `--way-text`

### AssetRow (category page)

- Аналогично CategoryCard: название + тикер слева, доход справа
- Название: DM Sans 13px, `--way-text`
- Тикер/количество: IBM Plex Mono 9px, `--way-muted`
- Доход: IBM Plex Mono 12px, `--way-gold`
- Бейдж частоты: текст `--way-earth`, фон `rgba(139,115,85,0.12)`
- Годовой доход: IBM Plex Mono 9px, `--way-muted`

### Кнопки и инпуты (add-asset, import, settings)

- Primary button: border 1px `rgba(200,180,140,0.2)`, текст `--way-gold`, hover фон `rgba(200,180,140,0.06)`
- Input: фон `--way-stone`, border `rgba(200,180,140,0.08)`, focus ring `--way-gold`, текст `--way-text`
- Select: аналогично Input
- «+ Добавить» (dashed border): border `--way-shadow`, текст `--way-ash`, active `--way-gold`

## Анимации

### Загрузка страницы (staggered fade-in)

```
Header:     delay 0.1s, fadeSlideDown 0.5s
Hero:       delay 0.2s, fadeSlideUp 0.7s
Amount:     delay 0.4s, fadeScaleIn 0.8s + countUp 1.2s
Meta:       delay 0.6s, fadeIn 0.5s
Toggle:     delay 0.7s, fadeIn 0.5s
Cat items:  delay 0.7s + i*0.15s, fadeSlideRight 0.5s
Chart:      delay 1.1s, fadeSlideUp 0.5s
Chart bars: delay 1.2s + i*0.1s, scaleY(0→1) 0.8s
```

### Count-up

- Суммы дохода (hero, category cards, stat blocks): от 0 до реального значения
- Длительность 1.2s, easing `1 - (1-t)^3` (ease-out cubic)
- Запуск после fade-in элемента

### Transitions

- Hover/active на карточках и кнопках: `transition: background 0.2s, color 0.2s`
- Навигация между страницами: нативная (без кастомных page transitions)

## Реализация

### CSS-переменные

Все цвета определяются в `index.css` через CSS custom properties `--way-*`. Компоненты используют только переменные, никаких hardcoded hex.

### Шрифты

Установить npm-пакеты:
- `@fontsource/cormorant-garamond` (статические веса 300, 400 — variable-версии нет)
- `@fontsource/ibm-plex-mono`
- `@fontsource/dm-sans`

Удалить `@fontsource-variable/geist`.

Импорт в `index.css`, определить через `@theme inline` в Tailwind.

### Анимации

CSS @keyframes в `index.css` для базовых анимаций (fadeIn, fadeSlideUp, fadeSlideDown, fadeSlideRight, fadeScaleIn, barGrow).

React-хук `useStaggerAnimation` или inline animation-delay через style prop для staggered элементов.

Count-up: утилита `useCountUp(target, duration)` — React хук с requestAnimationFrame. Вызывается внутри компонентов, отображающих суммы (HeroIncome, StatBlocks, CategoryCard), получает prop как target.

### Файлы для изменения

**Глобальные:**
- `index.css` — палитра, шрифты, keyframes
- `package.json` — зависимости шрифтов

**Layout:**
- `components/layout/app-shell.tsx` — фон, header стили
- `components/layout/drawer-menu.tsx` — заголовок «Путь», Lucide иконки, стили

**Main page:**
- `components/main/hero-income.tsx` — типографика, цвета, toggle, count-up
- `components/main/category-card.tsx` — стили карточки, маркер

**Category page:**
- `pages/category-page.tsx` — стили
- `components/category/asset-row.tsx` — стили

**Asset detail:**
- `pages/asset-detail-page.tsx` — стили
- `components/asset-detail/asset-field.tsx` — бейджи «факт»/«ручной», стили
- `components/asset-detail/expected-payment.tsx` — стили

**Shared:**
- `components/shared/stat-blocks.tsx` — стили блоков
- `components/shared/payment-history-chart.tsx` — цвета баров, анимация

**Pages:**
- `pages/add-asset-page.tsx` — стили форм
- `pages/import-page.tsx` — стили
- `pages/import-ai-page.tsx` — стили
- `pages/import-file-page.tsx` — стили
- `pages/import-sber-page.tsx` — стили
- `pages/import-preview-page.tsx` — стили
- `pages/settings-page.tsx` — стили
- `pages/backup-page.tsx` — стили

**Новые файлы:**
- `hooks/use-count-up.ts` — хук для count-up анимации

**shadcn/ui:**
- Обновить CSS-переменные в `index.css` (dark theme) чтобы shadcn-компоненты (Sheet, Select, Button, Input, etc.) использовали новую палитру

### Не меняется

- Бизнес-логика (services/, db/, models/types.ts)
- Роутинг (App.tsx)
- Хуки данных (use-assets, use-payment-history, use-portfolio-stats, use-moex-sync)
- Тесты
