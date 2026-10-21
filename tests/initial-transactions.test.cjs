const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const schema=require('../lib/schema.ts'),readiness=require('../lib/transaction-readiness.ts');
const {PgDialect}=require('drizzle-orm/pg-core');const dialect=new PgDialect();
const source=ts.transpileModule(fs.readFileSync('lib/initial-transactions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const item={itemId:'fixture-item',userEmail:'fixture@example.invalid',accessTokenEnc:'fixture',txCursor:null,transactionsState:'pending',transactionsRetryAt:new Date(0),transactionsLeaseUntil:null};
let row={...item},locked=false,calls=0,claimSql='',releaseFetch,mode='pending';
const fakeDb={update:()=>({set:values=>({where:condition=>({
 returning:async()=>{claimSql=dialect.sqlToQuery(condition).sql;const params=dialect.sqlToQuery(condition).params;assert.ok(params.includes(item.userEmail));assert.ok(params.includes(item.itemId));if(locked||!['pending','unknown'].includes(row.transactionsState)||row.transactionsRetryAt>new Date())return [];locked=true;Object.assign(row,values);return [{...row}]},
 then:(resolve,reject)=>Promise.resolve().then(()=>{Object.assign(row,values);if(values.transactionsLeaseUntil===null)locked=false;return []}).then(resolve,reject)
})})})};
const replacements={'server-only':{},'./db':{db:()=>fakeDb},'./crypto':{decrypt:()=> 'fixture-test-token'},'./schema':schema,'./transaction-readiness':readiness,'./plaid':{plaidErrorCode:e=>e?.response?.data?.error_code??null,plaid:()=>({transactionsSync:async()=>{calls++;if(mode==='pending')await new Promise(r=>{releaseFetch=r});if(mode==='reauth')throw {response:{data:{error_code:'ITEM_LOGIN_REQUIRED'}}};return {data:{added:[],modified:[],removed:[],next_cursor:'fixture-cursor',has_more:false,transactions_update_status:mode==='ready'?'INITIAL_UPDATE_COMPLETE':'NOT_READY'}}}})}};
const m={exports:{}};vm.runInNewContext(source,{exports:m.exports,module:m,Date,require:p=>replacements[p]??require(p)});
(async()=>{
 const first=m.exports.syncTransactions(item,true);await new Promise(r=>setImmediate(r));assert.equal(calls,1);
 const second=await m.exports.syncTransactions(item,true);assert.equal(second.pending,true);assert.equal(calls,1);assert.match(claimSql,/transactions_lease_until/);assert.match(claimSql,/transactions_retry_at/);
 releaseFetch();await first;assert.equal(row.transactionsState,'pending');assert.equal(locked,false);assert.ok(row.transactionsRetryAt>new Date());
 await m.exports.syncTransactions(item,true);assert.equal(calls,1); // no same-day repeat
 row.transactionsState='unknown';row.transactionsRetryAt=new Date(0);mode='ready';await m.exports.syncTransactions(item,true);assert.equal(row.transactionsState,'ready');assert.equal(calls,2);
 await m.exports.syncTransactions({...row},true);assert.equal(calls,2); // ready Item leaves daily queue
 row.transactionsState='pending';row.transactionsRetryAt=new Date(0);mode='reauth';await m.exports.syncTransactions(item,true);assert.equal(row.transactionsState,'action_required');assert.equal(row.status,'login_required');assert.equal(row.transactionsError,'ITEM_LOGIN_REQUIRED');assert.equal(locked,false);
 console.log('PASS initial retries: owned atomic lease, concurrent skip, once-per-UTC-day, pending persistence, zero-ready stop and reauth stop');
 const cronModule={exports:{}};const env={VERCEL_ENV:'production'};
 const cronCode=ts.transpileModule(fs.readFileSync('app/api/cron/initial-transactions/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const cronReplacements={'@/auth':{allowedEmails:()=>new Set()},'@/lib/db':{db:()=>{throw Error('should not access DB')},dbConfigured:()=>true},'@/lib/schema':schema,'@/lib/initial-transactions':{syncTransactions:()=>{throw Error('should not sync')}}};
 vm.runInNewContext(cronCode,{exports:cronModule.exports,module:cronModule,process:{env},Response,Buffer,require:p=>cronReplacements[p]??require(p)});
 const request=header=>new Request('https://example.invalid/api/cron/initial-transactions',{headers:header?{authorization:header}:{}});
 assert.equal((await cronModule.exports.GET(request())).status,503);
 env.CRON_SECRET='fixture-only-not-a-credential-000000000000';assert.equal((await cronModule.exports.GET(request('Bearer wrong'))).status,401);
 assert.equal((await cronModule.exports.GET(request('Bearer '+env.CRON_SECRET))).status,200);
 env.VERCEL_ENV='preview';assert.equal((await cronModule.exports.GET(request('Bearer '+env.CRON_SECRET))).status,503);
 console.log('PASS cron auth: fail closed when unconfigured, reject wrong bearer, accept fixture bearer, disable Preview');
})().catch(e=>{console.error(e);process.exitCode=1});
