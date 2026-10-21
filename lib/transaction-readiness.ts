import type { TransactionsSyncResponse } from "plaid";

export const DAY_MS = 86400000;
export function nextUtcDay(now = new Date()) { return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)); }
export function transactionsReady(status: string | undefined) { return status === "INITIAL_UPDATE_COMPLETE" || status === "HISTORICAL_UPDATE_COMPLETE"; }
export function retryableTransactionError(code: string | null) {
  return code === null || ["PRODUCT_NOT_READY", "INSTITUTION_DOWN", "INSTITUTION_NOT_RESPONDING", "INTERNAL_SERVER_ERROR", "RATE_LIMIT_EXCEEDED", "SYNC_UPDATES_DURING_PAGINATION"].includes(code);
}

/** Cursor advances only after successful writes. Replays safely use transaction-ID upserts/removals. */
export async function pullTransactionPages(fetchPage: (cursor?: string) => Promise<TransactionsSyncResponse>, applyPage: (page: TransactionsSyncResponse) => Promise<void>, startCursor?: string, budgetMs = 45000) {
  const deadline = Date.now() + budgetMs;
  let cursor = startCursor;
  let status: string | undefined;
  let complete = false;
  let restarts = 0;
  for (let page = 0; page < 20 && Date.now() < deadline; page++) {
    let response;
    try { response = await fetchPage(cursor); }
    catch (e) {
      const code = (e as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
      if (code === "SYNC_UPDATES_DURING_PAGINATION" && restarts++ < 2) { cursor = startCursor; page = -1; continue; }
      throw e;
    }
    await applyPage(response);
    cursor = response.next_cursor;
    status = response.transactions_update_status;
    if (!response.has_more) { complete = true; break; }
  }
  return { cursor, ready: complete && transactionsReady(status), complete };
}
