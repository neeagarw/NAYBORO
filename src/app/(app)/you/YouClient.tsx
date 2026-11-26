"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { Sheet, ChevronIcon, friendly, useToast } from "@/components/ui";

export type Prefs = { answers: boolean; hellos: boolean; new_people: boolean; events: boolean };
type Level = "city" | "state" | "country";
type Place = { city: string; region: string; country: string };

const SWITCHES: [keyof Prefs, string, string][] = [
  ["answers", "Answers to my questions", "When someone answers or replies"],
  ["hellos", "Hi requests and messages", "New hi and when someone says yes"],
  ["new_people", "New people from home", "A weekly roundup, never more"],
  ["events", "Events near me", "Coming up this week, in the same roundup"],
];

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section aria-label={title} className="flex flex-col gap-2">
    <h2 className="m-0 px-1 text-xs font-bold tracking-[1px] text-muted">{title.toUpperCase()}</h2>
    <div className="overflow-hidden rounded-[20px] border border-line-soft bg-surface [&>*+*]:border-t [&>*+*]:border-line-soft">{children}</div>
  </section>
);

const rowClass = "flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left text-[17px]";
function Row({ href, onClick, label, value }: { href?: string; onClick?: () => void; label: string; value?: React.ReactNode }) {
  const inner = <>
    <span className="flex-1">{label}</span>
    {value !== undefined && <span className="text-[16px] text-muted">{value}</span>}
    <span className="text-muted"><ChevronIcon /></span>
  </>;
  return href ? <Link href={href} className={rowClass}>{inner}</Link> : <button onClick={onClick} className={rowClass}>{inner}</button>;
}

function Switch({ on, label, sub, onChange }: { on: boolean; label: string; sub: string; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left">
      <span className="flex flex-1 flex-col">
        <span className="text-[17px]">{label}</span>
        <span className="text-[14px] text-muted">{sub}</span>
      </span>
      <span aria-hidden="true" className={`relative h-[30px] w-[50px] flex-none rounded-full transition-colors ${on ? "bg-green" : "bg-line"}`}>
        <span className={`absolute top-[3px] h-6 w-6 rounded-full bg-surface shadow transition-all ${on ? "left-[23px]" : "left-[3px]"}`} />
      </span>
    </button>
  );
}

export function YouClient({ prefs: first, level: firstLevel, place, area, blocked, admin, userId }: {
  prefs: Prefs; level: Level; place: Place | null; area: string; blocked: number; admin: boolean; userId: string;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(first);
  const [level, setLevel] = useState(firstLevel);
  const [sheet, setSheet] = useState<"level" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, toast] = useToast();

  const shown = (l: Level) => (place ? (l === "city" ? place.city : l === "state" ? place.region : place.country) : "");

  async function toggle(k: keyof Prefs, v: boolean) {
    const before = prefs;
    setPrefs({ ...prefs, [k]: v });
    const { error: e } = await getClient().rpc("set_alert", { p_kind: k, p_on: v });
    if (e) { setPrefs(before); show(friendly(e, "Couldn't save that. Please try again.")); }
  }

  async function pickLevel(l: Level) {
    const before = level;
    setLevel(l); setSheet(null);
    const { error: e } = await getClient().rpc("set_root_level", { p_level: l });
    if (e) { setLevel(before); show(friendly(e, "Couldn't save that. Please try again.")); }
    else { show(`Others now see ${shown(l)}`); router.refresh(); }
  }

  // Photos first (storage rows can only be removed through the Storage API), then everything else in one call.
  async function deleteAccount() {
    setBusy(true); setError(null);
    const sb = getClient();
    const { data: files } = await sb.storage.from("avatars").list(userId);
    if (files?.length) await sb.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
    const { error: e } = await sb.rpc("delete_my_account");
    if (e) { setBusy(false); return setError("We couldn't delete your account. Please try again, or contact us from Help."); }
    await sb.auth.signOut({ scope: "local" }).catch(() => null);
    await fetch("/auth/signout", { method: "POST" }).catch(() => null);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload after sign-out
    window.location.assign("/?deleted=1");
  }

  return (
    <div className="flex flex-col gap-6 px-5 pb-8 pt-3">
      <Section title="Profile">
        <Row href="/setup" label="Edit profile" />
        <Row href="/setup?step=area" label="My area" value={area ? `${area} area` : undefined} />
        <Row onClick={() => setSheet("level")} label="Hometown shown as" value={shown(level)} />
        {admin && <Row href="/admin" label="Admin" />}
      </Section>

      <Section title="Notifications">
        {SWITCHES.map(([k, label, sub]) => <Switch key={k} on={prefs[k]} label={label} sub={sub} onChange={(v) => toggle(k, v)} />)}
      </Section>
      <p className="-mt-4 px-1 text-[13px] text-muted">We send these by email. You can also turn them off from any email.</p>

      <Section title="Privacy and safety">
        <Row href="/you/blocked" label="Blocked people" value={blocked} />
        <Row href="/guidelines" label="Community guidelines" />
      </Section>

      <Section title="Support">
        <Row href="/help" label="Help and feedback" />
        <Row href="/privacy" label="Privacy policy" />
        <Row href="/terms" label="Terms of use" />
      </Section>

      <form action="/auth/signout" method="post">
        <button className="min-h-[52px] w-full rounded-[16px] border border-line bg-surface text-[17px] font-bold">Log out</button>
      </form>
      <button onClick={() => setSheet("delete")} className="-mt-3 min-h-[52px] w-full rounded-[16px] border border-warn-tint bg-surface text-[17px] font-bold text-warn">Delete account</button>
      <p className="m-0 text-center text-[13px] text-muted">Nayboro beta</p>

      <Sheet open={sheet === "level"} onClose={() => setSheet(null)} label="Hometown shown as" title="Show my hometown as">
        <p className="m-0 text-[15px] text-muted">People nearby see this on your profile. We still match you on your exact hometown.</p>
        {(["city", "state", "country"] as Level[]).map((l) => (
          <button key={l} onClick={() => pickLevel(l)} aria-pressed={level === l}
            className={`flex min-h-[56px] w-full items-center justify-between rounded-[14px] border-2 px-4 text-left ${level === l ? "border-green bg-green-tint" : "border-line-soft bg-ground"}`}>
            <span className="flex flex-col"><b className="text-[17px]">{shown(l)}</b>
              <span className="text-[14px] text-muted">{l === "city" ? "Shows your city" : l === "state" ? "Hides your city" : "Country only"}</span></span>
            {level === l && <span className="text-sm font-bold text-green">Shown</span>}
          </button>
        ))}
      </Sheet>

      <Sheet open={sheet === "delete"} onClose={() => !busy && setSheet(null)} label="Delete your account" title="Delete your account?">
        <p className="m-0 text-[15px] leading-normal text-muted">
          This permanently deletes your profile, photo, hometowns, interests, chats, hellos, questions and answers, and takes you off the waitlist.
          It can&apos;t be undone. People you chatted with will no longer see your messages.
        </p>
        {error && <span role="alert" className="text-sm font-semibold text-warn">{error}</span>}
        <button onClick={deleteAccount} disabled={busy} className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-warn px-3.5 text-base font-bold text-white disabled:opacity-60">
          {busy ? "Deleting…" : "Delete my account forever"}
        </button>
        <button onClick={() => setSheet(null)} disabled={busy} className="min-h-11 text-sm font-bold text-green">Keep my account</button>
      </Sheet>
      {toast}
    </div>
  );
}
