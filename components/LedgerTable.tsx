"use client";
import { useMemo, useState } from "react";
import type { TxRow } from "@/lib/model";
import { prettyCategory } from "@/lib/model";

type F = "all" | "in" | "out";

const monthLabel = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export function LedgerTable({ rows, initialCategory = "", initialMonth = "" }: { rows: TxRow[]; initialCategory?: string; initialMonth?: string }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>("all");
  // A drill-down link passes the category's display name; match it to the raw category.
  const [cat, setCat] = useState(() => rows.find((r) => prettyCategory(r.category).toLowerCase() === initialCategory.toLowerCase())?.category ?? "");
  const [month, setMonth] = useState(initialMonth);
  const [limit, setLimit] = useState(50);
  const [sort, setSort] = useState<"largest" | "newest">("largest");

  const cats = useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (f === "all" || (f === "in" ? r.amount < 0 : r.amount > 0)) &&
        (!cat || r.category === cat) &&
        (!month || r.date.startsWith(month)) &&
        (!needle || r.name.toLowerCase().includes(needle) || prettyCategory(r.category).toLowerCase().includes(needle) || r.account.toLowerCase().includes(needle)),
    ).sort((a, b) => (sort === "largest" ? Math.abs(b.amount) - Math.abs(a.amount) : 0) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [rows, q, f, cat, month, sort]);
  const inSum = filtered.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);
  const outSum = filtered.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="card" aria-label="Transactions">
      <div className="row" style={{ gap: 8 }}>
        <label style={{ flex: "1 1 240px", display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 12px", border: "1px solid var(--line-strong)", borderRadius: 4, background: "var(--field)" }}>
          <span className="mono muted">/</span>
          <span className="sr-only">Search transactions</span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(50); }} placeholder="search merchant, category or account" style={{ flex: 1, minWidth: 0, border: 0, outline: "none", font: "inherit", background: "transparent" }} />
        </label>
        <label className="sr-only" htmlFor="cat">Category</label>
        <select id="cat" value={cat} onChange={(e) => { setCat(e.target.value); setLimit(50); }} className="select" style={{ height: 44, padding: "0 36px 0 12px", border: "1px solid var(--line-strong)", borderRadius: 4, backgroundColor: "var(--field)", color: "var(--ink)", font: "inherit", fontSize: 14 }}>
          <option value="">all categories</option>
          {cats.map((c) => <option key={c} value={c}>{prettyCategory(c)}</option>)}
        </select>
        <div role="group" aria-label="Sort" className="row" style={{ gap: 4 }}>
          {(["largest", "newest"] as const).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={sort === k} onClick={() => { setSort(k); setLimit(50); }}>{k}</button>
          ))}
        </div>
        <div role="group" aria-label="Direction" className="row" style={{ gap: 4 }}>
          {(["all", "in", "out"] as F[]).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={f === k} onClick={() => { setF(k); setLimit(50); }}>{k}</button>
          ))}
        </div>
      </div>
      {month && (
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="chip" aria-pressed="true" onClick={() => setMonth("")} aria-label={`Remove ${monthLabel(month)} filter`}>{monthLabel(month)} ×</button>
          <span className="mono muted" style={{ fontSize: 12 }}>includes pending; transfers and payments show here but aren&apos;t counted as spending</span>
        </div>
      )}
      <div className="mono muted" style={{ fontSize: 12 }} aria-live="polite">
        {filtered.length} transactions · in +{fmt(inSum)} · out −{fmt(outSum)}{cat ? ` · net ${outSum - inSum >= 0 ? "−" : "+"}${fmt(Math.abs(outSum - inSum))}` : ""}
      </div>
      <div className="table-wrap">
        <table className="data t-ledger">
          <thead><tr><th>date</th><th>merchant</th><th>category</th><th>account</th><th className="r">amount</th></tr></thead>
          <tbody>
            {filtered.slice(0, limit).map((r) => (
              <tr key={r.id}>
                <td className="mono muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}><span className="date-full">{r.date}</span><span className="date-short">{r.date.slice(5)}</span></td>
                <td style={{ fontWeight: 500 }}>{r.name}<span className="ledger-sub mono muted">{prettyCategory(r.category)} · {r.account}</span></td>
                <td className="mono muted" style={{ fontSize: 12 }}>{prettyCategory(r.category)}</td>
                <td className="mono muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{r.account}</td>
                <td className="r mono num" style={{ color: r.amount < 0 ? "var(--accent-ink)" : "var(--ink)", whiteSpace: "nowrap" }}>{r.amount < 0 ? "+" : "−"}{fmt(Math.abs(r.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > limit && (
        <button type="button" className="btn" style={{ alignSelf: "center" }} onClick={() => setLimit((l) => l + 50)}>
          Show 50 more
        </button>
      )}
    </section>
  );
}
