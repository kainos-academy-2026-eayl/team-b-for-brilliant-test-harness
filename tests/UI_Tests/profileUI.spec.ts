import { expect, Page, test } from '@playwright/test';
import { ProfilePage } from '../../Pages/ProfilePage';
import { Variables } from '../../Variables';

const BACKEND_URL = 'http://localhost:3000';
const FRONTEND_URL = process.env.TEST_URL ?? 'http://localhost:8000';

type CustomerSession = {
    email: string;
    token: string;
};

async function createCustomer(page: Page): Promise<CustomerSession> {
    const email = `profile${Date.now()}${Math.floor(Math.random() * 100000)}@test.com`;
    const response = await page.request.post(`${BACKEND_URL}/api/v1/auth/register`, {
        data: { email, password: Variables.validPassword },
    });
    expect(response.status()).toBe(202);

    const body = await response.json();
    expect(body.accessToken).toEqual(expect.any(String));
    const session = { email, token: body.accessToken as string };

    await page.context().addCookies([{
        name: 'access_token',
        value: session.token,
        url: FRONTEND_URL,
    }]);
    return session;
}

async function setProfile(page: Page, token: string, profile = {
    firstname: 'Jamie',
    surname: 'Taylor',
    addressLine1: '12 Test Street',
    addressLine2: 'Flat 2',
    postcode: 'BT7 1NT',
}) {
    const response = await page.request.put(`${BACKEND_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        data: profile,
    });
    expect(response.status()).toBe(200);
}

test.describe('Profile page @account @ui', () => {
    test('redirects signed-out visitors to sign in', async ({ page }) => {
        await page.context().clearCookies();
        await page.goto('/account');
        await expect(page).toHaveURL(/\/login\?returnTo=%2Faccount$/);
    });

    test('renders the profile form with current details and account sections', async ({ page }) => {
        const session = await createCustomer(page);
        await setProfile(page, session.token);

        const profilePage = new ProfilePage(page);
        await profilePage.goto();

        await expect(profilePage.heading).toHaveText('Hello Jamie!');
        await expect(profilePage.profilePicture).toBeVisible();
        await expect(profilePage.firstNameInput).toHaveValue('Jamie');
        await expect(profilePage.surnameInput).toHaveValue('Taylor');
        await expect(profilePage.emailInput).toHaveValue(session.email);
        await expect(profilePage.emailInput).toHaveAttribute('readonly', '');
        await expect(profilePage.addressLine1Input).toHaveValue('12 Test Street');
        await expect(profilePage.addressLine2Input).toHaveValue('Flat 2');
        await expect(profilePage.postcodeInput).toHaveValue('BT7 1NT');
        await expect(profilePage.saveButton).toBeVisible();
        await expect(profilePage.basketSection).toBeVisible();
        await expect(profilePage.ordersSection).toBeVisible();
    });

    test('saves profile changes and retains them after refresh', async ({ page }) => {
        const session = await createCustomer(page);
        await setProfile(page, session.token);

        const profilePage = new ProfilePage(page);
        await profilePage.goto();
        await profilePage.updateDetails({
            firstName: 'Morgan',
            surname: 'Lee',
            addressLine1: '8 Sample Road',
            postcode: 'sw1a1aa',
        });
        await profilePage.saveDetails();

        await expect(page).toHaveURL(/\/account\?saved=1$/);
        await expect(profilePage.saveSuccess).toHaveText('Your details have been saved.');
        await expect(profilePage.firstNameInput).toHaveValue('Morgan');
        await expect(profilePage.surnameInput).toHaveValue('Lee');
        await expect(profilePage.addressLine1Input).toHaveValue('8 Sample Road');
        await expect(profilePage.postcodeInput).toHaveValue('SW1A 1AA');

        await page.reload();
        await expect(profilePage.firstNameInput).toHaveValue('Morgan');
        await expect(profilePage.surnameInput).toHaveValue('Lee');
        await expect(profilePage.addressLine1Input).toHaveValue('8 Sample Road');
        await expect(profilePage.postcodeInput).toHaveValue('SW1A 1AA');
    });

    test('allows address line 2 to be cleared', async ({ page }) => {
        const session = await createCustomer(page);
        await setProfile(page, session.token);

        const profilePage = new ProfilePage(page);
        await profilePage.goto();
        await profilePage.updateDetails({ addressLine2: '' });
        await profilePage.saveDetails();

        await expect(profilePage.saveSuccess).toHaveText('Your details have been saved.');
        await page.reload();
        await expect(profilePage.addressLine2Input).toHaveValue('');
    });

    test('shows errors for missing required details and keeps entered values', async ({ page }) => {
        const session = await createCustomer(page);
        await setProfile(page, session.token);

        const profilePage = new ProfilePage(page);
        await profilePage.goto();
        await profilePage.updateDetails({
            firstName: '',
            surname: '',
            addressLine1: '',
            postcode: '',
        });
        await profilePage.saveDetails();

        await expect(profilePage.saveError).toHaveText(
            'We could not save your details. Please check the highlighted fields.',
        );
        await expect(profilePage.firstNameError).toHaveText('Enter your first name (up to 50 characters)');
        await expect(profilePage.surnameError).toHaveText('Enter your surname (up to 50 characters)');
        await expect(profilePage.addressLine1Error).toHaveText(
            'Enter the first line of your address (up to 100 characters)',
        );
        await expect(profilePage.postcodeError).toHaveText('Enter a valid UK postcode, like BT7 1NT');
        await expect(profilePage.firstNameInput).toHaveAttribute('aria-invalid', 'true');
        await expect(profilePage.addressLine2Input).not.toHaveAttribute('aria-invalid', 'true');
    });

    test('shows a postcode validation error without losing other entered values', async ({ page }) => {
        const session = await createCustomer(page);
        await setProfile(page, session.token);

        const profilePage = new ProfilePage(page);
        await profilePage.goto();
        await profilePage.updateDetails({
            firstName: 'Morgan',
            postcode: '12345',
        });
        await profilePage.saveDetails();

        await expect(profilePage.postcodeError).toHaveText('Enter a valid UK postcode, like BT7 1NT');
        await expect(profilePage.firstNameInput).toHaveValue('Morgan');
        await expect(profilePage.postcodeInput).toHaveValue('12345');
    });

    test('shows the empty basket state for a new customer', async ({ page }) => {
        await createCustomer(page);
        const profilePage = new ProfilePage(page);
        await profilePage.goto();

        await expect(profilePage.basketEmptyState).toBeVisible();
        await expect(profilePage.viewBasketLink).toBeVisible();
    });

    test('shows basket items added for the signed-in customer', async ({ page }) => {
        const session = await createCustomer(page);
        const productsResponse = await page.request.get(`${BACKEND_URL}/products`);
        expect(productsResponse.status()).toBe(200);
        const { products } = await productsResponse.json();
        const product = products.find((item: {
            productID: string;
            name: string;
            quantity: number;
            visible: boolean;
            draft: boolean;
            deletedAt: string | null;
        }) => item.visible && !item.draft && item.deletedAt === null && item.quantity >= 2);
        expect(product, 'expected a visible product with at least two in stock').toBeTruthy();

        const addResponse = await page.request.post(`${BACKEND_URL}/basket/items`, {
            headers: { Authorization: `Bearer ${session.token}` },
            data: { productID: product.productID, quantity: 2 },
        });
        expect(addResponse.status()).toBe(201);

        const profilePage = new ProfilePage(page);
        await profilePage.goto();
        await expect(profilePage.basketItems).toContainText(`${product.name}, quantity 2`);
        await expect(profilePage.basketEmptyState).toHaveCount(0);
    });

    test('shows an orders empty, populated, or friendly error state', async ({ page }) => {
        await createCustomer(page);
        const profilePage = new ProfilePage(page);
        await profilePage.goto();

        const hasEmptyState = await profilePage.ordersEmptyState.isVisible();
        const hasErrorState = await profilePage.ordersError.isVisible();
        const hasOrders = (await profilePage.orders.count()) > 0;
        expect(hasEmptyState || hasErrorState || hasOrders).toBe(true);

        if (hasErrorState) {
            await expect(profilePage.ordersError).toHaveText(
                'We could not load your orders right now. Please try again later.',
            );
        }
    });
});