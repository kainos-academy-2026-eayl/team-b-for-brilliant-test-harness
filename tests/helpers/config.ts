export const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export interface Account {
    email: string;
    password: string;
}

// Defaults are the example accounts in the local database: an ordinary customer and an admin.
export const CUSTOMER: Account = {
    email: process.env.CUSTOMER_EMAIL ?? 'user@gmail.com',
    password: process.env.CUSTOMER_PASSWORD ?? 'password',
};

export const ADMIN: Account = {
    email: process.env.ADMIN_EMAIL ?? 'customer@gmail.com',
    password: process.env.ADMIN_PASSWORD ?? 'password',
};

// Seeded product with a stable price and plenty of stock.
export const PRODUCT = { productID: 'product-8', name: 'Hydrating Lip Balm' };

export const DELIVERY_CHARGE = '3.99';

export const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

export const APPROVED_CARD = { cardNumber: '4242 4242 4242 4242', expiry: '12/99', cvv: '123' };
export const DECLINED_CARD = { cardNumber: '4000 0000 0000 0002', expiry: '12/99', cvv: '123' };

export const DELIVERY_ADDRESS = {
    firstname: 'Test',
    surname: 'Customer',
    addressLine1: '1 Test Street',
    addressLine2: '',
    postcode: 'BT7 1NT',
};

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

// At most 15 characters, the longest code the add-discount form accepts.
export function uniqueCode(prefix = 'E2E'): string {
    return `${prefix}-${codeOfLength(8)}`;
}

export function codeOfLength(length: number): string {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2)).toUpperCase().slice(-length);
}

export function toPence(amount: string): number {
    return Math.round(Number(amount) * 100);
}

export function toPounds(pence: number): string {
    return (pence / 100).toFixed(2);
}
