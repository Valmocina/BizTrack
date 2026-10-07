// Creates the single shared Supabase client. Keys come from .env (see .env.example).
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// False until .env is filled in; App.tsx shows a setup message instead of crashing
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || "http://localhost", anonKey || "missing-anon-key");
