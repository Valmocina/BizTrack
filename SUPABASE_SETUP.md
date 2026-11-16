# Supabase setup

1. Create a project at supabase.com.
2. Dashboard > SQL Editor: paste and run `supabase/schema.sql` (tables, security rules, 1 sample product).
   If you already have a database, apply all unapplied scripts in `supabase/migrations` in timestamp order. These include the purchase approval, partial-receipt, and receipt-history workflows.
3. Copy `.env.example` to `.env` and fill in the project URL and anon key (Project Settings > API).
4. Copy `.env.seed.example` to `.env.seed` and fill in the URL and the service role key.
5. `npm install` then `npm run seed` to create the two demo accounts:
   - admin@email.com (admin)
   - user@email.com (employee)
   Both use the password set in `scripts/seed-users.mjs`. Change it before going live.
6. `npm run dev` and sign in.

Never put the service role key in `.env` or anything starting with `VITE_`; it would end up in the browser bundle.

## Roles
- `admin`: full access to the existing app modules, including product management, order decisions, purchase approvals, suppliers, users, and settings.
- `employee` (Staff): can view products, update stock, complete orders already in progress, view/create purchase orders, mark deliveries in transit, and record partial receipts. Purchase orders over ₱10,000 require Admin approval. Employees cannot manage products, approve/reject/cancel orders, approve/cancel/delete purchase orders, manage users, or access settings.

## Forgot password
The login page's "Forgot password?" sends a reset email. In Supabase go to Authentication > URL Configuration and set the
Site URL to your app address (for local development: http://localhost:5173), otherwise the email link will not open your app.
