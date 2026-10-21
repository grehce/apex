// No network, credentials or real database: exercise route handlers against an ownership-aware fake.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { PgDialect } = require('drizzle-orm/pg-core');
const { validateManualEntry, manualAccounts, sameOrigin } = require('../lib/manual-assets.ts');
const { build } = require('../lib/data.ts');
const schema = require('../lib/schema.ts');
const { NextResponse } = require('next/server');
const day = '2026-10-21';
const property = { name: 'Test property', kind: 'asset', category: 'property', value: 500000, valuationDate: day };
const liability = { name: 'Test debt', kind: 'liability', category: 'mortgage', value: 200000, valuationDate: day, liabilityConfirmed: true };
assert.equal(validateManualEntry(property, day).value, 500000);
for (const patch of [{value:-1},{value:Infinity},{value:'500'},{value:.001},{valuationDate:'2026-02-30'},{valuationDate:'2026-10-22'},{name:''},{name:'x'.repeat(101)},{category:'mortgage'}]) assert.throws(()=>validateManualEntry({...property,...patch},day));
assert.throws(()=>validateManualEntry({...liability,liabilityConfirmed:false},day));
assert.throws(()=>validateManualEntry({...liability,linkedMortgageId:'another-account'},day));
const entries=[{...property,id:'asset',archived:false},{...liability,id:'debt',archived:false},{...property,id:'archived',value:999999,archived:true}];
assert.equal(manualAccounts(entries).reduce((n,a)=>n+a.balance,0),300000);
const linked = { id:'linked-mortgage',itemId:'bank',institution:'Test Bank',name:'Mortgage',mask:null,type:'loan',subtype:'mortgage',balance:-200000,include:true };
const input={items:[{itemId:'bank',institution:'Test Bank',status:'ok',lastSyncedAt:null,accounts:[linked]}],manualEntries:[entries[0]],holdings:[],txs:[],snapshots:[],today:new Date(day)};
const dashboard=build(input,false,{db:true,plaid:true,encryption:true});
assert.equal(dashboard.netWorth,300000); // full property less existing linked mortgage, once
assert.equal(dashboard.items.length,1); // manual values never become Plaid connections
assert.equal(build({...input,items:[],manualEntries:[entries[0]]},false,{db:true,plaid:true,encryption:true}).netWorth,500000);
assert.equal(build({...input,manualEntries:[{...entries[0],archived:true}]},false,{db:true,plaid:true,encryption:true}).netWorth,-200000);
assert.equal(sameOrigin(new Request('https://www.apexfolios.com/api/manual-assets',{headers:{origin:'https://evil.example'}})),false);
assert.equal(sameOrigin(new Request('https://www.apexfolios.com/api/manual-assets',{headers:{origin:'null'}})),false);
assert.equal(sameOrigin(new Request('https://www.apexfolios.com/api/manual-assets',{headers:{origin:'http://www.apexfolios.com'}})),false);
let email=null,writes=0,snapshots=0,whereParams=[];const history=[],inserted=[];
const dialect=new PgDialect();
const fakeDb={
 insert:(table)=>({values:(row)=>{if(table===schema.propertyValuations){history.push(row);return {onConflictDoUpdate:async()=>{}}}inserted.push(row);writes++;return Promise.resolve()}}),
 select:()=>({from:()=>({where:async(condition)=>{const q=dialect.sqlToQuery(condition);return q.params.includes('owned-mortgage')&&q.params.includes(email)?[{id:'owned-mortgage'}]:[]}})}),
 update:()=>({set:()=>({where:(condition)=>{whereParams=dialect.sqlToQuery(condition).params;return {returning:async()=>{if(whereParams[0]==='owned-entry'&&whereParams[1]===email){writes++;return [{id:'owned-entry'}]}return []}}}})})
};
const moduleMock={exports:{}};
const source=ts.transpileModule(fs.readFileSync('app/api/manual-assets/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const replacements={'next/server':{NextResponse},'@/auth':{currentEmail:async()=>email},'@/lib/db':{db:()=>fakeDb,dbConfigured:()=>true},'@/lib/schema':schema,'@/lib/manual-assets':require('../lib/manual-assets.ts'),'@/lib/sync':{recordNetWorth:async()=>{snapshots++}},'@/lib/crypto':{encrypt:(t)=>'enc:'+t}};
vm.runInNewContext(source,{exports:moduleMock.exports,module:moduleMock,Request,require:p=>replacements[p]??require(p)});
const routes=moduleMock.exports;
const req=(body,origin='https://www.apexfolios.com')=>new Request('https://www.apexfolios.com/api/manual-assets',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
(async()=>{
 assert.equal((await routes.POST(req(property))).status,401);assert.equal(writes,0);
 email='test-owner@example.invalid';
 assert.equal((await routes.POST(req(property,'https://evil.example'))).status,403);assert.equal(writes,0);
 assert.equal((await routes.POST(req({...property,value:-1}))).status,400);
 assert.equal((await routes.POST(req({...property,linkedMortgageId:'foreign-mortgage'}))).status,400);assert.equal(writes,0);
 assert.equal((await routes.POST(req({...property,linkedMortgageId:'owned-mortgage'}))).status,201);assert.equal(writes,1);
 assert.equal((await routes.PATCH(req({id:'foreign-entry',archived:true}))).status,404);assert.equal(writes,1);assert.equal(whereParams[1],email);
 assert.equal((await routes.PATCH(req({id:'owned-entry',...property,value:600000}))).status,200);
 assert.equal((await routes.PATCH(req({id:'owned-entry',archived:true}))).status,200);
 assert.equal((await routes.PATCH(req({id:'owned-entry',archived:false}))).status,200);
 assert.equal(snapshots,4);assert.equal(routes.DELETE,undefined);
 // A home with an automatic estimate: address stored encrypted, valuation history recorded.
 const home={name:'1 Fixture Way',kind:'asset',category:'property',value:1000000,valuationDate:day,address:{street:'1 Fixture Way',city:'Testville',region:'CA',postalCode:'94000'},valuationSource:'estimate',estimateLow:950000,estimateHigh:1050000,estimateComps:5,valuationProvider:'RentCast'};
 assert.equal((await routes.POST(req(home))).status,201);
 const saved=inserted.at(-1);assert.equal(saved.address,undefined);assert.match(saved.addressEnc,/^enc:/);assert.equal(saved.valuationSource,'estimate');assert.equal(typeof saved.lastValuedAt.getTime(),'number');
 assert.equal(history.at(-1).source,'estimate');assert.equal(history.at(-1).value,1000000);assert.equal(history.at(-1).low,950000);
 assert.equal((await routes.POST(req({...home,address:null}))).status,400);
 // Reset date: its own small update, owner-scoped, validated.
 assert.equal((await routes.PATCH(req({id:'owned-entry',rateResetDate:'2029-06-01'}))).status,200);assert.equal(whereParams[1],email);
 assert.equal((await routes.PATCH(req({id:'owned-entry',rateResetDate:'2029-02-30'}))).status,400);
 assert.equal((await routes.PATCH(req({id:'foreign-entry',rateResetDate:'2029-06-01'}))).status,404);
 console.log('PASS manual entries: validation, totals, linked mortgage counted once, archive/restore, auth/origin, cross-user rejection, owned association, no delete');
})().catch(e=>{console.error(e);process.exitCode=1});
