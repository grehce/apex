import "server-only";
import { NextResponse } from "next/server";
import { currentEmail } from "@/auth";
import { dbConfigured } from "./db";
import { plaidConfigured } from "./plaid";

/** Shared guard for API routes: signed in, same-origin, and the backend is configured. */
export async function guard(req: Request): Promise<{ email: string } | NextResponse> {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) {
      return NextResponse.json({ error: "bad origin" }, { status: 403 });
    }
  }
  if (!plaidConfigured() || !dbConfigured() || !process.env.ENCRYPTION_KEY) {
    return NextResponse.json({ error: "Plaid, database or encryption key not configured" }, { status: 503 });
  }
  return { email };
}
