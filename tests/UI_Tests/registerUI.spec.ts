import { test, expect, Locator, Page } from '@playwright/test';
import { RegisterPage } from '../../pages/RegisterPage';
import { Variables } from '../../variables';

test('successful registration', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.registerAs(Variables.uniqueEmail, 'password123', 'password123');
    await expect(page).toHaveURL('/register/details');
});

test('unsuccessful registration - used email', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.registerAs(Variables.takenEmail, 'password123', 'password123');
    await expect(registerPage.message).toHaveText('Email or password is incorrect. Please try again.');
});

test('unsuccessful registration - invalid email', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.registerAs('tetestom', 'password123', 'password123');
    await expect(registerPage.message).toHaveText('Email or password is incorrect. Please try again.');
});

test('unsuccessful registration - empty email', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.registerAs('', 'password123', 'password123');
    await expect(registerPage.message).toHaveText('Email or password is incorrect. Please try again.');
});

test('unsuccessful registration - short password', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.registerAs(Variables.uniqueEmail, '7letter', '7letter');
    await expect(registerPage.message).toHaveText('Email or password is incorrect. Please try again.');
});

test('unsuccessful registration - long password', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.registerAs(Variables.uniqueEmail, 'password12345678901234567890', 'password12345678901234567890');
    await expect(registerPage.message).toHaveText('Email or password is incorrect. Please try again.');
});


//yikes
test('unsuccessful registration - mismatched password', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.registerAs(Variables.uniqueEmail, 'password12', 'password123');
    await expect(registerPage.message).toHaveText('Email or password is incorrect. Please try again.');
});
