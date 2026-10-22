import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { guard } from "@/lib/api";
import { db } from "@/lib/db";
import { plaidItems } from "@/lib/schema";
import { syncAll } from "@/lib/sync";

export async function POST(req: Request) {
  const g = await guard(req);
  if (g instanceof NextResponse) return g;
  // After the member finishes update mode for a flagged connection, clear its prompt before syncing.
  const body = (await req.json().catch(() => ({}))) as { resolvedItemId?: unknown };
  if (typeof body.resolvedItemId === "string") {
    await db().update(plaidItems).set({ attention: null }).where(and(eq(plaidItems.itemId, body.resolvedItemId), eq(plaidItems.userEmail, g.email)));
  }
  const results = await syncAll(g.email);
  return NextResponse.json({ results });
}
