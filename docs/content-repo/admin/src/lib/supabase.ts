import { createClient } from '@supabase/supabase-js';

// Service role key bypasses RLS — safe here because this app runs locally only
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_SERVICE_KEY as string,
);
