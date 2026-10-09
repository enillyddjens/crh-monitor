/* Scenario comparison using observed game data. No spending or wallet calls. */
(() => {"use strict";
 const C=globalThis.CRHMonitor||(typeof require==='function'?require('./shared.js'):null),P=globalThis.CRHProject||(typeof require==='function'?require('./project.js'):null);
 const clamp=(v,lo,hi,def)=>Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):def;
 function options(raw={}){const S=globalThis.CRHScenarios||(typeof require==='function'?require('./scenarios.js'):null),preset=S.find(raw.scenario);return{scenario:preset?.id??null,launchAt:Number.isFinite(Number(raw.launchAt))&&Number(raw.launchAt)>0?Number(raw.launchAt):S.LAUNCH,mode:raw.mode==='reinvest'?'reinvest':'budget',includeWallet:raw.includeWallet!==false,goal:raw.goal==='hash'?'hash':'balance',reserveHours:clamp(raw.reserveHours,12,72,24),budget:clamp(raw.budget,0,1000000,100),days:preset?.days??clamp(raw.days,1,30,10),priceEndPct:clamp(raw.priceEndPct,-95,500,0),hashDailyPct:clamp(raw.hashDailyPct,-50,200,10),budgetDailyPct:clamp(raw.budgetDailyPct,-95,200,-10)};}
 function islandHash(pcs,hall,tables){const on=pcs.filter(p=>p.on),strong=Math.max(0,...on.map(p=>p.healthy)),matched=on.filter(p=>p.healthy>=5&&p.healthy>=strong/4).length;const hallBonus=tables.hall.find(h=>h.level===hall)?.bonusPct??0,bonus=matched>=2?(matched-1)*6+(matched===8?6:0)+hallBonus:0;return on.reduce((n,p)=>n+p.hash,0)*(1+bonus/100);}
 function jobPrice(job,record){return job.baseUSD!==null&&job.perHashUSD!==null?Math.ceil((job.baseUSD+record*job.perHashUSD)*100-1e-8)/100:null;}
 function componentFlow(inventory,oldParts,recipe,mode){
   const inv={...inventory},old={};for(const p of oldParts||[]){inv[p.id]=(inv[p.id]||0)+p.quantity;old[p.id]=(old[p.id]||0)+p.quantity;}
   const purchased=[],reused=[],stored=[];let cost=0;
   for(const p of recipe){const used=mode==='parts'?Math.min(inv[p.id]||0,p.quantity):0,missing=p.quantity-used;if(used){inv[p.id]-=used;reused.push({...p,quantity:used});}if(missing){purchased.push({...p,quantity:missing});cost+=missing*p.usd;}}
   for(const [id,n]of Object.entries(old)){const used=mode==='parts'?Math.min(n,reused.find(p=>p.id===id)?.quantity||0):0;if(n>used)stored.push({...oldParts.find(p=>p.id===id),quantity:n-used});}
   return{inventory:inv,purchasedParts:purchased,reusedParts:reused,storedParts:stored,partsCostUSD:cost};
 }
 function plan(data,rawOptions={},now=Date.now()){
   const o=options(rawOptions),settings=C.cleanSettings(data.settings),w=settings.wallet,s=data.games?.[w],m=C.compute(settings,s,data.chain,data.market,now),cat=P.validateCatalog(data.project?.catalog),tables=s?.construction;
   if(!m.freshGame||!m.freshPrice||!s?.rateConfirmed||!cat||now-cat.seenAt>3600000||!tables?.hall?.length||!tables?.plots?.length||!tables?.power?.length)return{error:'fresh-data',options:o,plans:[]};
   if(Object.entries(tables).some(([kind,list])=>list.some(j=>j.level>({power:s.powerLevel,plots:s.openPlots,hall:s.hall})[kind]&&(j.baseUSD===null||j.perHashUSD===null||j.minutes===null))))return{error:'fresh-data',options:o,plans:[]};
   const cards=cat.cards.filter(c=>c.watts>0&&c.careDaily!==null&&c.recipe.length),missing=cat.cards.length-cards.length;
   if(!cards.length)return{error:'catalog-detail',options:o,plans:[]};
   const products=new Map(cards.flatMap(c=>c.recipe.map(p=>[p.id,p]))),items=s.items||[],configured=C.position(settings);
   const pcs=(s.pcs||[]).filter(p=>p.ready).map(p=>{const activeIds=new Set(Object.values(p.slots||{}).flat()),towerIds=new Set(Object.values(p.towerSlots||{}).flat()),sealed=items.some(i=>activeIds.has(i.id)&&products.get(i.catalog)?.kind==='system'),installed=items.filter(i=>i.installedSetup===p.id&&!towerIds.has(i.id)&&(!activeIds.size||activeIds.has(i.id)||(!sealed&&['ram','fan'].includes(products.get(i.catalog)?.kind))));const parts=installed.filter(i=>products.has(i.catalog)).map(i=>({...products.get(i.catalog),quantity:1}));const factor=(1-(p.thermalLossPct??0)/100)*(1-(p.wearLossPct??0)/100);let care=P.careCost(parts,parts.reduce((n,i)=>n+i.usd,0));const counts=new Map();for(const x of parts)counts.set(x.id,(counts.get(x.id)||0)+x.quantity);const match=cards.find(c=>c.recipe.length&&c.recipe.every(x=>counts.get(x.id)===x.quantity)&&counts.size===c.recipe.length),healthy=p.healthyHash??(p.hash>0&&factor>0?p.hash/factor:match?.hash??0);if(match&&Math.abs(match.hash-healthy)<=.001)match.hash=healthy;return{id:p.id,name:p.id,healthy,observedHash:p.hash,hash:healthy*.925,watts:p.watts>0?p.watts:match?.watts??null,care:care??0,on:p.running,parts,knownCare:parts.length>0&&installed.every(i=>products.has(i.catalog))};});
   if(pcs.some(p=>!(p.healthy>0)||!(p.watts>0)))return{error:'fresh-data',options:o,plans:[]};
   if(pcs.some(p=>!p.knownCare)&&configured.careDailyUSD===null)return{error:'care-unknown',options:o,plans:[]};
   if(configured.careDailyUSD!==null&&pcs.length)for(const p of pcs)p.care=configured.careDailyUSD/pcs.length;
   const inventory={};for(const i of items)if(!i.installedSetup&&products.has(i.catalog))inventory[i.catalog]=(inventory[i.catalog]||0)+1;
   const wait=Math.max(0,((s.builderQueueEnd??now)-now)/86400000),hall=s.projectedHall??s.hall,plots=s.projectedPlots??s.openPlots;
   let power=s.powerLevel;for(const j of s.builderJobs||[])if(j.kind==='grid'&&j.target>power)power=j.target;
   const ledger=data.ledgers?.[w],gasRows=(ledger?.records||[]).filter(r=>r.type==='game'&&r.gasUSD>0),gasAction=gasRows.length?gasRows.reduce((n,r)=>n+r.gasUSD,0)/gasRows.length:0;
   const claimRows=(ledger?.records||[]).filter(r=>r.type==='reward'&&r.gasUSD>0),gasDaily=configured.gasDailyUSD||(claimRows.length?claimRows.reduce((n,r)=>n+r.gasUSD,0)/claimRows.length:0);
   const baselineHash=islandHash(pcs,hall,tables),currentHash=s.myHash,others=Math.max(0,s.totalHash-currentHash),budget=C.units(s.budgetWei),price=m.price,tariff=s.electricityUSD;
   if(!(budget>0)||!(s.totalHash>0)||!(tariff>=0))return{error:'fresh-data',options:o,plans:[]};
   const payout=currentHash>0&&m.dailyTokens!==null?Math.min(1,Math.max(0,m.dailyTokens/(budget*currentHash/s.totalHash))):1,fee=1-configured.sellFeePct/100;
   const S=globalThis.CRHScenarios||(typeof require==='function'?require('./scenarios.js'):null),scenario=S.compile(data,o,now);
  if(o.scenario&&!scenario)return{error:'fresh-data',options:o,plans:[]};
   const priceAt=t=>scenario?scenario.priceAt(t):price*Math.pow(1+o.priceEndPct/100,t/o.days),rewardsAt=t=>scenario?scenario.at(t).budgetCRH:budget*Math.pow(1+o.budgetDailyPct/100,t),externalAt=t=>scenario?scenario.externalAt(t):others*Math.pow(1+o.hashDailyPct/100,t);
   const income=(hash,t)=>rewardsAt(t)*hash/Math.max(1e-9,externalAt(t)+hash)*priceAt(t)*payout*fee;
   const costPerDay=pp=>pp.filter(p=>p.on).reduce((n,p)=>n+p.watts*24/1000*tariff+p.care,0);
   const baselineEnergy=pcs.filter(p=>p.on).reduce((n,p)=>n+p.watts*24/1000*tariff,0),baselineCare=pcs.filter(p=>p.on).reduce((n,p)=>n+p.care,0);
   const baselineCost=costPerDay(pcs),steps=Math.max(20,Math.ceil(o.days*8));
   function evaluate(st){
     let delta=0,energyTotal=0,careTotal=0;const segments=[{t:0,hash:baselineHash,cost:baselineCost,energy:baselineEnergy,care:baselineCare},...st.segments];
     for(let i=0;i<steps;i++){const t=(i+.5)*o.days/steps,seg=segments.findLast(e=>e.t<=t)||segments[0];delta+=(income(seg.hash,t)-income(baselineHash,t)-(seg.cost-baselineCost))*o.days/steps;energyTotal+=seg.energy*o.days/steps;careTotal+=seg.care*o.days/steps;}
     // Existing stock covers only electricity, not care. Cards contribute their included energy to the shared stock.
     const stock=(s.energyKwh??((s.energyHours??0)*(s.watts??0)/1000))*tariff+st.energyCredit;
     const actionGas=st.actions.filter(a=>!["off","on"].includes(a.type)).length*gasAction;
     const energyPaid=Math.max(0,energyTotal-stock)+careTotal,reserve=energyPaid+gasDaily*o.days+actionGas;
     const spend=st.capital+reserve;
     return{score:delta-st.capital-actionGas,spend,reserve,energyAndCare:energyPaid,hash:islandHash(st.pcs,st.hall,tables),watts:st.pcs.reduce((n,p)=>n+p.watts,0),runningWatts:st.pcs.filter(p=>p.on).reduce((n,p)=>n+p.watts,0)};
   }
   const record=Math.max(s.hashRecord??0,pcs.reduce((n,p)=>n+p.healthy,0));
   if(o.mode==='reinvest'){const R=globalThis.CRHReinvest||(typeof require==='function'?require('./reinvest-planner.js'):null);return R.plan({data,o,now,s,m,cards,tables,pcs,inventory,record,payout,baselineHash,islandHash,jobPrice,tariff,budget,others,configured,missing,cat,careCost:P.careCost,componentFlow});}
   const initial={pcs,hall,plots,power,t:Math.min(o.days,wait),capital:0,record,inventory,owned:Object.fromEntries((s.packageLimits||[]).map(l=>[l.id,l.owned??0])),actions:[],segments:[],energyCredit:0};
   let beam=[initial],best=[];const seen=new Set();
   function remember(st){const v=evaluate(st);if(v.spend>o.budget+1e-8)return null;const sig=JSON.stringify([st.pcs.map(p=>[p.name,p.on]).sort(),st.hall,st.plots,st.power,Math.round(st.t*1440),st.inventory]);if(seen.has(sig))return null;seen.add(sig);const out={...st,estimate:v};best.push(out);return out;}
   const zero=remember(initial);if(!zero)return{error:'operating-budget',required:evaluate(initial).spend,options:o,plans:[]};
   let examined=1;
   for(let depth=0;depth<18&&beam.length;depth++){
     if(scenario?.meta.liquidityFails)break;
     const next=[];
     const add=st=>{examined++;if(st.t>=o.days)return;st.segments=st.segments.concat({t:st.t,hash:islandHash(st.pcs,st.hall,tables),cost:costPerDay(st.pcs),energy:st.pcs.filter(p=>p.on).reduce((n,p)=>n+p.watts*24/1000*tariff,0),care:st.pcs.filter(p=>p.on).reduce((n,p)=>n+p.care,0)});const kept=remember(st);if(kept)next.push(kept);};
     for(const st of beam){
       for(const [kind,list,current]of [['hall',tables.hall,st.hall],['plot',tables.plots,st.plots],['power',tables.power,st.power]]){
         const j=list.find(l=>l.level===current+1),cost=j&&jobPrice(j,st.record);if(!j||cost===null||j.minutes===null||(j.minHall??1)>st.hall||(j.minPlots??1)>st.plots)continue;
         const ns={...st,pcs:st.pcs.slice(),actions:st.actions.concat({type:kind,level:j.level,usd:cost,atDay:st.t,readyDay:st.t+j.minutes/1440}),capital:st.capital+cost,t:st.t+j.minutes/1440};if(kind==='hall')ns.hall=j.level;else if(kind==='plot')ns.plots=j.level;else ns.power=j.level;add(ns);
       }
       for(let i=0;i<st.pcs.length;i++){const ns={...st,pcs:st.pcs.map((p,k)=>k===i?{...p,on:!p.on}:p),actions:st.actions.concat({type:st.pcs[i].on?'off':'on',name:st.pcs[i].name,usd:0,atDay:st.t,readyDay:st.t})};add(ns);}
       for(const c of cards){
         const cap=tables.hall.find(l=>l.level===st.hall)?.hashCap;if((cap!==null&&cap!==undefined&&c.hash>cap)||((cap===undefined)&&c.minHall>st.hall))continue;
         for(const mode of ['ready','parts']){
           if(mode==='ready'&&c.minHall>st.hall)continue;
           if(!st.pcs.length&&mode==='parts')continue;
           if(mode==='ready'&&c.limit!==null&&(!(c.id in st.owned)||st.owned[c.id]>=c.limit))continue;
           const replaceOptions=[...(st.pcs.length<st.plots?[-1]:[]),...st.pcs.map((_,i)=>i)];
           for(const replace of replaceOptions){
             if(replace>=0&&c.hash<=st.pcs[replace].healthy+.001&&c.watts>=st.pcs[replace].watts)continue;
             const pp=st.pcs.slice(),flow=componentFlow(st.inventory,replace>=0?pp[replace].parts:[],c.recipe,mode),inv=flow.inventory,cost=mode==='parts'?flow.partsCostUSD:c.usd;
             if(mode==='parts'&&c.recipe.some(p=>p.kind==='system')&&flow.purchasedParts.length)continue;
             const pc={id:'planned-'+st.actions.length,name:c.name+' / '+mode,healthy:c.hash,hash:c.hash*.925,watts:c.watts,care:mode==='parts'?P.careCost(c.recipe,c.partsUSD):c.careDaily,on:true,parts:c.recipe};if(replace>=0)pp[replace]=pc;else pp.push(pc);
             const watts=pp.reduce((n,p)=>n+p.watts,0),capacity=tables.power.find(l=>l.level===st.power)?.capacityW;if(capacity===null||capacity===undefined||watts>capacity)continue;
             const owned={...st.owned};if(mode==='ready')owned[c.id]=(owned[c.id]||0)+1;
             add({...st,pcs:pp,inventory:inv,owned,capital:st.capital+cost,record:Math.max(st.record,pp.reduce((n,p)=>n+p.healthy,0)),energyCredit:st.energyCredit+(mode==='ready'?c.watts*(c.includedHours??0)/1000*tariff:0),actions:st.actions.concat({type:'pc',mode,name:c.name,recipe:c.recipe,purchasedParts:flow.purchasedParts,reusedParts:flow.reusedParts,storedParts:flow.storedParts,replace:replace>=0?st.pcs[replace].name:null,usd:cost,atDay:st.t,readyDay:st.t})});
           }
         }
       }
     }
     next.sort((a,b)=>b.estimate.score-a.estimate.score);beam=next.slice(0,60);
     best.sort((a,b)=>b.estimate.score-a.estimate.score);best=best.slice(0,300);
   }
   best.sort((a,b)=>b.estimate.score-a.estimate.score);
   const selected=[],finalKeys=new Set();for(const st of best){const k=JSON.stringify([st.pcs.map(p=>[p.hash,p.healthy,p.watts,p.on]).sort(),st.hall,st.plots,st.power]);if(!finalKeys.has(k)){finalKeys.add(k);selected.push(st);}if(selected.length>=3)break;}
   return{asOf:s.seenAt,options:o,plans:selected,examined,missingCards:missing,waitDays:wait,baselineHash,payout,gasAction,catalogAt:cat.seenAt,model:'beam60-depth18',scenario:scenario?.meta??null,price,globalHash:s.totalHash};
 }
 const api={REVISION:'planner-1.6.3',options,islandHash,jobPrice,componentFlow,plan};globalThis.CRHPlanner=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
