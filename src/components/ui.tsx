"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getClient } from "@/lib/supabase/client";
import { UI } from "@/config/app";

/** Signs private avatar paths in the browser (for pages loaded after the first). */
export async function signPhotosClient(paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return {} as Record<string, string>;
  const { data } = await getClient().storage.from("avatars").createSignedUrls(unique, UI.signedUrlSeconds);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

// Small building blocks shared by every screen. Styles copied from design/mockups.

const TONES = ["bg-green-tint text-green", "bg-blue-tint text-blue-text", "bg-pink-tint text-pink-text", "bg-yellow-tint text-yellow-text"];

/** Colour classes for a tone name stored in the database (topics.tone). */
export const TONE_CLASS: Record<string, string> = {
  green: "bg-green-tint text-green", blue: "bg-blue-tint text-blue-text", pink: "bg-pink-tint text-pink-text",
  purple: "bg-purple-tint text-purple-text", orange: "bg-orange-tint text-orange-text", yellow: "bg-yellow-tint text-yellow-text",
  grey: "bg-line-soft text-slate",
};

/** "Plays tennis" / "Goes running" / "Does yoga" / "Into book club", from the interest's verb in the database. */
export function doesLine(label: string, verbs: Record<string, string>) {
  return `${({ play: "Plays", go: "Goes", do: "Does" } as Record<string, string>)[verbs[label]] ?? "Into"} ${label.toLowerCase()}`;
}
/** "Both play tennis" / "Both go running" / "Both do yoga" / "Both into book club". */
export function bothLine(label: string, verbs: Record<string, string>) {
  return `Both ${({ play: "play", go: "go", do: "do" } as Record<string, string>)[verbs[label]] ?? "into"} ${label.toLowerCase()}`;
}

/** Stable color per person, like the mockups' .av.g/.b/.p/.y. */
export function toneFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export function initials(name: string) {
  const parts = name.replace(/\./g, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ id, name, url, size = 48, radius = 16, anon = false }: { id: string; name: string; url?: string | null; size?: number; radius?: number; anon?: boolean }) {
  const style = { width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.31) };
  if (anon) {
    return (
      <span style={style} className="flex flex-none items-center justify-center bg-line-soft text-slate">
        <MaskIcon size={Math.round(size * 0.5)} />
      </span>
    );
  }
  // Initials are always underneath: they show while the photo loads and stay if it fails (never a blank box).
  return (
    <span style={style} className={`relative flex flex-none items-center justify-center overflow-hidden font-display font-extrabold ${toneFor(id)}`}>
      {initials(name)}
      {url && <AvatarPhoto key={url} url={url} />}
    </span>
  );
}

function AvatarPhoto({ url }: { url: string }) {
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  if (state === "failed") return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
    <img src={url} alt="" onLoad={() => setState("ok")} onError={() => setState("failed")}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${state === "ok" ? "opacity-100" : "opacity-0"}`} />
  );
}

export function Sheet({ open, onClose, title, label, children }: { open: boolean; onClose: () => void; title?: React.ReactNode; label: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-end bg-[rgba(23,32,27,.35)]" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={label} className="flex max-h-[88%] w-full flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-6 pt-2.5">
        <div className="mx-auto mb-1 h-[5px] w-10 flex-none rounded bg-line" />
        {title && <h3 className="m-0 font-display text-[22px] font-extrabold">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function MenuItem({ children, warn, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { warn?: boolean }) {
  return (
    <button {...p} className={`flex min-h-[52px] w-full items-center gap-3 rounded-[14px] px-3.5 text-left text-base font-semibold ${warn ? "bg-warn-tint text-warn" : "bg-ground"}`}>
      {children}
    </button>
  );
}

/** Toast at the bottom of the app frame. */
export function useToast(place: "bottom" | "top" = "bottom") {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div role="status" className={`absolute left-5 right-5 z-30 rounded-2xl bg-green px-3.5 py-3 text-sm font-semibold text-white ${place === "top" ? "top-3 shadow-lg" : "bottom-24"}`}>{msg}</div>
  ) : null;
  return [setMsg, node] as const;
}

export function Tag({ children, tone = "green", className = "" }: { children: React.ReactNode; tone?: "green" | "orange" | "blue" | "plain"; className?: string }) {
  const t = { green: "bg-green-tint text-green", orange: "bg-orange-tint text-orange-text", blue: "bg-blue-tint text-blue-text", plain: "bg-ground text-muted" }[tone];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${t} ${className}`}>{children}</span>;
}

