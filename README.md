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

## Discount and checkout tests

Start Postgres, the backend (port 3000) and the frontend (port 8000) first. `TEST_URL` defaults to `http://localhost:8000`.

```
tests/
  api/      backend REST tests (discounts.api.spec.ts, checkout-discount.api.spec.ts)
  ui/       browser tests (add-discount, discount-activation, checkout-discount)
  pages/    page objects, one class per page
  helpers/  config, API client and the shared fixtures
```

Run one group with `npx playwright test tests/api` or `npx playwright test tests/ui`.

They cover adding, activating and deactivating discounts, and using a discount code at checkout (quoting, paying, expired and unknown codes). A discount is active while its expiry date is after today, UTC.

The tests need two accounts in the local database: an admin (`customer@gmail.com`) to manage discounts and an ordinary customer (`user@gmail.com`) to check out. Both use the password `password` by default. Override them with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CUSTOMER_EMAIL` and `CUSTOMER_PASSWORD`, and the backend URL with `API_URL` (default `http://localhost:3000`).

Checkout tests share the one customer's basket, so they run one at a time (`workers: 1`) and empty it afterwards. The backend has no delete endpoint, so discounts created by the tests are deleted straight from the database (`DATABASE_URL`, default `postgresql://dev:dev@localhost:5432/app_dev`); if that fails they are expired through the API instead. Placing orders needs the latest backend migrations applied (`npm run prisma:migrate` in the backend).

Keep credentials and personal data out of the repository.
