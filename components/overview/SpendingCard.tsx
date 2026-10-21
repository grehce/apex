"use client";
import { money } from "@/lib/model";
import { useMounted } from "../hooks";
import { Scrolly } from "../Scrolly";

type Row = { name: string; thisMonth: number; lastMonth: number };

export function SpendingCard({ rows, dayOfMonth, daysInMonth, postedTotal = 0, pendingTotal = 0 }: { rows: Row[]; dayOfMonth: number; daysInMonth: number; postedTotal?: number; pendingTotal?: number }) {
  const mounted = useMounted();
  const pace = (dayOfMonth / daysInMonth) * 100;
  // Without last month's spending there's nothing to pace against: show this month's split instead.
  const hasLast = rows.some((r) => r.lastMonth > 0);
  const maxThis = Math.max(1, ...rows.map((r) => r.thisMonth));
  const lastName = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  // Sort by how far through last month's total each category already is — longest bar first.
  const sorted = rows
    .map((r) => ({ ...r, p: !hasLast ? (r.thisMonth / maxThis) * 100 : r.lastMonth > 0 ? (r.thisMonth / r.lastMonth) * 100 : 100 }))
    .sort((a, b) => b.p - a.p || b.thisMonth - a.thisMonth);

  return (
    <section className="card lift" aria-labelledby="sp-h">
      <div className="row between" style={{ alignItems: "baseline" }}>
        <h2 id="sp-h">Spending pace</h2>
        <span className="mono muted" style={{ fontSize: 12 }}>day {dayOfMonth}/{daysInMonth} · {Math.round(pace)}%</span>
      </div>
      <p className="note">Posted this month {money(postedTotal)} · pending {money(pendingTotal)} (separate)</p>
      {sorted.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No spending synced yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sorted.map((r, i) => {
            const over = hasLast && r.lastMonth > 0 && r.p > 100;
            const hot = hasLast && !over && r.lastMonth > 0 && r.p > pace * 1.4;
            return (
              <div key={r.name} style={{ display: "grid", gridTemplateColumns: "minmax(0,120px) minmax(48px,1fr) auto", alignItems: "center", gap: 14 }}>
                <Scrolly text={r.name} style={{ fontSize: 14 }} />
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
          ? "Posted spending, less refunds, vs. all of last month. Transfers, income and loan payments are excluded. The tick marks how far through the month we are."
          : `No ${lastName} spending synced yet, so bars show this month's split by category. Pace vs. last month starts once a full month is in. Transfers, income and loan payments are excluded.`}
      </p>
    </section>
  );
}
