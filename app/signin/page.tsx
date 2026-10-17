import { redirect } from "next/navigation";
import { signIn, currentEmail } from "@/auth";
import { ApexMark } from "@/components/Mark";

export const metadata = { title: "Sign up / Log in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentEmail()) redirect("/");
  const { error } = await searchParams;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap" }}>
      <section
        className="dots-dark"
        aria-label="About Apex"
        style={{ flex: "1 1 520px", minWidth: 0, backgroundColor: "var(--dark)", color: "var(--dark-text)", padding: "clamp(24px, 6vw, 48px)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 48, minHeight: "min(560px, 100vh)" }}
      >
        <div className="row">
          <ApexMark size={34} ink="#EDEFEA" ground="#17191A" accent="#3DFF8B" />
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>Apex</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
          <h1 style={{ fontSize: "clamp(36px, 9vw, 52px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02 }}>
            Every account.
            <br />
            <span className="hl-dark">One clear view.</span>
          </h1>
          <p style={{ margin: 0, fontSize: 18, color: "#B9C0BA" }}>
            Net worth, spending and portfolio in one place — with an agent that proposes, and you decide.
          </p>
        </div>
        <div className="scan mono" style={{ backgroundColor: "#1F2321", border: "1px solid var(--dark-line)", borderRadius: "var(--r-card)", padding: "18px 20px", fontSize: 13, display: "flex", flexDirection: "column", gap: 8, maxWidth: 520 }}>
          <span style={{ color: "var(--dark-muted)" }}>apex&gt; security --summary</span>
          <span><span style={{ color: "var(--accent-soft)" }}>✓</span> sign-in via Google · no Apex password to leak</span>
          <span><span style={{ color: "var(--accent-soft)" }}>✓</span> read-only via Plaid · bank logins never touch Apex</span>
          <span><span style={{ color: "var(--accent-soft)" }}>✓</span> bank tokens encrypted at rest (AES-256-GCM)</span>
          <span><span style={{ color: "var(--accent-soft)" }}>✓</span> agent can propose, never move money<span className="blink">_</span></span>
        </div>
      </section>

      <section aria-labelledby="si-h" style={{ flex: "1 1 460px", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(28px, 6vw, 48px) 20px" }}>
        <div className="anim-in" style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a href="/" className="back">← back to the demo</a>
            <span className="eyebrow">auth · google</span>
            <h2 id="si-h" style={{ fontSize: "clamp(28px, 7vw, 34px)", fontWeight: 700, letterSpacing: "-0.03em" }}>Sign up or log in</h2>
            <p style={{ margin: 0, color: "var(--ink-2)" }}>
              One Google account does both — your first sign-in creates your Apex. Turn on 2-Step Verification in Google and it protects Apex too.
            </p>
          </div>

          {error && (
            <div role="alert" className="banner" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
              {error === "AccessDenied"
                ? "That Google account isn't on this Apex's access list."
                : "Sign-in didn't complete. Please try again."}
            </div>
          )}

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            {/* Per Google's Sign in with Google branding guidelines (light theme): white fill, 1px #747775 stroke,
                #1F1F1F Google Sans Medium 14/20, standard-color G (official asset, not redrawn), 12/10/12 padding. */}
            <button
              type="submit"
              style={{ width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 12px", background: "#FFFFFF", border: "1px solid #747775", borderRadius: 4, color: "#1F1F1F", fontFamily: "'Google Sans', Roboto, Arial, sans-serif", fontWeight: 500, fontSize: 14, lineHeight: "20px", cursor: "pointer" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://developers.google.com/static/identity/images/g-logo.png" alt="" width={20} height={20} />
              Continue with Google
            </button>
          </form>

          <p style={{ margin: 0, fontSize: 14 }}>
            Not invited yet? <a href="/waitlist">Join the waitlist →</a>
          </p>

          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Access is limited to approved Google accounts. Sessions last 12 hours.
          </p>
        </div>
      </section>
    </div>
  );
}
