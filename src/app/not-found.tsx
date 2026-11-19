import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export const metadata = { title: "Not found · Nayboro" };

export default function NotFound() {
  return (
    <div className="app-frame">
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-7 text-center">
        <LogoMark size={64} />
        <h1 className="m-0 font-display text-[30px] font-extrabold leading-tight">We couldn&apos;t find that</h1>
        <p className="m-0 text-[15px] leading-normal text-muted">
          The page may have moved, or it&apos;s something only certain people can see, like someone else&apos;s chat.
        </p>
        <Link href="/people" className="mt-2 flex h-14 w-full items-center justify-center rounded-[18px] bg-green text-[17px] font-bold text-white">Back to Nayboro</Link>
        <Link href="/help" className="min-h-11 text-sm font-bold text-green">Tell us what you were looking for</Link>
      </main>
    </div>
  );
}
