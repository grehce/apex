"use client";

import { useState } from "react";
import { InstitutionMark } from "./Mark";

export function InstitutionLogo({ name, logo, size = 40 }: { name: string; logo?: string | null; size?: number }) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  if (!logo || failedLogo === logo) return <InstitutionMark name={name} size={size} />;
  return (
    // Plaid's embedded PNG needs neither an image proxy nor an external browser request.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={`${name} logo`} width={size} height={size}
      referrerPolicy="no-referrer" onError={() => setFailedLogo(logo)}
      style={{ width: size, height: size, objectFit: "contain", borderRadius: 4, flex: "none", background: "#fff" }} />
  );
}
