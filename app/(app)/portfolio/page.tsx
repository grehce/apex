import Link from "next/link";
import { viewerDashboard } from "@/lib/viewer";
import { SampleBanner } from "@/components/SampleBanner";
import { FooterNote } from "@/components/FooterNote";
import { AllocationCard } from "@/components/overview/AllocationCard";
import { DetailHeader, usd } from "@/components/DetailHeader";
import { CLASS_COLORS } from "@/lib/model";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const { email, d } = await viewerDashboard();
  const acct = new Map(d.items.flatMap((i) => i.accounts).map((a) => [a.id, a]));
  const rows = d.holdings.slice().sort((a, b) => b.value - a.value);
  const gainTotal = rows.reduce((s, h) => s + (h.costBasis !== null && !h.taxAdvantaged ? h.value - h.costBasis : 0), 0);

  return (
    <main className="shell">
      <DetailHeader
        eyebrow="portfolio"
        title="Portfolio"
        right={<Link href={email ? "/agent" : "/signin"} className="btn btn-primary" style={{ minHeight: 40 }}>Rebalance with Apex Agent →</Link>}
      />
      <SampleBanner d={d} signedIn={Boolean(email)} />
      <div className="grid-2">
        <AllocationCard rows={d.allocation} invested={d.invested} />
        <section className="card" aria-label="Summary">
          <h2>Summary</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
            {[
              ["invested", usd(d.invested, false)],
              ["positions", String(rows.length)],
              ["tax-advantaged", usd(rows.filter((h) => h.taxAdvantaged).reduce((s, h) => s + h.value, 0), false)],
              ["unrealized gain (taxable)", usd(gainTotal, false)],
            ].map(([k, v]) => (
              <div key={k} className="dots inner" style={{ padding: "12px 14px" }}>
                <div className="mono muted" style={{ fontSize: 11 }}>{k}</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
          <p className="note">Classes come from each security&apos;s type as reported by your brokerage. Bond funds may show under Stocks &amp; funds for now.</p>
        </section>
      </div>
      <section className="card" aria-label="Holdings">
        <h2>Holdings</h2>
        {rows.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Connect a brokerage or retirement account to see holdings.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>holding</th><th>class</th><th>account</th><th className="r">value</th><th className="r">cost basis</th><th className="r">gain</th><th className="r">weight</th></tr>
              </thead>
              <tbody>
                {rows.map((h, i) => {
                  const a = acct.get(h.accountId);
                  const gain = h.costBasis !== null ? h.value - h.costBasis : null;
                  return (
                    <tr key={i}>
                      <td><span className="mono" style={{ fontWeight: 600 }}>{h.ticker ?? "—"}</span> <span className="muted">{h.name}</span></td>
                      <td><span className="row" style={{ gap: 6, flexWrap: "nowrap" }}><span style={{ width: 8, height: 8, borderRadius: 2, background: CLASS_COLORS[h.assetClass] }} />{h.assetClass}</span></td>
                      <td className="mono muted" style={{ fontSize: 12 }}>{a ? `${a.institution} ${a.name}` : ""}{h.taxAdvantaged ? " · tax-adv." : ""}</td>
                      <td className="r mono num">{usd(h.value)}</td>
                      <td className="r mono num muted">{h.costBasis !== null ? usd(h.costBasis) : "—"}</td>
                      <td className="r mono num" style={{ color: gain === null ? undefined : gain >= 0 ? "var(--accent-ink)" : "var(--warn)" }}>{gain === null ? "—" : `${gain >= 0 ? "+" : ""}${usd(gain)}`}</td>
                      <td className="r mono muted" style={{ fontSize: 12 }}>{d.invested ? `${((h.value / d.invested) * 100).toFixed(1)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <FooterNote d={d} signedIn={Boolean(email)} />
    </main>
  );
}
