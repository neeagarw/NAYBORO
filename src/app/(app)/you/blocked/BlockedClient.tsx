"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { Avatar, BackIcon, friendly, useToast } from "@/components/ui";

export type Blocked = { id: string; display_name: string; photo_path: string | null; blocked_at: string };

export function BlockedClient({ people: first, photos }: { people: Blocked[]; photos: Record<string, string> }) {
  const router = useRouter();
  const [people, setPeople] = useState(first);
  const [show, toast] = useToast();

  async function unblock(p: Blocked) {
    const { error } = await getClient().rpc("unblock", { p_id: p.id });
    if (error) return show(friendly(error));
    setPeople(people.filter((x) => x.id !== p.id));
    show(`${p.display_name} is unblocked`);
    router.refresh();
  }

  return (
    <div className="app-frame">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-4">
        <button aria-label="Back" onClick={() => (history.length > 1 ? router.back() : router.push("/you"))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface"><BackIcon /></button>
        <h1 className="m-0 font-display text-[30px] font-extrabold tracking-[-0.5px]">Blocked people</h1>
        <p className="m-0 text-[15px] text-muted">You and the people you block can&apos;t see each other anywhere on Nayboro. They aren&apos;t told.</p>
        {people.length === 0 ? (
          <div className="rounded-[20px] border border-line-soft bg-surface px-5 py-8 text-center text-[15px] text-muted">You haven&apos;t blocked anyone.</div>
        ) : (
          <div className="overflow-hidden rounded-[20px] border border-line-soft bg-surface [&>*+*]:border-t [&>*+*]:border-line-soft">
            {people.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar id={p.id} name={p.display_name} url={p.photo_path ? photos[p.photo_path] : null} size={44} radius={999} />
                <b className="flex-1 text-[17px]">{p.display_name}</b>
                <button onClick={() => unblock(p)} className="min-h-11 rounded-full border border-line px-4 text-[15px] font-bold text-green">Unblock</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {toast}
    </div>
  );
}
