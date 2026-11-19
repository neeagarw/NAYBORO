import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with the service role key. It skips row level security,
 * so use it ONLY for jobs no signed-in user triggers directly (sending email alerts,
 * unsubscribe links). Never import it from a Client Component; the "server-only"
 * import above makes the build fail if someone tries.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
