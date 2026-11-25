-- Data the Playwright tests expect that the backend seed doesn't create.
-- Safe to run more than once.
INSERT INTO "SecurityQuestion" ("questionID", "question") VALUES
  ('1', 'What is your favourite colour?'),
  ('2', 'What is your pet''s name?')
ON CONFLICT ("questionID") DO NOTHING;

-- product-1 needs two images for the product gallery thumbnail tests
INSERT INTO "ProductImage" ("imageID", "productID", "imageUrl", "imageOrder") VALUES
  ('image-1-secondary', 'product-1', '/images/Product-1.png', 1)
ON CONFLICT ("imageID") DO NOTHING;
