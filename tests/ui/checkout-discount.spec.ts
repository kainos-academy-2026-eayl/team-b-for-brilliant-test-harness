import type { Browser } from '@playwright/test';
import { APPROVED_CARD, CUSTOMER, DECLINED_CARD, DELIVERY_ADDRESS, DELIVERY_CHARGE, isoDate, PRODUCT, toPence, toPounds, uniqueCode } from '../helpers/config';
import { expect, test } from '../helpers/fixtures';
import { CheckoutPage } from '../pages/CheckoutPage';
import { LoginPage } from '../pages/LoginPage';
import { OrderConfirmationPage } from '../pages/OrderConfirmationPage';

const QUANTITY = 2;
const INVALID_CODE_MESSAGE = 'Invalid discount code';

const pounds = (pence: number) => `£${toPounds(pence)}`;
const total = (subtotal: string, discountPence: number) => pounds(toPence(subtotal) - discountPence + toPence(DELIVERY_CHARGE));

// Every test shares the one seeded customer, so each starts from a known basket.
test.beforeEach(async ({ customerApi }) => {
    await customerApi.fillBasket(PRODUCT.productID, QUANTITY);
});

test.describe('Reaching checkout', () => {
    test('the basket links to checkout, which shows the order total with no discount', async ({ customerApi, signInAsCustomer, basketPage, checkoutPage }) => {
        const { body: quote } = await customerApi.getQuote();
        await signInAsCustomer();
        await basketPage.goto();
        await basketPage.checkoutLink.click();

        await expect(checkoutPage.heading).toBeVisible();
        await expect(checkoutPage.totalsRow('Subtotal')).toContainText(pounds(toPence(quote.subtotal)));
        await expect(checkoutPage.totalsRow('Delivery')).toContainText(`£${DELIVERY_CHARGE}`);
        await expect(checkoutPage.totalsRow('Discount')).toHaveCount(0);
        await expect(checkoutPage.totalsRow('Total')).toContainText(total(quote.subtotal, 0));
        await expect(checkoutPage.payButton).toHaveText(`Pay ${total(quote.subtotal, 0)}`);
        await expect(checkoutPage.payButton).toBeEnabled();
        await expect(checkoutPage.discountInput).toBeEmpty();
    });

    test('a visitor who is not signed in is sent to the login page', async ({ page }) => {
        await page.goto('/checkout');

        await expect(page).toHaveURL(/\/login/);
    });

    test('an empty basket is sent back to the basket', async ({ customerApi, signInAsCustomer, page, basketPage }) => {
        await customerApi.clearBasket();
        await signInAsCustomer();
        await page.goto('/checkout');

        await expect(page).toHaveURL(/\/basket$/);
        await expect(basketPage.emptyMessage).toBeVisible();
    });
});

