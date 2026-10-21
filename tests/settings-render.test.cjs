const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const replacements={
 'next/navigation':{useRouter:()=>({push:()=>{},refresh:()=>{}})},
 'react-plaid-link':{usePlaidLink:()=>({open:()=>{},ready:false})},
 '../InstitutionLogo':{InstitutionLogo:()=>null},'./AgentAccess':{AgentAccess:()=>null},
 '../networth/ManualAssets':{ManualAssets:()=>React.createElement('section',{id:'manual-assets'},'Fixture assets section')},
 './HomeSheet':{HomeSheet:(p)=>React.createElement('div',{'data-home-sheet':p.fixedMortgageId??'new'},'Fixture home sheet')},
 '@/lib/property':require('../lib/property.ts'),
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
// Homes: a mortgage without a home gets the prompt; a linked home shows equity and LTV; addresses only render where passed.
const loan={id:'loan',itemId:'item',institution:'Fixture Bank',name:'Fixture mortgage',mask:'1234',type:'loan',subtype:'mortgage',balance:-400000,include:true};
const withLoan={...props,items:[{...props.items[0],accounts:[account,loan]}],manualEntries:[],initialNetWorth:-399900};
const prompt=renderToStaticMarkup(React.createElement(m.exports.SettingsView,withLoan));
assert.match(prompt,/Home value not added\./);assert.match(prompt,/>Add home</);
const linkedHome={id:'h1',name:'1 Fixture Way',kind:'asset',category:'property',value:1000000,valuationDate:'2026-10-21',archived:false,linkedMortgageId:'loan',valuationSource:'estimate',estimateLow:950000,estimateHigh:1050000};
const paired=renderToStaticMarkup(React.createElement(m.exports.SettingsView,{...withLoan,manualEntries:[linkedHome],addresses:{h1:{street:'1 Fixture Way',city:'Testville',region:'CA',postalCode:'94000'}},loanDetails:{loan:{ratePct:6.1,rateType:'fixed',loanType:null,loanTerm:'30 year',maturityDate:'2055-01-01',nextPayment:2000,nextPaymentDue:'2026-11-01',escrowBalance:null,monthlyInterest:2033.33,interestOnly:false}}}));
assert.doesNotMatch(paired,/Home value not added/);assert.match(paired,/secures 1 Fixture Way/);assert.match(paired,/href="#home-h1"/);assert.doesNotMatch(paired,/LTV/); // details live in the Home card now
const demoLoan=renderToStaticMarkup(React.createElement(m.exports.SettingsView,{...withLoan,demo:true}));assert.match(demoLoan,/Home value not added/);
const io=renderToStaticMarkup(React.createElement(m.exports.SettingsView,{...withLoan,loanDetails:{loan:{ratePct:3.25,rateType:null,loanType:null,loanTerm:null,maturityDate:null,nextPayment:1083.33,nextPaymentDue:null,escrowBalance:null,monthlyInterest:1083.33,interestOnly:true}}}));assert.doesNotMatch(io,/Share loan details/);assert.match(io,/Home value not added/);
// Home card: value · mortgage · equity, loan facts, interest-only reset countdown.
const hc={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/settings/HomeCard.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:hc.exports,module:hc,require:p=>({'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/property':require('../lib/property.ts')})[p]??require(p)});
const ioLoan={ratePct:3.25,rateType:null,loanType:null,loanTerm:null,maturityDate:'2052-09-01',nextPayment:1083.33,nextPaymentDue:'2026-11-01',escrowBalance:0,monthlyInterest:1083.33,interestOnly:true};
const card=(e,loan=ioLoan)=>renderToStaticMarkup(React.createElement(hc.exports.HomeCard,{entry:e,address:{street:'1 Fixture Way',city:'Testville',region:'CA',postalCode:'94000'},mortgage:loan===undefined?null:loan,loan,signedIn:true,busy:false,onEdit(){},onArchive(){}}));
const mk=(extra)=>renderToStaticMarkup(React.createElement(hc.exports.HomeCard,{entry:{...linkedHome,...extra},address:{street:'1 Fixture Way',city:'Testville',region:'CA',postalCode:'94000'},mortgage:loan,loan:ioLoan,signedIn:true,busy:false,onEdit(){},onArchive(){}}));
const noDate=mk({});assert.match(noDate,/\$600,000/);assert.match(noDate,/LTV 40%/);assert.match(noDate,/interest-only/);assert.match(noDate,/When does the interest-only period end\?/);
const dated=mk({rateResetDate:'2075-06-01'});assert.match(dated,/Interest-only ends Jun 1, 2075/);assert.match(dated,/Start shopping rates by Dec 2074/);
console.log('PASS Settings homes: mortgage prompt, equity/LTV pairing, rate label');
console.log('PASS Settings rendering: shared tally/manual amount, sample isolation, empty sample baseline, access-list copy only signed out');
