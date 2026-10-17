"use client";
import { useEffect, useState } from "react";
import { ASSET_CLASSES, type AssetClass } from "@/lib/model";
import type { Plan } from "@/lib/plans";
import { ApexMark } from "../Mark";

type Props = {
  trace: [string, string, string][];
  summary: string;
  now: Record<AssetClass, number>;
  targets: Record<AssetClass, number>;
  plans: Plan[];
  recommended: Plan["key"];
};

export function AgentView({ trace, summary, now, targets, plans, recommended }: Props) {
  const [shown, setShown] = useState(0);
  const [run, setRun] = useState(0);
  const [key, setKey] = useState<Plan["key"]>(recommended);
  const [copied, setCopied] = useState(false);
  const done = shown >= trace.length;
  const plan = plans.find((p) => p.key === key)!;

  useEffect(() => {
    setShown(0);
    const iv = setInterval(() => setShown((n) => (n + 1 >= trace.length ? (clearInterval(iv), trace.length) : n + 1)), 480);
    return () => clearInterval(iv);
  }, [run, trace.length]);

  const classes = ASSET_CLASSES.filter((c) => now[c] > 0.05 || targets[c] > 0);
  const scale = (v: number) => `${Math.min(100, (v / Math.max(60, ...classes.map((c) => Math.max(now[c], targets[c]))) ) * 100 * 0.95)}%`;

  async function copyOrders() {
    const text = plan.trades.map((t) => `${t.side}\t${t.what}\t${t.where}\t$${t.amount.toLocaleString("en-US")}`).join("\n");
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard may be blocked */ }
    setCopied(true);
  }

  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
      <section aria-label="Agent" className="card" style={{ flex: "1 1 520px", minWidth: 0, padding: 24 }}>
        <div style={{ alignSelf: "flex-end", maxWidth: "80%", background: "var(--ink)", color: "var(--dark-text)", padding: "12px 16px", borderRadius: "10px 10px 2px 10px" }}>
          Rebalance toward my targets, but keep taxes as low as possible.
        </div>
        <div className="row" style={{ alignItems: "flex-start", gap: 12, flexWrap: "nowrap" }}>
          <span style={{ flex: "none", marginTop: 2 }}><ApexMark ground="#fff" /></span>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <div role="log" aria-label="Agent steps" className="dots-dark scan mono" style={{ backgroundColor: "var(--dark)", color: "var(--dark-text)", borderRadius: 6, padding: "14px 16px", fontSize: 12.5, display: "flex", flexDirection: "column", gap: 6 }}>
              {trace.map((t, i) => (
                <div key={i} className="trace-row" style={{ opacity: i < shown ? 1 : 0, transform: `translateY(${i < shown ? 0 : 6}px)`, transition: "opacity 350ms, transform 350ms" }}>
                  <span style={{ color: t[0] === "done" ? "var(--accent-soft)" : "var(--dark-muted)", width: 12 }}>{t[0] === "done" ? "✓" : "▸"}</span>
                  <span style={{ color: "#B9C0BA" }}>{t[0]} {t[1]}</span>
                  <span>{t[2]}</span>
                </div>
              ))}
              {!done && <span style={{ color: "var(--dark-muted)" }}>working<span className="blink">_</span></span>}
            </div>
            <div style={{ opacity: done ? 1 : 0, transition: "opacity 500ms", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: 0 }}>{summary}</p>
              <button type="button" className="chip" style={{ alignSelf: "flex-start" }} onClick={() => setRun((r) => r + 1)}>↻ replay steps</button>
            </div>
          </div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13, borderTop: "1px dashed var(--line-dash)", paddingTop: 14 }}>
          Plans are calculated from your synced holdings and default targets. Conversational follow-ups are the next iteration.
        </p>
      </section>

      <section aria-labelledby="pl-h" className="card" style={{ flex: "1 1 400px", minWidth: 0, padding: 24, opacity: done ? 1 : 0.35, transition: "opacity 600ms" }}>
        <div className="row between">
          <h2 id="pl-h">Proposed plans</h2>
          <div role="group" aria-label="Plan" className="seg" style={{ width: 168 }}>
            <span aria-hidden="true" className="seg-pill" style={{ left: 4 + ["A", "B", "C"].indexOf(key) * 53, width: 53, height: 36 }} />
            {plans.map((p) => (
              <button key={p.key} type="button" aria-pressed={key === p.key} style={{ width: 53, height: 36 }} onClick={() => { setKey(p.key); setCopied(false); }}>{p.key}</button>
            ))}
          </div>
        </div>

        <div key={key} className="anim-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 19, fontWeight: 700 }}>Plan {plan.key} · {plan.name}</span>
            {plan.key === recommended && <span className="mono" style={{ padding: "3px 8px", borderRadius: 4, background: "var(--neon)", color: "var(--ink)", fontSize: 11, fontWeight: 600 }}>recommended</span>}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}>{plan.desc}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {[
              ["sells", String(plan.sells)],
              ["max drift after", `${plan.maxDrift.toFixed(1)}%`],
              ["taxable gains", plan.realizedGain === null ? "unknown" : `$${Math.round(plan.realizedGain).toLocaleString("en-US")}`],
            ].map(([k, v]) => (
              <div key={k} className="dots inner" style={{ padding: "10px 12px" }}>
                <div className="mono muted" style={{ fontSize: 11 }}>{k}</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 700, color: k === "taxable gains" && plan.realizedGain ? "var(--warn)" : "var(--ink)" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="row between mono muted" style={{ fontSize: 11 }}>
            <span>drift · now vs after</span>
            <span className="row" style={{ gap: 12 }}>
              <span className="row" style={{ gap: 4 }}><span style={{ width: 10, height: 4, background: "#B4B8B3" }} />now</span>
              <span className="row" style={{ gap: 4 }}><span style={{ width: 10, height: 4, background: "var(--accent)" }} />after</span>
              <span className="row" style={{ gap: 4 }}><span style={{ width: 2, height: 10, background: "var(--ink)" }} />target</span>
            </span>
          </div>
          {classes.map((c) => (
            <div key={c} style={{ display: "grid", gridTemplateColumns: "110px 1fr 104px", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 14 }}>{c}</span>
              <div className="hatch" style={{ position: "relative", height: 18, backgroundColor: "var(--surface-2)", borderRadius: 2 }}>
                <div style={{ position: "absolute", left: 0, top: 3, height: 5, width: scale(now[c]), background: "#B4B8B3", borderRadius: 1 }} />
                <div style={{ position: "absolute", left: 0, top: 10, height: 5, width: scale(plan.after[c]), background: "var(--accent)", borderRadius: 1, transition: "width 900ms var(--ease)" }} />
                <div aria-hidden="true" style={{ position: "absolute", left: scale(targets[c]), top: -3, bottom: -3, width: 2, background: "var(--ink)" }} />
              </div>
              <span className="mono" style={{ textAlign: "right", fontSize: 12, color: "var(--ink-2)" }}>{now[c].toFixed(0)}→{plan.after[c].toFixed(0)}% / {targets[c]}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span className="mono muted" style={{ fontSize: 11, marginBottom: 6 }}>orders</span>
          {plan.trades.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Nothing to do — you&apos;re within target.</p>}
          {plan.trades.map((t, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px dashed var(--line-dash)" }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: t.side === "SELL" ? "var(--warn)" : t.side === "BUY" ? "var(--accent-ink)" : "var(--muted)" }}>{t.side}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{t.what}</div>
                <div className="mono muted" style={{ fontSize: 11 }}>{t.where}</div>
              </div>
              <span className="mono num" style={{ fontSize: 13 }}>${t.amount.toLocaleString("en-US")}</span>
            </div>
          ))}
        </div>

        {copied ? (
          <div className="dots anim-in" role="status" style={{ backgroundColor: "var(--accent-tint)", borderRadius: 6, padding: "14px 16px", color: "var(--accent-ink)", display: "flex", flexDirection: "column", gap: 4 }}>
            <strong>✓ Orders copied</strong>
            <span style={{ fontSize: 14 }}>Place them with your brokerage. Apex will reflect the new allocation after the next sync.</span>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={copyOrders} disabled={plan.trades.length === 0}>Approve &amp; copy orders</button>
        )}
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Arithmetic on your synced data, not financial advice. Apex is read-only; you place every trade.
        </p>
      </section>
    </div>
  );
}
