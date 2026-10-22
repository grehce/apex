"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { exchangeBody, logLinkEvent } from "@/lib/link-client";
import { ATTENTION_COPY, type Attention } from "@/lib/plaid-attention";
import type { ItemRow } from "@/lib/model";
import { InstitutionLogo } from "../InstitutionLogo";
import { AgentAccess } from "./AgentAccess";
import { ManualAssets } from "../networth/ManualAssets";
import { HomeSheet } from "./HomeSheet";
import { dollars, equity, type Address, type LoanDetails } from "@/lib/property";
import type { ManualEntry } from "@/lib/manual-assets";
import { netWorthTotal, saveInclusion } from "@/lib/net-worth";
import { money } from "@/lib/model";

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

type Props = {
  manualEntries: ManualEntry[];
  initialNetWorth: number;
  items: ItemRow[];
  sample: boolean;
  setup: { plaid: boolean; db: boolean; encryption: boolean };
  email: string;
  demo?: boolean; // signed out: browse sample accounts; any action goes to sign up / log in
  addresses?: Record<string, Address>; // decrypted home addresses by manual entry id
  mortgageAddresses?: Record<string, Address | null>; // Plaid Liabilities property address by mortgage account id
  loanDetails?: Record<string, LoanDetails>; // what the servicer shared via Plaid, by mortgage account id
  estimatesEnabled?: boolean;
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

export function SettingsView({ items, manualEntries, initialNetWorth, sample, setup, email, demo = false, addresses = {}, mortgageAddresses = {}, loanDetails = {}, estimatesEnabled = false }: Props) {
  const router = useRouter();
  const ready = demo || (setup.plaid && setup.db && setup.encryption);
  const toSignIn = () => router.push("/signin");
  const [token, setToken] = useState<string | null>(null);
  const [updateItem, setUpdateItem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [inclusionOverrides, setInclusionOverrides] = useState<Record<string, boolean>>({});
  const [savingInclusion, setSavingInclusion] = useState(false);
  const [homeFor, setHomeFor] = useState<string | null>(null); // mortgage account id whose home sheet is open
  const [consenting, setConsenting] = useState(false); // update mode opened to share loan details
  const inclusionLock = useRef(false);
  useEffect(() => {
    if (inclusionLock.current) return;
    setInclusionOverrides((previous) => {
      const next = { ...previous };
      for (const a of items.flatMap((i) => i.accounts)) if (next[a.id] === a.include) delete next[a.id];
      return next;
    });
  }, [items]);
  const tally = sample ? initialNetWorth : netWorthTotal(items.flatMap((i) => i.accounts), manualEntries, inclusionOverrides);

  const onSuccess = useCallback(
    async (publicToken: string | null, metadata?: PlaidLinkOnSuccessMetadata) => {
      if (!publicToken) return;
      setBusy(updateItem ? "Reconnecting…" : "Fetching accounts…");
      try {
        if (updateItem) { await post("/api/plaid/sync", { resolvedItemId: updateItem }); setMsg({ kind: "ok", text: consenting ? "Loan details shared — see your home card below." : "Reconnected. Check the transaction status below." }); setConsenting(false); }
        else {
          const result = await post("/api/plaid/exchange", exchangeBody(publicToken, metadata));
          setMsg(result.synced === false ? { kind: "err", text: `Account connected, but sync needs attention: ${result.error ?? "SYNC_FAILED"}` } : { kind: "ok", text: result.transactionsPending ? "Account connected. Initial transactions are still loading." : "Account connected." });
        }
        router.refresh();
      } catch (e) {
        setMsg({ kind: "err", text: (e as Error).message });
      } finally {
        setBusy(null);
        setToken(null);
        setUpdateItem(null);
      }
    },
    [router, updateItem, consenting],
  );

  const { open, ready: linkReady } = usePlaidLink({
    token,
    onSuccess,
    onExit: (error, metadata) => { logLinkEvent(error ? "link_error" : "link_exit", { ...metadata, error }); setToken(null); setUpdateItem(null); },
    onEvent: (eventName, metadata) => { if (eventName === "ERROR") logLinkEvent("link_error", metadata); },
  });

  useEffect(() => {
    if (token && linkReady) open();
  }, [token, linkReady, open]);

  async function startLink(itemId?: string, consent?: "liabilities", newAccounts = false) {
    if (demo) return toSignIn();
    setMsg(null);
    try {
      const j = await post("/api/plaid/link-token", itemId ? { itemId, ...(consent ? { consent } : {}), ...(newAccounts ? { newAccounts: true } : {}) } : {});
      setUpdateItem(itemId ?? null);
      setConsenting(consent === "liabilities");
      // Saved so Link can resume on /oauth after a bank's own sign-in page.
      try { sessionStorage.setItem("apex.plaid.link", JSON.stringify({ token: j.linkToken, itemId: itemId ?? null })); } catch { /* ignore */ }
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
      const results = j.results as { ok: boolean; pending?: boolean }[];
      const failed = results.filter((r) => !r.ok).length, pending = results.filter((r) => r.pending).length;
      setMsg(failed ? { kind: "err", text: `${failed} institution(s) need attention.` } : { kind: "ok", text: pending ? `${pending} institution(s) still waiting for initial transactions.` : "Synced." });
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
    if (busy || inclusionLock.current) return;
    const before = inclusionOverrides;
    try {
      const saved = await saveInclusion(inclusionLock,
        async () => { const result = await post("/api/plaid/item", { accountId, include }, "PATCH"); if (result.warning) setMsg({ kind: "ok", text: result.warning }); },
        () => { setSavingInclusion(true); setMsg(null); setInclusionOverrides((current) => ({ ...current, [accountId]: include })); },
        () => setInclusionOverrides(before));
      if (saved) router.refresh();
    } catch (e) {
      setMsg({ kind: "err", text: `Inclusion change wasn't saved. ${(e as Error).message}` });
    } finally { setSavingInclusion(false); }
  }

  const accountCount = items.reduce((s, i) => s + i.accounts.length, 0);
  const allMortgages = demo || sample ? [] : items.flatMap((i) => i.accounts).filter((a) => a.subtype === "mortgage");
  const homeForMortgage = (id: string) => manualEntries.find((e) => !e.archived && e.kind === "asset" && e.category === "property" && e.linkedMortgageId === id);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section id="connections" aria-labelledby="c-h" className="card">
        <div className="row between" style={{ alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h1 id="c-h" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Connections</h1>
            <span className="mono muted" style={{ fontSize: 12 }}>
              {demo ? "Sample data · fictional institutions, accounts and balances" : (sample ? "no accounts connected yet" : `${items.length} institutions · ${accountCount} accounts`)}
            </span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {!sample && !demo && <button type="button" className="btn" onClick={syncNow} disabled={!ready || !!busy || savingInclusion}>Sync now</button>}
            <button type="button" className="btn btn-primary" onClick={() => startLink()} disabled={!ready || !!busy || savingInclusion}>+ Connect account</button>
          </div>
        </div>

        <div aria-live="polite" aria-atomic="true" style={{ padding: "16px 0", display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="eyebrow">{demo || sample ? "Sample net worth" : "Net worth"}</span>
          <strong className="mono num" style={{ fontSize: "clamp(26px, 6vw, 36px)" }}>{money(tally)}</strong>
          <span className="muted" style={{ fontSize: 12 }}>{savingInclusion ? "Saving inclusion preference…" : "Included accounts plus active manual assets, less liabilities. Matches Overview."}</span>
        </div>

        <div className="banner dots">
          <span>
            {demo ? "Demo only — no bank accounts are connected. Sign in to connect your own accounts." : <>Read-only through <strong style={{ color: "var(--ink)" }}>Plaid</strong> · your bank login never reaches Apex · tokens encrypted</>}
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
                <div className="inst-head">
                  <InstitutionLogo name={item.institution} logo={demo ? null : item.logo} />
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{item.institution}</div>
                    <div className="mono" style={{ fontSize: 12, color: item.status === "ok" && !item.attention ? "var(--accent-ink)" : "var(--warn)" }}>
                      {demo ? "Sample institution · fictional balances" : item.attention && item.attention in ATTENTION_COPY ? ATTENTION_COPY[item.attention as Attention] : item.status === "ok" ? `synced ${ago(item.lastSyncedAt)}` : item.status === "login_required" ? "login expired — reconnect" : "sync error"}
                    </div>
                    {!demo && item.lastWebhookAt && <div className="mono muted" style={{ fontSize: 11 }}>live updates on · last heard from Plaid {ago(item.lastWebhookAt)}</div>}
                    {!demo && item.transactionsState && item.transactionsState !== "ready" && <div className="mono muted" style={{ fontSize: 12 }}>{item.transactionsState === "unknown" ? "Transaction readiness not yet checked" : item.transactionsState === "pending" ? "Initial transactions pending" : `Transactions need attention: ${item.transactionsError ?? item.transactionsState}`}</div>}
                  </div>
                  <div className="inst-actions">
                    {(item.status !== "ok" || item.attention) && <button type="button" className="btn btn-warn" disabled={savingInclusion || !!busy} style={{ minHeight: 36 }} onClick={() => startLink(item.itemId, undefined, item.attention === "new_accounts")}>{item.attention === "new_accounts" ? "Add accounts" : "Reconnect"}</button>}
                    <button type="button" className="chip" disabled={savingInclusion || !!busy} onClick={() => remove(item)}>disconnect</button>
                  </div>
                </div>
                {item.accounts.map((account) => {
                  const a = { ...account, include: inclusionOverrides[account.id] ?? account.include };
                  const home = a.subtype === "mortgage" ? homeForMortgage(a.id) : undefined;
                  const eq = home ? equity(home.value, Math.abs(a.balance)) : null;
                  return (
                  <Fragment key={a.id}>
                  <div className="acct-row">
                    <span className="acct-name">{a.name}</span>
                    <span className="acct-meta mono muted">{a.subtype ?? a.type}{a.mask ? ` ••${a.mask}` : ""}</span>
                    <span className="acct-bal mono num">{a.balance < 0 ? "−" : ""}${Math.abs(a.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="acct-inc mono muted">
                      <span className="acct-inc-label">in net worth</span>
                      <button type="button" role="switch" aria-checked={a.include} aria-label={`Include ${a.name} in net worth`} disabled={savingInclusion || !!busy} className="switch" style={{ width: 44, height: 26 }} onClick={() => toggleInclude(a.id, !a.include)}>
                        <span style={{ width: 20, height: 20, left: a.include ? 21 : 3 }} />
                      </button>
                    </span>
                  </div>
                  {a.subtype === "mortgage" && !demo && !sample && home && homeFor !== a.id && (
                    <div className="home-link" style={{ paddingTop: 2, paddingBottom: 2 }}>
                      <span className="mono muted" style={{ fontSize: 12 }}>
                        secures {addresses[home.id]?.street ?? home.name} · <a href={`#home-${home.id}`}>home &amp; loan details ↓</a>
                      </span>
                    </div>
                  )}
                  {a.subtype === "mortgage" && !home && homeFor !== a.id && (
                    <div className="home-link inner hatch">
                      <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                        <strong>Home value not added.</strong> <span className="muted">Net worth counts this mortgage but not the home it pays for.</span>
                      </span>
                      {!demo && !sample && !(a.id in loanDetails) && <button type="button" className="btn btn-sm" disabled={!ready || !!busy || savingInclusion} onClick={() => startLink(item.itemId, "liabilities")}>Share loan details</button>}
                      <button type="button" className="btn" style={{ minHeight: 36 }} disabled={!!busy} onClick={() => (demo ? toSignIn() : setHomeFor(a.id))}>Add home</button>
                    </div>
                  )}
                  {homeFor === a.id && (
                    <div style={{ marginLeft: 56 }} className="home-sheet-wrap">
                      <HomeSheet mortgages={allMortgages} fixedMortgageId={a.id} prefill={mortgageAddresses[a.id] ?? null} entry={home} entryAddress={home ? addresses[home.id] ?? null : null} estimatesEnabled={estimatesEnabled} onClose={() => setHomeFor(null)} />
                    </div>
                  )}
                  </Fragment>
                ); })}
              </div>
            ))}
          </div>
        )}
      </section>

      <ManualAssets entries={manualEntries} accounts={allMortgages} signedIn={!demo} addresses={addresses} estimatesEnabled={estimatesEnabled}
        loanDetails={loanDetails} onShareLoan={(itemId: string) => startLink(itemId, "liabilities")} shareDisabled={!ready || !!busy || savingInclusion} />

      <section id="security" aria-labelledby="s-h" className="card" style={{ gap: 10 }}>
        <h2 id="s-h">Sign-in &amp; security</h2>
        <div className="list-row">
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ fontWeight: 600 }}>Google account</div>
            <div className="mono muted" style={{ fontSize: 12 }}>{email} · only sign-in method</div>
          </div>
          <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer">Manage in Google</a>
        </div>
        {demo && <div className="list-row">
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ fontWeight: 600 }}>Access list</div>
            <div className="muted" style={{ fontSize: 14 }}>Only approved Google accounts can sign in.</div>
          </div>
        </div>}
      </section>

      <AgentAccess demo={demo} />

      <section id="agent" aria-labelledby="a-h" className="card card-dark dots-dark" style={{ gap: 4 }}>
        <h2 id="a-h" style={{ marginBottom: 6 }}>Agent permissions</h2>
        {[
          ["Read balances & holdings", "needed for drift and plans", "on"],
          ["Propose & simulate plans", "you review every plan", "on"],
          ["Outside agents, with your key", "read-only · revoke any time above", "on"],
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
