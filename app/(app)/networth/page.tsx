import { viewerDashboard } from "@/lib/viewer";
import { SampleBanner } from "@/components/SampleBanner";
import { FooterNote } from "@/components/FooterNote";
import { NetWorthCard } from "@/components/overview/NetWorthCard";
import { DetailHeader, usd } from "@/components/DetailHeader";
import { InstitutionMark } from "@/components/Mark";
import { manualAccounts } from "@/lib/manual-assets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Net worth" };

export default async function NetWorthPage() {
  const { email, d } = await viewerDashboard();
  const linkedAccounts = d.items.flatMap((i) => i.accounts);
  const accounts = [...linkedAccounts, ...manualAccounts(d.manualEntries)];
  const assets = accounts.filter((a) => a.balance >= 0);
  const debts = accounts.filter((a) => a.balance < 0);
  const sum = (xs: typeof accounts) => xs.filter((a) => a.include).reduce((s, a) => s + a.balance, 0);

  const table = (rows: typeof accounts, label: string) => (
    <section className="card" aria-label={label}>
      <div className="row between" style={{ alignItems: "baseline" }}>
        <h2>{label}</h2>
        <span className="mono num" style={{ fontSize: 14 }}>{usd(sum(rows))}</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>None.</p>
      ) : (
        <div className="table-wrap">
          <table className="data t-nw">
            <thead><tr><th>account</th><th>type</th><th className="r">balance</th><th className="r">share</th></tr></thead>
            <tbody>
              {rows.slice().sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).map((a) => (
                <tr key={a.id} style={{ opacity: a.include ? 1 : 0.5 }}>
                  <td>
                    <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                      <InstitutionMark name={a.institution} size={28} />
                      <span>
                        <span style={{ fontWeight: 500 }}>{a.institution}</span>{" "}
                        <span className="mono muted" style={{ fontSize: 12 }}>{a.name}{a.mask ? ` ••${a.mask}` : ""}{a.include ? "" : " · excluded"}</span>
                      </span>
                    </span>
                  </td>
                  <td className="mono muted" style={{ fontSize: 12 }}>{a.subtype ?? a.type}</td>
                  <td className="r mono num">{usd(a.balance)}</td>
                  <td className="r mono muted" style={{ fontSize: 12 }}>{sum(rows) ? `${((a.balance / sum(rows)) * 100).toFixed(1)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <main className="shell">
      <DetailHeader eyebrow="net_worth" title="Net worth" right={<span className="mono muted" style={{ fontSize: 12 }}>assets {usd(sum(assets), false)} · debts {usd(sum(debts), false)}</span>} />
      <SampleBanner d={d} signedIn={Boolean(email)} />
      <NetWorthCard netWorth={d.netWorth} series={d.series} historyDays={d.historyDays} />
      <div className="grid-2">
        {table(assets, "Assets")}
        {table(debts, "Debts")}
      </div>
      <FooterNote d={d} signedIn={Boolean(email)} />
    </main>
  );
}
