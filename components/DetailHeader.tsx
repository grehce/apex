import Link from "next/link";

export function DetailHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Link href="/" className="back">← overview</Link>
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="eyebrow">{eyebrow}</span>
          <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.05 }}>{title}</h1>
        </div>
        {right}
      </div>
    </div>
  );
}

export function usd(n: number, cents = true) {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  return (n < 0 ? "−$" : "$") + s;
}
