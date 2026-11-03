import { expect, test } from '@playwright/test';
import {
  ADMIN,
  CUSTOMER,
  type DiscountInput,
  deleteDiscountsByCode,
  discountRow,
  displayDate,
  fieldError,
  fillDiscountForm,
  findDiscountByCode,
  isoDate,
  login,
  openAddDiscountPage,
  submitDiscountForm,
  uniqueCode,
} from './helpers/discounts';

const createdCodes: string[] = [];

function newDiscount(overrides: Partial<DiscountInput> = {}): DiscountInput {
  const code = overrides.code ?? uniqueCode();
  createdCodes.push(code);
  return { code, type: 'percentage', value: '25', expiryDate: isoDate(30), ...overrides };
}

test.afterAll(async () => {
  await deleteDiscountsByCode(createdCodes);
});

test.describe('Add Discount page', () => {
  test('is reachable from the discounts list and shows the form', async ({ page }) => {
    await page.goto('/discounts');
    await page.getByRole('link', { name: 'Add Discount' }).click();

    await expect(page).toHaveURL(/\/discounts\/add$/);
    await expect(page.getByRole('heading', { name: 'Add Discount' })).toBeVisible();
    await expect(page.getByLabel('Discount code')).toBeEmpty();
    await expect(page.getByLabel('Discount type')).toHaveValue('');
    await expect(page.getByLabel('Value')).toBeEmpty();
    await expect(page.getByLabel('Expiry date')).toBeEmpty();
    await expect(page.getByRole('button', { name: 'Save Discount' })).toBeEnabled();
    await expect(
      page.getByLabel('Discount type').getByRole('option'),
    ).toHaveText(['Select a discount type', 'Percentage (%)', 'Raw amount (£)']);
  });
});

