// Pure helpers for real estate entries. No secrets, no network — safe to import from client and tests.

export type Address = { street: string; city: string; region: string; postalCode: string };

/** A value estimate as returned by a valuation provider, before anything is saved. */
export type Estimate = { value: number; low: number; high: number; comps: number; provider: string; asOf: string };

const STATE = /^[A-Z]{2}$/;
const ZIP = /^\d{5}(-\d{4})?$/;

export function validateAddress(input: unknown): Address {
  const x = (input ?? {}) as Partial<Record<keyof Address, unknown>>;
  const s = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
  const a: Address = { street: s(x.street), city: s(x.city), region: s(x.region).toUpperCase(), postalCode: s(x.postalCode) };
  if (!a.street || a.street.length > 120) throw new Error("Enter the street address");
  if (!a.city || a.city.length > 80) throw new Error("Enter the city");
  if (!STATE.test(a.region)) throw new Error("Enter the two-letter state, e.g. CA");
  if (!ZIP.test(a.postalCode)) throw new Error("Enter a 5-digit ZIP code");
  return a;
}

export function formatAddress(a: Address): string {
  return `${a.street}, ${a.city}, ${a.region} ${a.postalCode}`;
}

/** Plaid mortgage property_address → Address, or null if Plaid didn't send enough to use. */
export function fromPlaidAddress(p: { street?: string | null; city?: string | null; region?: string | null; postal_code?: string | null } | null | undefined): Address | null {
  if (!p) return null;
  try { return validateAddress({ street: p.street, city: p.city, region: p.region, postalCode: p.postal_code?.slice(0, 10) }); } catch { return null; }
}

/** Short label for a home: the street line, without unit noise. */
export function homeLabel(a: Address | null | undefined): string {
  return a ? a.street : "Home";
}

/** Equity and loan-to-value for a home and the mortgage balance it secures (balance is positive here). */
export function equity(homeValue: number, mortgageBalance: number) {
  const eq = homeValue - mortgageBalance;
  const ltv = homeValue > 0 ? mortgageBalance / homeValue : null;
  return { equity: eq, ltv };
}

/** Automatic estimates refresh after this many days. */
export const REVALUE_AFTER_DAYS = 30;

export function needsRevalue(lastValuedAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!lastValuedAt) return true;
  return now.getTime() - new Date(lastValuedAt).getTime() >= REVALUE_AFTER_DAYS * 86400000;
}

/** Home values in whole dollars — cents are noise on an estimate. */
export function dollars(n: number): string {
  return `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}
