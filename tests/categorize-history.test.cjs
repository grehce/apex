// Transaction clean-up and estimated net worth history. Fixtures only — no real names or accounts.
// Run: node --import tsx tests/categorize-history.test.cjs
const assert = require('node:assert/strict');
const { categorizeTransactions, cleanName } = require('../lib/categorize.ts');
const { estimateHistory } = require('../lib/history.ts');
const { summarizeSpending } = require('../lib/spending.ts');

const tx = (id, accountId, date, raw, category, amount, pending = false) => ({ id, accountId, date, name: raw, raw, category, amount, pending, account: '' });
const kinds = { bank: 'depository', wallet: 'depository', card: 'credit' };
const rows = [
  tx('in', 'wallet', '2026-10-21', 'Wallet Transfer', 'TRANSFER_IN', -10000),
  tx('out', 'bank', '2026-10-19', 'WALLETCO DES:Deposit ID: INDN:Test Person CO ID:XXXXX17434 WEB', 'OTHER', 10000),
  tx('ui', 'bank', '2026-10-19', 'California EDD DES:UI Deposit ID: INDN:TEST PERSON CO ID:XXXXX3541 PPD', 'TRANSFER_IN', -900),
  tx('apple', 'bank', '2026-10-01', 'APPLECARD GSBANK DES:PAYMENT ID:467447 INDN:Test Person CO ID:XXXXX99999 WEB', 'OTHER', 138.71),
  tx('thai', 'bank', '2026-10-19', 'MOBILE PURCHASE 1017 IMM THAI STREET FOOD BERKELEY CA XXXXX3862XXXXXXXXXX3248', 'OTHER', 37.74),
  tx('refund', 'bank', '2026-10-19', 'PURCHASE REFUND 1017 IMM THAI STREET FOOD BERKELEY CA XXXXX3862XXXXXXXXXX3318', 'OTHER', -9.93),
  tx('taco', 'bank', '2026-10-13', 'MOBILE PURCHASE 1013 TST*THE LITTLE CHIHUAHU San FranciscoCA XXXXX1662XXXXXXXXXX1273', 'OTHER', 22.9),
  tx('pay', 'bank', '2026-10-10', 'ONLINE PMT 7781', 'OTHER', 506.39),
  tx('payrcv', 'card', '2026-10-11', 'PAYMENT RECEIVED - THANK YOU', 'OTHER', -506.39),
  tx('plaidok', 'card', '2026-10-12', 'Blue Bottle', 'FOOD_AND_DRINK', 6.5),
  tx('dupe', 'bank', '2026-10-05', 'SOMETHING ODD', 'OTHER', 44),
];
const out = Object.fromEntries(categorizeTransactions(rows, kinds).map((t) => [t.id, t]));
assert.equal(out.out.category, 'TRANSFER_OUT'); assert.equal(out.in.category, 'TRANSFER_IN'); // own-account pair
assert.equal(out.ui.category, 'INCOME'); assert.equal(out.ui.name, 'California EDD');
assert.equal(out.apple.category, 'LOAN_PAYMENTS'); assert.equal(out.apple.name, 'Apple Card payment');
assert.equal(out.thai.category, 'FOOD_AND_DRINK'); assert.equal(out.thai.name, 'Imm Thai Street Food');
assert.equal(out.refund.category, 'FOOD_AND_DRINK'); assert.equal(out.refund.name, 'Refund · Imm Thai Street Food');
assert.equal(out.taco.name, 'The Little Chihuahu');
assert.equal(out.pay.category, 'LOAN_PAYMENTS'); assert.equal(out.payrcv.category, 'LOAN_PAYMENTS'); // bank → card pair is a card payment
assert.equal(out.plaidok.category, 'FOOD_AND_DRINK'); // Plaid's own categories are kept
assert.equal(out.dupe.category, 'OTHER'); // unknown stays unknown
assert.doesNotMatch(Object.values(out).map((t) => t.name).join(' '), /INDN|Test Person|XXXX/i); // names never carry the account holder or card digits
assert.equal(cleanName('TOTALLY PLAIN NAME'), 'Totally Plain Name');
assert.equal(rows[1].category, 'OTHER'); // input not mutated

// Spending only counts real purchases now.
const s = summarizeSpending(categorizeTransactions(rows, kinds), new Date('2026-10-21T12:00:00Z'));
assert.equal(s.total, 101.21);

// History: undo posted transactions backwards; manual assets held; snapshots win; pending ignored.
const accounts = [
  { id: 'bank', balance: 1000, include: true, type: 'depository', subtype: 'checking' },
  { id: 'card', balance: -200, include: true, type: 'credit', subtype: 'credit card' },
  { id: 'hidden', balance: 5000, include: false, type: 'depository', subtype: 'savings' },
  { id: 'loan', balance: -100000, include: true, type: 'loan', subtype: 'mortgage' },
];
const txs = [
  { accountId: 'bank', date: '2026-10-20', amount: 300 }, // spent 300 yesterday → balance was 1300 before
  { accountId: 'card', date: '2026-10-19', amount: 50 }, // card charge → owed 150 before
  { accountId: 'bank', date: '2026-10-21', amount: 999, pending: true },
  { accountId: 'hidden', date: '2026-10-19', amount: 4000 },
];
const today = new Date('2026-10-21T18:00:00Z');
const h = estimateHistory({ accounts, txs, manualTotal: 500000, snapshots: [{ day: '2026-10-21', value: 400800 }], today });
const at = (day) => h.find((p) => p.day === day);
assert.equal(h[0].day, '2026-10-18'); // day before the first transaction
assert.deepEqual(at('2026-10-21'), { day: '2026-10-21', value: 400800, est: false });
assert.equal(at('2026-10-20').value, 1000 - 200 - 100000 + 500000); // today's balances; the 10-20 spend happened during 10-20
assert.equal(at('2026-10-19').value, 1300 - 200 - 100000 + 500000);
assert.equal(at('2026-10-18').value, 1300 - 150 - 100000 + 500000);
assert.ok(at('2026-10-19').est);
// No transactions and no snapshots → just today.
assert.equal(estimateHistory({ accounts, txs: [], manualTotal: 0, snapshots: [], today }).length, 1);
// Mortgage on a schedule: further back, more was owed.
const sched = estimateHistory({ accounts: [accounts[0], accounts[3]], txs: [{ accountId: 'bank', date: '2025-10-21', amount: 1 }], manualTotal: 0, snapshots: [], today, mortgages: [{ accountId: 'loan', ratePct: 6, monthlyPayment: 1000 }] });
const year = sched.find((p) => p.day === '2025-11-01'), last = sched.at(-1);
assert.equal(last.value, 1000 - 100000);
assert.ok(year.value < 1000 - 100000 - 4000 && year.value > 1000 - 100000 - 12000, `a year back the loan was a few thousand higher, got ${year.value}`);
console.log('PASS categorize + history: own-account transfers, card payments, income, merchants, clean names, spending totals, backward replay, snapshots win, mortgage schedule');
