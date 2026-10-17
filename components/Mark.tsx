export function ApexMark({ size = 28, ink = "#17191A", ground = "#F4F4F2", accent = "#3DFF8B" }: {
  size?: number;
  ink?: string;
  ground?: string;
  accent?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 5L45 43H3Z" fill={ink} />
      <path d="M24 27L32 43H16Z" fill={ground} />
      {/* neon dot: the one spot of brand highlight */}
      <circle cx="24" cy="13" r="4" fill={accent} />
    </svg>
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
