import { prettyCategory, type TxRow } from "./model";
// CARD_CREDITS: card perks (e.g. a monthly streaming credit) are reported separately, not netted into a category.
const NOT_SPEND = new Set(["TRANSFER_IN", "TRANSFER_OUT", "LOAN_PAYMENTS", "INCOME", "CARD_CREDITS"]);
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
  // Pace bars: the six biggest categories that net to spending this month; everything else (including
  // categories where refunds outweigh purchases) rolls into one bar so the bars still add up to the total.
  const positive = categories.filter(c => c.thisMonth > 0);
  const paceCategories = positive.slice(0, 6);
  const rest = categories.filter(c => !paceCategories.includes(c));
  if (rest.length) paceCategories.push({ name: "Everything else", thisMonth: rest.reduce((s,c)=>s+Math.round(c.thisMonth*100),0)/100, lastMonth: rest.reduce((s,c)=>s+Math.round(c.lastMonth*100),0)/100 });
  const credits = rows.filter(t => !t.pending && t.category === "CARD_CREDITS" && t.date <= today && t.date.startsWith(thisMonth));
  return { posted, current, categories, paceCategories, total: sum(current), lastTotal: sum(previous), pendingTotal: sum(pending), pendingCount: pending.length, cardCredits: -sum(credits), cardCreditCount: credits.length };
}
export type SpendingSummary = ReturnType<typeof summarizeSpending>;
