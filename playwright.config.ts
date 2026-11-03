import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: process.env.TEST_URL ?? 'http://localhost:8000',
    trace: 'retain-on-failure',
  },
});
