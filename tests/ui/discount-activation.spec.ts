import { displayDate, isoDate, UNKNOWN_ID } from '../helpers/config';
import { expect, test } from '../helpers/fixtures';

// A discount is active while its expiry date is after today (UTC); deactivating sets the expiry to today.
test.beforeEach(async ({ signInAsAdmin }) => {
    await signInAsAdmin();
});

test.describe('Discount status on the discounts list', () => {
    test('a discount expiring in the future is active and can be deactivated', async ({ discountsPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(30) });
        await discountsPage.goto();

        await expect(discountsPage.deactivateButton(discount.code)).toBeVisible();
        await expect(discountsPage.activateLink(discount.code)).toHaveCount(0);
    });

    test('a discount expiring tomorrow is still active', async ({ discountsPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(1) });
        await discountsPage.goto();

        await expect(discountsPage.deactivateButton(discount.code)).toBeVisible();
        await expect(discountsPage.activateLink(discount.code)).toHaveCount(0);
    });

    test('a discount expiring today is inactive and can be activated', async ({ discountsPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(0) });
        await discountsPage.goto();

        await expect(discountsPage.activateLink(discount.code)).toBeVisible();
        await expect(discountsPage.deactivateButton(discount.code)).toHaveCount(0);
    });
});

test.describe('Deactivating a discount', () => {
    test('moves the expiry date to today and offers activation instead', async ({ page, discountsPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(30) });
        await discountsPage.goto();
        const response = await discountsPage.deactivate(discount.discountID, discount.code);

        expect(response.status()).toBe(303);
        await expect(page).toHaveURL(/\/discounts$/);
        await expect(discountsPage.expiryCell(discount.code)).toHaveText(displayDate(isoDate(0)));
        await expect(discountsPage.activateLink(discount.code)).toBeVisible();
        await expect(discountsPage.deactivateButton(discount.code)).toHaveCount(0);
    });

    test('persists in the backend and leaves the other fields unchanged', async ({ adminApi, discountsPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(30) });
        await discountsPage.goto();
        await discountsPage.deactivateButton(discount.code).click();
        await expect(discountsPage.activateLink(discount.code)).toBeVisible();

        const saved = await adminApi.findDiscount(discount.code);
        expect(saved).toMatchObject({
            discountID: discount.discountID,
            code: discount.code,
            type: discount.type,
            value: discount.value,
        });
        expect(saved?.expiryDate.slice(0, 10)).toBe(isoDate(0));
    });

    test('stays deactivated after reloading the list', async ({ page, discountsPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(30) });
        await discountsPage.goto();
        await discountsPage.deactivateButton(discount.code).click();
        await expect(discountsPage.activateLink(discount.code)).toBeVisible();

        await page.reload();

        await expect(discountsPage.activateLink(discount.code)).toBeVisible();
        await expect(discountsPage.deactivateButton(discount.code)).toHaveCount(0);
    });

    test('only affects the chosen discount', async ({ discountsPage, testDiscounts }) => {
        const target = await testDiscounts.create({ expiryDate: isoDate(30) });
        const other = await testDiscounts.create({ expiryDate: isoDate(30) });
        await discountsPage.goto();
        await discountsPage.deactivateButton(target.code).click();

        await expect(discountsPage.activateLink(target.code)).toBeVisible();
        await expect(discountsPage.deactivateButton(other.code)).toBeVisible();
        await expect(discountsPage.expiryCell(other.code)).toHaveText(displayDate(isoDate(30)));
    });
});

