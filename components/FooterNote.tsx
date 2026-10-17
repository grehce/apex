import Link from "next/link";
import type { Dashboard } from "@/lib/model";
import { Quotes } from "./Quotes";

function Go({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className="btn btn-neon" style={{ minHeight: 30, width: 30, padding: 0, fontFamily: "var(--mono)", fontSize: 14 }}>
      &gt;
    </Link>
  );
}

export function FooterNote({ d, signedIn }: { d: Dashboard; signedIn: boolean }) {
  let left: React.ReactNode;
  if (!d.sample) {
    left = <span>{d.items.length} institution{d.items.length === 1 ? "" : "s"} connected · apexfolios.com</span>;
  } else if (!signedIn) {
    left = (
      <span className="row" style={{ gap: 10 }}>
        <span>Nice numbers, right? Your turn.</span>
        <Go href="/signin" label="Sign up or log in" />
      </span>
    );
  } else {
    left = (
      <span className="row" style={{ gap: 10 }}>
        <span>Ready when your accounts are.</span>
        <Go href="/settings" label="Connect an account" />
      </span>
    );
  }
  return (
    <footer className="row between mono muted" style={{ fontSize: 12, gap: "8px 24px" }}>
      {left}
      <Quotes />
    </footer>
  );
}
