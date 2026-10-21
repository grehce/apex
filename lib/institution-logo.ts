import "server-only";
import { unstable_cache } from "next/cache";
import { CountryCode } from "plaid";
import { plaid, plaidConfigured, plaidEnv } from "./plaid";
import { institutionLogoData } from "./institution-logo-data";

// Cache only public institution metadata, keyed by environment and institution ID.
const cachedLogo = unstable_cache(async (_environment: string, institutionId: string) => {
    const result = await plaid().institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
      options: { include_optional_metadata: true },
    }, { timeout: 3000 });
    const logo = institutionLogoData(result.data.institution.logo);
    if (!logo) throw new Error("Institution logo unavailable");
    return logo;
}, ["institution-logo-v2"], { revalidate: 86400 });

export async function institutionLogo(institutionId?: string | null): Promise<string | null> {
  if (!institutionId || !plaidConfigured()) return null;
  try {
    return await cachedLogo(plaidEnv(), institutionId);
  } catch {
    return null; // Failures fall back without storing a successful, day-long null cache entry.
  }
}
