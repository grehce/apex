/** Smooth, resampled path for a series, so range switches can animate between same-shaped paths. */
export function seriesPath(v: number[], width = 1000, height = 260, top = 16, span = 228) {
  const n = v.length;
  let min = Math.min(...v);
  let max = Math.max(...v);
  const pad = (max - min) * 0.1 || Math.max(1, Math.abs(max) * 0.01);
  min -= pad;
  max += pad;
  const y = (val: number) => top + (1 - (val - min) / (max - min)) * span;
  const N = 24;
  const pts: [number, number][] = [];
  for (let j = 0; j < N; j++) {
    const t = (j / (N - 1)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(t));
    const f = t - i;
    const val = n === 1 ? v[0] : v[i] + (v[i + 1] - v[i]) * f;
    pts.push([(j / (N - 1)) * width, y(val)]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let k = 0; k < N - 1; k++) {
    const p0 = pts[k - 1] ?? pts[k];
    const p1 = pts[k];
    const p2 = pts[k + 1];
    const p3 = pts[k + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return { line: d, area: `${d} L${width} ${height} L0 ${height} Z`, y };
}

export function kfmt(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return `${n < 0 ? "−" : ""}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${n < 0 ? "−" : ""}$${(a / 1e3).toFixed(1)}k`;
  return `${n < 0 ? "−" : ""}$${a.toFixed(0)}`;
}
