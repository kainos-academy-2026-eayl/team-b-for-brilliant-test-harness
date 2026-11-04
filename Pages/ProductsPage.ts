import { Locator, Page } from '@playwright/test';

export class ProductsPage {
    readonly heading: Locator;
    readonly nameSearchForm: Locator;
    readonly nameSearchInput: Locator;
    readonly nameSearchButton: Locator;
    readonly categoryForm: Locator;
    readonly categorySelect: Locator;
    readonly categoryFilterButton: Locator;
    readonly productItems: Locator;
    readonly productLinks: Locator;
    readonly productImages: Locator;
    readonly productPrices: Locator;
    readonly stockLabels: Locator;
    readonly emptyState: Locator;

    constructor(private readonly page: Page) {
        this.heading = page.getByRole('heading', { level: 1, name: 'Products' });
        this.nameSearchForm = page.getByRole('search', { name: 'Search products by name' });
        this.nameSearchInput = this.nameSearchForm.getByRole('searchbox');
        this.nameSearchButton = this.nameSearchForm.getByRole('button', { name: 'Search' });
        this.categoryForm = page.getByRole('search', { name: 'Search products by category' });
        this.categorySelect = this.categoryForm.getByRole('combobox');
        this.categoryFilterButton = this.categoryForm.getByRole('button', { name: 'Filter products' });
        this.productItems = page.locator('.product-list > .product');
        this.productLinks = page.locator('.product__link');
        this.productImages = this.productItems.getByRole('img');
        this.productPrices = page.locator('.product__price');
        this.stockLabels = page.locator('.stock');
        this.emptyState = page.locator('.empty-state');
    }

    async goto() { await this.page.goto('/products'); }

    async searchByName(name: string) {
        await this.nameSearchInput.fill(name);
        await this.nameSearchButton.click();
    }

    async filterByCategory(category: string) {
        await this.categorySelect.selectOption({ label: category });
        await this.categoryFilterButton.click();
    }

    productItem(name: string): Locator {
        return this.productItems.filter({ has: this.page.getByRole('link', { name, exact: true }) });
    }

    async openProduct(name: string) {
        await this.productItem(name).getByRole('link', { name, exact: true }).click();
    }
}
