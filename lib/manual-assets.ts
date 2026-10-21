import type { AccountRow } from "./model";

export type ManualEntry = { id: string; name: string; kind: "asset" | "liability"; category: "property" | "mortgage" | "other"; value: number; valuationDate: string; archived: boolean; linkedMortgageId?: string | null };

export function validateManualEntry(input: unknown, today = new Date().toISOString().slice(0, 10)) {
  const x = input as Partial<ManualEntry> & { liabilityConfirmed?: boolean };
  if (!x || typeof x !== "object") throw new Error("Invalid entry");
  const name = typeof x.name === "string" ? x.name.trim() : "";
  if (!name || name.length > 100) throw new Error("Enter a name of up to 100 characters");
  if (x.kind !== "asset" && x.kind !== "liability") throw new Error("Choose asset or liability");
  if (!["property", "mortgage", "other"].includes(x.category ?? "") || (x.kind === "asset" && x.category === "mortgage") || (x.kind === "liability" && x.category === "property")) throw new Error("Choose a matching type");
  if (typeof x.value !== "number" || !Number.isFinite(x.value) || x.value < 0 || x.value > 1_000_000_000_000 || Math.abs(x.value * 100 - Math.round(x.value * 100)) > 0.001) throw new Error("Enter a non-negative USD value with at most two decimal places");
  if (typeof x.valuationDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x.valuationDate) || !Number.isFinite(Date.parse(x.valuationDate)) || new Date(x.valuationDate).toISOString().slice(0, 10) !== x.valuationDate || x.valuationDate < "1900-01-01" || x.valuationDate > today) throw new Error("Enter a valid valuation date, no later than today");
  if (x.kind === "liability" && x.liabilityConfirmed !== true) throw new Error("Confirm this debt is not already included in linked accounts");
  if (x.linkedMortgageId != null && (typeof x.linkedMortgageId !== "string" || x.linkedMortgageId.length > 200 || x.kind !== "asset" || x.category !== "property")) throw new Error("Only property assets can be associated with a linked mortgage");
  return { name, kind: x.kind, category: x.category as ManualEntry["category"], value: x.value, valuationDate: x.valuationDate, linkedMortgageId: x.linkedMortgageId || null };
}

export function manualAccounts(entries: ManualEntry[]): AccountRow[] {
  return entries.filter((e) => !e.archived).map((e) => ({ id: `manual:${e.id}`, itemId: "manual", institution: "Manual entry", name: e.name, mask: null, type: e.kind === "liability" ? "loan" : "property", subtype: e.category, balance: e.kind === "liability" ? -e.value : e.value, include: true }));
}

export function sameOrigin(req: Request): boolean {
  try { const origin = req.headers.get("origin"); return Boolean(origin && new URL(origin).origin === new URL(req.url).origin); } catch { return false; }
}
