"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Step = { tool: string; input: Record<string, unknown> };
type Msg = { role: "user" | "assistant"; content: string; steps?: Step[]; error?: boolean };

const STEP_LABEL: Record<string, string> = {
  get_summary: "read summary",
  get_accounts: "read accounts",
  get_holdings: "read holdings",
  get_transactions: "read transactions",
  get_plans: "calc plans",
};
function stepText(s: Step) {
  const bits = Object.entries(s.input).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${v}`);
  return `${STEP_LABEL[s.tool] ?? s.tool}${bits.length ? ` · ${bits.join(" ")}` : ""}`;
}

/** Tiny, safe formatter: paragraphs, "- " bullets and **bold**. No HTML is ever injected. */
function Rich({ text }: { text: string }) {
  const bold = (line: string) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>));
  const blocks = text.split(/\n{2,}/);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
          return <ul key={i} style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>{lines.map((l, j) => <li key={j}>{bold(l.replace(/^\s*[-•*]\s+/, ""))}</li>)}</ul>;
        }
        return <p key={i} style={{ margin: 0 }}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{bold(l.replace(/^#+\s*/, ""))}</Fragment>)}</p>;
      })}
    </div>
  );
}

const SUGGESTIONS = ["Where did my money go this month?", "How much tax would rebalancing cost?", "I have $20k to invest. Where should it go?"];

export function AgentChat({ signedIn, configured }: { signedIn: boolean; configured: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (msgs.length) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [msgs]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const history = [...msgs.filter((m) => !m.error).map(({ role, content }) => ({ role, content })), { role: "user" as const, content: question }].slice(-20);
    setMsgs((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "", steps: [] }]);
    setInput("");
    setBusy(true);
    const patch = (f: (a: Msg) => Msg) => setMsgs((m) => [...m.slice(0, -1), f(m[m.length - 1])]);
    try {
      const r = await fetch("/api/agent/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history }) });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `Request failed (${r.status})`);
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "step") patch((a) => ({ ...a, steps: [...(a.steps ?? []), { tool: e.tool, input: e.input }] }));
          if (e.type === "answer") patch((a) => ({ ...a, content: e.text }));
          if (e.type === "error") patch((a) => ({ ...a, content: e.message, error: true }));
        }
      }
    } catch (e) {
      patch((a) => ({ ...a, content: (e as Error).message, error: true }));
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 13, borderTop: "1px dashed var(--line-dash)", paddingTop: 14 }}>
        Members can ask the agent anything about their own money. <Link href="/signin">Sign in</Link> to ask your own questions.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, borderTop: "1px dashed var(--line-dash)", paddingTop: 16 }}>
      {msgs.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="fade-soft" style={{ alignSelf: "flex-end", maxWidth: "85%", background: "var(--tip-bg)", color: "var(--dark-text)", padding: "10px 14px", borderRadius: "10px 10px 2px 10px", whiteSpace: "pre-wrap" }}>{m.content}</div>
        ) : (
          <div key={i} className="fade-soft" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(m.steps?.length || (busy && i === msgs.length - 1)) ? (
              <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 3 }}>
                {m.steps?.map((s, j) => <span key={j}>▸ {stepText(s)}</span>)}
                {busy && i === msgs.length - 1 && !m.content && <span>thinking<span className="blink">_</span></span>}
              </div>
            ) : null}
            {m.content && (m.error ? <div role="alert" className="banner" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>{m.content}</div> : <Rich text={m.content} />)}
          </div>
        ),
      )}
      <div ref={endRef} />

      {!configured ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Ask-anything is almost ready: it switches on once the AI key is added.</p>
      ) : (
        <>
          {msgs.length === 0 && (
            <div className="row" style={{ gap: 6 }}>
              {SUGGESTIONS.map((s) => <button key={s} type="button" className="chip" onClick={() => ask(s)} disabled={busy}>{s}</button>)}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
            <label htmlFor="agent-q" className="sr-only">Ask the agent</label>
            <textarea
              id="agent-q"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
              rows={1}
              maxLength={2000}
              placeholder="Ask anything about your money…"
              style={{ flex: 1, minWidth: 0, minHeight: 44, maxHeight: 160, padding: "11px 12px", border: "1px solid var(--line-strong)", borderRadius: 4, background: "var(--field)", color: "var(--ink)", font: "inherit", resize: "vertical" }}
            />
            <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>{busy ? "…" : "Ask"}</button>
          </form>
          <span className="note">Answers use your synced data and Apex&apos;s plan calculator. Not financial advice; Apex can&apos;t move money or place trades.</span>
        </>
      )}
    </div>
  );
}
