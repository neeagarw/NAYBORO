"use client";

import Link from "next/link";
import { Avatar, ChevronIcon, XIcon, useDismissed } from "@/components/ui";

// "Your roots, nearby" on Explore. Every number comes from roots_nearby() and is a safe count (5 or more);
// we never show distances, so the second line names your city instead of "within 10 miles".
export type Roots = {
  region: string; metro_name: string; area_name: string; total: number; in_my_city: number | null;
  faces: { id: string; name: string; photo: string | null }[];
};

export function RootsCard({ roots, photos }: { roots: Roots; photos: Record<string, string> }) {
  // Closing it hides it until the number grows.
  const [hidden, hide] = useDismissed(`roots-${roots.region}-${roots.total}`);
  if (hidden) return null;
  const more = roots.total - roots.faces.length;
  return (
    <section aria-label="Your roots, nearby" className="relative flex flex-col gap-2 overflow-hidden rounded-[22px] bg-green p-5 text-white">
      <button onClick={hide} aria-label="Hide this card" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15"><XIcon /></button>
      <span className="text-xs font-bold tracking-[1px] text-on-green-muted">YOUR ROOTS, NEARBY</span>
      <h2 className="m-0 pr-10 font-display text-[22px] font-extrabold leading-tight">{roots.total} people from {roots.region} live around {roots.metro_name}</h2>
      {roots.in_my_city && <span className="text-[15px] text-on-green-muted">{roots.in_my_city} of them in {roots.area_name}</span>}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center">
          {roots.faces.map((f, i) => (
            <span key={f.id} className={`rounded-full ring-2 ring-green ${i ? "-ml-2.5" : ""}`}>
              <Avatar id={f.id} name={f.name} url={f.photo ? photos[f.photo] : null} size={40} radius={999} />
            </span>
          ))}
          {more > 0 && <span className="-ml-2.5 flex h-10 min-w-10 items-center justify-center rounded-full bg-green-dark px-1.5 text-[13px] font-bold ring-2 ring-green">+{more}</span>}
        </div>
        <Link href="/people?chip=region" className="flex min-h-11 items-center gap-1 rounded-[14px] bg-surface px-4 text-[16px] font-bold text-green">See them<ChevronIcon /></Link>
      </div>
    </section>
  );
}
