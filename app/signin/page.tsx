import { redirect } from "next/navigation";
import { signIn, currentEmail } from "@/auth";
import { ValuePanel } from "@/components/ValuePanel";

export const metadata = { title: "Sign up / Log in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentEmail()) redirect("/");
  const { error } = await searchParams;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap" }}>
      <ValuePanel />

      <section aria-labelledby="si-h" style={{ flex: "1 1 460px", minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(28px, 6vw, 48px) 20px" }}>
        <div className="anim-in" style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a href="/" className="back">← back to apex</a>
            <span className="eyebrow">auth · google</span>
            <h2 id="si-h" style={{ fontSize: "clamp(28px, 7vw, 34px)", fontWeight: 700, letterSpacing: "-0.03em" }}>Sign up or log in</h2>
            <p style={{ margin: 0, color: "var(--ink-2)" }}>
              One Google account, protected by Google’s security.
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
            Not a member yet? <a href="/waitlist">Request an invitation →</a>
          </p>

          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Access is limited to approved Google accounts.
          </p>
        </div>
      </section>
    </div>
  );
}
