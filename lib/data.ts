import "server-only";
import { desc, eq, gte, and } from "drizzle-orm";
import { db, dbConfigured } from "./db";
import { plaidConfigured } from "./plaid";
import { accounts, holdings, mortgageDetails, netWorthDaily, plaidItems, transactions } from "./schema";
import { signedBalance } from "./sync";
import {
  ASSET_CLASSES, CLASS_COLORS, DEFAULT_TARGETS, classify, isTaxAdvantaged, money,
  type AccountRow, type AllocationRow, type Dashboard, type HoldingRow, type ItemRow, type RangeKey, type Series, type TxRow,
} from "./model";
import { sampleInputs } from "./sample";
import { manualEntries } from "./schema";
import { manualAccounts, type ManualEntry } from "./manual-assets";
import { categorizeTransactions } from "./categorize";
import { estimateHistory, MAX_HISTORY_DAYS, type HistPoint } from "./history";
import { summarizeSpending } from "./spending";
import { netWorthTotal } from "./net-worth";

export type Inputs = {
  manualEntries?: ManualEntry[];
  items: ItemRow[];
  holdings: HoldingRow[];
  txs: TxRow[];
  snapshots: { day: string; value: number }[];
  /** Daily history including estimated days; when absent the chart uses recorded snapshots only. */
  history?: HistPoint[];
  today: Date;
};

function setupStatus() {
  return { plaid: plaidConfigured(), db: dbConfigured(), encryption: Boolean(process.env.ENCRYPTION_KEY) };
}

/** Public demo: sample data only, never touches the database. */
export function loadSampleDashboard(): Dashboard {
  return build(sampleInputs(), true, setupStatus());
}

