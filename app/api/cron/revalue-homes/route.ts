import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, dbConfigured } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { manualEntries, propertyValuations } from "@/lib/schema";
import { needsRevalue, validateAddress } from "@/lib/property";
import { valuationProvider } from "@/lib/valuation";
import { recordNetWorth } from "@/lib/sync";

export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return Boolean(secret) && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/**
 * Vercel Cron, daily. Re-estimates homes on automatic valuation whose last estimate is 30+ days old,
 * so each home costs about one provider request a month. Homes valued by hand are never touched.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const provider = valuationProvider();
  if (!provider || !dbConfigured()) return NextResponse.json({ skipped: "not configured" });
  const d = db();
  const homes = await d.select().from(manualEntries).where(and(eq(manualEntries.valuationSource, "estimate"), eq(manualEntries.archived, false)));
  const due = homes.filter((h) => h.addressEnc && needsRevalue(h.lastValuedAt)).slice(0, 25);
  const today = new Date().toISOString().slice(0, 10);
  const touched = new Set<string>();
  let updated = 0, failed = 0;
  for (const h of due) {
    try {
      const est = await provider.estimate(validateAddress(JSON.parse(decrypt(h.addressEnc!))));
      if (!est) { failed++; continue; } // keep the last good value; try again tomorrow
      await d.update(manualEntries).set({ value: est.value, estimateLow: est.low, estimateHigh: est.high, estimateComps: est.comps, valuationProvider: est.provider, valuationDate: today, lastValuedAt: new Date(), updatedAt: new Date() }).where(eq(manualEntries.id, h.id));
      const row = { entryId: h.id, userEmail: h.userEmail, day: today, value: est.value, low: est.low, high: est.high, source: "estimate" };
      await d.insert(propertyValuations).values(row).onConflictDoUpdate({ target: [propertyValuations.entryId, propertyValuations.day], set: row });
      touched.add(h.userEmail);
      updated++;
    } catch {
      failed++;
    }
  }
  for (const email of touched) await recordNetWorth(email);
  return NextResponse.json({ due: due.length, updated, failed });
}
