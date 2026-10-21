# Apex

Personal finance and investment intelligence — net worth, spending and portfolio in one place, with an agent that proposes and you decide. Lives at **apexfolios.com**.

- **Next.js 16** (App Router, TypeScript)
- **Google sign-in** via Auth.js, limited to an email allowlist
- **Plaid** for read-only balances, transactions and investment holdings
- **Postgres** (Neon) via Drizzle; Plaid access tokens encrypted with AES-256-GCM
- Shows **sample data** until a real account is connected

## Security model

- Every page and API route requires a Google session (`proxy.ts` + a second check in each page/route).
- Only emails in `ALLOWED_EMAILS` can sign in; sessions expire after 12 hours.
- Bank logins happen inside Plaid Link — Apex never sees them. Apex only stores Plaid access tokens, encrypted with `ENCRYPTION_KEY`.
- Plaid access is read-only. The agent proposes plans; you place every trade.
- Mutating API routes check same-origin. Secrets live only in environment variables — never in the repo.

## 1. Accounts and keys (one-time)

| What | Where | Env vars |
|---|---|---|
| Google OAuth client (type: Web application) | Google Cloud Console → APIs & Services → Credentials | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| Auth secret | `openssl rand -base64 32` | `AUTH_SECRET` |
| Who can sign in | your Google email(s), comma-separated | `ALLOWED_EMAILS` |
| Plaid keys — start with **Sandbox** | dashboard.plaid.com → Developers → Keys | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox` |
| Postgres | Vercel → Storage → Neon (or neon.tech) | `DATABASE_URL` |
| Token encryption key | `openssl rand -base64 32` | `ENCRYPTION_KEY` |
| Home value estimates (optional; free tier 50/month) | rentcast.io → API dashboard | `RENTCAST_API_KEY` |
| Cron secret for monthly home revaluation | `openssl rand -base64 32` | `CRON_SECRET` |
| Mortgage address prefill via Plaid Liabilities (default on; free in Sandbox/Trial) | — | `PLAID_LIABILITIES=off` to disable |

Google OAuth **authorized redirect URIs**:

```
http://localhost:3000/api/auth/callback/google
https://apexfolios.com/api/auth/callback/google
```

## 2. Run locally

```bash
cp .env.example .env.local   # fill in values — never commit this file
npm install
npm run db:push              # creates the tables
npm run dev                  # http://localhost:3000
```

In Plaid Sandbox, pick any test bank and use Plaid's documented sandbox login (`user_good` / `pass_good`).

## 3. Deploy on Vercel

1. vercel.com → Add New → Project → import `grehce/apex`.
2. Add every variable from `.env.example` under Settings → Environment Variables.
3. Deploy. Tables are created automatically during the Vercel build (`scripts/migrate.mjs`).
4. Every push to `main` redeploys.

## 4. Point apexfolios.com at Vercel (Squarespace DNS)

1. Vercel → Project → Settings → Domains → add `apexfolios.com` (and `www.apexfolios.com`).
2. Vercel shows the exact DNS records to create.
3. Squarespace → Domains → apexfolios.com → DNS settings → add those records and remove conflicting Squarespace defaults for `@` and `www`.
4. Wait for Vercel to show the domain as valid; it issues HTTPS automatically.

## Moving Plaid to Production

Requires Plaid's production approval. Set `PLAID_ENV=production` and the production secret. Some banks use OAuth and need a registered redirect URI in the Plaid dashboard — that's a follow-up in the roadmap.

## Project map

```
auth.ts                 Google sign-in + allowlist
proxy.ts                route protection (Next 16 "proxy", formerly middleware)
lib/schema.ts           tables: plaid_items, accounts, holdings, transactions, net_worth_daily
lib/sync.ts             Plaid → database sync (accounts, holdings, /transactions/sync)
lib/data.ts             builds the dashboard model (real or sample)
lib/plans.ts            deterministic rebalancing plans for the agent
lib/property.ts         home address/estimate helpers; lib/valuation.ts = RentCast behind a provider interface
app/api/property/       home value estimate preview; app/api/cron/revalue-homes = monthly re-estimate (vercel.json)
app/(app)/              overview, agent, settings pages
app/api/plaid/          link-token, exchange, sync, item (disconnect / include toggle)
```

## Roadmap

- Editable allocation targets (defaults in `lib/model.ts`)
- Conversational agent (LLM) on top of the deterministic plans
- Daily background sync (Vercel Cron) and Plaid webhooks
- Plaid OAuth redirect support for production banks
- Bond-fund detection (bond ETFs currently count under "Stocks & funds")
