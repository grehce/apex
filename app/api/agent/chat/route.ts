import { NextResponse } from "next/server";
import { currentEmail } from "@/auth";
import { loadDashboard } from "@/lib/data";
import { agentConfigured, runAgent, type AgentEvent, type ChatTurn } from "@/lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Per-member limit (per server instance): 30 questions per 10 minutes.
const hits = new Map<string, number[]>();
function limited(email: string) {
  const now = Date.now();
  const recent = (hits.get(email) ?? []).filter((t) => now - t < 600_000);
  recent.push(now);
  hits.set(email, recent);
  return recent.length > 30;
}

function parseHistory(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
  const turns: ChatTurn[] = [];
  for (const t of raw) {
    if (!t || (t.role !== "user" && t.role !== "assistant") || typeof t.content !== "string") return null;
    const content = t.content.trim().slice(0, t.role === "user" ? 2000 : 6000);
    if (!content) return null;
    turns.push({ role: t.role, content });
  }
  if (turns[0].role !== "user" || turns[turns.length - 1].role !== "user") return null;
  for (let i = 1; i < turns.length; i++) if (turns[i].role === turns[i - 1].role) return null;
  return turns;
}

/** Ask the agent. Streams newline-delimited JSON events: step…, then answer (or error). */
export async function POST(req: Request) {
  const email = await currentEmail();
  if (!email) return NextResponse.json({ error: "Sign in to ask the agent." }, { status: 401 });
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (!agentConfigured()) return NextResponse.json({ error: "The agent isn't switched on yet (no ANTHROPIC_API_KEY)." }, { status: 503 });
  if (limited(email)) return NextResponse.json({ error: "That's a lot of questions. Give it a few minutes." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { messages?: unknown };
  const history = parseHistory(body.messages);
  if (!history) return NextResponse.json({ error: "bad conversation" }, { status: 400 });

  const d = await loadDashboard(email);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const emit = (e: AgentEvent) => ctrl.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await runAgent(history, d, emit);
      } catch (e) {
        const msg = (e as { status?: number }).status === 429 ? "The model is busy right now. Try again in a moment." : "Something went wrong reaching the model. Try again.";
        console.error("agent error", e);
        emit({ type: "error", message: msg });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
