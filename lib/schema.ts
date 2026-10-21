import { pgTable, text, timestamp, doublePrecision, boolean, date, primaryKey, index, integer } from "drizzle-orm/pg-core";

/** User-entered USD estimates, separate from all Plaid-owned records. Archive is reversible. */
export const manualEntries = pgTable("manual_entries", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  category: text("category").notNull(),
  value: doublePrecision("value").notNull(),
  valuationDate: date("valuation_date").notNull(),
  linkedMortgageId: text("linked_mortgage_id"),
  // Real estate: the address is encrypted (AES-256-GCM, same key as Plaid tokens) and only decrypted on Settings.
  addressEnc: text("address_enc"),
  valuationSource: text("valuation_source").notNull().default("manual"), // manual | estimate
  estimateLow: doublePrecision("estimate_low"),
  estimateHigh: doublePrecision("estimate_high"),
  estimateComps: integer("estimate_comps"),
  valuationProvider: text("valuation_provider"),
  lastValuedAt: timestamp("last_valued_at", { withTimezone: true }),
  archived: boolean("archived").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("manual_entries_user_idx").on(t.userEmail)]);

/** Each automatic or user-entered home value, so the net worth chart moves with real revaluations. */
export const propertyValuations = pgTable("property_valuations", {
  entryId: text("entry_id").notNull(),
  userEmail: text("user_email").notNull(),
  day: date("day").notNull(),
  value: doublePrecision("value").notNull(),
  low: doublePrecision("low"),
  high: doublePrecision("high"),
  source: text("source").notNull(), // manual | estimate
}, (t) => [primaryKey({ columns: [t.entryId, t.day] }), index("property_valuations_user_idx").on(t.userEmail)]);

/** Plaid Liabilities detail for mortgage accounts. Only fetched for Items that hold a mortgage. */
export const mortgageDetails = pgTable("mortgage_details", {
  accountId: text("account_id").primaryKey(),
  itemId: text("item_id").notNull(),
  userEmail: text("user_email").notNull(),
  propertyAddressEnc: text("property_address_enc"),
  originationPrincipal: doublePrecision("origination_principal"),
  interestRatePct: doublePrecision("interest_rate_pct"),
  interestRateType: text("interest_rate_type"),
  maturityDate: date("maturity_date"),
  nextPayment: doublePrecision("next_payment"),
  nextPaymentDue: date("next_payment_due"),
  escrowBalance: doublePrecision("escrow_balance"),
  loanType: text("loan_type"), // e.g. "Conventional"
  loanTerm: text("loan_term"), // e.g. "30 year"
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("mortgage_details_user_idx").on(t.userEmail)]);

/** One row per Plaid Item (one login at one institution). The access token is encrypted. */
export const plaidItems = pgTable("plaid_items", {
  itemId: text("item_id").primaryKey(),
  userEmail: text("user_email").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name").notNull(),
  txCursor: text("tx_cursor"),
  transactionsState: text("transactions_state").notNull().default("unknown"), // pending | ready | action_required | error
  transactionsRetryAt: timestamp("transactions_retry_at", { withTimezone: true }).notNull().defaultNow(),
  transactionsLeaseUntil: timestamp("transactions_lease_until", { withTimezone: true }),
  transactionsLeaseToken: text("transactions_lease_token"),
  transactionsError: text("transactions_error"),
  status: text("status").notNull().default("ok"), // ok | login_required | error
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("plaid_items_user_idx").on(t.userEmail)]);

export const accounts = pgTable("accounts", {
  accountId: text("account_id").primaryKey(),
  itemId: text("item_id").notNull(),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull(),
  officialName: text("official_name"),
  mask: text("mask"),
  type: text("type").notNull(), // depository | credit | investment | loan | other
  subtype: text("subtype"),
  balanceCurrent: doublePrecision("balance_current"),
  balanceAvailable: doublePrecision("balance_available"),
  currency: text("currency"),
  includeInNetWorth: boolean("include_in_net_worth").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("accounts_user_idx").on(t.userEmail)]);

export const holdings = pgTable("holdings", {
  accountId: text("account_id").notNull(),
  securityId: text("security_id").notNull(),
  userEmail: text("user_email").notNull(),
  ticker: text("ticker"),
  name: text("name"),
  securityType: text("security_type"),
  quantity: doublePrecision("quantity"),
  value: doublePrecision("value"),
  costBasis: doublePrecision("cost_basis"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.accountId, t.securityId] }), index("holdings_user_idx").on(t.userEmail)]);

export const transactions = pgTable("transactions", {
  transactionId: text("transaction_id").primaryKey(),
  accountId: text("account_id").notNull(),
  userEmail: text("user_email").notNull(),
  date: date("date").notNull(),
  name: text("name").notNull(),
  merchant: text("merchant"),
  amount: doublePrecision("amount").notNull(), // Plaid sign: positive = money out
  category: text("category"), // personal_finance_category.primary
  pending: boolean("pending").notNull().default(false),
}, (t) => [index("tx_user_date_idx").on(t.userEmail, t.date)]);

/** Waitlist for people who aren't on the access list yet. */
export const waitlist = pgTable("waitlist", {
  email: text("email").primaryKey(), // lowercased
  name: text("name").notNull(),
  note: text("note"),
  refCode: text("ref_code").notNull().unique(),
  referredBy: text("referred_by"), // another entry's ref_code
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("waitlist_ref_idx").on(t.referredBy)]);

/** Daily net worth, written on each sync, so the chart builds history over time. */
export const netWorthDaily = pgTable("net_worth_daily", {
  userEmail: text("user_email").notNull(),
  day: date("day").notNull(),
  value: doublePrecision("value").notNull(),
}, (t) => [primaryKey({ columns: [t.userEmail, t.day] })]);

/** Read-only API keys members create for outside agents (Muse, Claude, ChatGPT…). Only a hash is stored. */
export const apiTokens = pgTable("api_tokens", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(), // sha256 of the full token
  prefix: text("prefix").notNull(), // first characters, shown so you can tell keys apart
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [index("api_tokens_user_idx").on(t.userEmail)]);
