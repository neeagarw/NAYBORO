import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

/** Supabase client for Server Components, Route Handlers and Server Actions. */
export async function createClient() {
  // Supabase reads the clock while loading the session, so this must only run for a real
  // request, never during a prerender or prefetch (Cache Components rule).
  await connection();
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: the proxy/middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
