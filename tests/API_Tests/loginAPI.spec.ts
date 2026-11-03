import { expect, request } from '@playwright/test';
import { Variables } from '../../variables';
import { test } from '../../fixture';

test.use({
    baseURL: 'http://localhost:3000',
});

const LOGIN_PATH = '/auth/verify';

test('Login with valid credentials', async ({ request }) => {
    const response = await request.post(LOGIN_PATH, {
        data: {
            email: Variables.accountEmail,
            password: Variables.validPassword
        }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.message).toBe("Login successful");
});

test('Login with incorrect email and password', async ({ request }) => {
    const response = await request.post(LOGIN_PATH, {
        data: {
            email: Variables.fakeEmail,
            password: Variables.fakePassword
        }
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.message).toBe("Customer not found");

});

test('Login with invalid username', async ({ request }) => {
    const response = await request.post(LOGIN_PATH, {
        data: {
            email: Variables.shortEmail,
            password: Variables.validPassword
        }
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.message).toBe("Customer not found");
});

test('Login with invalid password', async ({ request }) => {
    const response = await request.post(LOGIN_PATH, {
        data: {
            email: Variables.accountEmail,
            password: Variables.shortPassword
        }
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.message).toBe("Invalid credentials");
});

test('Login with empty credentials', async ({ request }) => {
    const response = await request.post(LOGIN_PATH, {
        data: {
            email: '',
            password: ''
        }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.message).toBe("email and password are required");
});