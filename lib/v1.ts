import "server-only";
import { NextResponse } from "next/server";
import { loadDashboard } from "./data";
import { bearer, API_HEADERS } from "./tokens";
import type { Dashboard } from "./model";

/** Shared wrapper for /api/v1 GET routes: auth, then shape the member's own dashboard. */
export async function v1(req: Request, shape: (d: Dashboard, url: URL) => unknown) {
  const auth = await bearer(req);
  if (auth instanceof NextResponse) return auth;
  const d = await loadDashboard(auth.email);
  if (d.sample) {
    return NextResponse.json({ connected: false, message: "No accounts are connected yet. Connect one in Apex → Settings." }, { headers: API_HEADERS });
  }
  return NextResponse.json({ connected: true, as_of: d.asOf, currency: "USD", ...(shape(d, new URL(req.url)) as object) }, { headers: API_HEADERS });
}
