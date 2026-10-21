import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { CountryCode, Products } from "plaid";
import { guard } from "@/lib/api";
import { plaid, plaidEnv } from "@/lib/plaid";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { plaidItems } from "@/lib/schema";
import { createHash } from "node:crypto";

/** Creates a short-lived Link token. Pass { itemId } to open Link in update mode (reconnect). */
export async function POST(req: Request) {
  const g = await guard(req);
  if (g instanceof NextResponse) return g;

  const body = (await req.json().catch(() => ({}))) as { itemId?: string };
  // Plaid wants a stable, non-PII user id.
  const clientUserId = createHash("sha256").update(g.email).digest("hex").slice(0, 32);

  let accessToken: string | undefined;
  if (body.itemId) {
    const [item] = await db()
      .select()
      .from(plaidItems)
      .where(and(eq(plaidItems.itemId, body.itemId), eq(plaidItems.userEmail, g.email)));
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    accessToken = decrypt(item.accessTokenEnc);
  }

  const r = await plaid().linkTokenCreate({
    user: { client_user_id: clientUserId },
    client_name: "Apex",
    language: "en",
    country_codes: [CountryCode.Us],
    // Banks like Chase and Bank of America sign in on their own site, then send the user back here.
    // Must exactly match a redirect URI registered in the Plaid Dashboard.
    ...(plaidEnv() === "production" ? { redirect_uri: process.env.PLAID_REDIRECT_URI || `${new URL(req.url).origin}/oauth` } : {}),
    ...(accessToken
      ? { access_token: accessToken }
      // Liabilities is consent-only here: Plaid bills it only once /liabilities/get is called,
      // and sync calls it only on Items that actually hold a mortgage.
      : { products: [Products.Transactions], optional_products: [Products.Investments], additional_consented_products: [Products.Liabilities] }),
  });
  return NextResponse.json({ linkToken: r.data.link_token });
}
