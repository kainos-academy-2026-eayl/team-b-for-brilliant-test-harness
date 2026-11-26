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

## Frontend CI gate

The frontend sends a `frontend-push` repository dispatch containing its commit
SHA and a unique `client_payload.request_id`. The CI workflow uses that ID as
its run name so the frontend can wait for the exact run and block its Build
stage until this workflow completes successfully. Keep this workflow on the
default branch: GitHub only receives repository dispatches there.
Dispatches without a request ID retain an event-based run name.

The frontend dispatch token needs **Contents: read and write** and **Actions:
read** on this repository. `TEST_HARNESS_TOKEN` still needs read access to the
frontend/backend and permission to write commit statuses on the triggering
repository.

## Running tests against Docker

CI uses the stock `postgres:17-alpine` image instead of the backend's database
image, which imports a development dump with extra products, categories,
prices and security questions. Each run uses a unique Compose project and
fresh database volume, then runs `prisma db push`, the backend seed and the
harness seed. The historical migration chain assumes pre-existing tables,
so this disposable E2E database uses the current Prisma schema directly;
this workflow does not validate database migrations.
The CI override leaves the normal local development stack unchanged.

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
