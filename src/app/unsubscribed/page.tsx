import { Suspense } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export const metadata = { title: "Email alerts" };

export default function UnsubscribedPage({ searchParams }: PageProps<"/unsubscribed">) {
  return (
    <div className="app-frame">
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-7 text-center">
        <LogoMark size={64} />
        <Suspense fallback={null}>
          <Message searchParams={searchParams} />
        </Suspense>
        <Link href="/people" className="mt-2 flex h-14 w-full items-center justify-center rounded-[18px] bg-green text-[17px] font-bold text-white">Open Nayboro</Link>
      </main>
    </div>
  );
}

async function Message({ searchParams }: { searchParams: PageProps<"/unsubscribed">["searchParams"] }) {
  const { bad } = await searchParams;
  return bad ? (
    <>
      <h1 className="m-0 font-display text-[30px] font-extrabold leading-tight">That link didn&apos;t work</h1>
      <p className="m-0 text-[15px] leading-normal text-muted">It may be old or incomplete. Use the link in your latest Nayboro email, or contact us from Help.</p>
    </>
  ) : (
    <>
      <h1 className="m-0 font-display text-[30px] font-extrabold leading-tight">Email alerts are off</h1>
      <p className="m-0 text-[15px] leading-normal text-muted">You won&apos;t get emails when someone says hi or answers your question. You&apos;ll still see everything in the app.</p>
    </>
  );
}
