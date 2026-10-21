import type { AccountRow } from "./model";
import { manualAccounts, type ManualEntry } from "./manual-assets";

/** Shared current-value total for Overview, Connections and daily snapshots. */
export function netWorthTotal(accounts: ReadonlyArray<Pick<AccountRow, "id" | "balance" | "include">>, manual: ManualEntry[] = [], overrides: Record<string, boolean> = {}) {
  return [...accounts, ...manualAccounts(manual)]
    .filter((a) => overrides[a.id] ?? a.include)
    .reduce((cents, a) => cents + Math.round(a.balance * 100), 0) / 100;
}

/** Serialize preference writes so out-of-order saves cannot overwrite newer choices. */
export async function saveInclusion(lock: { current: boolean }, write: () => Promise<unknown>, optimistic: () => void, rollback: () => void) {
  if (lock.current) return false;
  lock.current = true;
  try { optimistic(); await write(); return true; }
  catch (error) { rollback(); throw error; }
  finally { lock.current = false; }
}
