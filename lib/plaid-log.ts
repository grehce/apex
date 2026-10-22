// Structured Plaid logging for troubleshooting (Plaid support asks for request_id, item_id and
// link_session_id). One JSON line per event, prefixed "[plaid]" so it's easy to filter in Vercel logs.
// Never logs access tokens, public tokens, secrets, account numbers or personal details.

export type PlaidLogFields = {
  event: string; // "api" | "api_error" | "link_exit" | "link_error" | "duplicate_item" | …
  endpoint?: string;
  status?: number;
  request_id?: string | null;
  item_id?: string | null;
  institution_id?: string | null;
  link_session_id?: string | null;
  error_type?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  duration_ms?: number;
  note?: string;
};

const SECRETISH = /(access-[a-z]+-[0-9a-f-]{8,}|public-[a-z]+-[0-9a-f-]{8,}|link-[a-z]+-[0-9a-f-]{8,}|secret|client_id)/gi;

/** Drop empty fields and scrub anything token-shaped that slipped into free text. */
export function plaidLogLine(f: PlaidLogFields): string {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || v === "") continue;
    clean[k] = typeof v === "string" ? v.replace(SECRETISH, "[redacted]").slice(0, 300) : v;
  }
  return `[plaid] ${JSON.stringify(clean)}`;
}

export function logPlaid(f: PlaidLogFields): void {
  const line = plaidLogLine(f);
  if (f.error_code || f.event.endsWith("error")) console.error(line);
  else console.info(line);
}

/** "https://production.plaid.com/transactions/sync" → "/transactions/sync" */
export function endpointOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try { return new URL(url, "https://plaid.invalid").pathname; } catch { return undefined; }
}

/** Link onExit/onEvent metadata → only the fields worth logging. */
export function linkLogFields(event: string, m: unknown): PlaidLogFields {
  const x = (m ?? {}) as Record<string, unknown>;
  const err = (x.error ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : null);
  const inst = (x.institution ?? {}) as Record<string, unknown>;
  return {
    event,
    link_session_id: s(x.link_session_id),
    request_id: s(x.request_id),
    institution_id: s(x.institution_id) ?? s(inst.institution_id),
    error_type: s(x.error_type) ?? s(err.error_type),
    error_code: s(x.error_code) ?? s(err.error_code),
    error_message: s(x.error_message) ?? s(err.error_message),
    note: s(x.status) ?? s(x.exit_status) ?? s(x.view_name) ?? undefined,
  };
}

/** A connection is a duplicate when the same institution already has an account with the same mask and subtype. */
export type AccountKey = { mask: string | null; subtype: string | null };
export function isDuplicateConnection(
  institutionId: string | null | undefined,
  incoming: AccountKey[],
  existing: { institutionId: string | null; accounts: AccountKey[] }[],
): boolean {
  if (!institutionId || incoming.length === 0) return false;
  const key = (a: AccountKey) => `${a.mask ?? ""}|${(a.subtype ?? "").toLowerCase()}`;
  const newKeys = new Set(incoming.filter((a) => a.mask).map(key));
  if (newKeys.size === 0) return false;
  return existing.some((e) => e.institutionId === institutionId && e.accounts.some((a) => a.mask && newKeys.has(key(a))));
}
