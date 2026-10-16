import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { CountryCode } from "plaid";
import { db } from "./db";
import { decrypt } from "./crypto";
import { plaid, plaidErrorCode } from "./plaid";
import { accounts, holdings, netWorthDaily, plaidItems, transactions } from "./schema";

type Item = typeof plaidItems.$inferSelect;

export async function institutionName(institutionId: string | null | undefined): Promise<string> {
  if (!institutionId) return "Unknown institution";
  try {
    const r = await plaid().institutionsGetById({ institution_id: institutionId, country_codes: [CountryCode.Us] });
    return r.data.institution.name;
  } catch {
    return "Unknown institution";
  }
}

/** Pull accounts, holdings and new transactions for one Item and store them. */
export async function syncItem(item: Item): Promise<{ ok: boolean; error?: string }> {
  const accessToken = decrypt(item.accessTokenEnc);
  const d = db();
  try {
    // Accounts + cached balances
    const acc = await plaid().accountsGet({ access_token: accessToken });
    for (const a of acc.data.accounts) {
      const row = {
        accountId: a.account_id,
        itemId: item.itemId,
        userEmail: item.userEmail,
        name: a.name,
        officialName: a.official_name ?? null,
        mask: a.mask ?? null,
        type: String(a.type),
        subtype: a.subtype ? String(a.subtype) : null,
        balanceCurrent: a.balances.current ?? null,
        balanceAvailable: a.balances.available ?? null,
        currency: a.balances.iso_currency_code ?? null,
        updatedAt: new Date(),
      };
      await d.insert(accounts).values(row).onConflictDoUpdate({
        target: accounts.accountId,
        set: { ...row, includeInNetWorth: sql`${accounts.includeInNetWorth}` },
      });
    }

    // Investment holdings (only if this Item has investment accounts)
    if (acc.data.accounts.some((a) => String(a.type) === "investment")) {
      try {
        const h = await plaid().investmentsHoldingsGet({ access_token: accessToken });
        const secs = new Map(h.data.securities.map((s) => [s.security_id, s]));
        const ids = acc.data.accounts.map((a) => a.account_id);
        await d.delete(holdings).where(inArray(holdings.accountId, ids));
        if (h.data.holdings.length) {
          await d.insert(holdings).values(
            h.data.holdings.map((x) => {
              const s = secs.get(x.security_id);
              return {
                accountId: x.account_id,
                securityId: x.security_id,
                userEmail: item.userEmail,
                ticker: s?.ticker_symbol ?? null,
                name: s?.name ?? null,
                securityType: s?.type ?? null,
                quantity: x.quantity,
                value: x.institution_value,
                costBasis: x.cost_basis ?? null,
              };
            }),
          );
        }
      } catch (e) {
        const code = plaidErrorCode(e);
        if (code !== "PRODUCTS_NOT_SUPPORTED" && code !== "NO_INVESTMENT_ACCOUNTS" && code !== "PRODUCT_NOT_READY") throw e;
      }
    }

    // Transactions via /transactions/sync with a stored cursor
    let cursor = item.txCursor ?? undefined;
    for (let page = 0; page < 20; page++) {
      let r;
      try {
        r = await plaid().transactionsSync({ access_token: accessToken, cursor, count: 500 });
      } catch (e) {
        if (plaidErrorCode(e) === "PRODUCT_NOT_READY") break;
        throw e;
      }
      const upserts = [...r.data.added, ...r.data.modified].map((t) => ({
        transactionId: t.transaction_id,
        accountId: t.account_id,
        userEmail: item.userEmail,
        date: t.date,
        name: t.name,
        merchant: t.merchant_name ?? null,
        amount: t.amount,
        category: t.personal_finance_category?.primary ?? null,
        pending: t.pending,
      }));
      for (const row of upserts) {
        await d.insert(transactions).values(row).onConflictDoUpdate({ target: transactions.transactionId, set: row });
      }
      const removed = r.data.removed.map((x) => x.transaction_id).filter(Boolean) as string[];
      if (removed.length) await d.delete(transactions).where(inArray(transactions.transactionId, removed));
      cursor = r.data.next_cursor;
      if (!r.data.has_more) break;
    }

    await d
      .update(plaidItems)
      .set({ txCursor: cursor ?? null, status: "ok", lastSyncedAt: new Date() })
      .where(eq(plaidItems.itemId, item.itemId));
    return { ok: true };
  } catch (e) {
    const code = plaidErrorCode(e);
    const status = code === "ITEM_LOGIN_REQUIRED" ? "login_required" : "error";
    await d.update(plaidItems).set({ status }).where(eq(plaidItems.itemId, item.itemId));
    return { ok: false, error: code ?? "SYNC_FAILED" };
  }
}

export async function recordNetWorth(email: string): Promise<void> {
  const d = db();
  const rows = await d
    .select()
    .from(accounts)
    .where(and(eq(accounts.userEmail, email), eq(accounts.includeInNetWorth, true)));
  const value = rows.reduce((sum, a) => sum + signedBalance(a.type, a.balanceCurrent), 0);
  const day = new Date().toISOString().slice(0, 10);
  await d
    .insert(netWorthDaily)
    .values({ userEmail: email, day, value })
    .onConflictDoUpdate({ target: [netWorthDaily.userEmail, netWorthDaily.day], set: { value } });
}

export function signedBalance(type: string, current: number | null): number {
  const v = current ?? 0;
  return type === "credit" || type === "loan" ? -v : v;
}

export async function syncAll(email: string) {
  const items = await db().select().from(plaidItems).where(eq(plaidItems.userEmail, email));
  const results = [];
  for (const item of items) results.push({ itemId: item.itemId, ...(await syncItem(item)) });
  await recordNetWorth(email);
  return results;
}
