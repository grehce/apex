// Runs before `next build` on Vercel: creates/updates tables so nobody has to handle DATABASE_URL by hand.
// Additive schema changes apply automatically; anything that would drop data makes drizzle-kit stop and fail the build.
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("[migrate] DATABASE_URL not set — skipping schema push.");
  process.exit(0);
}
const r = spawnSync("npx", ["drizzle-kit", "push"], { stdio: ["ignore", "inherit", "inherit"], env: process.env });
process.exit(r.status ?? 1);
