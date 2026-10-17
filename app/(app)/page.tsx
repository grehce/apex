import { viewerDashboard } from "@/lib/viewer";
import { SampleBanner } from "@/components/SampleBanner";
import { FooterNote } from "@/components/FooterNote";
import { CommandBar } from "@/components/overview/CommandBar";
import { NetWorthCard } from "@/components/overview/NetWorthCard";
import { AllocationCard } from "@/components/overview/AllocationCard";
import { SpendingCard } from "@/components/overview/SpendingCard";
import { LedgerCard } from "@/components/overview/LedgerCard";
import { HeatmapCard } from "@/components/overview/HeatmapCard";
import { Board } from "@/components/overview/Board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  // Signed out: public demo with sample data. Signed in: that account's own data.
  const { email, d } = await viewerDashboard();
  const now = new Date(d.asOf);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <main className="shell">
      <SampleBanner d={d} signedIn={Boolean(email)} />
      <CommandBar answers={d.answers} />
      <Board
        tiles={[
          { id: "networth", title: "Net worth", href: "/networth", wide: true, node: <NetWorthCard netWorth={d.netWorth} series={d.series} historyDays={d.historyDays} /> },
          { id: "allocation", title: "Allocation", href: "/portfolio", node: <AllocationCard rows={d.allocation} invested={d.invested} /> },
          { id: "spending", title: "Spending pace", href: "/spending", node: <SpendingCard rows={d.spendByCategory} dayOfMonth={now.getDate()} daysInMonth={daysInMonth} /> },
          { id: "ledger", title: "Ledger", href: "/ledger", node: <LedgerCard rows={d.ledger} /> },
          { id: "daily", title: "Daily spend", href: "/spending", node: <HeatmapCard days={d.heat} /> },
        ]}
      />
      <FooterNote d={d} signedIn={Boolean(email)} />
    </main>
  );
}
