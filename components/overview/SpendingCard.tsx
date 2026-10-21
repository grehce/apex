"use client";
import { money } from "@/lib/model";
import { useMounted } from "../hooks";
import { Scrolly } from "../Scrolly";
import { CategoryIcon } from "../CategoryIcon";

type Row = { name: string; thisMonth: number; lastMonth: number };

export function SpendingCard({ rows, dayOfMonth, daysInMonth, postedTotal = 0, pendingTotal = 0, cardCredits = 0, month }: { rows: Row[]; dayOfMonth: number; daysInMonth: number; postedTotal?: number; pendingTotal?: number; cardCredits?: number; month?: string }) {
  const mounted = useMounted();
  const pace = (dayOfMonth / daysInMonth) * 100;
  // Without last month's spending there's nothing to pace against: show this month's split instead.
  const hasLast = rows.some((r) => r.lastMonth > 0);
  const maxThis = Math.max(1, ...rows.map((r) => r.thisMonth));
  const lastName = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  // Biggest spend first; the "Everything else" rollup always last.
  const sorted = rows
    .filter((r) => r.thisMonth > 0) // nothing (or net refunds) this month: no bar; the Spending table still lists it
    .map((r) => ({ ...r, p: !hasLast ? (r.thisMonth / maxThis) * 100 : r.lastMonth > 0 ? (r.thisMonth / r.lastMonth) * 100 : 100 }))
    .sort((a, b) => Number(a.name === "Everything else") - Number(b.name === "Everything else") || b.thisMonth - a.thisMonth);

  return (
    <section className="card lift" aria-labelledby="sp-h">
      <div className="row between" style={{ alignItems: "baseline" }}>
        <h2 id="sp-h">Spending pace</h2>
        <span className="mono muted" style={{ fontSize: 12 }}>day {dayOfMonth}/{daysInMonth} · {Math.round(pace)}%</span>
      </div>
      <p className="note">Posted this month {money(postedTotal)} · pending {money(pendingTotal)} (separate){cardCredits > 0 ? <> · <a href={`/ledger?category=${encodeURIComponent("card credits")}${month ? `&month=${month}` : ""}`}>card credits −{money(cardCredits)}</a> (not counted)</> : null}</p>
      {sorted.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No spending synced yet.</p>
      ) : (
        // One shared grid: every row's bar is the same width, so the pace tick lines up across categories.
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,170px) minmax(48px,1fr) max-content", alignItems: "center", gap: "14px 14px" }}>
          {sorted.map((r, i) => {
            const over = hasLast && r.lastMonth > 0 && r.p > 100;
            // Fixed monthly bills (the mortgage) are paid all at once, so being "ahead of pace" means nothing.
            const fixed = r.name.toLowerCase() === "mortgage";
            const hot = hasLast && !over && !fixed && r.lastMonth > 0 && r.p > pace * 1.4;
            return (
              <div key={r.name} style={{ display: "contents" }}>
                <span className="cat-name">
                  <span className="cat-ico"><CategoryIcon name={r.name} /></span>
                  {r.name === "Everything else"
                    ? <Scrolly text={r.name} style={{ fontSize: 14 }} />
                    : <a className="cat-link" href={`/ledger?category=${encodeURIComponent(r.name)}${month ? `&month=${month}` : ""}`} title={`See ${r.name} transactions`}><Scrolly text={r.name} style={{ fontSize: 14 }} /></a>}
                </span>
                <div className="bar-track hatch" style={{ overflow: "visible" }}>
                  <div className="bar-fill" style={{ width: `${mounted ? Math.max(0, Math.min(100, r.p)) : 0}%`, background: over ? "var(--warn)" : hot ? "var(--brass)" : "var(--accent)", transitionDelay: `${i * 90}ms` }} />
                  {hasLast && <div aria-hidden="true" style={{ position: "absolute", left: `${pace}%`, top: -4, bottom: -4, width: 2, background: "var(--ink)", opacity: 0.25 }} />}
                </div>
                <span className="mono" style={{ textAlign: "right", fontSize: 12, whiteSpace: "nowrap", color: over ? "var(--warn)" : "var(--ink-2)" }}>
                  ${Math.round(r.thisMonth).toLocaleString("en-US")}{hasLast ? (r.lastMonth > 0 ? ` / $${Math.round(r.lastMonth).toLocaleString("en-US")}` : " · new") : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="note" style={{ marginTop: 20 }}>
        {hasLast
          ? "Posted spending, less refunds, vs. all of last month. Mortgage payments count in full; transfers, income and card or other loan payments are excluded. The tick marks how far through the month we are."
          : `No ${lastName} spending synced yet, so bars show this month's split by category. Pace vs. last month starts once a full month is in. Transfers, income and loan payments are excluded.`}
      </p>
    </section>
  );
}
