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
      return Boolean(email && profile?.email_verified && allowedEmails().has(email));
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      // "/" is public: it shows the sample-data demo to signed-out visitors.
      const isPublic = pathname === "/" || pathname === "/signin" || pathname.startsWith("/api/auth");
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
