import { Client } from 'pg';

// Defaults to the local development database from the backend's .env.example.
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/app_dev';

// The backend has no delete endpoint, so test discounts are removed directly from the database.
export async function deleteDiscountsByCode(codes: string[]) {
    if (codes.length === 0) return;
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
        await client.query('DELETE FROM "Discounts" WHERE code = ANY($1)', [codes]);
    } finally {
        await client.end();
    }
}
