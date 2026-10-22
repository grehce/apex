"use client";

import { useState } from "react";
import { InstitutionMark } from "./Mark";
import { officialInstitutionLogo } from "@/lib/institution-logo-data";

// Round logos (a mark inside a circle on a white square) look like a cutout inside our square tile.
// For these, the tile takes the circle's color and the image is enlarged until the circle covers the
// tile (√2 ≈ 1.42), so it reads like the brand's own app icon: a solid tile with the mark centered.
const ROUND_MARKS: Record<string, { bg: string; scale: number }> = {
  "x money": { bg: "#000", scale: 1.45 },
};

export function InstitutionLogo({ name, logo, size = 40 }: { name: string; logo?: string | null; size?: number }) {
  const [failedLogos, setFailedLogos] = useState<string[]>([]);
  const official = officialInstitutionLogo(name);
  const fill = ROUND_MARKS[name.trim().toLowerCase()];
  // A locally hosted official asset wins over Plaid's PNG (some, like American Express, arrive cropped).
  const source = [official, logo].find((candidate): candidate is string => Boolean(candidate && !failedLogos.includes(candidate)));
  if (!source) return <InstitutionMark name={name} size={size} />;
  return (
    // Plaid's embedded PNG needs neither an image proxy nor an external browser request.
    // eslint-disable-next-line @next/next/no-img-element
    // A uniform tile with breathing room, so logos with different shapes and backgrounds read as a set;
    // in dark mode the tile softens (see .inst-logo in globals.css).
    <span className={`inst-logo${fill ? " inst-logo-fill" : ""}`} style={{ width: size, height: size, ...(fill ? { background: fill.bg } : {}) }}>
      <img src={source} alt={`${name} logo`} width={size} height={size}
        referrerPolicy="no-referrer" onError={() => setFailedLogos((previous) => [...previous, source])}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", ...(fill && source !== official ? { transform: `scale(${fill.scale})` } : {}) }} />
    </span>
  );
}
