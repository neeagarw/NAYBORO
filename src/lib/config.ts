import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Tone = "green" | "blue" | "pink" | "purple" | "orange" | "yellow" | "grey";
export type Metro = { code: string; name: string; timezone: string; near_km: number; match_km: number };
export type Topic = { name: string; tone: Tone; keywords: string[] };
export type AppConfig = {
  metro: Metro | null;
  metro_areas: string[];
  topics: Topic[];
  verbs: Record<string, "play" | "into">;
  settings: { min_group_size: number; new_member_days: number; hello_retry_days: number; min_interests: number; max_hometowns: number };
};

/** Per-request cache: every component that asks gets the same single database call. */
export const getAppConfig = cache(async (): Promise<AppConfig> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("app_config");
  return data as AppConfig;
});
