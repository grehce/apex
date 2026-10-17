export function ApexMark({ size = 28, ink = "var(--ink)", accent = "#C8FF3A" }: {
  size?: number;
  ink?: string;
  accent?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      {/* legs match the letter stroke weight; the neon dot is the A's crossbar */}
      <path d="M24 5L47 43H38.23L24 19.48L9.77 43H1Z" fill={ink} />
      {/* neon dot as the crossbar: the one spot of brand highlight */}
      <circle cx="24" cy="36.4" r="6.6" fill={accent} />
    </svg>
  );
}

/**
 * Wordmark: a custom-drawn "Apex". Every letter shares the A's stroke weight, the neon dot is the
 * A's crossbar, and the p's counter is exactly the dot's size. `size` is the equivalent font size in px.
 * Units: baseline at y=43, cap height 38, x-height 28.2, descender 10.
 */
export function ApexWordmark({ size = 20, ink = "currentColor", accent = "#C8FF3A" }: { size?: number; ink?: string; accent?: string }) {
  const cap = size * 0.74;
  const u = cap / 38; // px per unit
  return (
    // Inline-block wrapper gives the logo a real text baseline; the svg drops its descender below it.
    <span style={{ display: "inline-block", fontSize: size, lineHeight: 1, flex: "none" }}>
    <svg role="img" aria-label="Apex" viewBox="1 5 143.1 48" height={48 * u} width={143.1 * u} style={{ display: "inline-block", verticalAlign: -10 * u, overflow: "visible" }}>
      <title>Apex</title>
        <path d="M24 5L47 43H38.23L24 19.48L9.77 43H1Z" fill={ink} />
        <circle cx="24" cy="36.4" r="6.6" fill={accent} />
        <rect x="51.5" y="14.80" width="7.5" height="38.20" fill={ink} />
        <path d="M51.50 28.90a14.10 14.10 0 1 0 28.20 0a14.10 14.10 0 1 0 -28.20 0ZM59.00 28.90a6.6 6.6 0 1 0 13.2 0a6.6 6.6 0 1 0 -13.2 0Z" fill={ink} fillRule="evenodd" />
        <path d="M108.65 28.90A10.35 10.35 0 1 0 105.99 35.83" fill="none" stroke={ink} strokeWidth="7.5" />
        <rect x="87.95" y="25.90" width="24.45" height="6.00" fill={ink} />
        <polygon points="116.40,14.80 125.17,14.80 143.10,43 134.33,43" fill={ink} />
        <polygon points="143.10,14.80 134.33,14.80 116.40,43 125.17,43" fill={ink} />
    </svg>
    </span>
  );
}

/** Generic geometric tile for an institution — picks one of a few modernist shapes from the name. */
export function InstitutionMark({ name, size = 40 }: { name: string; size?: number }) {
  const palette = ["#3B4A5A", "#A47E4C", "#17191A", "#5C6B5E", "#8E9AA6", "#3D5A4C"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = palette[h % palette.length];
  const shape = h % 5;
  const icon = size * 0.6;
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: 4, background: bg, display: "grid", placeItems: "center", flex: "none" }}
    >
      <svg width={icon} height={icon} viewBox="0 0 48 48">
        {shape === 0 && (<><circle cx="24" cy="24" r="18" fill="#fff" /><rect x="4" y="16" width="40" height="4" fill={bg} /></>)}
        {shape === 1 && (<><rect x="6" y="32" width="36" height="10" fill="#fff" /><rect x="12" y="21" width="24" height="9" fill="#fff" /><rect x="18" y="10" width="12" height="9" fill="#fff" /></>)}
        {shape === 2 && <path d="M6 42V24A18 18 0 0 1 42 24V42H32V24A8 8 0 0 0 16 24V42Z" fill="#fff" />}
        {shape === 3 && (<><path d="M6 24A18 18 0 0 1 42 24Z" fill="#fff" /><rect x="6" y="28" width="36" height="5" fill="#fff" /><rect x="12" y="37" width="24" height="5" fill="#fff" /></>)}
        {shape === 4 && (<><path d="M24 4L44 24L24 44Z" fill="#fff" /><path d="M24 4L4 24L24 44Z" fill="#fff" opacity=".55" /></>)}
      </svg>
    </span>
  );
}
