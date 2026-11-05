import type { Locator, Page } from '@playwright/test';

export class OrderConfirmationPage {
    readonly heading: Locator;
    readonly orderNumber: Locator;

    constructor(private readonly page: Page) {
        this.heading = page.getByRole('heading', { name: 'Thank you, your order is confirmed' });
        this.orderNumber = page.locator('.order-reference');
    }

    // "Total paid" is the final row; the other rows share the checkout labels.
    totalsRow(label: 'Subtotal' | 'Discount' | 'Delivery' | 'Total paid'): Locator {
        return this.page.locator('.total-row').filter({ has: this.page.getByText(label, { exact: true }) });
    }

    async amount(label: 'Subtotal' | 'Discount' | 'Delivery' | 'Total paid'): Promise<string> {
        return (await this.totalsRow(label).locator('span').last().innerText()).trim();
    }
}
