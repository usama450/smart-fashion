-- ============================================================
--  Smart Fashion — Supabase Setup SQL
--  Run this in your Supabase project → SQL Editor → New query
-- ============================================================

-- 1. Products table
CREATE TABLE IF NOT EXISTS products (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  category    text NOT NULL,
  price       text NOT NULL,
  description text DEFAULT '',
  stock       text DEFAULT 'In Stock',
  image_url   text DEFAULT '',
  image_path  text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 3. Public can read all products
CREATE POLICY "Public read products"
  ON products FOR SELECT
  USING (true);

-- 4. Allow insert (admin form is password-protected in the UI)
CREATE POLICY "Allow insert products"
  ON products FOR INSERT
  WITH CHECK (true);

-- 5. Allow delete
CREATE POLICY "Allow delete products"
  ON products FOR DELETE
  USING (true);

-- ============================================================
--  After running this SQL, also do the following in the UI:
--
--  Storage → New Bucket
--    Name: product-images
--    Public: YES (toggle on)
--
--  Then run these Storage policies:
-- ============================================================

CREATE POLICY "Public read images"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'product-images' );

CREATE POLICY "Allow upload images"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'product-images' );

CREATE POLICY "Allow delete images"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'product-images' );
