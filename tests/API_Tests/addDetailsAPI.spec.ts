import { APIRequestContext, expect, test } from '@playwright/test';
import { Variables } from '../../Variables';

test.use({
    baseURL: 'http://localhost:8000',
});

const DETAILS_PATH = '/register/details';
const SKIP_PATH = '/register/details/skip';

function extractCsrf(html: string): string {
    return html.match(/name="_csrf" value="([^"]+)"/)![1];
}

async function registerSession(request: APIRequestContext): Promise<string> {
    const registerPage = await request.get('/register');
    const csrf = extractCsrf(await registerPage.text());
    await request.post('/register', {
        form: {
            _csrf: csrf,
            email: `details${Date.now()}${Math.floor(Math.random() * 100000)}@test.com`,
            password: Variables.validPassword,
        },
        maxRedirects: 0,
    });
    const detailsPage = await request.get(DETAILS_PATH);
    return extractCsrf(await detailsPage.text());
}

async function postDetails(request: APIRequestContext, fields: Record<string, string>) {
    const csrf = await registerSession(request);
    return request.post(DETAILS_PATH, {
        form: { _csrf: csrf, ...fields },
        maxRedirects: 0,
    });
}

test('Add details page redirects to login when not signed in', async ({ request }) => {
    const response = await request.get(DETAILS_PATH, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toContain('/login');
});

test('Add details page redirects to login with an invalid access token', async ({ request }) => {
    const response = await request.get(DETAILS_PATH, {
        headers: { Cookie: `access_token=${Variables.fakeToken}` },
        maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toContain('/login');
});

test('Registering redirects to the add details page', async ({ request }) => {
    const registerPage = await request.get('/register');
    const csrf = extractCsrf(await registerPage.text());
    const response = await request.post('/register', {
        form: {
            _csrf: csrf,
            email: `details${Date.now()}@test.com`,
            password: Variables.validPassword,
        },
        maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe(DETAILS_PATH);
});

test('Add details page loads after registering', async ({ request }) => {
    await registerSession(request);
    const response = await request.get(DETAILS_PATH);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    const body = await response.text();
    expect(body).toContain('Add your details');
    expect(body).toContain('All details below are optional.');
});

test('Add details page contains all the form fields and buttons', async ({ request }) => {
    await registerSession(request);
    const body = await (await request.get(DETAILS_PATH)).text();
    for (const field of ['firstname', 'surname', 'addressLine1', 'addressLine2', 'postcode', 'securityQuestionID', 'securityAnswer']) {
        expect(body).toContain(`name="${field}"`);
    }
    expect(body).toContain('Save and continue');
    expect(body).toContain('Skip for now');
});

test('Add details page lists the security questions', async ({ request }) => {
    await registerSession(request);
    const body = await (await request.get(DETAILS_PATH)).text();
    expect(body).toContain('Select a question (optional)');
    expect(body).toContain('What is your favourite colour?');
});

test('Add details page is not cached', async ({ request }) => {
    await registerSession(request);
    const response = await request.get(DETAILS_PATH);
    expect(response.headers()['cache-control']).toContain('no-store');
});

test('Save all details successfully', async ({ request }) => {
    const response = await postDetails(request, {
        firstname: 'John',
        surname: 'Smith',
        addressLine1: '1 Test Street',
        addressLine2: 'Testville',
        postcode: 'BT1 1AA',
        securityQuestionID: '1',
        securityAnswer: 'Rover',
    });
    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe('/home');
});

test('Save with no details successfully', async ({ request }) => {
    const response = await postDetails(request, {});
    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe('/home');
});

test('Save with only a name successfully', async ({ request }) => {
    const response = await postDetails(request, { firstname: 'John', surname: 'Smith' });
    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe('/home');
});

test('Save with a security question but no answer successfully', async ({ request }) => {
    const response = await postDetails(request, { securityQuestionID: '1' });
    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe('/home');
});

test('Skip for now goes to the home page', async ({ request }) => {
    const csrf = await registerSession(request);
    const response = await request.post(SKIP_PATH, {
        form: { _csrf: csrf },
        maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe('/home');
});

test('Add details page redirects to home once details are saved', async ({ request }) => {
    await postDetails(request, { firstname: 'John' });
    const response = await request.get(DETAILS_PATH, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toBe('/home');
});

test('Add details page redirects to home once skipped', async ({ request }) => {
    const csrf = await registerSession(request);
    await request.post(SKIP_PATH, { form: { _csrf: csrf }, maxRedirects: 0 });
    const response = await request.get(DETAILS_PATH, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()['location']).toBe('/home');
});

test('Save fails with a first name over 100 characters', async ({ request }) => {
    const response = await postDetails(request, { firstname: 'a'.repeat(101) });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('First name must be 100 characters or fewer.');
});

test('Save fails with a surname over 100 characters', async ({ request }) => {
    const response = await postDetails(request, { surname: 'a'.repeat(101) });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('Surname must be 100 characters or fewer.');
});

test('Save fails with address line 1 over 255 characters', async ({ request }) => {
    const response = await postDetails(request, { addressLine1: 'a'.repeat(256) });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('Address line 1 must be 255 characters or fewer.');
});

test('Save fails with address line 2 over 255 characters', async ({ request }) => {
    const response = await postDetails(request, { addressLine2: 'a'.repeat(256) });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('Address line 2 must be 255 characters or fewer.');
});

test('Save fails with a postcode over 20 characters', async ({ request }) => {
    const response = await postDetails(request, { postcode: 'a'.repeat(21) });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('Postcode must be 20 characters or fewer.');
});

test('Save fails with a security answer but no question', async ({ request }) => {
    const response = await postDetails(request, { securityAnswer: 'Rover' });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('Select a security question when providing an answer.');
});

test('Save fails with a security answer over 1024 characters', async ({ request }) => {
    const response = await postDetails(request, { securityQuestionID: '1', securityAnswer: 'a'.repeat(1025) });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('Security answer must be 1024 characters or fewer.');
});

test('Failed save keeps the values entered', async ({ request }) => {
    const response = await postDetails(request, { firstname: 'John', surname: 'a'.repeat(101) });
    expect(response.status()).toBe(400);
    const body = await response.text();
    expect(body).toContain('Check the details below and try again.');
    expect(body).toContain('value="John"');
});

test('Save without a CSRF token is rejected', async ({ request }) => {
    await registerSession(request);
    const response = await request.post(DETAILS_PATH, {
        form: { firstname: 'John' },
        maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
});

test('Save with an invalid CSRF token is rejected', async ({ request }) => {
    await registerSession(request);
    const response = await request.post(DETAILS_PATH, {
        form: { _csrf: 'invalid', firstname: 'John' },
        maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
});

test('Skip without a CSRF token is rejected', async ({ request }) => {
    await registerSession(request);
    const response = await request.post(SKIP_PATH, { form: {}, maxRedirects: 0 });
    expect(response.status()).toBe(403);
});
