"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import { getClient } from "@/lib/supabase/client";

/** Orange initial button + bottom sheet (Edit profile, Help and feedback, Community guidelines, Log out, Delete account). */
export function AccountMenu({ name, route, admin = false }: { name: string; route: string; admin?: boolean }) {
  const [open, setOpen] = useState(false);
  // The menu sits in the sticky header; its sheets render into the screen frame so they cover the whole screen.
  const [frame, setFrame] = useState<Element | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setOpen(false); setConfirming(false); setError(null); };

  // Photos first (storage rows can only be removed through the Storage API), then everything else in one call.
  async function deleteAccount() {
    setBusy(true); setError(null);
    const sb = getClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setBusy(false); return setError("You're signed out. Sign in again to delete your account."); }
    const { data: files } = await sb.storage.from("avatars").list(user.id);
    if (files?.length) await sb.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));
    const { error: e } = await sb.rpc("delete_my_account");
    if (e) { setBusy(false); return setError("We couldn't delete your account. Please try again, or contact us from Help."); }
    await sb.auth.signOut({ scope: "local" }).catch(() => null);
    await fetch("/auth/signout", { method: "POST" }).catch(() => null);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload after sign-out
    window.location.assign("/?deleted=1");
  }
  return (
    <>
      <button onClick={(e) => { setFrame(e.currentTarget.closest(".app-frame")); setOpen(true); }} aria-label="Your account" className="h-10 w-10 rounded-[13px] bg-orange font-display text-sm font-extrabold text-ink">
        {name[0]?.toUpperCase() ?? "?"}
      </button>
      {frame && createPortal(<>
      {open && confirming && (
        <div className="absolute inset-0 z-10 flex items-end bg-[rgba(23,32,27,.35)]" onClick={(e) => e.target === e.currentTarget && !busy && close()}>
          <div role="dialog" aria-modal="true" aria-labelledby="delTitle" className="flex w-full flex-col gap-3 rounded-t-[28px] bg-surface px-5 pb-6 pt-2.5">
            <div className="mx-auto mb-1 h-[5px] w-10 rounded bg-line" />
            <h3 id="delTitle" className="m-0 font-display text-[22px] font-extrabold">Delete your account?</h3>
            <p className="m-0 text-[15px] leading-normal text-muted">
              This permanently deletes your profile, photo, hometowns, interests, chats, hellos, questions and answers, and takes you off the waitlist.
              It can&apos;t be undone. People you chatted with will no longer see your messages.
            </p>
            {error && <span role="alert" className="text-sm font-semibold text-warn">{error}</span>}
            <button onClick={deleteAccount} disabled={busy} className="flex min-h-[52px] items-center justify-center rounded-[14px] bg-warn px-3.5 text-base font-bold text-white disabled:opacity-60">
              {busy ? "Deleting…" : "Delete my account forever"}
            </button>
            <button onClick={() => setConfirming(false)} disabled={busy} className="min-h-11 text-sm font-bold text-green">Keep my account</button>
          </div>
        </div>
      )}
      {open && !confirming && (
        <div className="absolute inset-0 z-10 flex items-end bg-[rgba(23,32,27,.35)]" onClick={(e) => e.target === e.currentTarget && close()}>
          <div role="dialog" aria-modal="true" aria-labelledby="meTitle" className="flex w-full flex-col gap-3 rounded-t-[28px] bg-surface px-5 pb-6 pt-2.5">
            <div className="mx-auto mb-1 h-[5px] w-10 rounded bg-line" />
            <h3 id="meTitle" className="m-0 font-display text-[22px] font-extrabold">{name}</h3>
            <span className="text-sm text-muted">{route}</span>
            <Link href="/setup" onClick={close} className="flex min-h-[52px] items-center rounded-[14px] bg-ground px-3.5 text-base font-semibold">Edit profile</Link>
            {admin && <Link href="/admin" onClick={() => setOpen(false)} className="flex min-h-[52px] items-center rounded-[14px] bg-green-tint px-3.5 text-base font-semibold text-green">Admin</Link>}
            <Link href="/help" onClick={close} className="flex min-h-[52px] items-center rounded-[14px] bg-ground px-3.5 text-base font-semibold">Help and feedback</Link>
            <Link href="/guidelines" onClick={close} className="flex min-h-[52px] items-center rounded-[14px] bg-ground px-3.5 text-base font-semibold">Community guidelines</Link>
            <form action="/auth/signout" method="post">
              <button className="flex min-h-[52px] w-full items-center rounded-[14px] bg-ground px-3.5 text-left text-base font-semibold">Log out</button>
            </form>
            <div className="flex items-center justify-between">
              <button onClick={() => setConfirming(true)} className="min-h-11 text-sm font-semibold text-muted underline">Delete account</button>
              <button onClick={close} className="min-h-11 px-2 text-sm font-bold text-green">Cancel</button>
            </div>
          </div>
        </div>
      )}
      </>, frame)}
    </>
  );
}
