import { viewerDashboard } from "@/lib/viewer";
import { SampleBanner } from "@/components/SampleBanner";
import { FooterNote } from "@/components/FooterNote";
import { DetailHeader } from "@/components/DetailHeader";
import { LedgerTable } from "@/components/LedgerTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ledger" };

export default async function LedgerPage() {
  const { email, d } = await viewerDashboard();
  return (
    <main className="shell">
      <DetailHeader eyebrow="ledger" title="Ledger" right={<span className="mono muted" style={{ fontSize: 12 }}>last ~120 days</span>} />
      <SampleBanner d={d} signedIn={Boolean(email)} />
      <LedgerTable rows={d.transactions} />
      <FooterNote d={d} signedIn={Boolean(email)} />
    </main>
  );
}
