import { expect, test } from '@playwright/test';
import {
    DISCOUNT_ACCOUNT,
    type ApiDiscount,
    activateLink,
    callDiscountApi,
    createDiscountViaApi,
    deactivateButton,
    deleteDiscountsByCode,
    discountRow,
    displayDate,
    fieldError,
    findDiscountByCode,
    isoDate,
    login,
    openActivatePage,
    submitActivateForm,
    uniqueCode,
} from './helpers/discounts';

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';
const createdCodes: string[] = [];

// A discount is active while its expiry date is after today (UTC); deactivating sets the expiry to today.
async function seedDiscount(expiryOffsetDays: number): Promise<ApiDiscount> {
    const code = uniqueCode('ACT');
    createdCodes.push(code);
    return createDiscountViaApi({ code, expiryDate: isoDate(expiryOffsetDays) });
}

const expiryCell = (row: ReturnType<typeof discountRow>) => row.getByRole('cell').nth(3);

test.afterAll(async () => {
    await deleteDiscountsByCode(createdCodes);
});

test.describe('Discount status on the discounts list', () => {
    test.beforeEach(async ({ page }) => {
        await login(page, DISCOUNT_ACCOUNT.email, DISCOUNT_ACCOUNT.password);
    });

    test('a discount expiring in the future is active and can be deactivated', async ({ page }) => {
        const discount = await seedDiscount(30);
        await page.goto('/discounts');

        await expect(deactivateButton(page, discount.code)).toBeVisible();
        await expect(activateLink(page, discount.code)).toHaveCount(0);
    });

    test('a discount expiring tomorrow is still active', async ({ page }) => {
        const discount = await seedDiscount(1);
        await page.goto('/discounts');

        await expect(deactivateButton(page, discount.code)).toBeVisible();
        await expect(activateLink(page, discount.code)).toHaveCount(0);
    });

    test('a discount expiring today is inactive and can be activated', async ({ page }) => {
        const discount = await seedDiscount(0);
        await page.goto('/discounts');

        await expect(activateLink(page, discount.code)).toBeVisible();
        await expect(deactivateButton(page, discount.code)).toHaveCount(0);
    });
});

test.describe('Deactivating a discount', () => {
    test.beforeEach(async ({ page }) => {
        await login(page, DISCOUNT_ACCOUNT.email, DISCOUNT_ACCOUNT.password);
    });

    test('moves the expiry date to today and offers activation instead', async ({ page }) => {
        const discount = await seedDiscount(30);
        await page.goto('/discounts');
        const [response] = await Promise.all([
            page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith(`/discounts/${discount.discountID}/deactivate`)),
            deactivateButton(page, discount.code).click(),
        ]);

        expect(response.status()).toBe(303);
        await expect(page).toHaveURL(/\/discounts$/);
        await expect(expiryCell(discountRow(page, discount.code))).toHaveText(displayDate(isoDate(0)));
        await expect(activateLink(page, discount.code)).toBeVisible();
        await expect(deactivateButton(page, discount.code)).toHaveCount(0);
    });

    test('persists in the backend and leaves the other fields unchanged', async ({ page }) => {
        const discount = await seedDiscount(30);
        await page.goto('/discounts');
        await deactivateButton(page, discount.code).click();
        await expect(activateLink(page, discount.code)).toBeVisible();

        const saved = await findDiscountByCode(discount.code);
        expect(saved).toMatchObject({
            discountID: discount.discountID,
            code: discount.code,
            type: discount.type,
            value: discount.value,
        });
        expect(saved?.expiryDate.slice(0, 10)).toBe(isoDate(0));
    });

    test('stays deactivated after reloading the list', async ({ page }) => {
        const discount = await seedDiscount(30);
        await page.goto('/discounts');
        await deactivateButton(page, discount.code).click();
        await expect(activateLink(page, discount.code)).toBeVisible();

        await page.reload();
        await expect(activateLink(page, discount.code)).toBeVisible();
        await expect(deactivateButton(page, discount.code)).toHaveCount(0);
    });

    test('only affects the chosen discount', async ({ page }) => {
        const target = await seedDiscount(30);
        const other = await seedDiscount(30);
        await page.goto('/discounts');
        await deactivateButton(page, target.code).click();

        await expect(activateLink(page, target.code)).toBeVisible();
        await expect(deactivateButton(page, other.code)).toBeVisible();
        await expect(expiryCell(discountRow(page, other.code))).toHaveText(displayDate(isoDate(30)));
    });
});

