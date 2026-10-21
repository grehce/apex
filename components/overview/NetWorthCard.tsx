"use client";
import { useEffect, useMemo, useState } from "react";
import type { RangeKey, Series } from "@/lib/model";
import { kfmt, seriesPath } from "@/lib/geom";
import { useMounted, useTween } from "../hooks";

const KEYS: RangeKey[] = ["1M", "1Y", "All"];

export function NetWorthCard({ netWorth, series, historyDays, estimatedDays = 0 }: { netWorth: number; series: Record<RangeKey, Series>; historyDays: number; estimatedDays?: number }) {
  const [range, setRange] = useState<RangeKey>("1Y");
  const [hover, setHover] = useState<number | null>(null);
  const mounted = useMounted();
  // The draw-in uses a dash; with a non-scaling stroke the dash length is off, which
  // clipped the line short of today. Drop the dash once the draw-in has played.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { if (!mounted) return; const t = setTimeout(() => setDrawn(true), 1700); return () => clearTimeout(t); }, [mounted]);
  const disp = useTween(netWorth, 1400);
  const s = series[range];
  const g = useMemo(() => seriesPath(s.v), [s]);
  const first = s.v[0];
  const last = s.v[s.v.length - 1];
  const delta = last - first;
  const up = delta >= 0;
  const pct = first ? (delta / Math.abs(first)) * 100 : 0;
  const money = Math.abs(disp).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dot = money.lastIndexOf(".");
  const est = s.est ?? 0; // fraction of the x-axis that is estimated
  const estX = Math.round(est * 1000);
  const flat = s.v.every((v) => v === s.v[0]);
  const ticks = s.l.length <= 6 ? s.l : [0, 0.25, 0.5, 0.75, 1].map((f) => s.l[Math.round(f * (s.l.length - 1))]);

  return (
    <section aria-labelledby="nw-h" className="card lift" style={{ padding: "28px 28px 20px" }}>
      <div className="row between" style={{ alignItems: "flex-end", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span id="nw-h" className="eyebrow">net_worth</span>
          <div aria-live="polite" className="num" style={{ fontSize: "clamp(40px, 11vw, 68px)", fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1 }}>
            {disp < 0 ? "−" : ""}${money.slice(0, dot)}
            <span className="mono" style={{ fontSize: "clamp(20px, 5vw, 32px)", fontWeight: 500, letterSpacing: "-0.02em", color: "var(--faint)" }}>{money.slice(dot)}</span>
          </div>
          {flat && historyDays <= 1 && !estimatedDays ? (
            <span className="pill" style={{ alignSelf: "flex-start", background: "var(--surface-2)", color: "var(--muted)" }}>history starts today</span>
          ) : (
            <span className="pill" style={{ alignSelf: "flex-start", background: up ? "var(--accent-tint)" : "var(--warn-tint)", color: up ? "var(--accent-ink)" : "var(--warn)" }}>
              {up ? "▲ +" : "▼ −"}${Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 0 })} {up ? "+" : ""}{pct.toFixed(1)}% {range.toLowerCase()}{est > 0 ? " · partly est." : ""}
            </span>
          )}
        </div>
        <div role="group" aria-label="Time range" className="seg" style={{ width: 200 }}>
          <span aria-hidden="true" className="seg-pill" style={{ left: 4 + KEYS.indexOf(range) * 64, width: 64 }} />
          {KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={range === k} onClick={() => { setRange(k); setHover(null); }}>{k}</button>
          ))}
        </div>
      </div>

      <div className="row between mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
        <span>
          {hover === null
            ? "hover to scrub ↔"
            : `x=${s.l[hover]}  y=${kfmt(s.v[hover])}  Δ=${s.v[hover] - first >= 0 ? "+" : ""}${kfmt(s.v[hover] - first)}${hover / Math.max(1, s.v.length - 1) < est ? "  est." : ""}`}
        </span>
        <span>
          {estimatedDays > 0
            ? <>{est > 0 && <><span aria-hidden="true" style={{ borderTop: "2px dashed var(--accent)", display: "inline-block", width: 16, verticalAlign: "middle", marginRight: 6 }} />estimated from transactions · </>}{historyDays} day{historyDays === 1 ? "" : "s"} recorded</>
            : historyDays < 30 ? `${historyDays} day${historyDays === 1 ? "" : "s"} of history · grows with each sync` : `${s.v.length} pts`}
        </span>
      </div>

      <div
        className="dots"
        style={{ position: "relative", height: 250, cursor: "crosshair", borderRadius: 4 }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (s.v.length - 1));
          if (i !== hover) setHover(i);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <svg viewBox="0 0 1000 260" preserveAspectRatio="none" role="img" aria-label={`Net worth over ${range}, from ${kfmt(first)} to ${kfmt(last)}`} style={{ display: "block", width: "100%", height: 250, overflow: "visible" }}>
          {[16, 92, 168].map((y) => <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="var(--chart-grid)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
          <line x1="0" y1="244" x2="1000" y2="244" stroke="var(--chart-base)" vectorEffect="non-scaling-stroke" />
          <path d={g.area} fill="var(--accent)" fillOpacity={0.08} style={{ d: `path('${g.area}')`, transition: "d 700ms var(--ease)" } as React.CSSProperties} />
          <defs>
            <clipPath id="nw-est"><rect x="0" y="-20" width={estX} height="300" /></clipPath>
            <clipPath id="nw-rec"><rect x={estX} y="-20" width={1000 - estX} height="300" /></clipPath>
          </defs>
          {estX > 0 && (
            <path d={g.line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 5" strokeOpacity={0.75} vectorEffect="non-scaling-stroke" clipPath="url(#nw-est)" style={{ d: `path('${g.line}')`, transition: "d 700ms var(--ease)" } as React.CSSProperties} />
          )}
          {estX > 0 && estX < 1000 && <line x1={estX} y1="16" x2={estX} y2="244" stroke="var(--line-strong)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />}
          <path
            clipPath={estX > 0 ? "url(#nw-rec)" : undefined}
            d={g.line}
            pathLength={1}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ d: `path('${g.line}')`, strokeDasharray: drawn ? "none" : 1, strokeDashoffset: mounted ? 0 : 1, transition: "d 700ms var(--ease), stroke-dashoffset 1600ms var(--ease)" } as React.CSSProperties}
          />
        </svg>
        {hover !== null && (
          <>
            <div aria-hidden="true" style={{ position: "absolute", top: 0, bottom: 0, left: `${(hover / Math.max(1, s.v.length - 1)) * 100}%`, borderLeft: "1px dashed var(--border-hover)", pointerEvents: "none" }} />
            <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: (g.y(s.v[hover]) * 250) / 260, borderTop: "1px dashed var(--line-strong)", pointerEvents: "none" }} />
            <div aria-hidden="true" style={{ position: "absolute", left: `${(hover / Math.max(1, s.v.length - 1)) * 100}%`, top: (g.y(s.v[hover]) * 250) / 260, width: 12, height: 12, margin: "-6px 0 0 -6px", borderRadius: 4, background: "#fff", border: "3px solid var(--accent)", pointerEvents: "none" }} />
          </>
        )}
      </div>
      <div className="row between mono" style={{ fontSize: 11, color: "var(--muted)" }}>
        {ticks.map((t, i) => <span key={i}>{t}</span>)}
      </div>
    </section>
  );
}
