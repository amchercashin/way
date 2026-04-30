import { expect, test } from '@playwright/test';

async function skipTours(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('hi-onboarding-done', '1');
    localStorage.setItem('hi-tip-category', '1');
    localStorage.setItem('hi-tip-asset', '1');
    localStorage.setItem('hi-tip-data', '1');
    localStorage.setItem('hi-tip-payments', '1');
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    let url: URL;
    try {
      url = new URL(route.request().url());
    } catch {
      return route.continue();
    }
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      return route.continue();
    }
    return route.abort();
  });
});

test('mobile core flow renders portfolio, asset detail, data, and settings', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.setItem('hi-onboarding-done', '1');
    localStorage.setItem('hi-tip-category', '1');
    localStorage.setItem('hi-tip-asset', '1');
    localStorage.setItem('hi-tip-data', '1');
    const { db } = await (0, eval)("import('/src/db/database.ts')");
    await db.delete();
    await db.open();

    const now = new Date();
    const accountId = await db.accounts.add({
      name: 'Тестовый счёт',
      createdAt: now,
      updatedAt: now,
    });
    const assetId = await db.assets.add({
      type: 'Акции',
      ticker: 'USDY',
      name: 'Долларовый актив',
      currency: 'USD',
      currentPrice: 100,
      dataSource: 'manual',
      paymentPerUnit: 12,
      paymentPerUnitSource: 'manual',
      frequencyPerYear: 1,
      frequencySource: 'manual',
      createdAt: now,
      updatedAt: now,
    });
    await db.holdings.add({
      accountId,
      assetId,
      quantity: 2,
      quantitySource: 'manual',
      averagePrice: 90,
      createdAt: now,
      updatedAt: now,
    });
    await db.exchangeRates.put({
      currency: 'USD',
      rateToRub: 90,
      updatedAt: now,
      source: 'manual',
    });
  });

  await page.goto('/');
  await expect(page.getByText('расчётный пассивный доход')).toBeVisible();
  await expect(page.getByText('Акции')).toBeVisible();
  await expect(page.getByText(/портфель ₽ 18K/)).toBeVisible();

  await page.getByText('Акции').click();
  await expect(page.getByText('Долларовый актив')).toBeVisible();

  await page.getByText('Долларовый актив').click();
  await expect(page.getByText('Текущая цена')).toBeVisible();
  await expect(page.getByText('100 USD')).toBeVisible();

  await page.goto('/data');
  await expect(page.getByText('Тестовый счёт')).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByText('Курсы валют')).toBeVisible();
  await expect(page.getByText('USD')).toBeVisible();
  await expect(page.locator('input[value="90"]')).toBeVisible();
});

test('mobile manual flow supports foreign currency asset and payment', async ({ page }) => {
  await page.goto('/');
  await skipTours(page);

  await page.goto('/data');
  await page.getByRole('button', { name: '+ Добавить счёт' }).click();
  await page.getByPlaceholder('Сбер / Недвижимость / Вклады / Прочее').fill('Валютный счёт');
  await page.getByRole('button', { name: 'Создать пустой' }).click();

  const accountButton = page.getByRole('button', { name: /Валютный счёт/ });
  await expect(accountButton).toBeVisible();
  await accountButton.click();
  await page.getByRole('button', { name: '+ Добавить актив' }).click();
  await page.getByPlaceholder('Сбербанк').fill('Валютный актив');
  await page.locator('select').first().selectOption('Прочее');
  await page.locator('select').nth(1).selectOption('USD');
  await page.getByPlaceholder('100').fill('2');
  await page.getByPlaceholder('25 000').fill('200');
  await page.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByText('200 USD')).toBeVisible();

  await page.goto('/settings');
  const usdRateInput = page.locator('input[placeholder="курс"]').nth(2);
  await usdRateInput.fill('90');
  await usdRateInput.press('Enter');
  await expect(page.locator('input[value="90"]')).toBeVisible();
  await expect(page.getByText(/обновлён/)).toBeVisible();

  await page.goto('/data');
  const convertedAccountButton = page.getByRole('button', { name: /Валютный счёт/ });
  await expect(convertedAccountButton).toContainText('₽ 18K');
  await convertedAccountButton.click();
  await expect(page.getByText('200 USD')).toBeVisible();

  await page.goto('/payments');
  await page.getByRole('button', { name: /Прочее/ }).click();
  await page.getByText('Валютный актив').click();
  await page.getByRole('button', { name: '+ выплата' }).click();
  await page.getByPlaceholder('Сумма USD').fill('12');
  await page.getByRole('button', { name: '✓' }).click();
  await expect(page.getByText('12 USD')).toBeVisible();

  await page.goto('/');
  await expect(page.getByText(/портфель ₽ 18K/)).toBeVisible();
  await expect(page.getByText('₽ 180')).toBeVisible();
});
