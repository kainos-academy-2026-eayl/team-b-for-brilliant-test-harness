import { Locator, Page } from '@playwright/test';

export class ProfilePage {
    readonly profileSection: Locator;
    readonly heading: Locator;
    readonly profilePicture: Locator;
    readonly profileForm: Locator;
    readonly firstNameInput: Locator;
    readonly surnameInput: Locator;
    readonly emailInput: Locator;
    readonly addressLine1Input: Locator;
    readonly addressLine2Input: Locator;
    readonly postcodeInput: Locator;
    readonly saveButton: Locator;
    readonly saveSuccess: Locator;
    readonly saveError: Locator;
    readonly firstNameError: Locator;
    readonly surnameError: Locator;
    readonly addressLine1Error: Locator;
    readonly addressLine2Error: Locator;
    readonly postcodeError: Locator;
    readonly basketSection: Locator;
    readonly basketItems: Locator;
    readonly basketEmptyState: Locator;
    readonly basketMoreCount: Locator;
    readonly viewBasketLink: Locator;
    readonly ordersSection: Locator;
    readonly orders: Locator;
    readonly ordersEmptyState: Locator;
    readonly ordersError: Locator;

    constructor(private readonly page: Page) {
        this.profileSection = page.locator('section[aria-labelledby="profile-heading"]');
        this.heading = this.profileSection.getByRole('heading', { level: 1 });
        this.profilePicture = this.profileSection.getByRole('img', { name: 'Your profile picture' });
        this.profileForm = this.profileSection.locator('form[method="post"][action="/account"]');
        this.firstNameInput = this.profileForm.getByLabel('First name');
        this.surnameInput = this.profileForm.getByLabel('Surname');
        this.emailInput = this.profileForm.getByLabel('Email');
        this.addressLine1Input = this.profileForm.getByLabel('Address line 1');
        this.addressLine2Input = this.profileForm.getByLabel('Address line 2 (optional)');
        this.postcodeInput = this.profileForm.getByLabel('Postcode');
        this.saveButton = this.profileForm.getByRole('button', { name: 'Save details' });
        this.saveSuccess = this.profileSection.getByRole('status');
        this.saveError = this.profileSection.getByRole('alert');
        this.firstNameError = this.profileSection.locator('#firstname-error');
        this.surnameError = this.profileSection.locator('#surname-error');
        this.addressLine1Error = this.profileSection.locator('#addressLine1-error');
        this.addressLine2Error = this.profileSection.locator('#addressLine2-error');
        this.postcodeError = this.profileSection.locator('#postcode-error');

        this.basketSection = page.locator('section[aria-labelledby="basket-heading"]');
        this.basketItems = this.basketSection.locator('ul > li');
        this.basketEmptyState = this.basketSection.getByText('Your basket is empty.');
        this.basketMoreCount = this.basketSection.locator('p').filter({ hasText: /^and \d+ more$/ });
        this.viewBasketLink = this.basketSection.getByRole('link', { name: 'View full basket' });

        this.ordersSection = page.locator('section[aria-labelledby="orders-heading"]');
        this.orders = this.ordersSection.locator('article.order');
        this.ordersEmptyState = this.ordersSection.getByText('You have not placed any orders yet.');
        this.ordersError = this.ordersSection.getByRole('alert');
    }

    async goto() {
        await this.page.goto('/account');
    }

    async updateDetails(details: {
        firstName?: string;
        surname?: string;
        addressLine1?: string;
        addressLine2?: string;
        postcode?: string;
    }) {
        if (details.firstName !== undefined) await this.firstNameInput.fill(details.firstName);
        if (details.surname !== undefined) await this.surnameInput.fill(details.surname);
        if (details.addressLine1 !== undefined) await this.addressLine1Input.fill(details.addressLine1);
        if (details.addressLine2 !== undefined) await this.addressLine2Input.fill(details.addressLine2);
        if (details.postcode !== undefined) await this.postcodeInput.fill(details.postcode);
    }

    async saveDetails() {
        await this.saveButton.click();
    }

    async openBasket() {
        await this.viewBasketLink.click();
    }

    order(orderId: string): Locator {
        return this.orders.filter({ hasText: orderId });
    }
}