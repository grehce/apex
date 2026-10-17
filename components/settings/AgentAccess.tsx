"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tok = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };

async function call(url: string, method = "GET", body?: unknown) {
  const r = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j;
}
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "never");

/** Read-only API keys for outside agents (Muse, Claude, ChatGPT…). */
export function AgentAccess({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [tokens, setTokens] = useState<Tok[]>([]);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demo) return;
    call("/api/tokens").then((j) => setTokens(j.tokens)).catch(() => {});
  }, [demo]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (demo) return router.push("/signin");
    setErr(null); setBusy(true);
    try {
      const j = await call("/api/tokens", "POST", { name });
      setFresh({ token: j.token, name });
      setCopied(false);
      setName("");
      setTokens((await call("/api/tokens")).tokens);
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setErr(null);
    try { await call(`/api/tokens/${id}`, "DELETE"); setTokens((t) => t.filter((x) => x.id !== id)); } catch (e2) { setErr((e2 as Error).message); }
  }

  const field: React.CSSProperties = { flex: "1 1 200px", minWidth: 0, height: 44, padding: "0 12px", border: "1px solid var(--line-strong)", borderRadius: 4, background: "var(--field)", color: "var(--ink)", font: "inherit" };
  return (
    <section id="agent-access" aria-labelledby="aa-h" className="card" style={{ gap: 12 }}>
      <div>
        <h2 id="aa-h">Agent access</h2>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>
          Give an AI agent like Muse, Claude or ChatGPT a <strong style={{ color: "var(--ink)" }}>read-only</strong> key to your Apex data. It can read balances, holdings, transactions and plans. It can&apos;t move money, place trades or change anything.{" "}
          <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">API reference</a>
        </p>
      </div>

      <form onSubmit={create} className="row" style={{ gap: 8 }}>
        <label className="sr-only" htmlFor="tok-name">Key name</label>
        <input id="tok-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="name it, e.g. Muse" style={field} />
        <button type="submit" className="btn btn-primary" disabled={busy || (!demo && !name.trim())}>{busy ? "Creating…" : "Create key"}</button>
      </form>

      {fresh && (
        <div className="inner anim-in" role="status" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <strong>Copy your “{fresh.name}” key now. Apex won&apos;t show it again.</strong>
          <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
            <code className="mono" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "10px 12px", border: "1px dashed var(--line-strong)", borderRadius: 4, fontSize: 13, background: "var(--field)" }}>{fresh.token}</code>
            <button type="button" className="btn" onClick={async () => { try { await navigator.clipboard.writeText(fresh.token); setCopied(true); } catch { /* ignore */ } }}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          <span className="note">Paste it into the agent as an API key, with the API reference link above. Treat it like a password.</span>
          <button type="button" className="chip" style={{ alignSelf: "flex-start" }} onClick={() => setFresh(null)}>done</button>
        </div>
      )}

      {err && <div role="alert" className="banner" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>{err}</div>}

      {tokens.length > 0 && (
        <div>
          {tokens.map((t) => (
            <div key={t.id} className="list-row">
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div className="mono muted" style={{ fontSize: 12 }}>{t.prefix}… · created {day(t.createdAt)} · last used {day(t.lastUsedAt)}</div>
              </div>
              <button type="button" className="btn btn-warn" style={{ minHeight: 36 }} onClick={() => revoke(t.id)}>Revoke</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
