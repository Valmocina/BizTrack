// Creates the demo admin and employee accounts in Supabase Auth.
// Run: npm run seed   (needs .env.seed with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
// The service role key bypasses security rules, so keep it out of the frontend and out of git.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.seed");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Demo accounts. Change the password before using this database for real.
const PASSWORD = "0123456789";
const users = [
  { email: "admin@email.com", full_name: "Admin", role: "admin" },
  { email: "user@email.com", full_name: "Staff", role: "employee" },
];

for (const u of users) {
  const { error } = await admin.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
    app_metadata: { role: u.role }, // read by the handle_new_user trigger
  });
  if (error) console.log(`${u.email}: ${error.message}`);
  else console.log(`${u.email}: created as ${u.role}`);
}
