import Link from "next/link";
import { ApexMark } from "@/components/Mark";
import { WaitlistForm } from "@/components/WaitlistForm";
import { dbConfigured } from "@/lib/db";
import { totalWaiting } from "@/lib/waitlist";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request an invitation" };

export default async function WaitlistPage({ searchParams }: { searchParams: Promise<{ ref?: string; denied?: string }> }) {
  const { ref, denied } = await searchParams;
  const referral = ref && /^[A-Z0-9]{8}$/i.test(ref) ? ref.toUpperCase() : null;
  const total = dbConfigured() ? await totalWaiting().catch(() => 0) : 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap" }}>
      <section className="dots-dark" aria-label="About Apex" style={{ flex: "1 1 520px", minWidth: 0, backgroundColor: "var(--dark)", color: "var(--dark-text)", padding: "clamp(24px, 6vw, 48px)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 40, minHeight: "min(600px, 100vh)" }}>
        <Link href="/" className="row" style={{ gap: 12, color: "var(--dark-text)", textDecoration: "none" }}>
          <ApexMark size={34} ink="#EDEFEA" ground="#17191A" accent="#FFB21E" />
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>Apex</span>
        </Link>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 540 }}>
          <span className="mono" style={{ alignSelf: "flex-start", padding: "4px 10px", border: "1px solid var(--dark-line)", borderRadius: 4, fontSize: 12, color: "var(--accent-soft)" }}>
            ● by invitation{total >= 25 ? ` · ${total.toLocaleString("en-US")} people waiting` : ""}
          </span>
          <h1 style={{ fontSize: "clamp(36px, 9vw, 52px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02 }}>
            Your money,
            <br />
            <span className="hl-dark">finally legible.</span>
          </h1>
          <p style={{ margin: 0, fontSize: 18, color: "#B9C0BA" }}>
            We&apos;re welcoming members in small groups. Each one is drawn from the list, and those who bring others are welcomed first.
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
            <span className="eyebrow">by invitation</span>
            <h2 id="wl-h" style={{ fontSize: "clamp(28px, 7vw, 34px)", fontWeight: 700, letterSpacing: "-0.03em" }}>Request an invitation</h2>
            {denied ? (
              <p style={{ margin: 0, color: "var(--ink-2)" }}>This Google account isn&apos;t on the guest list yet. Request an invitation and you&apos;ll be among the first considered when we welcome the next group.</p>
            ) : referral ? (
              <p style={{ margin: 0, color: "var(--ink-2)" }}>Someone already on the list asked us to save you a place. Requests made through a friend are welcomed sooner — for both of you.</p>
            ) : (
              <p style={{ margin: 0, color: "var(--ink-2)" }}>Apex opens quietly, a small group at a time. Invitations go to the list first, and to those who bring good company sooner. Already a member? <Link href="/signin">Log in</Link>.</p>
            )}
          </div>
          <WaitlistForm referral={referral} />
        </div>
      </section>
    </div>
  );
}
