import type { Metadata } from "next";
import Link from "next/link";
import { APP } from "@/config/app";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

// Plain-language Terms. Have a lawyer review before public launch.
const SECTIONS: LegalSection[] = [
  { title: "Agreeing to these terms", items: [
    `These terms are an agreement between you and ${APP.name} ("we", "us"). By creating an account or using ${APP.name}, you agree to them, to our Privacy policy and to our Community guidelines.`,
    "If you don't agree, please don't use the service.",
  ]},
  { title: "Who can use Nayboro", items: [
    "You must be 18 or older and live in the United States.",
    "Use your real first name, and keep your profile honest. One account per person.",
    "You can't use Nayboro if we've removed you before, or if the law doesn't allow you to.",
  ]},
  { title: "Your account", items: [
    "You sign in with a code sent to your email. Keep access to that email safe; anyone who can read it can sign in as you.",
    "Tell us right away if you think someone else has used your account.",
  ]},
  { title: "Community rules", items: [
    <>Follow the <Link className="text-teal underline" href="/guidelines">Community guidelines</Link>. In short:</>,
    "No harassment, threats, hate, or sexual content. No impersonating anyone.",
    "No buying, selling, ads, promotions, or spam in questions, answers or chats.",
    "Don't share anyone's private details, and don't ask people about caste, religion, visa status, income, home address or their children.",
    "Don't try to break, scrape, or overload the service, or get around blocks, limits or safety features.",
  ]},
  { title: "What you post", items: [
    "You own what you post: your profile, photo, questions, answers and messages.",
    `You give ${APP.name} permission to store and show that content to the people it's meant for, only to run and improve the service. This permission ends when you delete the content or your account, except for copies we must keep for safety or legal reasons.`,
    "Only post things you have the right to share, including photos.",
    "We may remove content or limit accounts that break these terms or the guidelines. We don't review everything before it's posted.",
  ]},
  { title: "Meeting people safely", items: [
    `${APP.name} helps you find people nearby. We don't run background checks and can't promise who anyone is or how they'll behave.`,
    "You're responsible for your own decisions about who to talk to and meet. Meet in public places, tell a friend, and never send money.",
    "Report and Block are on every profile and chat. If you're in danger, call 911.",
  ]},
  { title: "Events and links", items: [
    "Events are run by other organizers. We list them and link out; we don't host them and aren't responsible for them.",
  ]},
  { title: "Ending your account", items: [
    "You can delete your account any time from the account menu. That removes your profile and content.",
    "We may suspend or close accounts that break these terms, put others at risk, or harm the service.",
  ]},
  { title: "Copyright complaints", items: [
    `If you believe something on ${APP.name} infringes your copyright, email ${APP.contactEmail} with the content's location, your contact details, and a description of your work. We'll review it and remove infringing material.`,
  ]},
  { title: "The service", items: [
    `${APP.name} is new and may change, pause, or have mistakes. We provide it "as is" and "as available", without warranties of any kind, to the extent the law allows.`,
    `To the extent the law allows, ${APP.name} is not liable for indirect or consequential losses, or for the conduct of other members, and our total liability to you is limited to US$100.`,
    `You agree to cover our reasonable costs if a claim against us arises from content you posted or your breaking these terms.`,
  ]},
  { title: "Law and disputes", items: [
    "These terms are governed by the laws of the State of Texas. Disputes will be handled in the state or federal courts in Dallas County, Texas, unless the law where you live says otherwise.",
  ]},
  { title: "Changes and contact", items: [
    "We may update these terms. If a change is important, we'll tell you in the app or by email before it takes effect, and ask you to agree again.",
    `Questions? Email ${APP.contactEmail}.`,
  ]},
];

export default function Terms() {
  return <LegalPage title="Terms of Service" updated={APP.termsUpdated} sections={SECTIONS}
    intro="The rules for using Nayboro, in plain language. Please read them: they matter because Nayboro is about meeting real people." />;
}
