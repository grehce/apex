import { v1 } from "@/lib/v1";
export const dynamic = "force-dynamic";

/**
 * Transactions from the last ~120 days, newest first.
 * Query: since=YYYY-MM-DD, until=YYYY-MM-DD, category=FOOD_AND_DRINK, limit=1..500 (default 100).
 * amount follows Plaid: positive = money out, negative = money in.
 */
export function GET(req: Request) {
  return v1(req, (d, url) => {
    const q = url.searchParams;
    const day = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(q.get(k) ?? "") ? q.get(k)! : null);
    const since = day("since"), until = day("until");
    const cat = (q.get("category") ?? "").toUpperCase();
    const limit = Math.min(500, Math.max(1, Number(q.get("limit")) || 100));
    const rows = d.transactions.filter((t) => (!since || t.date >= since) && (!until || t.date <= until) && (!cat || t.category === cat));
    return {
      total: rows.length,
      transactions: rows.slice(0, limit).map((t) => ({ id: t.id, date: t.date, name: t.name, category: t.category, account: t.account, amount: t.amount })),
    };
  });
}
