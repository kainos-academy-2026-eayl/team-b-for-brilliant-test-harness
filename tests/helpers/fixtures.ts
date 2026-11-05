import { expect, test as base } from '@playwright/test';
import { ApiClient, type ApiDiscount, type DiscountInput } from './api';
import { ADMIN, CUSTOMER, isoDate, uniqueCode } from './config';
import { deleteDiscountsByCode } from './database';
import { ActivateDiscountPage } from '../pages/ActivateDiscountPage';
import { AddDiscountPage } from '../pages/AddDiscountPage';
import { BasketPage } from '../pages/BasketPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { DiscountsPage } from '../pages/DiscountsPage';
import { LoginPage } from '../pages/LoginPage';
import { OrderConfirmationPage } from '../pages/OrderConfirmationPage';

// Creates discounts through the API and removes them from the database afterwards.
export class TestDiscounts {
    private readonly codes = new Set<string>();

    constructor(private readonly api: ApiClient) { }

    // Registers a code created some other way (for example through the UI) for cleanup.
    track(code: string): string {
        this.codes.add(code);
        return code;
    }

    async create(overrides: Partial<DiscountInput> = {}): Promise<ApiDiscount> {
        const input: DiscountInput = {
            code: uniqueCode(),
            type: 'PERCENTAGE',
            value: '25',
            expiryDate: isoDate(30),
            ...overrides,
        };
        this.track(input.code);
        const result = await this.api.createDiscount(input);
        expect(result.status, `create discount ${input.code}`).toBe(201);
        return result.body;
    }

    async cleanUp() {
        try {
            await deleteDiscountsByCode([...this.codes]);
        } catch (error) {
            // Without database access the best the API allows is to stop the discounts being usable.
            console.warn(`Could not delete test discounts, expiring them instead: ${(error as Error).message}`);
            const { body } = await this.api.listDiscounts();
            for (const discount of body.discounts.filter((d) => this.codes.has(d.code))) {
                await this.api.deactivateDiscount(discount.discountID);
            }
        }
    }
}

interface Fixtures {
    anonymousApi: ApiClient;
    customerApi: ApiClient;
    adminApi: ApiClient;
    testDiscounts: TestDiscounts;
    signInAsAdmin: () => Promise<void>;
    signInAsCustomer: () => Promise<void>;
    loginPage: LoginPage;
    discountsPage: DiscountsPage;
    addDiscountPage: AddDiscountPage;
    activateDiscountPage: ActivateDiscountPage;
    basketPage: BasketPage;
    checkoutPage: CheckoutPage;
    orderConfirmationPage: OrderConfirmationPage;
}

export const test = base.extend<Fixtures>({
    anonymousApi: async ({}, use) => {
        const api = await ApiClient.create();
        await use(api);
        await api.dispose();
    },

    // The basket is emptied afterwards because every test shares this one customer.
    customerApi: async ({}, use) => {
        const api = await ApiClient.create(CUSTOMER);
        await use(api);
        await api.clearBasket();
        await api.dispose();
    },

    adminApi: async ({}, use) => {
        const api = await ApiClient.create(ADMIN);
        await use(api);
        await api.dispose();
    },

    testDiscounts: async ({ adminApi }, use) => {
        const discounts = new TestDiscounts(adminApi);
        await use(discounts);
        await discounts.cleanUp();
    },

    signInAsAdmin: async ({ loginPage }, use) => {
        await use(() => loginPage.signIn(ADMIN));
    },

    signInAsCustomer: async ({ loginPage }, use) => {
        await use(() => loginPage.signIn(CUSTOMER));
    },

    loginPage: async ({ page }, use) => use(new LoginPage(page)),
    discountsPage: async ({ page }, use) => use(new DiscountsPage(page)),
    addDiscountPage: async ({ page }, use) => use(new AddDiscountPage(page)),
    activateDiscountPage: async ({ page }, use) => use(new ActivateDiscountPage(page)),
    basketPage: async ({ page }, use) => use(new BasketPage(page)),
    checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
    orderConfirmationPage: async ({ page }, use) => use(new OrderConfirmationPage(page)),
});

export { expect };
