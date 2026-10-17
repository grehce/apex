"use client";
import { useState } from "react";
import type { HeatDay } from "@/lib/model";
import { prettyCategory } from "@/lib/model";
import { Scrolly } from "../Scrolly";

const LEVELS = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function money(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function HeatmapCard({ days }: { days: HeatDay[] }) {
  const lastSpend = (() => {
    for (let i = days.length - 1; i >= 0; i--) if (days[i].amount > 0) return i;
    return days.length - 1;
  })();
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number>(lastSpend);
  const sel = hover ?? pinned;
  const d = days[sel];

  const nonzero = days.map((x) => x.amount).filter((a) => a > 0).sort((a, b) => a - b);
  const q = (p: number) => nonzero[Math.floor(p * (nonzero.length - 1))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.8)];
  const level = (a: number) => (a <= 0 ? 0 : a <= cuts[0] ? 1 : a <= cuts[1] ? 2 : a <= cuts[2] ? 3 : 4);
  const avg = days.reduce((s, x) => s + x.amount, 0) / Math.max(1, days.length);

  // Pad the start so columns are whole weeks starting on Sunday.
  const firstDow = new Date(days[0].day + "T12:00:00").getDay();
  const cells: (HeatDay | null)[] = [...Array(firstDow).fill(null), ...days];

  const dt = new Date(d.day + "T12:00:00");
  const ratio = avg > 0 ? d.amount / avg : 0;
  const vsAvg =
    d.amount === 0 ? "no spending" : ratio >= 1.15 ? `${ratio.toFixed(1)}× your daily average` : ratio <= 0.85 ? `${Math.round((1 - ratio) * 100)}% below average` : "about average";
  const shown = d.items.slice(0, 4);
  const more = d.items.length - shown.length;

  return (
    <section className="card lift" aria-labelledby="hm-h" style={{ gap: 14 }}>
      <div className="row between" style={{ alignItems: "baseline" }}>
        <h2 id="hm-h">Daily spend</h2>
        <span className="mono muted" style={{ fontSize: 12 }}>avg ${Math.round(avg)}/day · last 13 weeks</span>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        <div aria-hidden="true" className="mono muted" style={{ display: "grid", gridTemplateRows: "repeat(7, 16px)", gap: 4, fontSize: 10, lineHeight: "16px" }}>
          <span>sun</span><span /><span>tue</span><span /><span>thu</span><span /><span>sat</span>
        </div>
        <div role="group" aria-label="Daily spending, last 13 weeks" onMouseLeave={() => setHover(null)} style={{ display: "grid", gridTemplateRows: "repeat(7, 16px)", gridAutoFlow: "column", gridAutoColumns: "16px", gap: 4 }}>
          {cells.map((c, i) => {
            if (c === null) return <span key={`pad${i}`} />;
            const idx = i - firstDow;
            const cd = new Date(c.day + "T12:00:00");
            return (
              <button
                key={c.day}
                type="button"
                aria-label={`${DOW[cd.getDay()]} ${cd.getMonth() + 1}/${cd.getDate()}: $${c.amount}`}
                aria-pressed={pinned === idx}
                onMouseEnter={() => setHover(idx)}
                onFocus={() => setHover(idx)}
                onBlur={() => setHover(null)}
                onClick={() => setPinned(idx)}
                style={{
                  width: 16, height: 16, padding: 0, border: 0, borderRadius: 2, cursor: "pointer",
                  background: LEVELS[level(c.amount)],
                  boxShadow: sel === idx ? "0 0 0 2px var(--ink)" : pinned === idx ? "0 0 0 2px var(--border-hover)" : "none",
                  transition: "box-shadow 150ms",
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="row mono muted" style={{ gap: 4, fontSize: 11 }}>
        <span style={{ marginRight: 4 }}>less</span>
        {LEVELS.map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />)}
        <span style={{ marginLeft: 4 }}>more</span>
      </div>

      <div key={d.day} className="dots inner anim-in" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 10, animationDuration: "220ms" }}>
        <div className="row between" style={{ alignItems: "baseline" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="eyebrow">{DOW_LONG[dt.getDay()]} · {MON[dt.getMonth()]} {dt.getDate()}</span>
            <span className="num" style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>{money(d.amount)}</span>
          </div>
          <span className="mono" style={{ fontSize: 12, color: ratio >= 1.5 ? "var(--warn)" : "var(--ink-2)" }}>{vsAvg}</span>
        </div>
        {d.amount === 0 ? (
          <span className="muted" style={{ fontSize: 14 }}>A no-spend day. Nice.</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {shown.map((t, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "7px 0", borderTop: "1px dashed var(--line-dash)" }}>
                <div style={{ minWidth: 0 }}>
                  <Scrolly text={t.name} style={{ fontSize: 14, fontWeight: 500 }} />
                  <Scrolly text={prettyCategory(t.category)} className="mono muted" style={{ fontSize: 11 }} />
                </div>
                <span className="mono num" style={{ fontSize: 13 }}>{money(t.amount)}</span>
              </div>
            ))}
            {more > 0 && <span className="mono muted" style={{ fontSize: 11, paddingTop: 6 }}>+{more} more</span>}
          </div>
        )}
        <span className="mono muted" style={{ fontSize: 11 }}>{hover !== null ? "hovering · click to pin" : "hover a day to see it here"}</span>
      </div>
    </section>
  );
}
