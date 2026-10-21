"use client";

import { useState } from "react";
import { InstitutionMark } from "./Mark";
import { officialInstitutionLogo } from "@/lib/institution-logo-data";

export function InstitutionLogo({ name, logo, size = 40 }: { name: string; logo?: string | null; size?: number }) {
  const [failedLogos, setFailedLogos] = useState<string[]>([]);
  const official = officialInstitutionLogo(name);
  const source = [logo, official].find((candidate): candidate is string => Boolean(candidate && !failedLogos.includes(candidate)));
  if (!source) return <InstitutionMark name={name} size={size} />;
  return (
    // Plaid's embedded PNG needs neither an image proxy nor an external browser request.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={source} alt={`${name} logo`} width={size} height={size}
      referrerPolicy="no-referrer" onError={() => setFailedLogos((previous) => [...previous, source])}
      style={{ width: size, height: size, objectFit: "contain", borderRadius: 4, flex: "none", background: "#fff" }} />
  );
}
