"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountRow } from "@/lib/model";
import type { ManualEntry } from "@/lib/manual-assets";
import { dollars, type Address, type LoanDetails } from "@/lib/property";
import { HomeCard } from "../settings/HomeCard";
import { money } from "@/lib/model";
import { HomeSheet } from "../settings/HomeSheet";

type Draft = { id?: string; name: string; kind: "asset" | "liability"; category: "property" | "mortgage" | "other"; value: string; valuationDate: string; liabilityConfirmed: boolean };
const blank = (kind: Draft["kind"]): Draft => ({ name: "", kind, category: "other", value: "", valuationDate: new Date().toISOString().slice(0, 10), liabilityConfirmed: false });
const isHome = (e: ManualEntry) => e.kind === "asset" && e.category === "property";

type Props = {
  entries: ManualEntry[];
  accounts: AccountRow[];
  signedIn: boolean;
  addresses?: Record<string, Address>;
  estimatesEnabled?: boolean;
  loanDetails?: Record<string, LoanDetails>;
  onShareLoan?: (itemId: string) => void;
  shareDisabled?: boolean;
};

/**
 * Things Plaid can't see. Homes get their own flow (address → estimate → mortgage);
 * everything else is a simple dated value.
 */
export function ManualAssets({ entries, accounts, signedIn, addresses = {}, estimatesEnabled = false, loanDetails = {}, onShareLoan, shareDisabled }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [home, setHome] = useState<{ entryId?: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mortgages = accounts.filter((a) => a.subtype === "mortgage");
  const guard = (fn: () => void) => () => (signedIn ? fn() : router.push("/signin"));

  async function save(payload: object, method: "POST" | "PATCH") {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/manual-assets", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Unable to save entry");
      setDraft(null); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function edit(e: ManualEntry) {
    setError("");
    if (isHome(e)) { setDraft(null); setHome({ entryId: e.id }); return; }
    setHome(null);
    setDraft({ id: e.id, name: e.name, kind: e.kind, category: e.category, value: String(e.value), valuationDate: e.valuationDate, liabilityConfirmed: false });
  }
  const editingHome = home?.entryId ? entries.find((e) => e.id === home.entryId) : undefined;

  return <section id="manual-assets" className="card" aria-labelledby="ma-h">
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h2 id="ma-h">Assets outside your connections</h2>
      <p className="muted" style={{ fontSize: 14 }}>For what Plaid can&apos;t see — your home, a car, a private loan. Linked accounts are already counted above; don&apos;t add them again.</p>
    </div>

    <div className="type-tiles" role="group" aria-label="Add something">
      <button type="button" className="type-tile" disabled={busy} onClick={guard(() => { setDraft(null); setError(""); setHome({}); })}>
        <strong>Home</strong><span className="muted" style={{ fontSize: 12 }}>{estimatesEnabled ? "Address → automatic estimate" : "Primary residence value"}</span>
      </button>
      <button type="button" className="type-tile" disabled={busy} onClick={guard(() => { setHome(null); setError(""); setDraft(blank("asset")); })}>
        <strong>Other asset</strong><span className="muted" style={{ fontSize: 12 }}>Car, collectibles, private stake</span>
      </button>
      <button type="button" className="type-tile" disabled={busy} onClick={guard(() => { setHome(null); setError(""); setDraft(blank("liability")); })}>
        <strong>Other debt</strong><span className="muted" style={{ fontSize: 12 }}>Only if not already linked</span>
      </button>
    </div>

    {home && <HomeSheet mortgages={mortgages} entry={editingHome} entryAddress={editingHome ? addresses[editingHome.id] ?? null : null} estimatesEnabled={estimatesEnabled} onClose={() => setHome(null)} />}

    {error && <p role="alert">{error}</p>}
    {draft && <form className="grid-2 manual-entry-form inner" onSubmit={(e) => { e.preventDefault(); void save({ ...draft, value: Number(draft.value), linkedMortgageId: null }, draft.id ? "PATCH" : "POST"); }}>
      <label>Name<input required maxLength={100} value={draft.name} placeholder={draft.kind === "asset" ? "e.g. 2021 Model Y" : "e.g. Loan from family"} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>{draft.kind === "asset" ? "Current value (USD)" : "Outstanding balance (USD)"}<input type="number" required min="0" max="1000000000000" step="0.01" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></label>
      <label>As of<input type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={draft.valuationDate} onChange={(e) => setDraft({ ...draft, valuationDate: e.target.value })} /></label>
      {draft.kind === "liability" && <label style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}><input type="checkbox" required checked={draft.liabilityConfirmed} onChange={(e) => setDraft({ ...draft, liabilityConfirmed: e.target.checked })} /> I checked my linked accounts; this debt isn&apos;t already counted there.</label>}
      <div className="row"><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button><button className="btn" type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button></div>
    </form>}

    {entries.length === 0 && !home && !draft && <p className="muted">Nothing added yet.</p>}
    {entries.filter(isHome).filter((e) => home?.entryId !== e.id).map((e) => {
      const mortgage = mortgages.find((m) => m.id === e.linkedMortgageId) ?? null;
      return <HomeCard key={e.id} entry={e} address={addresses[e.id] ?? null} mortgage={mortgage} loan={mortgage ? loanDetails[mortgage.id] ?? null : null}
        signedIn={signedIn} busy={busy} onEdit={() => edit(e)} onArchive={() => void save({ id: e.id, archived: !e.archived }, "PATCH")} onShareLoan={onShareLoan} shareDisabled={shareDisabled} />;
    })}
    {entries.filter((e) => !isHome(e)).map((e) => {
      const addr = addresses[e.id];
      const estimate = e.valuationSource === "estimate";
      return <div key={e.id} className="row between" style={{ padding: "12px 0", gap: 12, borderTop: "1px dashed var(--line-dash)", opacity: e.archived ? .65 : 1 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 240px", minWidth: 0 }}>
          <span><strong>{isHome(e) ? (addr ? addr.street : e.name) : e.name}</strong> <span className="mono muted" style={{ fontSize: 12 }}>{isHome(e) ? "home" : e.kind === "liability" ? "debt" : "asset"}</span></span>
          <span className="mono muted" style={{ fontSize: 12 }}>
            {isHome(e) && addr ? `${addr.city}, ${addr.region} · ` : ""}
            {estimate ? `est. ${dollars(e.estimateLow ?? e.value)}–${dollars(e.estimateHigh ?? e.value)} · ${e.valuationProvider ?? "auto"} · refreshes monthly` : `your value · as of ${e.valuationDate}`}
            {e.archived ? " · archived, excluded" : ""}
          </span>
        </span>
        <span className="mono num">{e.kind === "liability" ? "−" : ""}{isHome(e) ? dollars(e.value) : money(e.value)}</span>
        <div className="row" style={{ gap: 8 }}>
          <button className="chip" disabled={busy || !signedIn} onClick={() => edit(e)}>edit</button>
          <button className="chip" disabled={busy || !signedIn} onClick={() => void save({ id: e.id, archived: !e.archived }, "PATCH")}>{e.archived ? "restore" : "archive"}</button>
        </div>
      </div>;
    })}
  </section>;
}