test.describe('Activating a discount', () => {
    test.beforeEach(async ({ page }) => {
        await login(page, DISCOUNT_ACCOUNT.email, DISCOUNT_ACCOUNT.password);
    });

    test('the Activate link opens a form for that discount with an empty date', async ({ page }) => {
        const discount = await seedDiscount(0);
        await page.goto('/discounts');
        await activateLink(page, discount.code).click();

        await expect(page).toHaveURL(new RegExp(`/discounts/${discount.discountID}/activate$`));
        await expect(page.getByRole('heading', { name: 'Activate Discount' })).toBeVisible();
        await expect(page.getByText(`Enter a new expiry date for discount ${discount.code}.`)).toBeVisible();
        await expect(page.getByLabel('New expiry date')).toBeEmpty();
        await expect(page.getByRole('button', { name: 'Activate Discount' })).toBeEnabled();
    });

    test('Cancel returns to the list without changing the discount', async ({ page }) => {
        const discount = await seedDiscount(0);
        await openActivatePage(page, discount.discountID);
        await page.getByLabel('New expiry date').fill(isoDate(10));
        await page.getByRole('link', { name: 'Cancel' }).click();

        await expect(page).toHaveURL(/\/discounts$/);
        await expect(activateLink(page, discount.code)).toBeVisible();
        const saved = await findDiscountByCode(discount.code);
        expect(saved?.expiryDate.slice(0, 10)).toBe(isoDate(0));
    });

    test('a future expiry date reactivates the discount', async ({ page }) => {
        const discount = await seedDiscount(0);
        await openActivatePage(page, discount.discountID);
        const response = await submitActivateForm(page, isoDate(14));

        expect(response.status()).toBe(303);
        await expect(page).toHaveURL(/\/discounts$/);
        const row = discountRow(page, discount.code);
        await expect(expiryCell(row)).toHaveText(displayDate(isoDate(14)));
        await expect(deactivateButton(page, discount.code)).toBeVisible();
        await expect(activateLink(page, discount.code)).toHaveCount(0);

        const saved = await findDiscountByCode(discount.code);
        expect(saved).toMatchObject({ code: discount.code, type: discount.type, value: discount.value });
        expect(saved?.expiryDate.slice(0, 10)).toBe(isoDate(14));
    });

    test('tomorrow is the earliest accepted expiry date', async ({ page }) => {
        const discount = await seedDiscount(0);
        await openActivatePage(page, discount.discountID);
        const response = await submitActivateForm(page, isoDate(1));

        expect(response.status()).toBe(303);
        await expect(deactivateButton(page, discount.code)).toBeVisible();
    });

    test('a discount can be deactivated and then reactivated', async ({ page }) => {
        const discount = await seedDiscount(30);
        await page.goto('/discounts');
        await deactivateButton(page, discount.code).click();
        await activateLink(page, discount.code).click();
        await submitActivateForm(page, isoDate(45));

        await expect(page).toHaveURL(/\/discounts$/);
        await expect(expiryCell(discountRow(page, discount.code))).toHaveText(displayDate(isoDate(45)));
        await expect(deactivateButton(page, discount.code)).toBeVisible();
    });

    const invalidDates = [
        { name: 'is left empty', date: '', message: 'Enter an expiry date.' },
        { name: 'is in the past', date: isoDate(-1), message: 'The expiry date cannot be in the past.' },
        { name: 'is today', date: isoDate(0), message: 'The expiry date must be after today for the discount to be active.' },
    ];

    for (const { name, date, message } of invalidDates) {
        test(`rejects an expiry date that ${name} and keeps the discount inactive`, async ({ page }) => {
            const discount = await seedDiscount(0);
            await openActivatePage(page, discount.discountID);
            const response = await submitActivateForm(page, date);

            expect(response.status()).toBe(400);
            await expect(page).toHaveURL(new RegExp(`/discounts/${discount.discountID}/activate$`));
            await expect(page.getByRole('alert').filter({ hasText: 'Please fix the problem below' })).toBeVisible();
            await expect(fieldError(page, 'expiryDate')).toHaveText(message);
            await expect(page.getByLabel('New expiry date')).toHaveAttribute('aria-invalid', 'true');
            await expect(page.getByLabel('New expiry date')).toHaveValue(date);

            const saved = await findDiscountByCode(discount.code);
            expect(saved?.expiryDate.slice(0, 10)).toBe(isoDate(0));
        });
    }

    test('an unknown discount redirects back to the list', async ({ page }) => {
        await page.goto(`/discounts/${UNKNOWN_ID}/activate`);

        await expect(page).toHaveURL(/\/discounts$/);
        await expect(page.getByRole('heading', { name: 'Discounts', exact: true })).toBeVisible();
    });
});

