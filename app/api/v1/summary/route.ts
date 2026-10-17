import { v1 } from "@/lib/v1";
export const dynamic = "force-dynamic";

/** Net worth, its recent change, allocation vs targets, and this month's spending by category. */
export function GET(req: Request) {
  return v1(req, (d) => {
    const change = (k: "1M" | "1Y" | "All") => {
      const v = d.series[k].v;
      return v.length > 1 ? Math.round((v[v.length - 1] - v[0]) * 100) / 100 : 0;
    };
    return {
      net_worth: Math.round(d.netWorth * 100) / 100,
      change: { "1M": change("1M"), "1Y": change("1Y"), all: change("All") },
      history_days: d.historyDays,
      invested: Math.round(d.invested * 100) / 100,
      allocation: d.allocation.map((a) => ({ class: a.name, value: Math.round(a.value * 100) / 100, percent: Math.round(a.pct * 10) / 10, target_percent: a.target })),
      spending_by_category: d.spendByCategory.map((c) => ({ category: c.name, this_month: Math.round(c.thisMonth * 100) / 100, last_month: Math.round(c.lastMonth * 100) / 100 })),
    };
  });
}
