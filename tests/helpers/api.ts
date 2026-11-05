import { expect, request, type APIRequestContext } from '@playwright/test';
import { type Account, API_URL } from './config';

export type DiscountType = 'PERCENTAGE' | 'AMOUNT_OFF';

export interface DiscountInput {
    code: string;
    type: DiscountType;
    value: string;
    expiryDate: string;
}

export interface ApiDiscount extends DiscountInput {
    discountID: string;
}

export type Totals = {
    subtotal: string;
    discount: string;
    delivery: string;
    total: string;
};

export type PlacedOrder = Totals & { orderID: string; };

export interface CheckoutDetails {
    delivery: { firstname: string; surname: string; addressLine1: string; addressLine2?: string; postcode: string; };
    discountCode?: string;
    card: { cardNumber: string; expiry: string; cvv: string; };
}

export interface ApiResult<T = unknown> {
    status: number;
    body: T;
}

export interface ApiError {
    error: string;
    details?: { fieldErrors: Record<string, string[]>; };
}

// Thin wrapper over the backend REST API; signed in as one account, or anonymous.
export class ApiClient {
    private constructor(
        private readonly context: APIRequestContext,
        private readonly token: string | undefined,
    ) { }

    static async create(account?: Account): Promise<ApiClient> {
        const context = await request.newContext({ baseURL: API_URL });
        if (!account) return new ApiClient(context, undefined);

        const login = await context.post('/auth/verify', { data: account });
        expect(login.ok(), `log in to the backend as ${account.email}`).toBeTruthy();
        const { accessToken } = (await login.json()) as { accessToken: string; };
        return new ApiClient(context, accessToken);
    }

    dispose() {
        return this.context.dispose();
    }

    async send<T = unknown>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, data?: object): Promise<ApiResult<T>> {
        const response = await this.context.fetch(path, {
            method,
            ...(this.token ? { headers: { Authorization: `Bearer ${this.token}` } } : {}),
            ...(data ? { data } : {}),
        });
        const text = await response.text();
        return { status: response.status(), body: (text ? JSON.parse(text) : undefined) as T };
    }

    listDiscounts() {
        return this.send<{ discounts: ApiDiscount[]; }>('GET', '/discounts');
    }

    async findDiscount(code: string): Promise<ApiDiscount | undefined> {
        const { body } = await this.listDiscounts();
        return body.discounts.find((discount) => discount.code === code);
    }

    createDiscount(input: object) {
        return this.send<ApiDiscount & ApiError>('POST', '/discounts', input);
    }

    activateDiscount(discountID: string, body: object) {
        return this.send<ApiDiscount & ApiError>('POST', `/discounts/${discountID}/activate`, body);
    }

    deactivateDiscount(discountID: string) {
        return this.send<ApiDiscount & ApiError>('POST', `/discounts/${discountID}/deactivate`);
    }

    async clearBasket() {
        const { body } = await this.send<{ items: { productID: string; }[]; }>('GET', '/basket');
        for (const item of body.items) {
            await this.send('DELETE', `/basket/items/${item.productID}`);
        }
    }

    async fillBasket(productID: string, quantity: number) {
        await this.clearBasket();
        const result = await this.send('POST', '/basket/items', { productID, quantity });
        expect(result.status, 'add the product to the basket').toBe(201);
    }

    getQuote(discountCode?: string) {
        return this.send<Totals & ApiError>('POST', '/checkout/quote', discountCode === undefined ? {} : { discountCode });
    }

    placeOrder(details: CheckoutDetails) {
        return this.send<PlacedOrder & ApiError>('POST', '/checkout', details);
    }

    listOrders() {
        return this.send<{ orders: (Totals & { orderID: string; })[]; }>('GET', '/orders');
    }

    getBasket() {
        return this.send<{ items: { productID: string; quantityInBasket: number; unitPrice: string; }[]; }>('GET', '/basket');
    }
}
