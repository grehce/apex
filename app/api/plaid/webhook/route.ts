import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, dbConfigured } from "@/lib/db";
import { plaid, plaidConfigured } from "@/lib/plaid";
import { plaidItems } from "@/lib/schema";
import { logPlaid } from "@/lib/plaid-log";
import { planWebhook, verifyPlaidWebhook, type PlaidJwk } from "@/lib/plaid-webhook";
import { recordNetWorth, syncItem } from "@/lib/sync";

export const maxDuration = 60;

// Verification keys by kid. Plaid rotates keys rarely; a key is re-fetched if unknown or after an hour.
const keys = new Map<string, { jwk: PlaidJwk; at: number }>();
async function getKey(kid: string): Promise<PlaidJwk | null> {
  const hit = keys.get(kid);
  if (hit && Date.now() - hit.at < 3600_000) return hit.jwk;
  try {
    const r = await plaid().webhookVerificationKeyGet({ key_id: kid });
    const jwk = r.data.key as unknown as PlaidJwk;
    keys.set(kid, { jwk, at: Date.now() });
    return jwk;
  } catch {
    return null;
  }
}

/**
 * Plaid → Apex webhooks. Public (no session) but every request must carry a valid Plaid signature over
 * this exact body. Unknown Items are acknowledged and ignored. Always answers quickly with 200 once
 * verified so Plaid doesn't retry work we've already done.
 */
export async function POST(req: Request) {
  if (!plaidConfigured() || !dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const raw = await req.text();
  const check = await verifyPlaidWebhook(raw, req.headers.get("plaid-verification"), getKey);
  if (!check.ok) {
    logPlaid({ event: "webhook_rejected", note: check.reason });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let body: { webhook_type?: string; webhook_code?: string; item_id?: string; error?: { error_code?: string } | null; environment?: string };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const action = planWebhook(body);
  logPlaid({ event: "webhook", item_id: body.item_id, note: `${body.webhook_type}:${body.webhook_code} → ${action.kind}`, error_code: body.error?.error_code });

  const d = db();
  const [item] = body.item_id ? await d.select().from(plaidItems).where(eq(plaidItems.itemId, body.item_id)) : [];
  if (!item) return NextResponse.json({ ok: true, ignored: "unknown item" });
  await d.update(plaidItems).set({ lastWebhookAt: new Date() }).where(eq(plaidItems.itemId, item.itemId));

  if (action.kind === "sync") {
    await syncItem(item);
    await recordNetWorth(item.userEmail);
  } else if (action.kind === "attention") {
    await d.update(plaidItems).set({ attention: action.attention, ...(action.attention === "login_required" ? { status: "login_required" } : {}) }).where(eq(plaidItems.itemId, item.itemId));
  } else if (action.kind === "repaired") {
    await d.update(plaidItems).set({ attention: null, status: "ok" }).where(eq(plaidItems.itemId, item.itemId));
  }
  return NextResponse.json({ ok: true, action: action.kind });
}
