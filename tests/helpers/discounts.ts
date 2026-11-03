import { expect, type Page, request } from '@playwright/test';
import { Client } from 'pg';

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// Defaults match the test-only customer created by the backend seed script.
export const CUSTOMER = {
    email: process.env.CUSTOMER_EMAIL ?? 'customer@gmail.com',
    password: process.env.CUSTOMER_PASSWORD ?? 'password',
};

// An account whose role is "admin"; see README for how to create one.
export const ADMIN =
    process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD
        ? { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }
        : undefined;

// The discount endpoints no longer check for the admin role, so tests that only
// manage discounts fall back to the customer account when no admin is configured.
export const DISCOUNT_ACCOUNT = ADMIN ?? CUSTOMER;

export interface DiscountInput {
    code: string;
    type: 'percentage' | 'amount' | '';
    value: string;
    expiryDate: string;
}

// UTC, because both the frontend and backend compare against the UTC date.
export function isoDate(offsetDays = 0): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

export function displayDate(iso: string): string {
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
}

export function uniqueCode(prefix = 'E2E'): string {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

export async function login(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

export async function openAddDiscountPage(page: Page) {
    await page.goto('/discounts/add');
    await expect(page.getByRole('heading', { name: 'Add Discount' })).toBeVisible();
}

export async function fillDiscountForm(page: Page, input: DiscountInput) {
    await page.getByLabel('Discount code').fill(input.code);
    await page.getByLabel('Discount type').selectOption(input.type);
    await page.getByLabel('Value').fill(input.value);
    await page.getByLabel('Expiry date').fill(input.expiryDate);
}

// Returns the response to the form POST (303 on success, 4xx/5xx on failure).
export async function submitDiscountForm(page: Page) {
    const [response] = await Promise.all([
        page.waitForResponse(
            (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/discounts/add',
        ),
        page.getByRole('button', { name: 'Save Discount' }).click(),
    ]);
    return response;
}

export function fieldError(page: Page, field: 'code' | 'type' | 'value' | 'expiryDate') {
    return page.locator(`#${field}-error`);
}

export function discountRow(page: Page, code: string) {
    return page.getByRole('row').filter({ has: page.getByRole('cell', { name: code, exact: true }) });
}

export interface ApiDiscount {
    discountID: string;
    code: string;
    type: string;
    value: string;
    expiryDate: string;
}

// Direct backend access, used for verifying persistence and for cleanup.
export async function withAdminApi<T>(
    fn: (
        call: (method: 'GET' | 'POST' | 'DELETE', path: string, data?: object) => Promise<{ status: number; body: unknown; }>,
    ) => Promise<T>,
): Promise<T> {
    const api = await request.newContext({ baseURL: API_URL });
    try {
        const login = await api.post('/auth/verify', { data: DISCOUNT_ACCOUNT });
        expect(login.ok(), 'login against the backend').toBeTruthy();
        const { accessToken } = (await login.json()) as { accessToken: string; };
        const headers = { Authorization: `Bearer ${accessToken}` };
        return await fn(async (method, path, data) => {
            const response = await api.fetch(path, { method, headers, data });
            const text = await response.text();
            return { status: response.status(), body: text ? JSON.parse(text) : undefined };
        });
    } finally {
        await api.dispose();
    }
}

export async function findDiscountByCode(code: string): Promise<ApiDiscount | undefined> {
    return withAdminApi(async (call) => {
        const { body } = await call('GET', '/discounts');
        return (body as { discounts: ApiDiscount[]; }).discounts.find((d) => d.code === code);
    });
}

// Sets a discount up directly through the backend so UI tests start from a known state.
export async function createDiscountViaApi(input: {
    code: string;
    type?: 'PERCENTAGE' | 'AMOUNT_OFF';
    value?: string;
    expiryDate: string;
}): Promise<ApiDiscount> {
    return withAdminApi(async (call) => {
        const { status, body } = await call('POST', '/discounts', { type: 'PERCENTAGE', value: '20', ...input });
        expect(status, `creating discount ${input.code}`).toBe(201);
        return body as ApiDiscount;
    });
}

// Backend discount endpoint calls that the tests assert on directly.
export async function callDiscountApi(method: 'POST', path: string, data?: object) {
    return withAdminApi((call) => call(method, path, data ?? {}));
}

export function activateLink(page: Page, code: string) {
    return discountRow(page, code).getByRole('link', { name: `Activate discount ${code}` });
}

export function deactivateButton(page: Page, code: string) {
    return discountRow(page, code).getByRole('button', { name: `Deactivate discount ${code}` });
}

export async function openActivatePage(page: Page, discountID: string) {
    await page.goto(`/discounts/${discountID}/activate`);
    await expect(page.getByRole('heading', { name: 'Activate Discount' })).toBeVisible();
}

// Returns the response to the activate form POST (303 on success, 4xx/5xx on failure).
export async function submitActivateForm(page: Page, expiryDate: string) {
    await page.getByLabel('New expiry date').fill(expiryDate);
    const [response] = await Promise.all([
        page.waitForResponse((r) => r.request().method() === 'POST' && /\/discounts\/[^/]+\/activate$/.test(new URL(r.url()).pathname)),
        page.getByRole('button', { name: 'Activate Discount' }).click(),
    ]);
    return response;
}

// The backend has no delete endpoint, so test data is removed straight from the local database.
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/app_dev';

export async function deleteDiscountsByCode(codes: string[]) {
    if (codes.length === 0) return;
    const client = new Client({ connectionString: DATABASE_URL });
    try {
        await client.connect();
        await client.query('DELETE FROM "Discounts" WHERE code = ANY($1::text[])', [codes]);
    } catch (error) {
        console.warn(`Could not delete test discounts (${codes.length}): ${(error as Error).message}`);
    } finally {
        await client.end().catch(() => undefined);
    }
}
