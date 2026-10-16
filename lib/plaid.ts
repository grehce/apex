import "server-only";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

let _client: PlaidApi | null = null;

export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function plaidEnv(): "sandbox" | "production" {
  return process.env.PLAID_ENV === "production" ? "production" : "sandbox";
}

export function plaid(): PlaidApi {
  if (!_client) {
    if (!plaidConfigured()) throw new Error("PLAID_CLIENT_ID / PLAID_SECRET are not set");
    _client = new PlaidApi(
      new Configuration({
        basePath: PlaidEnvironments[plaidEnv()],
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
            "PLAID-SECRET": process.env.PLAID_SECRET!,
          },
        },
      }),
    );
  }
  return _client;
}

/** Pull the Plaid error code out of an axios error, if there is one. */
export function plaidErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: { error_code?: string } } })?.response?.data;
  return data?.error_code ?? null;
}
