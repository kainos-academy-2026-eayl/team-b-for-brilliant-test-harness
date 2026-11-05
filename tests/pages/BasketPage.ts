import { expect, type Locator, type Page } from '@playwright/test';

export class BasketPage {
    readonly heading: Locator;
    readonly checkoutLink: Locator;
    readonly emptyMessage: Locator;

    constructor(private readonly page: Page) {
        this.heading = page.getByRole('heading', { name: 'Your Basket' });
        this.checkoutLink = page.getByRole('link', { name: 'Go to checkout' });
        this.emptyMessage = page.getByText('Your basket is empty.');
    }

    async goto() {
        await this.page.goto('/basket');
        await expect(this.heading).toBeVisible();
    }
}
