import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { allowedEmails } from "@/auth";
import { db, dbConfigured } from "./db";
import { apiTokens } from "./schema";

const MAX_TOKENS = 10;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Creates a key. The full token is returned once and never stored. */
export async function createToken(email: string, name: string) {
  const live = await db().select({ id: apiTokens.id }).from(apiTokens).where(and(eq(apiTokens.userEmail, email), isNull(apiTokens.revokedAt)));
  if (live.length >= MAX_TOKENS) throw new Error(`You can have up to ${MAX_TOKENS} active keys. Revoke one first.`);
  const token = `apex_ro_${randomBytes(24).toString("base64url")}`;
  const id = randomBytes(8).toString("hex");
  await db().insert(apiTokens).values({ id, userEmail: email, name, tokenHash: hash(token), prefix: token.slice(0, 12) });
  return { id, token, prefix: token.slice(0, 12) };
}

export async function listTokens(email: string) {
  const rows = await db().select().from(apiTokens).where(and(eq(apiTokens.userEmail, email), isNull(apiTokens.revokedAt)));
  return rows
    .sort((a, b) => +b.createdAt - +a.createdAt)
    .map((r) => ({ id: r.id, name: r.name, prefix: r.prefix, createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt?.toISOString() ?? null }));
}

export async function revokeToken(email: string, id: string) {
  await db().update(apiTokens).set({ revokedAt: new Date() }).where(and(eq(apiTokens.id, id), eq(apiTokens.userEmail, email)));
}

// Simple per-key rate limit (per server instance): 120 requests a minute.
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 120;
}

/** Guard for /api/v1: a valid, unrevoked key whose owner is still on the access list. */
export async function bearer(req: Request): Promise<{ email: string } | NextResponse> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const fail = (status: number, error: string) =>
    NextResponse.json({ error }, { status, headers: status === 401 ? { "www-authenticate": 'Bearer realm="apex"' } : {} });
  if (!token.startsWith("apex_ro_")) return fail(401, "Missing or malformed API key. Send 'Authorization: Bearer apex_ro_…'.");
  if (!dbConfigured()) return fail(503, "not configured");
  const [row] = await db().select().from(apiTokens).where(eq(apiTokens.tokenHash, hash(token)));
  if (!row || row.revokedAt) return fail(401, "Invalid or revoked API key.");
  if (!allowedEmails().has(row.userEmail)) return fail(403, "This account no longer has access.");
  if (limited(row.id)) return fail(429, "Too many requests. Limit is 120 per minute.");
  // Best-effort "last used" stamp, at most once a minute.
  if (!row.lastUsedAt || Date.now() - +row.lastUsedAt > 60_000) {
    await db().update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id)).catch(() => {});
  }
  return { email: row.userEmail };
}

export const API_HEADERS = { "cache-control": "no-store", "x-robots-tag": "noindex" };
