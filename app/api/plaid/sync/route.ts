import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { syncAll } from "@/lib/sync";

export async function POST(req: Request) {
  const g = await guard(req);
  if (g instanceof NextResponse) return g;
  const results = await syncAll(g.email);
  return NextResponse.json({ results });
}
