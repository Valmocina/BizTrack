# Supabase setup

1. Create a project at supabase.com.
2. Dashboard > SQL Editor: paste and run `supabase/schema.sql` (tables, security rules, 1 sample product).
3. Copy `.env.example` to `.env` and fill in the project URL and anon key (Project Settings > API).
4. Copy `.env.seed.example` to `.env.seed` and fill in the URL and the service role key.
5. `npm install` then `npm run seed` to create the two demo accounts:
   - admin@email.com (admin)
   - user@email.com (employee)
   Both use the password set in `scripts/seed-users.mjs`. Change it before going live.
6. `npm run dev` and sign in.

Never put the service role key in `.env` or anything starting with `VITE_`; it would end up in the browser bundle.

## Roles
- `admin`: full access (products, orders, purchase orders, suppliers, users).
- `employee`: can view everything operational and record inventory movements, but cannot change products, orders, purchase orders or users.

## Forgot password
The login page's "Forgot password?" sends a reset email. In Supabase go to Authentication > URL Configuration and set the
Site URL to your app address (for local development: http://localhost:5173), otherwise the email link will not open your app.
