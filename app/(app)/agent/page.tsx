import Link from "next/link";
import { redirect } from "next/navigation";
import { currentEmail } from "@/auth";
import { loadDashboard } from "@/lib/data";
import { ASSET_CLASSES, DEFAULT_TARGETS } from "@/lib/model";
import { buildPlans, currentPct } from "@/lib/plans";
import { SampleBanner } from "@/components/SampleBanner";
import { AgentView } from "@/components/agent/AgentView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent" };

export default async function AgentPage() {
  const email = await currentEmail();
  if (!email) redirect("/signin");
  const d = await loadDashboard(email);
  const now = currentPct(d.holdings);
  const plans = buildPlans(d.holdings);

  const driftStr = ASSET_CLASSES.filter((c) => now[c] > 0.05 || DEFAULT_TARGETS[c] > 0)
    .map((c) => `${c.split(" ")[0].toLowerCase()} ${now[c] - DEFAULT_TARGETS[c] >= 0 ? "+" : ""}${(now[c] - DEFAULT_TARGETS[c]).toFixed(1)}`)
    .join(" · ");
  const taxableGains = d.holdings.filter((h) => !h.taxAdvantaged && h.costBasis !== null && h.value > h.costBasis).length;
  const accts = new Set(d.holdings.map((h) => h.accountId)).size;
  const b = plans[1];
  const recommended = b.trades.length > 0 && b.maxDrift <= 2 ? "B" : plans[2].realizedGain === 0 ? "C" : b.trades.length > 0 ? "B" : "A";
  const rec = plans.find((p) => p.key === recommended)!;

  const trace: [string, string, string][] = [
    ["read", "holdings", `${d.holdings.length} positions · ${accts} accounts`],
    ["load", "targets", ASSET_CLASSES.filter((c) => DEFAULT_TARGETS[c] > 0).map((c) => `${c.split(" ")[0].toLowerCase()} ${DEFAULT_TARGETS[c]}`).join(" · ")],
    ["calc", "drift", driftStr],
    ["scan", "tax lots", `${taxableGains} taxable positions with unrealized gains`],
    ["sim", "3 plans", "minimize taxable gains, then drift, then trades"],
    ["done", "recommend", `plan ${rec.key} · ${rec.name.toLowerCase()}`],
  ];

  const worst = ASSET_CLASSES.map((c) => ({ c, d: now[c] - DEFAULT_TARGETS[c] })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
  const summary =
    d.holdings.length === 0
      ? "I don't see any investment holdings yet. Connect a brokerage or retirement account in Settings and I'll compute plans from it."
      : `Your biggest gap is ${worst.c.toLowerCase()} at ${worst.d >= 0 ? "+" : ""}${worst.d.toFixed(1)}% vs target. Plan ${rec.key} (${rec.name.toLowerCase()}) gets every class within ${rec.maxDrift.toFixed(1)}% with ${rec.realizedGain ? `about $${Math.round(rec.realizedGain).toLocaleString("en-US")} of taxable gains` : "no taxable gains"}.`;

  return (
    <main className="shell" style={{ gap: 20 }}>
      <SampleBanner d={d} />
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="eyebrow">agent · portfolio</span>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.05 }}>Apex Agent</h1>
        </div>
        <div className="row mono" style={{ gap: 8, fontSize: 12 }}>
          <span style={{ padding: "6px 10px", borderRadius: 4, background: "var(--accent-tint)", color: "var(--accent-ink)" }}>reads · {d.items.length} institutions</span>
          <span style={{ padding: "6px 10px", borderRadius: 4, background: "var(--accent-tint)", color: "var(--accent-ink)" }}>can · propose, simulate</span>
          <span style={{ padding: "6px 10px", borderRadius: 4, background: "var(--warn-tint)", color: "var(--warn)" }}>cannot · place trades</span>
          <Link href="/settings">settings →</Link>
        </div>
      </div>
      <AgentView trace={trace} summary={summary} now={now} targets={DEFAULT_TARGETS} plans={plans} recommended={recommended} />
    </main>
  );
}
