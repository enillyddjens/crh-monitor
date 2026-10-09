/* Local, read-only reinvestment simulation. Money is conserved in CRH and native gas in ETH. */
(()=>{'use strict';
 const C=globalThis.CRHMonitor||(typeof require==='function'?require('./shared.js'):null);
 const DAY=86400000,STEP=1/48,EPS=1e-8,WIDTH=20,DEPTH=24,LIMIT=18000;
 const ledgerApi=()=>globalThis.CRHLedger||(typeof require==='function'?require('./ledger.js'):null);
 function funding(data,now=Date.now(),includeWallet=true){
  const settings=C.cleanSettings(data.settings),w=settings.wallet,s=data.games?.[w],m=C.compute(settings,s,data.chain,data.market,now),ledger=data.ledgers?.[w],L=ledgerApi();
  if(!m.freshGame||!m.freshPrice||!s?.rateConfirmed||C.units(s.hourlyWei)===null||!(s.dayEnd>now)||s.dayEnd>now+DAY+180000||(s.dayEnd&&m.quote?.dayEnd&&s.dayEnd!==m.quote.dayEnd))return{error:'fresh-data'};
  if(!m.chainFresh||data.chain.at>now+5000)return{error:'funding-stale'};
  if(!ledger?.complete||ledger.error||ledger.status==='syncing'||ledger.wallet!==w||!Array.isArray(ledger.records)||now-ledger.at>180000||ledger.at>now+5000)return{error:'funding-sync'};
  let inventory=0n;try{for(const r of ledger.records){if(r.wallet!==w||C.wei(r.quantityWei)===null||![1,-1].includes(r.direction))return{error:'funding-sync'};inventory+=BigInt(r.quantityWei)*BigInt(r.direction);}}catch{return{error:'funding-sync'}}
  if(C.wei(data.chain.balanceWei)===null||inventory!==BigInt(data.chain.balanceWei))return{error:'funding-sync'};
  const claims=ledger.records.map(r=>L.effective(r,data.corrections?.[w]?.[r.id],data.orders?.[w]?.[r.orderId]));
  const claimable=L.claimableAt({records:claims},m.claimable,s.serverNow??s.seenAt);
  if(claimable===null)return{error:'funding-sync'};
  if(s.claimBlocked)return{error:'claim-blocked'};
  const wallet=includeWallet?m.balance:0,total=wallet+claimable;
  return{wallet,claimable,total,usd:total*m.price,price:m.price,hourly:C.units(s.hourlyWei),includeWallet,chainAt:data.chain.at,gameAt:s.seenAt,eth:C.units(data.chain.ethWei),ledgerAt:ledger.at};
 }
 function plan(ctx){
  const {data,o,now,s,m,cards,tables,pcs,inventory,record,payout,baselineHash,islandHash,jobPrice,tariff,budget,others,configured}=ctx;
  const funds=funding(data,now,o.includeWallet);if(funds.error)return{error:funds.error,options:o,plans:[]};
  const w=C.cleanSettings(data.settings).wallet,records=data.ledgers[w].records,mean=a=>a.length?a.reduce((n,v)=>n+v,0)/a.length:null;
  const actionFees=records.filter(r=>r.type==='game').map(r=>C.units(r.gasWei)).filter(n=>n>0),claimFees=records.filter(r=>r.type==='reward').map(r=>C.units(r.gasWei)).filter(n=>n>0);
  const nativeAction=mean(actionFees),nativeClaim=mean(claimFees)??nativeAction;
  const nativePrice=mean(records.slice(-40).filter(r=>r.gasUSD>0&&C.units(r.gasWei)>0).map(r=>r.gasUSD/C.units(r.gasWei)));
  if(!(nativeAction>0)||!(nativeClaim>0)||!(nativePrice>0)||funds.eth===null)return{error:'gas-data',options:o,plans:[]};
  const gasAction=nativeAction*1.25,gasClaim=nativeClaim*1.25;
  const steps=Math.ceil(o.days/STEP),firstReset=s.dayEnd>now?Math.min(1,(s.dayEnd-now)/DAY):1;
  const prices=[],rates=[],external=[];
  for(let i=0;i<=steps;i++){const t=Math.min(o.days,i*STEP),gameDays=t<firstReset-EPS?0:1+Math.floor(Math.max(0,t-firstReset+EPS));prices[i]=m.price*Math.pow(1+o.priceEndPct/100,t/o.days);rates[i]=budget*Math.pow(1+o.budgetDailyPct/100,gameDays);external[i]=others*Math.pow(1+o.hashDailyPct/100,t);}
  const priceAt=t=>prices[Math.min(steps,Math.round(t/STEP))],rateAt=(hash,t)=>{const i=Math.min(steps,Math.floor(t/STEP));return rates[i]*hash/Math.max(EPS,external[i]+hash)*payout;};
  const powerOf=st=>st.pcs.filter(p=>p.on).reduce((n,p)=>n+p.watts,0),careOf=st=>st.pcs.filter(p=>p.on).reduce((n,p)=>n+p.care,0),hashOf=st=>islandHash(st.pcs,st.hall,tables);
  const balance=st=>st.wallet+st.unclaimed;
  const careOps=st=>st.pcs.filter(p=>p.on).reduce((n,pc)=>n+pc.parts.reduce((v,p)=>v+(p.kind==='cpu'?1/2.4:p.kind==='gpu'?1/3.2:p.kind==='system'?1/2.4+1/3.2+.5:0)+(p.kind==='fan'?p.quantity/2:0)+(p.kind!=='case'?p.quantity/14:0),0),0);
  const clone=st=>({...st,pending:st.pending.slice(),pcs:st.pcs.slice(),inventory:{...st.inventory},owned:{...st.owned},actions:st.actions.slice(),trace:st.trace?st.trace.slice():null});
  function settle(st){const future=[];for(const j of st.pending){if(j.end<=st.t+EPS){if(j.kind==='hall')st.hall=Math.max(st.hall,j.target);else if(j.kind==='plot')st.plots=Math.max(st.plots,j.target);else if(j.kind==='power')st.power=Math.max(st.power,j.target);}else future.push(j);}st.pending=future;}
  function projected(st){const p={hall:st.hall,plots:st.plots,power:st.power};for(const j of st.pending)p[j.kind==='plot'?'plots':j.kind]=Math.max(p[j.kind==='plot'?'plots':j.kind],j.target);return p;}
  function quotePayment(st,usd,units=1){const tokens=usd/priceAt(st.t),claim=st.wallet+EPS<tokens;if(balance(st)+EPS<tokens)return null;const gas=usd>EPS?gasAction*units+(claim?gasClaim:0):0;if(st.eth+1e-14<gas)return null;return{tokens,claim,gas};}
  function pay(st,usd,bucket,units=1){if(usd<=EPS)return{tokens:0,claim:false,gas:0};const q=quotePayment(st,usd,units);if(!q)return null;if(q.claim){st.wallet+=st.unclaimed;st.unclaimed=0;st.claims++;}st.wallet=Math.max(0,st.wallet-q.tokens);st.eth=Math.max(0,st.eth-q.gas);st.gasETH+=q.gas;st.spentCRH+=q.tokens;if(bucket==='capital')st.capital+=usd;else st.operating+=usd;return q;}
  function reserveUSD(st){const watts=powerOf(st),energy=Math.max(0,watts*o.reserveHours/1000-st.energyKwh)*tariff;return energy+careOf(st)*o.reserveHours/24+st.careDue;}
  function point(st){return{day:st.t,availableCRH:balance(st),walletCRH:st.wallet,claimableCRH:st.unclaimed,priceUSD:priceAt(st.t),hash:hashOf(st),energyHours:powerOf(st)>0?st.energyKwh*1000/powerOf(st):null};}
  function advance(input,target,trace=false){
   const st=clone(input);target=Math.min(o.days,Math.max(st.t,target));if(trace&&!st.trace)st.trace=[point(st)];
   while(st.t<target-EPS){
    settle(st);const nextJob=st.pending.length?Math.min(...st.pending.map(j=>j.end)):Infinity;
    const end=Math.min(target,(Math.floor(st.t/STEP+EPS)+1)*STEP,nextJob,st.nextCare),dt=end-st.t;
    if(dt<=EPS){st.t=Math.min(target,st.t+EPS);settle(st);if(st.t>=st.nextCare-EPS)st.nextCare+=1;continue;}
    const watts=powerOf(st),load=watts*24/1000;
    // Refills are real 12-hour purchases. Stored energy and card energy are shared across PCs.
    if(load>0&&st.energyKwh<load*.25-EPS){const kwh=watts*12/1000,usd=Math.ceil(kwh*tariff*1e6-EPS)/1e6;if(pay(st,usd,'operating')){st.energyKwh+=kwh;st.refills++;}}
    const mining=load>0&&!st.careStopped?Math.min(dt,st.energyKwh/load):0;
    if(mining>0){const earned=rateAt(hashOf(st),st.t+mining/2)*mining;st.unclaimed+=earned;st.earnedCRH+=earned;st.energyKwh=Math.max(0,st.energyKwh-load*mining);st.careDue+=careOf(st)*mining;st.careGasUnits+=careOps(st)*mining;st.miningHours+=mining*24;}
    if(watts>0&&mining<dt-EPS){st.pausedHours+=(dt-mining)*24;if(st.pauseAt===null)st.pauseAt=st.t+mining;}
    st.t=end;settle(st);
    if(st.t>=st.nextCare-EPS){if(st.careDue>EPS){if(pay(st,st.careDue,'operating',Math.max(1,st.careGasUnits))){st.careDue=0;st.careGasUnits=0;}else{st.careStopped=true;st.careShortfallUSD=Math.max(st.careShortfallUSD,st.careDue);}}st.nextCare+=1;}
    if(trace&&(st.t>=target-EPS||Math.abs(st.t*24-Math.round(st.t*24))<EPS))st.trace.push(point(st));
   }
   return st;
  }
  function finish(input,trace=false){const st=advance(input,o.days,trace);if(st.careDue>EPS){if(pay(st,st.careDue,'operating',Math.max(1,st.careGasUnits))){st.careDue=0;st.careGasUnits=0;}else{st.careStopped=true;st.careShortfallUSD=Math.max(st.careShortfallUSD,st.careDue);}}if(trace){const last=point(st);if(st.trace.at(-1)?.day===st.t)st.trace[st.trace.length-1]=last;else st.trace.push(last);}const gasUSD=Math.max(st.gasETH*nativePrice,configured.gasDailyUSD*o.days),endTokens=balance(st),hash=hashOf(st),watts=powerOf(st),reserve=reserveUSD(st);return{state:st,estimate:{endTokens,endUSD:endTokens*priceAt(o.days),liquidUSD:endTokens*priceAt(o.days)*(1-configured.sellFeePct/100)-gasUSD,earnedCRH:st.earnedCRH,operating:st.operating,gasETH:st.gasETH,gasUSD,capital:st.capital,spend:st.capital+st.operating+gasUSD,reserve,hash,watts:st.pcs.reduce((n,p)=>n+p.watts,0),runningWatts:watts,energyHours:watts>0?st.energyKwh*1000/watts:null,miningHours:st.miningHours,pausedHours:st.pausedHours,pauseAt:st.pauseAt,careShortfallUSD:st.careShortfallUSD,claims:st.claims,refills:st.refills,safe:!st.careStopped&&st.pausedHours<EPS,score:0}};}
  const mapKind={island_level:'hall',plot:'plot',grid:'power'},pending=(s.builderJobs||[]).filter(j=>mapKind[j.kind]&&j.endsAt>now).map(j=>({kind:mapKind[j.kind],target:j.kind==='plot'?j.target+1:j.target,end:(j.endsAt-now)/DAY}));
  if(s.builderQueueEnd>now&&!pending.length)return{error:'queue-data',options:o,plans:[]};
  const initial={pcs:pcs.map(p=>({...p})),hall:s.hall,plots:s.openPlots,power:s.powerLevel,t:0,record,inventory:{...inventory},owned:Object.fromEntries((s.packageLimits||[]).map(l=>[l.id,l.owned??0])),pending,actions:[],wallet:funds.wallet,unclaimed:funds.claimable,eth:funds.eth,energyKwh:s.energyKwh??((s.energyHours??0)*(s.watts??powerOf({pcs}))/1000),capital:0,operating:0,gasETH:0,spentCRH:0,earnedCRH:0,claims:0,refills:0,careDue:0,careGasUnits:0,nextCare:1,careStopped:false,careShortfallUSD:0,miningHours:0,pausedHours:0,pauseAt:null,trace:null};
  settle(initial);const baseline=finish(initial);
  function describe(st,spec){
   if(['hall','plot','power'].includes(spec.kind)){const future=projected(st),key=spec.kind==='plot'?'plots':spec.kind,list=tables[spec.kind==='plot'?'plots':spec.kind];if(future[key]+1!==spec.target||st.pending.length>=6)return null;const j=list.find(l=>l.level===spec.target),usd=j&&jobPrice(j,st.record);if(!j||usd===null||j.minutes===null||(j.minHall??1)>future.hall||(j.minPlots??1)>future.plots)return null;const end=Math.max(st.t,...st.pending.map(j=>j.end))+j.minutes/1440;if(end>=o.days-EPS)return null;return{usd,readyDay:end,job:{kind:spec.kind,target:spec.target,end},type:spec.kind,level:spec.target};}
   if(spec.kind==='off'||spec.kind==='on'){const p=st.pcs[spec.index];if(!p||p.on===(spec.kind==='on'))return null;return{usd:0,readyDay:st.t,type:spec.kind,name:p.name,index:spec.index};}
   const c=cards.find(c=>c.id===spec.cardId);if(!c)return null;const cap=tables.hall.find(l=>l.level===st.hall)?.hashCap;
   if((cap!==null&&cap!==undefined&&c.hash>cap)||(cap===undefined&&c.minHall>st.hall)||(spec.mode==='ready'&&c.minHall>st.hall))return null;
   if(!st.pcs.length&&(spec.mode==='parts'||c.usd<25))return null;
   if(spec.mode==='ready'&&c.limit!==null&&(!(c.id in st.owned)||st.owned[c.id]>=c.limit))return null;
   const replace=spec.index;if(replace===-1&&st.pcs.length>=st.plots||replace>=st.pcs.length)return null;
   if(replace>=0&&c.hash<=st.pcs[replace].healthy&&c.watts>=st.pcs[replace].watts)return null;
   const inv={...st.inventory},pp=st.pcs.slice();if(replace>=0)for(const p of pp[replace].parts)inv[p.id]=(inv[p.id]||0)+p.quantity;
   let usd=c.usd;if(spec.mode==='parts'){usd=0;for(const p of c.recipe){const used=Math.min(inv[p.id]||0,p.quantity);inv[p.id]=(inv[p.id]||0)-used;usd+=(p.quantity-used)*p.usd;}}
   const pc={id:'planned-'+st.actions.length,name:c.name+' / '+spec.mode,healthy:c.hash,hash:c.hash*.925,watts:c.watts,care:spec.mode==='parts'?ctx.careCost(c.recipe,c.partsUSD):c.careDaily,on:true,parts:c.recipe};if(replace>=0)pp[replace]=pc;else pp.push(pc);
   const capacity=tables.power.find(l=>l.level===st.power)?.capacityW;if(capacity===null||capacity===undefined||pp.reduce((n,p)=>n+p.watts,0)>capacity)return null;
   return{usd,readyDay:st.t,type:'pc',mode:spec.mode,name:c.name,recipe:c.recipe,replace:replace>=0?st.pcs[replace].name:null,pcs:pp,inventory:inv,card:c,index:replace};
  }
  function execute(st,spec,details){const before=balance(st),payment=pay(st,details.usd,'capital');if(!payment)return null;
   if(details.job)st.pending.push(details.job);else if(spec.kind==='off'||spec.kind==='on')st.pcs=st.pcs.map((p,i)=>i===spec.index?{...p,on:spec.kind==='on'}:p);else{st.pcs=details.pcs;st.inventory=details.inventory;st.record=Math.max(st.record,st.pcs.reduce((n,p)=>n+p.healthy,0));if(spec.mode==='ready'){st.owned[details.card.id]=(st.owned[details.card.id]||0)+1;st.energyKwh+=details.card.watts*(details.card.includedHours??0)/1000;}}
   st.actions.push({type:details.type,level:details.level,mode:details.mode,name:details.name,recipe:details.recipe,replace:details.replace,usd:details.usd,atDay:st.t,readyDay:details.readyDay,priceUSD:priceAt(st.t),tokens:payment.tokens,fundsBeforeCRH:before,fundsAfterCRH:balance(st),reserveUSD:reserveUSD(st),spec:{...spec}});settle(st);return st;
  }
  function possible(st,spec){
   const future=projected(st);if(['hall','plot','power'].includes(spec.kind)){const list=tables[spec.kind==='plot'?'plots':spec.kind],j=list.find(l=>l.level===spec.target);return !!j&&(j.minHall??1)<=future.hall&&(j.minPlots??1)<=future.plots;}
   if(spec.kind==='off'||spec.kind==='on')return !!st.pcs[spec.index];
   const c=cards.find(c=>c.id===spec.cardId);if(!c)return false;const cap=tables.hall.find(l=>l.level===future.hall)?.hashCap;
   if((cap!==null&&cap!==undefined&&c.hash>cap)||(cap===undefined&&c.minHall>future.hall)||(spec.mode==='ready'&&c.minHall>future.hall))return false;
   if(spec.index===-1&&st.pcs.length>=future.plots)return false;const capacity=tables.power.find(l=>l.level===future.power)?.capacityW;
   return capacity!==null&&capacity!==undefined&&st.pcs.reduce((n,p)=>n+p.watts,0)-(spec.index>=0?st.pcs[spec.index]?.watts??0:0)+c.watts<=capacity;
  }
  function upperFunds(st){const maxHash=st.pcs.filter(p=>p.on).reduce((n,p)=>n+p.hash,0)*1.84,minOther=Math.min(external[0],external.at(-1)),maxBudget=Math.max(rates[0],rates.at(-1));return (balance(st)+maxBudget*maxHash/Math.max(EPS,minOther+maxHash)*payout*(o.days-st.t))*Math.max(prices[0],prices.at(-1));}
  function tryAction(input,spec,delay=0){if(!possible(input,spec))return null;const detail=describe(input,spec);if(detail?.usd>upperFunds(input)+EPS)return null;if(!['off','on'].includes(spec.kind)&&input.eth+1e-14<gasAction+gasClaim)return null;let st=advance(input,Math.min(o.days,input.t+delay));
   while(st.t<o.days-EPS&&!st.careStopped){const details=describe(st,spec);if(details){const after=clone(st);if(execute(after,spec,details)){// Reserve operating CRH now. Future rewards cannot pay an action retroactively.
      if((['off','on'].includes(spec.kind)||balance(after)*priceAt(after.t)+EPS>=reserveUSD(after))&&(['off','on'].includes(spec.kind)||after.eth+1e-14>=gasAction*(2+careOps(after)*o.reserveHours/24)+gasClaim))return after;
     }}const next=Math.min(o.days,(Math.floor(st.t/STEP+EPS)+1)*STEP,st.pending.length?Math.min(...st.pending.map(j=>j.end)):Infinity);st=advance(st,next>st.t+EPS?next:st.t+STEP);}
   return null;
  }
  function specs(st){const out=[],future=projected(st);for(const kind of ['plot','power','hall'])out.push({kind,target:future[kind==='plot'?'plots':kind]+1});for(let index=0;index<st.pcs.length;index++)out.push({kind:st.pcs[index].on?'off':'on',index});for(const c of cards)for(const mode of ['parts','ready']){if(mode==='ready'&&c.limit!==null&&(!(c.id in st.owned)||st.owned[c.id]>=c.limit))continue;for(const index of [...(st.pcs.length<8?[-1]:[]),...st.pcs.map((_,i)=>i)]){if(index>=0&&c.hash<=st.pcs[index].healthy&&c.watts>=st.pcs[index].watts)continue;out.push({kind:'pc',cardId:c.id,mode,index});}}return out;}
  function signature(st){return JSON.stringify([Math.round(st.t/STEP),st.pcs.map(p=>[p.name,p.on]),st.hall,st.plots,st.power,st.pending,Object.entries(st.inventory).sort(),Object.entries(st.owned).sort(),st.record]);}
  const resources=st=>({tokens:balance(st),wallet:st.wallet,energy:st.energyKwh,eth:st.eth,careDue:st.careDue,careGasUnits:st.careGasUnits});
  const dominates=(a,b)=>a.tokens+EPS>=b.tokens&&a.wallet+EPS>=b.wallet&&a.energy+EPS>=b.energy&&a.eth+1e-14>=b.eth&&a.careDue<=b.careDue+EPS&&a.careGasUnits<=b.careGasUnits+EPS;
  const seen=new Map([[signature(initial),[resources(initial)]]]),best=[{...baseline,finalState:baseline.state,state:initial}],keyFor=st=>JSON.stringify([st.pcs.map(p=>[p.healthy,p.watts,p.on]).sort(),st.hall,st.plots,st.power,st.pending.map(j=>[j.kind,j.target])]);
  let beam=[initial],examined=1,truncated=false;
  const rank=r=>o.goal==='hash'?(r.estimate.safe?r.estimate.hash:0)*1000000+r.estimate.liquidUSD:r.estimate.liquidUSD;
  for(let depth=0;depth<DEPTH&&beam.length;depth++){
   const next=[];
   outer:for(const st of beam)for(const spec of specs(st))for(const delay of (o.priceEndPct>0&&!['off','on'].includes(spec.kind)?[0,Math.min(1,o.days/3)]:[0])){
    if(examined>=LIMIT){truncated=true;break outer;}examined++;const ns=tryAction(st,spec,delay);if(!ns)continue;const sig=signature(ns),bank=resources(ns),frontier=seen.get(sig)||[];if(frontier.some(v=>dominates(v,bank)))continue;seen.set(sig,frontier.filter(v=>!dominates(bank,v)).concat(bank).slice(-8));const r=finish(ns);r.estimate.score=r.estimate.liquidUSD-baseline.estimate.liquidUSD;const entry={...r,finalState:r.state,state:ns};best.push(entry);next.push(entry);
   }
   next.sort((a,b)=>rank(b)-rank(a));const keys=new Set(),diverse=[];for(const r of next){const k=keyFor(r.state);if(!keys.has(k)){keys.add(k);diverse.push(r.state);}if(diverse.length>=WIDTH)break;}beam=diverse;
   best.sort((a,b)=>rank(b)-rank(a));best.splice(300);if(truncated)break;
  }
  best.sort((a,b)=>rank(b)-rank(a));const selected=[],endKeys=new Set();for(const r of best){if(r.state.actions.length&&(r.estimate.careShortfallUSD>EPS||r.estimate.pausedHours>EPS))continue;const k=keyFor(r.finalState||r.state);if(endKeys.has(k))continue;endKeys.add(k);let replay=clone(initial);replay.trace=[point(replay)];for(const a of r.state.actions){replay=advance(replay,a.atDay,true);const detail=describe(replay,a.spec);if(!detail||!execute(replay,a.spec,detail))throw Error('Reinvestment replay did not reconcile');replay.trace.push(point(replay));}const final=finish(replay,true);final.estimate.score=final.estimate.liquidUSD-baseline.estimate.liquidUSD;selected.push({...final.state,estimate:final.estimate});if(selected.length===3)break;}
  return{asOf:s.seenAt,computedAt:now,options:o,plans:selected,examined,missingCards:ctx.missing,waitDays:0,baselineHash:islandHash(pcs,s.hall,tables),payout,catalogAt:ctx.cat.seenAt,model:'reinvest-beam20-depth24-limit18000-step30m',price:m.price,endPrice:priceAt(o.days),globalHash:s.totalHash,funding:funds,baseline:baseline.estimate,truncated,gasPriceUSD:nativePrice,stepMinutes:30};
 }
 const api={funding,plan};globalThis.CRHReinvest=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();