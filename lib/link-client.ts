// Browser helpers for Plaid Link: what to send with the exchange, and best-effort event logging.
type Meta = { institution?: { institution_id?: string | null } | null; accounts?: { mask?: string | null; subtype?: string | null }[]; link_session_id?: string } | null | undefined;

/** Only what the server needs to spot a duplicate connection before exchanging the token. */
export function exchangeBody(publicToken: string | null, metadata: Meta) {
  return {
    publicToken,
    institutionId: metadata?.institution?.institution_id ?? null,
    accounts: (metadata?.accounts ?? []).map((a) => ({ mask: a.mask ?? null, subtype: a.subtype ?? null })),
    linkSessionId: metadata?.link_session_id ?? null,
  };
}

/** Fire-and-forget: Link exits/errors go to the server log with link_session_id and request_id. */
export function logLinkEvent(event: "link_exit" | "link_error" | "link_handoff" | "link_open", metadata: unknown) {
  try {
    void fetch("/api/plaid/link-event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, metadata }), keepalive: true }).catch(() => {});
  } catch { /* never block the UI on logging */ }
}
