// Product copy and UI constants in ONE place.
// Anything that varies by city, community or policy lives in the database instead
// (metros, areas, topics, interests, rate_limits, app_settings) and reaches the app via app_config().

export const APP = {
  name: "Nayboro",
  tagline: "Find your people, wherever you are.",
  description: "Meet people from your hometown who live nearby, get answers from people who have been there, and find things to do together.",
  emergency: "In immediate danger? Call 911 first.",
  /** Public links on the coming-soon page. Change these to the real ones before launch. */
  contactEmail: "hello@nayboro.com",
  instagramUrl: "https://www.instagram.com/nayborohq/",
  /** Shown as "Coming soon to …" on the coming-soon page: the first metro we open. */
  launchMetro: "Dallas-Fort Worth",
} as const;

/** Page sizes and display limits (UI only; the database enforces its own caps). */
export const UI = {
  peoplePage: 40,
  suggestions: 4,
  peopleChips: 3,            // interest chips on People
  questionsPage: 20,
  chatsPage: 50,
  messagesPage: 50,
  interestsVisible: 5,       // per group in setup before "Show N more"
  photoMaxPx: 640,
  signedUrlSeconds: 3600,
  resendCodeSeconds: 30,
  hometownResults: 5,
} as const;

export const REPORT_REASONS = {
  profile: ["Fake profile", "Harassment or hate", "Scam or asking for money", "Inappropriate photo or content", "Something else"],
  chat: ["Harassment or hate", "Scam or asking for money", "Inappropriate messages", "Fake profile", "Something else"],
  content: ["Scam or asking for money", "Selling or advertising", "Harassment or hate", "False or harmful information", "Something else"],
} as const;

export const SAFETY_TIPS: [string, string][] = [
  ["Keep personal details private", "Your address, phone number and workplace can wait until you trust someone."],
  ["Never send money or codes", "No one should ask for money, gift cards, bank details or verification codes."],
  ["Watch for pressure", "Rushing you, guilt-tripping or pushing to move to WhatsApp fast are red flags."],
  ["Be careful with links and files", "Don't open unknown links or share photos of your passport, visa or ID."],
  ["You don't owe a reply", "It's fine to stop chatting, mute or block at any time."],
  ["Report anything off", "Harassment, scams or fake profiles: report them from the ⋯ menu."],
];

/** "No buying, selling or ads" in Explore. A light check; moderators handle the rest. */
export const SELLING_PATTERN = /\b(for sale|selling|buy my|dm for price|discount code|promo code|whatsapp me|earn \$|work from home)\b/i;

/** Event categories offered in Admin (events can still have any kind). */
export const EVENT_KINDS = ["Sports", "Food", "Family", "Festival", "Culture", "Community"] as const;

/** Turn on once phone sign-in exists, so the badge means something. */
export const PHONE_VERIFICATION_LIVE = false;
