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
export const metadata = { title: { absolute: "Apex — see everything, know your next move" }, alternates: { canonical: "/" } };

// Structured data so search engines and AI assistants can describe Apex accurately.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Apex",
  url: "https://www.apexfolios.com",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "A personal finance agent fluent in tax, investing and trading. Read-only account access through Plaid, whole net worth in one place, tax-aware plans. Recommends only what's best for your money, never paid placements. By invitation.",
  featureList: ["Net worth across all accounts", "Allocation vs. targets", "Spending pace by category", "Tax-aware rebalancing plans", "Read-only: cannot move money or place trades"],
};

export default async function OverviewPage() {
  // Signed out: public demo with sample data. Signed in: that account's own data.
  const { email, d } = await viewerDashboard();
  const now = new Date(d.asOf);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <main className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <h1 className="sr-only">Apex — your net worth, portfolio and spending in one place</h1>
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
