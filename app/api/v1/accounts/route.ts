import { v1 } from "@/lib/v1";
export const dynamic = "force-dynamic";

/** Connected institutions and accounts. Balances are signed: debts are negative. */
export function GET(req: Request) {
  return v1(req, (d) => ({
    institutions: d.items.map((i) => ({
      name: i.institution,
      status: i.status,
      last_synced_at: i.lastSyncedAt,
      accounts: i.accounts.map((a) => ({ id: a.id, name: a.name, mask: a.mask, type: a.type, subtype: a.subtype, balance: a.balance, in_net_worth: a.include })),
    })),
  }));
}
