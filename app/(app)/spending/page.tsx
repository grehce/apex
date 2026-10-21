import { viewerDashboard } from "@/lib/viewer";
import { SampleBanner } from "@/components/SampleBanner";
import { FooterNote } from "@/components/FooterNote";
import { SpendingCard } from "@/components/overview/SpendingCard";
import { HeatmapCard } from "@/components/overview/HeatmapCard";
import { DetailHeader, usd } from "@/components/DetailHeader";
import { prettyCategory } from "@/lib/model";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spending" };

export default async function SpendingPage() {
  const { email, d } = await viewerDashboard();
  const now = new Date(d.asOf);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const thisM = d.asOf.slice(0, 7);

  const monthSpend = d.spending.current;
  const total = d.spending.total;
  const lastTotal = d.spending.lastTotal;
  const merchants = new Map<string, { amount: number; count: number; category: string }>();
  for (const t of monthSpend) {
    const m = merchants.get(t.name) ?? { amount: 0, count: 0, category: t.category };
    m.amount += t.amount;
    m.count += 1;
    merchants.set(t.name, m);
  }
  const topMerchants = [...merchants.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 10);
  const cats = d.spending.categories.slice().sort((a, b) => b.thisMonth - a.thisMonth);

  return (
    <main className="shell">
      <DetailHeader
        eyebrow="spending"
        title="Spending"
        right={<span className="mono muted" style={{ fontSize: 12 }}>this month {usd(total, false)} · last month {lastTotal ? usd(lastTotal, false) : "not synced yet"}</span>}
      />
      <SampleBanner d={d} signedIn={Boolean(email)} />
      <div className="grid-2">
        <SpendingCard pendingTotal={d.spending.pendingTotal} postedTotal={d.spending.total} rows={d.spendByCategory} dayOfMonth={now.getUTCDate()} daysInMonth={daysInMonth} />
        <HeatmapCard days={d.heat} />
      </div>
      <div className="grid-2">
        <section className="card" aria-label="By category">
          <h2>By category</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>category</th><th className="r">this month</th><th className="r">last month</th><th className="r">change</th></tr></thead>
              <tbody>
                {cats.map((c) => {
                  const ch = c.lastMonth ? ((c.thisMonth - c.lastMonth) / c.lastMonth) * 100 : null;
                  return (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td className="r mono num">{usd(c.thisMonth)}</td>
                      <td className="r mono num muted">{usd(c.lastMonth)}</td>
                      <td className="r mono" style={{ fontSize: 12 }}>{ch === null ? "new" : `${ch >= 0 ? "+" : ""}${ch.toFixed(0)}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card" aria-label="Top merchants">
          <h2>Top merchants this month</h2>
          {topMerchants.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No spending yet this month.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>merchant</th><th>category</th><th className="r">visits</th><th className="r">total</th></tr></thead>
                <tbody>
                  {topMerchants.map(([name, m]) => (
                    <tr key={name}>
                      <td style={{ fontWeight: 500 }}>{name}</td>
                      <td className="mono muted" style={{ fontSize: 12 }}>{prettyCategory(m.category)}</td>
                      <td className="r mono">{m.count}</td>
                      <td className="r mono num">{usd(m.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <FooterNote d={d} signedIn={Boolean(email)} />
    </main>
  );
}
