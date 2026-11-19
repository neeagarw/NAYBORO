import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type Alert = {
  id: number; recipient_id: string; email: string; first_name: string;
  kind: "hello" | "accepted" | "answer"; actor_name: string | null; detail: string | null; link_path: string;
};

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ───────── unsubscribe links (signed, so nobody can turn off someone else's alerts) ─────────
function secret() {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (!s) throw new Error("UNSUBSCRIBE_SECRET is not set");
  return s;
}
export function unsubscribeToken(profileId: string) {
  return createHmac("sha256", secret()).update(`unsubscribe:${profileId}`).digest("base64url");
}
export function checkUnsubscribeToken(profileId: string, token: string) {
  const a = Buffer.from(unsubscribeToken(profileId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ───────── one email per person, listing everything new ─────────
function line(a: Alert) {
  const who = a.actor_name ?? "Someone";
  switch (a.kind) {
    case "hello": return { title: `${who} said hi`, body: a.detail ? `“${clip(a.detail)}”` : "Open Nayboro to accept or say not now." };
    case "accepted": return { title: `${who} accepted your hello`, body: "You can chat now." };
    case "answer": return { title: `${who} answered your question`, body: a.detail ? `“${clip(a.detail)}”` : "" };
  }
}

export function buildEmail(items: Alert[]) {
  const first = items[0];
  const n = items.length;
  const subject =
    n === 1 ? `${line(first).title} on Nayboro`
    : items.every((i) => i.kind === "hello") ? `${n} people said hi on Nayboro`
    : `You have ${n} new things on Nayboro`;
  const cta = n === 1 ? { hello: "See who said hi", accepted: "Open chat", answer: "See the answer" }[first.kind] : "Open Nayboro";
  const url = `${site()}${n === 1 ? first.link_path : first.kind === "answer" ? "/explore" : "/chats"}`;
  const unsub = `${site()}/api/unsubscribe?u=${first.recipient_id}&t=${unsubscribeToken(first.recipient_id)}`;

  const rows = items.slice(0, 5).map((i) => {
    const l = line(i);
    return `<tr><td style="padding:12px 14px;background:#F5F7F2;border-radius:14px">
      <div style="font-weight:700;font-size:15px;color:#17201B">${esc(l.title)}</div>
      ${l.body ? `<div style="font-size:14px;color:#56635B;margin-top:4px">${esc(l.body)}</div>` : ""}
    </td></tr><tr><td style="height:8px"></td></tr>`;
  }).join("");
  const more = n > 5 ? `<p style="font-size:14px;color:#56635B">and ${n - 5} more.</p>` : "";

  const html = `<!doctype html><html><body style="margin:0;background:#F5F7F2;font-family:Inter,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:24px;padding:24px">
    <tr><td style="font-weight:800;font-size:20px;color:#1E6B4A;padding-bottom:16px">nayboro</td></tr>
    <tr><td style="font-size:16px;color:#17201B;padding-bottom:14px">Hi ${esc(first.first_name)},</td></tr>
    ${rows}
    <tr><td>${more}</td></tr>
    <tr><td style="padding-top:8px"><a href="${url}" style="display:block;text-align:center;background:#1E6B4A;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px;border-radius:16px">${cta}</a></td></tr>
    <tr><td style="font-size:12px;color:#56635B;padding-top:20px;line-height:1.5">Keep personal details private until you trust someone.<br>
      You get these because you have a Nayboro account. <a href="${unsub}" style="color:#56635B">Turn off email alerts</a>.</td></tr>
  </table></td></tr></table></body></html>`;

  const text = [
    `Hi ${first.first_name},`, "",
    ...items.map((i) => { const l = line(i); return `- ${l.title}${l.body ? `: ${l.body}` : ""}`; }), "",
    `${cta}: ${url}`, "",
    `Turn off email alerts: ${unsub}`,
  ].join("\n");

  return { to: first.email, subject, html, text, unsubscribe: unsub };
}

/** Sends through Resend's HTTP API. RESEND_API_URL can point at a test server. */
export async function sendEmail(msg: { to: string; subject: string; html: string; text: string; unsubscribe: string }) {
  const res = await fetch(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Nayboro <hello@nayboro.app>",
      to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text,
      headers: { "List-Unsubscribe": `<${msg.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${await res.text()}`);
}
