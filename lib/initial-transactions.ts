import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import { decrypt } from "./crypto";
import { plaid, plaidErrorCode } from "./plaid";
import { plaidItems, transactions } from "./schema";
import { nextUtcDay, pullTransactionPages, retryableTransactionError } from "./transaction-readiness";

type Item = typeof plaidItems.$inferSelect;
export async function syncTransactions(item: Item, dailyOnly = false): Promise<{ ok: boolean; pending?: boolean; error?: string }> {
  const d = db(), now = new Date(), token = randomUUID();
  const due = and(inArray(plaidItems.transactionsState, ["pending", "unknown"]), lte(plaidItems.transactionsRetryAt, now));
  const [claimed] = await d.update(plaidItems).set({ transactionsLeaseToken: token, transactionsLeaseUntil: new Date(now.getTime() + 360000), transactionsRetryAt: nextUtcDay(now) }).where(and(
    eq(plaidItems.itemId, item.itemId), eq(plaidItems.userEmail, item.userEmail),
    or(isNull(plaidItems.transactionsLeaseUntil), lte(plaidItems.transactionsLeaseUntil, now)),
    dailyOnly ? due : or(and(ne(plaidItems.transactionsState, "pending"), ne(plaidItems.transactionsState, "unknown")), due),
  )).returning();
  if (!claimed) return { ok: true, pending: item.transactionsState !== "ready" };
  const ownedLease = and(eq(plaidItems.itemId, item.itemId), eq(plaidItems.userEmail, item.userEmail), eq(plaidItems.transactionsLeaseToken, token));
  try {
    const accessToken = decrypt(claimed.accessTokenEnc);
    const result = await pullTransactionPages(
      async (cursor) => (await plaid().transactionsSync({ access_token: accessToken, cursor, count: 500 }, { timeout: 10000 })).data,
      async (page) => {
        const rows = [...page.added, ...page.modified].map((t) => ({ transactionId: t.transaction_id, accountId: t.account_id, userEmail: item.userEmail, date: t.date, name: t.merchant_name ?? t.name, merchant: t.merchant_name ?? null, amount: t.amount, category: t.personal_finance_category?.primary ?? null, pending: t.pending }));
        if (rows.length) await d.insert(transactions).values(rows).onConflictDoUpdate({ target: transactions.transactionId, set: { date: sql`excluded.date`, name: sql`excluded.name`, merchant: sql`excluded.merchant`, amount: sql`excluded.amount`, category: sql`excluded.category`, pending: sql`excluded.pending` }, setWhere: eq(transactions.userEmail, item.userEmail) });
        const removed = page.removed.map((t) => t.transaction_id).filter((id): id is string => Boolean(id));
        if (removed.length) await d.delete(transactions).where(and(eq(transactions.userEmail, item.userEmail), inArray(transactions.transactionId, removed)));
      }, claimed.txCursor ?? undefined,
    );
    // A previously ready Item remains ready after a normal incremental sync. New Items require explicit readiness.
    const ready = result.complete && (result.ready || claimed.transactionsState === "ready");
    await d.update(plaidItems).set({ txCursor: result.cursor ?? null, transactionsState: ready ? "ready" : "pending", transactionsError: null }).where(ownedLease);
    return { ok: true, pending: !ready };
  } catch (error) {
    const code = plaidErrorCode(error);
    const retry = retryableTransactionError(code);
    const reconnect = code === "ITEM_LOGIN_REQUIRED" || code === "INVALID_ACCESS_TOKEN";
    await d.update(plaidItems).set({ transactionsState: retry ? "pending" : reconnect ? "action_required" : "error", transactionsError: code ?? "TEMPORARY_SYNC_FAILURE", ...(reconnect ? { status: "login_required" } : !retry ? { status: "error" } : {}) }).where(ownedLease);
    return { ok: retry, pending: retry, error: code ?? "TEMPORARY_SYNC_FAILURE" };
  } finally {
    await d.update(plaidItems).set({ transactionsLeaseUntil: null, transactionsLeaseToken: null }).where(ownedLease);
  }
}
