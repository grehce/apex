import "server-only";
import { and, eq } from "drizzle-orm";
import { db, dbConfigured } from "./db";
import { decrypt } from "./crypto";
import { manualEntries, mortgageDetails } from "./schema";
import { validateAddress, type Address } from "./property";

export type MortgageInfo = { accountId: string; address: Address | null; interestRatePct: number | null; interestRateType: string | null; maturityDate: string | null; nextPayment: number | null };

function open(enc: string | null): Address | null {
  if (!enc) return null;
  try { return validateAddress(JSON.parse(decrypt(enc))); } catch { return null; }
}

/** Settings only: decrypted home addresses (by manual entry id) and Plaid mortgage details (by account id). */
export async function homeContext(email: string): Promise<{ addresses: Record<string, Address>; mortgages: Record<string, MortgageInfo> }> {
  if (!dbConfigured() || !process.env.ENCRYPTION_KEY) return { addresses: {}, mortgages: {} };
  const d = db();
  const [homes, loans] = await Promise.all([
    d.select({ id: manualEntries.id, addressEnc: manualEntries.addressEnc }).from(manualEntries).where(and(eq(manualEntries.userEmail, email), eq(manualEntries.category, "property"))),
    d.select().from(mortgageDetails).where(eq(mortgageDetails.userEmail, email)),
  ]);
  const addresses: Record<string, Address> = {};
  for (const h of homes) { const a = open(h.addressEnc); if (a) addresses[h.id] = a; }
  const mortgages: Record<string, MortgageInfo> = {};
  for (const m of loans) mortgages[m.accountId] = { accountId: m.accountId, address: open(m.propertyAddressEnc), interestRatePct: m.interestRatePct, interestRateType: m.interestRateType, maturityDate: m.maturityDate, nextPayment: m.nextPayment };
  return { addresses, mortgages };
}
