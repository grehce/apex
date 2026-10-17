"use client";
import { useMemo, useState } from "react";
import type { TxRow } from "@/lib/model";
import { prettyCategory } from "@/lib/model";

type F = "all" | "in" | "out";

export function LedgerTable({ rows }: { rows: TxRow[] }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>("all");
  const [cat, setCat] = useState("");
  const [limit, setLimit] = useState(50);
  const [sort, setSort] = useState<"largest" | "newest">("largest");

  const cats = useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (f === "all" || (f === "in" ? r.amount < 0 : r.amount > 0)) &&
        (!cat || r.category === cat) &&
        (!needle || r.name.toLowerCase().includes(needle) || prettyCategory(r.category).includes(needle) || r.account.toLowerCase().includes(needle)),
    ).sort((a, b) => (sort === "largest" ? Math.abs(b.amount) - Math.abs(a.amount) : 0) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [rows, q, f, cat, sort]);
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
        <select id="cat" value={cat} onChange={(e) => { setCat(e.target.value); setLimit(50); }} style={{ height: 44, padding: "0 10px", border: "1px solid var(--line-strong)", borderRadius: 4, background: "var(--field)", color: "var(--ink)", font: "inherit", fontSize: 14 }}>
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
      <div className="mono muted" style={{ fontSize: 12 }} aria-live="polite">
        {filtered.length} transactions · in +{fmt(inSum)} · out −{fmt(outSum)}
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>date</th><th>merchant</th><th>category</th><th>account</th><th className="r">amount</th></tr></thead>
          <tbody>
            {filtered.slice(0, limit).map((r) => (
              <tr key={r.id}>
                <td className="mono muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{r.date}</td>
                <td style={{ fontWeight: 500 }}>{r.name}</td>
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
