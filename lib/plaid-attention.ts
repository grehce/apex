// Why a Plaid connection needs the member. Pure and client-safe (no node:crypto), so Settings can import it.

/** Why a connection needs the member: shown in Settings with a Reconnect button that opens update mode. */
export type Attention = "login_required" | "pending_expiration" | "pending_disconnect" | "new_accounts" | "revoked";

/** Member-facing copy for each attention state. */
export const ATTENTION_COPY: Record<Attention, string> = {
  login_required: "login expired — reconnect",
  pending_expiration: "access expires soon — reconnect to keep it",
  pending_disconnect: "disconnecting soon — reconnect to keep it",
  new_accounts: "new accounts available — add them",
  revoked: "access was revoked at the bank — reconnect or disconnect",
};

