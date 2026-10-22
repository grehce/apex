import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { guard } from "@/lib/api";
import { plaid } from "@/lib/plaid";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { accounts, plaidItems } from "@/lib/schema";
import { isDuplicateConnection, logPlaid, type AccountKey } from "@/lib/plaid-log";
import { institutionName, recordNetWorth, syncItem } from "@/lib/sync";

function accountKeys(v: unknown): AccountKey[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 50).map((a) => {
    const x = (a ?? {}) as Record<string, unknown>;
    return { mask: typeof x.mask === "string" ? x.mask.slice(0, 8) : null, subtype: typeof x.subtype === "string" ? x.subtype.slice(0, 40) : null };
  });
}

/** The member's current connections: institution plus each account's mask and subtype. */
async function existingConnections(email: string) {
  const items = await db().select({ itemId: plaidItems.itemId, institutionId: plaidItems.institutionId, name: plaidItems.institutionName }).from(plaidItems).where(eq(plaidItems.userEmail, email));
  if (!items.length) return [];
  const accts = await db().select({ itemId: accounts.itemId, mask: accounts.mask, subtype: accounts.subtype }).from(accounts).where(inArray(accounts.itemId, items.map((i) => i.itemId)));
  return items.map((i) => ({ institutionId: i.institutionId, name: i.name, accounts: accts.filter((a) => a.itemId === i.itemId).map((a) => ({ mask: a.mask, subtype: a.subtype })) }));
}

/** Exchanges Link's public_token for an access token, stores it encrypted, and runs a first sync. */
export async function POST(req: Request) {
  const g = await guard(req);
  if (g instanceof NextResponse) return g;

  const body = (await req.json().catch(() => ({}))) as { publicToken?: string; institutionId?: unknown; accounts?: unknown; linkSessionId?: unknown };
  const { publicToken } = body;
  if (!publicToken || typeof publicToken !== "string") {
    return NextResponse.json({ error: "publicToken required" }, { status: 400 });
  }

  // Duplicate check BEFORE the exchange, from Link's onSuccess metadata: if this login is already
  // connected, the public token is simply never exchanged, so no second Item exists (or is billed).
  const existing = await existingConnections(g.email);
  const metaInst = typeof body.institutionId === "string" ? body.institutionId : null;
  const metaAccounts = accountKeys(body.accounts);
  const linkSessionId = typeof body.linkSessionId === "string" ? body.linkSessionId.slice(0, 100) : null;
  if (isDuplicateConnection(metaInst, metaAccounts, existing)) {
    const name = existing.find((e) => e.institutionId === metaInst)?.name ?? "This institution";
    logPlaid({ event: "duplicate_item", institution_id: metaInst, link_session_id: linkSessionId, note: "blocked before exchange" });
    return NextResponse.json({ error: `${name} is already connected with these accounts. Use Reconnect on it instead of adding it again.`, duplicate: true }, { status: 409 });
  }

  const ex = await plaid().itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = ex.data.access_token;
  const itemId = ex.data.item_id;
  const item = await plaid().itemGet({ access_token: accessToken });
  const instId = item.data.item.institution_id ?? null;

  // Safety net when Link's metadata was missing: compare the new Item's real accounts, and remove it at Plaid if it duplicates one.
  if (!metaAccounts.length && existing.some((e) => e.institutionId === instId)) {
    const acc = await plaid().accountsGet({ access_token: accessToken });
    const fresh = acc.data.accounts.map((a) => ({ mask: a.mask ?? null, subtype: a.subtype ? String(a.subtype) : null }));
    if (isDuplicateConnection(instId, fresh, existing)) {
      await plaid().itemRemove({ access_token: accessToken }).catch(() => {});
      const name = existing.find((e) => e.institutionId === instId)?.name ?? "This institution";
      logPlaid({ event: "duplicate_item", item_id: itemId, institution_id: instId, link_session_id: linkSessionId, note: "removed after exchange" });
      return NextResponse.json({ error: `${name} is already connected with these accounts. Use Reconnect on it instead of adding it again.`, duplicate: true }, { status: 409 });
    }
  }

  await db()
    .insert(plaidItems)
    .values({
      transactionsState: "pending",
      itemId,
      userEmail: g.email,
      accessTokenEnc: encrypt(accessToken),
      institutionId: instId,
      institutionName: await institutionName(instId),
    })
    .onConflictDoNothing();

  const [row] = await db().select().from(plaidItems).where(eq(plaidItems.itemId, itemId));
  const result = await syncItem(row);
  await recordNetWorth(g.email);
  return NextResponse.json({ itemId, synced: result.ok, transactionsPending: result.pending ?? false, error: result.error });
}
