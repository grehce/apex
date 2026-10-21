import { viewerDashboard } from "@/lib/viewer";
import { SampleBanner } from "@/components/SampleBanner";
import { SettingsView } from "@/components/settings/SettingsView";
import { institutionLogo } from "@/lib/institution-logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { email, d } = await viewerDashboard();
  // Signed out: a read-only tour of Settings on the sample accounts.
  const demo = !email;
  const items = demo ? d.items : d.sample ? [] : await Promise.all(
    d.items.map(async (item) => ({ ...item, logo: await institutionLogo(item.institutionId) })),
  );
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
      />
    </main>
  );
}
