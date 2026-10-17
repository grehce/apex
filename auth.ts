import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/** Emails allowed to sign in, from ALLOWED_EMAILS (comma-separated). Empty list = nobody. */
function allowedEmails(): Set<string> {
  return new Set(
    (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/signin", error: "/signin" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  trustHost: true,
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      // Google must have verified the address, and it must be on the allowlist.
      if (email && profile?.email_verified && allowedEmails().has(email)) return true;
      // Everyone else goes to the waitlist instead of an error.
      return "/waitlist?denied=1";
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      // Every page is browsable signed out — visitors see the whole app on sample data.
      // Anything that touches real data (API routes) still requires a session.
      const PUBLIC = ["/robots.txt", "/sitemap.xml", "/llms.txt", "/", "/signin", "/networth", "/portfolio", "/spending", "/ledger", "/agent", "/settings"];
      const isPublic = PUBLIC.includes(pathname) || pathname === "/waitlist" || pathname.startsWith("/api/auth") || pathname === "/api/waitlist";
      if (isPublic) return true;
      return Boolean(auth?.user?.email);
    },
  },
});

/** Server-side guard for pages and route handlers. Returns the signed-in email or null. */
export async function currentEmail(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email || !allowedEmails().has(email)) return null;
  return email;
}
