import { NextResponse } from "next/server";
import { currentEmail } from "@/auth";
import { sameOrigin } from "@/lib/manual-assets";
import { linkLogFields, logPlaid } from "@/lib/plaid-log";

const EVENTS = new Set(["link_exit", "link_error", "link_handoff", "link_open"]);

/** Logs Link exits and errors (link_session_id, request_id, error code) for troubleshooting with Plaid. */
export async function POST(req: Request) {
  if (!(await currentEmail())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { event?: unknown; metadata?: unknown } | null;
  const event = typeof body?.event === "string" && EVENTS.has(body.event) ? body.event : null;
  if (!event) return NextResponse.json({ error: "unknown event" }, { status: 400 });
  logPlaid(linkLogFields(event, body?.metadata));
  return NextResponse.json({ ok: true });
}
