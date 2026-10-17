import { NextResponse } from "next/server";
import { currentEmail } from "@/auth";
import { revokeToken } from "@/lib/tokens";

/** Revoke one of your keys. Takes effect immediately. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const { id } = await params;
  if (!/^[a-f0-9]{16}$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await revokeToken(email, id);
  return NextResponse.json({ ok: true });
}