test.describe('Backend activate and deactivate endpoints', () => {
    test('POST /discounts/:id/deactivate sets the expiry date to today', async () => {
        const discount = await seedDiscount(30);
        const { status, body } = await callDiscountApi('POST', `/discounts/${discount.discountID}/deactivate`);

        expect(status).toBe(200);
        expect(body).toMatchObject({ discountID: discount.discountID, code: discount.code, value: discount.value });
        expect((body as ApiDiscount).expiryDate.slice(0, 10)).toBe(isoDate(0));
    });

    test('POST /discounts/:id/activate sets the new expiry date', async () => {
        const discount = await seedDiscount(0);
        const { status, body } = await callDiscountApi('POST', `/discounts/${discount.discountID}/activate`, {
            expiryDate: isoDate(20),
        });

        expect(status).toBe(200);
        expect((body as ApiDiscount).expiryDate.slice(0, 10)).toBe(isoDate(20));
        expect((await findDiscountByCode(discount.code))?.expiryDate.slice(0, 10)).toBe(isoDate(20));
    });

    test('POST /discounts/:id/activate accepts today as an expiry date', async () => {
        const discount = await seedDiscount(30);
        const { status } = await callDiscountApi('POST', `/discounts/${discount.discountID}/activate`, {
            expiryDate: isoDate(0),
        });

        expect(status).toBe(200);
    });

    const invalidBodies = [
        { name: 'a past date', body: () => ({ expiryDate: isoDate(-1) }) },
        { name: 'a malformed date', body: () => ({ expiryDate: '31/12/2030' }) },
        { name: 'an impossible date', body: () => ({ expiryDate: '2030-02-31' }) },
        { name: 'a missing date', body: () => ({}) },
    ];

    for (const { name, body } of invalidBodies) {
        test(`POST /discounts/:id/activate rejects ${name} without changing the discount`, async () => {
            const discount = await seedDiscount(30);
            const { status } = await callDiscountApi('POST', `/discounts/${discount.discountID}/activate`, body());

            expect(status).toBe(400);
            expect((await findDiscountByCode(discount.code))?.expiryDate.slice(0, 10)).toBe(isoDate(30));
        });
    }

    test('returns 404 for an unknown discount', async () => {
        const deactivate = await callDiscountApi('POST', `/discounts/${UNKNOWN_ID}/deactivate`);
        const activate = await callDiscountApi('POST', `/discounts/${UNKNOWN_ID}/activate`, { expiryDate: isoDate(5) });

        expect(deactivate.status).toBe(404);
        expect(activate.status).toBe(404);
    });
});
