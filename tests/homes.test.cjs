// Homes: address validation, home entry rules, RentCast parsing (fake fetch, no network), revaluation timing,
// cron auth, and the agent's view (value and equity, never the address).
// Run: node --import tsx --conditions=react-server tests/homes.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { validateAddress, fromPlaidAddress, equity, needsRevalue, formatAddress } = require('../lib/property.ts');
const { validateManualEntry } = require('../lib/manual-assets.ts');
const { rentcast, ValuationError } = require('../lib/valuation.ts');
const { runTool } = require('../lib/agent.ts');
const { NextResponse } = require('next/server');

const day = '2026-10-21';
const addr = { street: ' 1  Fixture Way ', city: 'Testville', region: 'ca', postalCode: '94000' };
assert.deepEqual(validateAddress(addr), { street: '1 Fixture Way', city: 'Testville', region: 'CA', postalCode: '94000' });
for (const bad of [{ ...addr, street: '' }, { ...addr, region: 'Cal' }, { ...addr, postalCode: '940' }, null]) assert.throws(() => validateAddress(bad));
assert.equal(fromPlaidAddress({ street: '1 Fixture Way', city: 'Testville', region: 'CA', postal_code: '94000' }).street, '1 Fixture Way');
assert.equal(fromPlaidAddress({ street: null, city: 'Testville', region: 'CA', postal_code: '94000' }), null);
assert.deepEqual(equity(1000000, 400000), { equity: 600000, ltv: 0.4 });
assert.equal(needsRevalue(null), true);
assert.equal(needsRevalue(new Date('2026-10-01'), new Date('2026-10-21')), false);
assert.equal(needsRevalue(new Date('2026-09-20'), new Date('2026-10-21')), true);

// Home entries
const home = { name: '1 Fixture Way', kind: 'asset', category: 'property', value: 1000000, valuationDate: day, address: addr };
const est = { ...home, valuationSource: 'estimate', estimateLow: 950000, estimateHigh: 1050000, estimateComps: 8, valuationProvider: 'RentCast' };
assert.equal(validateManualEntry(est, day).valuationSource, 'estimate');
assert.equal(validateManualEntry(est, day).address.region, 'CA');
assert.equal(validateManualEntry({ ...home, address: null }, day).address, null); // manual value without an address is fine
assert.throws(() => validateManualEntry({ ...est, address: null }, day)); // estimate needs an address
assert.throws(() => validateManualEntry({ ...est, estimateLow: 1100000 }, day)); // range must contain the value
assert.throws(() => validateManualEntry({ ...est, estimateHigh: 900000 }, day));
assert.throws(() => validateManualEntry({ name: 'Car', kind: 'asset', category: 'other', value: 1, valuationDate: day, address: addr }, day)); // only homes have addresses

