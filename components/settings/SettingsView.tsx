"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import type { ItemRow } from "@/lib/model";
import { InstitutionMark } from "../Mark";

type Props = {
  items: ItemRow[];
  sample: boolean;
  setup: { plaid: boolean; db: boolean; encryption: boolean };
  plaidEnv: string;
  email: string;
  demo?: boolean; // signed out: browse sample accounts; any action goes to sign up / log in
};

async function post(url: string, body: unknown, method = "POST") {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j;
}

function ago(iso: string | null) {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function SettingsView({ items, sample, setup, plaidEnv, email, demo = false }: Props) {
  const router = useRouter();
  const ready = demo || (setup.plaid && setup.db && setup.encryption);
  const toSignIn = () => router.push("/signin");
  const [token, setToken] = useState<string | null>(null);
  const [updateItem, setUpdateItem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const onSuccess = useCallback(
    async (publicToken: string | null) => {
      if (!publicToken) return;
      setBusy(updateItem ? "Reconnecting…" : "Fetching accounts…");
      try {
        if (updateItem) await post("/api/plaid/sync", {});
        else await post("/api/plaid/exchange", { publicToken });
        setMsg({ kind: "ok", text: updateItem ? "Reconnected." : "Account connected." });
        router.refresh();
      } catch (e) {
        setMsg({ kind: "err", text: (e as Error).message });
      } finally {
        setBusy(null);
        setToken(null);
        setUpdateItem(null);
      }
    },
    [router, updateItem],
  );

  const { open, ready: linkReady } = usePlaidLink({
    token,
    onSuccess,
    onExit: () => { setToken(null); setUpdateItem(null); },
  });

  useEffect(() => {
    if (token && linkReady) open();
  }, [token, linkReady, open]);

  async function startLink(itemId?: string) {
    if (demo) return toSignIn();
    setMsg(null);
    try {
      const j = await post("/api/plaid/link-token", itemId ? { itemId } : {});
      setUpdateItem(itemId ?? null);
      setToken(j.linkToken);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  }

  async function syncNow() {
    if (demo) return toSignIn();
    setBusy("Syncing…");
    setMsg(null);
    try {
      const j = await post("/api/plaid/sync", {});
      const failed = (j.results as { ok: boolean }[]).filter((r) => !r.ok).length;
      setMsg(failed ? { kind: "err", text: `${failed} institution(s) need attention.` } : { kind: "ok", text: "Synced." });
      router.refresh();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: ItemRow) {
    if (demo) return toSignIn();
    if (!confirm(`Disconnect ${item.institution}? This revokes Apex's access at Plaid and deletes its data here.`)) return;
    setBusy("Disconnecting…");
    try {
      await post("/api/plaid/item", { itemId: item.itemId }, "DELETE");
      router.refresh();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function toggleInclude(accountId: string, include: boolean) {
    if (demo) return toSignIn();
    try {
      await post("/api/plaid/item", { accountId, include }, "PATCH");
      router.refresh();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  }

  const accountCount = items.reduce((s, i) => s + i.accounts.length, 0);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section id="connections" aria-labelledby="c-h" className="card">
        <div className="row between" style={{ alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h1 id="c-h" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Connections</h1>
            <span className="mono muted" style={{ fontSize: 12 }}>
              {sample ? "no accounts connected yet" : `${items.length} institutions · ${accountCount} accounts`} · plaid {plaidEnv}
            </span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {!sample && <button type="button" className="btn" onClick={syncNow} disabled={!ready || !!busy}>Sync now</button>}
            <button type="button" className="btn btn-primary" onClick={() => startLink()} disabled={!ready || !!busy}>+ Connect account</button>
          </div>
        </div>

        <div className="banner dots">
          <span>
            Accounts connect through <strong style={{ color: "var(--ink)" }}>Plaid</strong> with read-only access. Your bank login goes to Plaid and your bank — never to Apex. Access tokens are encrypted before they&apos;re stored.
          </span>
        </div>

        {(busy || msg) && (
          <div role="status" className="mono" style={{ fontSize: 13, color: msg?.kind === "err" ? "var(--warn)" : "var(--accent-ink)" }}>
            {busy ?? msg?.text}
          </div>
        )}

        {!ready && !demo && (
          <div className="inner hatch" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <strong>Setup needed before connecting real accounts</strong>
            <span className="mono" style={{ fontSize: 12 }}>{setup.plaid ? "✓" : "✕"} PLAID_CLIENT_ID / PLAID_SECRET</span>
            <span className="mono" style={{ fontSize: 12 }}>{setup.db ? "✓" : "✕"} DATABASE_URL</span>
            <span className="mono" style={{ fontSize: 12 }}>{setup.encryption ? "✓" : "✕"} ENCRYPTION_KEY</span>
            <span className="muted" style={{ fontSize: 13 }}>Set these as environment variables in Vercel (see README). They never go in the code or the chat.</span>
          </div>
        )}

        {!sample && (
          <div>
            {items.map((item) => (
              <div key={item.itemId} style={{ borderTop: "1px dashed var(--line-dash)", padding: "14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="row" style={{ gap: "12px 16px" }}>
                  <InstitutionMark name={item.institution} />
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{item.institution}</div>
                    <div className="mono" style={{ fontSize: 12, color: item.status === "ok" ? "var(--accent-ink)" : "var(--warn)" }}>
                      {item.status === "ok" ? `synced ${ago(item.lastSyncedAt)}` : item.status === "login_required" ? "login expired — reconnect" : "sync error"}
                    </div>
                  </div>
                  {item.status !== "ok" && <button type="button" className="btn btn-warn" style={{ minHeight: 36 }} onClick={() => startLink(item.itemId)}>Reconnect</button>}
                  <button type="button" className="chip" onClick={() => remove(item)}>disconnect</button>
                </div>
                {item.accounts.map((a) => (
                  <div key={a.id} className="row" style={{ paddingLeft: 56, gap: 12 }}>
                    <span style={{ flex: "1 1 200px", minWidth: 0, fontSize: 14 }}>
                      {a.name} <span className="mono muted" style={{ fontSize: 12 }}>{a.subtype ?? a.type}{a.mask ? ` ••${a.mask}` : ""}</span>
                    </span>
                    <span className="mono num" style={{ fontSize: 13 }}>{a.balance < 0 ? "−" : ""}${Math.abs(a.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="row mono muted" style={{ gap: 8, fontSize: 11 }}>
                      in net worth
                      <button type="button" role="switch" aria-checked={a.include} aria-label={`Include ${a.name} in net worth`} className="switch" style={{ width: 44, height: 26 }} onClick={() => toggleInclude(a.id, !a.include)}>
                        <span style={{ width: 20, height: 20, left: a.include ? 21 : 3 }} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="security" aria-labelledby="s-h" className="card" style={{ gap: 10 }}>
        <h2 id="s-h">Sign-in &amp; security</h2>
        <div className="list-row">
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ fontWeight: 600 }}>Google account</div>
            <div className="mono muted" style={{ fontSize: 12 }}>{email} · only sign-in method</div>
          </div>
          <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer">Manage in Google</a>
        </div>
        <div className="list-row">
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ fontWeight: 600 }}>Access list</div>
            <div className="muted" style={{ fontSize: 14 }}>Only emails in ALLOWED_EMAILS can sign in. Sessions expire after 12 hours.</div>
          </div>
        </div>
      </section>

      <section id="agent" aria-labelledby="a-h" className="card card-dark dots-dark" style={{ gap: 4 }}>
        <h2 id="a-h" style={{ marginBottom: 6 }}>Agent permissions</h2>
        {[
          ["Read balances & holdings", "needed for drift and plans", "on"],
          ["Propose & simulate plans", "you review every plan", "on"],
          ["Place trades", "Apex connects read-only · you place trades", "locked"],
        ].map(([n, s, st]) => (
          <div key={n} className="list-row list-row-dark">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: st === "locked" ? "var(--dark-muted)" : "var(--dark-text)" }}>{n}</div>
              <div className="mono" style={{ fontSize: 12, color: "var(--dark-muted)" }}>{s}</div>
            </div>
            <span className="mono" style={{ fontSize: 11, color: "var(--dark-muted)", border: "1px solid #3A3F3C", padding: "3px 8px", borderRadius: 3 }}>{st === "locked" ? "not available" : "always on"}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
