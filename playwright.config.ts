import { defineConfig } from '@playwright/test';

export default defineConfig({

  use: {
    baseURL: process.env.TEST_URL ?? 'http://localhost:8000',
  },
  testDir: './tests',
  // The checkout tests all use the one seeded customer's basket, so they cannot run side by side.
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.TEST_URL ?? 'http://localhost:8000',
    trace: 'retain-on-failure',
  },
});
