import { APIRequestContext, expect, test } from '@playwright/test';
import { Variables } from '../../Variables';

test.use({
    baseURL: 'http://localhost:8000',
});

const BACKEND_URL = 'http://localhost:3000';
const PRODUCTS_PATH = '/products';

type Product = {
    productID: string;
    name: string;
    visible: boolean;
    draft: boolean;
    deletedAt: string | null;
    categories: { categoryID: string }[];
};

async function getAccessToken(request: APIRequestContext): Promise<string> {
    const response = await request.post(`${BACKEND_URL}/api/v1/auth/register`, {
        data: {
            email: `products${Date.now()}${Math.floor(Math.random() * 100000)}@test.com`,
            password: Variables.validPassword,
        }
    });
    const body = await response.json();
    return body.accessToken;
}

async function getProducts(request: APIRequestContext, query = '') {
    const token = await getAccessToken(request);
    return request.get(`${PRODUCTS_PATH}${query}`, {
        headers: { Cookie: `access_token=${token}` },
    });
}

async function getVisibleBackendProducts(request: APIRequestContext): Promise<Product[]> {
    const response = await request.get(`${BACKEND_URL}/products`);
    const body = await response.json();
    return body.products.filter((product: Product) => product.visible && !product.draft && product.deletedAt === null);
}

function productLinks(html: string): string[] {
    return [...html.matchAll(/class="product__link" href="(\/products\/[^"]+)"/g)].map((match) => match[1]);
}

test('Products page loads', async ({ request }) => {
    const response = await getProducts(request);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
});

test('Products page is not cached', async ({ request }) => {
    const response = await getProducts(request);
    expect(response.headers()['cache-control']).toBe('no-store');
});

test('Products page shows the heading and both search forms', async ({ request }) => {
    const response = await getProducts(request);
    const html = await response.text();
    expect(html).toContain('<h1>Products</h1>');
    expect(html).toContain('aria-label="Search products by name"');
    expect(html).toContain('aria-label="Search products by category"');
});

test('Products page lists every visible product', async ({ request }) => {
    const expected = await getVisibleBackendProducts(request);
    const response = await getProducts(request);
    const links = productLinks(await response.text());
    expect(links.sort()).toEqual(expected.map((product) => `/products/${product.productID}`).sort());
});

test('Products page does not list hidden products', async ({ request }) => {
    const backendResponse = await request.get(`${BACKEND_URL}/products`);
    const backendBody = await backendResponse.json();
    const hidden = backendBody.products.filter((product: Product) => !product.visible);
    const response = await getProducts(request);
    const links = productLinks(await response.text());
    for (const product of hidden) {
        expect(links).not.toContain(`/products/${product.productID}`);
    }
});

test('Products page shows a name, price and stock label for each product', async ({ request }) => {
    const response = await getProducts(request);
    const html = await response.text();
    const count = productLinks(html).length;
    expect((html.match(/class="product__price">£\d+\.\d{2}</g) ?? []).length).toBe(count);
    expect((html.match(/class="stock stock--(in|out)"/g) ?? []).length).toBe(count);
});

test('Products page category dropdown lists the categories', async ({ request }) => {
    const response = await getProducts(request);
    const html = await response.text();
    expect(html).toMatch(/<option value="" selected>All categories<\/option>/);
    expect(html).toContain('value="category-skincare"');
    expect(html).toContain('value="category-makeup"');
});

test('Search products by name', async ({ request }) => {
    const response = await getProducts(request, '?q=serum');
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(productLinks(html)).toEqual(['/products/product-1']);
});

test('Search products by name ignores letter case', async ({ request }) => {
    const response = await getProducts(request, '?q=SERUM');
    const html = await response.text();
    expect(productLinks(html)).toEqual(['/products/product-1']);
});

test('Search products by part of a name', async ({ request }) => {
    const response = await getProducts(request, '?q=lip');
    const html = await response.text();
    const links = productLinks(html);
    expect(links).toContain('/products/product-5');
    expect(links).toContain('/products/product-8');
});

test('Search products trims surrounding spaces', async ({ request }) => {
    const response = await getProducts(request, '?q=%20serum%20');
    const html = await response.text();
    expect(productLinks(html)).toEqual(['/products/product-1']);
});

test('Search products with no matches shows the empty message', async ({ request }) => {
    const response = await getProducts(request, '?q=zzzzqq');
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(productLinks(html)).toEqual([]);
    expect(html).toContain('No products match your search');
});

test('Search products with an empty query lists all products', async ({ request }) => {
    const allResponse = await getProducts(request);
    const emptyResponse = await getProducts(request, '?q=');
    expect(productLinks(await emptyResponse.text())).toEqual(productLinks(await allResponse.text()));
});

test('Search products does not reflect script tags', async ({ request }) => {
    const response = await getProducts(request, '?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toContain('<script>alert(1)</script>');
});

test('Filter products by category', async ({ request }) => {
    const expected = (await getVisibleBackendProducts(request))
        .filter((product) => product.categories.some((category) => category.categoryID === 'category-makeup'))
        .map((product) => `/products/${product.productID}`);
    const response = await getProducts(request, '?category=category-makeup');
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(productLinks(html).sort()).toEqual(expected.sort());
});

test('Filter products by name and category together', async ({ request }) => {
    const response = await getProducts(request, '?q=serum&category=category-makeup');
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(productLinks(html)).toEqual([]);
});

test('Search with a repeated q parameter is rejected', async ({ request }) => {
    const response = await getProducts(request, '?q=a&q=b');
    expect(response.status()).toBe(400);
});

test('Filter with a repeated category parameter is rejected', async ({ request }) => {
    const response = await getProducts(request, '?category=a&category=b');
    expect(response.status()).toBe(400);
});

test('Get a single product page', async ({ request }) => {
    const response = await getProducts(request, '/product-1');
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('<h1>Hyaluronic Acid Serum</h1>');
    expect(html).toContain('£37.99');
});

test('Get a product page that does not exist', async ({ request }) => {
    const response = await getProducts(request, '/does-not-exist');
    expect(response.status()).toBe(404);
});

test('Get a hidden product page', async ({ request }) => {
    const response = await getProducts(request, '/product-10');
    expect(response.status()).toBe(404);
});
