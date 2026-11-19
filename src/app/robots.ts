import type { MetadataRoute } from "next";

// Only the public welcome page should appear in search. Everything else is private to members.
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: [{ userAgent: "*", allow: "/$", disallow: ["/people", "/p/", "/chats", "/explore", "/help", "/admin", "/setup", "/login", "/api/", "/unsubscribed"] }],
    ...(site ? { host: site } : {}),
  };
}
