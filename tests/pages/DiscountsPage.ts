import { expect, type Locator, type Page, type Response } from '@playwright/test';

export class DiscountsPage {
    readonly heading: Locator;
    readonly addDiscountLink: Locator;
    readonly alert: Locator;

    constructor(private readonly page: Page) {
        this.heading = page.getByRole('heading', { name: 'Discounts', exact: true });
        this.addDiscountLink = page.getByRole('link', { name: 'Add Discount' });
        this.alert = page.getByRole('alert');
    }

    async goto() {
        await this.page.goto('/discounts');
        await expect(this.heading).toBeVisible();
    }

    row(code: string): Locator {
        return this.page.getByRole('row').filter({ has: this.page.getByRole('cell', { name: code, exact: true }) });
    }

    typeCell(code: string): Locator {
        return this.row(code).getByRole('cell').nth(1);
    }

    valueCell(code: string): Locator {
        return this.row(code).getByRole('cell').nth(2);
    }

    expiryCell(code: string): Locator {
        return this.row(code).getByRole('cell').nth(3);
    }

    deactivateButton(code: string): Locator {
        return this.page.getByRole('button', { name: `Deactivate discount ${code}`, exact: true });
    }

    activateLink(code: string): Locator {
        return this.page.getByRole('link', { name: `Activate discount ${code}`, exact: true });
    }

    // Returns the response to the form POST (303 on success).
    async deactivate(discountID: string, code: string): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(
                (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/discounts/${discountID}/deactivate`,
            ),
            this.deactivateButton(code).click(),
        ]);
        return response;
    }
}
