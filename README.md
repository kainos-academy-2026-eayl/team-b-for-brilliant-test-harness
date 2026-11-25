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

## Running tests against Docker

The tests call the frontend at port 8000 and the backend API at port 3000. From
the harness directory, start the Docker stack in the sibling backend repository:

```sh
cd ../team-b-for-brilliant-backend
npm run build
docker compose up --build -d
cd ../team-b-for-brilliant-test-harness
npm test
```

`TEST_URL` defaults to `http://localhost:8000`.

Some tests also need data the backend seed doesn't create: the `john@test.com` and `john@test2.com` customers, two security questions and a second image on product 1. CI adds it with `.github/e2e/seed-test-data.sh`. To run it locally once the stack is up:

```sh
COMPOSE_FILES="-f ../team-b-for-brilliant-backend/docker-compose.yml" bash .github/e2e/seed-test-data.sh
```

## Discount tests (`tests/add-discount.spec.ts`)

Covers deactivating and reactivating discounts by changing their expiry date (a discount is active while its expiry date is after today, UTC). Start the backend and frontend as above. These tests don't need an admin account: they use `ADMIN_EMAIL`/`ADMIN_PASSWORD` if set, otherwise the seeded test customer (`CUSTOMER_EMAIL`/`CUSTOMER_PASSWORD`), because the discount endpoints no longer check for the admin role. Test discounts are created directly through the backend API.

Keep credentials and personal data out of the repository.
