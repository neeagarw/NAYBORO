import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScreenSkeleton } from "@/components/Skeleton";
import { AdminClient, type Report, type Contact, type Paused, type EventRow, type AreaRow } from "./AdminClient";

export const metadata = { title: "Admin" };

// Moderation and events for the Nayboro team. Only people in the `admins` table can open it;
// everyone else gets "not found" (the database refuses the data anyway).
export default function AdminPage() {
  return (
    <Suspense fallback={<ScreenSkeleton kind="list" />}>
      <Admin />
    </Suspense>
  );
}

async function Admin() {
  const supabase = await createClient();
  const { data: ok } = await supabase.rpc("is_admin");
  if (!ok) notFound();
  const [{ data: reports }, { data: contact }, { data: paused }, { data: events }, { data: areas }] = await Promise.all([
    supabase.rpc("admin_reports"),
    supabase.rpc("admin_contact_messages"),
    supabase.rpc("admin_suspended"),
    supabase.from("events").select("id, title, starts_at, place_name, price_label, kind, host_name, url, areas(metros(timezone))").order("starts_at", { ascending: false }).limit(100),
    supabase.from("areas").select("id, name, metro, metros(timezone)").order("metro").order("name"),
  ]);
  return (
    <AdminClient
      reports={(reports ?? []) as Report[]}
      contact={(contact ?? []) as Contact[]}
      paused={(paused ?? []) as Paused[]}
      events={(events ?? []).map((e) => ({ ...e, timezone: (e.areas as unknown as { metros: { timezone: string } } | null)?.metros.timezone ?? "UTC" })) as EventRow[]}
      areas={(areas ?? []).map((a) => ({ id: a.id, name: a.name, metro: a.metro, timezone: (a.metros as unknown as { timezone: string }).timezone })) as AreaRow[]}
    />
  );
}
