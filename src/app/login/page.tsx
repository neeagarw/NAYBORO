import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/Skeleton";
import { LoginForm } from "./LoginForm";
import { safeNext } from "@/lib/safe-next";

export const metadata = { title: "Log in" };

// searchParams is request-time data, so it is read inside a Suspense boundary (Cache Components).
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<ScreenSkeleton kind="form" />}>
      <WithNext searchParams={searchParams} />
    </Suspense>
  );
}

async function WithNext({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={safeNext(typeof next === "string" ? next : undefined)} />;
}
