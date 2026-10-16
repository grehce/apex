"use client";
import { useState } from "react";

const LEVELS = ["#ECEEEA", "#D3DED2", "#A9BFA9", "#6F8A70", "#3D5A4C"];
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function HeatmapCard({ days }: { days: { day: string; amount: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const nonzero = days.map((d) => d.amount).filter((a) => a > 0).sort((a, b) => a - b);
  const q = (p: number) => nonzero[Math.floor(p * (nonzero.length - 1))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.8)];
  const level = (a: number) => (a <= 0 ? 0 : a <= cuts[0] ? 1 : a <= cuts[1] ? 2 : a <= cuts[2] ? 3 : 4);
  const avg = days.reduce((s, d) => s + d.amount, 0) / Math.max(1, days.length);

  // Pad the start so columns are whole weeks starting on Sunday.
  const firstDow = new Date(days[0].day + "T12:00:00").getDay();
  const cells = [...Array(firstDow).fill(null), ...days];

  const label = (d: { day: string; amount: number }) => {
    const dt = new Date(d.day + "T12:00:00");
    return `${DOW[dt.getDay()]} ${dt.getMonth() + 1}/${dt.getDate()} · $${d.amount.toLocaleString("en-US")}`;
  };

  return (
    <section className="card lift" aria-labelledby="hm-h" style={{ gap: 14 }}>
      <div className="row between" style={{ alignItems: "baseline" }}>
        <h2 id="hm-h">Daily spend</h2>
        <span className="mono muted" style={{ fontSize: 12, minHeight: 18 }}>
          {hover === null ? `avg $${Math.round(avg)}/day · last 13 weeks` : label(days[hover])}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        <div aria-hidden="true" className="mono muted" style={{ display: "grid", gridTemplateRows: "repeat(7, 16px)", gap: 4, fontSize: 10, lineHeight: "16px" }}>
          <span>sun</span><span /><span>tue</span><span /><span>thu</span><span /><span>sat</span>
        </div>
        <div role="img" aria-label="Heatmap of daily spending over the last 13 weeks" onMouseLeave={() => setHover(null)} style={{ display: "grid", gridTemplateRows: "repeat(7, 16px)", gridAutoFlow: "column", gridAutoColumns: "16px", gap: 4 }}>
          {cells.map((c, i) =>
            c === null ? (
              <span key={`pad${i}`} />
            ) : (
              <span
                key={c.day}
                onMouseEnter={() => setHover(i - firstDow)}
                style={{ width: 16, height: 16, borderRadius: 2, background: LEVELS[level(c.amount)], boxShadow: hover === i - firstDow ? "0 0 0 2px var(--ink)" : "none", transition: "box-shadow 150ms" }}
              />
            ),
          )}
        </div>
      </div>
      <div className="row mono muted" style={{ gap: 4, fontSize: 11 }}>
        <span style={{ marginRight: 4 }}>less</span>
        {LEVELS.map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />)}
        <span style={{ marginLeft: 4 }}>more</span>
      </div>
    </section>
  );
}
