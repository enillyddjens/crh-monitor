const test=require('node:test'),assert=require('node:assert/strict'),C=require('../shared.js');
const w='0x'+'2'.repeat(40),id='0x'+'a'.repeat(64),other='0x'+'1'.repeat(40);
test('flat request format used by game preserves purchased build and omits auth fields',()=>{
 const meta=C.orderRequestMeta({action:'build',id:'plot-2',signature:'private',session:'private'},w);
 const r=C.sanitizeOrder({id,wallet:w,action:meta.action,args:meta.args,quotePriceUSD:.001});assert.equal(r.label,'Plot 3');assert.equal(meta.wallet,w);assert(!JSON.stringify(meta).includes('private'));
 const nested=C.orderRequestMeta({action:'build',args:{id:'island_level-3'}},w);assert.equal(C.orderLabel(nested.action,nested.args),'Island Level 3');
});
test('confirmation or empty status cannot erase item name or original quote price',()=>{
 const quote=C.sanitizeOrder({id,wallet:w,action:'build',args:{id:'island_level-3'},quotePriceUSD:.0005});
 const confirmed=C.mergeOrder(quote,{id,wallet:w,action:'purchase_confirmed',args:{},quotePriceUSD:.0008});assert.equal(confirmed.label,'Island Level 3');assert.equal(confirmed.action,'build');assert.equal(confirmed.quotePriceUSD,.0005);
 const status=C.mergeOrder(confirmed,{id,wallet:w,action:null,args:{}});assert.equal(status.label,'Island Level 3');assert.equal(status.quotePriceUSD,.0005);
 const noArgs=C.mergeOrder(quote,{id,wallet:w,action:'build',args:{}});assert.equal(noArgs.label,'Island Level 3');
});
test('order metadata never joins two wallets or creates a missing purchase label',()=>{
 const previous=C.sanitizeOrder({id,wallet:other,action:'build',args:{id:'grid-2'},quotePriceUSD:1});
 const r=C.mergeOrder(previous,{id,wallet:w,action:'purchase_confirmed',args:{}});assert.equal(r.label,'Покупка в игре');assert.equal(r.quotePriceUSD,null);
});
test('new server power table, builder queue and inventory survive strict snapshot validation',()=>{
 const raw={wallet:w,chain_id:4663,token:C.TOKEN,economy_revision:'island-current',island:{plots:2},stats:{island:{grid_capacity_w:475,grid_load_w:180},setups:{setup_1:{ready:true,running:true,hashrate_micro:8200000,power_w:77,thermal:{cpu_c:52.2,gpu_c:51.8,loss_bps:832}}}},setups:{setup_1:{plot:0,powered:true,slots:{cpu:'cpu1',ram:['ram1','ram2'],signature:'private'},auto_paste:{cpu:true,gpu:false}}},items:[{id:'cpu1',catalog:'retro_cpu_q9650',installed_setup:'setup_1',wear_ms:3600000,repair_usd_micro:100000,session:'private'}],progression:{power_level:1,power_levels:[{level:1,capacity_w:475,minutes:15,signature:'private'}],builder:{current:{kind:'island_level',target:2,name:'Island Level 2',ends_at:1000},queue:[{kind:'plot',target:2,name:'Plot 3',ends_at:2000}],finishes_at:2000,queue_length:1},projected:{island_level:2,plots:3}}};
 const s=C.validateSnapshot(C.sanitizeState(raw));assert.equal(s.gridCapacity,475);assert.equal(s.powerLevels[0].capacityW,475);assert.equal(s.builderEnd,1000);assert.equal(s.builderQueueEnd,2000);assert.equal(s.builderJobs[1].name,'Plot 3');assert.equal(s.pcs[0].plot,1);assert.equal(s.pcs[0].hash,8.2);assert.equal(s.pcs[0].cpuC,52.2);assert.equal(s.pcs[0].gpuC,51.8);assert.equal(s.pcs[0].thermalLossPct,8.32);assert.equal(s.items[0].repairUSD,.1);assert.equal(s.projectedPlots,3);assert.equal(s.openPlots,2);assert(!JSON.stringify(s).includes('private'));
});
