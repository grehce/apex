/** Plaid supplies logos as base64 PNGs. Never accept remote URLs or executable image formats. */
export function institutionLogoData(logo: string | null | undefined): string | null {
  if (!logo || logo.length > 256_000 || !/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(logo)) return null;
  return `data:image/png;base64,${logo}`;
}
