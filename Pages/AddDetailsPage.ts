import { Locator, Page } from '@playwright/test';

export class AddDetailsPage {
    readonly heading: Locator;
    readonly subtitle: Locator;
    readonly detailsForm: Locator;
    readonly serverError: Locator;
    readonly retryLink: Locator;
    readonly firstNameInput: Locator;
    readonly surnameInput: Locator;
    readonly addressLine1Input: Locator;
    readonly addressLine2Input: Locator;
    readonly postcodeInput: Locator;
    readonly securityQuestionSelect: Locator;
    readonly securityAnswerInput: Locator;
    readonly saveButton: Locator;
    readonly skipButton: Locator;
    readonly firstNameError: Locator;
    readonly surnameError: Locator;
    readonly addressLine1Error: Locator;
    readonly addressLine2Error: Locator;
    readonly postcodeError: Locator;
    readonly securityQuestionError: Locator;
    readonly securityAnswerError: Locator;
    readonly securityQuestionHint: Locator;
    readonly securityAnswerHint: Locator;

    constructor(private readonly page: Page) {
        this.heading = page.getByRole('heading', { level: 1, name: 'Add your details' });
        this.subtitle = page.locator('.card-subtitle');
        this.detailsForm = page.locator('form[method="post"][action="/register/details"]');
        this.serverError = page.locator('p.alert');
        this.retryLink = page.getByRole('link', { name: 'Try loading the questions again' });
        this.firstNameInput = page.getByLabel('First name');
        this.surnameInput = page.getByLabel('Surname');
        this.addressLine1Input = page.getByLabel('Address line 1');
        this.addressLine2Input = page.getByLabel('Address line 2');
        this.postcodeInput = page.getByLabel('Postcode');
        this.securityQuestionSelect = page.getByLabel('Security question');
        this.securityAnswerInput = page.getByLabel('Security answer');
        this.saveButton = page.getByRole('button', { name: 'Save and continue' });
        this.skipButton = page.getByRole('button', { name: 'Skip for now' });
        this.firstNameError = page.locator('#firstname-error');
        this.surnameError = page.locator('#surname-error');
        this.addressLine1Error = page.locator('#addressLine1-error');
        this.addressLine2Error = page.locator('#addressLine2-error');
        this.postcodeError = page.locator('#postcode-error');
        this.securityQuestionError = page.locator('#securityQuestionID-error');
        this.securityAnswerError = page.locator('#securityAnswer-error');
        this.securityQuestionHint = page.locator('#security-question-hint');
        this.securityAnswerHint = page.locator('#security-answer-hint');
    }

    async goto() {
        await this.page.goto('/register/details');
    }

    async fillDetails(details: {
        firstName?: string;
        surname?: string;
        addressLine1?: string;
        addressLine2?: string;
        postcode?: string;
        securityQuestion?: string;
        securityAnswer?: string;
    }) {
        if (details.firstName !== undefined) await this.firstNameInput.fill(details.firstName);
        if (details.surname !== undefined) await this.surnameInput.fill(details.surname);
        if (details.addressLine1 !== undefined) await this.addressLine1Input.fill(details.addressLine1);
        if (details.addressLine2 !== undefined) await this.addressLine2Input.fill(details.addressLine2);
        if (details.postcode !== undefined) await this.postcodeInput.fill(details.postcode);
        if (details.securityQuestion !== undefined) {
            await this.securityQuestionSelect.selectOption({ label: details.securityQuestion });
        }
        if (details.securityAnswer !== undefined) await this.securityAnswerInput.fill(details.securityAnswer);
    }

    async save() {
        await this.saveButton.click();
    }

    async skip() {
        await this.skipButton.click();
    }
}
