// Shared shapes for the dashboard, built either from the database or from sample data.
import type { ManualEntry } from "./manual-assets";

export type RangeKey = "1M" | "1Y" | "All";
export type Series = { v: number[]; l: string[]; est?: number }; // est: fraction of the x-axis (from the left) that is estimated, not recorded

export type AccountRow = {
  id: string;
  itemId: string;
  institution: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  balance: number; // signed: debts negative
  include: boolean;
};

export type ItemRow = {
  transactionsState?: "unknown" | "pending" | "ready" | "action_required" | "error";
  transactionsError?: string | null;
  itemId: string;
  institutionId?: string | null;
  logo?: string | null;
  institution: string;
  status: "ok" | "login_required" | "error";
  lastSyncedAt: string | null;
  accounts: AccountRow[];
};

export type HoldingRow = {
  accountId: string;
  ticker: string | null;
  name: string | null;
  assetClass: AssetClass;
  value: number;
  costBasis: number | null;
  taxAdvantaged: boolean;
};

export type AssetClass = "Stocks & funds" | "Bonds" | "Cash" | "Crypto" | "Other";
export const ASSET_CLASSES: AssetClass[] = ["Stocks & funds", "Bonds", "Cash", "Crypto", "Other"];
export const CLASS_COLORS: Record<AssetClass, string> = {
  "Stocks & funds": "#3D5A4C",
  Bonds: "#A47E4C",
  Cash: "#8E9AA6",
  Crypto: "#5C6B5E",
  Other: "#C8C2B6",
};

export type AllocationRow = { name: AssetClass; value: number; pct: number; target: number; color: string };

export type TxRow = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  category: string;
  account: string;
  pending?: boolean;
  amount: number; // Plaid sign: positive = money out
  accountId?: string;
  raw?: string; // raw bank description, used for categorization rules
};

export type HeatDay = {
  day: string; // YYYY-MM-DD
  amount: number;
  items: { name: string; category: string; amount: number }[]; // that day's spending, largest first
};

export type Dashboard = {
  manualEntries: ManualEntry[];
  sample: boolean;
  setup: { plaid: boolean; db: boolean; encryption: boolean };
  asOf: string;
  netWorth: number;
  series: Record<RangeKey, Series>;
  estimatedDays: number; // days of reconstructed (not recorded) history behind the chart
  historyDays: number;
  items: ItemRow[];
  invested: number;
  allocation: AllocationRow[];
  holdings: HoldingRow[];
  spending: import("./spending").SpendingSummary;
  spendByCategory: { name: string; thisMonth: number; lastMonth: number }[];
  ledger: TxRow[];
  transactions: TxRow[]; // everything synced in the window (~120 days), newest first
  heat: HeatDay[]; // last 91 days, oldest first
  answers: { q: string; value: string; sub: string }[];
};

/** Target allocation. Defaults for now — to be editable in Settings. */
export const DEFAULT_TARGETS: Record<AssetClass, number> = {
  "Stocks & funds": 75,
  Bonds: 15,
  Cash: 7,
  Crypto: 0,
  Other: 3,
};

export function classify(securityType: string | null | undefined): AssetClass {
  switch ((securityType ?? "").toLowerCase()) {
    case "equity":
    case "etf":
    case "mutual fund":
      return "Stocks & funds";
    case "fixed income":
      return "Bonds";
    case "cash":
      return "Cash";
    case "cryptocurrency":
      return "Crypto";
    default:
      return "Other";
  }
}

const TAX_ADVANTAGED = [
  "401a", "401k", "403b", "457b", "529", "hsa", "ira", "keogh", "lif", "lira", "lrif", "lrsp",
  "pension", "prif", "profit sharing plan", "qshr", "rdsp", "resp", "retirement", "rlif", "roth",
  "roth 401k", "rrif", "rrsp", "sarsep", "sep ira", "simple ira", "sipp", "tfsa", "thrift savings plan",
];
export function isTaxAdvantaged(subtype: string | null | undefined): boolean {
  return TAX_ADVANTAGED.includes((subtype ?? "").toLowerCase());
}

export function money(n: number, digits = 2): string {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (n < 0 ? "−$" : "$") + s;
}

export function prettyCategory(c: string | null | undefined): string {
  if (!c) return "uncategorized";
  return c.toLowerCase().replace(/_/g, " ");
}
