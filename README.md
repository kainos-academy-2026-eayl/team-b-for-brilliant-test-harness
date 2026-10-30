# Test Harness 3-4

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

Keep credentials and personal data out of the repository.