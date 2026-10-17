import Link from "next/link";
import type { Dashboard } from "@/lib/model";

export function SampleBanner({ d, signedIn = true }: { d: Dashboard; signedIn?: boolean }) {
  if (!d.sample) return null;

  if (!signedIn) {
    // The header already has the Sign in button; the banner just explains what you're looking at.
    return (
      <div className="banner dots" role="status">
        <span>
          <strong style={{ color: "var(--ink)" }}>You&apos;re viewing a demo with sample data.</strong>{" "}
          Sign in to see your own accounts, spending and portfolio.
        </span>
      </div>
    );
  }

  const ready = d.setup.plaid && d.setup.db && d.setup.encryption;
  return (
    <div className="banner dots" role="status" style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
      <span>
        <strong style={{ color: "var(--ink)" }}>Sample data.</strong>{" "}
        {ready ? "Connect an account to replace it with your real numbers." : "Finish setup (Plaid, database, encryption key) to connect real accounts."}
      </span>
      <Link href="/settings" className="btn btn-primary" style={{ minHeight: 36, fontSize: 14 }}>
        {ready ? "Connect account" : "Open settings"}
      </Link>
    </div>
  );
}