(async () => {
  // RentCast provider against a fake fetch: only the address is sent; statuses map to clear outcomes.
  let seen;
  const fake = (status, body) => async (url, init) => { seen = { url: new URL(url), init }; return new Response(body == null ? '' : JSON.stringify(body), { status }); };
  const a = validateAddress(addr);
  const ok = await rentcast('test-key', fake(200, { price: 1000123.4, priceRangeLow: 950000, priceRangeHigh: 1050000, comparables: [{}, {}, {}] })).estimate(a);
  assert.deepEqual({ value: ok.value, low: ok.low, high: ok.high, comps: ok.comps, provider: ok.provider }, { value: 1000123, low: 950000, high: 1050000, comps: 3, provider: 'RentCast' });
  assert.equal(seen.url.origin + seen.url.pathname, 'https://api.rentcast.io/v1/avm/value');
  assert.deepEqual([...seen.url.searchParams.keys()], ['address']);
  assert.equal(seen.url.searchParams.get('address'), formatAddress(a));
  assert.equal(seen.init.headers['X-Api-Key'], 'test-key');
  assert.equal(await rentcast('k', fake(404, { message: 'not found' })).estimate(a), null);
  assert.equal(await rentcast('k', fake(200, { price: 0 })).estimate(a), null);
  await assert.rejects(rentcast('k', fake(429, {})).estimate(a), ValuationError);
  await assert.rejects(rentcast('k', fake(401, {})).estimate(a), ValuationError);
  await assert.rejects(rentcast('k', async () => { throw new Error('offline'); }).estimate(a), ValuationError);
  const clamped = await rentcast('k', fake(200, { price: 500000, priceRangeLow: 600000, priceRangeHigh: 400000 })).estimate(a);
  assert.ok(clamped.low <= clamped.value && clamped.value <= clamped.high);

  // Cron refuses without the shared secret.
  const load = (file, replacements) => { const m = { exports: {} }; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: m.exports, module: m, Request, Response, Buffer, URL, process, require: (p) => replacements[p] ?? require(p) }); return m.exports; };
  const cron = load('app/api/cron/revalue-homes/route.ts', { '@/lib/db': { db: () => { throw new Error('db touched'); }, dbConfigured: () => true }, '@/lib/crypto': {}, '@/lib/schema': require('../lib/schema.ts'), '@/lib/property': require('../lib/property.ts'), '@/lib/valuation': { valuationProvider: () => ({}) }, '@/lib/sync': {}, 'next/server': { NextResponse } });
  process.env.CRON_SECRET = 'cron-test-secret';
  assert.equal((await cron.GET(new Request('https://x.test/api/cron/revalue-homes'))).status, 401);
  assert.equal((await cron.GET(new Request('https://x.test/api/cron/revalue-homes', { headers: { authorization: 'Bearer wrong-secret-xx' } }))).status, 401);
  delete process.env.CRON_SECRET;
  assert.equal((await cron.GET(new Request('https://x.test/api/cron/revalue-homes', { headers: { authorization: 'Bearer undefined' } }))).status, 401);

  // Estimate preview route: auth, origin, address validation, provider outcomes.
  let email = null, provider = null;
  const estimateRoute = load('app/api/property/estimate/route.ts', { 'next/server': { NextResponse }, '@/auth': { currentEmail: async () => email }, '@/lib/manual-assets': require('../lib/manual-assets.ts'), '@/lib/property': require('../lib/property.ts'), '@/lib/valuation': { ValuationError, valuationProvider: () => provider } });
  const req = (body, origin = 'https://x.test') => new Request('https://x.test/api/property/estimate', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await estimateRoute.POST(req({ address: addr }))).status, 401);
  email = 'owner@example.invalid';
  assert.equal((await estimateRoute.POST(req({ address: addr }, 'https://evil.test'))).status, 403);
  assert.equal((await estimateRoute.POST(req({ address: addr }))).status, 503);
  provider = { estimate: async () => ok };
  assert.equal((await estimateRoute.POST(req({ address: { ...addr, postalCode: 'x' } }))).status, 400);
  const good = await estimateRoute.POST(req({ address: addr }));
  assert.equal(good.status, 200); assert.equal((await good.json()).estimate.value, 1000123);
  provider = { estimate: async () => null };
  assert.equal((await estimateRoute.POST(req({ address: addr }))).status, 404);
  provider = { estimate: async () => { throw new ValuationError('quota'); } };
  assert.equal((await estimateRoute.POST(req({ address: addr }))).status, 502);

  // Agent sees value, range, mortgage, equity — and nothing that identifies the address.
  const d = { items: [{ institution: 'Fixture Bank', accounts: [{ id: 'loan', name: 'Mortgage', type: 'loan', subtype: 'mortgage', balance: -400000, include: true }] }], manualEntries: [{ id: 'h', name: '1 Fixture Way', kind: 'asset', category: 'property', value: 1000000, valuationDate: day, archived: false, linkedMortgageId: 'loan', valuationSource: 'estimate', estimateLow: 950000, estimateHigh: 1050000, address: validateAddress(addr) }] };
  const out = runTool('get_home', {}, d);
  assert.equal(out.homes[0].equity, 600000); assert.equal(out.homes[0].loan_to_value_percent, 40); assert.deepEqual(out.homes[0].estimate_range, { low: 950000, high: 1050000 });
  assert.doesNotMatch(JSON.stringify(out), /Fixture Way|Testville|94000/);
  assert.equal(runTool('get_home', {}, { items: [], manualEntries: [] }).homes.length, 0);
  console.log('PASS homes: address + entry validation, RentCast parsing and errors, revalue timing, cron auth, estimate route, agent view without address');
})().catch((e) => { console.error(e); process.exitCode = 1; });
