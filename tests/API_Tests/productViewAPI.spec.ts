import { APIRequestContext, expect, test } from '@playwright/test';
import { Variables } from '../../Variables';

test.use({
    baseURL: 'http://localhost:8000',
});

const BACKEND_URL = 'http://localhost:3000';
const PRODUCT_ID = 'product-1';
const PRODUCT_PATH = `/products/${PRODUCT_ID}`;
const BASKET_PATH = '/basket';

type CustomerSession = {
    email: string;
    token: string;
};

async function createCustomer(request: APIRequestContext): Promise<CustomerSession> {
    const email = `productview${Date.now()}${Math.floor(Math.random() * 100000)}@test.com`;
    const response = await request.post(`${BACKEND_URL}/api/v1/auth/register`, {
        data: { email, password: Variables.validPassword },
    });
    expect(response.status()).toBe(202);

    const body = await response.json();
    expect(body.accessToken).toEqual(expect.any(String));
    return { email, token: body.accessToken };
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
}

function accessCookie(token: string) {
    return { Cookie: `access_token=${token}` };
}

async function getProductPage(request: APIRequestContext, token?: string, productID = PRODUCT_ID) {
    const path = `/products/${productID}`;
    return request.get(path, token ? { headers: accessCookie(token) } : {});
}

async function getCsrfToken(html: string): Promise<string> {
    const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    if (!token) throw new Error('CSRF token not found in product page');
    return token;
}

async function getFrontendCookies(request: APIRequestContext, token: string) {
    const browserState = (await request.storageState()).cookies.find(
        (cookie) => cookie.name === 'browser_state',
    );
    if (!browserState) throw new Error('Browser state cookie not found after loading product page');

    return `access_token=${token}; browser_state=${encodeURIComponent(browserState.value)}`;
}

test.describe('Product detail page API @productView @api', () => {
    test('GET product 1 shows current details and an add-to-basket form', async ({ request }) => {
        const backendResponse = await request.get(`${BACKEND_URL}/products/${PRODUCT_ID}`);
        expect(backendResponse.status()).toBe(200);
        const { product } = await backendResponse.json();

        const response = await getProductPage(request);
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('text/html');
        expect(response.headers()['cache-control']).toBe('no-store');

        const html = await response.text();
        expect(html).toContain(`<h1>${product.name}</h1>`);
        expect(html).toContain('class="stock stock--in">In stock</span>');
        expect(html).toMatch(/class="product__price">£\d+\.\d{2}<\/p>/);
        expect(html).toContain(`name="productID" value="${PRODUCT_ID}"`);
        expect(html).toContain('method="post" action="/basket/items"');
        expect(html).toContain('id="product-quantity" name="quantity"');
        expect(html).toContain('<button type="submit" class="button">Add to basket</button>');
        expect(html).toContain('href="/products">Back to products</a>');

        if (product.description) expect(html).toContain(product.description);
        for (const image of product.productImages) {
            expect(html).toContain(`src="${image.imageUrl}"`);
        }
    });

    test('GET product 1 is accessible without signing in', async ({ request }) => {
        const response = await getProductPage(request);
        expect(response.status()).toBe(200);
        expect(await response.text()).toContain('<h1>Hyaluronic Acid Serum</h1>');
    });

    test('POST product form adds the selected quantity to the signed-in customer basket', async ({ request }) => {
        const user = await createCustomer(request);
        const productPage = await getProductPage(request, user.token);
        expect(productPage.status()).toBe(200);
        const csrf = await getCsrfToken(await productPage.text());
        const cookie = await getFrontendCookies(request, user.token);

        const addResponse = await request.post(BASKET_PATH + '/items', {
            headers: { Cookie: cookie },
            form: {
                _csrf: csrf,
                productID: PRODUCT_ID,
                quantity: '2',
            },
            maxRedirects: 0,
        });
        expect(addResponse.status()).toBe(302);
        expect(addResponse.headers()['location']).toBe(BASKET_PATH);

        const basketResponse = await request.get(`${BACKEND_URL}${BASKET_PATH}`, {
            headers: authHeaders(user.token),
        });
        expect(basketResponse.status()).toBe(200);
        const basket = await basketResponse.json();
        expect(basket.items).toEqual(expect.arrayContaining([
            expect.objectContaining({
                productID: PRODUCT_ID,
                productName: 'Hyaluronic Acid Serum',
                quantityInBasket: 2,
            }),
        ]));
    });

    test('POST product form rejects a quantity below one and shows an error', async ({ request }) => {
        const user = await createCustomer(request);
        const productPage = await getProductPage(request, user.token);
        const csrf = await getCsrfToken(await productPage.text());
        const cookie = await getFrontendCookies(request, user.token);

        const response = await request.post(BASKET_PATH + '/items', {
            headers: { Cookie: cookie },
            form: {
                _csrf: csrf,
                productID: PRODUCT_ID,
                quantity: '0',
            },
            maxRedirects: 0,
        });
        expect(response.status()).toBe(400);
        expect(await response.text()).toContain('Enter a quantity of 1 or more.');

        const basketResponse = await request.get(`${BACKEND_URL}${BASKET_PATH}`, {
            headers: authHeaders(user.token),
        });
        expect((await basketResponse.json()).items).toEqual([]);
    });

    test('POST product form rejects a request without a CSRF token', async ({ request }) => {
        const user = await createCustomer(request);
        const productPage = await getProductPage(request, user.token);
        expect(productPage.status()).toBe(200);
        const cookie = await getFrontendCookies(request, user.token);

        const response = await request.post(BASKET_PATH + '/items', {
            headers: { Cookie: cookie },
            form: {
                productID: PRODUCT_ID,
                quantity: '1',
            },
            maxRedirects: 0,
        });
        expect(response.status()).toBe(403);
    });

    test('GET unknown product detail returns not found', async ({ request }) => {
        const response = await getProductPage(request, undefined, 'nonexistent-product');
        expect(response.status()).toBe(404);
    });
});