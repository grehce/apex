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
  const mortgageRates = Object.fromEntries(Object.values(homes.mortgages).filter((m) => m.interestRatePct != null).map((m) => [m.accountId, `${m.interestRatePct}%${m.interestRateType ? ` ${m.interestRateType}` : ""}`]));
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
        mortgageRates={mortgageRates}
        estimatesEnabled={!demo && valuationConfigured()}
      />
    </main>
  );
}
