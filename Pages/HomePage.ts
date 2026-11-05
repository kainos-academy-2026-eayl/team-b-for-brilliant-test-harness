import { Locator, Page } from '@playwright/test';

export class HomePage {
    readonly heading: Locator;
    readonly viewAllProductsLink: Locator;
    readonly featuredProductsHeading: Locator;
    readonly productList: Locator;
    readonly productLinks: Locator;
    readonly message: Locator;
    readonly emptyState: Locator;
    readonly tryAgainLink: Locator;

    async open(): Promise<void> {
        await this.page.goto('/home');
    }
    constructor(private readonly page: Page) {
        this.heading = page.getByRole('heading', { level: 1 });
        this.viewAllProductsLink = page.getByRole('link', { name: 'View all products' });
        this.featuredProductsHeading = page.getByRole('heading', { name: 'Featured products', exact: true });
        this.productList = page.getByRole('list', { name: 'Featured products', exact: true });
        this.productLinks = this.productList.getByRole('heading', { level: 3 }).getByRole('link');
        this.message = page.getByRole('alert');
        this.emptyState = page.getByRole('status').filter({
            has: page.getByRole('heading', { name: 'No products available', exact: true }),
        });
        this.tryAgainLink = page.getByRole('link', { name: 'Try again', exact: true });
    }
    async goto() { await this.page.goto('/home'); }
    async viewAllProducts() {
        await this.viewAllProductsLink.click();
    }
    async openProduct(name: string) {
        await this.productList.getByRole('link', { name, exact: true }).click();
    }
    async retry() {
        await this.tryAgainLink.click();
    }
}