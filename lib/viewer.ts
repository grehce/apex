import "server-only";
import { currentEmail } from "@/auth";
import { loadDashboard, loadSampleDashboard } from "./data";

/** Signed out: the public sample demo. Signed in: that account's own data. */
export async function viewerDashboard() {
  const email = await currentEmail();
  const d = email ? await loadDashboard(email) : loadSampleDashboard();
  return { email, d };
}
