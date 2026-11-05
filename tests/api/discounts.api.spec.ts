import { expect, test } from '../helpers/fixtures';
import { codeOfLength, isoDate, uniqueCode, UNKNOWN_ID } from '../helpers/config';

test.describe('Adding a discount', () => {
    test('creates a percentage discount and lists it', async ({ adminApi, testDiscounts }) => {
        const code = uniqueCode();
        testDiscounts.track(code);
        const expiryDate = isoDate(30);

        const { status, body } = await adminApi.createDiscount({ code, type: 'PERCENTAGE', value: '25', expiryDate });

        expect(status).toBe(201);
        expect(body).toMatchObject({ code, type: 'PERCENTAGE', value: '25.00' });
        expect(body.discountID).toBeTruthy();
        expect(body.expiryDate.slice(0, 10)).toBe(expiryDate);
        expect(await adminApi.findDiscount(code)).toMatchObject({ discountID: body.discountID, code });
    });

    test('creates a raw amount discount with two decimal places', async ({ adminApi, testDiscounts }) => {
        const discount = await testDiscounts.create({ type: 'AMOUNT_OFF', value: '5.5' });

        expect(discount).toMatchObject({ type: 'AMOUNT_OFF', value: '5.50' });
        expect(await adminApi.findDiscount(discount.code)).toMatchObject({ value: '5.50' });
    });

    test('trims whitespace around the code', async ({ adminApi, testDiscounts }) => {
        const code = uniqueCode();
        testDiscounts.track(code);
        const { status, body } = await adminApi.createDiscount({
            code: `  ${code}  `,
            type: 'PERCENTAGE',
            value: '10',
            expiryDate: isoDate(5),
        });

        expect(status).toBe(201);
        expect(body.code).toBe(code);
    });

    test('accepts the shortest and longest allowed codes', async ({ testDiscounts }) => {
        const shortCode = codeOfLength(3);
        const longCode = codeOfLength(30).padStart(30, 'X');

        expect((await testDiscounts.create({ code: shortCode })).code).toBe(shortCode);
        expect((await testDiscounts.create({ code: longCode })).code).toBe(longCode);
    });

    test('accepts the boundary values 0% and 100%', async ({ testDiscounts }) => {
        expect((await testDiscounts.create({ type: 'PERCENTAGE', value: '0' })).value).toBe('0.00');
        expect((await testDiscounts.create({ type: 'PERCENTAGE', value: '100' })).value).toBe('100.00');
    });

    test('accepts an expiry date of today', async ({ testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(0) });

        expect(discount.expiryDate.slice(0, 10)).toBe(isoDate(0));
    });

    test('rejects a duplicate code and keeps the original discount', async ({ adminApi, testDiscounts }) => {
        const original = await testDiscounts.create({ type: 'PERCENTAGE', value: '10' });

        const { status, body } = await adminApi.createDiscount({
            code: original.code,
            type: 'AMOUNT_OFF',
            value: '3',
            expiryDate: isoDate(10),
        });

        expect(status).toBe(409);
        expect(body.error).toBe('A discount with this code already exists');
        expect(await adminApi.findDiscount(original.code)).toMatchObject({ type: 'PERCENTAGE', value: '10.00' });
    });

    const valid = () => ({ code: uniqueCode(), type: 'PERCENTAGE', value: '10', expiryDate: isoDate(5) });
    const invalidInputs: { name: string; field: string; input: () => object; }[] = [
        { name: 'a code that is too short', field: 'code', input: () => ({ ...valid(), code: 'AB' }) },
        { name: 'a code that is too long', field: 'code', input: () => ({ ...valid(), code: 'A'.repeat(31) }) },
        { name: 'a code containing a space', field: 'code', input: () => ({ ...valid(), code: 'SUMMER 10' }) },
        { name: 'a code containing special characters', field: 'code', input: () => ({ ...valid(), code: 'SALE!@£' }) },
        { name: 'an unknown type', field: 'type', input: () => ({ ...valid(), type: 'FIXED' }) },
        { name: 'a percentage above 100', field: 'value', input: () => ({ ...valid(), value: '101' }) },
        { name: 'a percentage with decimals', field: 'value', input: () => ({ ...valid(), value: '12.5' }) },
        { name: 'a negative percentage', field: 'value', input: () => ({ ...valid(), value: '-5' }) },
        { name: 'a non-numeric percentage', field: 'value', input: () => ({ ...valid(), value: 'abc' }) },
        { name: 'a zero amount', field: 'value', input: () => ({ ...valid(), type: 'AMOUNT_OFF', value: '0' }) },
        { name: 'an amount with 3 decimal places', field: 'value', input: () => ({ ...valid(), type: 'AMOUNT_OFF', value: '5.555' }) },
        { name: 'a negative amount', field: 'value', input: () => ({ ...valid(), type: 'AMOUNT_OFF', value: '-3' }) },
        { name: 'an expiry date in the past', field: 'expiryDate', input: () => ({ ...valid(), expiryDate: isoDate(-1) }) },
        { name: 'a malformed expiry date', field: 'expiryDate', input: () => ({ ...valid(), expiryDate: '31/12/2030' }) },
        { name: 'an impossible expiry date', field: 'expiryDate', input: () => ({ ...valid(), expiryDate: '2030-02-31' }) },
    ];

    for (const { name, field, input } of invalidInputs) {
        test(`rejects ${name} without saving it`, async ({ adminApi }) => {
            const payload = input() as { code: string; };
            const { status, body } = await adminApi.createDiscount(payload);

            expect(status).toBe(400);
            expect(body.details?.fieldErrors).toHaveProperty(field);
            expect(await adminApi.findDiscount(payload.code)).toBeUndefined();
        });
    }

    test('rejects a request with no fields', async ({ adminApi }) => {
        const { status, body } = await adminApi.createDiscount({});

        expect(status).toBe(400);
        expect(Object.keys(body.details?.fieldErrors ?? {})).toEqual(expect.arrayContaining(['code', 'type', 'value', 'expiryDate']));
    });
});

