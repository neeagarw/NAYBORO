"use client";

import { Sheet } from "@/components/ui";

// Copy from design/mockups/chat.html ("Chatting safely").
const TIPS: [string, string][] = [
  ["Keep personal details private", "Your address, phone number and workplace can wait until you trust someone."],
  ["Never send money or codes", "No one should ask for money, gift cards, bank details or verification codes."],
  ["Watch for pressure", "Rushing you, guilt-tripping or pushing to move to WhatsApp fast are red flags."],
  ["Be careful with links and files", "Don't open unknown links or share photos of your passport, visa or ID."],
  ["You don't owe a reply", "It's fine to stop chatting, mute or block at any time."],
  ["Report anything off", "Harassment, scams or fake profiles: report them from the ⋯ menu."],
];

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
      <div className="rounded-[14px] bg-orange-tint p-3 text-[13px] leading-[1.45] text-[#3E2A1C]">If someone threatens you, call 911 first. Then report them so our team can act.</div>
      <button onClick={onClose} className="h-[54px] rounded-[18px] bg-green text-base font-bold text-white">Got it</button>
    </Sheet>
  );
}