test.describe('Activating a discount', () => {
    test('the Activate link opens a form for that discount with an empty date', async ({ page, discountsPage, activateDiscountPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(0) });
        await discountsPage.goto();
        await discountsPage.activateLink(discount.code).click();

        await expect(page).toHaveURL(new RegExp(`/discounts/${discount.discountID}/activate$`));
        await expect(activateDiscountPage.heading).toBeVisible();
        await expect(activateDiscountPage.prompt(discount.code)).toBeVisible();
        await expect(activateDiscountPage.expiryInput).toBeEmpty();
        await expect(activateDiscountPage.activateButton).toBeEnabled();
    });

    test('Cancel returns to the list without changing the discount', async ({ page, adminApi, discountsPage, activateDiscountPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(0) });
        await activateDiscountPage.goto(discount.discountID);
        await activateDiscountPage.expiryInput.fill(isoDate(10));
        await activateDiscountPage.cancelLink.click();

        await expect(page).toHaveURL(/\/discounts$/);
        await expect(discountsPage.activateLink(discount.code)).toBeVisible();
        expect((await adminApi.findDiscount(discount.code))?.expiryDate.slice(0, 10)).toBe(isoDate(0));
    });

    test('a future expiry date reactivates the discount', async ({ page, adminApi, discountsPage, activateDiscountPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(0) });
        await activateDiscountPage.goto(discount.discountID);
        const response = await activateDiscountPage.submit(isoDate(14));

        expect(response.status()).toBe(303);
        await expect(page).toHaveURL(/\/discounts$/);
        await expect(discountsPage.expiryCell(discount.code)).toHaveText(displayDate(isoDate(14)));
        await expect(discountsPage.deactivateButton(discount.code)).toBeVisible();
        await expect(discountsPage.activateLink(discount.code)).toHaveCount(0);

        const saved = await adminApi.findDiscount(discount.code);
        expect(saved).toMatchObject({ code: discount.code, type: discount.type, value: discount.value });
        expect(saved?.expiryDate.slice(0, 10)).toBe(isoDate(14));
    });

    test('tomorrow is the earliest accepted expiry date', async ({ discountsPage, activateDiscountPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(0) });
        await activateDiscountPage.goto(discount.discountID);
        const response = await activateDiscountPage.submit(isoDate(1));

        expect(response.status()).toBe(303);
        await expect(discountsPage.deactivateButton(discount.code)).toBeVisible();
    });

    test('a discount can be deactivated and then reactivated', async ({ page, discountsPage, activateDiscountPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(30) });
        await discountsPage.goto();
        await discountsPage.deactivateButton(discount.code).click();
        await discountsPage.activateLink(discount.code).click();
        await activateDiscountPage.submit(isoDate(45));

        await expect(page).toHaveURL(/\/discounts$/);
        await expect(discountsPage.expiryCell(discount.code)).toHaveText(displayDate(isoDate(45)));
        await expect(discountsPage.deactivateButton(discount.code)).toBeVisible();
    });

    const invalidDates = [
        { name: 'is left empty', date: () => '', message: 'Enter an expiry date.' },
        { name: 'is in the past', date: () => isoDate(-1), message: 'The expiry date cannot be in the past.' },
        { name: 'is today', date: () => isoDate(0), message: 'The expiry date must be after today for the discount to be active.' },
    ];

    for (const { name, date, message } of invalidDates) {
        test(`rejects an expiry date that ${name} and keeps the discount inactive`, async ({ page, adminApi, activateDiscountPage, testDiscounts }) => {
            const discount = await testDiscounts.create({ expiryDate: isoDate(0) });
            await activateDiscountPage.goto(discount.discountID);
            const response = await activateDiscountPage.submit(date());

            expect(response.status()).toBe(400);
            await expect(page).toHaveURL(new RegExp(`/discounts/${discount.discountID}/activate$`));
            await expect(activateDiscountPage.alert.filter({ hasText: 'Please fix the problem below' })).toBeVisible();
            await expect(activateDiscountPage.expiryError).toHaveText(message);
            await expect(activateDiscountPage.expiryInput).toHaveAttribute('aria-invalid', 'true');
            await expect(activateDiscountPage.expiryInput).toHaveValue(date());
            expect((await adminApi.findDiscount(discount.code))?.expiryDate.slice(0, 10)).toBe(isoDate(0));
        });
    }

    test('an unknown discount redirects back to the list', async ({ page, discountsPage }) => {
        await page.goto(`/discounts/${UNKNOWN_ID}/activate`);

        await expect(page).toHaveURL(/\/discounts$/);
        await expect(discountsPage.heading).toBeVisible();
    });
});