test.describe('Validation', () => {
  test.beforeEach(async ({ page }) => {
    await openAddDiscountPage(page);
  });

  test('empty submission shows an error for every field and does not save', async ({ page }) => {
    const response = await submitDiscountForm(page);

    expect(response.status()).toBe(400);
    await expect(page).toHaveURL(/\/discounts\/add$/);
    await expect(page.getByRole('alert').filter({ hasText: 'Please fix the problems below' })).toBeVisible();
    await expect(fieldError(page, 'code')).toHaveText('Enter a discount code.');
    await expect(fieldError(page, 'type')).toHaveText('Select a discount type.');
    await expect(fieldError(page, 'value')).toHaveText('Enter the discount value.');
    await expect(fieldError(page, 'expiryDate')).toHaveText('Enter an expiry date.');
  });

  test('only the invalid field is flagged and valid input is kept', async ({ page }) => {
    const code = uniqueCode();
    await fillDiscountForm(page, { code, type: '', value: '10', expiryDate: isoDate(5) });
    await submitDiscountForm(page);

    await expect(fieldError(page, 'type')).toHaveText('Select a discount type.');
    await expect(fieldError(page, 'code')).toBeEmpty();
    await expect(fieldError(page, 'value')).toBeEmpty();
    await expect(fieldError(page, 'expiryDate')).toBeEmpty();
    await expect(page.getByLabel('Discount type')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Discount code')).toHaveValue(code);
    await expect(page.getByLabel('Value')).toHaveValue('10');
    await expect(page.getByLabel('Expiry date')).toHaveValue(isoDate(5));
  });

  const codeCases = [
    { name: 'too short (2 characters)', code: 'AB', message: 'The discount code must be between 3 and 30 characters long.' },
    { name: 'contains a space', code: 'SUMMER 10', message: 'The discount code can only contain letters, numbers, hyphens and underscores, with no spaces.' },
    { name: 'contains special characters', code: 'SALE!@£', message: 'The discount code can only contain letters, numbers, hyphens and underscores, with no spaces.' },
  ];

  for (const { name, code, message } of codeCases) {
    test(`rejects a code that is ${name}`, async ({ page }) => {
      await fillDiscountForm(page, { code, type: 'percentage', value: '10', expiryDate: isoDate(5) });
      const response = await submitDiscountForm(page);

      expect(response.status()).toBe(400);
      await expect(fieldError(page, 'code')).toHaveText(message);
      await expect(fieldError(page, 'value')).toBeEmpty();
    });
  }

  test('stops the code field accepting more than 30 characters', async ({ page }) => {
    await page.getByLabel('Discount code').fill('A'.repeat(31));
    await expect(page.getByLabel('Discount code')).toHaveValue('A'.repeat(30));
  });

  const percentageMessage = 'Enter a whole number between 0 and 100, for example 15. Decimals are not allowed.';
  const amountMessage = 'Enter a positive amount with up to 2 decimal places, for example 5.50.';
  const valueCases: { name: string; type: 'percentage' | 'amount'; value: string; message: string }[] = [
    { name: 'percentage above 100', type: 'percentage', value: '101', message: 'A percentage discount cannot be more than 100.' },
    { name: 'percentage with decimals', type: 'percentage', value: '12.5', message: percentageMessage },
    { name: 'negative percentage', type: 'percentage', value: '-5', message: percentageMessage },
    { name: 'non-numeric percentage', type: 'percentage', value: 'abc', message: percentageMessage },
    { name: 'zero amount', type: 'amount', value: '0', message: 'The amount must be greater than 0.' },
    { name: 'amount with 3 decimal places', type: 'amount', value: '5.555', message: amountMessage },
    { name: 'negative amount', type: 'amount', value: '-3', message: amountMessage },
    { name: 'non-numeric amount', type: 'amount', value: 'abc', message: amountMessage },
  ];

  for (const { name, type, value, message } of valueCases) {
    test(`rejects a ${name}`, async ({ page }) => {
      await fillDiscountForm(page, { code: uniqueCode(), type, value, expiryDate: isoDate(5) });
      const response = await submitDiscountForm(page);

      expect(response.status()).toBe(400);
      await expect(fieldError(page, 'value')).toHaveText(message);
      await expect(fieldError(page, 'code')).toBeEmpty();
    });
  }

  test('rejects an expiry date in the past', async ({ page }) => {
    await fillDiscountForm(page, { code: uniqueCode(), type: 'percentage', value: '10', expiryDate: isoDate(-1) });
    const response = await submitDiscountForm(page);

    expect(response.status()).toBe(400);
    await expect(fieldError(page, 'expiryDate')).toHaveText('The expiry date cannot be in the past.');
  });
});

test.describe('Saving a discount as an admin', () => {
  test.skip(!ADMIN, 'Set ADMIN_EMAIL and ADMIN_PASSWORD to run tests that save discounts');

  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN!.email, ADMIN!.password);
    await openAddDiscountPage(page);
  });

  test('saves a percentage discount and shows it in the discounts list', async ({ page }) => {
    const discount = newDiscount({ type: 'percentage', value: '25', expiryDate: isoDate(30) });
    await fillDiscountForm(page, discount);
    const response = await submitDiscountForm(page);

    expect(response.status()).toBe(303);
    await expect(page).toHaveURL(/\/discounts$/);
    const row = discountRow(page, discount.code);
    await expect(row.getByRole('cell').nth(1)).toHaveText('Percentage');
    await expect(row.getByRole('cell').nth(2)).toHaveText('25.00');
    await expect(row.getByRole('cell').nth(3)).toHaveText(displayDate(discount.expiryDate));
  });

  test('saves a raw amount discount and shows it in the discounts list', async ({ page }) => {
    const discount = newDiscount({ type: 'amount', value: '5.50', expiryDate: isoDate(60) });
    await fillDiscountForm(page, discount);
    await submitDiscountForm(page);

    await expect(page).toHaveURL(/\/discounts$/);
    const row = discountRow(page, discount.code);
    await expect(row.getByRole('cell').nth(1)).toHaveText('Amount off');
    await expect(row.getByRole('cell').nth(2)).toHaveText('5.50');
    await expect(row.getByRole('cell').nth(3)).toHaveText(displayDate(discount.expiryDate));
  });

  test('persists the discount in the backend with the correct values', async ({ page }) => {
    const discount = newDiscount({ type: 'amount', value: '12.5', expiryDate: isoDate(10) });
    await fillDiscountForm(page, discount);
    await submitDiscountForm(page);
    await expect(page).toHaveURL(/\/discounts$/);

    const saved = await findDiscountByCode(discount.code);
    expect(saved).toMatchObject({ code: discount.code, type: 'AMOUNT_OFF', value: '12.50' });
    expect(saved?.expiryDate.slice(0, 10)).toBe(discount.expiryDate);
  });

  test('keeps the discount after reloading the list', async ({ page }) => {
    const discount = newDiscount();
    await fillDiscountForm(page, discount);
    await submitDiscountForm(page);

    await page.reload();
    await expect(discountRow(page, discount.code)).toBeVisible();
  });

  test('trims whitespace around the code', async ({ page }) => {
    const code = uniqueCode();
    const discount = newDiscount({ code: `  ${code}  ` });
    createdCodes.push(code);
    await fillDiscountForm(page, discount);
    await submitDiscountForm(page);

    await expect(page).toHaveURL(/\/discounts$/);
    await expect(discountRow(page, code)).toBeVisible();
  });

  test('accepts the shortest and longest allowed codes', async ({ page }) => {
    const shortCode = uniqueCode('').replace(/^-/, '').slice(-3);
    const longCode = uniqueCode('L').padEnd(30, 'X').slice(0, 30);
    for (const code of [shortCode, longCode]) {
      await openAddDiscountPage(page);
      await fillDiscountForm(page, newDiscount({ code }));
      const response = await submitDiscountForm(page);
      expect(response.status(), `code "${code}"`).toBe(303);
      await expect(discountRow(page, code)).toBeVisible();
    }
  });

  test('accepts the boundary values 0% and 100%', async ({ page }) => {
    for (const value of ['0', '100']) {
      await openAddDiscountPage(page);
      const discount = newDiscount({ type: 'percentage', value });
      await fillDiscountForm(page, discount);
      const response = await submitDiscountForm(page);
      expect(response.status(), `value ${value}`).toBe(303);
      await expect(discountRow(page, discount.code).getByRole('cell').nth(2)).toHaveText(`${value}.00`);
    }
  });

  test('accepts an expiry date of today', async ({ page }) => {
    const discount = newDiscount({ expiryDate: isoDate(0) });
    await fillDiscountForm(page, discount);
    const response = await submitDiscountForm(page);

    expect(response.status()).toBe(303);
    await expect(discountRow(page, discount.code).getByRole('cell').nth(3)).toHaveText(displayDate(isoDate(0)));
  });

  test('rejects a duplicate code without creating a second discount', async ({ page }) => {
    const discount = newDiscount();
    await fillDiscountForm(page, discount);
    await submitDiscountForm(page);
    await expect(page).toHaveURL(/\/discounts$/);

    await openAddDiscountPage(page);
    await fillDiscountForm(page, { ...discount, type: 'amount', value: '3' });
    const response = await submitDiscountForm(page);

    expect(response.status()).toBe(400);
    await expect(fieldError(page, 'code')).toHaveText('A discount with this code already exists. Choose a different code.');
    await expect(page.getByLabel('Discount code')).toHaveValue(discount.code);

    await page.goto('/discounts');
    await expect(discountRow(page, discount.code)).toHaveCount(1);
    await expect(discountRow(page, discount.code).getByRole('cell').nth(1)).toHaveText('Percentage');
  });

  test('does not save anything when validation fails', async ({ page }) => {
    const discount = newDiscount({ type: 'percentage', value: '150' });
    await fillDiscountForm(page, discount);
    await submitDiscountForm(page);

    expect(await findDiscountByCode(discount.code)).toBeUndefined();
  });
});

