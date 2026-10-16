import { pgTable, text, timestamp, doublePrecision, boolean, date, primaryKey, index } from "drizzle-orm/pg-core";

/** One row per Plaid Item (one login at one institution). The access token is encrypted. */
export const plaidItems = pgTable("plaid_items", {
  itemId: text("item_id").primaryKey(),
  userEmail: text("user_email").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name").notNull(),
  txCursor: text("tx_cursor"),
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

/** Daily net worth, written on each sync, so the chart builds history over time. */
export const netWorthDaily = pgTable("net_worth_daily", {
  userEmail: text("user_email").notNull(),
  day: date("day").notNull(),
  value: doublePrecision("value").notNull(),
}, (t) => [primaryKey({ columns: [t.userEmail, t.day] })]);
