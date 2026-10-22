"use client";

import { useState } from "react";
import { InstitutionMark } from "./Mark";
import { officialInstitutionLogo } from "@/lib/institution-logo-data";

export function InstitutionLogo({ name, logo, size = 40 }: { name: string; logo?: string | null; size?: number }) {
  const [failedLogos, setFailedLogos] = useState<string[]>([]);
  const official = officialInstitutionLogo(name);
  // A locally hosted official asset wins over Plaid's PNG (some, like American Express, arrive cropped).
  const source = [official, logo].find((candidate): candidate is string => Boolean(candidate && !failedLogos.includes(candidate)));
  if (!source) return <InstitutionMark name={name} size={size} />;
  return (
    // Plaid's embedded PNG needs neither an image proxy nor an external browser request.
    // eslint-disable-next-line @next/next/no-img-element
    // A uniform tile with breathing room, so logos with different shapes and backgrounds read as a set;
    // in dark mode the tile softens (see .inst-logo in globals.css).
    <span className="inst-logo" style={{ width: size, height: size }}>
      <img src={source} alt={`${name} logo`} width={size} height={size}
        referrerPolicy="no-referrer" onError={() => setFailedLogos((previous) => [...previous, source])}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </span>
  );
}
