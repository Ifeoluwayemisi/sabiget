import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sabiget.com"),
  title: {
    default: "Sabiget",
    template: "%s | Sabiget",
  },
  description:
    "Your favorite local meals, delivered fast. Discover nearby vendors, pay securely, and verify every delivery with Sabiget.",
  applicationName: "Sabiget",
  manifest: "/manifest.webmanifest",
  keywords: [
    "Sabiget",
    "food delivery",
    "Nigeria",
    "Lagos food",
    "vendors",
    "PWA",
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sabiget",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/sabiget-icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/sabiget-icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/sabiget-icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Sabiget",
    description:
      "Find trusted local meals near you, pay securely, and get every order verified on delivery.",
    siteName: "Sabiget",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sabiget",
    description:
      "Your favorite local meals, delivered fast.",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF4500",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
