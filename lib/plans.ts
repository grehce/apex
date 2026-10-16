import { ASSET_CLASSES, DEFAULT_TARGETS, type AssetClass, type HoldingRow } from "./model";

export type Trade = { side: "SELL" | "BUY" | "ROUTE"; what: string; where: string; amount: number };
export type Plan = {
  key: "A" | "B" | "C";
  name: string;
  desc: string;
  trades: Trade[];
  after: Record<AssetClass, number>; // percent
  maxDrift: number;
  realizedGain: number | null; // taxable gains realized by sells, when cost basis is known
  sells: number;
};

type Totals = Record<AssetClass, number>;
const zero = (): Totals => Object.fromEntries(ASSET_CLASSES.map((c) => [c, 0])) as Totals;

function pct(t: Totals): Record<AssetClass, number> {
  const total = ASSET_CLASSES.reduce((s, c) => s + t[c], 0) || 1;
  return Object.fromEntries(ASSET_CLASSES.map((c) => [c, (t[c] / total) * 100])) as Record<AssetClass, number>;
}
function maxDrift(p: Record<AssetClass, number>, targets: Record<AssetClass, number>) {
  return Math.max(...ASSET_CLASSES.map((c) => Math.abs(p[c] - targets[c])));
}
const round100 = (n: number) => Math.round(n / 100) * 100;

/**
 * Three deterministic rebalancing plans. These are arithmetic, not advice:
 *  A — no sells; route new money to underweight classes
 *  B — trade only inside tax-advantaged accounts (no taxable gains)
 *  C — full rebalance anywhere; reports gains realized in taxable accounts
 */
export function buildPlans(holdings: HoldingRow[], targets: Record<AssetClass, number> = DEFAULT_TARGETS): Plan[] {
  const now = zero();
  const sheltered = zero();
  for (const h of holdings) {
    now[h.assetClass] += h.value;
    if (h.taxAdvantaged) sheltered[h.assetClass] += h.value;
  }
  const total = ASSET_CLASSES.reduce((s, c) => s + now[c], 0);
  const gap = Object.fromEntries(ASSET_CLASSES.map((c) => [c, (targets[c] / 100) * total - now[c]])) as Totals; // + = buy

  // Plan A: route new contributions (no sells). Shows where the next dollars should go.
  const under = ASSET_CLASSES.filter((c) => gap[c] > 50);
  const needed = under.reduce((s, c) => s + gap[c], 0);
  const aAfter = { ...now };
  for (const c of under) aAfter[c] += gap[c];
  const planA: Plan = {
    key: "A",
    name: "Route new money",
    desc: `No sells. Direct about ${fmt(needed)} of future contributions to underweight classes and let drift close over time.`,
    trades: under.map((c) => ({ side: "ROUTE", what: c, where: "next contributions", amount: round100(gap[c]) })),
    after: pct(aAfter),
    maxDrift: maxDrift(pct(aAfter), targets),
    realizedGain: 0,
    sells: 0,
  };

  // Plan B: trade inside tax-advantaged accounts only.
  const bAfter = { ...now };
  const bTrades: Trade[] = [];
  let pool = 0;
  for (const c of ASSET_CLASSES) {
    if (gap[c] < -50) {
      const s = Math.min(-gap[c], sheltered[c]);
      if (s > 50) {
        bTrades.push({ side: "SELL", what: c, where: "tax-advantaged accounts", amount: round100(s) });
        bAfter[c] -= s;
        pool += s;
      }
    }
  }
  for (const c of ASSET_CLASSES) {
    if (gap[c] > 50 && pool > 50) {
      const b = Math.min(gap[c], pool);
      bTrades.push({ side: "BUY", what: c, where: "tax-advantaged accounts", amount: round100(b) });
      bAfter[c] += b;
      pool -= b;
    }
  }
  const planB: Plan = {
    key: "B",
    name: "Tax-aware rebalance",
    desc: "Rebalance only inside retirement and other tax-advantaged accounts, where trades don't create a tax bill.",
    trades: bTrades,
    after: pct(bAfter),
    maxDrift: maxDrift(pct(bAfter), targets),
    realizedGain: 0,
    sells: bTrades.filter((t) => t.side === "SELL").length,
  };

  // Plan C: full rebalance. Sell sheltered first, then taxable; estimate realized gains from cost basis.
  const cTrades: Trade[] = [];
  let gain = 0;
  let gainKnown = true;
  for (const c of ASSET_CLASSES) {
    if (gap[c] < -50) {
      let need = -gap[c];
      const fromSheltered = Math.min(need, sheltered[c]);
      if (fromSheltered > 50) cTrades.push({ side: "SELL", what: c, where: "tax-advantaged accounts", amount: round100(fromSheltered) });
      need -= fromSheltered;
      if (need > 50) {
        cTrades.push({ side: "SELL", what: c, where: "taxable accounts", amount: round100(need) });
        const taxable = holdings.filter((h) => h.assetClass === c && !h.taxAdvantaged);
        const val = taxable.reduce((s, h) => s + h.value, 0);
        const basis = taxable.reduce((s, h) => s + (h.costBasis ?? NaN), 0);
        if (val > 0 && Number.isFinite(basis)) gain += (need / val) * (val - basis);
        else gainKnown = false;
      }
    }
  }
  for (const c of ASSET_CLASSES) if (gap[c] > 50) cTrades.push({ side: "BUY", what: c, where: "any account", amount: round100(gap[c]) });
  const cAfter = Object.fromEntries(ASSET_CLASSES.map((c) => [c, targets[c]])) as Record<AssetClass, number>;
  const planC: Plan = {
    key: "C",
    name: "Full rebalance",
    desc: "Hit every target now, including sells in taxable accounts. Fastest, but can realize capital gains.",
    trades: cTrades,
    after: cAfter,
    maxDrift: 0,
    realizedGain: gainKnown ? Math.max(0, gain) : null,
    sells: cTrades.filter((t) => t.side === "SELL").length,
  };

  return [planA, planB, planC];
}

export function currentPct(holdings: HoldingRow[]): Record<AssetClass, number> {
  const t = zero();
  for (const h of holdings) t[h.assetClass] += h.value;
  return pct(t);
}

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}
