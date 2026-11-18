/** Only allow same-site relative paths in ?next= (stops open redirects like ?next=//evil.com). */
export function safeNext(next: string | null | undefined, fallback = "/people"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
