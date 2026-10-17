"use client";
import { useMounted } from "../hooks";
import { Scrolly } from "../Scrolly";

type Row = { name: string; thisMonth: number; lastMonth: number };

export function SpendingCard({ rows, dayOfMonth, daysInMonth }: { rows: Row[]; dayOfMonth: number; daysInMonth: number }) {
  const mounted = useMounted();
  const pace = (dayOfMonth / daysInMonth) * 100;
  // Sort by how far through last month's total each category already is — longest bar first.
  const sorted = rows
    .map((r) => ({ ...r, p: r.lastMonth > 0 ? (r.thisMonth / r.lastMonth) * 100 : 100 }))
    .sort((a, b) => b.p - a.p || b.thisMonth - a.thisMonth);

  return (
    <section className="card lift" aria-labelledby="sp-h">
      <div className="row between" style={{ alignItems: "baseline" }}>
        <h2 id="sp-h">Spending pace</h2>
        <span className="mono muted" style={{ fontSize: 12 }}>day {dayOfMonth}/{daysInMonth} · {Math.round(pace)}%</span>
      </div>
      {sorted.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No spending synced yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sorted.map((r, i) => {
            const over = r.p > 100;
            const hot = !over && r.p > pace * 1.4;
            return (
              <div key={r.name} style={{ display: "grid", gridTemplateColumns: "minmax(0,120px) minmax(48px,1fr) auto", alignItems: "center", gap: 14 }}>
                <Scrolly text={r.name} style={{ fontSize: 14 }} />
                <div className="bar-track hatch" style={{ overflow: "visible" }}>
                  <div className="bar-fill" style={{ width: `${mounted ? Math.min(100, r.p) : 0}%`, background: over ? "var(--warn)" : hot ? "var(--brass)" : "var(--accent)", transitionDelay: `${i * 90}ms` }} />
                  <div aria-hidden="true" style={{ position: "absolute", left: `${pace}%`, top: -4, bottom: -4, width: 2, background: "var(--ink)", opacity: 0.25 }} />
                </div>
                <span className="mono" style={{ textAlign: "right", fontSize: 12, whiteSpace: "nowrap", color: over ? "var(--warn)" : "var(--ink-2)" }}>
                  ${Math.round(r.thisMonth).toLocaleString("en-US")} / ${Math.round(r.lastMonth).toLocaleString("en-US")}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="note" style={{ marginTop: 20 }}>This month vs. all of last month. The tick marks how far through the month we are.</p>
    </section>
  );
}
