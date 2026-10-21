"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountRow } from "@/lib/model";
import type { ManualEntry } from "@/lib/manual-assets";
import { dollars as money, equity, homeLabel, type Address, type Estimate } from "@/lib/property";

type Props = {
  mortgages: AccountRow[];
  /** Opened from a mortgage row: the link is fixed to that mortgage. */
  fixedMortgageId?: string;
  /** Address Plaid reported for that mortgage, if any. */
  prefill?: Address | null;
  /** Editing an existing home. */
  entry?: ManualEntry;
  entryAddress?: Address | null;
  estimatesEnabled: boolean;
  onClose: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);
const blankAddress: Address = { street: "", city: "", region: "", postalCode: "" };

export function HomeSheet({ mortgages, fixedMortgageId, prefill, entry, entryAddress, estimatesEnabled, onClose }: Props) {
  const router = useRouter();
  const startAddress = entryAddress ?? prefill ?? blankAddress;
  const [address, setAddress] = useState<Address>(startAddress);
  const [estimate, setEstimate] = useState<Estimate | null>(
    entry?.valuationSource === "estimate" && entry.estimateLow != null && entry.estimateHigh != null
      ? { value: entry.value, low: entry.estimateLow, high: entry.estimateHigh, comps: entry.estimateComps ?? 0, provider: entry.valuationProvider ?? "RentCast", asOf: entry.valuationDate }
      : null,
  );
  const [mode, setMode] = useState<"estimate" | "manual">(entry ? (entry.valuationSource === "estimate" ? "estimate" : "manual") : estimatesEnabled ? "estimate" : "manual");
  const [ownValue, setOwnValue] = useState(entry && entry.valuationSource !== "estimate" ? String(entry.value) : "");
  const [ownDate, setOwnDate] = useState(entry && entry.valuationSource !== "estimate" ? entry.valuationDate : today());
  const [mortgageId, setMortgageId] = useState(fixedMortgageId ?? entry?.linkedMortgageId ?? "");
  const [busy, setBusy] = useState<null | "estimate" | "save">(null);
  const [error, setError] = useState("");
  const [estimateNote, setEstimateNote] = useState("");

  const addressKey = (a: Address) => [a.street, a.city, a.region, a.postalCode].join("|").toLowerCase();
  const addressChanged = addressKey(address) !== addressKey(startAddress);
  const addressFilled = Boolean(address.street && address.city && address.region && address.postalCode);
  const linked = mortgages.find((m) => m.id === mortgageId);
  const value = mode === "estimate" ? estimate?.value ?? null : ownValue ? Number(ownValue) : null;
  const eq = value != null && linked ? equity(value, Math.abs(linked.balance)) : null;

  function setField(k: keyof Address, v: string) {
    setAddress((a) => ({ ...a, [k]: k === "region" ? v.toUpperCase().slice(0, 2) : v }));
    // A changed address invalidates an estimate made for the old one.
    if (estimate) { setEstimate(null); setEstimateNote(""); }
  }

  async function getEstimate() {
    setBusy("estimate"); setError(""); setEstimateNote("");
    try {
      const r = await fetch("/api/property/estimate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setEstimate(null);
        setEstimateNote(j.error ?? "Couldn't get an estimate. Enter your own value.");
        if (r.status !== 400) setMode("manual");
        return;
      }
      setEstimate(j.estimate as Estimate);
      setMode("estimate");
    } finally { setBusy(null); }
  }

  async function save() {
    setBusy("save"); setError("");
    const hasAddress = addressFilled;
    const payload = mode === "estimate" && estimate
      ? { value: estimate.value, valuationDate: estimate.asOf > today() ? today() : estimate.asOf, valuationSource: "estimate", estimateLow: estimate.low, estimateHigh: estimate.high, estimateComps: estimate.comps, valuationProvider: estimate.provider }
      : { value: Number(ownValue), valuationDate: ownDate, valuationSource: "manual" };
    try {
      const r = await fetch("/api/manual-assets", {
        method: entry ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...(entry ? { id: entry.id } : {}), name: hasAddress ? homeLabel(address) : entry?.name ?? "Home", kind: "asset", category: "property", linkedMortgageId: mortgageId || null, address: hasAddress ? address : null, ...payload }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Unable to save home");
      onClose(); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  const canSave = !busy && (mode === "estimate" ? Boolean(estimate) && addressFilled : ownValue !== "" && Number(ownValue) > 0);
  const span = estimate ? Math.max(estimate.high - estimate.low, 1) : 1;
  const pos = estimate ? ((estimate.value - estimate.low) / span) * 100 : 50;

  return (
    <div className="inner home-sheet" role="group" aria-label={entry ? "Edit home" : "Add your home"}>
      <div className="row between" style={{ alignItems: "baseline" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="eyebrow">Primary residence</span>
          <strong style={{ fontSize: 17 }}>{entry ? "Edit home" : "Add your home"}</strong>
        </div>
        <button type="button" className="chip" onClick={onClose} disabled={!!busy}>close</button>
      </div>

      {prefill && !entryAddress && !addressChanged && (
        <span className="mono muted" style={{ fontSize: 12 }}>Address from your mortgage servicer — check it before estimating.</span>
      )}

      <div className="manual-entry-form home-address">
        <label className="span-all">Street address<input autoComplete="street-address" maxLength={120} value={address.street} onChange={(e) => setField("street", e.target.value)} /></label>
        <label>City<input autoComplete="address-level2" maxLength={80} value={address.city} onChange={(e) => setField("city", e.target.value)} /></label>
        <label>State<input autoComplete="address-level1" maxLength={2} placeholder="CA" value={address.region} onChange={(e) => setField("region", e.target.value)} /></label>
        <label>ZIP<input autoComplete="postal-code" inputMode="numeric" maxLength={10} value={address.postalCode} onChange={(e) => setField("postalCode", e.target.value)} /></label>
      </div>

      {estimatesEnabled && (
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="btn btn-primary" disabled={!addressFilled || !!busy} onClick={() => void getEstimate()}>
            {busy === "estimate" ? "Estimating…" : estimate ? "Refresh estimate" : "Get estimate"}
          </button>
          <span className="muted" style={{ fontSize: 12, flex: "1 1 220px" }}>Apex sends only this address to RentCast to estimate the value — nothing else about you.</span>
        </div>
      )}
      {estimateNote && <p role="status" className="mono" style={{ fontSize: 13, color: "var(--warn)" }}>{estimateNote}</p>}

      {estimate && (
        <div className="home-estimate dots">
          <span className="eyebrow">Estimated value</span>
          <strong className="mono num" style={{ fontSize: "clamp(24px, 5vw, 32px)" }}>{money(estimate.value)}</strong>
          <div className="range" aria-label={`Likely range ${money(estimate.low)} to ${money(estimate.high)}`}>
            <span className="range-track" /><span className="range-mark" style={{ left: `${Math.min(100, Math.max(0, pos))}%` }} />
          </div>
          <div className="row between mono muted" style={{ fontSize: 12 }}>
            <span>{money(estimate.low)}</span><span>{money(estimate.high)}</span>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            Likely range shown. {estimate.comps ? `Based on ${estimate.comps} comparable nearby sales and listings` : "Automated estimate"} · {estimate.provider} · {estimate.asOf}. An estimate, not an appraisal.
          </span>
        </div>
      )}

      <div className="seg-choice" role="radiogroup" aria-label="How to value this home">
        <button type="button" role="radio" aria-checked={mode === "estimate"} className="chip" disabled={!estimate} onClick={() => setMode("estimate")}>Use estimate</button>
        <button type="button" role="radio" aria-checked={mode === "manual"} className="chip" onClick={() => setMode("manual")}>Use my own value</button>
      </div>

      {mode === "estimate" && estimate && <span className="muted" style={{ fontSize: 12, marginTop: -6 }}>Apex re-estimates monthly, so your net worth tracks the market.</span>}
      {mode === "manual" && (
        <div className="manual-entry-form grid-2" style={{ gap: 16 }}>
          <label>Full current value (USD) — not equity<input type="number" min="0" max="1000000000000" step="1000" required value={ownValue} onChange={(e) => setOwnValue(e.target.value)} placeholder="e.g. from a recent appraisal or purchase" /></label>
          <label>As of<input type="date" min="1900-01-01" max={today()} value={ownDate} onChange={(e) => setOwnDate(e.target.value)} /></label>
        </div>
      )}

      {!fixedMortgageId && mortgages.length > 0 && (
        <div className="manual-entry-form">
          <label>Mortgage on this home<select className="select" value={mortgageId} onChange={(e) => setMortgageId(e.target.value)}>
            <option value="">No mortgage / paid off</option>
            {mortgages.map((m) => <option key={m.id} value={m.id}>{m.institution} · {m.name}</option>)}
          </select></label>
        </div>
      )}

      {eq && linked && (
        <div className="home-pair mono num">
          <span>Home</span><span>{money(value!)}</span>
          <span>− Mortgage</span><span>{money(Math.abs(linked.balance))}</span>
          <strong>Equity</strong><strong>{money(eq.equity)}{eq.ltv != null && <span className="muted" style={{ fontWeight: 400 }}> · LTV {Math.round(eq.ltv * 100)}%</span>}</strong>
        </div>
      )}

      {error && <p role="alert" style={{ color: "var(--warn)" }}>{error}</p>}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => void save()}>{busy === "save" ? "Saving…" : entry ? "Save changes" : "Add home"}</button>
        <button type="button" className="btn" disabled={!!busy} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
