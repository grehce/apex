import { currentEmail } from "@/auth";
import { loadDashboard, loadSampleDashboard } from "@/lib/data";
import { SampleBanner } from "@/components/SampleBanner";
import { CommandBar } from "@/components/overview/CommandBar";
import { NetWorthCard } from "@/components/overview/NetWorthCard";
import { AllocationCard } from "@/components/overview/AllocationCard";
import { SpendingCard } from "@/components/overview/SpendingCard";
import { LedgerCard } from "@/components/overview/LedgerCard";
import { HeatmapCard } from "@/components/overview/HeatmapCard";
import { Quotes } from "@/components/Quotes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  // Signed out: public demo with sample data. Signed in: that account's own data.
  const email = await currentEmail();
  const d = email ? await loadDashboard(email) : loadSampleDashboard();
  const now = new Date(d.asOf);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <main className="shell">
      <SampleBanner d={d} signedIn={Boolean(email)} />
      <CommandBar answers={d.answers} />
      <NetWorthCard netWorth={d.netWorth} series={d.series} historyDays={d.historyDays} />
      <div className="grid-2">
        <AllocationCard rows={d.allocation} invested={d.invested} />
        <SpendingCard rows={d.spendByCategory} dayOfMonth={now.getDate()} daysInMonth={daysInMonth} />
        <LedgerCard rows={d.ledger} />
        <HeatmapCard days={d.heat} />
      </div>
      <footer className="row between mono muted" style={{ fontSize: 12 }}>
        <span>{d.sample ? "sample data" : `${d.items.length} institutions connected`} · apexfolios.com</span>
        <Quotes />
      </footer>
    </main>
  );
}
