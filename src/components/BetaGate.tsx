import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Home page of the private beta site: sign-in for beta testers, and a kind "not yet" for anyone else. */
export function BetaGate({ notListedEmail, joinUrl }: { notListedEmail: string | null; joinUrl: string }) {
  return (
    <div className="app-frame">
      <main className="flex flex-1 flex-col p-5">
        <Logo size={36} />
        <div className="mt-8 rounded-[30px] bg-green px-6 py-8 text-white">
          <span className="inline-flex rounded-full bg-orange px-3 py-1.5 text-xs font-bold text-ink">Private beta</span>
          <h1 className="mt-4 font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.5px]">You&apos;re early.</h1>
          <p className="mt-2 text-[15px] leading-normal text-on-green-muted">This is the test version of Nayboro, open only to invited beta testers.</p>
        </div>

        {notListedEmail ? (
          <div role="alert" className="mt-5 rounded-[20px] border border-line-soft bg-surface p-4 text-sm leading-normal">
            <b>{notListedEmail}</b> isn&apos;t on the beta tester list yet. If you were invited, ask for this exact email to be added.
            Otherwise, <a href={joinUrl} className="font-bold text-green underline">join the waitlist</a> and we&apos;ll email you when we open.
          </div>
        ) : (
          <p className="mt-5 text-[15px] leading-normal text-muted">Sign in with the email you were invited with and your beta code.</p>
        )}

        <div className="flex-1" />
        <Link href="/login" className="flex h-14 items-center justify-center rounded-[18px] bg-green text-[17px] font-bold text-white">
          {notListedEmail ? "Try another email" : "Beta tester sign in"}
        </Link>
        <p className="mt-3 text-center text-xs leading-[1.45] text-muted">
          Not a tester? <a href={joinUrl} className="font-bold text-green underline">Join the waitlist</a>
        </p>
      </main>
    </div>
  );
}
