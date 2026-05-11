import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sabiget",
    short_name: "Sabiget",
    description:
      "Your favorite local meals, delivered fast. Install Sabiget for a faster, lighter food-ordering experience.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF7F1",
    theme_color: "#FF4500",
    orientation: "portrait",
    categories: ["food", "lifestyle", "shopping"],
    lang: "en-NG",
    icons: [
      {
        src: "/icons/sabiget-icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/sabiget-icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
