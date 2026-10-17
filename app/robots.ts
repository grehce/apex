import type { MetadataRoute } from "next";

// Public pages are open to search engines and AI assistants (ChatGPT, Claude, Perplexity, Gemini…)
// so they can find and describe Apex. Private plumbing stays out.
const PRIVATE = ["/api/", "/oauth"];
const PUBLIC_API = ["/api/v1/openapi.json"];
const AI_BOTS = [
  "OAI-SearchBot", "ChatGPT-User", "GPTBot",          // OpenAI
  "Claude-SearchBot", "Claude-User", "ClaudeBot",      // Anthropic
  "PerplexityBot", "Perplexity-User",                  // Perplexity
  "Google-Extended", "Applebot-Extended",              // Gemini / Apple Intelligence
  "Meta-ExternalAgent",                                // Meta AI
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", ...PUBLIC_API], disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: ["/", ...PUBLIC_API], disallow: PRIVATE },
    ],
    sitemap: "https://www.apexfolios.com/sitemap.xml",
    host: "https://www.apexfolios.com",
  };
}