test.describe('Saving a discount without admin rights', () => {
  const validDiscount = () => ({
    code: uniqueCode('NOADMIN'),
    type: 'percentage' as const,
    value: '10',
    expiryDate: isoDate(10),
  });
  const permissionError = 'You do not have permission to add discounts. Please sign in as an admin and try again.';

  test('a signed-in customer is refused', async ({ page }) => {
    await login(page, CUSTOMER.email, CUSTOMER.password);
    await openAddDiscountPage(page);
    const discount = validDiscount();
    createdCodes.push(discount.code);
    await fillDiscountForm(page, discount);
    const response = await submitDiscountForm(page);

    expect(response.status()).toBe(502);
    await expect(page.getByRole('alert').filter({ hasText: permissionError })).toBeVisible();
    await expect(page.getByLabel('Discount code')).toHaveValue(discount.code);
    if (ADMIN) expect(await findDiscountByCode(discount.code)).toBeUndefined();
  });

  test('a visitor who is not signed in is refused', async ({ page }) => {
    await openAddDiscountPage(page);
    const discount = validDiscount();
    createdCodes.push(discount.code);
    await fillDiscountForm(page, discount);
    const response = await submitDiscountForm(page);

    expect(response.status()).toBe(502);
    await expect(page.getByRole('alert').filter({ hasText: permissionError })).toBeVisible();
    if (ADMIN) expect(await findDiscountByCode(discount.code)).toBeUndefined();
  });
});
