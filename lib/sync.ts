import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { CountryCode } from "plaid";
import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import { plaid, plaidErrorCode } from "./plaid";
import { accounts, holdings, netWorthDaily, plaidItems, transactions, manualEntries, mortgageDetails } from "./schema";
import { fromPlaidAddress } from "./property";
import { netWorthTotal } from "./net-worth";
import { syncTransactions } from "./initial-transactions";
import type { ManualEntry } from "./manual-assets";

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
export async function syncItem(item: Item): Promise<{ ok: boolean; error?: string; pending?: boolean }> {
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

    // Mortgage details (Plaid Liabilities) — only for Items that hold a mortgage, so other Items never
    // pick up the Liabilities subscription. Best-effort: older Items may not have consented.
    // Set PLAID_LIABILITIES=off to stop these calls (e.g. on a paid Plaid plan where Liabilities is billed).
    if (process.env.PLAID_LIABILITIES !== "off" && acc.data.accounts.some((a) => String(a.subtype) === "mortgage")) await syncMortgages(item, accessToken);

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

    const transactionResult = await syncTransactions(item);
    if (!transactionResult.ok) return transactionResult;

    await d
      .update(plaidItems)
      .set({ status: "ok", lastSyncedAt: new Date() })
      .where(eq(plaidItems.itemId, item.itemId));
    return { ok: true, pending: transactionResult.pending };
  } catch (e) {
    const code = plaidErrorCode(e);
    const status = code === "ITEM_LOGIN_REQUIRED" ? "login_required" : "error";
    await d.update(plaidItems).set({ status }).where(eq(plaidItems.itemId, item.itemId));
    return { ok: false, error: code ?? "SYNC_FAILED" };
  }
}

async function syncMortgages(item: Item, accessToken: string): Promise<void> {
  let r;
  try {
    r = await plaid().liabilitiesGet({ access_token: accessToken });
  } catch {
    return; // ADDITIONAL_CONSENT_REQUIRED, PRODUCTS_NOT_SUPPORTED, etc. — the member can still type the address.
  }
  const d = db();
  for (const m of r.data.liabilities.mortgage ?? []) {
    const address = fromPlaidAddress(m.property_address);
    const row = {
      accountId: m.account_id,
      itemId: item.itemId,
      userEmail: item.userEmail,
      propertyAddressEnc: address ? encrypt(JSON.stringify(address)) : null,
      originationPrincipal: m.origination_principal_amount ?? null,
      interestRatePct: m.interest_rate?.percentage ?? null,
      interestRateType: m.interest_rate?.type ?? null,
      maturityDate: m.maturity_date ?? null,
      nextPayment: m.next_monthly_payment ?? null,
      nextPaymentDue: m.next_payment_due_date ?? null,
      escrowBalance: m.escrow_balance ?? null,
      loanType: m.loan_type_description ?? null,
      loanTerm: m.loan_term ?? null,
      updatedAt: new Date(),
    };
    await d.insert(mortgageDetails).values(row).onConflictDoUpdate({ target: mortgageDetails.accountId, set: row });
  }
}

export async function recordNetWorth(email: string): Promise<void> {
  const d = db();
  const rows = await d
    .select()
    .from(accounts)
    .where(and(eq(accounts.userEmail, email), eq(accounts.includeInNetWorth, true)));
  const manual = await d.select().from(manualEntries).where(and(eq(manualEntries.userEmail, email), eq(manualEntries.archived, false)));
  const value = netWorthTotal(rows.map((a) => ({ id: a.accountId, balance: signedBalance(a.type, a.balanceCurrent), include: true })), manual as ManualEntry[]);
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
