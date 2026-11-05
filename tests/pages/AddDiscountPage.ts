import { expect, type Locator, type Page, type Response } from '@playwright/test';

export interface DiscountFormValues {
    code: string;
    type: 'percentage' | 'amount' | '';
    value: string;
    expiryDate: string;
}

export type DiscountField = 'code' | 'type' | 'value' | 'expiryDate';

export class AddDiscountPage {
    readonly heading: Locator;
    readonly codeInput: Locator;
    readonly typeSelect: Locator;
    readonly valueInput: Locator;
    readonly expiryInput: Locator;
    readonly saveButton: Locator;
    readonly alert: Locator;

    constructor(private readonly page: Page) {
        this.heading = page.getByRole('heading', { name: 'Add Discount' });
        this.codeInput = page.getByLabel('Discount code');
        this.typeSelect = page.getByLabel('Discount type');
        this.valueInput = page.getByLabel('Value');
        this.expiryInput = page.getByLabel('Expiry date');
        this.saveButton = page.getByRole('button', { name: 'Save Discount' });
        this.alert = page.getByRole('alert');
    }

    async goto() {
        await this.page.goto('/discounts/add');
        await expect(this.heading).toBeVisible();
    }

    fieldError(field: DiscountField): Locator {
        return this.page.locator(`#${field}-error`);
    }

    async fill(values: DiscountFormValues) {
        await this.codeInput.fill(values.code);
        await this.typeSelect.selectOption(values.type);
        await this.valueInput.fill(values.value);
        await this.expiryInput.fill(values.expiryDate);
    }

    // Returns the response to the form POST (303 on success, 4xx/5xx on failure).
    async submit(): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(
                (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/discounts/add',
            ),
            this.saveButton.click(),
        ]);
        return response;
    }

    async save(values: DiscountFormValues): Promise<Response> {
        await this.fill(values);
        return this.submit();
    }
}
