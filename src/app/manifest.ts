import type { MetadataRoute } from "next";
import { APP } from "@/config/app";

// "Add to Home Screen": opens full-screen like an app, starting on People.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP.name,
    short_name: APP.name,
    description: APP.description,
    start_url: "/people",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F7F5",
    theme_color: "#1F6F6B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
