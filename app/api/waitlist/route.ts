import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { join, notifySheet, statusFor } from "@/lib/waitlist";

// Public endpoint (no session needed), so it validates hard and rate-limits.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const hits = new Map<string, number[]>(); // best-effort per-instance limiter

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function POST(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: "Waitlist isn't set up yet." }, { status: 503 });
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ error: "bad origin" }, { status: 403 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many tries — give it a few minutes." }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof b.website === "string" && b.website) return NextResponse.json({ ok: true }); // honeypot: quietly ignore bots
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const note = typeof b.note === "string" ? b.note.trim() : "";
  const ref = typeof b.ref === "string" && /^[A-Z0-9]{8}$/i.test(b.ref) ? b.ref : null;

  if (!name || name.length > 80) return NextResponse.json({ error: "Please add your name (80 characters max)." }, { status: 400 });
  if (!EMAIL.test(email) || email.length > 200) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  if (note.length > 500) return NextResponse.json({ error: "Keep the note under 500 characters." }, { status: 400 });

  const j = await join({ name, email, note: note || null, ref });
  const status = await statusFor(j.refCode);

  if (j.isNew) {
    await notifySheet({
      kind: "signup",
      name,
      email: email.toLowerCase(),
      note,
      refCode: j.refCode,
      referredBy: j.referredBy ?? "",
      position: status?.position ?? null,
      total: status?.total ?? null,
      at: new Date().toISOString(),
    });
  }
  return NextResponse.json({ ok: true, isNew: j.isNew, ...status });
}

/** Look up your own status by referral code (no personal data returned). */
export async function GET(req: Request) {
  if (!dbConfigured()) return NextResponse.json({ error: "not set up" }, { status: 503 });
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!/^[A-Z0-9]{8}$/i.test(code)) return NextResponse.json({ error: "bad code" }, { status: 400 });
  const s = await statusFor(code.toUpperCase());
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(s);
}
