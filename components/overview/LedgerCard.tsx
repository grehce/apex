"use client";
import { useState } from "react";
import type { TxRow } from "@/lib/model";
import { prettyCategory } from "@/lib/model";

type F = "all" | "in" | "out";

export function LedgerCard({ rows }: { rows: TxRow[] }) {
  const [f, setF] = useState<F>("all");
  const shown = rows.filter((r) => f === "all" || (f === "in" ? r.amount < 0 : r.amount > 0)).slice(0, 8);
  return (
    <section className="card lift" aria-labelledby="lg-h" style={{ gap: 12 }}>
      <div className="row between">
        <h2 id="lg-h">Ledger</h2>
        <div role="group" aria-label="Filter" className="row" style={{ gap: 4 }}>
          {(["all", "in", "out"] as F[]).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={f === k} onClick={() => setF(k)}>{k}</button>
          ))}
        </div>
      </div>
      <div key={f} style={{ display: "flex", flexDirection: "column" }}>
        {shown.length === 0 && <p className="muted" style={{ margin: "8px 0 0" }}>Nothing here yet.</p>}
        {shown.map((r, i) => (
          <div key={r.id} className="anim-in" style={{ display: "grid", gridTemplateColumns: "52px 1fr auto", alignItems: "center", gap: 12, padding: "11px 0", borderTop: "1px dashed var(--line-dash)", animationDelay: `${i * 40}ms` }}>
            <span className="mono muted" style={{ fontSize: 12 }}>{r.date.slice(5)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
              <div className="mono muted" style={{ fontSize: 11 }}>{prettyCategory(r.category)} · {r.account}</div>
            </div>
            <span className="mono num" style={{ fontSize: 14, color: r.amount < 0 ? "var(--accent-ink)" : "var(--ink)" }}>
              {r.amount < 0 ? "+" : "−"}{Math.abs(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
