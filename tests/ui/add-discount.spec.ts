import { codeOfLength, displayDate, isoDate, uniqueCode } from '../helpers/config';
import { expect, test } from '../helpers/fixtures';
import type { DiscountFormValues } from '../pages/AddDiscountPage';

function newDiscount(overrides: Partial<DiscountFormValues> = {}): DiscountFormValues {
    return { code: uniqueCode(), type: 'percentage', value: '25', expiryDate: isoDate(30), ...overrides };
}

test.describe('Add Discount page', () => {
    test.beforeEach(async ({ signInAsAdmin }) => {
        await signInAsAdmin();
    });

    test('is reachable from the discounts list and shows the form', async ({ page, discountsPage, addDiscountPage }) => {
        await discountsPage.goto();
        await discountsPage.addDiscountLink.click();

        await expect(page).toHaveURL(/\/discounts\/add$/);
        await expect(addDiscountPage.heading).toBeVisible();
        await expect(addDiscountPage.codeInput).toBeEmpty();
        await expect(addDiscountPage.typeSelect).toHaveValue('');
        await expect(addDiscountPage.valueInput).toBeEmpty();
        await expect(addDiscountPage.expiryInput).toBeEmpty();
        await expect(addDiscountPage.saveButton).toBeEnabled();
        await expect(addDiscountPage.typeSelect.getByRole('option')).toHaveText(['Select a discount type', 'Percentage (%)', 'Raw amount (£)']);
    });
});

test.describe('Validation', () => {
    test.beforeEach(async ({ signInAsAdmin, addDiscountPage }) => {
        await signInAsAdmin();
        await addDiscountPage.goto();
    });

    test('empty submission shows an error for every field and does not save', async ({ page, addDiscountPage }) => {
        const response = await addDiscountPage.submit();

        expect(response.status()).toBe(400);
        await expect(page).toHaveURL(/\/discounts\/add$/);
        await expect(addDiscountPage.alert.filter({ hasText: 'Please fix the problems below' })).toBeVisible();
        await expect(addDiscountPage.fieldError('code')).toHaveText('Enter a discount code.');
        await expect(addDiscountPage.fieldError('type')).toHaveText('Select a discount type.');
        await expect(addDiscountPage.fieldError('value')).toHaveText('Enter the discount value.');
        await expect(addDiscountPage.fieldError('expiryDate')).toHaveText('Enter an expiry date.');
    });

    test('only the invalid field is flagged and valid input is kept', async ({ addDiscountPage }) => {
        const values = newDiscount({ type: '', value: '10', expiryDate: isoDate(5) });
        await addDiscountPage.save(values);

        await expect(addDiscountPage.fieldError('type')).toHaveText('Select a discount type.');
        await expect(addDiscountPage.fieldError('code')).toBeEmpty();
        await expect(addDiscountPage.fieldError('value')).toBeEmpty();
        await expect(addDiscountPage.fieldError('expiryDate')).toBeEmpty();
        await expect(addDiscountPage.typeSelect).toHaveAttribute('aria-invalid', 'true');
        await expect(addDiscountPage.codeInput).toHaveValue(values.code);
        await expect(addDiscountPage.valueInput).toHaveValue('10');
        await expect(addDiscountPage.expiryInput).toHaveValue(isoDate(5));
    });

    const codeMessage = 'The discount code can only contain letters, numbers, hyphens and underscores, with no spaces.';
    const lengthMessage = 'The discount code must be between 5 and 15 characters long.';
    const codeCases = [
        { name: 'too short (4 characters)', code: 'ABCD', message: lengthMessage },
        { name: 'too long (16 characters)', code: 'A'.repeat(16), message: lengthMessage },
        { name: 'contains a space', code: 'SUMMER 10', message: codeMessage },
        { name: 'contains special characters', code: 'SALE!@£', message: codeMessage },
    ];

    for (const { name, code, message } of codeCases) {
        test(`rejects a code that is ${name}`, async ({ addDiscountPage }) => {
            const response = await addDiscountPage.save(newDiscount({ code, value: '10', expiryDate: isoDate(5) }));

            expect(response.status()).toBe(400);
            await expect(addDiscountPage.fieldError('code')).toHaveText(message);
            await expect(addDiscountPage.fieldError('value')).toBeEmpty();
        });
    }

    test('stops the code field accepting more than 30 characters', async ({ addDiscountPage }) => {
        await addDiscountPage.codeInput.fill('A'.repeat(31));

        await expect(addDiscountPage.codeInput).toHaveValue('A'.repeat(30));
    });

    const percentageMessage = 'Enter a whole number between 0 and 100, for example 15. Decimals are not allowed.';
    const amountMessage = 'Enter a positive amount with up to 2 decimal places, for example 5.50.';
    const valueCases: { name: string; type: 'percentage' | 'amount'; value: string; message: string; }[] = [
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
        test(`rejects a ${name}`, async ({ addDiscountPage }) => {
            const response = await addDiscountPage.save(newDiscount({ type, value, expiryDate: isoDate(5) }));

            expect(response.status()).toBe(400);
            await expect(addDiscountPage.fieldError('value')).toHaveText(message);
            await expect(addDiscountPage.fieldError('code')).toBeEmpty();
        });
    }

    test('rejects an expiry date in the past', async ({ addDiscountPage }) => {
        const response = await addDiscountPage.save(newDiscount({ expiryDate: isoDate(-1) }));

        expect(response.status()).toBe(400);
        await expect(addDiscountPage.fieldError('expiryDate')).toHaveText('The expiry date cannot be in the past.');
    });

    test('does not save anything when validation fails', async ({ adminApi, addDiscountPage }) => {
        const discount = newDiscount({ type: 'percentage', value: '150' });
        await addDiscountPage.save(discount);

        expect(await adminApi.findDiscount(discount.code)).toBeUndefined();
    });
});

