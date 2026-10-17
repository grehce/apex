// /llms.txt — a plain-text summary for AI assistants (see llmstxt.org).
const BODY = `# Apex

> Apex (apexfolios.com) is a personal finance agent fluent in tax, investing and trading. It connects to your bank, brokerage and retirement accounts read-only through Plaid, shows your whole net worth in one place, and proposes tax-aware plans. Apex is paid for by its members and recommends only what's best for your money, never products it's paid to push. Membership is by invitation.

## What Apex does
- Net worth across every connected account, updated daily, with 1-month, 1-year and all-time history
- Portfolio allocation versus your targets, and how far it has drifted
- Spending pace by category, compared with last month
- An agent that proposes rebalancing plans that keep taxes low (for example, trading inside a 401(k) or IRA first)
- No exotic investments and no leverage

## What Apex does not do
- It cannot move money or place trades. Access is read-only; members place their own trades.
- Bank logins go to Plaid and the bank, never to Apex. Access tokens are encrypted at rest.

## API for agents
Members can give an AI agent read-only access to their own data with an API key from Apex → Settings → Agent access.
- OpenAPI description: https://www.apexfolios.com/api/v1/openapi.json
- Auth: \`Authorization: Bearer apex_ro_…\`
- Endpoints: /api/v1/summary, /api/v1/accounts, /api/v1/holdings, /api/v1/transactions, /api/v1/plans
- Read-only. Keys can be revoked at any time. Nothing in the API can move money or place trades.

## Access
- Request an invitation: https://www.apexfolios.com/waitlist
- Sign in (approved Google accounts): https://www.apexfolios.com/signin
- The site can be browsed with sample data without an account: https://www.apexfolios.com/

## Pages
- [Overview demo](https://www.apexfolios.com/): sample dashboard
- [Agent](https://www.apexfolios.com/agent): how plans are proposed
- [Request an invitation](https://www.apexfolios.com/waitlist)
`;

export function GET() {
  return new Response(BODY, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
