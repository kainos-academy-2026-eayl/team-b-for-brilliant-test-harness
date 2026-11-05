import { expect } from '@playwright/test';
import { Variables } from '../../variables';
import { test } from '../../fixture';

test.use({
    baseURL: 'http://localhost:3000',
});

const REGISTER_PATH = '/api/v1/auth/register';

test('Register new user', async ({ request }) => {
    const response = await request.post(REGISTER_PATH, {
        data: {
            email: Variables.uniqueEmail,
            password: Variables.validPassword,
        }
    });
    expect(response.status()).toBe(202);
    const body = await response.json();
    expect(body.message).toBe("Registration request processed");
});

test('Try to register with a taken email address', async ({ request }) => {
    const response = await request.post(REGISTER_PATH, {
        data: {
            email: Variables.takenEmail,
            password: Variables.validPassword
        }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.message).toBe("Invalid details");
});

test('Reject registration with missing email and password', async ({ request }) => {
    const response = await request.post(REGISTER_PATH, {
        data: {}
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid details");
    expect(body.details.fieldErrors.email).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(body.details.fieldErrors.password).toEqual(expect.arrayContaining([expect.any(String)]));
});

test('Reject registration with missing email', async ({ request }) => {
    const response = await request.post(REGISTER_PATH, {
        data: {
            password: Variables.validPassword
        }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid details");
    expect(body.details.fieldErrors.email).toEqual(expect.arrayContaining([expect.any(String)]));
});

test('Reject registration with missing password', async ({ request }) => {
    const response = await request.post(REGISTER_PATH, {
        data: {
            email: Variables.uniqueEmail
        }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid details");
    expect(body.details.fieldErrors.password).toEqual(expect.arrayContaining([expect.any(String)]));
});

test('Reject registration with malformed email', async ({ request }) => {
    const response = await request.post(REGISTER_PATH, {
        data: {
            email: Variables.shortEmail,
            password: Variables.validPassword
        }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid details");
    expect(body.details.fieldErrors.email).toEqual(expect.arrayContaining([expect.any(String)]));
});

test('Reject registration with numeric email', async ({ request }) => {
    const response = await request.post(REGISTER_PATH, {
        data: {
            email: 123,
            password: Variables.validPassword
        }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid details");
    expect(body.details.fieldErrors.email).toEqual(expect.arrayContaining([expect.any(String)]));
});

test('Reject registration with numeric password', async ({ request }) => {
    const response = await request.post(REGISTER_PATH, {
        data: {
            email: Variables.uniqueEmail,
            password: 123
        }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid details");
    expect(body.details.fieldErrors.password).toEqual(expect.arrayContaining([expect.any(String)]));
});

test('Reject registration with null credentials', async ({ request }) => {
    const response = await request.post(REGISTER_PATH, {
        data: {
            email: null,
            password: null
        }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid details");
    expect(body.details.fieldErrors.email).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(body.details.fieldErrors.password).toEqual(expect.arrayContaining([expect.any(String)]));
});

test('Reject registration with unsupported confirmPassword field', async ({ request }) => {
    const response = await request.post(REGISTER_PATH, {
        data: {
            email: Variables.uniqueEmail,
            password: Variables.validPassword,
            confirmPassword: Variables.validPassword
        }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid details");
    expect(body.details.formErrors).toContain('Unrecognized key: "confirmPassword"');
});