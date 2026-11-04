# David Was Here, or was he?
# Hi David!

## Test Harness 3-4

A small Playwright starter repo for writing tests against a website.

## Setup

```sh
npm install
npx playwright install chromium
```

Run the example test:

```sh
npm test
```

Set `TEST_URL` to the site you want to test:

```sh
TEST_URL=https://localhost8000 npm test
```

Add tests in `tests/`. Playwright's built-in `page` fixture is available in every test, so a typical test starts with `await page.goto(...)` and then adds locators and assertions.

## Discount tests (`tests/add-discount.spec.ts`)

Start Postgres, the backend (port 3000) and the frontend (port 8000) first. `TEST_URL` defaults to `http://localhost:8000`.

Tests that save a discount need an account with the `admin` role. Create one in the local database (any user whose `roleID` points at a `Role` named `admin`), then pass its credentials:

```sh
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm test
```

Without these, the saving tests are skipped and only the validation and refusal tests run. Optional overrides: `API_URL` (default `http://localhost:3000`), `CUSTOMER_EMAIL` and `CUSTOMER_PASSWORD` (default to the seeded test customer). Discounts created by the tests are deleted afterwards through the backend API.

## Discount activation tests (`tests/discount-activation.spec.ts`)

Covers deactivating and reactivating discounts by changing their expiry date (a discount is active while its expiry date is after today, UTC). Start the backend and frontend as above. These tests don't need an admin account: they use `ADMIN_EMAIL`/`ADMIN_PASSWORD` if set, otherwise the seeded test customer (`CUSTOMER_EMAIL`/`CUSTOMER_PASSWORD`), because the discount endpoints no longer check for the admin role. Test discounts are created directly through the backend API.

Keep credentials and personal data out of the repository.
