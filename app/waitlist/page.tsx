import Link from "next/link";
import { ValuePanel } from "@/components/ValuePanel";
import { WaitlistForm } from "@/components/WaitlistForm";
import { dbConfigured } from "@/lib/db";
import { totalWaiting } from "@/lib/waitlist";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request an invitation", description: "Apex is by invitation. Request yours: a personal finance agent fluent in tax, investing and trading, with no kickbacks.", alternates: { canonical: "/waitlist" } };

export default async function WaitlistPage({ searchParams }: { searchParams: Promise<{ ref?: string; denied?: string }> }) {
  const { ref, denied } = await searchParams;
  const referral = ref && /^[A-Z0-9]{8}$/i.test(ref) ? ref.toUpperCase() : null;
  const total = dbConfigured() ? await totalWaiting().catch(() => 0) : 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap" }}>
      <ValuePanel badge={`by invitation${total >= 25 ? ` · ${total.toLocaleString("en-US")} people waiting` : ""}`} />

      <section aria-labelledby="wl-h" style={{ flex: "1 1 460px", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(28px, 6vw, 48px) 20px" }}>
        <div className="anim-in" style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 22 }}>
          <Link href="/" className="back">← back to apex</Link>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="eyebrow">by invitation</span>
            <h2 id="wl-h" style={{ fontSize: "clamp(28px, 7vw, 34px)", fontWeight: 700, letterSpacing: "-0.03em" }}>Request an invitation</h2>
            {denied ? (
              <p style={{ margin: 0, color: "var(--ink-2)" }}>This Google account isn&apos;t on the list yet.</p>
            ) : referral ? (
              <p style={{ margin: 0, color: "var(--ink-2)" }}>A member saved you a place.</p>
            ) : (
              <p style={{ margin: 0, color: "var(--ink-2)" }}>Membership is limited. Already a member? <Link href="/signin">Log in</Link>.</p>
            )}
          </div>
          <WaitlistForm referral={referral} />
        </div>
      </section>
    </div>
  );
}
