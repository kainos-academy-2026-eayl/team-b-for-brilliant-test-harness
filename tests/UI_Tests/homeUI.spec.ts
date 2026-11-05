import { test, expect, Page } from '@playwright/test';
import { HomePage } from '../../Pages/HomePage';
import { Variables } from '../../Variables';

const BACKEND_URL = 'http://localhost:3000';

async function signIn(page: Page) {
    const response = await page.request.post(`${BACKEND_URL}/api/v1/auth/register`, {
        data: {
            email: `home${Date.now()}${Math.floor(Math.random() * 100000)}@test.com`,
            password: Variables.validPassword,
        }
    });
    const body = await response.json();
    await page.context().addCookies([{
        name: 'access_token',
        value: body.accessToken,
        url: 'http://localhost:8000',
    }]);
}

test.beforeEach(async ({ page }) => {
    await signIn(page);
});

test('home page loads for a signed in user', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page).toHaveTitle(/.+/);
});

test('home page shows the hero heading', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await expect(homePage.heading).toContainText('Your everyday.');
    await expect(homePage.heading).toContainText('A little more brilliant.');
});

test('home page shows the featured products heading', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await expect(homePage.featuredProductsHeading).toBeVisible();
});

test('home page shows three featured products', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await expect(homePage.productLinks).toHaveCount(3);
});

test('home page shows the best selling products first', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await expect(homePage.productLinks).toHaveText([
        'Hydrating Lip Balm',
        'Korean Sheet Mask Pack',
        'Full Coverage Foundation',
    ]);
});

test('home page does not show an error or empty state', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await expect(homePage.productList).toBeVisible();
    await expect(homePage.message).toHaveCount(0);
    await expect(homePage.emptyState).toHaveCount(0);
    await expect(homePage.tryAgainLink).toHaveCount(0);
});

test('home page product images are shown', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    const images = homePage.productList.getByRole('img');
    await expect(images).toHaveCount(3);
    for (const image of await images.all()) {
        await image.scrollIntoViewIfNeeded();
        await expect(image).toHaveJSProperty('complete', true);
        expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
});

test('view all products link goes to the products page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.viewAllProducts();
    await expect(page).toHaveURL(/\/products$/);
});

test('clicking a featured product opens its product page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    await homePage.openProduct('Hydrating Lip Balm');
    await expect(page).toHaveURL(/\/products\/product-8$/);
});

test('home page is not reachable when signed out', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fhome$/);
});
