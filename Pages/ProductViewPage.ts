import { Locator, Page } from '@playwright/test';

export class ProductViewPage {
    readonly backToProductsLink: Locator;
    readonly product: Locator;
    readonly productImages: Locator;
    readonly mainImage: Locator;
    readonly imageThumbnails: Locator;
    readonly heading: Locator;
    readonly stockStatus: Locator;
    readonly price: Locator;
    readonly quantitySelect: Locator;
    readonly addToBasketButton: Locator;
    readonly descriptionHeading: Locator;
    readonly description: Locator;
    readonly categoriesHeading: Locator;
    readonly categories: Locator;

    constructor(private readonly page: Page) {
        this.backToProductsLink = page.getByRole('link', { name: 'Back to products' });
        this.product = page.locator('article.product-detail');
        this.productImages = this.product.locator('.product-detail__images');
        this.mainImage = this.product.locator('#product-main-image');
        this.imageThumbnails = this.product.getByRole('group', { name: 'Product images' })
            .getByRole('button');
        this.heading = this.product.getByRole('heading', { level: 1 });
        this.stockStatus = this.product.locator('.stock');
        this.price = this.product.locator('.product__price');
        this.quantitySelect = this.product.getByLabel('Quantity');
        this.addToBasketButton = this.product.getByRole('button', { name: 'Add to basket' });
        this.descriptionHeading = this.product.getByRole('heading', { name: 'Description', exact: true });
        this.description = this.product.locator('.product-detail__description');
        this.categoriesHeading = this.product.getByRole('heading', { name: 'Categories', exact: true });
        this.categories = this.product.locator('dl.product-detail__classification').last();
    }

    async goto() {
        await this.page.goto('/products/product-1');
    }

    async selectQuantity(quantity: number) {
        await this.quantitySelect.selectOption(String(quantity));
    }

    async addToBasket() {
        await this.addToBasketButton.click();
    }

    async backToProducts() {
        await this.backToProductsLink.click();
    }
}