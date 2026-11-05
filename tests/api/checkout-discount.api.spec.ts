import type { Totals } from '../helpers/api';
import { APPROVED_CARD, DECLINED_CARD, DELIVERY_ADDRESS, DELIVERY_CHARGE, PRODUCT, isoDate, toPence, toPounds } from '../helpers/config';
import { expect, test } from '../helpers/fixtures';

const QUANTITY = 2;

// Whole pence, like the backend, so decimal rounding cannot creep into the expected values.
function expectedTotals(subtotal: string, discountPence: number): Totals {
    const subtotalPence = toPence(subtotal);
    const discount = Math.min(discountPence, subtotalPence);
    return {
        subtotal,
        discount: toPounds(discount),
        delivery: DELIVERY_CHARGE,
        total: toPounds(subtotalPence - discount + toPence(DELIVERY_CHARGE)),
    };
}

const details = (discountCode?: string) => ({
    delivery: DELIVERY_ADDRESS,
    card: APPROVED_CARD,
    ...(discountCode === undefined ? {} : { discountCode }),
});

test.beforeEach(async ({ customerApi }) => {
    await customerApi.fillBasket(PRODUCT.productID, QUANTITY);
});

test.describe('Quoting a basket with a discount code', () => {
    test('the subtotal is the unit price times the quantity', async ({ customerApi }) => {
        const { body: basket } = await customerApi.getBasket();
        const { body: quote } = await customerApi.getQuote();

        expect(basket.items).toHaveLength(1);
        expect(quote.subtotal).toBe(toPounds(toPence(basket.items[0]!.unitPrice) * QUANTITY));
    });

    test('without a code there is no discount', async ({ customerApi }) => {
        const { status, body } = await customerApi.getQuote();

        expect(status).toBe(200);
        expect(body).toEqual(expectedTotals(body.subtotal, 0));
    });

    test('a percentage discount takes that share off the items', async ({ customerApi, testDiscounts }) => {
        const { body: base } = await customerApi.getQuote();
        const discount = await testDiscounts.create({ type: 'PERCENTAGE', value: '50' });

        const { status, body } = await customerApi.getQuote(discount.code);

        expect(status).toBe(200);
        expect(body).toEqual(expectedTotals(base.subtotal, toPence(base.subtotal) / 2));
    });

    test('an amount-off discount takes that amount off the items', async ({ customerApi, testDiscounts }) => {
        const { body: base } = await customerApi.getQuote();
        const discount = await testDiscounts.create({ type: 'AMOUNT_OFF', value: '5.00' });

        const { body } = await customerApi.getQuote(discount.code);

        expect(body).toEqual(expectedTotals(base.subtotal, 500));
    });

    test('a 100% discount leaves only the delivery charge to pay', async ({ customerApi, testDiscounts }) => {
        const { body: base } = await customerApi.getQuote();
        const discount = await testDiscounts.create({ type: 'PERCENTAGE', value: '100' });

        const { body } = await customerApi.getQuote(discount.code);

        expect(body.discount).toBe(base.subtotal);
        expect(body.total).toBe(DELIVERY_CHARGE);
    });

    test('a 0% discount changes nothing', async ({ customerApi, testDiscounts }) => {
        const { body: base } = await customerApi.getQuote();
        const discount = await testDiscounts.create({ type: 'PERCENTAGE', value: '0' });

        const { body } = await customerApi.getQuote(discount.code);

        expect(body).toEqual(base);
    });

    test('an amount larger than the items is capped so the items cost nothing', async ({ customerApi, testDiscounts }) => {
        const { body: base } = await customerApi.getQuote();
        const discount = await testDiscounts.create({ type: 'AMOUNT_OFF', value: '9999.00' });

        const { body } = await customerApi.getQuote(discount.code);

        expect(body.discount).toBe(base.subtotal);
        expect(body.total).toBe(DELIVERY_CHARGE);
    });

    test('the code ignores letter case and surrounding spaces', async ({ customerApi, testDiscounts }) => {
        const discount = await testDiscounts.create({ type: 'AMOUNT_OFF', value: '2.00' });

        const { status, body } = await customerApi.getQuote(`  ${discount.code.toLowerCase()}  `);

        expect(status).toBe(200);
        expect(body.discount).toBe('2.00');
    });

    test('rejects a code that does not exist', async ({ customerApi }) => {
        const { status, body } = await customerApi.getQuote('NOSUCHCODE');

        expect(status).toBe(400);
        expect(body.error).toBe('That discount code is not valid');
    });

    test('rejects a deactivated discount', async ({ customerApi, adminApi, testDiscounts }) => {
        const discount = await testDiscounts.create();
        await adminApi.deactivateDiscount(discount.discountID);

        const { status, body } = await customerApi.getQuote(discount.code);

        expect(status).toBe(400);
        expect(body.error).toBe('That discount code has expired');
    });

    test('rejects a discount that expires today', async ({ customerApi, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(0) });

        expect((await customerApi.getQuote(discount.code)).status).toBe(400);
    });

    test('accepts a discount that expires tomorrow', async ({ customerApi, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(1) });

        expect((await customerApi.getQuote(discount.code)).status).toBe(200);
    });

    test('accepts a discount again once it is reactivated', async ({ customerApi, adminApi, testDiscounts }) => {
        const discount = await testDiscounts.create();
        await adminApi.deactivateDiscount(discount.discountID);
        expect((await customerApi.getQuote(discount.code)).status).toBe(400);

        await adminApi.activateDiscount(discount.discountID, { expiryDate: isoDate(14) });

        expect((await customerApi.getQuote(discount.code)).status).toBe(200);
    });

    test('does not place an order or change the basket', async ({ customerApi, testDiscounts }) => {
        const discount = await testDiscounts.create();
        const ordersBefore = (await customerApi.listOrders()).body.orders.length;

        await customerApi.getQuote(discount.code);

        expect((await customerApi.listOrders()).body.orders).toHaveLength(ordersBefore);
        expect((await customerApi.getBasket()).body.items[0]?.quantityInBasket).toBe(QUANTITY);
    });

    test('rejects an empty basket', async ({ customerApi }) => {
        await customerApi.clearBasket();

        expect((await customerApi.getQuote()).status).toBe(400);
    });

    test('requires the customer to be signed in', async ({ anonymousApi }) => {
        expect((await anonymousApi.getQuote()).status).toBe(401);
    });
});

