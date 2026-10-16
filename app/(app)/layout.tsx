import Link from "next/link";
import { redirect } from "next/navigation";
import { currentEmail, signOut } from "@/auth";
import { ApexMark } from "@/components/Mark";
import { NavLinks } from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const email = await currentEmail();
  if (!email) redirect("/signin");

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <ApexMark />
            Apex
          </Link>
          <NavLinks />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button type="submit" className="btn" style={{ minHeight: 40, fontWeight: 500 }} title={email}>
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}
