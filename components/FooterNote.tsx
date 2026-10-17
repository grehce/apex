import Link from "next/link";
import type { Dashboard } from "@/lib/model";
import { Quotes } from "./Quotes";

export function FooterNote({ d, signedIn }: { d: Dashboard; signedIn: boolean }) {
  let left: React.ReactNode;
  if (!d.sample) {
    left = <span>{d.items.length} institution{d.items.length === 1 ? "" : "s"} connected · apexfolios.com</span>;
  } else if (!signedIn) {
    left = (
      <span>
        All pretend money, all real math. <Link href="/signin">Sign in</Link> and let Apex crunch yours.
      </span>
    );
  } else {
    left = (
      <span>
        Pretend money, real charts. <Link href="/settings">Connect an account</Link> and watch these turn into yours.
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
