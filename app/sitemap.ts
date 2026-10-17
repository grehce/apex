import type { MetadataRoute } from "next";

const BASE = "https://www.apexfolios.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/waitlist`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/agent`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/networth`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/portfolio`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/spending`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/signin`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
