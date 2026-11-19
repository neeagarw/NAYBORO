import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no build-time call to Google Fonts).
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "./globals.css";
import { APP } from "@/config/app";

const site = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(site ? { metadataBase: new URL(site) } : {}),
  title: { default: `${APP.name} · ${APP.tagline}`, template: `%s · ${APP.name}` },
  description: APP.description,
  applicationName: APP.name,
  appleWebApp: { capable: true, title: APP.name, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", siteName: APP.name, title: `${APP.name} · ${APP.tagline}`, description: APP.description },
  twitter: { card: "summary_large_image", title: `${APP.name} · ${APP.tagline}`, description: APP.description },
};

export const viewport: Viewport = {
  themeColor: "#1E6B4A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <body className="font-sans">{children}</body>
    </html>
  );
}
