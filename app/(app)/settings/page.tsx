import { redirect } from "next/navigation";
import { currentEmail } from "@/auth";
import { loadDashboard } from "@/lib/data";
import { plaidEnv } from "@/lib/plaid";
import { SettingsView } from "@/components/settings/SettingsView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const email = await currentEmail();
  if (!email) redirect("/signin");
  const d = await loadDashboard(email);
  return (
    <main className="shell" style={{ gap: 20 }}>
      <SettingsView items={d.sample ? [] : d.items} sample={d.sample} setup={d.setup} plaidEnv={plaidEnv()} email={email} />
    </main>
  );
}
