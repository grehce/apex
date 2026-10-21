"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountRow } from "@/lib/model";
import type { ManualEntry } from "@/lib/manual-assets";
import { money } from "@/lib/model";

type Draft = { id?: string; name: string; kind: "asset" | "liability"; category: "property" | "mortgage" | "other"; value: string; valuationDate: string; linkedMortgageId: string; liabilityConfirmed: boolean };
const blank = (): Draft => ({ name: "", kind: "asset", category: "property", value: "", valuationDate: new Date().toISOString().slice(0, 10), linkedMortgageId: "", liabilityConfirmed: false });

export function ManualAssets({ entries, accounts, signedIn }: { entries: ManualEntry[]; accounts: AccountRow[]; signedIn: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mortgages = accounts.filter((a) => a.subtype === "mortgage");
  const suggestions = mortgages.filter((a) => a.include && !dismissed.includes(a.id) && !entries.some((e) => !e.archived && e.kind === "asset" && e.category === "property" && e.linkedMortgageId === a.id));

  async function save(payload: object, method: "POST" | "PATCH") {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/manual-assets", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Unable to save entry");
      setDraft(null); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function edit(e: ManualEntry) { setError(""); setDraft({ id: e.id, name: e.name, kind: e.kind, category: e.category, value: String(e.value), valuationDate: e.valuationDate, linkedMortgageId: e.linkedMortgageId ?? "", liabilityConfirmed: false }); }
  return <section className="card" aria-label="Manual assets and liabilities">
    <div className="row between"><h2>Manual assets &amp; liabilities</h2><button className="btn" disabled={busy} onClick={() => signedIn ? (setError(""), setDraft(blank())) : router.push("/signin")}>Add manual asset</button></div>
    <p className="muted">Enter a property&apos;s full estimated value, not equity. A linked mortgage is already counted separately; do not add it again. Estimates are in USD and are not automatic valuations.</p>
    {signedIn && suggestions.map((a) => <div className="row between" key={a.id} style={{ padding: "12px 0", gap: 12 }}>
      <span>Mortgage found: {a.institution} · {a.name}</span>
      <div className="row"><button className="btn" disabled={busy} onClick={() => setDraft({ ...blank(), linkedMortgageId: a.id })}>Add the property&apos;s value</button><button className="btn" aria-label={`Dismiss property suggestion for ${a.name}`} onClick={() => setDismissed((ids) => [...ids, a.id])}>Dismiss</button></div>
    </div>)}
    {error && <p role="alert">{error}</p>}
    {draft && <form className="grid-2 manual-entry-form" onSubmit={(e) => { e.preventDefault(); void save({ ...draft, value: Number(draft.value), linkedMortgageId: draft.linkedMortgageId || null }, draft.id ? "PATCH" : "POST"); }}>
      <label>Name<input required maxLength={100} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>Entry<select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"], category: e.target.value === "asset" ? "property" : "mortgage", linkedMortgageId: "", liabilityConfirmed: false })}><option value="asset">Asset</option><option value="liability">Liability (only if not already linked)</option></select></label>
      <label>Type<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Draft["category"], linkedMortgageId: "" })}>{draft.kind === "asset" ? <option value="property">Property</option> : <option value="mortgage">Mortgage</option>}<option value="other">Other</option></select></label>
      <label>{draft.kind === "asset" ? "Full estimated current value (USD)" : "Outstanding debt (USD)"}<input type="number" required min="0" max="1000000000000" step="0.01" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></label>
      <label>Valuation date<input type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} value={draft.valuationDate} onChange={(e) => setDraft({ ...draft, valuationDate: e.target.value })} /></label>
      {draft.kind === "asset" && draft.category === "property" && <label>Associated linked mortgage<select value={draft.linkedMortgageId} onChange={(e) => setDraft({ ...draft, linkedMortgageId: e.target.value })}><option value="">None / no linked mortgage</option>{mortgages.map((a) => <option value={a.id} key={a.id}>{a.institution} · {a.name}</option>)}</select></label>}
      {draft.kind === "liability" && <label><input type="checkbox" required checked={draft.liabilityConfirmed} onChange={(e) => setDraft({ ...draft, liabilityConfirmed: e.target.checked })} /> I checked linked debts; this liability is not already included.</label>}
      <div className="row"><button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button><button className="btn" type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button></div>
    </form>}
    {entries.length === 0 && <p className="muted">No manual entries yet.</p>}
    {entries.map((e) => <div key={e.id} className="row between" style={{ padding: "12px 0", gap: 12, opacity: e.archived ? .65 : 1 }}>
      <span><strong>{e.name}</strong> · {e.category} · {e.kind} · {money(e.value)}<span className="muted"> · valued {e.valuationDate}{e.archived ? " · archived, excluded" : ""}</span></span>
      <div className="row"><button className="btn" disabled={busy} onClick={() => edit(e)}>Edit</button><button className="btn" disabled={busy} onClick={() => void save({ id: e.id, archived: !e.archived }, "PATCH")}>{e.archived ? "Restore" : "Archive"}</button></div>
    </div>)}
  </section>;
}
