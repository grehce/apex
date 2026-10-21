"use client";
import Link from "next/link";
import { useState } from "react";
import type { AllocationRow } from "@/lib/model";
import { useMounted } from "../hooks";
import { Term } from "../Term";

export function AllocationCard({ rows, invested }: { rows: AllocationRow[]; invested: number }) {
  const mounted = useMounted();
  const [sel, setSel] = useState(rows[0]?.name);
  const [hover, setHover] = useState<string | null>(null);
  // Hovering previews a class; clicking pins it.
  const r = rows.find((x) => x.name === (hover ?? sel)) ?? rows[0];

  if (!r || invested <= 0) {
    return (
      <section className="card lift" aria-labelledby="al-h">
        <h2 id="al-h">Allocation</h2>
        <p className="muted" style={{ margin: 0 }}>Connect a brokerage or retirement account to see how your investments are split, and how far they&apos;ve drifted from target.</p>
        <div className="row" style={{ gap: 10 }}>
          <a className="btn btn-sm" href="/settings#connections">Connect a brokerage →</a>
        </div>
        <p className="note" style={{ margin: 0 }}>Some brokerages, including Charles Schwab, approve new apps on Plaid separately — it can take a while before they appear in the connect list. Your other accounts work in the meantime.</p>
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
      <div style={{ position: "relative" }} onMouseLeave={() => setHover(null)}>
        {hover && (() => {
          const shown = rows.filter((x) => x.value > 0);
          const i = shown.findIndex((x) => x.name === hover);
          const center = shown.slice(0, i).reduce((s, x) => s + x.pct, 0) + shown[i].pct / 2;
          const h = shown[i];
          return (
            <div
              role="tooltip"
              className="mono anim-in"
              style={{ position: "absolute", bottom: "calc(100% + 8px)", left: `clamp(90px, ${center}%, calc(100% - 90px))`, transform: "translateX(-50%)", background: "var(--tip-bg)", color: "#fff", padding: "8px 10px", borderRadius: 4, fontSize: 12, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 2, animationDuration: "150ms" }}
            >
              <div style={{ fontWeight: 600 }}>{h.name}</div>
              <div className="num">${h.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {h.pct.toFixed(1)}%</div>
            </div>
          );
        })()}
        <div role="group" aria-label="Asset classes" style={{ display: "flex", gap: 3, height: 44, borderRadius: 4, overflow: "hidden" }}>
          {rows.filter((x) => x.value > 0).map((x) => (
            <button
              key={x.name}
              type="button"
              aria-pressed={x.name === sel}
              aria-label={`${x.name}: $${x.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}, ${x.pct.toFixed(1)}%`}
              onClick={() => setSel(x.name)}
              onMouseEnter={() => setHover(x.name)}
              onFocus={() => setHover(x.name)}
              onBlur={() => setHover(null)}
              style={{ flex: "0 0 auto", width: `${mounted ? x.pct : 0}%`, minWidth: 18, border: 0, padding: 0, background: x.color, opacity: x.name === r.name ? 1 : 0.45, cursor: "pointer", transition: "width 900ms var(--ease), opacity 250ms" }}
            />
          ))}
        </div>
      </div>
      <div key={r.name} className="dots inner anim-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="row" style={{ gap: 8, fontWeight: 600 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color }} />{r.name}
          </span>
          <span className="num" style={{ fontSize: "clamp(24px, 7vw, 30px)", fontWeight: 700, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
            ${Math.floor(Math.round(r.value * 100) / 100).toLocaleString("en-US")}
            <span className="mono" style={{ fontSize: 16, fontWeight: 500, color: "var(--faint)" }}>.{String(Math.round(r.value * 100) % 100).padStart(2, "0")}</span>
          </span>
        </div>
        <div className="mono" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--ink-2)" }}>
          <span>actual  <strong style={{ color: "var(--ink)" }}>{r.pct.toFixed(1)}%</strong></span>
          <span><Term k="target" />  {r.target}%</span>
          <span style={{ color: Math.abs(drift) >= 3 ? "var(--warn)" : "var(--ink-2)" }}>
            <Term k="drift" />   {drift > 0 ? "+" : ""}{drift.toFixed(1)}% {Math.abs(drift) >= 3 ? <>· <Term k="rebalance" /></> : "· ok"}
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
