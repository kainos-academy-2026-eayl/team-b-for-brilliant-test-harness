import { APIRequestContext, expect, test } from '@playwright/test';
import { Variables } from '../../Variables';

test.use({
    baseURL: 'http://localhost:8000',
});

const BACKEND_URL = 'http://localhost:3000';
const HOME_PATH = '/home';

type Product = {
    productID: string;
    name: string;
    salesNo: number;
    visible: boolean;
    draft: boolean;
    deletedAt: string | null;
};

async function getAccessToken(request: APIRequestContext): Promise<string> {
    const response = await request.post(`${BACKEND_URL}/api/v1/auth/register`, {
        data: {
            email: `home${Date.now()}${Math.floor(Math.random() * 100000)}@test.com`,
            password: Variables.validPassword,
        }
    });
    const body = await response.json();
    return body.accessToken;
}

async function getHome(request: APIRequestContext) {
    const token = await getAccessToken(request);
    return request.get(HOME_PATH, {
        headers: { Cookie: `access_token=${token}` },
    });
}

async function getExpectedFeaturedProducts(request: APIRequestContext): Promise<Product[]> {
    const response = await request.get(`${BACKEND_URL}/products`);
    const body = await response.json();
    return body.products
        .filter((product: Product) => product.visible && !product.draft && product.deletedAt === null)
        .sort((a: Product, b: Product) => b.salesNo - a.salesNo)
        .slice(0, 3);
}

test('Home page redirects to login when not signed in', async ({ request }) => {
    const response = await request.get(HOME_PATH, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toBe('/login?returnTo=%2Fhome');
});

test('Home page redirects to login with an invalid access token', async ({ request }) => {
    const response = await request.get(HOME_PATH, {
        headers: { Cookie: `access_token=${Variables.fakeToken}` },
        maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toContain('/login');
});

test('Home page loads when signed in', async ({ request }) => {
    const response = await getHome(request);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
});

test('Home page is not cached', async ({ request }) => {
    const response = await getHome(request);
    expect(response.headers()['cache-control']).toBe('no-store');
});

test('Home page shows the hero heading and call to action', async ({ request }) => {
    const response = await getHome(request);
    const html = await response.text();
    expect(html).toContain('id="hero-title"');
    expect(html).toContain('A little more');
    expect(html).toContain('href="/products"');
    expect(html).toContain('View all products');
});

test('Home page shows the main menu links', async ({ request }) => {
    const response = await getHome(request);
    const html = await response.text();
    expect(html).toContain('href="/home"');
    expect(html).toContain('href="/products"');
    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/basket"');
});

test('Home page shows the featured products section', async ({ request }) => {
    const response = await getHome(request);
    const html = await response.text();
    expect(html).toContain('Featured products');
    expect(html).toContain('aria-label="Featured products"');
});

test('Home page shows exactly three featured products', async ({ request }) => {
    const response = await getHome(request);
    const html = await response.text();
    const cards = html.match(/class="product-card"/g) ?? [];
    expect(cards.length).toBe(3);
});

test('Home page features the three best selling products', async ({ request }) => {
    const expected = await getExpectedFeaturedProducts(request);
    const response = await getHome(request);
    const html = await response.text();
    for (const product of expected) {
        expect(html).toContain(`href="/products/${product.productID}"`);
        expect(html).toContain(product.name);
    }
});

test('Home page lists featured products from best selling to least', async ({ request }) => {
    const expected = await getExpectedFeaturedProducts(request);
    const response = await getHome(request);
    const html = await response.text();
    const positions = expected.map((product) => html.indexOf(`href="/products/${product.productID}"`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((position) => position > -1)).toBe(true);
});

test('Home page does not show hidden products', async ({ request }) => {
    const listResponse = await request.get(`${BACKEND_URL}/products`);
    const listBody = await listResponse.json();
    const hidden = listBody.products.filter((product: Product) => !product.visible);
    const response = await getHome(request);
    const html = await response.text();
    for (const product of hidden) {
        expect(html).not.toContain(`href="/products/${product.productID}"`);
    }
});

test('Home page does not show an error message when products load', async ({ request }) => {
    const response = await getHome(request);
    const html = await response.text();
    expect(html).not.toContain('We could not load products right now');
});
