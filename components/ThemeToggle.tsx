"use client";
import { useEffect, useState } from "react";

type Pref = "system" | "light" | "dark";
import { THEME_KEY as KEY } from "@/lib/theme";

function apply(pref: Pref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

const OPTIONS: { k: Pref; label: string; icon: React.ReactNode }[] = [
  { k: "system", label: "Match system", icon: <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="2" y="3" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6 14h4M8 11v3" stroke="currentColor" strokeWidth="1.5" /></svg> },
  { k: "light", label: "Day", icon: <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg> },
  { k: "dark", label: "Night", icon: <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M13.5 10.2A5.8 5.8 0 0 1 5.8 2.5a5.8 5.8 0 1 0 7.7 7.7z" fill="currentColor" /></svg> },
];

/** Day / night / system switch. Defaults to the device setting and follows it live until you pick. */
export function ThemeToggle() {
  const [pref, setPref] = useState<Pref>("system");

  useEffect(() => {
    let saved: Pref = "system";
    try { saved = (localStorage.getItem(KEY) as Pref) || "system"; } catch { /* ignore */ }
    setPref(saved);
  }, []);

  useEffect(() => {
    apply(pref);
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [pref]);

  function choose(p: Pref) {
    setPref(p);
    try { if (p === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch { /* ignore */ }
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className="theme-toggle">
      {OPTIONS.map((o) => (
        <button key={o.k} type="button" role="radio" aria-checked={pref === o.k} aria-label={o.label} title={o.label} onClick={() => choose(o.k)}>
          {o.icon}
        </button>
      ))}
    </div>
  );
}
