import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Supabase client for Client Components. Call it inside event handlers and effects only,
 * never during render: on the server that would run Supabase's session code while
 * Next.js prerenders (Cache Components rejects it).
 */
export function getClient() {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}
