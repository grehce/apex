"use client";
import { useRef, useState } from "react";

/**
 * Single-line text that truncates with an ellipsis, and on hover/focus glides sideways
 * to reveal whatever was cut off. Does nothing when the text already fits.
 */
export function Scrolly({ text, style, className }: { text: string; style?: React.CSSProperties; className?: string }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  function start() {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const overflow = i.scrollWidth - o.clientWidth;
    if (overflow > 1) setShift(overflow + 4);
  }

  return (
    <span
      ref={outer}
      className={className}
      title={text}
      onMouseEnter={start}
      onMouseLeave={() => setShift(0)}
      style={{ display: "block", overflow: "hidden", whiteSpace: "nowrap", minWidth: 0, ...style }}
    >
      <span
        ref={inner}
        style={{
          display: "inline-block",
          transform: `translateX(${-shift}px)`,
          // ~40px per second, so long names read comfortably; snaps back quickly.
          transition: shift ? `transform ${Math.max(0.6, shift / 40)}s linear 0.25s` : "transform 0.3s ease",
          textOverflow: shift ? "clip" : "ellipsis",
          overflow: shift ? "visible" : "hidden",
          maxWidth: shift ? "none" : "100%",
          verticalAlign: "bottom",
        }}
      >
        {text}
      </span>
    </span>
  );
}
