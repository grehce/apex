import Link from "next/link";
import { ApexMark } from "@/components/Mark";
import { WaitlistForm } from "@/components/WaitlistForm";
import { dbConfigured } from "@/lib/db";
import { totalWaiting } from "@/lib/waitlist";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join the waitlist" };

export default async function WaitlistPage({ searchParams }: { searchParams: Promise<{ ref?: string; denied?: string }> }) {
  const { ref, denied } = await searchParams;
  const referral = ref && /^[A-Z0-9]{8}$/i.test(ref) ? ref.toUpperCase() : null;
  const total = dbConfigured() ? await totalWaiting().catch(() => 0) : 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap" }}>
      <section className="dots-dark" aria-label="About Apex" style={{ flex: "1 1 520px", minWidth: 0, backgroundColor: "var(--dark)", color: "var(--dark-text)", padding: "clamp(24px, 6vw, 48px)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 40, minHeight: "min(600px, 100vh)" }}>
        <Link href="/" className="row" style={{ gap: 12, color: "var(--dark-text)", textDecoration: "none" }}>
          <ApexMark size={34} ink="#EDEFEA" ground="#17191A" accent="#3DFF8B" />
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>Apex</span>
        </Link>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 540 }}>
          <span className="mono" style={{ alignSelf: "flex-start", padding: "4px 10px", border: "1px solid var(--dark-line)", borderRadius: 4, fontSize: 12, color: "var(--accent-soft)" }}>
            ● invite-only{total >= 25 ? ` · ${total.toLocaleString("en-US")} people waiting` : ""}
          </span>
          <h1 style={{ fontSize: "clamp(36px, 9vw, 52px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02 }}>
            Your money,
            <br />
            <span className="hl-dark">finally legible.</span>
          </h1>
          <p style={{ margin: 0, fontSize: 18, color: "#B9C0BA" }}>
            We&apos;re opening Apex in small batches. Each round fills from the list — and the people who bring friends go first.
          </p>
        </div>
        <div className="scan mono" style={{ backgroundColor: "#1F2321", border: "1px solid var(--dark-line)", borderRadius: "var(--r-card)", padding: "18px 20px", fontSize: 13, display: "flex", flexDirection: "column", gap: 8, maxWidth: 540 }}>
          <span style={{ color: "var(--dark-muted)" }}>apex&gt; whats-inside</span>
          <span><span style={{ color: "var(--accent-soft)" }}>▸</span> every account in one net worth, updated daily</span>
          <span><span style={{ color: "var(--accent-soft)" }}>▸</span> spending pace that tells you before you overshoot</span>
          <span><span style={{ color: "var(--accent-soft)" }}>▸</span> an agent that finds the tax-smart way to rebalance</span>
          <span><span style={{ color: "var(--accent-soft)" }}>▸</span> read-only and encrypted — it can&apos;t move your money<span className="blink">_</span></span>
        </div>
      </section>

      <section aria-labelledby="wl-h" style={{ flex: "1 1 460px", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(28px, 6vw, 48px) 20px" }}>
        <div className="anim-in" style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 22 }}>
          <Link href="/" className="back">← back to apex</Link>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="eyebrow">waitlist · invite-only</span>
            <h2 id="wl-h" style={{ fontSize: "clamp(28px, 7vw, 34px)", fontWeight: 700, letterSpacing: "-0.03em" }}>Claim your seat</h2>
            {denied ? (
              <p style={{ margin: 0, color: "var(--ink-2)" }}>That Google account isn&apos;t on the guest list — yet. Claim a seat now and you&apos;ll be first in line when the next batch opens.</p>
            ) : referral ? (
              <p style={{ margin: 0, color: "var(--ink-2)" }}>You&apos;ve been personally invited to skip ahead. Claim your seat and you both move up the line.</p>
            ) : (
              <p style={{ margin: 0, color: "var(--ink-2)" }}>Apex lets people in a few at a time, and seats go to the list first. Every friend you bring bumps you up. Already invited? <Link href="/signin">Log in</Link>.</p>
            )}
          </div>
          <WaitlistForm referral={referral} />
        </div>
      </section>
    </div>
  );
}