test.describe('Discount access control', () => {
    const newDiscount = () => ({ code: uniqueCode('NOADMIN'), type: 'PERCENTAGE', value: '10', expiryDate: isoDate(10) });

    test('a visitor who is not signed in is refused', async ({ anonymousApi }) => {
        expect((await anonymousApi.createDiscount(newDiscount())).status).toBe(401);
        expect((await anonymousApi.send('POST', `/discounts/${UNKNOWN_ID}/deactivate`)).status).toBe(401);
        expect((await anonymousApi.send('POST', `/discounts/${UNKNOWN_ID}/activate`, { expiryDate: isoDate(5) })).status).toBe(401);
    });

    test('a signed-in customer is refused', async ({ customerApi }) => {
        expect((await customerApi.createDiscount(newDiscount())).status).toBe(403);
        expect((await customerApi.send('POST', `/discounts/${UNKNOWN_ID}/deactivate`)).status).toBe(403);
        expect((await customerApi.send('POST', `/discounts/${UNKNOWN_ID}/activate`, { expiryDate: isoDate(5) })).status).toBe(403);
    });

    test('a refused customer request does not create the discount', async ({ customerApi, adminApi }) => {
        const discount = newDiscount();
        await customerApi.createDiscount(discount);

        expect(await adminApi.findDiscount(discount.code)).toBeUndefined();
    });
});

test.describe('Deactivating a discount', () => {
    test('sets the expiry date to today and leaves the other fields unchanged', async ({ adminApi, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(30) });

        const { status, body } = await adminApi.deactivateDiscount(discount.discountID);

        expect(status).toBe(200);
        expect(body).toMatchObject({
            discountID: discount.discountID,
            code: discount.code,
            type: discount.type,
            value: discount.value,
        });
        expect(body.expiryDate.slice(0, 10)).toBe(isoDate(0));
        expect((await adminApi.findDiscount(discount.code))?.expiryDate.slice(0, 10)).toBe(isoDate(0));
    });

    test('is harmless to repeat', async ({ adminApi, testDiscounts }) => {
        const discount = await testDiscounts.create();
        await adminApi.deactivateDiscount(discount.discountID);

        const { status, body } = await adminApi.deactivateDiscount(discount.discountID);

        expect(status).toBe(200);
        expect(body.expiryDate.slice(0, 10)).toBe(isoDate(0));
    });

    test('only affects the chosen discount', async ({ adminApi, testDiscounts }) => {
        const target = await testDiscounts.create();
        const other = await testDiscounts.create({ expiryDate: isoDate(30) });

        await adminApi.deactivateDiscount(target.discountID);

        expect((await adminApi.findDiscount(other.code))?.expiryDate.slice(0, 10)).toBe(isoDate(30));
    });

    test('returns 404 for an unknown discount', async ({ adminApi }) => {
        expect((await adminApi.deactivateDiscount(UNKNOWN_ID)).status).toBe(404);
    });
});

test.describe('Activating a discount', () => {
    test('sets the new expiry date and leaves the other fields unchanged', async ({ adminApi, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(0) });

        const { status, body } = await adminApi.activateDiscount(discount.discountID, { expiryDate: isoDate(20) });

        expect(status).toBe(200);
        expect(body).toMatchObject({ code: discount.code, type: discount.type, value: discount.value });
        expect(body.expiryDate.slice(0, 10)).toBe(isoDate(20));
        expect((await adminApi.findDiscount(discount.code))?.expiryDate.slice(0, 10)).toBe(isoDate(20));
    });

    test('can reactivate a discount that was deactivated', async ({ adminApi, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(30) });
        await adminApi.deactivateDiscount(discount.discountID);

        const { status, body } = await adminApi.activateDiscount(discount.discountID, { expiryDate: isoDate(45) });

        expect(status).toBe(200);
        expect(body.expiryDate.slice(0, 10)).toBe(isoDate(45));
    });

    test('accepts today as an expiry date', async ({ adminApi, testDiscounts }) => {
        const discount = await testDiscounts.create({ expiryDate: isoDate(30) });

        expect((await adminApi.activateDiscount(discount.discountID, { expiryDate: isoDate(0) })).status).toBe(200);
    });

    const invalidBodies: { name: string; body: () => object; }[] = [
        { name: 'a past date', body: () => ({ expiryDate: isoDate(-1) }) },
        { name: 'a malformed date', body: () => ({ expiryDate: '31/12/2030' }) },
        { name: 'an impossible date', body: () => ({ expiryDate: '2030-02-31' }) },
        { name: 'a missing date', body: () => ({}) },
    ];

    for (const { name, body } of invalidBodies) {
        test(`rejects ${name} without changing the discount`, async ({ adminApi, testDiscounts }) => {
            const discount = await testDiscounts.create({ expiryDate: isoDate(30) });

            const result = await adminApi.activateDiscount(discount.discountID, body());

            expect(result.status).toBe(400);
            expect((await adminApi.findDiscount(discount.code))?.expiryDate.slice(0, 10)).toBe(isoDate(30));
        });
    }

    test('returns 404 for an unknown discount', async ({ adminApi }) => {
        expect((await adminApi.activateDiscount(UNKNOWN_ID, { expiryDate: isoDate(5) })).status).toBe(404);
    });
});
