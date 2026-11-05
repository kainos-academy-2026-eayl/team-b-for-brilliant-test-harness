import type { Page } from '@playwright/test';
import type { Account } from '../helpers/config';

export class LoginPage {
    constructor(private readonly page: Page) { }

    async signIn(account: Account) {
        await this.page.goto('/login');
        await this.page.getByLabel('Email').fill(account.email);
        await this.page.getByLabel('Password').fill(account.password);
        await this.page.getByRole('button', { name: 'Sign in' }).click();
        await this.page.waitForURL((url) => !url.pathname.startsWith('/login'));
    }
}