test.describe('Placing an order with a discount code', () => {
    test('charges the discounted total and returns the same figures as the quote', async ({ customerApi, testDiscounts }) => {
        const discount = await testDiscounts.create({ type: 'PERCENTAGE', value: '50' });
        const { body: quote } = await customerApi.getQuote(discount.code);

        const { status, body } = await customerApi.placeOrder(details(discount.code));

        expect(status).toBe(201);
        expect(body).toMatchObject({ subtotal: quote.subtotal, discount: quote.discount, delivery: quote.delivery, total: quote.total });
        expect(body.orderID).toBeTruthy();
    });

    test('an amount-off discount is applied to the order', async ({ customerApi, testDiscounts }) => {
        const { body: base } = await customerApi.getQuote();
        const discount = await testDiscounts.create({ type: 'AMOUNT_OFF', value: '5.00' });

        const { status, body } = await customerApi.placeOrder(details(discount.code));

        expect(status).toBe(201);
        expect(body).toMatchObject(expectedTotals(base.subtotal, 500));
    });

    test('the order is saved with its discount and the basket is emptied', async ({ customerApi, testDiscounts }) => {
        const { body: base } = await customerApi.getQuote();
        const discount = await testDiscounts.create({ type: 'AMOUNT_OFF', value: '5.00' });

        const { body: placed } = await customerApi.placeOrder(details(discount.code));

        const { body: history } = await customerApi.listOrders();
        expect(history.orders.find((order) => order.orderID === placed.orderID)).toMatchObject(expectedTotals(base.subtotal, 500));
        expect((await customerApi.getBasket()).body.items).toEqual([]);
    });

    test('without a code the order has no discount', async ({ customerApi }) => {
        const { status, body } = await customerApi.placeOrder(details());

        expect(status).toBe(201);
        expect(body.discount).toBe('0.00');
        expect(body.total).toBe(toPounds(toPence(body.subtotal) + toPence(DELIVERY_CHARGE)));
    });

    test('an unknown code is rejected and no order is placed', async ({ customerApi }) => {
        const ordersBefore = (await customerApi.listOrders()).body.orders.length;

        const { status, body } = await customerApi.placeOrder(details('NOSUCHCODE'));

        expect(status).toBe(400);
        expect(body.error).toBe('That discount code is not valid');
        expect((await customerApi.listOrders()).body.orders).toHaveLength(ordersBefore);
        expect((await customerApi.getBasket()).body.items).toHaveLength(1);
    });

    test('a deactivated discount is rejected and the basket is kept', async ({ customerApi, adminApi, testDiscounts }) => {
        const discount = await testDiscounts.create();
        await adminApi.deactivateDiscount(discount.discountID);
        const ordersBefore = (await customerApi.listOrders()).body.orders.length;

        const { status, body } = await customerApi.placeOrder(details(discount.code));

        expect(status).toBe(400);
        expect(body.error).toBe('That discount code has expired');
        expect((await customerApi.listOrders()).body.orders).toHaveLength(ordersBefore);
        expect((await customerApi.getBasket()).body.items).toHaveLength(1);
    });

    test('a declined card places no order and leaves the basket alone', async ({ customerApi, testDiscounts }) => {
        const discount = await testDiscounts.create();
        const ordersBefore = (await customerApi.listOrders()).body.orders.length;

        const { status } = await customerApi.placeOrder({ ...details(discount.code), card: DECLINED_CARD });

        expect(status).toBe(402);
        expect((await customerApi.listOrders()).body.orders).toHaveLength(ordersBefore);
        expect((await customerApi.getBasket()).body.items).toHaveLength(1);
    });

    test('requires the customer to be signed in', async ({ anonymousApi }) => {
        expect((await anonymousApi.placeOrder(details())).status).toBe(401);
    });
});
