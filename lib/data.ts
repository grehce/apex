import "server-only";
import { desc, eq, gte, and } from "drizzle-orm";
import { db, dbConfigured } from "./db";
import { plaidConfigured } from "./plaid";
import { accounts, holdings, netWorthDaily, plaidItems, transactions } from "./schema";
import { signedBalance } from "./sync";
import {
  ASSET_CLASSES, CLASS_COLORS, DEFAULT_TARGETS, classify, isTaxAdvantaged, money, prettyCategory,
  type AccountRow, type AllocationRow, type Dashboard, type HoldingRow, type ItemRow, type RangeKey, type Series, type TxRow,
} from "./model";
import { sampleInputs } from "./sample";

/** Categories that are money moving between your own accounts or income, not spending. */
const NOT_SPEND = new Set(["TRANSFER_IN", "TRANSFER_OUT", "LOAN_PAYMENTS", "INCOME", "BANK_FEES_REFUND"]);

export type Inputs = {
  items: ItemRow[];
  holdings: HoldingRow[];
  txs: TxRow[];
  snapshots: { day: string; value: number }[];
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
  if (itemRows.length === 0) return build(sampleInputs(), true, setup);

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
    itemId: i.itemId,
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
      date: t.date,
      name: t.merchant ?? t.name,
      category: t.category ?? "",
      account: a ? `${instByItem.get(a.itemId) ?? ""} ${a.mask ? "••" + a.mask : ""}`.trim() : "",
      amount: t.amount,
    };
  });

  return build(
    { items, holdings: hold, txs, snapshots: snaps.map((s) => ({ day: s.day, value: s.value })), today: new Date() },
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
  const allAccts = inp.items.flatMap((i) => i.accounts);
  const included = allAccts.filter((a) => a.include);
  const netWorth = included.reduce((s, a) => s + a.balance, 0);

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
  const lastD = new Date(today.getFullYear(), today.getMonth() - 1, 15);
  const lastM = ymd(lastD).slice(0, 7);
  const spend = inp.txs.filter((t) => t.amount > 0 && !NOT_SPEND.has(t.category));
  const cat = new Map<string, { thisMonth: number; lastMonth: number }>();
  for (const t of spend) {
    const k = prettyCategory(t.category);
    const e = cat.get(k) ?? { thisMonth: 0, lastMonth: 0 };
    if (monthKey(t.date) === thisM) e.thisMonth += t.amount;
    else if (monthKey(t.date) === lastM) e.lastMonth += t.amount;
    cat.set(k, e);
  }
  const spendByCategory = [...cat.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .filter((r) => r.thisMonth > 0 || r.lastMonth > 0)
    .sort((a, b) => b.thisMonth - a.thisMonth)
    .slice(0, 6);

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

  // Net worth series from daily snapshots.
  const snaps = inp.snapshots.length ? inp.snapshots : [{ day: ymd(today), value: netWorth }];
  const series = {} as Record<RangeKey, Series>;
  const ranges: [RangeKey, number][] = [["1M", 31], ["1Y", 366], ["All", 100000]];
  for (const [k, days] of ranges) {
    const cutoff = ymd(new Date(today.getTime() - days * 86400000));
    let pts = snaps.filter((s) => s.day >= cutoff);
    if (pts.length > 60) {
      const step = (pts.length - 1) / 59;
      pts = Array.from({ length: 60 }, (_, i) => pts[Math.round(i * step)]);
    }
    if (pts.length < 2) pts = [pts[0] ?? { day: ymd(today), value: netWorth }, { day: ymd(today), value: netWorth }];
    series[k] = {
      v: pts.map((p) => Math.round(p.value * 100) / 100),
      l: pts.map((p) => {
        const [y, m, dd] = p.day.split("-");
        return k === "1M" ? `${m}/${dd}` : `${m}/${y.slice(2)}`;
      }),
    };
  }

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
    { q: `networth --since ${first?.day ?? ymd(today)}`, value: (delta >= 0 ? "+" : "") + money(delta, 0), sub: `${snaps.length} daily snapshots recorded` },
  ];

  return {
    sample,
    setup,
    asOf: today.toISOString(),
    netWorth,
    series,
    historyDays: snaps.length,
    items: inp.items,
    invested,
    allocation,
    holdings: inp.holdings,
    spendByCategory,
    ledger: inp.txs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12),
    transactions: inp.txs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
    heat,
    answers,
  };
}
