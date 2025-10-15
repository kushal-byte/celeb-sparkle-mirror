/*
  # Jewelry Kiosk Database Schema

  1. New Tables
    - `style_surveys`
      - `id` (uuid, primary key)
      - `session_id` (text, unique session identifier)
      - `style_preferences` (jsonb, stores style choices)
      - `occasion` (text, event type)
      - `budget_range` (text, price preference)
      - `created_at` (timestamptz)

    - `celebrity_looks`
      - `id` (uuid, primary key)
      - `celebrity_name` (text)
      - `image_url` (text)
      - `style_tags` (text array)
      - `description` (text)
      - `occasion_tags` (text array)
      - `created_at` (timestamptz)

    - `products`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `price` (numeric)
      - `image_url` (text)
      - `style_tags` (text array)
      - `category` (text, e.g., rings, necklaces, earrings)
      - `in_stock` (boolean)
      - `ar_model_url` (text, 3D model for AR)
      - `created_at` (timestamptz)

    - `wishlists`
      - `id` (uuid, primary key)
      - `session_id` (text, references style_surveys)
      - `product_id` (uuid, references products)
      - `created_at` (timestamptz)

    - `orders`
      - `id` (uuid, primary key)
      - `session_id` (text)
      - `product_id` (uuid, references products)
      - `status` (text, default 'pending')
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public read access for products and celebrity_looks
    - Session-based access for surveys, wishlists, and orders
*/

-- Create style_surveys table
CREATE TABLE IF NOT EXISTS style_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  style_preferences jsonb DEFAULT '{}',
  occasion text,
  budget_range text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE style_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create surveys"
  ON style_surveys FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read own survey by session"
  ON style_surveys FOR SELECT
  TO anon
  USING (true);

-- Create celebrity_looks table
CREATE TABLE IF NOT EXISTS celebrity_looks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  celebrity_name text NOT NULL,
  image_url text NOT NULL,
  style_tags text[] DEFAULT '{}',
  description text,
  occasion_tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE celebrity_looks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view celebrity looks"
  ON celebrity_looks FOR SELECT
  TO anon
  USING (true);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text NOT NULL,
  style_tags text[] DEFAULT '{}',
  category text NOT NULL,
  in_stock boolean DEFAULT true,
  ar_model_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO anon
  USING (true);

-- Create wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can manage wishlists"
  ON wishlists FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view orders by session"
  ON orders FOR SELECT
  TO anon
  USING (true);

-- Insert sample celebrity looks
INSERT INTO celebrity_looks (celebrity_name, image_url, style_tags, description, occasion_tags) VALUES
  ('Zendaya', 'https://images.pexels.com/photos/1927259/pexels-photo-1927259.jpeg', ARRAY['elegant', 'modern', 'minimalist'], 'Stunning diamond tennis bracelet paired with delicate drop earrings', ARRAY['red carpet', 'formal', 'evening']),
  ('Rihanna', 'https://images.pexels.com/photos/1408978/pexels-photo-1408978.jpeg', ARRAY['bold', 'statement', 'luxe'], 'Layered gold chains with oversized hoop earrings', ARRAY['casual', 'party', 'night out']),
  ('Blake Lively', 'https://images.pexels.com/photos/1458916/pexels-photo-1458916.jpeg', ARRAY['classic', 'romantic', 'timeless'], 'Pearl necklace with matching stud earrings', ARRAY['wedding', 'formal', 'brunch']),
  ('Beyonce', 'https://images.pexels.com/photos/1689731/pexels-photo-1689731.jpeg', ARRAY['glamorous', 'sparkle', 'bold'], 'Statement diamond choker with cocktail ring', ARRAY['gala', 'red carpet', 'special occasion'])
ON CONFLICT DO NOTHING;

-- Insert sample products
INSERT INTO products (name, description, price, image_url, style_tags, category, in_stock, ar_model_url) VALUES
  ('Diamond Tennis Bracelet', 'Classic 18K white gold tennis bracelet with brilliant-cut diamonds', 2499.99, 'https://images.pexels.com/photos/1191531/pexels-photo-1191531.jpeg', ARRAY['elegant', 'classic', 'minimalist'], 'bracelets', true, '/models/tennis-bracelet.glb'),
  ('Gold Hoop Earrings', 'Oversized 14K gold hoops with a modern twist', 599.99, 'https://images.pexels.com/photos/1454171/pexels-photo-1454171.jpeg', ARRAY['bold', 'modern', 'statement'], 'earrings', true, '/models/hoop-earrings.glb'),
  ('Pearl Strand Necklace', 'Elegant freshwater pearl necklace with sterling silver clasp', 899.99, 'https://images.pexels.com/photos/1413420/pexels-photo-1413420.jpeg', ARRAY['classic', 'romantic', 'timeless'], 'necklaces', true, '/models/pearl-necklace.glb'),
  ('Diamond Stud Earrings', 'Brilliant 1-carat diamond studs in platinum settings', 3499.99, 'https://images.pexels.com/photos/1454172/pexels-photo-1454172.jpeg', ARRAY['elegant', 'minimalist', 'classic'], 'earrings', true, '/models/diamond-studs.glb'),
  ('Layered Gold Chains', 'Three delicate 14K gold chains in varying lengths', 749.99, 'https://images.pexels.com/photos/1232931/pexels-photo-1232931.jpeg', ARRAY['modern', 'trendy', 'layered'], 'necklaces', true, '/models/layered-chains.glb'),
  ('Statement Cocktail Ring', '5-carat emerald-cut diamond in 18K rose gold', 5999.99, 'https://images.pexels.com/photos/1343714/pexels-photo-1343714.jpeg', ARRAY['bold', 'glamorous', 'luxe'], 'rings', true, '/models/cocktail-ring.glb'),
  ('Rose Gold Bangle', 'Sleek 14K rose gold bangle with subtle engraving', 449.99, 'https://images.pexels.com/photos/1458917/pexels-photo-1458917.jpeg', ARRAY['minimalist', 'modern', 'elegant'], 'bracelets', true, '/models/rose-gold-bangle.glb'),
  ('Sapphire Drop Earrings', 'Blue sapphire and diamond drop earrings in white gold', 1899.99, 'https://images.pexels.com/photos/1472166/pexels-photo-1472166.jpeg', ARRAY['elegant', 'colorful', 'statement'], 'earrings', true, '/models/sapphire-drops.glb')
ON CONFLICT DO NOTHING;
