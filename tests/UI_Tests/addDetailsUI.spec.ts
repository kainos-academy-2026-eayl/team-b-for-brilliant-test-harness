import { test, expect, Page } from '@playwright/test';
import { AddDetailsPage } from '../../Pages/AddDetailsPage';
import { RegisterPage } from '../../Pages/RegisterPage';
import { Variables } from '../../Variables';

async function registerNewUser(page: Page) {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.registerAs(
        `details${Date.now()}${Math.floor(Math.random() * 100000)}@test.com`,
        Variables.validPassword,
        Variables.validPassword,
    );
    await expect(page).toHaveURL('/register/details');
}

test.beforeEach(async ({ page }) => {
    await registerNewUser(page);
});

test('add details page loads', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await expect(addDetailsPage.heading).toBeVisible();
    await expect(addDetailsPage.subtitle).toContainText('All details below are optional.');
});

test('add details page shows all fields and buttons', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await expect(addDetailsPage.firstNameInput).toBeVisible();
    await expect(addDetailsPage.surnameInput).toBeVisible();
    await expect(addDetailsPage.addressLine1Input).toBeVisible();
    await expect(addDetailsPage.addressLine2Input).toBeVisible();
    await expect(addDetailsPage.postcodeInput).toBeVisible();
    await expect(addDetailsPage.securityQuestionSelect).toBeVisible();
    await expect(addDetailsPage.securityAnswerInput).toBeVisible();
    await expect(addDetailsPage.saveButton).toBeVisible();
    await expect(addDetailsPage.skipButton).toBeVisible();
});

test('fields start empty', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await expect(addDetailsPage.firstNameInput).toHaveValue('');
    await expect(addDetailsPage.surnameInput).toHaveValue('');
    await expect(addDetailsPage.addressLine1Input).toHaveValue('');
    await expect(addDetailsPage.addressLine2Input).toHaveValue('');
    await expect(addDetailsPage.postcodeInput).toHaveValue('');
    await expect(addDetailsPage.securityQuestionSelect).toHaveValue('');
    await expect(addDetailsPage.securityAnswerInput).toHaveValue('');
});

test('security question dropdown lists the questions', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await expect(addDetailsPage.securityQuestionSelect.locator('option')).toHaveText([
        'Select a question (optional)',
        'What is your favourite colour?',
        'What is your pet\'s name?',
    ]);
});

test('security answer is masked', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await expect(addDetailsPage.securityAnswerInput).toHaveAttribute('type', 'password');
});

test('no errors are shown on load', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await expect(addDetailsPage.serverError).toHaveCount(0);
    await expect(addDetailsPage.firstNameError).toBeEmpty();
    await expect(addDetailsPage.postcodeError).toBeEmpty();
});

test('save all details', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.fillDetails({
        firstName: 'John',
        surname: 'Smith',
        addressLine1: '1 Test Street',
        addressLine2: 'Testville',
        postcode: 'BT1 1AA',
        securityQuestion: 'What is your favourite colour?',
        securityAnswer: 'Blue',
    });
    await addDetailsPage.save();
    await expect(page).toHaveURL('/home');
});

test('save with no details', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.save();
    await expect(page).toHaveURL('/home');
});

test('save with only a name', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.fillDetails({ firstName: 'John', surname: 'Smith' });
    await addDetailsPage.save();
    await expect(page).toHaveURL('/home');
});

test('skip for now', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.skip();
    await expect(page).toHaveURL('/home');
});

test('details page is not available again after skipping', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.skip();
    await expect(page).toHaveURL('/home');
    await addDetailsPage.goto();
    await expect(page).toHaveURL('/home');
});

test('unsuccessful save - first name too long', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.removeMaxLengths();
    await addDetailsPage.fillDetails({ firstName: 'a'.repeat(101) });
    await addDetailsPage.save();
    await expect(addDetailsPage.serverError).toHaveText('Check the details below and try again.');
    await expect(addDetailsPage.firstNameError).toHaveText('First name must be 100 characters or fewer.');
});

test('unsuccessful save - surname too long', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.removeMaxLengths();
    await addDetailsPage.fillDetails({ surname: 'a'.repeat(101) });
    await addDetailsPage.save();
    await expect(addDetailsPage.surnameError).toHaveText('Surname must be 100 characters or fewer.');
});

test('unsuccessful save - address line 1 too long', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.removeMaxLengths();
    await addDetailsPage.fillDetails({ addressLine1: 'a'.repeat(256) });
    await addDetailsPage.save();
    await expect(addDetailsPage.addressLine1Error).toHaveText('Address line 1 must be 255 characters or fewer.');
});

test('unsuccessful save - address line 2 too long', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.removeMaxLengths();
    await addDetailsPage.fillDetails({ addressLine2: 'a'.repeat(256) });
    await addDetailsPage.save();
    await expect(addDetailsPage.addressLine2Error).toHaveText('Address line 2 must be 255 characters or fewer.');
});

test('unsuccessful save - postcode too long', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.removeMaxLengths();
    await addDetailsPage.fillDetails({ postcode: 'a'.repeat(21) });
    await addDetailsPage.save();
    await expect(addDetailsPage.postcodeError).toHaveText('Postcode must be 20 characters or fewer.');
});

test('unsuccessful save - security answer without a question', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.fillDetails({ securityAnswer: 'Blue' });
    await addDetailsPage.save();
    await expect(addDetailsPage.securityQuestionError).toHaveText('Select a security question when providing an answer.');
});

test('failed save keeps the values entered', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.removeMaxLengths();
    await addDetailsPage.fillDetails({ firstName: 'John', surname: 'a'.repeat(101), postcode: 'BT1 1AA' });
    await addDetailsPage.save();
    await expect(addDetailsPage.firstNameInput).toHaveValue('John');
    await expect(addDetailsPage.postcodeInput).toHaveValue('BT1 1AA');
});

test('invalid fields are marked as invalid', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.removeMaxLengths();
    await addDetailsPage.fillDetails({ firstName: 'a'.repeat(101) });
    await addDetailsPage.save();
    await expect(addDetailsPage.firstNameInput).toHaveAttribute('aria-invalid', 'true');
    await expect(addDetailsPage.surnameInput).not.toHaveAttribute('aria-invalid', 'true');
});

test('can correct an error and save', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.removeMaxLengths();
    await addDetailsPage.fillDetails({ firstName: 'a'.repeat(101) });
    await addDetailsPage.save();
    await expect(addDetailsPage.firstNameError).toBeVisible();
    await addDetailsPage.fillDetails({ firstName: 'John' });
    await addDetailsPage.save();
    await expect(page).toHaveURL('/home');
});
