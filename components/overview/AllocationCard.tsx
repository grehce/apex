"use client";
import Link from "next/link";
import { useState } from "react";
import type { AllocationRow } from "@/lib/model";
import { useMounted } from "../hooks";

export function AllocationCard({ rows, invested }: { rows: AllocationRow[]; invested: number }) {
  const mounted = useMounted();
  const [sel, setSel] = useState(rows[0]?.name);
  const r = rows.find((x) => x.name === sel) ?? rows[0];

  if (!r || invested <= 0) {
    return (
      <section className="card lift" aria-labelledby="al-h">
        <h2 id="al-h">Allocation</h2>
        <p className="muted" style={{ margin: 0 }}>Connect a brokerage or retirement account to see your allocation.</p>
      </section>
    );
  }
  const drift = r.pct - r.target;
  const blocks = Math.round(r.pct / 5);

  return (
    <section className="card lift" aria-labelledby="al-h">
      <div className="row between" style={{ alignItems: "baseline" }}>
        <h2 id="al-h">Allocation</h2>
        <span className="mono muted" style={{ fontSize: 12 }}>${Math.round(invested).toLocaleString("en-US")} invested</span>
      </div>
      <div role="group" aria-label="Asset classes" style={{ display: "flex", gap: 3, height: 44, borderRadius: 4, overflow: "hidden" }}>
        {rows.filter((x) => x.value > 0).map((x) => (
          <button
            key={x.name}
            type="button"
            aria-pressed={x.name === r.name}
            aria-label={`${x.name} ${x.pct.toFixed(0)}%`}
            onClick={() => setSel(x.name)}
            style={{ flex: "0 0 auto", width: `${mounted ? x.pct : 0}%`, minWidth: 18, border: 0, padding: 0, background: x.color, opacity: x.name === r.name ? 1 : 0.45, cursor: "pointer", transition: "width 900ms var(--ease), opacity 250ms" }}
          />
        ))}
      </div>
      <div key={r.name} className="dots inner anim-in" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="row" style={{ gap: 8, fontWeight: 600 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color }} />{r.name}
          </span>
          <span className="num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em" }}>${Math.round(r.value).toLocaleString("en-US")}</span>
        </div>
        <div className="mono" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--ink-2)" }}>
          <span>actual  <strong style={{ color: "var(--ink)" }}>{r.pct.toFixed(1)}%</strong></span>
          <span>target  {r.target}%</span>
          <span style={{ color: Math.abs(drift) >= 3 ? "var(--warn)" : "var(--ink-2)" }}>
            drift   {drift > 0 ? "+" : ""}{drift.toFixed(1)}% {Math.abs(drift) >= 3 ? "· rebalance" : "· ok"}
          </span>
          <span style={{ color: "var(--accent)", whiteSpace: "pre" }}>{"█".repeat(blocks) + "░".repeat(Math.max(0, 20 - blocks))}</span>
        </div>
      </div>
      <div className="row" style={{ gap: "6px 16px", fontSize: 13, color: "var(--ink-2)" }}>
        {rows.map((x) => (
          <span key={x.name} className="row" style={{ gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: x.color }} />{x.name} <span className="mono muted">{x.pct.toFixed(0)}%</span>
          </span>
        ))}
      </div>
      <Link href="/agent" className="btn btn-primary" style={{ alignSelf: "flex-start", minHeight: 40, fontSize: 14 }}>
        Rebalance with Apex Agent <span className="mono">→</span>
      </Link>
    </section>
  );
}
