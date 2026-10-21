import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { guard } from "@/lib/api";
import { plaid } from "@/lib/plaid";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { plaidItems } from "@/lib/schema";
import { institutionName, recordNetWorth, syncItem } from "@/lib/sync";

/** Exchanges Link's public_token for an access token, stores it encrypted, and runs a first sync. */
export async function POST(req: Request) {
  const g = await guard(req);
  if (g instanceof NextResponse) return g;

  const { publicToken } = (await req.json().catch(() => ({}))) as { publicToken?: string };
  if (!publicToken || typeof publicToken !== "string") {
    return NextResponse.json({ error: "publicToken required" }, { status: 400 });
  }

  const ex = await plaid().itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = ex.data.access_token;
  const itemId = ex.data.item_id;
  const item = await plaid().itemGet({ access_token: accessToken });
  const instId = item.data.item.institution_id ?? null;

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
