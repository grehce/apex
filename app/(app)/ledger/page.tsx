import { viewerDashboard } from "@/lib/viewer";
import { SampleBanner } from "@/components/SampleBanner";
import { FooterNote } from "@/components/FooterNote";
import { DetailHeader } from "@/components/DetailHeader";
import { LedgerTable } from "@/components/LedgerTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ledger" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function LedgerPage({ searchParams }: { searchParams: SP }) {
  const { email, d } = await viewerDashboard();
  const sp = await searchParams;
  // Drill-down from Spending: ?category=food and drink&month=2026-10
  const category = one(sp.category).slice(0, 60);
  const month = /^\d{4}-\d{2}$/.test(one(sp.month)) ? one(sp.month) : "";
  return (
    <main className="shell">
      <DetailHeader eyebrow="ledger" title="Ledger" right={<span className="mono muted" style={{ fontSize: 12 }}>last ~120 days</span>} />
      <SampleBanner d={d} signedIn={Boolean(email)} />
      <LedgerTable rows={d.transactions} initialCategory={category} initialMonth={month} />
      <FooterNote d={d} signedIn={Boolean(email)} />
    </main>
  );
}
