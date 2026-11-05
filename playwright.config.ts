import { defineConfig } from '@playwright/test';

export default defineConfig({

  use: {
    baseURL: process.env.TEST_URL ?? 'http://localhost:8000',
    trace: 'retain-on-failure',
  },
  testDir: './tests',
  fullyParallel: true,
});
