"use client";

import { Sheet } from "@/components/ui";

import { SAFETY_TIPS as TIPS } from "@/config/app";

export function SafetyTips({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Chatting safely" title="Chatting safely">
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {TIPS.map(([b, s], i) => (
          <li key={b} className="grid grid-cols-[32px_1fr] gap-x-3 gap-y-0.5 rounded-2xl bg-ground p-3">
            <span className="row-span-2 flex h-8 w-8 items-center justify-center rounded-[10px] bg-green-tint font-extrabold text-green">{i + 1}</span>
            <b className="text-[15px]">{b}</b>
            <span className="text-[13px] leading-[1.45] text-muted">{s}</span>
          </li>
        ))}
      </ol>
      <div className="rounded-[14px] bg-orange-tint p-3 text-[13px] leading-[1.45] text-orange-ink">If someone threatens you, call 911 first. Then report them so our team can act.</div>
      <button onClick={onClose} className="h-[54px] rounded-[18px] bg-green text-base font-bold text-white">Got it</button>
    </Sheet>
  );
}
