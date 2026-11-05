import { expect, Page, test } from '@playwright/test';
import { ProductViewPage } from '../../Pages/ProductViewPage';
import { Variables } from '../../Variables';

const BACKEND_URL = 'http://localhost:3000';

async function signIn(page: Page) {
    const response = await page.request.post(`${BACKEND_URL}/api/v1/auth/register`, {
        data: {
            email: `productview${Date.now()}${Math.floor(Math.random() * 100000)}@test.com`,
            password: Variables.validPassword,
        },
    });
    expect(response.status()).toBe(202);

    const body = await response.json();
    expect(body.accessToken).toEqual(expect.any(String));
    await page.context().addCookies([{
        name: 'access_token',
        value: body.accessToken,
        url: process.env.TEST_URL ?? 'http://localhost:8000',
    }]);
}

test.describe('Product detail page @productView @ui', () => {
    test.beforeEach(async ({ page }) => {
        await signIn(page);
    });

    test('product 1 shows its details and purchase controls', async ({ page }) => {
        const productPage = new ProductViewPage(page);
        await productPage.goto();

        await expect(page).toHaveURL(/\/products\/product-1$/);
        await expect(productPage.heading).toHaveText('Hyaluronic Acid Serum');
        await expect(productPage.stockStatus).toHaveText('In stock');
        await expect(productPage.price).toHaveText('£37.99');
        await expect(productPage.mainImage).toBeVisible();
        await expect(productPage.quantitySelect).toBeVisible();
        await expect(productPage.quantitySelect).toHaveValue('1');
        await expect(productPage.addToBasketButton).toBeEnabled();
        await expect(productPage.backToProductsLink).toBeVisible();
    });

    test('quantity selector offers available quantities and allows a selection', async ({ page }) => {
        const productPage = new ProductViewPage(page);
        await productPage.goto();

        const options = await productPage.quantitySelect.locator('option').allTextContents();
        expect(options.length).toBeGreaterThan(1);
        expect(Number(options[options.length - 1])).toBeLessThanOrEqual(10);

        await productPage.selectQuantity(2);
        await expect(productPage.quantitySelect).toHaveValue('2');
    });

    test('adding the selected quantity opens the basket with product 1', async ({ page }) => {
        const productPage = new ProductViewPage(page);
        await productPage.goto();
        await productPage.selectQuantity(2);
        await productPage.addToBasket();

        await expect(page).toHaveURL(/\/basket$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Your Basket' })).toBeVisible();
        await expect(page.getByRole('heading', { level: 2, name: 'Hyaluronic Acid Serum' })).toBeVisible();
        await expect(page.getByLabel('Quantity of Hyaluronic Acid Serum: 2')).toBeVisible();
    });

    test('back to products returns to the product listing', async ({ page }) => {
        const productPage = new ProductViewPage(page);
        await productPage.goto();
        await productPage.backToProducts();

        await expect(page).toHaveURL(/\/products$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
    });

    test('product details are viewable without signing in', async ({ page }) => {
        await page.context().clearCookies();
        const productPage = new ProductViewPage(page);
        await productPage.goto();

        await expect(page).toHaveURL(/\/products\/product-1$/);
        await expect(productPage.heading).toHaveText('Hyaluronic Acid Serum');
        await expect(productPage.price).toHaveText('£37.99');
    });

    test('unknown product shows the not found page', async ({ page }) => {
        const response = await page.goto('/products/does-not-exist');

        expect(response?.status()).toBe(404);
        await expect(page.getByRole('heading', { name: 'Product not found' })).toBeVisible();
    });
});