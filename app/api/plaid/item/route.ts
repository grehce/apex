import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { guard } from "@/lib/api";
import { plaid } from "@/lib/plaid";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { accounts, holdings, plaidItems, transactions } from "@/lib/schema";
import { recordNetWorth } from "@/lib/sync";

/** Disconnect an institution: revoke at Plaid, then erase its data here. */
export async function DELETE(req: Request) {
  const g = await guard(req);
  if (g instanceof NextResponse) return g;
  const { itemId } = (await req.json().catch(() => ({}))) as { itemId?: string };
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const d = db();
  const [item] = await d
    .select()
    .from(plaidItems)
    .where(and(eq(plaidItems.itemId, itemId), eq(plaidItems.userEmail, g.email)));
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    await plaid().itemRemove({ access_token: decrypt(item.accessTokenEnc) });
  } catch {
    // Still erase local data if Plaid already forgot the item.
  }
  const accts = await d.select({ id: accounts.accountId }).from(accounts).where(eq(accounts.itemId, itemId));
  const ids = accts.map((a) => a.id);
  if (ids.length) {
    await d.delete(holdings).where(inArray(holdings.accountId, ids));
    await d.delete(transactions).where(inArray(transactions.accountId, ids));
    await d.delete(accounts).where(inArray(accounts.accountId, ids));
  }
  await d.delete(plaidItems).where(eq(plaidItems.itemId, itemId));
  await recordNetWorth(g.email);
  return NextResponse.json({ ok: true });
}

/** Toggle whether an account counts toward net worth. */
export async function PATCH(req: Request) {
  const g = await guard(req);
  if (g instanceof NextResponse) return g;
  const { accountId, include } = (await req.json().catch(() => ({}))) as { accountId?: string; include?: boolean };
  if (!accountId || typeof include !== "boolean") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const updated = await db()
    .update(accounts)
    .set({ includeInNetWorth: include })
    .where(and(eq(accounts.accountId, accountId), eq(accounts.userEmail, g.email)))
    .returning({ id: accounts.accountId });
  if (!updated.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  try { await recordNetWorth(g.email); }
  catch { return NextResponse.json({ ok: true, warning: "Inclusion saved. Net-worth history will update on the next successful sync." }); }
  return NextResponse.json({ ok: true });
}
