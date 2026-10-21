import { timingSafeEqual } from "node:crypto";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { allowedEmails } from "@/auth";
import { db, dbConfigured } from "@/lib/db";
import { plaidItems } from "@/lib/schema";
import { syncTransactions } from "@/lib/initial-transactions";

export const maxDuration = 300;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || process.env.VERCEL_ENV !== "production") return Response.json({ error: "Daily retry is not configured" }, { status: 503 });
  const actual = Buffer.from(req.headers.get("authorization") ?? ""), expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!dbConfigured()) return Response.json({ error: "Database unavailable" }, { status: 503 });
  const users = [...allowedEmails()];
  if (!users.length) return Response.json({ checked: 0 });
  const due = await db().select().from(plaidItems).where(and(eq(plaidItems.status, "ok"), inArray(plaidItems.transactionsState, ["pending", "unknown"]), lte(plaidItems.transactionsRetryAt, new Date()), inArray(plaidItems.userEmail, users))).orderBy(asc(plaidItems.transactionsRetryAt)).limit(20);
  let checked = 0, pending = 0, needsAttention = 0;
  const deadline = Date.now() + 240000;
  for (let offset = 0; offset < due.length; offset += 5) {
    if (Date.now() >= deadline) break;
    await Promise.all(due.slice(offset, offset + 5).map(async (item) => {
      try { const result = await syncTransactions(item, true); checked++; if (result.pending) pending++; if (!result.ok) needsAttention++; }
      catch { needsAttention++; } // No tokens, identifiers or financial payloads in responses or logs.
    }));
  }
  return Response.json({ checked, pending, needsAttention });
}
