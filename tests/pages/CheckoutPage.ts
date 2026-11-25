import { expect, type Locator, type Page, type Response } from '@playwright/test';

export interface Address {
    firstname: string;
    surname: string;
    addressLine1: string;
    addressLine2: string;
    postcode: string;
}

export interface Card {
    cardNumber: string;
    expiry: string;
    cvv: string;
}

export type TotalsRow = 'Subtotal' | 'Discount' | 'Delivery' | 'Total';

export class CheckoutPage {
    readonly heading: Locator;
    readonly discountInput: Locator;
    readonly applyButton: Locator;
    readonly discountError: Locator;
    readonly discountApplied: Locator;
    readonly staleDiscountMessage: Locator;
    readonly payButton: Locator;
    readonly alert: Locator;

    constructor(private readonly page: Page) {
        this.heading = page.getByRole('heading', { name: 'Checkout', exact: true });
        this.discountInput = page.getByLabel('Discount code');
        this.applyButton = page.getByRole('button', { name: 'Apply' });
        this.discountError = page.locator('#discountCode-error');
        this.discountApplied = page.getByText('Discount code applied');
        this.staleDiscountMessage = page.locator('#discount-refresh-message');
        this.payButton = page.locator('#pay-button');
        this.alert = page.getByRole('alert');
    }

    async goto() {
        await this.page.goto('/checkout');
        await expect(this.heading).toBeVisible();
    }

    // A single amount in the order total, such as "Discount" or "Total".
    totalsRow(label: TotalsRow): Locator {
        return this.page.locator('.checkout-summary .total-row').filter({ has: this.page.getByText(label, { exact: true }) });
    }

    async amount(label: TotalsRow): Promise<string> {
        return (await this.totalsRow(label).locator('span').last().innerText()).trim();
    }

    // Returns the response to the Apply form POST (200 when the code is accepted, 400 when it is not).
    async applyDiscount(code: string): Promise<Response> {
        await this.discountInput.fill(code);
        const [response] = await Promise.all([
            this.page.waitForResponse(
                (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/checkout/discount',
            ),
            this.applyButton.click(),
        ]);
        return response;
    }

    async fillDelivery(address: Address) {
        // A customer with a saved address can choose a different one; otherwise the fields are always shown.
        const differentAddress = this.page.getByLabel('Use a different address');
        if (await differentAddress.isVisible()) await differentAddress.check();

        await this.page.getByLabel('First name').fill(address.firstname);
        await this.page.getByLabel('Surname').fill(address.surname);
        await this.page.getByLabel('Address line 1').fill(address.addressLine1);
        await this.page.getByLabel('Address line 2 (optional)').fill(address.addressLine2);
        await this.page.getByLabel('Postcode').fill(address.postcode);
    }

    async fillCard(card: Card) {
        await this.page.getByLabel('Card number (16 digits)').fill(card.cardNumber);
        await this.page.getByLabel('Expiry date (required)').fill(card.expiry);
        await this.page.getByLabel('Security code (3 digits)').fill(card.cvv);
    }

    // Returns the response to the order POST (200 with the confirmation page when the order is placed).
    async pay(): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(
                (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/checkout',
            ),
            this.payButton.click(),
        ]);
        return response;
    }

    async placeOrder(address: Address, card: Card): Promise<Response> {
        await this.fillDelivery(address);
        await this.fillCard(card);
        return this.pay();
    }
}
