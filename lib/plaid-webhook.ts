// Plaid webhooks: signature verification and what each webhook means for Apex.
// Pure (no network, no database) so both halves are unit-testable; the route supplies the key lookup.
//
// Verification follows Plaid's spec: the Plaid-Verification header is an ES256 JWT whose key id (kid)
// resolves via /webhook_verification_key/get; its payload carries iat (must be < 5 min old) and
// request_body_sha256, which must match the SHA-256 of the raw request body.
import { createHash, createPublicKey, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";

export type PlaidJwk = JsonWebKey & { kid?: string; expired_at?: number | null; created_at?: number };
export type VerifyResult = { ok: true } | { ok: false; reason: string };

const b64urlJson = (s: string) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

export async function verifyPlaidWebhook(rawBody: string, jwt: string | null, getKey: (kid: string) => Promise<PlaidJwk | null>, now = Date.now()): Promise<VerifyResult> {
  if (!jwt) return { ok: false, reason: "missing Plaid-Verification header" };
  const parts = jwt.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed token" };
  let header: { alg?: string; kid?: string }, payload: { iat?: number; request_body_sha256?: string };
  try { header = b64urlJson(parts[0]); payload = b64urlJson(parts[1]); } catch { return { ok: false, reason: "malformed token" }; }
  if (header.alg !== "ES256") return { ok: false, reason: "unexpected algorithm" };
  if (!header.kid) return { ok: false, reason: "missing key id" };
  const jwk = await getKey(header.kid);
  if (!jwk) return { ok: false, reason: "unknown key" };
  if (jwk.expired_at && jwk.expired_at * 1000 < now) return { ok: false, reason: "expired key" };
  let signatureOk = false;
  try {
    const key = createPublicKey({ key: jwk, format: "jwk" });
    signatureOk = verify("sha256", Buffer.from(`${parts[0]}.${parts[1]}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(parts[2], "base64url"));
  } catch { signatureOk = false; }
  if (!signatureOk) return { ok: false, reason: "bad signature" };
  if (typeof payload.iat !== "number" || now - payload.iat * 1000 > 5 * 60 * 1000 || payload.iat * 1000 - now > 60 * 1000) return { ok: false, reason: "stale or future token" };
  const want = Buffer.from(String(payload.request_body_sha256 ?? ""), "utf8");
  const got = Buffer.from(createHash("sha256").update(rawBody, "utf8").digest("hex"), "utf8");
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, reason: "body hash mismatch" };
  return { ok: true };
}

import type { Attention } from "./plaid-attention";
export { ATTENTION_COPY, type Attention } from "./plaid-attention";

export type WebhookAction =
  | { kind: "sync" } // new data is ready — pull it
  | { kind: "attention"; attention: Attention }
  | { kind: "repaired" } // login fixed elsewhere — clear the prompt
  | { kind: "ack" } // webhook URL registered
  | { kind: "ignore" };

export function planWebhook(body: { webhook_type?: string; webhook_code?: string; error?: { error_code?: string } | null }): WebhookAction {
  const type = body.webhook_type ?? "", code = body.webhook_code ?? "";
  if (type === "TRANSACTIONS" && ["SYNC_UPDATES_AVAILABLE", "INITIAL_UPDATE", "HISTORICAL_UPDATE", "DEFAULT_UPDATE"].includes(code)) return { kind: "sync" };
  if ((type === "HOLDINGS" || type === "INVESTMENTS_TRANSACTIONS" || type === "LIABILITIES") && code === "DEFAULT_UPDATE") return { kind: "sync" };
  if (type === "ITEM") {
    if (code === "ERROR") return body.error?.error_code === "ITEM_LOGIN_REQUIRED" ? { kind: "attention", attention: "login_required" } : { kind: "ignore" };
    if (code === "PENDING_EXPIRATION") return { kind: "attention", attention: "pending_expiration" };
    if (code === "PENDING_DISCONNECT") return { kind: "attention", attention: "pending_disconnect" };
    if (code === "NEW_ACCOUNTS_AVAILABLE") return { kind: "attention", attention: "new_accounts" };
    if (code === "USER_PERMISSION_REVOKED" || code === "USER_ACCOUNT_REVOKED") return { kind: "attention", attention: "revoked" };
    if (code === "LOGIN_REPAIRED") return { kind: "repaired" };
    if (code === "WEBHOOK_UPDATE_ACKNOWLEDGED") return { kind: "ack" };
  }
  return { kind: "ignore" };
}

/** Where Plaid should send webhooks: PLAID_WEBHOOK_URL, else the production site in production. */
export function webhookUrl(env: Record<string, string | undefined> = process.env): string | null {
  if (env.PLAID_WEBHOOK_URL) return env.PLAID_WEBHOOK_URL;
  return env.PLAID_ENV === "production" ? "https://www.apexfolios.com/api/plaid/webhook" : null;
}
