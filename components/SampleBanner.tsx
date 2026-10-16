import Link from "next/link";
import type { Dashboard } from "@/lib/model";

export function SampleBanner({ d }: { d: Dashboard }) {
  if (!d.sample) return null;
  const ready = d.setup.plaid && d.setup.db && d.setup.encryption;
  return (
    <div className="banner dots" role="status" style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
      <span>
        <strong style={{ color: "var(--ink)" }}>Sample data.</strong>{" "}
        {ready ? "Connect an account to see your real numbers." : "Finish setup (Plaid, database, encryption key) to connect real accounts."}
      </span>
      <Link href="/settings" className="btn btn-primary" style={{ minHeight: 36, fontSize: 14 }}>
        {ready ? "Connect account" : "Open settings"}
      </Link>
    </div>
  );
}
