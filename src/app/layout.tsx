import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no build-time call to Google Fonts).
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nayboro",
  description: "Find your people, wherever you are.",
};

export const viewport: Viewport = {
  themeColor: "#1E6B4A",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <body className="font-sans">{children}</body>
    </html>
  );
}
