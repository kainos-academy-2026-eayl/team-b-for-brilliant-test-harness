import { Locator, Page } from '@playwright/test';

export class LoginPage {
    readonly email: Locator;
    readonly password: Locator;
    readonly loginButton: Locator;
    readonly message: Locator;

    async open(): Promise<void> {
        await this.page.goto('/');
    }

    constructor(private readonly page: Page) {
        this.email = page.getByLabel('email');
        this.password = page.getByLabel('Password');
        this.loginButton = page.getByRole('button', { name: 'Sign in' });
        this.message = page.getByRole('alert');
    }
    async goto() { await this.page.goto('/login'); }
    async loginAs(name: string, password: string) {
        await this.email.fill(name);
        await this.password.fill(password);
        await this.loginButton.click();
    }
}