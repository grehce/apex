import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { currentEmail } from "@/auth";
import { db, dbConfigured } from "@/lib/db";
import { manualEntries, accounts, propertyValuations } from "@/lib/schema";
import { encrypt } from "@/lib/crypto";
import { sameOrigin, validateManualEntry, validateResetDate } from "@/lib/manual-assets";
import { recordNetWorth } from "@/lib/sync";

async function authorize(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (!dbConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  return email;
}

async function validMortgage(email: string, linkedMortgageId: string | null) {
  if (!linkedMortgageId) return true;
  const rows = await db().select({ id: accounts.accountId }).from(accounts).where(and(eq(accounts.accountId, linkedMortgageId), eq(accounts.userEmail, email), eq(accounts.subtype, "mortgage")));
  return rows.length === 1;
}

type Fields = ReturnType<typeof validateManualEntry>;

/** Database columns for a validated entry: the address is encrypted, homes get a valuation timestamp. */
function columns(fields: Fields) {
  const { address, ...rest } = fields;
  const home = fields.kind === "asset" && fields.category === "property";
  return { ...rest, addressEnc: address ? encrypt(JSON.stringify(address)) : null, lastValuedAt: home ? new Date() : null };
}

/** One history point per home per day, so revaluations show up in the net worth chart as they happen. */
async function recordValuation(email: string, entryId: string, fields: Fields) {
  if (fields.kind !== "asset" || fields.category !== "property") return;
  const row = { entryId, userEmail: email, day: new Date().toISOString().slice(0, 10), value: fields.value, low: fields.estimateLow, high: fields.estimateHigh, source: fields.valuationSource };
  await db().insert(propertyValuations).values(row).onConflictDoUpdate({ target: [propertyValuations.entryId, propertyValuations.day], set: row });
}

export async function POST(req: Request) {
  const email = await authorize(req);
  if (email instanceof NextResponse) return email;
  let fields;
  try { fields = validateManualEntry(await req.json()); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  if (!await validMortgage(email, fields.linkedMortgageId)) return NextResponse.json({ error: "Linked mortgage not found" }, { status: 400 });
  const id = randomUUID();
  await db().insert(manualEntries).values({ id, userEmail: email, ...columns(fields) });
  await recordValuation(email, id, fields);
  await recordNetWorth(email);
  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(req: Request) {
  const email = await authorize(req);
  if (email instanceof NextResponse) return email;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || body.id.length > 100) return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
  // Just the mortgage reset date on a home: { id, rateResetDate }.
  if ("rateResetDate" in body && Object.keys(body).length === 2) {
    let rateResetDate;
    try { rateResetDate = validateResetDate(body.rateResetDate); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
    const done = await db().update(manualEntries).set({ rateResetDate, updatedAt: new Date() }).where(and(eq(manualEntries.id, body.id), eq(manualEntries.userEmail, email), eq(manualEntries.category, "property"))).returning({ id: manualEntries.id });
    if (!done.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  let fields: Fields | null = null;
  try { if (typeof body.archived !== "boolean") fields = validateManualEntry(body); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  if (fields && !await validMortgage(email, fields.linkedMortgageId)) return NextResponse.json({ error: "Linked mortgage not found" }, { status: 400 });
  const values = fields ? columns(fields) : { archived: body.archived as boolean };
  const updated = await db().update(manualEntries).set({ ...values, updatedAt: new Date() }).where(and(eq(manualEntries.id, body.id), eq(manualEntries.userEmail, email))).returning({ id: manualEntries.id });
  if (!updated.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (fields) await recordValuation(email, body.id, fields);
  await recordNetWorth(email);
  return NextResponse.json({ ok: true });
}
