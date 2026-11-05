import { expect, Page, test } from '@playwright/test';
import { ProductViewPage } from '../../Pages/ProductViewPage';
import { Variables } from '../../Variables';

const BACKEND_URL = 'http://localhost:3000';

async function signIn(page: Page): Promise<string> {
    const response = await page.request.post(`${BACKEND_URL}/api/v1/auth/register`, {
        data: {
            email: `productview${Date.now()}${Math.floor(Math.random() * 100000)}@test.com`,
            password: Variables.validPassword,
        },
    });
    expect(response.status()).toBe(202);

    const body = await response.json();
    expect(body.accessToken).toEqual(expect.any(String));
    const token = body.accessToken as string;
    await page.context().addCookies([{
        name: 'access_token',
        value: token,
        url: process.env.TEST_URL ?? 'http://localhost:8000',
    }]);
    return token;
}

test.describe('Product detail page @productView @ui', () => {
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

    test('quantity choices are capped at the lower of stock and ten', async ({ page }) => {
        const backendResponse = await page.request.get(`${BACKEND_URL}/products/product-1`);
        expect(backendResponse.status()).toBe(200);
        const { product } = await backendResponse.json();

        const productPage = new ProductViewPage(page);
        await productPage.goto();

        const optionValues = await productPage.quantitySelect.locator('option').evaluateAll(
            (options) => options.map((option) => Number((option as HTMLOptionElement).value)),
        );
        expect(optionValues[0]).toBe(1);
        expect(optionValues[optionValues.length - 1]).toBe(Math.min(product.quantity, 10));
        expect(optionValues.length).toBe(Math.min(product.quantity, 10));
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

    test('product image thumbnails switch the main image', async ({ page }) => {
        const productPage = new ProductViewPage(page);
        await productPage.goto();
        await expect(productPage.imageThumbnails).toHaveCount(2);

        const secondThumbnail = productPage.imageThumbnails.nth(1);
        const imageSource = await secondThumbnail.getAttribute('data-image-src');
        const imageAlt = await secondThumbnail.getAttribute('data-image-alt');
        if (!imageSource || !imageAlt) throw new Error('Second product image thumbnail is missing metadata');

        await secondThumbnail.click();

        await expect(productPage.mainImage).toHaveAttribute('src', imageSource);
        await expect(productPage.mainImage).toHaveAttribute('alt', imageAlt);
        await expect(secondThumbnail).toHaveAttribute('aria-pressed', 'true');
        await expect(productPage.imageThumbnails.first()).toHaveAttribute('aria-pressed', 'false');
    });

    test('adding the selected quantity opens the basket with product 1', async ({ page }) => {
        await signIn(page);
        const productPage = new ProductViewPage(page);
        await productPage.goto();
        await productPage.selectQuantity(2);
        await productPage.addToBasket();

        await expect(page).toHaveURL(/\/basket$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Your Basket' })).toBeVisible();
        await expect(page.getByRole('heading', { level: 2, name: 'Hyaluronic Acid Serum' })).toBeVisible();
        await expect(page.getByLabel('Quantity of Hyaluronic Acid Serum: 2')).toBeVisible();
    });

    test('adding product 1 again increments its existing basket quantity', async ({ page }) => {
        await signIn(page);

        const productPage = new ProductViewPage(page);
        await productPage.goto();
        await productPage.selectQuantity(1);
        await productPage.addToBasket();
        await expect(page).toHaveURL(/\/basket$/);

        await productPage.goto();
        await productPage.selectQuantity(2);
        await productPage.addToBasket();

        await expect(page).toHaveURL(/\/basket$/);
        await expect(page.getByLabel('Quantity of Hyaluronic Acid Serum: 3')).toBeVisible();
    });

    test('reports insufficient stock if stock is taken after the product page loads', async ({ page }) => {
        const token = await signIn(page);
        const productResponse = await page.request.get(`${BACKEND_URL}/products/product-1`);
        expect(productResponse.status()).toBe(200);
        const { product } = await productResponse.json();
        expect(product.quantity).toBeGreaterThan(1);

        const reserveResponse = await page.request.post(`${BACKEND_URL}/basket/items`, {
            headers: { Authorization: `Bearer ${token}` },
            data: { productID: 'product-1', quantity: product.quantity - 1 },
        });
        expect(reserveResponse.status()).toBe(201);

        const productPage = new ProductViewPage(page);
        await productPage.goto();
        await productPage.selectQuantity(2);
        await productPage.addToBasket();

        await expect(page.getByRole('alert')).toHaveText(
            `Not enough stock. Only ${product.quantity} available.`,
        );
        await expect(page.getByLabel(`Quantity of Hyaluronic Acid Serum: ${product.quantity - 1}`)).toBeVisible();
    });

    test('back to products returns to the product listing', async ({ page }) => {
        const productPage = new ProductViewPage(page);
        await productPage.goto();
        await productPage.backToProducts();

        await expect(page).toHaveURL(/\/products$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
    });

    test('hidden out-of-stock product is not available to customers', async ({ page }) => {
        const response = await page.goto('/products/product-10');

        expect(response?.status()).toBe(404);
        await expect(page.getByRole('heading', { name: 'Product not found' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add to basket' })).toHaveCount(0);
    });

    test('product details are viewable without signing in', async ({ page }) => {
        await page.context().clearCookies();
        const productPage = new ProductViewPage(page);
        await productPage.goto();

        await expect(page).toHaveURL(/\/products\/product-1$/);
        await expect(productPage.heading).toHaveText('Hyaluronic Acid Serum');
        await expect(productPage.price).toHaveText('£37.99');
    });

    test('product page stays usable at mobile, tablet, and desktop viewport widths', async ({ page }) => {
        const productPage = new ProductViewPage(page);
        for (const viewport of [
            { width: 375, height: 812 },
            { width: 768, height: 1024 },
            { width: 1280, height: 800 },
        ]) {
            await page.setViewportSize(viewport);
            await productPage.goto();
            await expect(productPage.heading).toBeVisible();
            await expect(productPage.quantitySelect).toBeVisible();
            await expect(productPage.addToBasketButton).toBeVisible();
            const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
            const contentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
            expect(contentWidth).toBeLessThanOrEqual(pageWidth);
        }
    });

    test('unknown product shows the not found page', async ({ page }) => {
        const response = await page.goto('/products/does-not-exist');

        expect(response?.status()).toBe(404);
        await expect(page.getByRole('heading', { name: 'Product not found' })).toBeVisible();
    });

    test('malformed product identifier returns the not found page', async ({ page }) => {
        const response = await page.goto('/products/not%20a%20valid%20id');

        expect(response?.status()).toBe(404);
        await expect(page.getByRole('heading', { name: 'Product not found' })).toBeVisible();
    });
});