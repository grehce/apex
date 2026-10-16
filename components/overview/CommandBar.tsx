"use client";
import { useState } from "react";

type Answer = { q: string; value: string; sub: string };

export function CommandBar({ answers }: { answers: Answer[] }) {
  const [sel, setSel] = useState(0);
  const [typed, setTyped] = useState<string | null>(null);
  const [miss, setMiss] = useState(false);
  const a = answers[sel];

  function run(i: number) {
    setSel(i);
    setTyped(null);
    setMiss(false);
  }

  return (
    <section aria-label="Ask Apex" className="dots-dark mono" style={{ backgroundColor: "var(--dark)", color: "var(--dark-text)", borderRadius: "var(--r-card)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <label className="scan" style={{ display: "flex", alignItems: "center", gap: 12, height: 48, padding: "0 16px", backgroundColor: "var(--dark-2)", border: "1px solid var(--dark-line)", borderRadius: "var(--r-inner)" }}>
        <span style={{ color: "var(--accent-soft)", fontWeight: 600 }}>apex&gt;</span>
        <span className="sr-only">Ask Apex a question about your money</span>
        <input
          type="text"
          spellCheck={false}
          value={typed ?? a.q}
          onChange={(e) => { setTyped(e.target.value); setMiss(false); }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const i = answers.findIndex((x) => x.q === (typed ?? "").trim());
            if (i >= 0) run(i);
            else setMiss(true);
          }}
          style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", color: "var(--dark-text)", font: "inherit", fontSize: 14, outline: "none" }}
        />
      </label>
      {typed === null ? (
        <div key={sel} className="anim-in row" style={{ alignItems: "baseline", gap: "6px 16px", padding: "2px 4px" }}>
          <span style={{ color: "var(--dark-muted)" }}>→</span>
          <span className="num" style={{ fontFamily: "var(--sans)", fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em" }}>{a.value}</span>
          <span style={{ color: "#B9C0BA", fontSize: 13 }}>{a.sub}</span>
        </div>
      ) : (
        <div style={{ padding: "2px 4px", color: "var(--dark-muted)", fontSize: 13 }} aria-live="polite">
          ↵ to run<span className="blink">_</span> {miss ? " no match yet — free-form queries are coming; try a suggestion" : " · or pick a suggestion"}
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        {answers.map((x, i) => (
          <button key={x.q} type="button" className="chip chip-dark" aria-pressed={sel === i && typed === null} onClick={() => run(i)}>
            {x.q}
          </button>
        ))}
      </div>
    </section>
  );
}
