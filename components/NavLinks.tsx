"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview", public: true },
  { href: "/agent", label: "Agent", public: false },
  { href: "/settings", label: "Settings", public: false },
];

export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="nav">
      {LINKS.filter((l) => signedIn || l.public).map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
