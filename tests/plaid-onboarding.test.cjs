// Plaid production-readiness: duplicate Item detection and structured logging. Fakes only — no network.
// Run: node --import tsx --conditions=react-server tests/plaid-onboarding.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { plaidLogLine, isDuplicateConnection, linkLogFields, endpointOf } = require('../lib/plaid-log.ts');
const { NextResponse } = require('next/server');

// Logging never carries tokens; empty fields drop out.
const line = plaidLogLine({ event: 'api_error', endpoint: '/item/get', error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'bad token access-production-1234abcd-ef00-1111-2222-333344445555 used', request_id: 'req123', item_id: null });
assert.match(line, /^\[plaid\] /);
assert.doesNotMatch(line, /access-production-1234/);
assert.match(line, /\[redacted\]/);
assert.doesNotMatch(line, /item_id/);
assert.equal(endpointOf('https://production.plaid.com/transactions/sync'), '/transactions/sync');
const lf = linkLogFields('link_error', { link_session_id: 's1', request_id: 'r1', institution: { institution_id: 'ins_3' }, error: { error_code: 'INSTITUTION_DOWN', error_type: 'INSTITUTION_ERROR' }, accounts: [{ mask: '1234' }] });
assert.deepEqual([lf.link_session_id, lf.request_id, lf.institution_id, lf.error_code], ['s1', 'r1', 'ins_3', 'INSTITUTION_DOWN']);
assert.doesNotMatch(JSON.stringify(lf), /1234/); // account masks are not logged

// Duplicate rules: same institution + an account with the same mask and subtype.
const existing = [{ institutionId: 'ins_3', accounts: [{ mask: '4032', subtype: 'checking' }] }];
assert.equal(isDuplicateConnection('ins_3', [{ mask: '4032', subtype: 'checking' }], existing), true);
assert.equal(isDuplicateConnection('ins_3', [{ mask: '9999', subtype: 'checking' }], existing), false); // another login at the same bank
assert.equal(isDuplicateConnection('ins_9', [{ mask: '4032', subtype: 'checking' }], existing), false);
assert.equal(isDuplicateConnection('ins_3', [], existing), false);
assert.equal(isDuplicateConnection(null, [{ mask: '4032', subtype: 'checking' }], existing), false);

// Exchange route: a duplicate is refused BEFORE Plaid's exchange is called; a new login proceeds.
let calls = [];
const fakePlaid = {
  itemPublicTokenExchange: async () => { calls.push('exchange'); return { data: { access_token: 'access-sandbox-x', item_id: 'item-new' } }; },
  itemGet: async () => { calls.push('itemGet'); return { data: { item: { institution_id: 'ins_9' } } }; },
  accountsGet: async () => { calls.push('accountsGet'); return { data: { accounts: [] } }; },
  itemRemove: async () => { calls.push('itemRemove'); return { data: {} }; },
};
const schema = require('../lib/schema.ts');
let selectN = 0;
const fakeDb = {
  select: () => ({ from: (table) => ({ where: async () => {
    if (table === schema.plaidItems) { selectN++; return selectN === 1 ? [{ itemId: 'item-old', institutionId: 'ins_3', name: 'Bank of America' }] : [{ itemId: 'item-new', userEmail: 'o@example.invalid' }]; }
    if (table === schema.accounts) return [{ itemId: 'item-old', mask: '4032', subtype: 'checking' }];
    return [];
  } }) }),
  insert: () => ({ values: () => ({ onConflictDoNothing: async () => { calls.push('insert'); } }) }),
};
const m = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/plaid/exchange/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: m.exports, module: m, Request, console, require: (p) => ({
  'next/server': { NextResponse }, '@/lib/api': { guard: async () => ({ email: 'o@example.invalid' }) }, '@/lib/plaid': { plaid: () => fakePlaid },
  '@/lib/db': { db: () => fakeDb }, '@/lib/crypto': { encrypt: (t) => 'enc' }, '@/lib/schema': schema, '@/lib/plaid-log': { ...require('../lib/plaid-log.ts'), logPlaid: () => {} },
  '@/lib/sync': { institutionName: async () => 'New Bank', recordNetWorth: async () => {}, syncItem: async () => ({ ok: true }) },
})[p] ?? require(p) });
const req = (body) => new Request('https://x.test/api/plaid/exchange', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
(async () => {
  const dup = await m.exports.POST(req({ publicToken: 'public-sandbox-1', institutionId: 'ins_3', accounts: [{ mask: '4032', subtype: 'checking' }] }));
  assert.equal(dup.status, 409); assert.match((await dup.json()).error, /Bank of America is already connected/);
  assert.deepEqual(calls, []); // never exchanged
  selectN = 0; calls = [];
  const fresh = await m.exports.POST(req({ publicToken: 'public-sandbox-2', institutionId: 'ins_9', accounts: [{ mask: '1111', subtype: 'checking' }] }));
  assert.equal(fresh.status, 200); assert.deepEqual(calls.slice(0, 3), ['exchange', 'itemGet', 'insert']);
  console.log('PASS plaid onboarding: log redaction and fields, duplicate rules, duplicate blocked before exchange, new login proceeds');
})().catch((e) => { console.error(e); process.exitCode = 1; });
