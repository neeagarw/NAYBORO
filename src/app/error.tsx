"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LogoMark } from "@/components/Logo";

// Shown when a screen crashes. "Try again" re-renders it; the error is logged for monitoring.
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Screen error", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="app-frame">
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-7 text-center">
        <LogoMark size={64} />
        <h1 className="m-0 font-display text-[30px] font-extrabold leading-tight">Something went wrong</h1>
        <p className="m-0 text-[15px] leading-normal text-muted">
          It&apos;s not you. Check your connection and try again. If it keeps happening, let us know.
        </p>
        <button onClick={reset} className="mt-2 flex h-14 w-full items-center justify-center rounded-[18px] bg-green text-[17px] font-bold text-white">Try again</button>
        <Link href="/help?topic=broken" className="min-h-11 text-sm font-bold text-green">Report a problem</Link>
        {error.digest && <span className="text-xs text-muted">Error code: {error.digest}</span>}
      </main>
    </div>
  );
}
