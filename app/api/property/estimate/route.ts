import { NextResponse } from "next/server";
import { currentEmail } from "@/auth";
import { sameOrigin } from "@/lib/manual-assets";
import { validateAddress } from "@/lib/property";
import { ValuationError, valuationProvider } from "@/lib/valuation";

/** Preview a home value estimate for an address. Nothing is stored until the member saves the home. */
export async function POST(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  const provider = valuationProvider();
  if (!provider) return NextResponse.json({ error: "Automatic estimates aren't set up yet. Enter your own value." }, { status: 503 });
  let address;
  try { address = validateAddress((await req.json().catch(() => null))?.address); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  try {
    const estimate = await provider.estimate(address);
    if (!estimate) return NextResponse.json({ error: "No estimate for this address — it may be too new, rural or unusual for nearby sales to price. Enter your own value." }, { status: 404 });
    return NextResponse.json({ estimate });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ValuationError ? e.message : "Couldn't get an estimate. Enter your own value." }, { status: 502 });
  }
}
