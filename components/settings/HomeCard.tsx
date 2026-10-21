"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountRow } from "@/lib/model";
import type { ManualEntry } from "@/lib/manual-assets";
import { dollars, equity, likelyResetDates, monthsUntil, shopFrom, type Address, type LoanDetails } from "@/lib/property";

const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthYear = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
function span(months: number) {
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? `${y} yr` : "", m ? `${m} mo` : ""].filter(Boolean).join(" ") || "this month";
}

type Props = {
  entry: ManualEntry;
  address: Address | null;
  mortgage: AccountRow | null;
  loan: LoanDetails | null;
  signedIn: boolean;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onShareLoan?: (itemId: string) => void;
  shareDisabled?: boolean;
};

/** One place for a home: value, the mortgage on it, equity, loan details and when the rate resets. */
export function HomeCard({ entry, address, mortgage, loan, signedIn, busy, onEdit, onArchive, onShareLoan, shareDisabled }: Props) {
  const router = useRouter();
  const [editingReset, setEditingReset] = useState(false);
  const [reset, setReset] = useState(entry.rateResetDate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const owed = mortgage ? Math.abs(mortgage.balance) : null;
  const eq = owed != null ? equity(entry.value, owed) : null;
  const estimate = entry.valuationSource === "estimate";

  async function saveReset(value: string | null) {
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/manual-assets", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: entry.id, rateResetDate: value }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Couldn't save the date");
      setEditingReset(false); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }

  const resetDate = entry.rateResetDate ?? null;
  const months = resetDate ? monthsUntil(resetDate) : null;
  const shop = resetDate ? shopFrom(resetDate) : null;
  const shoppingNow = months != null && months <= 6 && months >= 0;
  const soon = months != null && months > 6 && months <= 12;

  const facts = loan ? [
    loan.ratePct != null ? `${loan.ratePct}%${loan.rateType ? ` ${loan.rateType}` : ""}` : null,
    loan.interestOnly ? "interest-only" : null,
    loan.loanTerm, loan.loanType,
    loan.nextPayment != null ? `${dollars(loan.nextPayment)}/mo${loan.nextPaymentDue ? `, next ${longDate(loan.nextPaymentDue)}` : ""}` : null,
    loan.originationDate ? `since ${monthYear(loan.originationDate)}` : null,
    loan.maturityDate ? `matures ${monthYear(loan.maturityDate)}` : null,
  ].filter(Boolean) as string[] : [];

  return (
    <article id={`home-${entry.id}`} className="home-card" aria-label={`Home: ${address?.street ?? entry.name}`} style={{ opacity: entry.archived ? 0.65 : 1 }}>
      {/* Header: the home and its value */}
      <div className="row between" style={{ alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span className="eyebrow">Home{entry.archived ? " · archived, excluded" : ""}</span>
          <strong style={{ fontSize: 17 }}>{address?.street ?? entry.name}</strong>
          {address && <span className="mono muted" style={{ fontSize: 12 }}>{address.city}, {address.region}</span>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="chip" disabled={busy || !signedIn} onClick={onEdit}>edit</button>
          <button className="chip" disabled={busy || !signedIn} onClick={onArchive}>{entry.archived ? "restore" : "archive"}</button>
        </div>
      </div>

      {/* Value, mortgage, equity */}
      <div className="home-figures">
        <div>
          <span className="eyebrow">Value</span>
          <strong className="mono num">{dollars(entry.value)}</strong>
          <span className="mono muted" style={{ fontSize: 11 }}>{estimate ? `est. ${dollars(entry.estimateLow ?? entry.value)}–${dollars(entry.estimateHigh ?? entry.value)} · ${entry.valuationProvider ?? "auto"}` : `your value · ${entry.valuationDate}`}</span>
        </div>
        <div>
          <span className="eyebrow">Mortgage</span>
          <strong className="mono num">{owed != null ? `−${dollars(owed)}` : "none"}</strong>
          <span className="mono muted" style={{ fontSize: 11 }}>{mortgage ? `${mortgage.institution} ••${mortgage.mask ?? ""}` : "add one with edit"}</span>
        </div>
        <div>
          <span className="eyebrow">Equity</span>
          <strong className="mono num">{dollars(eq ? eq.equity : entry.value)}</strong>
          <span className="mono muted" style={{ fontSize: 11 }}>{eq?.ltv != null ? `LTV ${Math.round(eq.ltv * 100)}%` : "owned outright"}</span>
        </div>
      </div>

      {/* Loan details from the servicer */}
      {mortgage && (
        <div className="home-loan">
          <span className="eyebrow">Loan · from {mortgage.institution}</span>
          {loan ? (
            <span className="mono" style={{ fontSize: 12 }}>{facts.length ? facts.join(" · ") : "Shared, but the servicer sent no details yet"}</span>
          ) : (
            <div className="row" style={{ gap: 10 }}>
              <span className="muted" style={{ fontSize: 13, flex: "1 1 220px" }}>Rate and payment details aren&apos;t shared yet. Apex re-opens this connection to ask — nothing is erased.</span>
              {onShareLoan && <button type="button" className="btn btn-sm" disabled={shareDisabled} onClick={() => onShareLoan(mortgage.itemId)}>Share loan details</button>}
            </div>
          )}

          {/* Rate reset: Plaid doesn't report it, so the member enters it once. */}
          <div className={`home-reset${shoppingNow ? " is-now" : soon ? " is-soon" : ""}`}>
            {resetDate && !editingReset ? (
              <>
                <span style={{ flex: "1 1 240px", minWidth: 0, fontSize: 13 }}>
                  {months! < 0
                    ? <><strong>{loan?.interestOnly ? "Interest-only period ended" : "Rate reset"} {longDate(resetDate)}.</strong> <span className="muted">Check your new payment with {mortgage.institution}.</span></>
                    : <><strong>{loan?.interestOnly ? "Interest-only ends" : "Rate resets"} {longDate(resetDate)}</strong> <span className="muted">· in {span(months!)}. {shoppingNow ? "Time to shop rates and talk to lenders." : `Start shopping rates by ${monthYear(shop!)}.`}</span></>}
                </span>
                <button type="button" className="chip" disabled={!signedIn || saving} onClick={() => setEditingReset(true)}>change</button>
              </>
            ) : editingReset || !resetDate ? (
              <>
                <label style={{ flex: "1 1 240px", minWidth: 0, fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span><strong>{loan?.interestOnly ? "When does the interest-only period end?" : "When does the rate reset?"}</strong> <span className="muted">Plaid doesn&apos;t report it — check your Chase mortgage statement or closing documents (often 5, 7 or 10 years after closing). Apex will remind you to shop rates 6 months before.</span></span>
                  {loan?.interestOnly && loan.originationDate && likelyResetDates(loan.originationDate).length > 0 && (
                    <span className="row" style={{ gap: 6 }}>
                      <span className="mono muted" style={{ fontSize: 11 }}>typical for a loan from {monthYear(loan.originationDate)} — confirm on your statement:</span>
                      {likelyResetDates(loan.originationDate).map((o) => (
                        <button key={o.years} type="button" className="chip" aria-pressed={reset === o.date} disabled={!signedIn} onClick={() => setReset(o.date)}>{o.years}-yr IO · {monthYear(o.date)}</button>
                      ))}
                    </span>
                  )}
                  <input type="date" value={reset} min="1990-01-01" max="2075-12-31" onChange={(e) => setReset(e.target.value)} disabled={!signedIn} style={{ maxWidth: 200, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 6, font: "inherit", background: "var(--surface)", color: "var(--ink)" }} />
                </label>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn btn-sm" disabled={!signedIn || saving || !reset} onClick={() => void saveReset(reset)}>{saving ? "Saving…" : "Save date"}</button>
                  {resetDate && <button type="button" className="chip" disabled={saving} onClick={() => void saveReset(null)}>clear</button>}
                  {editingReset && <button type="button" className="chip" disabled={saving} onClick={() => { setEditingReset(false); setReset(resetDate ?? ""); }}>cancel</button>}
                </div>
              </>
            ) : null}
          </div>
          {error && <p role="alert" style={{ color: "var(--warn)", margin: 0 }}>{error}</p>}
        </div>
      )}
    </article>
  );
}
