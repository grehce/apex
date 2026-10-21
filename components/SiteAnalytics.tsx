"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Only static page names are analytics data. Never send authentication URLs,
// identifiers, search parameters, fragments, or custom financial events.
const pages = new Set(["/", "/agent", "/settings", "/portfolio", "/networth", "/spending", "/ledger", "/waitlist"]);

export function safePageview(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  const url = new URL(event.url);
  if (!pages.has(url.pathname)) return null;

  // The SDK also collects document.referrer; omit a view if that URL could
  // contain authentication data or any other unrecognized path or parameters.
  if (document.referrer) {
    const referrer = new URL(document.referrer);
    if (referrer.search || referrer.hash ||
        (referrer.origin === url.origin ? !pages.has(referrer.pathname) : referrer.pathname !== "/")) return null;
  }

  return { type: "pageview", url: `${url.origin}${url.pathname}` };
}

export function SiteAnalytics() {
  return <Analytics beforeSend={safePageview} debug={false} />;
}
