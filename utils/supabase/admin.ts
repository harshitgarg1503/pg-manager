import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for admin Auth operations (creating staff users).
 * Uses the secret key and never touches request cookies, so creating a
 * staff login does NOT disturb the admin's own session. Never expose this
 * key with a NEXT_PUBLIC_ prefix and never import this module client-side.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env (Supabase Dashboard → Project Settings → API → service_role key)."
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
