import { test, expect, Locator, Page } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';


test('correct login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAs('john@test.com', 'testPassword');
    await expect(page.getByRole('region', { name: 'Your everyday. A little more' })).toBeVisible();
    await expect(page).toHaveURL('/home');
});

test('incorrect email shows error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAs('kyugsacjleqwbcjlwebgdfjl', 'testPassword');
    await expect(loginPage.message).toHaveText('Email or password is incorrect. Please try again.');
});

test('incorrect password shows error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAs('john@test.com', 'wrongpasswordhgvgfcftcc');
    await expect(loginPage.message).toHaveText('Email or password is incorrect. Please try again.');
});

test('incorrect email and password shows error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAs('qwmweodfweofm@test.com', 'wrongpasswordhgvgfcftcc');
    await expect(loginPage.message).toHaveText('Email or password is incorrect. Please try again.');
});

// for all of these incorrect login tests, the error message is the same: 'Your email or password is incorrect. Please try again.'

test('main header visible', async ({ page }) => {
    await page.goto('');
    const mainTitle = page.getByText('Welcome back Sign in to');
    await expect(mainTitle).toBeVisible();
});

test('enters username in the login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(page).toHaveURL('/login');
    await page.getByRole('textbox', { name: 'Email' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill('testuser');
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue('testuser');
});

test('enters password in the login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(page).toHaveURL('/login');
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await expect(page.getByRole('textbox', { name: 'Password' })).toHaveValue('password123');
});

//  Brittle navigation: getByRole('link', { name: 'Try it out' }).nth(1) depends on link order.
//  Prefer a locator scoped to the relevant section or another distinguishing attribute.

// clicks are redundant

// Consider using page.locator() with a more specific selector to avoid brittle tests.