export async function loadDashboard(email: string): Promise<Dashboard> {
  const setup = setupStatus();
  if (!setup.db) return build(sampleInputs(), true, setup);

  const d = db();
  const itemRows = await d.select().from(plaidItems).where(eq(plaidItems.userEmail, email));
  const manualRowsRaw = await d.select({ id: manualEntries.id, name: manualEntries.name, kind: manualEntries.kind, category: manualEntries.category, value: manualEntries.value, valuationDate: manualEntries.valuationDate, archived: manualEntries.archived, linkedMortgageId: manualEntries.linkedMortgageId, valuationSource: manualEntries.valuationSource, estimateLow: manualEntries.estimateLow, estimateHigh: manualEntries.estimateHigh, estimateComps: manualEntries.estimateComps, valuationProvider: manualEntries.valuationProvider, lastValuedAt: manualEntries.lastValuedAt }).from(manualEntries).where(eq(manualEntries.userEmail, email));
  const manualRows = manualRowsRaw.map((m) => ({ ...m, lastValuedAt: m.lastValuedAt ? m.lastValuedAt.toISOString() : null }));
  if (itemRows.length === 0 && manualRows.length === 0) return build(sampleInputs(), true, setup);

  const acctRows = await d.select().from(accounts).where(eq(accounts.userEmail, email));
  const holdRows = await d.select().from(holdings).where(eq(holdings.userEmail, email));
  const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
  const txRows = await d
    .select()
    .from(transactions)
    .where(and(eq(transactions.userEmail, email), gte(transactions.date, since)))
    .orderBy(desc(transactions.date));
  const snaps = await d.select().from(netWorthDaily).where(eq(netWorthDaily.userEmail, email)).orderBy(netWorthDaily.day);

  const instByItem = new Map(itemRows.map((i) => [i.itemId, i.institutionName]));
  const acctById = new Map(acctRows.map((a) => [a.accountId, a]));
  const acctList: AccountRow[] = acctRows.map((a) => ({
    id: a.accountId,
    itemId: a.itemId,
    institution: instByItem.get(a.itemId) ?? "",
    name: a.name,
    mask: a.mask,
    type: a.type,
    subtype: a.subtype,
    balance: signedBalance(a.type, a.balanceCurrent),
    include: a.includeInNetWorth,
  }));

  const items: ItemRow[] = itemRows.map((i) => ({
    transactionsState: i.transactionsState as ItemRow["transactionsState"],
    transactionsError: i.transactionsError,
    itemId: i.itemId,
    institutionId: i.institutionId,
    institution: i.institutionName,
    status: (i.status as ItemRow["status"]) ?? "ok",
    lastSyncedAt: i.lastSyncedAt ? i.lastSyncedAt.toISOString() : null,
    accounts: acctList.filter((a) => a.itemId === i.itemId),
  }));

  const hold: HoldingRow[] = holdRows
    .filter((h) => acctById.get(h.accountId)?.includeInNetWorth !== false)
    .map((h) => ({
      accountId: h.accountId,
      ticker: h.ticker,
      name: h.name,
      assetClass: classify(h.securityType),
      value: h.value ?? 0,
      costBasis: h.costBasis,
      taxAdvantaged: isTaxAdvantaged(acctById.get(h.accountId)?.subtype),
    }));

  const txs: TxRow[] = txRows.map((t) => {
    const a = acctById.get(t.accountId);
    return {
      id: t.transactionId,
      accountId: t.accountId,
      raw: t.name,
      date: t.date,
      name: t.merchant ?? t.name,
      category: t.category ?? "",
      account: a ? `${instByItem.get(a.itemId) ?? ""} ${a.mask ? "••" + a.mask : ""}`.trim() : "",
      pending: t.pending,
      amount: t.amount,
    };
  });

  // Apex's own clean-up on top of Plaid: own-account transfers, card payments, income, merchant keywords, names.
  const kinds = Object.fromEntries(acctRows.map((a) => [a.accountId, a.type]));
  const subtypes = Object.fromEntries(acctRows.map((a) => [a.accountId, a.subtype]));
  const cleaned = categorizeTransactions(txs, kinds, subtypes);

  // Estimated history: every posted transaction (not just the 120-day window) replayed backwards.
  const histSince = new Date(Date.now() - MAX_HISTORY_DAYS * 86400000).toISOString().slice(0, 10);
  const [histTx, loans] = await Promise.all([
    d.select({ accountId: transactions.accountId, date: transactions.date, amount: transactions.amount, pending: transactions.pending }).from(transactions).where(and(eq(transactions.userEmail, email), gte(transactions.date, histSince))),
    d.select({ accountId: mortgageDetails.accountId, ratePct: mortgageDetails.interestRatePct, payment: mortgageDetails.nextPayment }).from(mortgageDetails).where(eq(mortgageDetails.userEmail, email)),
  ]);
  const manualTotal = manualAccounts(manualRows as ManualEntry[]).reduce((s, a) => s + a.balance, 0);
  const snapshots = snaps.map((s) => ({ day: s.day, value: s.value }));
  const history = estimateHistory({
    accounts: acctList, txs: histTx, manualTotal, snapshots, today: new Date(),
    mortgages: loans.filter((l) => l.ratePct != null).map((l) => ({ accountId: l.accountId, ratePct: l.ratePct!, monthlyPayment: l.payment ?? 0 })),
  });

  return build(
    { items, manualEntries: manualRows as ManualEntry[], holdings: hold, txs: cleaned, snapshots, history, today: new Date() },
    false,
    setup,
  );
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function monthKey(day: string) {
  return day.slice(0, 7);
}

export function build(inp: Inputs, sample: boolean, setup: Dashboard["setup"]): Dashboard {
  const allAccts = [...inp.items.flatMap((i) => i.accounts), ...manualAccounts(inp.manualEntries ?? [])];
  const included = allAccts.filter((a) => a.include);
  const netWorth = netWorthTotal(inp.items.flatMap((i) => i.accounts), inp.manualEntries ?? []);

  // Allocation: investment holdings, plus depository balances counted as cash.
  const byClass = new Map<string, number>(ASSET_CLASSES.map((c) => [c, 0]));
  for (const h of inp.holdings) byClass.set(h.assetClass, (byClass.get(h.assetClass) ?? 0) + h.value);
  const invested = [...byClass.values()].reduce((a, b) => a + b, 0);
  const allocation: AllocationRow[] = ASSET_CLASSES.map((c) => {
    const value = byClass.get(c) ?? 0;
    return { name: c, value, pct: invested ? (value / invested) * 100 : 0, target: DEFAULT_TARGETS[c], color: CLASS_COLORS[c] };
  }).filter((r) => r.value > 0 || r.target > 0);

  // Spending by category, this month vs last month.
  const today = inp.today;
  const thisM = ymd(today).slice(0, 7);
  const lastM = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const spending = summarizeSpending(inp.txs, today);
  const spend = spending.posted;
  const spendByCategory = spending.paceCategories;

  // Heatmap: last 91 days of spending.
  const byDay = new Map<string, TxRow[]>();
  for (const t of spend) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]);
  const heat = Array.from({ length: 91 }, (_, i) => {
    const day = ymd(new Date(today.getTime() - (90 - i) * 86400000));
    const txs = byDay.get(day) ?? [];
    return {
      day,
      amount: Math.round(txs.reduce((s, t) => s + t.amount, 0)),
      items: txs
        .slice()
        .sort((a, b) => b.amount - a.amount)
        .map((t) => ({ name: t.name, category: t.category, amount: Math.round(t.amount * 100) / 100 })),
    };
  });

  // Net worth series: recorded daily snapshots, plus estimated days before them when available.
  const hist: HistPoint[] = inp.history?.length ? inp.history : (inp.snapshots.length ? inp.snapshots : [{ day: ymd(today), value: netWorth }]).map((p) => ({ ...p, est: false }));
  const snaps = hist;
  const series = {} as Record<RangeKey, Series>;
  const ranges: [RangeKey, number][] = [["1M", 31], ["1Y", 366], ["All", 100000]];
  for (const [k, days] of ranges) {
    const cutoff = ymd(new Date(today.getTime() - days * 86400000));
    const all = hist.filter((s) => s.day >= cutoff);
    let pts = all;
    if (pts.length > 60) {
      const step = (pts.length - 1) / 59;
      pts = Array.from({ length: 60 }, (_, i) => all[Math.round(i * step)]);
    }
    if (pts.length < 2) pts = [pts[0] ?? { day: ymd(today), value: netWorth, est: false }, { day: ymd(today), value: netWorth, est: false }];
    const lastEst = all.reduce((m, p, i) => (p.est ? i : m), -1);
    series[k] = {
      v: pts.map((p) => Math.round(p.value * 100) / 100),
      l: pts.map((p) => {
        const [y, m, dd] = p.day.split("-");
        // Short histories label by day so ticks don't repeat the same month.
        return k === "1M" || all.length <= 92 ? `${m}/${dd}` : `${m}/${y.slice(2)}`;
      }),
      est: lastEst < 0 || all.length < 2 ? 0 : Math.min(1, (lastEst + 1) / (all.length - 1)),
    };
  }
  const estimatedDays = hist.filter((p) => p.est).length;

  // Command bar answers, computed from the same data.
  const monthSpend = spend.filter((t) => monthKey(t.date) === thisM);
  const income = inp.txs.filter((t) => t.amount < 0 && t.category === "INCOME" && monthKey(t.date) === lastM);
  const top = spendByCategory[0];
  const first = snaps[0];
  const delta = netWorth - (first?.value ?? netWorth);
  const answers = [
    { q: "spend where month=this | sum", value: money(monthSpend.reduce((s, t) => s + t.amount, 0)), sub: `${monthSpend.length} transactions this month` },
    { q: "income where month=last | sum", value: money(-income.reduce((s, t) => s + t.amount, 0)), sub: `${income.length} deposits categorized as income` },
    { q: "spend | group cat | top 1", value: top ? top.name : "—", sub: top ? `${money(top.thisMonth)} this month · ${money(top.lastMonth)} last month` : "no spending yet" },
    { q: `networth --since ${first?.day ?? ymd(today)}`, value: (delta >= 0 ? "+" : "") + money(delta, 0), sub: estimatedDays ? `${snaps.length - estimatedDays} recorded + ${estimatedDays} estimated days` : `${snaps.length} daily snapshots recorded` },
    { q: "networth", value: money(netWorth, 0), sub: `across ${included.length} accounts` },
    { q: "spend where month=last | sum", value: money(spend.filter((t) => monthKey(t.date) === lastM).reduce((s, t) => s + t.amount, 0)), sub: "all of last month" },
    { q: "spend | avg per day", value: money(heat.reduce((s, h) => s + h.amount, 0) / heat.length), sub: "over the last 13 weeks" },
    { q: "invested | sum", value: money(invested, 0), sub: `${inp.holdings.length} positions` },
    { q: "cash | sum", value: money(byClass.get("Cash") ?? 0, 0), sub: "cash and cash-like holdings" },
  ];

  return {
    manualEntries: inp.manualEntries ?? [],
    sample,
    setup,
    asOf: today.toISOString(),
    netWorth,
    series,
    historyDays: snaps.length - estimatedDays,
    estimatedDays,
    items: inp.items,
    invested,
    allocation,
    holdings: inp.holdings,
    spending,
    spendByCategory,
    // Overview ledger: the biggest money moves of the last 30 days, largest first.
    ledger: inp.txs
      .filter((t) => t.date >= ymd(new Date(today.getTime() - 30 * 86400000)))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || (a.date < b.date ? 1 : -1))
      .slice(0, 12),
    transactions: inp.txs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
    heat,
    answers,
  };
}
