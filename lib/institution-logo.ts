import "server-only";
import { unstable_cache } from "next/cache";
import { CountryCode } from "plaid";
import { plaid, plaidConfigured, plaidEnv } from "./plaid";
import { institutionLogoData } from "./institution-logo-data";

// Cache only public institution metadata, keyed by environment and institution ID.
const cachedLogo = unstable_cache(async (_environment: string, institutionId: string) => {
  try {
    const result = await plaid().institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
      options: { include_optional_metadata: true },
    }, { timeout: 3000 });
    return institutionLogoData(result.data.institution.logo);
  } catch {
    return null; // A missing logo or metadata outage must not break Connections.
  }
}, ["institution-logo-v1"], { revalidate: 86400 });

export async function institutionLogo(institutionId?: string | null): Promise<string | null> {
  if (!institutionId || !plaidConfigured()) return null;
  return cachedLogo(plaidEnv(), institutionId);
}
