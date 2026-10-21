// Estimated net worth history, rebuilt backwards from today's balances.
// Pure: give it accounts, transactions and manual values; it returns one point per day.
//
// For an account with transactions, the balance at the end of day D is today's balance with every
// posted transaction after D undone (Plaid sign: positive = money out, so undoing it adds it back —
// this holds for cash, cards and loans alike with debts stored as negatives).
// Accounts without transactions (most mortgages, brokerages) and manual assets are held at today's
// value, except a mortgage with a known rate and payment, which is rolled back on its schedule.
// Recorded daily snapshots always win over the estimate for their day.

export type HistAccount = { id: string; balance: number; include: boolean; type: string; subtype: string | null };
export type HistTx = { accountId?: string; date: string; amount: number; pending?: boolean };
export type MortgageSchedule = { accountId: string; ratePct: number; monthlyPayment: number };
export type HistPoint = { day: string; value: number; est: boolean };

const DAY = 86400000;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;

export const MAX_HISTORY_DAYS = 730;

export function estimateHistory(opts: {
  accounts: HistAccount[];
  txs: HistTx[];
  manualTotal: number; // signed sum of active manual entries
  snapshots: { day: string; value: number }[];
  today: Date;
  mortgages?: MortgageSchedule[];
}): HistPoint[] {
  const { accounts, txs, manualTotal, snapshots, today, mortgages = [] } = opts;
  const todayDay = ymd(today.getTime());
  const included = accounts.filter((a) => a.include);
  const ids = new Set(included.map((a) => a.id));
  const posted = txs.filter((t) => !t.pending && t.accountId && ids.has(t.accountId) && t.date <= todayDay);
  const earliestTx = posted.reduce<string | null>((m, t) => (m === null || t.date < m ? t.date : m), null);
  const earliestSnap = snapshots.reduce<string | null>((m, s) => (m === null || s.day < m ? s.day : m), null);
  const floor = ymd(today.getTime() - MAX_HISTORY_DAYS * DAY);
  let start = [earliestTx, earliestSnap, todayDay].filter(Boolean).sort()[0]!;
  if (start < floor) start = floor;
  // The balance on the day before the first transaction is the earliest we can know.
  if (earliestTx && earliestTx > floor && start === earliestTx) start = ymd(Date.parse(earliestTx + "T00:00:00Z") - DAY);

  // Sum of transaction amounts by day (all included accounts), so we can walk backwards once.
  const byDay = new Map<string, number>();
  for (const t of posted) byDay.set(t.date, (byDay.get(t.date) ?? 0) + Math.round(t.amount * 100));

  const schedules = new Map(mortgages.filter((m) => m.ratePct > 0 && m.monthlyPayment > 0).map((m) => [m.accountId, m]));
  const txAccounts = new Set(posted.map((t) => t.accountId!));
  const now = included.reduce((s, a) => s + Math.round(a.balance * 100), 0) + Math.round(manualTotal * 100);

  const snapByDay = new Map(snapshots.map((s) => [s.day, s.value]));
  const out: HistPoint[] = [];
  let undo = 0; // cents of transactions after the current day, summed
  const startT = Date.parse(start + "T00:00:00Z");
  for (let t = Date.parse(todayDay + "T00:00:00Z"); t >= startT; t -= DAY) {
    const day = ymd(t);
    if (day !== todayDay) undo += byDay.get(ymd(t + DAY)) ?? 0;
    // Mortgages on a schedule (and without transactions of their own): roll principal back.
    let schedAdj = 0;
    const monthsBack = (Date.parse(todayDay + "T00:00:00Z") - t) / (DAY * 30.4375);
    for (const a of included) {
      const m = schedules.get(a.id);
      if (!m || txAccounts.has(a.id)) continue;
      const r = m.ratePct / 100 / 12;
      let owed = Math.abs(a.balance);
      for (let k = 0; k < Math.floor(monthsBack); k++) owed = (owed + m.monthlyPayment) / (1 + r);
      schedAdj += Math.round((Math.abs(a.balance) - owed) * 100); // more owed in the past → lower net worth
    }
    const recorded = snapByDay.get(day);
    out.push(recorded !== undefined ? { day, value: r2(recorded), est: false } : { day, value: (now + undo + schedAdj) / 100, est: day !== todayDay });
  }
  return out.reverse();
}
