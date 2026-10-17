// Public, machine-readable description of the read-only Apex API (OpenAPI 3.1).
const money = { type: "number", description: "US dollars" };
const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Apex read-only API",
    version: "1.0.0",
    description:
      "Read a member's own Apex data: net worth, accounts, holdings, transactions and proposed rebalancing plans. Read-only: nothing here can move money, place trades or change settings. Members create and revoke keys in Apex → Settings → Agent access.",
  },
  servers: [{ url: "https://www.apexfolios.com/api/v1" }],
  security: [{ apiKey: [] }],
  components: {
    securitySchemes: { apiKey: { type: "http", scheme: "bearer", description: "A member's read-only key, starting apex_ro_" } },
  },
  paths: {
    "/summary": { get: { operationId: "getSummary", summary: "Net worth, change over 1M/1Y/all, allocation vs targets, spending by category", responses: { "200": { description: "Summary" }, "401": { description: "Missing or invalid key" } } } },
    "/accounts": { get: { operationId: "listAccounts", summary: "Connected institutions and accounts with signed balances", responses: { "200": { description: "Accounts" } } } },
    "/holdings": { get: { operationId: "listHoldings", summary: "Investment positions with value, cost basis, unrealized gain and tax status", responses: { "200": { description: "Holdings" } } } },
    "/transactions": {
      get: {
        operationId: "listTransactions",
        summary: "Transactions from the last ~120 days, newest first. amount > 0 is money out.",
        parameters: [
          { name: "since", in: "query", schema: { type: "string", format: "date" } },
          { name: "until", in: "query", schema: { type: "string", format: "date" } },
          { name: "category", in: "query", schema: { type: "string" }, description: "Plaid primary category, e.g. FOOD_AND_DRINK" },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } },
        ],
        responses: { "200": { description: "Transactions" } },
      },
    },
    "/plans": { get: { operationId: "getPlans", summary: "Three proposed rebalancing plans (A: route new money, B: tax-aware, C: full). Proposals only.", responses: { "200": { description: "Plans" } } } },
  },
  "x-notes": { rate_limit: "120 requests per minute per key", amounts: money.description },
};

export function GET() {
  return Response.json(SPEC, { headers: { "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" } });
}
