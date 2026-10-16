/* Read-only mini-farm planning. Costs are in USD; funding is conserved in CRH. */
(() => {"use strict";
 const C=globalThis.CRHMonitor||(typeof require==='function'?require('./shared.js'):null),I=globalThis.CRHIncome||(typeof require==='function'?require('./income.js'):null),F=globalThis.CRHStarterCatalog||(typeof require==='function'?require('./starter-catalog.js'):null),L=globalThis.CRHLedger||(typeof require==='function'?require('./ledger.js'):null);
 const E=globalThis.CRHEconomy||(typeof require==='function'?require('./economy-rules.js'):null);
 const HOUR=3600000,DAY=24*HOUR,WS=E.WS,TIMES=[15,27,38,50,62,73,85,97,108,120,125,130,135,140,145,150,155,160,165,170],ORDER=['case','board','cpu','gpu','ram','ssd','cooler','fan','psu'];
 const scenarios=[{id:'flat',name:'flat',budget:1,others:1,price:1},{id:'drain',name:'drain',budget:.9,others:1,price:.5},{id:'recovery',name:'recovery',budget:1.03,others:1.08,price:1.5},{id:'volatile',name:'volatile',budget:1.01,others:1.12,price:1}];
 const clone=x=>structuredClone(x),ceil=x=>Math.ceil((x-1e-9)*100)/100,n=v=>C.number(v),sum=(a,f)=>a.reduce((v,x)=>v+f(x),0);
 function options(v={}){return {days:[3,5,10].includes(Number(v.days))?Number(v.days):5,maxPCs:Math.max(1,Math.min(8,Math.floor(Number(v.maxPCs)||8))),careHours:6,scenario:scenarios.some(s=>s.id===v.scenario)?v.scenario:'flat',gpu: ['gpu_hd_5770','gpu_gtx_560_ti'].includes(v.gpu)?v.gpu:'both'};}
 function multiplier(hash,watts,curve=F.curve){
  const value=(curve.k_hash??7.959975)*hash-(curve.k_w??.594)*watts,p=curve.points;
  if(value<=p[0].value)return p[0].multiplier;if(value>=p.at(-1).value)return p.at(-1).multiplier;
  const b=p.findIndex(x=>x.value>=value),lo=p[b-1],hi=p[b];
  return Math.round(Math.exp(Math.log(lo.multiplier)+(Math.log(value)-Math.log(lo.value))/(Math.log(hi.value)-Math.log(lo.value))*Math.log(hi.multiplier/lo.multiplier))*10000)/10000;
 }
 function build(parts,curve=F.curve){
  const get=k=>parts.find(p=>p.kind===k),board=get('board'),cpu=get('cpu'),gpu=get('gpu'),psu=get('psu'),cooler=get('cooler'),box=get('case'),ram=parts.filter(p=>p.kind==='ram'),fans=parts.filter(p=>p.kind==='fan');
  if(!board||!cpu||!gpu||!psu||!cooler||!box||!get('ssd')||!ram.length||cpu.socket!==board.socket||cooler.socket&&cooler.socket!==board.socket||ram.some(r=>r.memory!==board.memory))return null;
  const gb=sum(ram,p=>p.capacity_gb),slots=board.ram_slots?.length??0;
  if(ram.length>slots||gb>board.max_ram_gb||ram.some(r=>r.capacity_gb>board.max_module_gb)||fans.length>(box.fan_mounts?.length??0))return null;
  const speed=Math.min(board.memory_speed,...ram.map(p=>p.speed));let ramHash;
  if(board.memory==='DDR5')ramHash=(10+6*Math.log2(gb/8))*speed/4800;
  else{const h=({2:1,4:2,8:4,16:6})[gb];if(h===undefined)return null;ramHash=h*speed/1600;}
  const hash=cpu.hash+gpu.hash+get('ssd').hash+ramHash,watts=(board.base_watts??16)+sum(parts,p=>p.watts||0);
  if(watts*1.15>(psu.psu_capacity_watts??psu.capacity)+1e-8)return null;
  const eff=multiplier(hash,watts,curve),heat=.043*(watts-(cooler.watts||0)-sum(fans,p=>p.watts||0));
  function temperature(hours){
   let total=0;for(let i=0;i<fans.length;i++)total+=fans[i].flow*((box.fan_mounts[i].size_mm||120)/120)**2;
   const airflow=(box.airflow_score??75)/100*(.7+2*total/(total+(box.ventilation_target??1.3)));
   return Math.max(43+(heat+6.5*cpu.watts/35/(cooler.rating??1))/airflow,43+(heat+9*gpu.watts/75/(gpu.cooler??1.2))/airflow);
  }
  const temp=temperature(0),temp6=temperature(6),heatLoss=Math.min(.3,Math.max(0,temperature(3)-70)*.012);
  return {partsHash:hash,efficiency:eff,healthy:hash*eff,watts,usd:sum(parts,p=>p.usd),gpuHash:gpu.hash,gpuShare:gpu.hash/hash,recipe:parts.map(p=>({id:p.id,name:p.name,kind:p.kind,usd:p.usd,quantity:1})),freshC:temp,care6hC:temp6,heatLoss,fanCare:fans.length>0,level:0,levelSource:'new',on:true};
 }
 function recipes(catalog,filter='both'){
  const products=new Map(F.parts.map(p=>[p.id,p]));for(const p of catalog?.parts||[])products.set(p.id,p);const curve=catalog?.curve??F.curve,parts=[...products.values()],get=id=>products.get(id),answer=[];
  for(const board of parts.filter(p=>p.kind==='board'&&['Retro775','Legacy1155'].includes(p.socket)))for(const cpu of parts.filter(p=>p.kind==='cpu'&&p.socket===board.socket))for(const gpu of parts.filter(p=>p.kind==='gpu'&&['gpu_hd_5770','gpu_gtx_560_ti'].includes(p.id)&&(filter==='both'||p.id===filter)))for(const r of parts.filter(p=>p.kind==='ram'&&p.memory===board.memory))for(const count of [1,2,4])for(const fc of [0,1,2]){
   const psu=get(gpu.id==='gpu_hd_5770'?'retro_psu_100':'psu_legacy_150'),cooler=get(board.socket==='Retro775'?'retro_cooler_tower':'cooler_legacy_air'),v=[get('retro_case_beige'),board,cpu,gpu,...Array(count).fill(r),get('ssd_legacy_64gb'),cooler,...Array(fc).fill(get('retro_fan_92')),psu];if(v.some(p=>!p))continue;
   const b=build(v,curve);if(b&&b.usd<=100){b.key=board.id+'|'+cpu.id+'|'+gpu.id+'|'+r.id+'x'+count+'|f'+fc;b.name=gpu.name+' · '+sum(v.filter(p=>p.kind==='ram'),p=>p.capacity_gb)+' GB';answer.push(b);}
  }
  return answer.sort((a,b)=>a.usd-b.usd||b.healthy-a.healthy);
 }
 function bonus(pcs,hall,tables){const on=pcs.filter(p=>p.on),strong=Math.max(0,...on.map(p=>p.healthy)),matched=on.filter(p=>p.healthy>=5&&p.healthy>=strong/4).length;return matched>=2?(matched-1)*6+(matched===8?6:0)+(tables.hall.find(h=>h.level===hall)?.bonusPct??0):0;}
 function pcHash(p){const averageNeglect=(2+(p.fanCare===false?0:1))*.05*3/24;return p.healthy*(1+(p.gpuShare??0)*WS[p.level??0])*(p.unknownBoost??1)*(1-Math.min(.5,(p.heatLoss??0)+averageNeglect));}
 function hash(state,tables){return E.islandHash(sum(state.pcs.filter(p=>p.on),pcHash),bonus(state.pcs,state.hall,tables),state.nft);}
 function workshop(level,gpuHash,q,risk='steady',factor=1){
  if(!Number.isInteger(level)||level<0||level>=20||!(gpuHash>0)||!(q>0))return null;
  const raw=risk==='gamble'?[[0,.5],[2,.5]]:risk==='wild'?[[-1,.2],[0,.1],[1,.4],[2,.25],[3,.05]]:[[1,1]],outcomes=raw.map(([delta,chance])=>({level:Math.max(0,Math.min(20,level+delta)),chance}));
  const change=sum(outcomes,p=>(WS[p.level]-WS[level])*p.chance);
  return {cost:q*gpuHash*(1+WS[level])*(level===0?.2:.25)*factor,minutes:TIMES[level],outcomes,bonusChange:change,minChange:Math.min(...outcomes.map(p=>WS[p.level]-WS[level])),maxChange:Math.max(...outcomes.map(p=>WS[p.level]-WS[level]))};
 }
 function jobCost(j,record,q,kind,own,now){return j?E.builder(kind,j.level,record,q,own,now,j)?.usd??null:null;}
 function flow(inventory,recipe,products){
  const rest=clone(inventory),purchased=[],reused=[],parts=[];let cost=0,gpuItem=null;
  for(const p of recipe){for(let count=0;count<(p.quantity||1);count++){
   const index=rest.findIndex(i=>i.catalog===p.id),item=index<0?null:rest.splice(index,1)[0];
   if(item)reused.push({...p,itemId:item.id});else{purchased.push({...p});cost+=p.usd;}
   if(p.kind==='gpu')gpuItem=item;parts.push(products.get(p.id));
  }}return {inventory:rest,purchased,reused,cost,gpuItem,parts};
 }
 function source(data,now){
  const settings=C.cleanSettings(data.settings),wallet=settings.wallet,s=data.games?.[wallet],m=I.compute(settings,s,data.chain,data.market,now,data.ledgers?.[wallet]);
  if(!s||!m.freshGame||!m.freshPrice||!m.chainFresh||!m.actionable||!s.construction?.hall?.length||!s.construction?.plots?.length||!s.construction?.power?.length||m.balance===null)return {error:'fresh-data'};
  if(s.running!==true)return {error:'mining-stopped'};
  const nft=E.nft(s);if(!nft.known)return {error:'unmodeled-boost'};
  const ledger=data.ledgers?.[wallet];if(!ledger?.complete||ledger.error||C.wallet(ledger.wallet)!==wallet||!Number.isFinite(ledger.at)||Math.abs(now-ledger.at)>300000)return {error:'ledger-sync'};const assets=L.assetSnapshot(m,ledger);if(assets.pendingBalance||assets.claimableGross===null)return {error:'ledger-sync'};
  if(s.builderQueueEnd>now&&(!(s.builderJobs||[]).length||(s.builderJobs||[]).some(j=>!Number.isFinite(j.endsAt)||!Number.isFinite(j.target))))return {error:'queue-incomplete'};
  const catalog=data.project?.catalog,live=!!catalog?.parts?.length,products=new Map(F.parts.map(p=>[p.id,p]));for(const p of catalog?.parts||[])products.set(p.id,p);
  const items=s.items||[],warnings=[],pcs=[];
  for(const p of s.pcs||[]){if(!p.ready)continue;const tower=new Set(Object.values(p.towerSlots||{}).flat()),selected=items.filter(i=>i.installedSetup===p.id&&!tower.has(i.id)&&products.has(i.catalog)),gpu=selected.find(i=>products.get(i.catalog).kind==='gpu'),partList=selected.map(i=>products.get(i.catalog));let b=build(partList,catalog?.curve??F.curve);
   const healthy=p.healthyHash;if(!(healthy>0)||!(p.watts>0))return {error:'parts-missing'};
   const partsHash=n(p.partsHash)??b?.partsHash,gpuHash=gpu?products.get(gpu.catalog).hash:null;
   const inferred=E.inferLevel({...p,partsHash,gpuLevel:E.pcLevel(s,p,n(gpu?.gpuLevel),now),overclockEnd:p.overclockEnd>now?p.overclockEnd:0},gpuHash);
   let level=inferred?.level??null,levelSource=inferred?.source??'unknown';
   const model={id:p.id,plot:p.plot,on:p.running,healthy,watts:p.watts,fanCare:b?.fanCare??E.fanCare(s,p,now),level:level??0,levelKnown:level!==null,levelSource,unknownBoost:level===null?Math.max(1,(p.hash??0)/Math.max(.5,1-((p.wearLossPct??0)+(p.thermalLossPct??0))/100)/healthy):1,gpuHash,gpuShare:partsHash>0&&gpuHash>0?gpuHash/partsHash:null,heatLoss:(p.thermalLossPct??0)/100,recipe:b?.recipe??[],gpuId:gpu?.id,installedItems:selected.map(i=>({id:i.id,catalog:i.catalog,gpuLevel:n(i.gpuLevel)??(i.id===gpu?.id?level:0)??0})),overclock:p.overclockEnd>now,upgradeEnd:n(gpu?.gpuUpgradeEnd)??n(p.gpuUpgradeEnd)};
   if(model.upgradeEnd>now)return {error:'workshop-pending'};if(model.overclock)warnings.push('overclock');if(!b)warnings.push('partial-parts');if(!model.levelKnown&&gpu)warnings.push('gpu-level');pcs.push(model);
  }
  if(pcs.some(p=>p.overclock))return {error:'overclock-active'};
  const inventory=items.filter(i=>!i.installedSetup&&products.has(i.catalog)).map(i=>({id:i.id,catalog:i.catalog,gpuLevel:n(i.gpuLevel)}));
  const access=I.claimAccess(m),tables=s.construction,record=Math.max(s.hashRecord??0,sum(pcs,p=>p.healthy));
  const stored=(s.storedPCs||[]).filter(p=>p.ready);if(stored.some(p=>!(p.healthyHash>0&&p.watts>0)))return {error:'stored-pcs-incomplete'};if(!s.storedPCsKnown)warnings.push('storage-unknown');if(C.units(s.miningHourlyWei)===null)warnings.push('mining-rate-estimate');
  const state={pcs,inventory,nft,stored:stored.map(p=>({healthy:p.healthyHash,watts:p.watts,level:0,gpuShare:0,unknownBoost:p.levelFactor??1,on:false})),hall:s.hall,plots:s.openPlots,power:s.powerLevel,capacity:s.gridCapacity,record,builderFree:Math.max(0,((s.builderQueueEnd??s.builderEnd??now)-now)/DAY),walletTokens:m.balance,unclaimed:Math.max(0,(m.claimable??0)-m.income.socialClaimableTokens),socialUnclaimed:m.income.socialClaimableTokens,energyKwh:s.energyKwh??(s.energyHours??0)*(s.watts??0)/1000,gasCostUSD:0,poolAdds:{},cost:0,steps:[],t:0,spentOps:0,earnedGross:0,taxPaid:0,stopped:false,pending:(s.builderJobs||[]).map(j=>({kind:j.kind,target:j.target,end:Math.max(0,(j.endsAt-now)/DAY)})).sort((a,b)=>a.end-b.end)};
  return {settings,wallet,s,m,tables,products,catalog,access,state,now,otherHash:Math.max(1,m.quote.totalHash-s.myHash),price:m.price,budget:m.budget,careFixed:m.p.careDailyUSD??n(s.operating?.careDailyUSD),careFixedDiscounted:m.p.careDailyUSD===null&&n(s.operating?.careDailyUSD)!==null&&s.operating?.careDailyDiscounted!==false,initialSaleFactor:E.sale(s,now).factor,careBaseline:m.income.beforeReferralDailyUSD,carePct:m.income.carePct,careSource:m.income.careSource,careMinimum:m.income.careMinimumUSD,referralFactor:C.units(s.miningHourlyWei)!==null&&m.income.beforeReferralDailyUSD>0?Math.min(1,C.units(s.miningHourlyWei)*24*m.price/m.income.beforeReferralDailyUSD):.95,referralDailyTokens:Math.max(0,m.dailyTokens-(C.units(s.miningHourlyWei)!==null?C.units(s.miningHourlyWei)*24:(m.income.beforeReferralDailyUSD??0)/m.price*.95)),energyPct:n(s.energyPricing?.ratePct)??5,claimDayTax:m.p.claimTaxPct??5,sellFee:m.p.sellFeePct,gasDaily:m.p.gasDailyUSD,reserveTokens:Math.max(0,access.requiredTokens-(access.observedStakeTokens??0)),warnings:[...new Set(warnings)],catalogSource:live?'live-catalog':'docs-verified-starter-subset',catalogAt:live?(catalog.partsSeenAt??catalog.seenAt):Date.parse(F.asOf+'T00:00:00Z'),curveEstimated:!catalog?.curve};
 }
 function economy(ctx,o,t,state=null){const sc=scenarios.find(s=>s.id===o.scenario),d=Math.max(0,Math.floor((ctx.now+t*DAY-(ctx.s.dayEnd??ctx.now+DAY))/DAY)+1),fraction=Math.min(1,t/o.days);let price=ctx.price*(1+(sc.price-1)*fraction);if(sc.id==='volatile')price=ctx.price*(1+.5*Math.sin(Math.PI*3*fraction));let addition=0;for(const [at,amount]of Object.entries(state?.poolAdds||{}))if(Number(at)<d)addition+=(ctx.s.rateBps/10000)*amount*(1-ctx.s.rateBps/10000)**(d-Number(at)-1);return {price,budget:ctx.budget*sc.budget**d+addition,dayIndex:d,others:ctx.otherHash*sc.others**t};}
 function earnings(ctx,o,state,t){
  const e=economy(ctx,o,t,state),h=hash(state,ctx.tables),total=e.others+h,q=e.budget*e.price/total,promo=E.sale(ctx.s,ctx.now+t*DAY),raw=h*q,gross=raw*ctx.referralFactor+(ctx.referralDailyTokens??0)*e.price;
  const owned=[...state.pcs,...(state.stored||[])],ownedWatts=sum(owned,p=>p.watts),runningWatts=sum(state.pcs.filter(p=>p.on),p=>p.watts),ownedHash=E.islandHash(sum(owned,p=>p.healthy*(1+(p.gpuShare??0)*WS[p.level??0])*(p.unknownBoost??1)),E.ownedBonus(owned,state.hall,ctx.tables),state.nft),energy=ownedWatts>0?q*ownedHash*ctx.energyPct/100*runningWatts/ownedWatts*promo.factor:0;
  const base=sum(state.pcs.filter(p=>p.on),pcHash),careWeight=base>0?sum(state.pcs.filter(p=>p.on),p=>pcHash(p)*(2+(p.fanCare===false?0:1))/3)/base:0;
  const care=h>0?(ctx.careFixed!==null?ctx.careFixed*(ctx.careBaseline>0?raw/ctx.careBaseline:1)*(ctx.careFixedDiscounted?promo.factor/Math.max(1e-9,ctx.initialSaleFactor):1):raw*ctx.carePct/100*careWeight*promo.factor):0;
  return {...e,h,total,q,raw,gross,energy,care,salePct:promo.pct,saleFactor:promo.factor,net:gross*(1-ctx.claimDayTax/100)*(1-ctx.sellFee/100)-energy-care-ctx.gasDaily};
 }
 function candidates(ctx,o,state,t){
  const rows=[],at=earnings(ctx,o,state,t),costFor=(j,record,kind)=>jobCost(j,record,at.q,kind,ctx.s,ctx.now+t*DAY),add=(a,next)=>{const after=earnings(ctx,o,next,t),gain=after.net-at.net,gainHash=after.h-at.h;if(gainHash<=0||gain<=0)return;
   a.deltaHash=gainHash;a.gainPct=gainHash/at.h*100;a.deltaNet=gain;a.paybackDays=a.cost/gain;a.netPerDollar=gain/a.cost*100;a.after=next;rows.push(a);};
  const hallJob=ctx.tables.hall.find(j=>j.level===state.hall+1);
  if(hallJob&&(hallJob.minPlots??0)<=state.plots&&costFor(hallJob,state.record,'hall')!==null){const next=clone(state);next.hall=hallJob.level;const delay=hallJob.minutes/1440;add({kind:'hall',label:'Hall '+hallJob.level,cost:costFor(hallJob,state.record,'hall'),duration:delay,steps:[{kind:'hall',level:hallJob.level,usd:costFor(hallJob,state.record,'hall'),minutes:hallJob.minutes}]},next);}
  for(let index=0;index<state.pcs.length;index++){
   const pc=state.pcs[index];if(!pc.on||!pc.levelKnown||!pc.gpuHash||pc.upgradeEnd>ctx.now+t*DAY)continue;const ws=workshop(pc.level,pc.gpuHash,at.q,'steady',at.saleFactor);if(!ws)continue;
   const next=clone(state);next.pcs[index].level++;add({kind:'workshop',label:'GPU · desk '+pc.plot+' · '+pc.level+' → '+(pc.level+1),cost:ws.cost,duration:ws.minutes/1440,pc:pc.plot,level:pc.level+1,steps:[{kind:'workshop',plot:pc.plot,level:pc.level+1,usd:ws.cost,minutes:ws.minutes}],risk: ['steady','gamble','wild'].map(r=>({mode:r,...workshop(pc.level,pc.gpuHash,at.q,r,at.saleFactor),islandExpectedGain:sum(workshop(pc.level,pc.gpuHash,at.q,r,at.saleFactor).outcomes,x=>{const trial=clone(state);trial.pcs[index].level=x.level;return (hash(trial,ctx.tables)-at.h)*x.chance;})}))},next);
  }
  // Independent cards can upgrade together; batch equal-level cards instead of serializing the whole island.
  const groups=new Map();for(let index=0;index<state.pcs.length;index++){const p=state.pcs[index];if(!p.on||!p.levelKnown||!p.gpuHash||p.level>=20||p.upgradeEnd>ctx.now+t*DAY)continue;const key=p.gpuHash+'|'+p.level;groups.set(key,[...(groups.get(key)||[]),index]);}
  for(const indices of groups.values()){if(indices.length<2)continue;const next=clone(state),steps=[];let cost=0,duration=0;
   for(const index of indices){const p=state.pcs[index],ws=workshop(p.level,p.gpuHash,at.q,'steady',at.saleFactor);cost+=ws.cost;duration=Math.max(duration,ws.minutes/1440);steps.push({kind:'workshop',plot:p.plot,level:p.level+1,usd:ws.cost,minutes:ws.minutes});next.pcs[index].level++;}
   const p=state.pcs[indices[0]];add({kind:'workshop-batch',label:indices.length+'× GPU · '+p.level+' → '+(p.level+1),cost,duration,steps},next);
  }
  // Small GPU replacement is an alternative, never a resale. Removed cards can seed another desk.
  for(let index=0;index<state.pcs.length;index++){
   const old=state.pcs[index];if(!old.on||!old.recipe?.length||!old.installedItems?.length||!old.recipe.some(p=>p.id==='gpu_hd_5770'))continue;
   const desired=old.recipe.flatMap(p=>Array(p.quantity||1).fill(ctx.products.get(p.kind==='gpu'?'gpu_gtx_560_ti':p.kind==='psu'?'psu_legacy_150':p.id)));if(desired.some(p=>!p))continue;
   const b=build(desired,ctx.catalog?.curve??F.curve);if(!b)continue;
   const f=flow([...state.inventory,...old.installedItems],b.recipe,ctx.products),next=clone(state),steps=[];let cost=f.cost*at.saleFactor,duration=0,valid=true;
   const reserved=sum(next.pcs,p=>p.watts)-old.watts+b.watts;
   while(reserved>next.capacity){const j=ctx.tables.power.find(j=>j.level===next.power+1);if(!j||costFor(j,next.record,'power')===null){valid=false;break;}const usd=costFor(j,next.record,'power');cost+=usd;duration+=j.minutes/1440;steps.push({kind:'power',level:j.level,usd,minutes:j.minutes});next.power++;next.capacity=j.capacityW;}
   if(!valid)continue;const cap=ctx.tables.hall.find(j=>j.level===next.hall)?.hashCap;if(cap!=null&&b.healthy>cap)continue;
   next.pcs[index]={...old,...b,level:f.gpuItem?.gpuLevel??0,unknownBoost:1,levelKnown:!f.gpuItem||n(f.gpuItem.gpuLevel)!==null,levelSource:f.gpuItem?(n(f.gpuItem.gpuLevel)!==null?'inventory':'inventory-unknown'):'new',gpuId:f.gpuItem?.id??null,installedItems:[]};next.inventory=f.inventory;next.record=Math.max(next.record,sum(next.pcs,p=>p.healthy));steps.push({kind:'parts',plot:old.plot,usd:f.cost*at.saleFactor,listUSD:f.cost,minutes:0});
   add({kind:'upgrade',label:'HD 5770 → GTZ 560 Ti · desk '+old.plot,cost,duration,steps,recipe:b.recipe,purchased:f.purchased,reused:f.reused,stored:f.inventory.filter(i=>old.installedItems.some(j=>i.id===j.id)).map(i=>({id:i.catalog,name:ctx.products.get(i.catalog).name})),watts:b.watts,healthy:b.healthy,freshC:b.freshC,care6hC:b.care6hC},next);
  }
  if(state.pcs.length>=o.maxPCs)return rows;
  const occupied=new Set(state.pcs.map(p=>p.plot)),open=Array.from({length:state.plots},(_,i)=>i+1).find(p=>!occupied.has(p)),target=open??state.plots+1;if(target>8)return rows;
  for(const r of ctx.recipePool??recipes(ctx.catalog,o.gpu)){
   const f=flow(state.inventory,r.recipe,ctx.products);if(f.parts.some(p=>!p))continue;const next=clone(state),steps=[];let cost=f.cost*at.saleFactor,duration=0,valid=true;
   if(target>next.plots){const pj=ctx.tables.plots.find(j=>j.level===target);if(!pj)continue;
    while(next.hall<(pj.minHall??1)){const hj=ctx.tables.hall.find(j=>j.level===next.hall+1);if(!hj||(hj.minPlots??0)>next.plots||costFor(hj,next.record,'hall')===null){valid=false;break;}const usd=costFor(hj,next.record,'hall');steps.push({kind:'hall',level:hj.level,usd,minutes:hj.minutes});cost+=usd;duration+=hj.minutes/1440;next.hall++;}
    if(!valid||costFor(pj,next.record,'plots')===null)continue;const usd=costFor(pj,next.record,'plots');steps.push({kind:'plots',level:target,usd,minutes:pj.minutes});cost+=usd;duration+=pj.minutes/1440;next.plots=target;
   }
   const reserved=sum(next.pcs,p=>p.watts)+r.watts;
   while(reserved>next.capacity){const j=ctx.tables.power.find(j=>j.level===next.power+1);if(!j||costFor(j,next.record,'power')===null||(j.minHall??1)>next.hall){valid=false;break;}const usd=costFor(j,next.record,'power');steps.push({kind:'power',level:j.level,usd,minutes:j.minutes});cost+=usd;duration+=j.minutes/1440;next.power++;next.capacity=j.capacityW;}
   if(!valid)continue;const cap=ctx.tables.hall.find(j=>j.level===next.hall)?.hashCap;if(cap!==null&&cap!==undefined&&r.healthy>cap)continue;
   const pc={...clone(r),id:'planned-'+target,plot:target,level:f.gpuItem?.gpuLevel??0,unknownBoost:1,levelKnown:!f.gpuItem||n(f.gpuItem.gpuLevel)!==null,levelSource:f.gpuItem?(n(f.gpuItem.gpuLevel)!==null?'inventory':'inventory-unknown'):'new',gpuId:f.gpuItem?.id??null};next.pcs.push(pc);next.inventory=f.inventory;next.record=Math.max(next.record,sum(next.pcs,p=>p.healthy));steps.push({kind:'parts',plot:target,usd:f.cost*at.saleFactor,listUSD:f.cost,minutes:0});
   add({kind:'build',label:r.name,cost,duration,plot:target,steps,recipe:r.recipe,purchased:f.purchased,reused:f.reused,stored:[],recipeUSD:r.usd,watts:r.watts,freshC:r.freshC,care6hC:r.care6hC,healthy:r.healthy},next);
  }
  return rows;
 }
 // Claims are conservatively batched at 25h; future social prizes never enter funding.
 function firstClaim(ctx){const o=ctx.s.operating||{},blocked=ctx.s.claimBlocked,reason=ctx.s.claimReason??'';
  if(blocked&&!/COOLDOWN|HOLD|BALANCE/.test(reason))return Infinity;
  const hold=ctx.access.serverEligible===false&&/HOLD|BALANCE/.test(reason)?12*HOUR:0;
  const last=n(ctx.m.income.lastClaimAt),low=last!==null?last+25*HOUR:ctx.now;
  return Math.max(0,(Math.max(ctx.now+hold,n(ctx.m.income.nextClaimAt)??ctx.now,low)-ctx.now)/DAY);
 }
 function replenish(state,ctx,o,t,paidTokens){const day=economy(ctx,o,t).dayIndex;state.poolAdds[day]=(state.poolAdds[day]||0)+paidTokens*.6;}
 function advance(ctx,o,input,to){
  const state=clone(input),step=1/96;state.nextClaim=state.nextClaim??firstClaim(ctx);
  while(state.t<to-1e-9){if(state.socialUnclaimed>0){state.walletTokens+=state.socialUnclaimed;state.socialUnclaimed=0;}let end=Math.min(to,state.t+step),dt=end-state.t,mid=(state.t+end)/2,e=earnings(ctx,o,state,mid);
   if(state.t+1e-9>=state.nextClaim&&state.walletTokens>=ctx.reserveTokens&&Number.isFinite(state.nextClaim)){
    const gross=state.unclaimed,taxed=gross*ctx.claimDayTax/100;state.walletTokens+=gross-taxed;state.taxPaid+=taxed*e.price;state.unclaimed=0;state.nextClaim=state.t+25/24;
   }
   // A full day of operating costs stays liquid before any proposed capital purchase.
   const watts=sum(state.pcs.filter(p=>p.on),p=>p.watts),needed=watts*24/1000*dt;let refill=0;
   if(state.energyKwh<needed){const refillKwh=watts*12/1000;refill=e.energy/2;if((state.walletTokens-ctx.reserveTokens)*e.price<refill+e.care*dt-1e-9){state.stopped=true;state.pcs.forEach(p=>p.on=false);state.t=to;return state;}state.energyKwh+=refillKwh;}
   const operating=refill+e.care*dt,costTokens=operating/e.price;
   if(state.walletTokens-ctx.reserveTokens<costTokens-1e-9){state.stopped=true;state.pcs.forEach(p=>p.on=false);state.t=to;return state;}
   state.energyKwh=Math.max(0,state.energyKwh-needed);state.walletTokens-=costTokens;replenish(state,ctx,o,mid,costTokens);state.spentOps+=operating;state.gasCostUSD+=ctx.gasDaily*dt;state.earnedGross+=e.gross*dt;state.unclaimed+=e.gross*dt/e.price;state.t=end;
   while(state.pending?.length&&state.pending[0].end<=state.t+1e-9){const j=state.pending.shift();if(j.kind==='island_level')state.hall=Math.max(state.hall,j.target);if(j.kind==='plot')state.plots=Math.max(state.plots,j.target);if(j.kind==='grid'){state.power=Math.max(state.power,j.target);state.capacity=ctx.tables.power.find(p=>p.level===state.power)?.capacityW??state.capacity;}}
  }return state;
 }
 function finish(ctx,o,state){const end=advance(ctx,o,state,o.days),e=earnings(ctx,o,end,o.days),claimUSD=(end.unclaimed*(1-ctx.claimDayTax/100)+(end.socialUnclaimed??0))*e.price,reserve=Math.min(end.walletTokens,ctx.reserveTokens)*e.price,exit=(end.walletTokens*e.price-reserve+claimUSD)*(1-ctx.sellFee/100)+reserve,startingReserve=Math.min(ctx.state.walletTokens,ctx.reserveTokens)*ctx.price,starting=(ctx.state.walletTokens*ctx.price-startingReserve+(ctx.state.unclaimed*(1-ctx.claimDayTax/100)+(ctx.state.socialUnclaimed??0))*ctx.price)*(1-ctx.sellFee/100)+startingReserve;
  return {state:end,valueUSD:exit-end.gasCostUSD,profitUSD:exit-starting-end.gasCostUSD,costUSD:end.cost,netDailyUSD:e.net,hash:e.h,bonusPct:bonus(end.pcs,end.hall,ctx.tables),stopped:end.stopped,steps:end.steps,remainingTokens:end.walletTokens,unclaimedTokens:end.unclaimed+(end.socialUnclaimed??0)};
 }
 function reprice(ctx,o,state,input){
  const a=clone(input),at=earnings(ctx,o,state,state.t),steps=[];
  for(const step of a.steps){let usd=step.usd;if(step.kind==='parts')usd=step.listUSD*at.saleFactor;
   else if(step.kind==='workshop'){const pc=state.pcs.find(p=>p.plot===step.plot),quote=pc&&workshop(pc.level,pc.gpuHash,at.q,'steady',at.saleFactor);if(!quote)return null;usd=quote.cost;}
   else{const row=ctx.tables[step.kind]?.find(j=>j.level===step.level);usd=jobCost(row,state.record,at.q,step.kind,ctx.s,ctx.now+state.t*DAY);if(usd===null)return null;}
   steps.push({...step,usd});
  }
  a.steps=steps;a.cost=sum(steps,s=>s.usd);const after=earnings(ctx,o,a.after,state.t);a.deltaNet=after.net-at.net;a.paybackDays=a.deltaNet>0?a.cost/a.deltaNet:null;a.netPerDollar=a.cost>0?a.deltaNet/a.cost*100:null;return a;
 }
 function execute(ctx,o,input,candidate){
  let state=clone(input),a=candidate,waited=0;
  while(state.t<o.days&&waited<=o.days){a=reprice(ctx,o,state,a);if(!a)return null;const e=earnings(ctx,o,state,state.t),reserve=(e.energy+e.care+ctx.gasDaily),funds=(state.walletTokens-ctx.reserveTokens)*e.price-reserve;
   if(funds>=a.cost-1e-7)break;const next=advance(ctx,o,state,Math.min(o.days,state.t+1/24));if(next.stopped)return null;state=next;waited+=1/24;

  }
  if(state.t>=o.days)return null;const start=state.t,e=earnings(ctx,o,state,start);state.walletTokens-=a.cost/e.price;replenish(state,ctx,o,start,a.cost/e.price);state.cost+=a.cost;
  const duration=a.duration+(a.kind.startsWith('workshop')?0:Math.max(0,state.builderFree-start));state=advance(ctx,o,state,Math.min(o.days,start+duration));if(state.stopped)return null;
  if(start+duration>o.days)return null;
  // State changes occur after construction; existing PCs continue earning while jobs run.
  const after=a.after;for(const k of ['pcs','inventory','hall','plots','power','capacity','record'])state[k]=clone(after[k]);if(!a.kind.startsWith('workshop'))state.builderFree=state.t;
  state.steps.push({kind:a.kind,label:a.label,startDay:start,endDay:state.t,costUSD:a.cost,paidCRH:a.cost/e.price,salePct:e.salePct,deltaHash:a.deltaHash,gainPct:a.gainPct,deltaNet:a.deltaNet,paybackDays:a.paybackDays,netPerDollar:a.netPerDollar,steps:a.steps,recipe:a.recipe??null,purchased:a.purchased??[],reused:a.reused??[],stored:a.stored??[],risk:a.risk??null,watts:a.watts??null,freshC:a.freshC??null,care6hC:a.care6hC??null});return state;
 }
 function plan(data,raw={},now=Date.now()){
  const o=options(raw),ctx=source(data,now);if(ctx.error)return {model:'mini-farm-1.11.0',error:ctx.error,options:o,plans:[]};
  ctx.recipePool=recipes(ctx.catalog,o.gpu);
  const searchStart=advance(ctx,o,ctx.state,Math.min(o.days,ctx.state.builderFree)),baseline=finish(ctx,o,ctx.state),initial=candidates(ctx,o,searchStart,searchStart.t).map(a=>({kind:a.kind,label:a.label,costUSD:a.cost,costCRH:a.cost/earnings(ctx,o,searchStart,searchStart.t).price,durationHours:a.duration*24,deltaHash:a.deltaHash,gainPct:a.gainPct,deltaNet:a.deltaNet,paybackDays:a.paybackDays,netPerDollar:a.netPerDollar,recipe:a.recipe??null,recipeUSD:a.recipeUSD??null,watts:a.watts??null,steps:a.steps,risk:a.risk??null,purchased:a.purchased??[],reused:a.reused??[],stored:a.stored??[]})).sort((a,b)=>a.paybackDays-b.paybackDays);
  // Bounded horizon-aware search. No action is kept unless it beats retaining CRH.
  let beam=[searchStart],solutions=[baseline],visited=new Set(),evaluated=0;
  for(let depth=0;depth<24;depth++){const expanded=[];
   for(const state of beam){const shortlist=candidates(ctx,o,state,state.t).sort((a,b)=>b.deltaNet*(o.days-state.t-b.duration)-b.cost-(a.deltaNet*(o.days-state.t-a.duration)-a.cost)).slice(0,10);
    for(const a of shortlist){const next=execute(ctx,o,state,a);evaluated++;if(!next)continue;const key=[Math.round(next.t*96),next.hall,next.plots,next.power,next.pcs.map(p=>[p.healthy,p.watts,p.level]).sort().join('|')].join(':');if(visited.has(key))continue;visited.add(key);
     const result=finish(ctx,o,next);result.incrementUSD=result.valueUSD-baseline.valueUSD;solutions.push(result);expanded.push({state:next,value:result.valueUSD});
    }
   }expanded.sort((a,b)=>b.value-a.value);beam=expanded.slice(0,4).map(x=>x.state);if(!beam.length)break;
  }
  // Give compact alternatives their own search budget so many similar new builds cannot hide them.
  for(const allowed of [['workshop','workshop-batch'],['hall'],['upgrade','workshop','workshop-batch','hall']]){let state=clone(searchStart),value=finish(ctx,o,state).valueUSD;for(let depth=0;depth<24;depth++){const rows=candidates(ctx,o,state,state.t).filter(a=>allowed.includes(a.kind)).sort((a,b)=>(b.deltaNet*(o.days-state.t-b.duration)-b.cost)-(a.deltaNet*(o.days-state.t-a.duration)-a.cost)).slice(0,6);let best=null;for(const a of rows){const next=execute(ctx,o,state,a);evaluated++;if(!next)continue;const end=finish(ctx,o,next);solutions.push(end);if(end.valueUSD>value+.01&&(!best||end.valueUSD>best.valueUSD))best={state:next,valueUSD:end.valueUSD};}if(!best)break;state=best.state;value=best.valueUSD;}}
  const distinct=[],signatures=new Set();for(const p of solutions.sort((a,b)=>b.valueUSD-a.valueUSD)){const family=p.steps.some(s=>s.kind==='build')?'expansion':p.steps.some(s=>s.kind==='upgrade')?'gpu-swap':p.steps.some(s=>s.kind.startsWith('workshop'))?'workshop':p.steps.length?'hall':'retain';if(signatures.has(family))continue;signatures.add(family);if(p.steps.length&&p.valueUSD<=baseline.valueUSD+.01)continue;p.routeType=family;distinct.push(p);if(distinct.length===3)break;}
  if(!distinct.some(p=>!p.steps.length))distinct.push(baseline);
  for(const p of distinct){p.incrementUSD=p.valueUSD-baseline.valueUSD;p.thinMargin=p.steps.length>0&&p.incrementUSD<Math.max(.5,p.costUSD*.05);p.roiPct=p.costUSD>0?p.incrementUSD/p.costUSD*100:null;delete p.state;}
  const careSensitivity=null;
  const current=earnings(ctx,o,ctx.state,0),result={model:'mini-farm-1.11.0',wallet:ctx.wallet,asOf:ctx.s.seenAt,computedAt:now,options:o,careSensitivity,scenario:scenarios.find(s=>s.id===o.scenario),catalogSource:ctx.catalogSource,catalogAt:ctx.catalogAt,curveEstimated:ctx.curveEstimated,carePct:ctx.carePct,careSource:ctx.careSource,energyPct:ctx.energyPct,sale:E.sale(ctx.s,now),referralDailyTokens:ctx.referralDailyTokens,nft:ctx.state.nft,claimTaxPct:ctx.claimDayTax,reserveTokens:ctx.reserveTokens,spendableUSD:Math.max(0,(ctx.state.walletTokens-ctx.reserveTokens)*ctx.price-current.energy-current.care-ctx.gasDaily),priceUSD:ctx.price,hashRecord:ctx.state.record,budgetCRH:ctx.budget,totalHash:ctx.m.quote.totalHash,current:{netDailyUSD:current.net,grossDailyUSD:current.gross,energyDailyUSD:current.energy,careDailyUSD:current.care,hash:current.h,observedHash:ctx.s.myHash,healthyHash:sum(ctx.state.pcs,p=>p.healthy),bonusPct:bonus(ctx.state.pcs,ctx.state.hall,ctx.tables),pcs:ctx.state.pcs.length,hall:ctx.state.hall,power:ctx.state.power,plots:ctx.state.plots,watts:sum(ctx.state.pcs,p=>p.watts),capacity:ctx.state.capacity},warnings:ctx.warnings,comparisons:initial.slice(0,24),plans:distinct,evaluated,assumptions:['care-every-6h','25h-claims','one-day-operating-reserve','no-social-income','no-resale','12h-energy-refills','energy-healthy-all-owned-5pct','no-care-or-workshop-usd-minimum','additive-nft-cap-500','native-gas-separate','own-pool-replenishment-next-day','parallel-equal-card-workshop-batches','bounded-search']};
  return result;
 }
 const api={REVISION:'mini-farm-1.11.0',options,scenarios,WS,TIMES,ORDER,build,recipes,multiplier,bonus,hash,workshop,flow,jobCost,source,economy,replenish,earnings,candidates,advance,reprice,execute,finish,plan};globalThis.CRHDevelopment=api;if(typeof module!=='undefined')module.exports=api;
})();
