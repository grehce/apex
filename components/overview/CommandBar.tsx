"use client";
import { useMemo, useRef, useState } from "react";

type Answer = { q: string; value: string; sub: string };

/** Rank queries against what's typed: prefix first, then every word found somewhere. */
function rank(answers: Answer[], input: string) {
  const s = input.trim().toLowerCase();
  if (!s) return answers;
  const words = s.split(/\s+/);
  return answers
    .map((a) => {
      const q = a.q.toLowerCase();
      const score = q.startsWith(s) ? 0 : words.every((w) => q.includes(w)) ? 1 : 9;
      return { a, score };
    })
    .filter((x) => x.score < 9)
    .sort((x, y) => x.score - y.score || x.a.q.length - y.a.q.length)
    .map((x) => x.a);
}

/**
 * A small query line: type, get completions, press Enter for the answer.
 * Tab or → accepts the grey completion; ↑/↓ move through suggestions.
 */
export function CommandBar({ answers }: { answers: Answer[] }) {
  const [input, setInput] = useState(answers[0]?.q ?? "");
  const [result, setResult] = useState<Answer | null>(answers[0] ?? null);
  const [miss, setMiss] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => rank(answers, input), [answers, input]);
  const top = matches[hi] ?? matches[0];
  // Ghost completion only when what's typed is a prefix of the highlighted suggestion.
  const ghost = input && top && top.q.toLowerCase().startsWith(input.toLowerCase()) ? top.q.slice(input.length) : "";

  function run(a: Answer | undefined) {
    setOpen(false);
    setHi(0);
    if (!a) {
      setMiss(input.trim());
      setResult(null);
      return;
    }
    setInput(a.q);
    setMiss(null);
    setResult(a);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Tab" || e.key === "ArrowRight") && ghost && ref.current?.selectionStart === input.length) {
      e.preventDefault();
      setInput(top!.q);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const exact = answers.find((a) => a.q.toLowerCase() === input.trim().toLowerCase());
      run(exact ?? (open || input.trim() ? top : undefined));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <section aria-label="Ask Apex" className="dots-dark mono" style={{ backgroundColor: "var(--dark)", color: "var(--dark-text)", borderRadius: "var(--r-card)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ position: "relative" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 36, padding: "0 4px 12px", fontSize: 14, borderBottom: "1px dashed var(--dark-line)", cursor: "text" }}>
          <span style={{ color: "var(--accent-soft)", fontWeight: 600 }}>apex&gt;</span>
          <span className="sr-only">Ask a question about your money</span>
          <span style={{ position: "relative", flex: 1, minWidth: 0, display: "flex" }}>
            {/* ghost completion sits behind the input, aligned to the typed text */}
            <span aria-hidden="true" style={{ position: "absolute", inset: 0, whiteSpace: "pre", overflow: "hidden", pointerEvents: "none", color: "transparent" }}>
              {input}<span style={{ color: "var(--dark-muted)" }}>{ghost}</span>
            </span>
            <input
              ref={ref}
              value={input}
              onChange={(e) => { setInput(e.target.value); setOpen(true); setHi(0); setMiss(null); }}
              onFocus={(e) => { setOpen(true); e.currentTarget.select(); }}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onKeyDown={onKey}
              placeholder="try spend, income, networth…"
              spellCheck={false}
              autoComplete="off"
              role="combobox"
              aria-expanded={open && matches.length > 0}
              aria-controls="cmd-list"
              aria-autocomplete="both"
              style={{ position: "relative", flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", color: "var(--dark-text)", font: "inherit", caretColor: "var(--neon)", padding: 0 }}
            />
          </span>
          <span aria-hidden="true" className="hide-sm" style={{ color: "var(--dark-muted)", fontSize: 11, whiteSpace: "nowrap" }}>tab ⇥ complete · ↵ run</span>
        </label>
        {open && matches.length > 0 && (
          <ul id="cmd-list" role="listbox" aria-label="Suggestions" style={{ position: "absolute", zIndex: 20, left: 0, right: 0, top: "100%", margin: "4px 0 0", padding: 4, listStyle: "none", background: "#202422", border: "1px solid var(--dark-line)", borderRadius: 6, boxShadow: "0 12px 28px rgba(0,0,0,.35)" }}>
            {matches.slice(0, 6).map((m, i) => (
              <li
                key={m.q}
                role="option"
                aria-selected={i === hi}
                onMouseDown={(e) => { e.preventDefault(); run(m); }}
                onMouseEnter={() => setHi(i)}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 10px", borderRadius: 4, fontSize: 13, cursor: "pointer", background: i === hi ? "rgba(200,255,58,.12)" : "transparent" }}
              >
                <span style={{ color: i === hi ? "var(--neon)" : "var(--dark-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.q}</span>
                <span className="hide-sm" style={{ color: "var(--dark-muted)", whiteSpace: "nowrap" }}>{m.sub}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="row" aria-live="polite" style={{ alignItems: "baseline", gap: "6px 16px", padding: "0 4px", minHeight: 44 }}>
        {result ? (
          <>
            <span style={{ color: "var(--dark-muted)" }}>→</span>
            <span key={result.q} className="num anim-in" style={{ fontFamily: "var(--sans)", fontSize: "clamp(26px, 7vw, 34px)", fontWeight: 700, letterSpacing: "-0.03em" }}>{result.value}</span>
            <span style={{ color: "#B9C0BA", fontSize: 13 }}>{result.sub}</span>
          </>
        ) : (
          <span style={{ color: "#B9C0BA", fontSize: 13 }}>
            Apex doesn&apos;t know “{miss}” yet. Try one of these ↓
          </span>
        )}
      </div>
      <div className="row" role="group" aria-label="Suggested questions" style={{ gap: 8 }}>
        {answers.slice(0, 4).map((x) => (
          <button key={x.q} type="button" className="chip chip-dark" aria-pressed={result?.q === x.q} onClick={() => run(x)}>
            {x.q}
          </button>
        ))}
      </div>
    </section>
  );
}
