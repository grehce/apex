const assert=require('node:assert/strict');
const {transactionsReady,retryableTransactionError,nextUtcDay,pullTransactionPages}=require('../lib/transaction-readiness.ts');
const response=(status='HISTORICAL_UPDATE_COMPLETE',more=false,cursor='done',added=[])=>({transactions_update_status:status,has_more:more,next_cursor:cursor,added,modified:[],removed:[]});
assert.equal(transactionsReady('NOT_READY'),false);assert.equal(transactionsReady('TRANSACTIONS_UPDATE_STATUS_UNKNOWN'),false);assert.equal(transactionsReady('INITIAL_UPDATE_COMPLETE'),true);assert.equal(transactionsReady('HISTORICAL_UPDATE_COMPLETE'),true);
assert.equal(nextUtcDay(new Date('2026-10-21T23:59:00Z')).toISOString(),'2026-10-22T00:00:00.000Z');
assert.equal(retryableTransactionError('PRODUCT_NOT_READY'),true);assert.equal(retryableTransactionError('ITEM_LOGIN_REQUIRED'),false);assert.equal(retryableTransactionError('PRODUCTS_NOT_SUPPORTED'),false);
(async()=>{
 let writes=0;let r=await pullTransactionPages(async()=>response('INITIAL_UPDATE_COMPLETE'),async()=>{writes++});assert.equal(r.ready,true);assert.equal(writes,1); // genuinely ready zero rows
 r=await pullTransactionPages(async()=>response('NOT_READY'),async()=>{});assert.equal(r.ready,false);
 r=await pullTransactionPages(async()=>response('TRANSACTIONS_UPDATE_STATUS_UNKNOWN'),async()=>{});assert.equal(r.ready,false);
 let fetches=0;const store=new Map();const apply=async p=>{for(const t of [...p.added,...p.modified])store.set(t.transaction_id,t);for(const t of p.removed)store.delete(t.transaction_id)};
 const fetch=async cursor=>{fetches++;if(fetches===2)throw {response:{data:{error_code:'SYNC_UPDATES_DURING_PAGINATION'}}};return cursor===undefined?response('INITIAL_UPDATE_COMPLETE',true,'page2',[{transaction_id:'one'}]):response('HISTORICAL_UPDATE_COMPLETE',false,'done',[{transaction_id:'two'}])};
 r=await pullTransactionPages(fetch,apply);assert.equal(r.ready,true);assert.equal(store.size,2);assert.equal(fetches,4);
 let pages=0;r=await pullTransactionPages(async()=>response('HISTORICAL_UPDATE_COMPLETE',true,String(++pages)),async()=>{});assert.equal(pages,20);assert.equal(r.ready,false);assert.equal(r.complete,false);assert.equal(r.cursor,'20');
 await assert.rejects(pullTransactionPages(async()=>response(),async()=>{throw Error('write failure')}));
 console.log('PASS transaction readiness: zero-ready versus pending, unknown status, pagination restart/replay, bounded cursor continuation, failed writes, retry classification');
})().catch(e=>{console.error(e);process.exitCode=1});
