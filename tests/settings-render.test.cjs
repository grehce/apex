const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const replacements={
 'next/navigation':{useRouter:()=>({push:()=>{},refresh:()=>{}})},
 'react-plaid-link':{usePlaidLink:()=>({open:()=>{},ready:false})},
 '../InstitutionLogo':{InstitutionLogo:()=>null},'./AgentAccess':{AgentAccess:()=>null},
 '../networth/ManualAssets':{ManualAssets:()=>React.createElement('section',{id:'manual-assets'},'Fixture assets section')},
 '@/lib/net-worth':require('../lib/net-worth.ts'),'@/lib/model':require('../lib/model.ts')
};
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/settings/SettingsView.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:m.exports,module:m,require:p=>replacements[p]??require(p)});
const account={id:'cash',itemId:'item',institution:'Fixture Bank',name:'Fixture cash',mask:null,type:'depository',subtype:'checking',balance:100,include:true};
const props={items:[{itemId:'item',institution:'Fixture Bank',status:'ok',lastSyncedAt:null,accounts:[account]}],manualEntries:[{id:'home',name:'Fixture home',kind:'asset',category:'property',value:200,valuationDate:'2026-10-21',archived:false}],initialNetWorth:300,sample:false,setup:{plaid:true,db:true,encryption:true},plaidEnv:'production',email:'fixture@example.invalid'};
const signedIn=renderToStaticMarkup(React.createElement(m.exports.SettingsView,props));
assert.match(signedIn,/\$300\.00/);assert.doesNotMatch(signedIn,/Only approved Google accounts can sign in\./);assert.match(signedIn,/Include Fixture cash in net worth/);
assert.doesNotMatch(signedIn,/plaid production/);assert.match(signedIn,/id="manual-assets"/);assert.ok(!fs.readFileSync('app/(app)/page.tsx','utf8').includes('/networth#manual-assets'));assert.ok(!fs.readFileSync('app/(app)/networth/page.tsx','utf8').includes('<ManualAssets'));
const demo=renderToStaticMarkup(React.createElement(m.exports.SettingsView,{...props,manualEntries:[],initialNetWorth:100,demo:true}));
assert.match(demo,/Sample net worth/);assert.match(demo,/Only approved Google accounts can sign in\./);assert.match(demo,/fictional institutions/);assert.doesNotMatch(demo,/\$300\.00/);
const empty=renderToStaticMarkup(React.createElement(m.exports.SettingsView,{...props,items:[],manualEntries:[],sample:true,initialNetWorth:123}));assert.match(empty,/Sample net worth/);assert.match(empty,/\$123\.00/);
console.log('PASS Settings rendering: shared tally/manual amount, sample isolation, empty sample baseline, access-list copy only signed out');
