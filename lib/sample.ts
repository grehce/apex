import type { Inputs } from "./data";
import type { HoldingRow, ItemRow, TxRow } from "./model";

/** Deterministic sample data, shown until a real account is connected. All names are fictional. */
export function sampleInputs(): Inputs {
  const today = new Date();
  const items: ItemRow[] = [
    { itemId: "s-north", institution: "Northline Bank", status: "ok", lastSyncedAt: today.toISOString(),
      accounts: [{ id: "s-chk", itemId: "s-north", institution: "Northline Bank", name: "Checking", mask: "4021", type: "depository", subtype: "checking", balance: 38412.57, include: true }] },
    { itemId: "s-mesa", institution: "Mesa Credit Union", status: "ok", lastSyncedAt: today.toISOString(),
      accounts: [{ id: "s-sav", itemId: "s-mesa", institution: "Mesa Credit Union", name: "High-Yield Savings", mask: "7710", type: "depository", subtype: "savings", balance: 142306.8, include: true }] },
    { itemId: "s-arc", institution: "Arc Brokerage", status: "ok", lastSyncedAt: today.toISOString(),
      accounts: [{ id: "s-brk", itemId: "s-arc", institution: "Arc Brokerage", name: "Individual", mask: "0932", type: "investment", subtype: "brokerage", balance: 1406433.96, include: true }] },
    { itemId: "s-harbor", institution: "Harbor Retirement", status: "login_required", lastSyncedAt: new Date(today.getTime() - 9 * 86400000).toISOString(),
      accounts: [{ id: "s-401k", itemId: "s-harbor", institution: "Harbor Retirement", name: "401(k)", mask: "5518", type: "investment", subtype: "401k", balance: 722828.08, include: true }] },
    { itemId: "s-kite", institution: "Kite Card", status: "ok", lastSyncedAt: today.toISOString(),
      accounts: [{ id: "s-cc", itemId: "s-kite", institution: "Kite Card", name: "Credit card", mask: "3304", type: "credit", subtype: "credit card", balance: -7650, include: true }] },
  ];

  const holdings: HoldingRow[] = [
    { accountId: "s-brk", ticker: "VTI", name: "US total market index", assetClass: "Stocks & funds", value: 906300, costBasis: 666900, taxAdvantaged: false },
    { accountId: "s-brk", ticker: "VXUS", name: "International index", assetClass: "Stocks & funds", value: 325350, costBasis: 297450, taxAdvantaged: false },
    { accountId: "s-brk", ticker: "THEM", name: "Thematic ETF", assetClass: "Other", value: 81270, costBasis: 67950, taxAdvantaged: false },
    { accountId: "s-brk", ticker: null, name: "Cash sweep", assetClass: "Cash", value: 93513.96, costBasis: null, taxAdvantaged: false },
    { accountId: "s-401k", ticker: "TDF55", name: "Target date 2055", assetClass: "Stocks & funds", value: 361428.08, costBasis: null, taxAdvantaged: true },
    { accountId: "s-401k", ticker: "BND", name: "US bond index", assetClass: "Bonds", value: 281840, costBasis: null, taxAdvantaged: true },
    { accountId: "s-401k", ticker: "STBL", name: "Stable value", assetClass: "Cash", value: 79560, costBasis: null, taxAdvantaged: true },
  ];

  // ~95 days of transactions, deterministic.
  const merchants: [string, string, number][] = [
    ["Corner Market", "FOOD_AND_DRINK", 84], ["Cafe Lumen", "FOOD_AND_DRINK", 9], ["Transit pass", "TRANSPORTATION", 86],
    ["Electric & gas", "RENT_AND_UTILITIES", 112], ["Streaming bundle", "ENTERTAINMENT", 23], ["Pharmacy", "MEDICAL", 18],
    ["Hardware store", "HOME_IMPROVEMENT", 63], ["Bookshop", "GENERAL_MERCHANDISE", 31], ["Noodle bar", "FOOD_AND_DRINK", 38],
  ];
  const txs: TxRow[] = [];
  let n = 0;
  for (let back = 95; back >= 0; back--) {
    const d = new Date(today.getTime() - back * 86400000);
    const day = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const count = ((back * 7 + 3) % 4) + (dow === 0 || dow === 6 ? 1 : 0);
    for (let k = 0; k < count; k++) {
      const [name, category, base] = merchants[(back * 5 + k * 3) % merchants.length];
      const amount = Math.round((base * (0.7 + ((back * 13 + k * 7) % 10) / 15)) * 100) / 100;
      txs.push({ id: `s${n++}`, date: day, name, category, account: k % 2 ? "Kite Card ••3304" : "Northline Bank ••4021", amount });
    }
    if (d.getDate() === 1) txs.push({ id: `s${n++}`, date: day, name: "Rent", category: "RENT_AND_UTILITIES", account: "Northline Bank ••4021", amount: 3200 });
    if (d.getDate() === 1 || d.getDate() === 15) txs.push({ id: `s${n++}`, date: day, name: "Payroll", category: "INCOME", account: "Northline Bank ••4021", amount: -7100 });
  }

  // Seven years of daily net worth: compounding from ~$900k to today, with a
  // bear-market drawdown in the middle and market-like daily noise. Deterministic.
  const nowValue = items.flatMap((i) => i.accounts).reduce((s, a) => s + a.balance, 0);
  const DAYS = 7 * 365;
  const start = 900_000;
  let seed = 103;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 - 0.5; };
  const walk: number[] = [0];
  for (let i = 1; i <= DAYS; i++) walk.push(walk[i - 1] + rnd() * 0.012);
  const snapshots = Array.from({ length: DAYS + 1 }, (_, i) => {
    const t = i / DAYS;
    const trend = Math.log(start) + (Math.log(nowValue) - Math.log(start)) * t;
    const drawdown = -0.22 * Math.exp(-(((t - 0.48) / 0.07) ** 2)); // a rough year, then recovery
    const noise = walk[i] - walk[DAYS] * t; // pinned to zero at both ends
    const day = new Date(today.getTime() - (DAYS - i) * 86400000).toISOString().slice(0, 10);
    return { day, value: i === DAYS ? nowValue : Math.round(Math.exp(trend + drawdown + noise) * 100) / 100 };
  });

  return { items, holdings, txs, snapshots, today };
}
