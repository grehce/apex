import { viewerDashboard } from "@/lib/viewer";
import { SampleBanner } from "@/components/SampleBanner";
import { SettingsView } from "@/components/settings/SettingsView";
import { institutionLogo } from "@/lib/institution-logo";
import { homeContext } from "@/lib/homes";
import { valuationConfigured } from "@/lib/valuation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { email, d } = await viewerDashboard();
  // Signed out: a read-only tour of Settings on the sample accounts.
  const demo = !email;
  const items = demo ? d.items : d.sample ? [] : await Promise.all(
    d.items.map(async (item) => ({ ...item, logo: await institutionLogo(item.institutionId) })),
  );
  // Decrypted only here, for the signed-in owner; addresses never reach the dashboard model, API or agent.
  const homes = email && !d.sample ? await homeContext(email) : { addresses: {}, mortgages: {} };
  const mortgageAddresses = Object.fromEntries(Object.values(homes.mortgages).map((m) => [m.accountId, m.address]));
  // What the servicer shared through Plaid, shown under each mortgage. Interest-only is inferred when the
  // monthly payment equals one month's interest on the balance (within 1%).
  const balances = new Map(items.flatMap((i) => i.accounts).map((a) => [a.id, Math.abs(a.balance)]));
  const loanDetails = Object.fromEntries(Object.values(homes.mortgages).map((m) => {
    const bal = balances.get(m.accountId) ?? 0;
    const interest = m.interestRatePct != null ? (bal * m.interestRatePct) / 100 / 12 : null;
    const interestOnly = interest != null && m.nextPayment != null && interest > 0 && Math.abs(m.nextPayment - interest) / interest < 0.01;
    return [m.accountId, { ratePct: m.interestRatePct, rateType: m.interestRateType, loanType: m.loanType, loanTerm: m.loanTerm, maturityDate: m.maturityDate, nextPayment: m.nextPayment, nextPaymentDue: m.nextPaymentDue, escrowBalance: m.escrowBalance, monthlyInterest: interest, interestOnly }];
  }));
  return (
    <main className="shell" style={{ gap: 20 }}>
      {demo && <SampleBanner d={d} signedIn={false} />}
      <SettingsView
        items={items}
        manualEntries={!demo && !d.sample ? d.manualEntries : []}
        initialNetWorth={d.netWorth}
        sample={demo ? false : d.sample}
        demo={demo}
        setup={d.setup}
        email={email ?? "you@example.com"}
        addresses={homes.addresses}
        mortgageAddresses={mortgageAddresses}
        loanDetails={loanDetails}
        estimatesEnabled={!demo && valuationConfigured()}
      />
    </main>
  );
}