test.describe('Applying a discount code at checkout', () => {
    test.beforeEach(async ({ signInAsCustomer, checkoutPage }) => {
        await signInAsCustomer();
        await checkoutPage.goto();
    });

    test('a percentage discount shows the discount and the new total', async ({ customerApi, checkoutPage, testDiscounts }) => {
        const { body: base } = await customerApi.getQuote();
        const discount = await testDiscounts.create({ type: 'PERCENTAGE', value: '50' });
        const discountPence = toPence(base.subtotal) / 2;

        const response = await checkoutPage.applyDiscount(discount.code);

        expect(response.status()).toBe(200);
        await expect(checkoutPage.discountApplied).toBeVisible();
        await expect(checkoutPage.discountError).toHaveCount(0);
        await expect(checkoutPage.totalsRow('Discount')).toContainText(`−${pounds(discountPence)}`);
        await expect(checkoutPage.totalsRow('Total')).toContainText(total(base.subtotal, discountPence));
        await expect(checkoutPage.payButton).toHaveText(`Pay ${total(base.subtotal, discountPence)}`);
        await expect(checkoutPage.payButton).toBeEnabled();
        await expect(checkoutPage.discountInput).toHaveValue(discount.code);
    });

    test('an amount-off discount takes that amount off the items', async ({ customerApi, checkoutPage, testDiscounts }) => {
        const { body: base } = await customerApi.getQuote();
        const discount = await testDiscounts.create({ type: 'AMOUNT_OFF', value: '5.00' });

        await checkoutPage.applyDiscount(discount.code);

        await expect(checkoutPage.totalsRow('Discount')).toContainText('−£5.00');
        await expect(checkoutPage.totalsRow('Total')).toContainText(total(base.subtotal, 500));
    });

    test('a 100% discount leaves only the delivery charge to pay', async ({ checkoutPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ type: 'PERCENTAGE', value: '100' });

        await checkoutPage.applyDiscount(discount.code);

        await expect(checkoutPage.totalsRow('Total')).toContainText(`£${DELIVERY_CHARGE}`);
        await expect(checkoutPage.payButton).toHaveText(`Pay £${DELIVERY_CHARGE}`);
    });

    test('the code ignores letter case', async ({ checkoutPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ type: 'AMOUNT_OFF', value: '2.00' });

        await checkoutPage.applyDiscount(discount.code.toLowerCase());

        await expect(checkoutPage.discountApplied).toBeVisible();
        await expect(checkoutPage.totalsRow('Discount')).toContainText('−£2.00');
    });

    test('an unknown code is rejected and the total is unchanged', async ({ customerApi, checkoutPage }) => {
        const { body: base } = await customerApi.getQuote();

        const response = await checkoutPage.applyDiscount('NOSUCHCODE');

        expect(response.status()).toBe(400);
        await expect(checkoutPage.discountError).toHaveText(INVALID_CODE_MESSAGE);
        await expect(checkoutPage.discountApplied).toHaveCount(0);
        await expect(checkoutPage.totalsRow('Discount')).toHaveCount(0);
        await expect(checkoutPage.totalsRow('Total')).toContainText(total(base.subtotal, 0));
        await expect(checkoutPage.payButton).toBeDisabled();
    });

    test('a deactivated discount is rejected', async ({ adminApi, checkoutPage, testDiscounts }) => {
        const discount = await testDiscounts.create();
        await adminApi.deactivateDiscount(discount.discountID);

        const response = await checkoutPage.applyDiscount(discount.code);

        expect(response.status()).toBe(400);
        await expect(checkoutPage.discountError).toHaveText(INVALID_CODE_MESSAGE);
        await expect(checkoutPage.payButton).toBeDisabled();
    });

    test('a discount expiring tomorrow is accepted', async ({ checkoutPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(1) });

        const response = await checkoutPage.applyDiscount(discount.code);

        expect(response.status()).toBe(200);
        await expect(checkoutPage.discountApplied).toBeVisible();
    });

    test('clearing the code and applying again removes the discount', async ({ customerApi, checkoutPage, testDiscounts }) => {
        const { body: base } = await customerApi.getQuote();
        const discount = await testDiscounts.create();
        await checkoutPage.applyDiscount(discount.code);
        await expect(checkoutPage.totalsRow('Discount')).toBeVisible();

        await checkoutPage.applyDiscount('');

        await expect(checkoutPage.totalsRow('Discount')).toHaveCount(0);
        await expect(checkoutPage.totalsRow('Total')).toContainText(total(base.subtotal, 0));
    });

    test('changing the code after applying it blocks payment until it is applied again', async ({ checkoutPage, testDiscounts }) => {
        const discount = await testDiscounts.create();
        await checkoutPage.applyDiscount(discount.code);
        await expect(checkoutPage.payButton).toBeEnabled();

        await checkoutPage.discountInput.fill(`${discount.code}X`);

        await expect(checkoutPage.payButton).toBeDisabled();
        await expect(checkoutPage.staleDiscountMessage).toBeVisible();

        await checkoutPage.discountInput.fill(discount.code);

        await expect(checkoutPage.payButton).toBeEnabled();
        await expect(checkoutPage.staleDiscountMessage).toBeHidden();
    });

    test('typing a code without applying it blocks payment', async ({ checkoutPage }) => {
        await checkoutPage.discountInput.fill('SOMECODE');

        await expect(checkoutPage.payButton).toBeDisabled();
        await expect(checkoutPage.staleDiscountMessage).toBeVisible();
    });
});

