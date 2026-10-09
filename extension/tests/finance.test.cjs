const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../shared.js'),now=Date.now(),w='0x'+'2'.repeat(40);
const settings={...C.defaults(),wallet:w,positions:{[w]:{capitalUSD:100,returnedUSD:10,sellFeePct:3,careDailyUSD:.1,gasDailyUSD:.01}}};
const game={wallet:w,seenAt:now,serverNow:now,settledAt:now,settlement:'ready',priceUSD:.001,priceQuotable:true,myHash:10,totalHash:10000,hourlyWei:'100000000000000000000',rateConfirmed:true,watts:77,electricityUSD:.55,dailyEnergyUSD:1.0164,spentUSD:35,claimableWei:'2000000000000000000',budgetWei:'60000000000000000000000000',rateBps:1000,dayEnd:now+86400000};
const chain={wallet:w,at:now,balanceWei:'50000000000000000000000',vaultWei:'650000000000000000000000000',ethWei:'1000000000000000'};
const compute=(g=game,s=settings,q=g,c=chain)=>C.compute(s,g,c,q,now);
test('18-decimal token units are not confused with micro-units',()=>{
 assert.equal(C.units('123456789000000000000000'),123456.789);
 assert.equal(C.units('0'),0);assert.equal(C.units('-1'),null);assert.equal(C.units('bad'),null);
 assert.equal(C.wei('1000000000000000001'),'1000000000000000001');
});
test('server payout rate, costs, and remaining payback are calculated once',()=>{
 const m=compute();assert.equal(m.dailyTokens,2400);assert.equal(m.grossDaily,2.4);
 assert(Math.abs(m.netDaily-1.2016)<1e-9);assert(Math.abs(m.paybackDays-90/1.2016)<1e-9);
 assert.equal(m.remaining,90);assert.equal(m.share,.001);
});
test('purchased wallet tokens do not count as returned investment',()=>{
 const m=compute();assert.equal(m.balance,50000);assert.equal(m.totalTokens,50002);assert.equal(m.remaining,90);
 const richer=compute(game,settings,game,{...chain,balanceWei:'999000000000000000000000000'});
 assert.equal(richer.paybackDays,m.paybackDays);
});
test('different wallets never receive each other’s island metrics',()=>{
 const s={...settings,wallet:'0x'+'1'.repeat(40)};const m=compute(game,s,game);
 assert.equal(m.own,null);assert.equal(m.share,null);assert.equal(m.balance,null);assert.equal(m.paybackDays,null);assert.equal(m.price,.001);
});
test('stale, unconfirmed, unsettled, or previous-day data disables payback',()=>{
 for(const patch of [{seenAt:now-121000},{serverNow:now-200000},{rateConfirmed:false},{settlement:'pending'}]){
   assert.equal(compute({...game,...patch}).paybackDays,null);
 }
 assert.equal(compute(game,settings,{...game,dayEnd:game.dayEnd+86400000}).paybackDays,null);
});
test('negative operating income has no payback; returned capital is explicit',()=>{
 assert.equal(compute({...game,priceUSD:.00001}).paybackDays,null);
 const s={...settings,positions:{[w]:{capitalUSD:100,returnedUSD:100}}};assert.equal(compute(game,s).paybackDays,0);
});
test('pool at start of day is budget/rate, never the on-chain vault balance',()=>{
 const m=compute();assert.equal(m.poolAtStart,600000000);assert.equal(m.vaultTokens,650000000);
 assert.equal(compute(game,settings,{...game,budgetWei:'30000000000000000000000000'}).poolAtStart,300000000);
});
test('empty accounting input stays unknown and fees are bounded',()=>{
 assert.equal(C.position({wallet:w,positions:{[w]:{capitalUSD:'',sellFeePct:900}}}).capitalUSD,null);
 assert.equal(C.position({wallet:w,positions:{[w]:{sellFeePct:900}}}).sellFeePct,100);
 assert.equal(compute(null).netDaily,null);
});
test('snapshot allowlist rejects injected fields and invalid money',()=>{
 const s=C.validateSnapshot({...game,session:'secret',signature:'secret',hourlyWei:'<script>',priceUSD:-1});
 assert(!('session'in s));assert(!('signature'in s));assert.equal(s.hourlyWei,null);assert.equal(s.priceUSD,null);
 assert.equal(C.validateSnapshot({wallet:'invalid'}),null);
});
test('main-world and isolated-world calculation files remain identical',()=>{
 const root=path.join(__dirname,'..');assert.equal(fs.readFileSync(path.join(root,'shared.js'),'utf8'),fs.readFileSync(path.join(root,'page-core.js'),'utf8'));
});
test('builder timer separates current job from end of entire queue',()=>{
 const raw={wallet:w,chain_id:4663,token:C.TOKEN,progression:{builder:{current:{kind:'grid',target:1,name:'Power Level 1',starts_at:1000,ends_at:4000},queue:[{kind:'plot',target:1,name:'Plot 2',starts_at:4000,ends_at:28000,signature:'secret'}],finishes_at:28000,queue_length:1}}};
 const s=C.sanitizeState(raw);assert.equal(s.builderEnd,4000);assert.equal(s.builderQueueEnd,28000);assert.equal(s.builderJobs.length,2);assert(!JSON.stringify(s).includes('secret'));assert.deepEqual(C.validateSnapshot(s).builderJobs,s.builderJobs);
});
