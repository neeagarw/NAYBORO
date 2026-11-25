import { ComingSoon } from "@/components/ComingSoon";

/** Home page of the private beta site: what Nayboro is, tester sign-in, and a kind "not yet" for anyone else. */
export function BetaGate({ notListedEmail, joinUrl, year }: { notListedEmail: string | null; joinUrl: string; year: number }) {
  return <ComingSoon refCode={null} signedInEmail={null} guessedCity={null} year={year} showLogin={false} beta={{ notListedEmail, joinUrl }} />;
}
