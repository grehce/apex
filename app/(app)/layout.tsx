import Link from "next/link";
import { currentEmail, signOut } from "@/auth";
import { ApexMark } from "@/components/Mark";
import { NavLinks } from "@/components/NavLinks";

// Every page in this group works signed out (sample data) and signed in (your data).
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
          <NavLinks />
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
              Sign up / Log in
            </Link>
          )}
        </div>
      </header>
      {children}
    </>
  );
}
