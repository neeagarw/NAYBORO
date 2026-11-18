"use client";

import Link from "next/link";
import { useState } from "react";

/** Orange initial button + bottom sheet (Edit profile, Help and feedback, Log out). */
export function AccountMenu({ name, route }: { name: string; route: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Your account" className="h-10 w-10 rounded-[13px] bg-orange font-display text-sm font-extrabold text-ink">
        {name[0]?.toUpperCase() ?? "?"}
      </button>
      {open && (
        <div className="absolute inset-0 z-10 flex items-end bg-[rgba(23,32,27,.35)]" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="meTitle" className="flex w-full flex-col gap-3 rounded-t-[28px] bg-surface px-5 pb-6 pt-2.5">
            <div className="mx-auto mb-1 h-[5px] w-10 rounded bg-line" />
            <h3 id="meTitle" className="m-0 font-display text-[22px] font-extrabold">{name}</h3>
            <span className="text-sm text-muted">{route}</span>
            <Link href="/setup" onClick={() => setOpen(false)} className="flex min-h-[52px] items-center rounded-[14px] bg-ground px-3.5 text-base font-semibold">Edit profile</Link>
            <Link href="/help" onClick={() => setOpen(false)} className="flex min-h-[52px] items-center rounded-[14px] bg-ground px-3.5 text-base font-semibold">Help and feedback</Link>
            <form action="/auth/signout" method="post">
              <button className="flex min-h-[52px] w-full items-center rounded-[14px] bg-ground px-3.5 text-left text-base font-semibold">Log out</button>
            </form>
            <button onClick={() => setOpen(false)} className="min-h-11 text-sm font-bold text-green">Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
