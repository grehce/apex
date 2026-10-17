"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview", match: ["/", "/networth", "/portfolio", "/spending", "/ledger"] },
  { href: "/agent", label: "Agent", match: ["/agent"] },
  { href: "/settings", label: "Settings", match: ["/settings"] },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.match.includes(path) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
