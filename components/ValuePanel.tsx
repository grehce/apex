import Link from "next/link";
import { ApexWordmark } from "./Mark";

/** The dark left panel shared by sign-in and the invitation page: one value prop, told once. */
export function ValuePanel({ badge }: { badge?: string }) {
  const tick = { color: "var(--accent-soft)" };
  return (
    <section className="dots-dark" aria-label="About Apex" style={{ flex: "1 1 520px", minWidth: 0, backgroundColor: "var(--dark)", color: "var(--dark-text)", padding: "clamp(24px, 6vw, 48px)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 40, minHeight: "min(600px, 100vh)" }}>
      <Link href="/" aria-label="Apex home" style={{ alignSelf: "flex-start", color: "var(--dark-text)", textDecoration: "none" }}>
        <ApexWordmark size={30} ink="#EDEFEA" />
      </Link>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 540 }}>
        {badge && (
          <span className="mono" style={{ alignSelf: "flex-start", padding: "4px 10px", border: "1px solid var(--dark-line)", borderRadius: 4, fontSize: 12, color: "var(--accent-soft)" }}>● {badge}</span>
        )}
        <h1 style={{ fontSize: "clamp(36px, 9vw, 52px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02 }}>
          See everything.
          <br />
          <span className="hl-dark">Know your next move.</span>
        </h1>
        <p style={{ margin: 0, fontSize: 18, color: "#B9C0BA" }}>
          Apex connects all your accounts, and an expert agent tells you what to do next, tax math included. No kickbacks, ever.
        </p>
      </div>
      <div className="scan mono" style={{ backgroundColor: "#1F2321", border: "1px solid var(--dark-line)", borderRadius: "var(--r-card)", padding: "18px 20px", fontSize: 13, display: "flex", flexDirection: "column", gap: 8, maxWidth: 540 }}>
        <span style={{ color: "var(--dark-muted)" }}>apex&gt; whats-inside</span>
        <span><span style={tick}>▸</span> tax, investing and trading expertise, built in</span>
        <span><span style={tick}>▸</span> no commissions, no kickbacks, no sponsored picks</span>
        <span><span style={tick}>▸</span> the market signals the pros watch, minus the exotic bets</span>
        <span><span style={tick}>▸</span> read-only and encrypted — it can&apos;t move your money<span className="blink">_</span></span>
      </div>
    </section>
  );
}
