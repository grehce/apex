"use client";
import { useEffect, useRef, useState } from "react";

/** True one frame after mount — lets CSS transitions animate from their empty state. */
export function useMounted(delay = 60) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setM(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return m;
}

/** Eases a number toward `target` whenever it changes. */
export function useTween(target: number, duration = 1200) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    let raf = 0;
    let t0: number | null = null;
    const start = from.current;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setV(target);
      from.current = target;
      return;
    }
    const step = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min(1, (ts - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      const next = start + (target - start) * e;
      from.current = next;
      setV(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}
