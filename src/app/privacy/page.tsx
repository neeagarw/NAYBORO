import type { Metadata } from "next";
import { APP } from "@/config/app";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy" };

// Plain-language policy that matches what the app actually stores (see CLAUDE.md product rules and
// supabase/migrations). Keep it in step with the code, and have a lawyer review it before public launch.
const SECTIONS: LegalSection[] = [
  { title: "Who we are", items: [
    `${APP.name} is a community app, based in Dallas, Texas, that helps you meet people from your hometown who live near you.`,
    "It's for people 18 and older in the United States.",
  ]},
  { title: "What we collect", items: [
    <><b>Your account:</b> your email address, used to sign you in and to contact you. If you choose “Continue with Google”, Google confirms your email address to us; it also sends your name, which we use only to pre-fill the name boxes when you set up your profile (you can change it), and your profile picture, which we don’t use or show.</>,
    <><b>Your profile:</b> your first and last name (others see only your first name and last initial), the city you live in, your hometowns, your interests, a short intro, and a photo if you add one.</>,
    <><b>What you post and do:</b> questions, answers, hellos, chat messages, events you mark as interesting, and the people you block or report.</>,
    <><b>The waitlist:</b> your email, city, hometowns, first name if you add it, and whether a friend invited you.</>,
    <><b>Messages to us:</b> what you send through Help, and the reply address you give.</>,
    <><b>Technical basics:</b> sign-in cookies that keep you logged in, and a scrambled one-way code made from your network address to stop spam. We never store the address itself. Our hosting provider keeps standard short-lived server logs.</>,
  ]},
  { title: "What we never ask for", items: [
    "Caste, religion, visa or immigration status, income, home address, or details about your children.",
    "Your exact location. “Find my city” uses your phone’s position once to find the nearest city, then forgets it. We store only the city.",
  ]},
  { title: "Who can see what", items: [
    "Other members see your public profile: first name and last initial, photo, city, interests, intro, and your hometown only at the level you chose (city, state or country).",
    "Chats open only after someone accepts a hello, and only the two of you can read them.",
    "If you ask a question anonymously, other members can't see who asked. We can, to keep the community safe. Answers always show the person's name.",
    "When you block someone, you disappear from each other everywhere on the app.",
    "We never show a group count below 5, so small groups can't be used to single anyone out.",
  ]},
  { title: "How we use it", items: [
    "To run the app: show your profile, suggest people and questions near you, and deliver hellos and messages.",
    "To keep people safe: review reports, stop spam and abuse, and enforce our rules.",
    "To email you: sign-in codes, activity alerts you can turn off, and, if you joined the waitlist, news about Nayboro opening. Every email has an unsubscribe link.",
    "To decide where to open next and improve Nayboro, using totals, not individual profiles.",
  ]},
  { title: "Who we share it with", items: [
    "We never sell your information, show you ads, or share it with advertisers or data brokers.",
    "Service providers that run Nayboro for us and may only use it for that: Supabase (database, sign-in and photo storage), Vercel (website hosting) and Google (waitlist sign-ups before launch, and sending some emails).",
    "We'll share information only if the law requires it, or if it's needed to protect someone's safety.",
  ]},
  { title: "Cookies", items: [
    "We use only the cookies needed to keep you signed in. No advertising or tracking cookies, and no analytics that follow you around the web.",
  ]},
  { title: "How long we keep it", items: [
    "Your profile and content stay while your account is open.",
    "When you delete your account, your profile, photo, hometowns, interests, hellos, chats, questions, answers and waitlist sign-up are deleted right away. Copies in our providers' backups expire on their normal schedule.",
    "Spam-prevention records and reports are kept only as long as they're needed for safety.",
  ]},
  { title: "Your choices and rights", items: [
    "Edit your profile any time, including what level of hometown others see.",
    "Delete your account in the app: open the You tab and choose Delete account.",
    "Turn off email alerts, or leave the waitlist, from the link in any email.",
    `To get a copy of your data, correct it, or ask anything about it, email ${APP.contactEmail}. We'll respond within 45 days. If we can't help, you can ask us to reconsider, and you can also contact your state's attorney general.`,
  ]},
  { title: "Keeping it safe", items: [
    "Access to every table is locked to the people allowed to see it, photos are private and shown through short-lived links, and the position data phones add to photos is removed when you upload.",
    "No system is perfect. If a breach ever affects your information, we'll tell you and the authorities as the law requires.",
  ]},
  { title: "Children", items: [
    "Nayboro is for adults. We don't knowingly collect information from anyone under 18, and we delete it if we find out.",
  ]},
  { title: "Changes", items: [
    "If we change this policy in an important way, we'll tell you in the app or by email before the change applies.",
    `Questions? Email ${APP.contactEmail}.`,
  ]},
];

export default function Privacy() {
  return <LegalPage title="Privacy policy" updated={APP.termsUpdated} sections={SECTIONS}
    intro="The short version: we collect as little as we can, we use it only to run Nayboro and keep people safe, we never sell it, and you can delete your account any time." />;
}
