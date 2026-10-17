import { v1 } from "@/lib/v1";
export const dynamic = "force-dynamic";

/** Investment positions with value, cost basis (when known) and whether the account is tax-advantaged. */
export function GET(req: Request) {
  return v1(req, (d) => ({
    holdings: d.holdings.map((h) => ({
      account_id: h.accountId,
      ticker: h.ticker,
      name: h.name,
      class: h.assetClass,
      value: h.value,
      cost_basis: h.costBasis,
      unrealized_gain: h.costBasis === null ? null : Math.round((h.value - h.costBasis) * 100) / 100,
      tax_advantaged: h.taxAdvantaged,
    })),
  }));
}
