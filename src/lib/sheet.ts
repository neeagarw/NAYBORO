import "server-only";

// Talks to the Google Sheet through its Apps Script web app (apps-script/Code.gs).
// SHEET_WEBHOOK_URL = the web app's /exec URL; SHEET_WEBHOOK_SECRET = the same secret saved in the script.

type JoinIn = { email: string; city: string | null; metro: string | null; homes: string | null; ref: string | null; ipHash: string | null; mail: { subject: string; html: string; text: string } | null };
export type JoinOut = { ref_code: string; already: boolean };

async function call<T>(action: string, data: Record<string, unknown>): Promise<T> {
  const url = process.env.SHEET_WEBHOOK_URL, secret = process.env.SHEET_WEBHOOK_SECRET;
  if (!url || !secret) throw new Error("SHEET_WEBHOOK_URL / SHEET_WEBHOOK_SECRET are not set");
  // Apps Script answers POSTs with a redirect to the result; fetch follows it.
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ secret, action, ...data }), cache: "no-store", redirect: "follow" });
  const text = await res.text();
  let json: { ok?: boolean; error?: string } & Record<string, unknown>;
  try { json = JSON.parse(text); } catch { throw new Error(`Sheet answered ${res.status}: ${text.slice(0, 200)}`); }
  if (!json.ok) throw new SheetError(json.error ?? "Sheet error");
  return json as T;
}

export class SheetError extends Error {}

export const sheet = {
  join: (p: JoinIn) => call<JoinOut>("join", p),
  setName: (email: string, ref: string, name: string) => call<{ updated: boolean }>("name", { email, ref, name }),
  leave: (email: string) => call<{ removed: boolean }>("leave", { email }),
};
