import { APIRequestContext, expect, test } from '@playwright/test';
import { Variables } from '../../Variables';

test.use({
    baseURL: 'http://localhost:3000',
});

const REGISTER_PATH = '/api/v1/auth/register';
const PROFILE_PATH = '/profile';
const ORDERS_PATH = '/orders';
const BASKET_PATH = '/basket';
const FRONTEND_URL = 'http://localhost:8000';

type UserSession = {
    email: string;
    token: string;
};

type ProfileUpdate = {
    firstname?: string;
    surname?: string;
    addressLine1?: string;
    addressLine2?: string | null;
    postcode?: string;
    email?: string;
};

async function createUserSession(request: APIRequestContext): Promise<UserSession> {
    const email = `profile${Date.now()}${Math.floor(Math.random() * 100000)}@test.com`;
    const response = await request.post(REGISTER_PATH, {
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

function profileCookie(token: string) {
    return { Cookie: `access_token=${token}` };
}

async function accountCookie(request: APIRequestContext, token: string) {
    const browserState = (await request.storageState()).cookies.find(
        (cookie) => cookie.name === 'browser_state',
    );
    if (!browserState) throw new Error('Browser state cookie not found after loading account page');
    return {
        Cookie: `access_token=${token}; browser_state=${encodeURIComponent(browserState.value)}`,
    };
}

function extractCsrf(html: string): string {
    const token = html.match(/name="_csrf" value="([^"]+)"/)?.[1];
    if (!token) throw new Error('CSRF token not found in account page');
    return token;
}

function validProfile(overrides: ProfileUpdate = {}) {
    return {
        firstname: 'Jamie',
        surname: 'Taylor',
        addressLine1: '12 Test Street',
        addressLine2: 'Flat 2',
        postcode: 'BT7 1NT',
        ...overrides,
    };
}

async function updateProfile(
    request: APIRequestContext,
    token: string,
    profile: Record<string, unknown>,
) {
    return request.put(PROFILE_PATH, {
        headers: authHeaders(token),
        data: profile,
    });
}

async function expectProfileValidationError(
    request: APIRequestContext,
    profile: Record<string, unknown>,
    field: string,
) {
    const { token } = await createUserSession(request);
    const response = await updateProfile(request, token, profile);
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid profile');
    expect(body.details.fieldErrors[field]).toEqual(expect.arrayContaining([expect.any(String)]));
}

test('GET profile rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get(PROFILE_PATH);
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Login required' });
});

test('GET profile rejects an invalid bearer token', async ({ request }) => {
    const response = await request.get(PROFILE_PATH, {
        headers: authHeaders(Variables.fakeToken),
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Login required' });
});

test('GET profile returns the authenticated customer profile', async ({ request }) => {
    const user = await createUserSession(request);
    const response = await request.get(PROFILE_PATH, {
        headers: authHeaders(user.token),
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    const profile = await response.json();
    expect(profile).toMatchObject({
        email: user.email,
    });
    for (const field of ['firstname', 'surname', 'addressLine1', 'addressLine2', 'postcode']) {
        expect(profile[field] === null || typeof profile[field] === 'string').toBe(true);
    }
    expect(Object.keys(profile).sort()).toEqual([
        'addressLine1',
        'addressLine2',
        'email',
        'firstname',
        'postcode',
        'surname',
    ]);
});

test('PUT profile rejects unauthenticated requests', async ({ request }) => {
    const response = await request.put(PROFILE_PATH, { data: validProfile() });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Login required' });
});

test('PUT profile rejects an invalid bearer token', async ({ request }) => {
    const response = await request.put(PROFILE_PATH, {
        headers: authHeaders(Variables.fakeToken),
        data: validProfile(),
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Login required' });
});

test('PUT profile updates all editable fields and returns normalized values', async ({ request }) => {
    const user = await createUserSession(request);
    const response = await updateProfile(request, user.token, validProfile({
        firstname: '  Jamie  ',
        surname: '  Taylor  ',
        addressLine1: '  12 Test Street  ',
        addressLine2: '  Flat 2  ',
        postcode: 'bt71nt',
    }));
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
        email: user.email,
        firstname: 'Jamie',
        surname: 'Taylor',
        addressLine1: '12 Test Street',
        addressLine2: 'Flat 2',
        postcode: 'BT7 1NT',
    });
});

test('PUT profile persists updated fields for a subsequent GET', async ({ request }) => {
    const user = await createUserSession(request);
    const updated = validProfile({ firstname: 'Casey', postcode: 'sw1a1aa' });
    const saveResponse = await updateProfile(request, user.token, updated);
    expect(saveResponse.status()).toBe(200);

    const readResponse = await request.get(PROFILE_PATH, {
        headers: authHeaders(user.token),
    });
    expect(readResponse.status()).toBe(200);
    expect(await readResponse.json()).toEqual({
        email: user.email,
        firstname: 'Casey',
        surname: 'Taylor',
        addressLine1: '12 Test Street',
        addressLine2: 'Flat 2',
        postcode: 'SW1A 1AA',
    });
});

test('PUT profile accepts an omitted optional address line 2 and clears it', async ({ request }) => {
    const user = await createUserSession(request);
    const response = await updateProfile(request, user.token, {
        firstname: 'Jamie',
        surname: 'Taylor',
        addressLine1: '12 Test Street',
        postcode: 'BT7 1NT',
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).addressLine2).toBeNull();
});

test('PUT profile accepts an empty optional address line 2 and clears it', async ({ request }) => {
    const user = await createUserSession(request);
    const response = await updateProfile(request, user.token, validProfile({ addressLine2: '' }));
    expect(response.status()).toBe(200);
    expect((await response.json()).addressLine2).toBeNull();
});

test('PUT profile normalizes UK postcodes with missing and repeated spaces', async ({ request }) => {
    const user = await createUserSession(request);
    const response = await updateProfile(request, user.token, validProfile({ postcode: 'BT7  1NT' }));
    expect(response.status()).toBe(200);
    expect((await response.json()).postcode).toBe('BT7 1NT');
});

test('PUT profile does not allow the email address to be changed', async ({ request }) => {
    const user = await createUserSession(request);
    const response = await updateProfile(request, user.token, validProfile({
        email: 'changed@example.com',
    }));
    expect(response.status()).toBe(200);
    expect((await response.json()).email).toBe(user.email);
});

test('PUT profile changes are isolated to the authenticated customer', async ({ request }) => {
    const firstUser = await createUserSession(request);
    const secondUser = await createUserSession(request);
    const updateResponse = await updateProfile(
        request,
        firstUser.token,
        validProfile({ firstname: 'First customer' }),
    );
    expect(updateResponse.status()).toBe(200);

    const secondProfileResponse = await request.get(PROFILE_PATH, {
        headers: authHeaders(secondUser.token),
    });
    expect(secondProfileResponse.status()).toBe(200);
    expect(await secondProfileResponse.json()).toMatchObject({
        email: secondUser.email,
        firstname: null,
        surname: null,
        addressLine1: null,
        addressLine2: null,
        postcode: null,
    });
});

test('PUT profile rejects a missing first name', async ({ request }) => {
    const profile = validProfile();
    delete (profile as Partial<typeof profile>).firstname;
    await expectProfileValidationError(request, profile, 'firstname');
});

test('PUT profile rejects a blank first name', async ({ request }) => {
    await expectProfileValidationError(request, validProfile({ firstname: '   ' }), 'firstname');
});

test('PUT profile rejects a first name longer than 50 characters', async ({ request }) => {
    await expectProfileValidationError(request, validProfile({ firstname: 'a'.repeat(51) }), 'firstname');
});

test('PUT profile rejects a missing surname', async ({ request }) => {
    const profile = validProfile();
    delete (profile as Partial<typeof profile>).surname;
    await expectProfileValidationError(request, profile, 'surname');
});

test('PUT profile rejects a blank surname', async ({ request }) => {
    await expectProfileValidationError(request, validProfile({ surname: '   ' }), 'surname');
});

test('PUT profile rejects a surname longer than 50 characters', async ({ request }) => {
    await expectProfileValidationError(request, validProfile({ surname: 'a'.repeat(51) }), 'surname');
});

test('PUT profile rejects a missing address line 1', async ({ request }) => {
    const profile = validProfile();
    delete (profile as Partial<typeof profile>).addressLine1;
    await expectProfileValidationError(request, profile, 'addressLine1');
});

test('PUT profile rejects a blank address line 1', async ({ request }) => {
    await expectProfileValidationError(request, validProfile({ addressLine1: '   ' }), 'addressLine1');
});

test('PUT profile rejects address line 1 longer than 100 characters', async ({ request }) => {
    await expectProfileValidationError(request, validProfile({ addressLine1: 'a'.repeat(101) }), 'addressLine1');
});

test('PUT profile rejects address line 2 longer than 100 characters', async ({ request }) => {
    await expectProfileValidationError(request, validProfile({ addressLine2: 'a'.repeat(101) }), 'addressLine2');
});

test('PUT profile rejects a missing postcode', async ({ request }) => {
    const profile = validProfile();
    delete (profile as Partial<typeof profile>).postcode;
    await expectProfileValidationError(request, profile, 'postcode');
});

test('PUT profile rejects a blank postcode', async ({ request }) => {
    await expectProfileValidationError(request, validProfile({ postcode: '' }), 'postcode');
});

test('PUT profile rejects a numeric postcode', async ({ request }) => {
    await expectProfileValidationError(request, validProfile({ postcode: '12345' }), 'postcode');
});

test('PUT profile rejects an unsupported postcode format', async ({ request }) => {
    await expectProfileValidationError(request, validProfile({ postcode: 'ABC XYZ' }), 'postcode');
});

test('GET orders returns a list with order and item metadata for a new customer', async ({ request }) => {
    const user = await createUserSession(request);
    const response = await request.get(ORDERS_PATH, {
        headers: authHeaders(user.token),
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    const body = await response.json();
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders).toEqual([]);
    for (const order of body.orders) {
        expect(order).toEqual(expect.objectContaining({
            orderID: expect.any(String),
            placedAt: expect.any(String),
            items: expect.any(Array),
            subtotal: expect.any(String),
            discount: expect.any(String),
            delivery: expect.any(String),
            total: expect.any(String),
        }));
        expect(Number.isNaN(Date.parse(order.placedAt))).toBe(false);
        for (const item of order.items) {
            expect(item).toEqual(expect.objectContaining({
                productID: expect.any(String),
                productName: expect.any(String),
                quantity: expect.any(Number),
                unitPrice: expect.any(String),
                lineTotal: expect.any(String),
            }));
        }
    }
});

test('GET orders rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get(ORDERS_PATH);
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Login required' });
});

test('GET orders rejects an invalid bearer token', async ({ request }) => {
    const response = await request.get(ORDERS_PATH, {
        headers: authHeaders(Variables.fakeToken),
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Login required' });
});

test('GET basket returns an empty basket for a new customer', async ({ request }) => {
    const user = await createUserSession(request);
    const response = await request.get(BASKET_PATH, {
        headers: authHeaders(user.token),
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ items: [], notices: [] });
});

test('GET basket rejects unauthenticated requests', async ({ request }) => {
    const response = await request.get(BASKET_PATH);
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Login required' });
});

test('GET basket rejects an invalid bearer token', async ({ request }) => {
    const response = await request.get(BASKET_PATH, {
        headers: authHeaders(Variables.fakeToken),
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Login required' });
});

test('GET basket returns item quantity and pricing after an item is added', async ({ request }) => {
    const user = await createUserSession(request);
    const productsResponse = await request.get('/products');
    expect(productsResponse.status()).toBe(200);
    const { products } = await productsResponse.json();
    const product = products.find((item: {
        productID: string;
        quantity: number;
        visible: boolean;
        draft: boolean;
        deletedAt: string | null;
    }) => item.visible && !item.draft && item.deletedAt === null && item.quantity >= 2);
    expect(product, 'expected at least one visible product with stock').toBeTruthy();

    const headers = authHeaders(user.token);
    const addResponse = await request.post(`${BASKET_PATH}/items`, {
        headers,
        data: { productID: product.productID, quantity: 2 },
    });
    expect(addResponse.status()).toBe(201);

    const response = await request.get(BASKET_PATH, { headers });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.notices).toEqual([]);
    expect(body.items[0]).toMatchObject({
        productID: product.productID,
        productName: product.name,
        quantityInBasket: 2,
        stockAvailable: expect.any(Number),
        isQuantityAvailable: true,
        lowStock: expect.any(Boolean),
    });
    if (body.items[0].unitPrice !== null) {
        expect(body.items[0].unitPrice).toMatch(/^\d+\.\d{2}$/);
        expect(body.items[0].lineTotal).toBe((Number(body.items[0].unitPrice) * 2).toFixed(2));
    } else {
        expect(body.items[0].lineTotal).toBeNull();
    }
});

test('GET profile on the frontend redirects visitors to sign in', async ({ request }) => {
    const response = await request.get(`${FRONTEND_URL}/account`, {
        maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toBe('/login?returnTo=%2Faccount');
});

test('GET profile on the frontend renders profile, basket and orders when signed in', async ({ request }) => {
    const user = await createUserSession(request);
    const seededProfile = validProfile({
        firstname: 'Jamie',
        surname: 'Taylor',
        addressLine1: '12 Test Street',
        addressLine2: 'Flat 2',
        postcode: 'BT7 1NT',
    });
    const updateResponse = await updateProfile(request, user.token, seededProfile);
    expect(updateResponse.status()).toBe(200);

    const response = await request.get(`${FRONTEND_URL}/account`, {
        headers: profileCookie(user.token),
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(response.headers()['cache-control']).toBe('no-store');
    const html = await response.text();
    expect(html).toContain('Your basket');
    expect(html).toContain('Your orders');
    expect(html).toContain('Your basket is empty.');
    expect(
        html.includes('You have not placed any orders yet.')
        || html.includes('We could not load your orders right now. Please try again later.')
        || html.includes('class="order"'),
    ).toBe(true);
    expect(html).toContain(`value="${user.email}" readonly`);
    expect(html).toContain('id="firstname" name="firstname" type="text" autocomplete="given-name" value="Jamie"');
    expect(html).toContain('id="surname" name="surname" type="text" autocomplete="family-name" value="Taylor"');
    expect(html).toContain('id="addressLine1" name="addressLine1" type="text" autocomplete="address-line1" value="12 Test Street"');
    expect(html).toContain('id="addressLine2" name="addressLine2" type="text" autocomplete="address-line2" value="Flat 2"');
    expect(html).toContain('id="postcode" name="postcode" type="text" autocomplete="postal-code" value="BT7 1NT"');
});

test('POST account form saves profile details and shows confirmation', async ({ request }) => {
    const user = await createUserSession(request);
    const accountPage = await request.get(`${FRONTEND_URL}/account`, {
        headers: profileCookie(user.token),
    });
    expect(accountPage.status()).toBe(200);
    const csrf = extractCsrf(await accountPage.text());
    const cookie = await accountCookie(request, user.token);

    const response = await request.post(`${FRONTEND_URL}/account`, {
        headers: cookie,
        form: {
            _csrf: csrf,
            firstname: 'Morgan',
            surname: 'Lee',
            addressLine1: '8 Sample Road',
            addressLine2: '',
            postcode: 'sw1a1aa',
        },
        maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toBe('/account?saved=1');

    const refreshedPage = await request.get(`${FRONTEND_URL}/account?saved=1`, { headers: cookie });
    expect(refreshedPage.status()).toBe(200);
    expect(await refreshedPage.text()).toContain('Your details have been saved.');

    const savedProfile = await request.get(PROFILE_PATH, {
        headers: authHeaders(user.token),
    });
    expect(await savedProfile.json()).toMatchObject({
        firstname: 'Morgan',
        surname: 'Lee',
        addressLine1: '8 Sample Road',
        addressLine2: null,
        postcode: 'SW1A 1AA',
    });
});

test('POST account form shows field errors and keeps values after backend validation fails', async ({ request }) => {
    const user = await createUserSession(request);
    const accountPage = await request.get(`${FRONTEND_URL}/account`, {
        headers: profileCookie(user.token),
    });
    const csrf = extractCsrf(await accountPage.text());
    const cookie = await accountCookie(request, user.token);

    const response = await request.post(`${FRONTEND_URL}/account`, {
        headers: cookie,
        form: {
            _csrf: csrf,
            firstname: 'Morgan',
            surname: 'Lee',
            addressLine1: '8 Sample Road',
            addressLine2: '',
            postcode: '12345',
        },
        maxRedirects: 0,
    });
    expect(response.status()).toBe(400);
    const html = await response.text();
    expect(html).toContain('Enter a valid UK postcode, like BT7 1NT');
    expect(html).toContain('value="12345"');
    expect(html).toContain('We could not save your details. Please check the highlighted fields.');
});

test('POST account form rejects requests without a CSRF token', async ({ request }) => {
    const user = await createUserSession(request);
    await request.get(`${FRONTEND_URL}/account`, {
        headers: profileCookie(user.token),
    });
    const response = await request.post(`${FRONTEND_URL}/account`, {
        headers: await accountCookie(request, user.token),
        form: {
            firstname: 'Jamie',
            surname: 'Taylor',
            addressLine1: '12 Test Street',
            addressLine2: '',
            postcode: 'BT1 5GS',
        },
        maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
});
