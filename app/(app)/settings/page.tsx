import { viewerDashboard } from "@/lib/viewer";
import { plaidEnv } from "@/lib/plaid";
import { SampleBanner } from "@/components/SampleBanner";
import { SettingsView } from "@/components/settings/SettingsView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { email, d } = await viewerDashboard();
  // Signed out: a read-only tour of Settings on the sample accounts.
  const demo = !email;
  return (
    <main className="shell" style={{ gap: 20 }}>
      {demo && <SampleBanner d={d} signedIn={false} />}
      <SettingsView
        items={demo ? d.items : d.sample ? [] : d.items}
        sample={demo ? false : d.sample}
        demo={demo}
        setup={d.setup}
        plaidEnv={plaidEnv()}
        email={email ?? "you@example.com"}
      />
    </main>
  );
}
