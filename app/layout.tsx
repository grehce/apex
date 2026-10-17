import type { Metadata } from "next";
import "./globals.css";
import { THEME_BOOT } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "Apex", template: "%s · Apex" },
  description: "Every account. One clear view.",
  robots: { index: false, follow: false },
  other: { "color-scheme": "light dark" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Google+Sans:wght@500&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
