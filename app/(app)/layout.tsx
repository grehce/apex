import Link from "next/link";
import { currentEmail, signOut } from "@/auth";
import { ApexMark } from "@/components/Mark";
import { NavLinks } from "@/components/NavLinks";

// Pages in this group decide for themselves whether they need a session:
// "/" shows a public demo when signed out; /agent and /settings redirect to /signin.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const email = await currentEmail();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <ApexMark />
            Apex
          </Link>
          <NavLinks signedIn={Boolean(email)} />
          {email ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="btn" style={{ minHeight: 40, fontWeight: 500 }} title={email}>
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/signin" className="btn btn-primary" style={{ minHeight: 40 }}>
              Sign in
            </Link>
          )}
        </div>
      </header>
      {children}
    </>
  );
}
