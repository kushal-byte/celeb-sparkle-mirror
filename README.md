# Evol Jewels — Local development (frontend + hosted Supabase)

This README shows exactly how to run the application using a hosted Supabase project, run the database migration (copy/paste SQL), deploy the `match-celebrity` function, and start the frontend for interactive AR testing. It also includes troubleshooting tips and notes about AR behavior across devices.

## Quick overview
- Frontend: Vite + React — run with `npm run dev`.
- Backend: Supabase (hosted) — create a project, run the SQL migration, deploy the Edge Function `match-celebrity`, and set the OpenRouter API key as a function secret.

## Prerequisites
- Node >= 18, npm
- A Supabase account (https://app.supabase.com)
- (Optional) supabase CLI if you want to deploy functions from the terminal

## 1) Create a Supabase project (hosted)
1. Sign in to https://app.supabase.com and create a new project.
2. Note the Project URL (e.g., `https://abcd1234.supabase.co`) and the anon/public key (Settings → API → Project API keys).

## 2) Run the migration SQL (copy/paste)
Open Supabase → SQL Editor → New query and paste the SQL below. Run it to create tables, policies, and sample data.

-- BEGIN SQL (copy and paste whole block) --

```sql
/*
  # Jewelry Kiosk Database Schema

  1. New Tables
    - `style_surveys`
    - `celebrity_looks`
    - `products`
    - `wishlists`
    - `orders`

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

```

-- END SQL --

## 3) Deploy `match-celebrity` function and set OpenRouter key
The repo includes the function code at `supabase/functions/match-celebrity/index.ts`. It calls OpenRouter to produce celebrity suggestions.

### Deploy via Supabase dashboard
1. Supabase Dashboard → Functions → Create new function → `match-celebrity`.
2. Paste the TypeScript function from `supabase/functions/match-celebrity/index.ts`.
3. Deploy.
4. In Function settings, set the environment variable `VITE_OPENROUTER_API_KEY` to your OpenRouter key.

### (Optional) Deploy via CLI
If you prefer CLI and have the supabase CLI installed:
```powershell
supabase functions deploy match-celebrity --project-ref <project-ref>
supabase secrets set VITE_OPENROUTER_API_KEY=<your-openrouter-key> --project-ref <project-ref>
```

## 4) Configure frontend env and start dev server
1. Copy `.env.example` → `.env.local` and set:
```
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
2. Start the frontend:
```powershell
npm install
npm run dev
```
3. Open the Local URL Vite prints (e.g., http://localhost:8080/).

## 5) Debugging AR and AI integration
- To visualize detection landmarks, add `?debugTryOn=1` to the app URL: `http://localhost:8080/?debugTryOn=1`.
- When you submit the style survey the app calls: `${VITE_SUPABASE_URL}/functions/v1/match-celebrity`.
- If the function returns 500, view the function logs in the Supabase dashboard and ensure `VITE_OPENROUTER_API_KEY` is set in the function env/secrets.

## Important note about AR behavior across devices
AR and landmark detection are sensitive to hardware, browser, and environmental factors. Expect differences across devices:

- Camera quality and resolution: lower-end cameras produce noisier landmarks.
- CPU/GPU and performance: Mediapipe wasm runs faster on more powerful devices; low-end devices may drop frames or skip landmarking.
- Browser support: use a modern Chromium-based browser (Chrome, Edge) for best wasm and camera support. Safari and older browsers may behave differently.
- Mobile vs Desktop: mobile browsers may restrict camera APIs or have more aggressive performance limits; touch/rotation adds complexity.
- Lighting and pose: good frontal lighting and a centered pose improve ear/neck detection; occlusions (hair, glasses) reduce accuracy.

If you want a consistent kiosk experience, prefer a controlled device (dedicated mirror kiosk or tablet) with a quality camera, use transparent PNG product assets, and test the AR pipeline on the chosen kiosk hardware.

## Troubleshooting tips
- If Mediapipe models fail to load (network/404): check browser console for blocked requests to `storage.googleapis.com` and ensure your environment allows those requests.
- If the overlay images appear offset: enable `?debugTryOn=1`, examine the cyan (raw) vs yellow (smoothed) points, and report a screenshot — I can tune mapping offsets.
- If product images fail transparent processing (canvas CORS error): host images with permissive CORS or provide transparent PNGs.
- If wishlist insertions fail: confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set and the `wishlists` table exists (check Table Editor).

## Next steps I can take for you
- Add a small in-UI debug panel with numeric coordinates and live offset sliders for tuning overlays.
- Add a README section that includes example `curl` checks and a checklist for kiosk hardware.
- Help deploy functions via CLI if you install the supabase CLI locally.

If you want me to add any of these to the repo (README improvements, debug UI, or deploy scripts), say which one and I'll add it.
# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/15c4afd0-c1ab-49bb-881a-d323168717be

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/15c4afd0-c1ab-49bb-881a-d323168717be) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/15c4afd0-c1ab-49bb-881a-d323168717be) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