test.describe('Paying with a discount code', () => {
    test.beforeEach(async ({ signInAsCustomer, checkoutPage }) => {
        await signInAsCustomer();
        await checkoutPage.goto();
    });

    test('the confirmation shows the discounted total and the order is saved', async ({ customerApi, checkoutPage, orderConfirmationPage, testDiscounts }) => {
        const { body: base } = await customerApi.getQuote();
        const discount = await testDiscounts.create({ type: 'AMOUNT_OFF', value: '5.00' });
        await checkoutPage.applyDiscount(discount.code);

        const response = await checkoutPage.placeOrder(DELIVERY_ADDRESS, APPROVED_CARD);

        expect(response.status()).toBe(200);
        await expect(orderConfirmationPage.heading).toBeVisible();
        expect(await orderConfirmationPage.amount('Subtotal')).toBe(pounds(toPence(base.subtotal)));
        expect(await orderConfirmationPage.amount('Discount')).toBe('−£5.00');
        expect(await orderConfirmationPage.amount('Delivery')).toBe(`£${DELIVERY_CHARGE}`);
        expect(await orderConfirmationPage.amount('Total paid')).toBe(total(base.subtotal, 500));

        const orderID = (await orderConfirmationPage.orderNumber.innerText()).trim();
        const { body: history } = await customerApi.listOrders();
        expect(history.orders.find((order) => order.orderID === orderID)).toMatchObject({
            discount: '5.00',
            total: total(base.subtotal, 500).slice(1),
        });
    });

    test('the basket is empty after the order, so checkout sends the customer back to the basket', async ({ page, checkoutPage, basketPage, testDiscounts }) => {
        const discount = await testDiscounts.create();
        await checkoutPage.applyDiscount(discount.code);
        await checkoutPage.placeOrder(DELIVERY_ADDRESS, APPROVED_CARD);

        await page.goto('/checkout');

        await expect(page).toHaveURL(/\/basket$/);
        await expect(basketPage.emptyMessage).toBeVisible();
    });

    test('an order without a code shows no discount', async ({ checkoutPage, orderConfirmationPage }) => {
        await checkoutPage.placeOrder(DELIVERY_ADDRESS, APPROVED_CARD);

        await expect(orderConfirmationPage.heading).toBeVisible();
        await expect(orderConfirmationPage.totalsRow('Discount')).toHaveCount(0);
    });

    test('a declined card places no order and keeps the discount applied', async ({ customerApi, checkoutPage, orderConfirmationPage, testDiscounts }) => {
        const discount = await testDiscounts.create({ type: 'AMOUNT_OFF', value: '5.00' });
        const ordersBefore = (await customerApi.listOrders()).body.orders.length;
        await checkoutPage.applyDiscount(discount.code);

        const response = await checkoutPage.placeOrder(DELIVERY_ADDRESS, DECLINED_CARD);

        expect(response.status()).toBe(402);
        await expect(checkoutPage.alert).toContainText('Your card was declined');
        await expect(orderConfirmationPage.heading).toHaveCount(0);
        await expect(checkoutPage.totalsRow('Discount')).toContainText('−£5.00');
        expect((await customerApi.listOrders()).body.orders).toHaveLength(ordersBefore);
        expect((await customerApi.getBasket()).body.items).toHaveLength(1);
    });

    test('a discount deactivated before paying is refused and no order is placed', async ({ adminApi, customerApi, checkoutPage, orderConfirmationPage, testDiscounts }) => {
        const discount = await testDiscounts.create();
        const ordersBefore = (await customerApi.listOrders()).body.orders.length;
        await checkoutPage.applyDiscount(discount.code);
        await adminApi.deactivateDiscount(discount.discountID);

        const response = await checkoutPage.placeOrder(DELIVERY_ADDRESS, APPROVED_CARD);

        expect(response.status()).toBe(400);
        await expect(checkoutPage.alert).toContainText('That discount code has expired');
        await expect(checkoutPage.discountError).toHaveText(INVALID_CODE_MESSAGE);
        await expect(orderConfirmationPage.heading).toHaveCount(0);
        expect((await customerApi.listOrders()).body.orders).toHaveLength(ordersBefore);
    });
});

test.describe('Discounts managed on the discounts page and used at checkout', () => {
    async function openCustomerSession(browser: Browser, baseURL: string | undefined) {
        const context = await browser.newContext(baseURL ? { baseURL } : {});
        const page = await context.newPage();
        await new LoginPage(page).signIn(CUSTOMER);
        return { context, checkout: new CheckoutPage(page), confirmation: new OrderConfirmationPage(page) };
    }

    test('a new discount works at checkout, stops when deactivated and works again once reactivated', async ({
        browser, baseURL, adminApi, signInAsAdmin, addDiscountPage, discountsPage, activateDiscountPage, testDiscounts,
    }) => {
        const code = testDiscounts.track(uniqueCode('FLOW'));
        await signInAsAdmin();
        await addDiscountPage.goto();
        await addDiscountPage.save({ code, type: 'amount', value: '5.00', expiryDate: isoDate(30) });
        const saved = await adminApi.findDiscount(code);
        expect(saved).toBeDefined();

        const customer = await openCustomerSession(browser, baseURL);
        try {
            await customer.checkout.goto();
            expect((await customer.checkout.applyDiscount(code)).status()).toBe(200);
            await expect(customer.checkout.totalsRow('Discount')).toContainText('−£5.00');

            await discountsPage.goto();
            await discountsPage.deactivate(saved!.discountID, code);

            expect((await customer.checkout.applyDiscount(code)).status()).toBe(400);
            await expect(customer.checkout.discountError).toHaveText(INVALID_CODE_MESSAGE);

            await discountsPage.activateLink(code).click();
            await activateDiscountPage.submit(isoDate(14));

            expect((await customer.checkout.applyDiscount(code)).status()).toBe(200);
            await expect(customer.checkout.discountApplied).toBeVisible();

            await customer.checkout.placeOrder(DELIVERY_ADDRESS, APPROVED_CARD);
            await expect(customer.confirmation.heading).toBeVisible();
            expect(await customer.confirmation.amount('Discount')).toBe('−£5.00');
        } finally {
            await customer.context.close();
        }
    });
});
