import "server-only";
import axios, { type InternalAxiosRequestConfig } from "axios";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { endpointOf, logPlaid } from "./plaid-log";

type Timed = InternalAxiosRequestConfig & { _startedAt?: number };

/** Axios instance that logs every Plaid call: endpoint, status, request_id, item_id, error code — never the body. */
function loggedAxios() {
  const ax = axios.create();
  ax.interceptors.request.use((config: Timed) => { config._startedAt = Date.now(); return config; });
  ax.interceptors.response.use(
    (res) => {
      const data = res.data as { request_id?: string; item_id?: string; item?: { item_id?: string; institution_id?: string } } | undefined;
      const cfg = res.config as Timed;
      logPlaid({ event: "api", endpoint: endpointOf(cfg.url), status: res.status, request_id: data?.request_id, item_id: data?.item_id ?? data?.item?.item_id, institution_id: data?.item?.institution_id, duration_ms: cfg._startedAt ? Date.now() - cfg._startedAt : undefined });
      return res;
    },
    (err) => {
      const cfg = (err?.config ?? {}) as Timed;
      const data = (err?.response?.data ?? {}) as { request_id?: string; error_type?: string; error_code?: string; error_message?: string };
      logPlaid({ event: "api_error", endpoint: endpointOf(cfg.url), status: err?.response?.status, request_id: data.request_id, error_type: data.error_type, error_code: data.error_code ?? err?.code, error_message: data.error_message ?? err?.message, duration_ms: cfg._startedAt ? Date.now() - cfg._startedAt : undefined });
      return Promise.reject(err);
    },
  );
  return ax;
}

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
      undefined,
      loggedAxios(),
    );
  }
  return _client;
}

/** Pull the Plaid error code out of an axios error, if there is one. */
export function plaidErrorCode(err: unknown): string | null {
  const data = (err as { response?: { data?: { error_code?: string } } })?.response?.data;
  return data?.error_code ?? null;
}
