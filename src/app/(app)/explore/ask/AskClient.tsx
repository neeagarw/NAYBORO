"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import { MaskIcon, PlusIcon, XIcon, friendly, useToast } from "@/components/ui";

const TOPICS = ["Groceries", "Schools", "Food", "Sports", "Immigration", "Housing", "Travel", "Life here"];
// Starter keyword list for suggesting a topic (from the mockup). Grow it from real questions.
const WORDS: [string, string[]][] = [
  ["Sports", ["cricket", "tennis", "badminton", "pickleball", "run", "gym", "yoga"]],
  ["Groceries", ["grocery", "groceries", "methi", "curry leaves", "vegetable", "atta", "store"]],
  ["Schools", ["school", "esl", "teacher", "daycare", "tuition"]],
  ["Food", ["tiffin", "restaurant", "food", "dal", "thali", "sweets", "catering", "jalebi"]],
  ["Immigration", ["visa", "h1b", "h-1b", "green card", "oci", "passport", "consulate"]],
  ["Housing", ["rent", "apartment", "roommate", "lease", "house", "hoa"]],
  ["Travel", ["flight", "flying", "travel", "companion", "airport"]],
  ["Life here", ["friends", "lonely", "homesick", "winter", "meet people"]],
];
// "No buying, selling or ads". A light check; moderators handle the rest.
const SELLING = /\b(for sale|selling|buy my|dm for price|discount code|promo code|whatsapp me|earn \$|work from home)\b/i;

function guess(t: string) {
  const s = t.toLowerCase();
  for (const [topic, words] of WORDS) if (words.some((w) => s.includes(w))) return topic;
  return null;
}

