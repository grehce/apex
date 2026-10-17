"use client";
import { useEffect, useState } from "react";

type Answer = { q: string; value: string; sub: string };

/**
 * A read-only "terminal readout": pick a query chip and it types itself out, then shows the answer.
 * Deliberately not an input — it shouldn't look like something you can type into.
 */
export function CommandBar({ answers }: { answers: Answer[] }) {
  const [sel, setSel] = useState(0);
  const [typed, setTyped] = useState(answers[0]?.q.length ?? 0);
  const a = answers[sel];
  const done = typed >= a.q.length;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTyped(a.q.length);
      return;
    }
    setTyped(0);
    const t = setInterval(() => setTyped((n) => (n >= a.q.length ? (clearInterval(t), n) : n + 1)), 22);
    return () => clearInterval(t);
  }, [sel, a.q.length]);

  return (
    <section aria-label="Quick answers" className="dots-dark mono" style={{ backgroundColor: "var(--dark)", color: "var(--dark-text)", borderRadius: "var(--r-card)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 28, padding: "0 4px", fontSize: 14, borderBottom: "1px dashed var(--dark-line)", paddingBottom: 12 }}>
        <span style={{ color: "var(--accent-soft)", fontWeight: 600 }}>apex&gt;</span>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.q.slice(0, typed)}
          <span className="blink" style={{ color: "var(--accent-soft)" }}>▍</span>
        </span>
      </div>
      <div className="row" aria-live="polite" style={{ alignItems: "baseline", gap: "6px 16px", padding: "0 4px", minHeight: 44, opacity: done ? 1 : 0, transition: "opacity 300ms" }}>
        <span className="sr-only">{a.q}:</span>
        <span style={{ color: "var(--dark-muted)" }}>→</span>
        <span className="num" style={{ fontFamily: "var(--sans)", fontSize: "clamp(26px, 7vw, 34px)", fontWeight: 700, letterSpacing: "-0.03em" }}>{a.value}</span>
        <span style={{ color: "#B9C0BA", fontSize: 13 }}>{a.sub}</span>
      </div>
      <div className="row" role="group" aria-label="Pick a question" style={{ gap: 8 }}>
        {answers.map((x, i) => (
          <button key={x.q} type="button" className="chip chip-dark" aria-pressed={sel === i} onClick={() => setSel(i)}>
            {x.q}
          </button>
        ))}
      </div>
    </section>
  );
}
