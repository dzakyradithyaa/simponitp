import type { Metadata } from "next";

import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SIMPONI TP",
    template: "%s | SIMPONI TP",
  },

  description:
    "Platform pertanian presisi berbasis UAV: peta lahan, petak 1 hektare, rekomendasi, dan ekspor KML/KMZ.",

  icons: {
    icon: "/favicon.webp",
    shortcut: "/favicon.webp",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
