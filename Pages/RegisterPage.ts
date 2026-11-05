import { Locator, Page } from '@playwright/test';

export class RegisterPage {
    readonly email: Locator;
    readonly password: Locator;
    readonly confirmPassword: Locator;
    readonly registerButton: Locator;
    readonly message: Locator;

    async open(): Promise<void> {
        await this.page.goto('/');
    }
    constructor(private readonly page: Page) {
        this.email = page.getByLabel('Email');
        this.password = page.getByLabel('Password').nth(0);
        this.confirmPassword = page.getByLabel('Confirm Password').nth(0);
        this.registerButton = page.getByRole('button', { name: 'Register' });
        this.message = page.getByRole('alert');

    }
    async goto() { await this.page.goto('/register'); }
    async registerAs(email: string, password: string, confirmPassword: string) {
        await this.email.fill(email);
        await this.password.fill(password);
        await this.confirmPassword.fill(confirmPassword);
        await this.registerButton.click();
    }
}