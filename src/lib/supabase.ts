import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cast to allow runtime-undefined env vars (graceful fallback for local dev without Supabase)
const env = import.meta.env as Record<string, string | undefined>;
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;