export function AskClient({ userId, name, roots, area, metro }: { userId: string; name: string; roots: string; area: string; metro: string }) {
  const router = useRouter();
  const [toast, toastNode] = useToast();
  const [text, setText] = useState("");
  const [details, setDetails] = useState<string | null>(null);
  const [anon, setAnon] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const [list, setList] = useState(false);
  const [scope, setScope] = useState<"near" | "metro" | "other">("near");
  const [city, setCity] = useState("");
  const [discard, setDiscard] = useState(false);
  const [posting, setPosting] = useState(false);

  const g = guess(text);
  const topic = manual ?? g;
  const selling = SELLING.test(`${text} ${details ?? ""}`);
  const ready = text.trim().length >= 10 && (scope !== "other" || city.trim()) && !selling;
  const scopes: [typeof scope, string, string][] = [
    ["near", `Around ${area}`, `People in ${area} and close by`],
    ["metro", `All of ${metro}`, "Plano, Frisco, Richardson and more"],
    ["other", "Another city", "Moving soon? Ask people who already live there"],
  ];

  async function post() {
    setPosting(true);
    const { error } = await getClient().from("questions").insert({
      author_id: userId, body: text.trim(), details: details?.trim() || null, topic: topic ?? "General",
      scope, target_city: scope === "other" ? city.trim() : null, is_anonymous: anon,
    });
    setPosting(false);
    if (error) return toast(friendly(error, "Couldn't post. Please try again."));
    router.push("/explore");
  }

  return (
    <div className="app-frame">
      <div className="flex items-center justify-between px-5 pb-2.5 pt-4">
        <button aria-label="Close" onClick={() => (text.trim() ? setDiscard(true) : router.push("/explore"))} className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-surface"><XIcon /></button>
        <b className="text-[15px]">New question</b>
        <span className="w-11" />
      </div>
      {discard && (
        <div className="mx-5 mb-2 flex items-center gap-2 rounded-2xl bg-orange-tint py-2 pl-3.5 pr-2 text-sm font-semibold text-[#3E2A1C]">
          <span className="flex-1">Discard this question?</span>
          <button onClick={() => setDiscard(false)} className="h-10 rounded-[14px] bg-white px-4 text-sm font-bold text-green">Keep</button>
          <button onClick={() => router.push("/explore")} className="h-10 rounded-[14px] bg-orange px-4 text-sm font-bold text-ink">Discard</button>
        </div>
      )}

      <main className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-5 pt-1.5">
        <div className="overflow-hidden rounded-3xl border border-line-soft bg-surface">
          <div className="flex items-center gap-2.5 px-4 pt-3.5">
            <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl font-display text-xs font-extrabold ${anon ? "bg-line-soft text-[#3B463F]" : "bg-orange text-ink"}`}>{anon ? <MaskIcon /> : name[0]}</span>
            <span className="flex flex-1 flex-col gap-px">
              <b className="text-sm">{anon ? "Anonymous" : name}</b>
              <span className="text-xs text-muted">{anon ? `${area} area · name and hometown hidden` : `${roots} → ${area} · posting as you`}</span>
            </span>
            <button aria-pressed={anon} aria-label="Post anonymously" onClick={() => setAnon(!anon)} className={`flex h-9 flex-none items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold ${anon ? "border-[#3B463F] bg-[#3B463F] text-white" : "border-line bg-white text-[#3B463F]"}`}>
              <MaskIcon />{anon ? "On" : "Anonymous"}
            </button>
          </div>
          {anon && <div className="mx-4 mt-2.5 rounded-xl bg-ground px-2.5 py-2 text-xs leading-[1.45] text-[#3B463F]">Others won&apos;t see who you are. Nayboro can still see it, to keep the community safe. Replies to you stay named.</div>}
          <label htmlFor="q" className="sr-only">Your question</label>
          <textarea id="q" maxLength={150} value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you want to know?" className="block h-24 w-full resize-none bg-transparent px-4 pb-1 pt-3 font-display text-[22px] font-bold leading-[1.25] outline-none" />
          <div className="flex items-center justify-between px-4 pb-3 pt-2"><span className="text-xs text-muted">Name a place or a time to get faster answers</span><span className="text-xs font-semibold text-muted">{text.length}/150</span></div>
          <div className="border-t border-dashed border-line px-4 pb-2.5 pt-1">
            {details === null ? (
              <button onClick={() => setDetails("")} className="flex min-h-11 items-center gap-1.5 text-sm font-bold text-green"><PlusIcon />Add details</button>
            ) : (
              <>
                <label htmlFor="details" className="block pb-1 pt-2 text-xs font-bold text-muted">Details</label>
                <textarea id="details" autoFocus maxLength={800} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What have you tried? Any must-haves?" className="block h-[110px] w-full resize-none bg-transparent text-[15px] leading-normal outline-none" />
              </>
            )}
          </div>
        </div>
        <span className={`-mt-2 px-1.5 text-xs ${selling ? "font-semibold text-warn" : "text-muted"}`}>
          {selling ? "This looks like selling or an ad. Explore is for questions about life here." : "Ask anything about life here. No buying, selling or ads."}
        </span>

        <div className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-surface px-3.5 py-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2.5"><b className="text-sm">Topic</b>
              <span className={`rounded-full px-3 py-[7px] text-sm font-bold ${topic ? "bg-orange-tint text-orange-text" : "bg-ground text-muted"}`}>{topic ?? "General"}</span></span>
            <button onClick={() => setList(!list)} className="min-h-11 text-sm font-bold text-green">{list ? "Done" : topic ? "Change" : "Add"}</button>
          </div>
          <span className="text-xs text-muted">{!manual && g ? "Suggested from your question. Tap Change if it looks wrong." : topic ? "You picked this topic." : "Optional. We will file it under General if you skip it."}</span>
          {list && (
            <div className="flex flex-wrap gap-2 border-t border-dashed border-line pt-2">
              {TOPICS.map((t) => <button key={t} aria-pressed={topic === t} onClick={() => { setManual(t); setList(false); }} className={`min-h-11 rounded-full border-2 px-4 text-sm font-semibold ${topic === t ? "border-orange bg-orange" : "border-line-soft bg-white"}`}>{t}</button>)}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <b className="text-sm">Who should see it?</b>
          {scopes.map(([k, t, hint]) => (
            <button key={k} aria-pressed={scope === k} onClick={() => setScope(k)} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left ${scope === k ? "border-green bg-green-tint" : "border-line-soft bg-surface"}`}>
              <span className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-2 bg-white ${scope === k ? "border-green" : "border-[#7D8981]"}`}>{scope === k && <span className="h-2.5 w-2.5 rounded-full bg-green" />}</span>
              <span><b className="block text-[15px]">{t}</b><span className="text-xs text-muted">{hint}</span></span>
            </button>
          ))}
          {scope === "other" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="city" className="text-[13px] font-bold">Which city?</label>
              <input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Plano or Frisco" className="h-[50px] w-full rounded-[14px] border-2 border-line bg-surface px-3.5 text-base outline-none focus:border-green" />
            </div>
          )}
        </div>
      </main>

      <div className="flex flex-col gap-2 border-t border-line-soft bg-surface px-5 pb-6 pt-3">
        <button onClick={post} disabled={!ready || posting} className="flex h-14 items-center justify-center rounded-[18px] bg-green text-[17px] font-bold text-white disabled:bg-line disabled:text-muted">Post question</button>
        <span className="text-center text-xs text-muted">
          {text.trim().length < 10 ? "Write at least 10 characters to post." : scope === "near" ? `Shows in Explore for people around ${area}.` : scope === "metro" ? `Shows in Explore across ${metro}.` : "Shows in Explore for people in the city you pick."}
        </span>
      </div>
      {toastNode}
    </div>
  );
}
