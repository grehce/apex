import { v1 } from "@/lib/v1";
import { buildPlans, currentPct } from "@/lib/plans";
import { DEFAULT_TARGETS } from "@/lib/model";
export const dynamic = "force-dynamic";

/** The three rebalancing plans Apex proposes. Proposals only: Apex never places trades. */
export function GET(req: Request) {
  return v1(req, (d) => ({
    note: "Proposals computed from your holdings and targets. Not financial advice. Apex is read-only; you place any trades yourself.",
    current_percent: currentPct(d.holdings),
    target_percent: DEFAULT_TARGETS,
    plans: buildPlans(d.holdings).map((p) => ({
      key: p.key, name: p.name, description: p.desc,
      sells: p.sells, max_drift_after: Math.round(p.maxDrift * 10) / 10, realized_taxable_gain: p.realizedGain,
      trades: p.trades.map((t) => ({ side: t.side, class: t.what, where: t.where, amount: t.amount })),
    })),
  }));
}