test.describe('Saving a discount', () => {
    test.beforeEach(async ({ signInAsAdmin, addDiscountPage }) => {
        await signInAsAdmin();
        await addDiscountPage.goto();
    });

    test('saves a percentage discount and shows it in the discounts list', async ({ page, addDiscountPage, discountsPage, testDiscounts }) => {
        const discount = newDiscount({ type: 'percentage', value: '25', expiryDate: isoDate(30) });
        testDiscounts.track(discount.code);
        const response = await addDiscountPage.save(discount);

        expect(response.status()).toBe(303);
        await expect(page).toHaveURL(/\/discounts$/);
        await expect(discountsPage.typeCell(discount.code)).toHaveText('Percentage');
        await expect(discountsPage.valueCell(discount.code)).toHaveText('25.00');
        await expect(discountsPage.expiryCell(discount.code)).toHaveText(displayDate(discount.expiryDate));
    });

    test('saves a raw amount discount and shows it in the discounts list', async ({ page, addDiscountPage, discountsPage, testDiscounts }) => {
        const discount = newDiscount({ type: 'amount', value: '5.50', expiryDate: isoDate(60) });
        testDiscounts.track(discount.code);
        await addDiscountPage.save(discount);

        await expect(page).toHaveURL(/\/discounts$/);
        await expect(discountsPage.typeCell(discount.code)).toHaveText('Amount off');
        await expect(discountsPage.valueCell(discount.code)).toHaveText('5.50');
        await expect(discountsPage.expiryCell(discount.code)).toHaveText(displayDate(discount.expiryDate));
    });

    test('a new discount is active, so it offers deactivation', async ({ addDiscountPage, discountsPage, testDiscounts }) => {
        const discount = newDiscount();
        testDiscounts.track(discount.code);
        await addDiscountPage.save(discount);

        await expect(discountsPage.deactivateButton(discount.code)).toBeVisible();
        await expect(discountsPage.activateLink(discount.code)).toHaveCount(0);
    });

    test('persists the discount in the backend with the correct values', async ({ page, adminApi, addDiscountPage, testDiscounts }) => {
        const discount = newDiscount({ type: 'amount', value: '12.5', expiryDate: isoDate(10) });
        testDiscounts.track(discount.code);
        await addDiscountPage.save(discount);
        await expect(page).toHaveURL(/\/discounts$/);

        const saved = await adminApi.findDiscount(discount.code);
        expect(saved).toMatchObject({ code: discount.code, type: 'AMOUNT_OFF', value: '12.50' });
        expect(saved?.expiryDate.slice(0, 10)).toBe(discount.expiryDate);
    });

    test('keeps the discount after reloading the list', async ({ page, addDiscountPage, discountsPage, testDiscounts }) => {
        const discount = newDiscount();
        testDiscounts.track(discount.code);
        await addDiscountPage.save(discount);

        await page.reload();

        await expect(discountsPage.row(discount.code)).toBeVisible();
    });

    test('trims whitespace around the code', async ({ page, addDiscountPage, discountsPage, testDiscounts }) => {
        const code = testDiscounts.track(uniqueCode());
        await addDiscountPage.save(newDiscount({ code: `  ${code}  ` }));

        await expect(page).toHaveURL(/\/discounts$/);
        await expect(discountsPage.row(code)).toBeVisible();
    });

    test('accepts the shortest and longest allowed codes', async ({ addDiscountPage, discountsPage, testDiscounts }) => {
        const shortCode = testDiscounts.track(codeOfLength(5));
        const longCode = testDiscounts.track(codeOfLength(15));
        for (const code of [shortCode, longCode]) {
            await addDiscountPage.goto();
            const response = await addDiscountPage.save(newDiscount({ code }));
            expect(response.status(), `code "${code}"`).toBe(303);
            await expect(discountsPage.row(code)).toBeVisible();
        }
    });

    test('accepts the boundary values 0% and 100%', async ({ addDiscountPage, discountsPage, testDiscounts }) => {
        for (const value of ['0', '100']) {
            await addDiscountPage.goto();
            const discount = newDiscount({ type: 'percentage', value });
            testDiscounts.track(discount.code);
            const response = await addDiscountPage.save(discount);
            expect(response.status(), `value ${value}`).toBe(303);
            await expect(discountsPage.valueCell(discount.code)).toHaveText(`${value}.00`);
        }
    });

    test('accepts an expiry date of today but lists the discount as inactive', async ({ addDiscountPage, discountsPage, testDiscounts }) => {
        const discount = newDiscount({ expiryDate: isoDate(0) });
        testDiscounts.track(discount.code);
        const response = await addDiscountPage.save(discount);

        expect(response.status()).toBe(303);
        await expect(discountsPage.expiryCell(discount.code)).toHaveText(displayDate(isoDate(0)));
        await expect(discountsPage.activateLink(discount.code)).toBeVisible();
    });

    test('rejects a duplicate code without creating a second discount', async ({ page, addDiscountPage, discountsPage, testDiscounts }) => {
        const discount = newDiscount();
        testDiscounts.track(discount.code);
        await addDiscountPage.save(discount);
        await expect(page).toHaveURL(/\/discounts$/);

        await addDiscountPage.goto();
        const response = await addDiscountPage.save({ ...discount, type: 'amount', value: '3' });

        expect(response.status()).toBe(400);
        await expect(addDiscountPage.fieldError('code')).toHaveText('A discount with this code already exists. Choose a different code.');
        await expect(addDiscountPage.codeInput).toHaveValue(discount.code);

        await discountsPage.goto();
        await expect(discountsPage.row(discount.code)).toHaveCount(1);
        await expect(discountsPage.typeCell(discount.code)).toHaveText('Percentage');
    });
});

test.describe('Access to the Add Discount page', () => {
    test('a signed-in customer is refused', async ({ page, signInAsCustomer }) => {
        await signInAsCustomer();
        const response = await page.goto('/discounts/add');

        expect(response?.status()).toBe(403);
        await expect(page.getByText('You do not have permission to view this page.')).toBeVisible();
    });

    test('a visitor who is not signed in is sent to the login page', async ({ page }) => {
        await page.goto('/discounts/add');

        await expect(page).toHaveURL(/\/login\?returnTo=/);
    });
});
