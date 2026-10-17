import { NextResponse } from "next/server";
import { currentEmail } from "@/auth";
import { dbConfigured } from "@/lib/db";
import { createToken, listTokens } from "@/lib/tokens";

async function session(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (req.method !== "GET") {
    const origin = req.headers.get("origin"), host = req.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  return { email };
}

/** List your active read-only API keys (never the keys themselves). */
export async function GET(req: Request) {
  const s = await session(req);
  if (s instanceof NextResponse) return s;
  return NextResponse.json({ tokens: await listTokens(s.email) });
}

/** Create a read-only API key. The full key is in this response only. */
export async function POST(req: Request) {
  const s = await session(req);
  if (s instanceof NextResponse) return s;
  const b = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "Give the key a name, like “Muse” or “Claude”." }, { status: 400 });
  try {
    return NextResponse.json(await createToken(s.email, name));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
