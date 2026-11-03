# Test Harness 3-4

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

Keep credentials and personal data out of the repository.