/** Shows our own database messages (limits, paused account) as-is; anything else gets a generic line. */
export function friendly(error: { message?: string } | null | undefined, fallback = "Something went wrong. Please try again.") {
  const m = error?.message ?? "";
  return /^(You |Your account is paused)/.test(m) ? m : fallback;
}

/** "2h ago", "Yesterday", "3 days ago". */
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return "Yesterday";
  return `${Math.floor(s / 86400)} days ago`;
}

const svg = { "aria-hidden": true, fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;
export const BackIcon = () => <svg {...svg} width="20" height="20" viewBox="0 0 24 24" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>;
export const MoreIcon = () => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>;
export const XIcon = ({ size = 18 }: { size?: number }) => <svg {...svg} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2"><path d="M7 7l10 10M17 7L7 17" /></svg>;
export const PlusIcon = ({ size = 18 }: { size?: number }) => <svg {...svg} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>;
export const ArrowIcon = ({ size = 20 }: { size?: number }) => <svg {...svg} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const PinIcon = ({ size = 14 }: { size?: number }) => <svg {...svg} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
export const ShieldIcon = ({ size = 18, check = true }: { size?: number; check?: boolean }) => <svg {...svg} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" />{check && <path d="M9 12l2 2 4-4" />}</svg>;
export const ChatIcon = ({ size = 20 }: { size?: number }) => <svg {...svg} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M4 5h16v11H9l-5 4z" /></svg>;
export const MaskIcon = ({ size = 16 }: { size?: number }) => <svg {...svg} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M3 10c0-1.7 2.5-3 9-3s9 1.3 9 3c0 3-2 5-4.5 5-1.8 0-2.7-1.3-4.5-1.3S9.3 15 7.5 15C5 15 3 13 3 10z" /></svg>;
export const FlagIcon = () => <svg {...svg} width="20" height="20" viewBox="0 0 24 24" strokeWidth="2"><path d="M5 21V4h11l-1.5 4L16 12H5" /></svg>;
export const BlockIcon = () => <svg {...svg} width="20" height="20" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>;


/**
 * A sideways-scrolling filter row with a visible cue: while more chips are off to the right, the edge fades and a
 * round "more" button scrolls the row along. Both go away at the end. One pattern for every filter row.
 */
export function ChipRow({ label, className = "", wrapClass = "", children }: { label?: string; className?: string; wrapClass?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    const raf = requestAnimationFrame(check);
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check); ro.observe(el);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("scroll", check); ro.disconnect(); };
  }, []);
  return (
    <div className={`relative ${wrapClass}`}>
      <div ref={ref} role={label ? "toolbar" : undefined} aria-label={label} className={`chip-row flex gap-2 overflow-x-auto ${more ? "chip-row-more" : ""} ${className}`}>{children}</div>
      {more && (
        <button type="button" aria-label="Scroll to see more filters" title="Scroll to see more filters" onClick={() => ref.current?.scrollBy({ left: ref.current.clientWidth * 0.7, behavior: "smooth" })}
          className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-md">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      )}
    </div>
  );
}
// ───────── "Don't show this again" for tips (kept on this device) ─────────
const hideListeners = new Set<() => void>();
function isHidden(key: string) {
  try { return localStorage.getItem(`nayboro.hide.${key}`) === "1"; } catch { return false; }
}
/** [hidden, hide]: a tip the person closed stays closed on this device. */
export function useDismissed(key: string): [boolean, () => void] {
  const hidden = useSyncExternalStore(
    (cb) => { hideListeners.add(cb); return () => { hideListeners.delete(cb); }; },
    () => isHidden(key),
    () => false,
  );
  const hide = useCallback(() => {
    try { localStorage.setItem(`nayboro.hide.${key}`, "1"); } catch { /* private mode: hide for now only */ }
    hideListeners.forEach((l) => l());
  }, [key]);
  return [hidden, hide];
}
