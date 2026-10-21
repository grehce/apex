import { prettyCategory, type TxRow } from "./model";
const NOT_SPEND = new Set(["TRANSFER_IN", "TRANSFER_OUT", "LOAN_PAYMENTS", "INCOME"]);
const sum = (rows: TxRow[]) => rows.reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100;
export function summarizeSpending(rows: TxRow[], now: Date) {
  const today = now.toISOString().slice(0, 10), thisMonth = today.slice(0, 7);
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const eligible = rows.filter(t => t.date <= today && !NOT_SPEND.has(t.category));
  const posted = eligible.filter(t => !t.pending);
  const current = posted.filter(t => t.date.startsWith(thisMonth));
  const previous = posted.filter(t => t.date.startsWith(lastMonth));
  const pending = eligible.filter(t => t.pending && t.date.startsWith(thisMonth));
  const map = new Map<string, { name: string; thisMonth: number; lastMonth: number }>();
  for (const t of [...current, ...previous]) {
    const name = prettyCategory(t.category), c = map.get(name) ?? { name, thisMonth: 0, lastMonth: 0 };
    if (t.date.startsWith(thisMonth)) c.thisMonth += Math.round(t.amount * 100); else c.lastMonth += Math.round(t.amount * 100);
    map.set(name, c);
  }
  const categories = [...map.values()].map(c => ({ ...c, thisMonth: c.thisMonth / 100, lastMonth: c.lastMonth / 100 })).sort((a,b) => b.thisMonth - a.thisMonth || a.name.localeCompare(b.name));
  const paceCategories = categories.slice(0, 6);
  if (categories.length > 6) paceCategories.push({ name: "Other", thisMonth: categories.slice(6).reduce((s,c)=>s+Math.round(c.thisMonth*100),0)/100, lastMonth: categories.slice(6).reduce((s,c)=>s+Math.round(c.lastMonth*100),0)/100 });
  return { posted, current, categories, paceCategories, total: sum(current), lastTotal: sum(previous), pendingTotal: sum(pending), pendingCount: pending.length };
}
export type SpendingSummary = ReturnType<typeof summarizeSpending>;
