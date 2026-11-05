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
    await expect(addDetailsPage.securityQuestionSelect.locator('option').first())
        .toHaveText('Select a question (optional)');
    const questionOptions = addDetailsPage.securityQuestionSelect.locator('option:not([value=""])');
    expect(await questionOptions.count()).toBeGreaterThan(0);
    await expect(questionOptions.first()).not.toBeEmpty();
    await expect(addDetailsPage.securityQuestionSelect).toBeEnabled();
    await expect(addDetailsPage.securityQuestionHint)
        .toHaveText('Choose a question only if you want to provide an answer.');
    await expect(addDetailsPage.securityAnswerHint)
        .toHaveText('Leave blank to save neither the question nor an answer. After an error, re-enter your answer.');
});

test('security answer is masked', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await expect(addDetailsPage.securityAnswerInput).toHaveAttribute('type', 'password');
    await expect(addDetailsPage.securityAnswerInput).toHaveAttribute('autocomplete', 'off');
});

test('form fields match the registration details markup', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await expect(addDetailsPage.detailsForm).toHaveCount(1);
    await expect(addDetailsPage.firstNameInput).toHaveAttribute('autocomplete', 'given-name');
    await expect(addDetailsPage.surnameInput).toHaveAttribute('autocomplete', 'family-name');
    await expect(addDetailsPage.addressLine1Input).toHaveAttribute('autocomplete', 'address-line1');
    await expect(addDetailsPage.addressLine2Input).toHaveAttribute('autocomplete', 'address-line2');
    await expect(addDetailsPage.postcodeInput).toHaveAttribute('autocomplete', 'postal-code');
    await expect(addDetailsPage.firstNameInput).toHaveAttribute('maxlength', '100');
    await expect(addDetailsPage.surnameInput).toHaveAttribute('maxlength', '100');
    await expect(addDetailsPage.addressLine1Input).toHaveAttribute('maxlength', '255');
    await expect(addDetailsPage.addressLine2Input).toHaveAttribute('maxlength', '255');
    await expect(addDetailsPage.postcodeInput).toHaveAttribute('maxlength', '20');
    await expect(addDetailsPage.securityAnswerInput).toHaveAttribute('maxlength', '1024');
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
    });
    await addDetailsPage.securityQuestionSelect.selectOption({ index: 1 });
    await addDetailsPage.securityAnswerInput.fill('Blue');
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

test('first name input enforces the configured maximum length', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.firstNameInput.pressSequentially('a'.repeat(101));
    await expect(addDetailsPage.firstNameInput).toHaveValue('a'.repeat(100));
    await expect(addDetailsPage.firstNameError).toBeEmpty();
});

test('unsuccessful save - security answer without a question', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.fillDetails({ securityAnswer: 'Blue' });
    await addDetailsPage.save();
    await expect(addDetailsPage.securityQuestionError).toHaveText('Select a security question when providing an answer.');
});

test('failed save keeps the values entered', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.fillDetails({ firstName: 'John', securityAnswer: 'Blue' });
    await addDetailsPage.save();
    await expect(addDetailsPage.serverError).toHaveText('Check the details below and try again.');
    await expect(addDetailsPage.firstNameInput).toHaveValue('John');
    await expect(addDetailsPage.securityAnswerInput).toHaveValue('');
});

test('invalid fields are marked as invalid', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.fillDetails({ securityAnswer: 'Blue' });
    await addDetailsPage.save();
    await expect(addDetailsPage.securityQuestionSelect).toHaveAttribute('aria-invalid', 'true');
    await expect(addDetailsPage.securityAnswerInput).not.toHaveAttribute('aria-invalid', 'true');
});

test('can correct an error and save', async ({ page }) => {
    const addDetailsPage = new AddDetailsPage(page);
    await addDetailsPage.fillDetails({ securityAnswer: 'Blue' });
    await addDetailsPage.save();
    await expect(addDetailsPage.securityQuestionError)
        .toHaveText('Select a security question when providing an answer.');
    await addDetailsPage.securityQuestionSelect.selectOption({ index: 1 });
    await addDetailsPage.securityAnswerInput.fill('Blue');
    await addDetailsPage.save();
    await expect(page).toHaveURL('/home');
});
