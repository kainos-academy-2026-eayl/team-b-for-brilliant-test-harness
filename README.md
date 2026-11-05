# David Was Here, or was he?
# Hi David!

## Test Harness 3-4

A small Playwright starter repo for writing tests against a website.

## Setup

```sh
npm install
npx playwright install chromium
```

Start the application at `http://localhost:8000`, then run the tests. Playwright uses this address by default; it does not start the application:

```sh
npm test
```

To test a different site, override the default with `TEST_URL`:

```sh
TEST_URL=http://localhost:9000 npm test
```

Add tests in `tests/`. Playwright's built-in `page` fixture is available in every test, so a typical test starts with `await page.goto(...)` and then adds locators and assertions.

The API login tests override `baseURL` to `http://localhost:3000`. Start the backend on port `3000` before running them. This applies to both direct requests and the login fixture; UI tests continue to use the configured frontend address.

## Discount activation tests (`tests/discount-activation.spec.ts`)

Covers deactivating and reactivating discounts by changing their expiry date (a discount is active while its expiry date is after today, UTC). Start the backend and frontend as above. These tests don't need an admin account: they use `ADMIN_EMAIL`/`ADMIN_PASSWORD` if set, otherwise the seeded test customer (`CUSTOMER_EMAIL`/`CUSTOMER_PASSWORD`), because the discount endpoints no longer check for the admin role. Test discounts are created directly through the backend API.

Keep credentials and personal data out of the repository.
