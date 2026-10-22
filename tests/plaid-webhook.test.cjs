// Plaid webhooks: ES256 signature verification (real key, real JWT), webhook → action mapping,
// the webhook URL rule, and the route against a fake db (rejects unsigned, ignores unknown Items,
// syncs on new data, flags attention, clears it on repair).
// Run: node --import tsx tests/plaid-webhook.test.cjs
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { verifyPlaidWebhook, planWebhook, webhookUrl, ATTENTION_COPY } = require('../lib/plaid-webhook.ts');
const { NextResponse } = require('next/server');

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'ES256', use: 'sig', created_at: 1, expired_at: null };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(body, { iat = Math.floor(Date.now() / 1000), kid = 'k1', alg = 'ES256', key = privateKey, hash } = {}) {
  const h = b64({ alg, kid, typ: 'JWT' });
  const p = b64({ iat, request_body_sha256: hash ?? crypto.createHash('sha256').update(body).digest('hex') });
  const sig = crypto.sign('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${h}.${p}.${sig}`;
}
const getKey = async (kid) => (kid === 'k1' ? jwk : null);

(async () => {
  const body = JSON.stringify({ webhook_type: 'TRANSACTIONS', webhook_code: 'SYNC_UPDATES_AVAILABLE', item_id: 'item-1' });
  assert.deepEqual(await verifyPlaidWebhook(body, sign(body), getKey), { ok: true });
  const bad = async (jwt, raw = body, k = getKey) => (await verifyPlaidWebhook(raw, jwt, k)).reason;
  assert.equal(await bad(null), 'missing Plaid-Verification header');
  assert.equal(await bad('a.b'), 'malformed token');
  assert.equal(await bad(sign(body), body + ' '), 'body hash mismatch'); // body changed after signing
  assert.equal(await bad(sign(body, { kid: 'nope' })), 'unknown key');
  assert.equal(await bad(sign(body, { alg: 'HS256' })), 'unexpected algorithm');
  assert.equal(await bad(sign(body, { iat: Math.floor(Date.now() / 1000) - 600 })), 'stale or future token');
  assert.equal(await bad(sign(body, { key: crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey })), 'bad signature');
  assert.equal(await bad(sign(body), body, async () => ({ ...jwk, expired_at: 1 })), 'expired key');

  // Webhook → action
  assert.equal(planWebhook({ webhook_type: 'TRANSACTIONS', webhook_code: 'SYNC_UPDATES_AVAILABLE' }).kind, 'sync');
  assert.equal(planWebhook({ webhook_type: 'HOLDINGS', webhook_code: 'DEFAULT_UPDATE' }).kind, 'sync');
  assert.equal(planWebhook({ webhook_type: 'LIABILITIES', webhook_code: 'DEFAULT_UPDATE' }).kind, 'sync');
  assert.deepEqual(planWebhook({ webhook_type: 'ITEM', webhook_code: 'ERROR', error: { error_code: 'ITEM_LOGIN_REQUIRED' } }), { kind: 'attention', attention: 'login_required' });
  assert.equal(planWebhook({ webhook_type: 'ITEM', webhook_code: 'ERROR', error: { error_code: 'INTERNAL_SERVER_ERROR' } }).kind, 'ignore');
  assert.equal(planWebhook({ webhook_type: 'ITEM', webhook_code: 'NEW_ACCOUNTS_AVAILABLE' }).attention, 'new_accounts');
  assert.equal(planWebhook({ webhook_type: 'ITEM', webhook_code: 'PENDING_DISCONNECT' }).attention, 'pending_disconnect');
  assert.equal(planWebhook({ webhook_type: 'ITEM', webhook_code: 'USER_PERMISSION_REVOKED' }).attention, 'revoked');
  assert.equal(planWebhook({ webhook_type: 'ITEM', webhook_code: 'LOGIN_REPAIRED' }).kind, 'repaired');
  assert.equal(planWebhook({ webhook_type: 'ITEM', webhook_code: 'WEBHOOK_UPDATE_ACKNOWLEDGED' }).kind, 'ack');
  assert.equal(planWebhook({}).kind, 'ignore');
  for (const a of ['login_required', 'pending_expiration', 'pending_disconnect', 'new_accounts', 'revoked']) assert.ok(ATTENTION_COPY[a]);

  assert.equal(webhookUrl({ PLAID_ENV: 'production' }), 'https://www.apexfolios.com/api/plaid/webhook');
  assert.equal(webhookUrl({ PLAID_ENV: 'sandbox' }), null);
  assert.equal(webhookUrl({ PLAID_ENV: 'sandbox', PLAID_WEBHOOK_URL: 'https://x.test/h' }), 'https://x.test/h');

  // Route against a fake db
  const items = { 'item-1': { itemId: 'item-1', userEmail: 'owner@example.invalid', status: 'ok', attention: null } };
  const sets = []; let synced = 0, recorded = 0;
  const fakeDb = {
    select: () => ({ from: () => ({ where: async () => Object.values(items).filter((i) => i.itemId === currentItem) }) }),
    update: () => ({ set: (s) => ({ where: async () => { sets.push(s); Object.assign(items[currentItem] ?? {}, s); } }) }),
  };
  let currentItem = null;
  const replacements = {
    'next/server': { NextResponse },
    'drizzle-orm': { eq: () => ({}) },
    '@/lib/db': { db: () => fakeDb, dbConfigured: () => true },
    '@/lib/plaid': { plaid: () => ({ webhookVerificationKeyGet: async ({ key_id }) => { if (key_id !== 'k1') throw new Error('404'); return { data: { key: jwk } }; } }), plaidConfigured: () => true },
    '@/lib/schema': { plaidItems: { itemId: 'item_id' } },
    '@/lib/plaid-log': { logPlaid: () => {} },
    '@/lib/plaid-webhook': require('../lib/plaid-webhook.ts'),
    '@/lib/sync': { syncItem: async () => { synced++; }, recordNetWorth: async () => { recorded++; } },
  };
  const m = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/plaid/webhook/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: m.exports, module: m, Request, Response, Buffer, URL, Date, process, require: (p) => replacements[p] ?? require(p) });
  const hook = (obj, jwt) => { const raw = JSON.stringify(obj); currentItem = obj.item_id; return m.exports.POST(new Request('https://x.test/api/plaid/webhook', { method: 'POST', body: raw, headers: { 'plaid-verification': jwt === undefined ? sign(raw) : jwt } })); };

  assert.equal((await hook({ webhook_type: 'TRANSACTIONS', webhook_code: 'SYNC_UPDATES_AVAILABLE', item_id: 'item-1' }, null)).status, 401);
  assert.equal(sets.length, 0); assert.equal(synced, 0); // unsigned does nothing
  const unknown = await hook({ webhook_type: 'TRANSACTIONS', webhook_code: 'SYNC_UPDATES_AVAILABLE', item_id: 'someone-else' });
  assert.equal(unknown.status, 200); assert.equal((await unknown.json()).ignored, 'unknown item'); assert.equal(synced, 0);

  const s1 = await hook({ webhook_type: 'TRANSACTIONS', webhook_code: 'SYNC_UPDATES_AVAILABLE', item_id: 'item-1' });
  assert.equal(s1.status, 200); assert.equal(synced, 1); assert.equal(recorded, 1);
  assert.ok(items['item-1'].lastWebhookAt instanceof Date);

  await hook({ webhook_type: 'ITEM', webhook_code: 'ERROR', item_id: 'item-1', error: { error_code: 'ITEM_LOGIN_REQUIRED' } });
  assert.equal(items['item-1'].attention, 'login_required'); assert.equal(items['item-1'].status, 'login_required');
  await hook({ webhook_type: 'ITEM', webhook_code: 'LOGIN_REPAIRED', item_id: 'item-1' });
  assert.equal(items['item-1'].attention, null); assert.equal(items['item-1'].status, 'ok');
  await hook({ webhook_type: 'ITEM', webhook_code: 'NEW_ACCOUNTS_AVAILABLE', item_id: 'item-1' });
  assert.equal(items['item-1'].attention, 'new_accounts'); assert.equal(items['item-1'].status, 'ok');
  const ack = await hook({ webhook_type: 'ITEM', webhook_code: 'WEBHOOK_UPDATE_ACKNOWLEDGED', item_id: 'item-1' });
  assert.equal((await ack.json()).action, 'ack'); assert.equal(synced, 1);

  console.log('PASS plaid-webhook: ES256 verification (sig, kid, alg, iat, body hash, expiry), action mapping, URL rule, route effects');
})().catch((e) => { console.error(e); process.exitCode = 1; });
