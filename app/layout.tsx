import type { Metadata } from "next";
import "./globals.css";
import { THEME_BOOT } from "@/lib/theme";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.apexfolios.com"),
  title: { default: "Apex — a financial mind, on your side", template: "%s · Apex" },
  description:
    "Apex is a personal finance agent fluent in tax, investing and trading. It reads your accounts read-only, shows your whole net worth, and proposes tax-aware plans. No commissions, no kickbacks. By invitation.",
  applicationName: "Apex",
  alternates: { canonical: "/" },
  // Social previews (link cards): short, scannable, built around the one claim competitors can't make.
  openGraph: {
    type: "website",
    url: "https://www.apexfolios.com",
    siteName: "Apex",
    title: "Every account. One expert. Zero kickbacks.",
    description: "Apex sees your whole financial picture and tells you the smartest next move, with the tax math already done.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Every account. One expert. Zero kickbacks.",
    description: "Apex sees your whole financial picture and tells you the smartest next move, with the tax math already done.",
  },
  robots: { index: true, follow: true },
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
