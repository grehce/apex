"use client";
import { useEffect, useState } from "react";

// Original lines (not attributed quotes), so nothing here is misattributed or borrowed.
const LINES = [
  "Small, boring, consistent. That's the whole trick.",
  "Every dollar you don't need today is a gift to future you.",
  "Spend on what you love. Cut what you won't remember.",
  "Compound interest rewards the patient and the stubborn.",
  "A budget is just a plan for saying yes on purpose.",
  "Wealth is mostly options. Keep building yours.",
  "The best financial move is often the quiet one.",
  "You don't have to be rich to be intentional.",
  "Progress, not perfection — check in, adjust, keep going.",
  "Time in the market is a kindness to your later self.",
];

export function Quotes() {
  // Start on a fixed line so server and browser render the same thing, then shuffle in.
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(Math.floor(Math.random() * LINES.length));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), 9000);
    return () => clearInterval(t);
  }, []);
  return (
    <span key={i} className="anim-in" aria-live="off" style={{ animationDuration: "600ms" }}>
      “{LINES[i]}”
    </span>
  );
}
