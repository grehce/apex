import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { waitlist } from "./schema";

/** Each friend who joins with your link moves you up this many spots. */
export const SPOTS_PER_REFERRAL = 5;

export type WaitlistStatus = { position: number; total: number; referrals: number; refCode: string };

function newCode() {
  // 8 chars, no look-alikes (0/O, 1/I/L)
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const b = randomBytes(8);
  return Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
}

export async function statusFor(refCode: string): Promise<WaitlistStatus | null> {
  const rows = await db().select({ refCode: waitlist.refCode, referredBy: waitlist.referredBy, createdAt: waitlist.createdAt }).from(waitlist);
  const me = rows.find((r) => r.refCode === refCode);
  if (!me) return null;
  const refs = new Map<string, number>();
  for (const r of rows) if (r.referredBy) refs.set(r.referredBy, (refs.get(r.referredBy) ?? 0) + 1);
  // Order by join time; referrals move you up. Ties keep join order.
  const ranked = rows
    .map((r, i) => ({ code: r.refCode, i, t: r.createdAt.getTime(), boost: (refs.get(r.refCode) ?? 0) * SPOTS_PER_REFERRAL }))
    .sort((a, b) => a.t - b.t)
    .map((r, idx) => ({ ...r, score: idx - r.boost }))
    .sort((a, b) => a.score - b.score || a.t - b.t);
  const position = ranked.findIndex((r) => r.code === refCode) + 1;
  return { position, total: rows.length, referrals: refs.get(refCode) ?? 0, refCode };
}

export async function totalWaiting(): Promise<number> {
  const rows = await db().select({ e: waitlist.email }).from(waitlist);
  return rows.length;
}

export async function join(input: { name: string; email: string; note: string | null; ref: string | null }) {
  const email = input.email.trim().toLowerCase();
  const [existing] = await db().select().from(waitlist).where(eq(waitlist.email, email));
  if (existing) return { isNew: false, refCode: existing.refCode, referredBy: existing.referredBy };

  let referredBy: string | null = null;
  if (input.ref) {
    const [r] = await db().select({ c: waitlist.refCode }).from(waitlist).where(eq(waitlist.refCode, input.ref.toUpperCase()));
    referredBy = r?.c ?? null;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const refCode = newCode();
    try {
      await db().insert(waitlist).values({ email, name: input.name.trim(), note: input.note?.trim() || null, refCode, referredBy });
      return { isNew: true, refCode, referredBy };
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  throw new Error("unreachable");
}

/** Forward a new sign-up to the Google Apps Script that writes the Sheet and emails you. Never throws. */
export async function notifySheet(payload: Record<string, unknown>) {
  const url = process.env.WAITLIST_WEBHOOK_URL;
  if (!url) return { ok: false, reason: "no webhook configured" };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return { ok: r.ok, reason: r.ok ? undefined : `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
