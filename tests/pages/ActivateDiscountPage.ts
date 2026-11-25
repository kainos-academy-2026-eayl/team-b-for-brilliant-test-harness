import { expect, type Locator, type Page, type Response } from '@playwright/test';

export class ActivateDiscountPage {
    readonly heading: Locator;
    readonly expiryInput: Locator;
    readonly activateButton: Locator;
    readonly cancelLink: Locator;
    readonly expiryError: Locator;
    readonly alert: Locator;

    constructor(private readonly page: Page) {
        this.heading = page.getByRole('heading', { name: 'Activate Discount' });
        this.expiryInput = page.getByLabel('New expiry date');
        this.activateButton = page.getByRole('button', { name: 'Activate Discount' });
        this.cancelLink = page.getByRole('link', { name: 'Cancel' });
        this.expiryError = page.locator('#expiryDate-error');
        this.alert = page.getByRole('alert');
    }

    async goto(discountID: string) {
        await this.page.goto(`/discounts/${discountID}/activate`);
        await expect(this.heading).toBeVisible();
    }

    prompt(code: string): Locator {
        return this.page.getByText(`Enter a new expiry date for discount ${code}.`);
    }

    // Returns the response to the form POST (303 on success, 400 when the date is rejected).
    async submit(expiryDate: string): Promise<Response> {
        await this.expiryInput.fill(expiryDate);
        const [response] = await Promise.all([
            this.page.waitForResponse(
                (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/activate'),
            ),
            this.activateButton.click(),
        ]);
        return response;
    }
}
