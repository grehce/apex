import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { currentEmail } from "@/auth";
import { db, dbConfigured } from "@/lib/db";
import { manualEntries, accounts } from "@/lib/schema";
import { sameOrigin, validateManualEntry } from "@/lib/manual-assets";
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

export async function POST(req: Request) {
  const email = await authorize(req);
  if (email instanceof NextResponse) return email;
  let fields;
  try { fields = validateManualEntry(await req.json()); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  if (!await validMortgage(email, fields.linkedMortgageId)) return NextResponse.json({ error: "Linked mortgage not found" }, { status: 400 });
  const id = randomUUID();
  await db().insert(manualEntries).values({ id, userEmail: email, ...fields });
  await recordNetWorth(email);
  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(req: Request) {
  const email = await authorize(req);
  if (email instanceof NextResponse) return email;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || body.id.length > 100) return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
  let values;
  try {
    values = typeof body.archived === "boolean"
      ? { archived: body.archived }
      : validateManualEntry(body);
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  if ("linkedMortgageId" in values && !await validMortgage(email, values.linkedMortgageId)) return NextResponse.json({ error: "Linked mortgage not found" }, { status: 400 });
  const updated = await db().update(manualEntries).set({ ...values, updatedAt: new Date() }).where(and(eq(manualEntries.id, body.id), eq(manualEntries.userEmail, email))).returning({ id: manualEntries.id });
  if (!updated.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  await recordNetWorth(email);
  return NextResponse.json({ ok: true });
}
