import { currentEmail } from "@/auth";
import { redirect } from "next/navigation";
import { loadDashboard } from "@/lib/data";
import { SampleBanner } from "@/components/SampleBanner";
import { CommandBar } from "@/components/overview/CommandBar";
import { NetWorthCard } from "@/components/overview/NetWorthCard";
import { AllocationCard } from "@/components/overview/AllocationCard";
import { SpendingCard } from "@/components/overview/SpendingCard";
import { LedgerCard } from "@/components/overview/LedgerCard";
import { HeatmapCard } from "@/components/overview/HeatmapCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const email = await currentEmail();
  if (!email) redirect("/signin");
  const d = await loadDashboard(email);
  const now = new Date(d.asOf);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <main className="shell">
      <SampleBanner d={d} />
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
        <span>read-only · you place every trade</span>
      </footer>
    </main>
  );
}
