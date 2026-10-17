"use client";
import { useEffect, useState } from "react";
import { useTween } from "./hooks";

type Status = { position: number; total: number; referrals: number; refCode: string };
const KEY = "apex.waitlist.code";
const PER_REF = 5;

export function WaitlistForm({ referral }: { referral: string | null }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Returning visitor: show their spot instead of the form.
  useEffect(() => {
    let code: string | null = null;
    try { code = localStorage.getItem(KEY); } catch { /* ignore */ }
    if (!code) return;
    fetch(`/api/waitlist?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setStatus(s))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: f.get("name"), email: f.get("email"), note: f.get("note"), website: f.get("website"), ref: referral }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Something went wrong. Please try again.");
      if (j.refCode) {
        try { localStorage.setItem(KEY, j.refCode); } catch { /* ignore */ }
        setStatus({ position: j.position, total: j.total, referrals: j.referrals, refCode: j.refCode });
      }
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (status) return <Spot s={status} copied={copied} setCopied={setCopied} onReset={() => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setStatus(null); }} />;

  const field: React.CSSProperties = { width: "100%", minHeight: 48, padding: "12px 14px", border: "1px solid #C9CDC8", borderRadius: 4, font: "inherit", background: "#fff", color: "var(--ink)" };
  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }} noValidate>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>name</span>
        <input name="name" required maxLength={80} autoComplete="name" style={field} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>email</span>
        <input name="email" type="email" required maxLength={200} autoComplete="email" style={field} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>note <span className="muted">· optional — what should Apex do for you?</span></span>
        <textarea name="note" maxLength={500} rows={3} style={{ ...field, resize: "vertical" }} />
      </label>
      {/* honeypot for bots — hidden from people and screen readers */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
      {err && <div role="alert" className="banner" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>{err}</div>}
      <button type="submit" className="btn btn-primary" disabled={busy} style={{ height: 52, fontSize: 16 }}>
        {busy ? "Claiming your seat…" : "Claim my seat"}
      </button>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>We&apos;ll only email you about your invite. No spam, no selling your info.</p>
    </form>
  );
}

function Spot({ s, copied, setCopied, onReset }: { s: Status; copied: boolean; setCopied: (b: boolean) => void; onReset: () => void }) {
  const pos = useTween(s.position, 1200);
  const link = typeof window !== "undefined" ? `${window.location.origin}/waitlist?ref=${s.refCode}` : `/waitlist?ref=${s.refCode}`;
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }
  async function share() {
    try { await navigator.share({ title: "Apex", text: "I'm on the Apex waitlist — join with my link and we both move up.", url: link }); } catch { /* dismissed */ }
  }
  return (
    <div className="anim-in" style={{ display: "flex", flexDirection: "column", gap: 18 }} aria-live="polite">
      <div className="dots inner" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="eyebrow">your spot</span>
        <span className="num hl" style={{ alignSelf: "flex-start", fontSize: "clamp(48px, 13vw, 64px)", fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1 }}>#{Math.max(1, Math.round(pos))}</span>
        <span className="mono muted" style={{ fontSize: 12 }}>
          of {s.total} waiting · {s.referrals} friend{s.referrals === 1 ? "" : "s"} joined with your link
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <strong>Skip the line</strong>
        <span style={{ color: "var(--ink-2)", fontSize: 14 }}>Every friend who joins with your link moves you up {PER_REF} spots.</span>
        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <code className="mono" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "12px 14px", border: "1px dashed #C9CDC8", borderRadius: 4, fontSize: 13, background: "#fff" }}>{link}</code>
          <button type="button" className="btn" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
          {typeof navigator !== "undefined" && "share" in navigator && <button type="button" className="btn btn-primary" onClick={share}>Share</button>}
        </div>
      </div>
      <button type="button" className="chip" style={{ alignSelf: "flex-start" }} onClick={onReset}>not you? join with another email</button>
    </div>
  );
}
