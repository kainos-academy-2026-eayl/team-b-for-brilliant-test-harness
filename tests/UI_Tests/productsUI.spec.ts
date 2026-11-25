import { test, expect, Page } from '@playwright/test';
import { ProductsPage } from '../../Pages/ProductsPage';
import { Variables } from '../../Variables';

const BACKEND_URL = 'http://localhost:3000';

type Product = {
    productID: string;
    name: string;
    visible: boolean;
    draft: boolean;
    deletedAt: string | null;
    categories: { categoryID: string }[];
};

async function getVisibleProducts(page: Page): Promise<Product[]> {
    const response = await page.request.get(`${BACKEND_URL}/products`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    return body.products.filter((product: Product) =>
        product.visible && !product.draft && product.deletedAt === null
    );
}

async function signIn(page: Page) {
    const response = await page.request.post(`${BACKEND_URL}/api/v1/auth/register`, {
        data: {
            email: `products${Date.now()}${Math.floor(Math.random() * 100000)}@test.com`,
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

test('products page loads', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await expect(page).toHaveURL(/\/products$/);
    await expect(productsPage.heading).toBeVisible();
});

test('products page shows both search forms', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await expect(productsPage.nameSearchInput).toBeVisible();
    await expect(productsPage.nameSearchButton).toBeVisible();
    await expect(productsPage.categorySelect).toBeVisible();
    await expect(productsPage.categoryFilterButton).toBeVisible();
});

test('products page lists the visible products', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const expectedProducts = await getVisibleProducts(page);
    await productsPage.goto();
    await expect(productsPage.productItems).toHaveCount(expectedProducts.length);
    expect((await productsPage.productLinks.allTextContents()).sort())
        .toEqual(expectedProducts.map((product) => product.name).sort());
});

test('products page does not list the hidden product', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await expect(productsPage.productLinks.filter({ hasText: 'Limited Edition Eyeshadow Palette' })).toHaveCount(0);
});

test('each product shows a name, price and stock label', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const expectedProducts = await getVisibleProducts(page);
    await productsPage.goto();
    await expect(productsPage.productPrices).toHaveCount(expectedProducts.length);
    await expect(productsPage.stockLabels).toHaveCount(expectedProducts.length);
    expect((await productsPage.productLinks.allTextContents()).sort())
        .toEqual(expectedProducts.map((product) => product.name).sort());
});

test('product images are shown', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await expect(productsPage.productImages).toHaveCount(9);
    for (const image of await productsPage.productImages.all()) {
        await image.scrollIntoViewIfNeeded();
        expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }
});

test('category dropdown lists all categories', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await expect(productsPage.categorySelect.getByRole('option')).toHaveText([
        'All categories',
        'Looksmaxxing',
        'Makeup',
        'Skincare',
    ]);
});

test('search products by name', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await productsPage.searchByName('serum');
    await expect(page).toHaveURL(/\/products\?q=serum$/);
    await expect(productsPage.productItems).toHaveCount(1);
    await expect(productsPage.productLinks).toHaveText('Hyaluronic Acid Serum');
});

test('search keeps the search term in the box', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await productsPage.searchByName('serum');
    await expect(productsPage.nameSearchInput).toHaveValue('serum');
});

test('search ignores letter case', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await productsPage.searchByName('SERUM');
    await expect(productsPage.productLinks).toHaveText('Hyaluronic Acid Serum');
});

test('search with no matches shows the empty message', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await productsPage.searchByName('zzzzqq');
    await expect(productsPage.productItems).toHaveCount(0);
    await expect(productsPage.emptyState).toHaveText(
        'No products match your search. Try another product name or clear your search.'
    );
});

test('clearing the search shows all products again', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const expectedProducts = await getVisibleProducts(page);
    await productsPage.goto();
    await productsPage.searchByName('serum');
    await productsPage.searchByName('');
    await expect(productsPage.productItems).toHaveCount(expectedProducts.length);
});

test('filter products by category', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const expectedProducts = (await getVisibleProducts(page))
        .filter((product) => product.categories.some((category) => category.categoryID === 'category-makeup'))
        .map((product) => product.name)
        .sort();
    await productsPage.goto();
    await productsPage.filterByCategory('Makeup');
    await expect(page).toHaveURL(/\/products\?category=category-makeup$/);
    await expect(productsPage.categorySelect).toHaveValue('category-makeup');
    expect((await productsPage.productLinks.allTextContents()).sort()).toEqual(expectedProducts);
});

test('clicking a product opens its product page', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await productsPage.openProduct('Hyaluronic Acid Serum');
    await expect(page).toHaveURL(/\/products\/product-1$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hyaluronic Acid Serum');
});

test('back to products link returns to the products page', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await productsPage.openProduct('Hyaluronic Acid Serum');
    await page.getByRole('link', { name: 'Back to products' }).click();
    await expect(page).toHaveURL(/\/products$/);
});

test('unknown product shows a not found page', async ({ page }) => {
    const response = await page.goto('/products/does-not-exist');
    expect(response?.status()).toBe(404);
});
