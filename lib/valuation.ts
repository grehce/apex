import "server-only";
import { formatAddress, type Address, type Estimate } from "./property";

/**
 * Home value estimates sit behind this interface so the provider can change
 * (or two can be blended) without touching the UI or the database.
 * Only the address is ever sent — never the member's name, email or balances.
 */
export interface ValuationProvider {
  name: string;
  estimate(address: Address): Promise<Estimate | null>;
}

export class ValuationError extends Error {}

/** RentCast AVM: GET /v1/avm/value?address=… → price, priceRangeLow/High, comparables. */
export function rentcast(apiKey: string, fetchImpl: typeof fetch = fetch): ValuationProvider {
  return {
    name: "RentCast",
    async estimate(address) {
      const url = new URL("https://api.rentcast.io/v1/avm/value");
      url.searchParams.set("address", formatAddress(address));
      let r: Response;
      try {
        r = await fetchImpl(url, { headers: { "X-Api-Key": apiKey, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
      } catch {
        throw new ValuationError("The valuation service didn't respond. Try again, or enter your own value.");
      }
      // 404 / 400: the address wasn't found or there weren't enough comparable sales.
      if (r.status === 404 || r.status === 400) return null;
      if (r.status === 401) throw new ValuationError("RentCast didn't recognize the API key (401). Check RENTCAST_API_KEY in Vercel matches the key in your RentCast API dashboard, then redeploy.");
      if (r.status === 403) throw new ValuationError("RentCast accepted the key but refused the request (403) — usually no API plan selected, a billing issue, or key restrictions. Check your RentCast API dashboard.");
      if (r.status === 429) throw new ValuationError("RentCast is rate-limiting requests. Try again in a minute.");
      if (!r.ok) throw new ValuationError("The valuation service had an error. Try again, or enter your own value.");
      const j = (await r.json().catch(() => null)) as { price?: unknown; priceRangeLow?: unknown; priceRangeHigh?: unknown; comparables?: unknown[] } | null;
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
      const value = num(j?.price);
      if (!value) return null;
      const low = num(j?.priceRangeLow) ?? value;
      const high = num(j?.priceRangeHigh) ?? value;
      return { value, low: Math.min(low, value), high: Math.max(high, value), comps: Array.isArray(j?.comparables) ? j!.comparables!.length : 0, provider: "RentCast", asOf: new Date().toISOString().slice(0, 10) };
    },
  };
}

export const valuationConfigured = () => Boolean(process.env.RENTCAST_API_KEY?.trim());

export function valuationProvider(): ValuationProvider | null {
  // Tolerate stray whitespace or quotes pasted into the Vercel field.
  const key = process.env.RENTCAST_API_KEY?.trim().replace(/^["']|["']$/g, "").trim();
  return key ? rentcast(key) : null;
}
