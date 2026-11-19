import { createClient } from "@/lib/supabase/server";
import { UI } from "@/config/app";

/** Turns private avatar paths into short-lived signed URLs (1 hour), in one request. */
export async function signPhotos(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage.from("avatars").createSignedUrls(unique, UI.signedUrlSeconds);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}
