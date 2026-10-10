/* Current operating income. No purchases, claims or speculative reinvestment. */
(() => {"use strict";
 const C=globalThis.CRHMonitor||(typeof require==='function'?require('./shared.js'):null),DAY=86400000;
 const validPct=v=>C.number(v)!==null&&v<=100?Number(v):null;
 function tax(m){
  const o=m.own?.operating||{},manual=m.p.claimTaxPct;
  if(validPct(manual)!==null)return {pct:manual,source:'manual',estimated:false,nextAt:null,nextPct:null};
  let pct=validPct(o.claimTaxPct),source='game';
  const net=C.units(o.netClaimableWei);
  if(pct===null&&m.claimable>0&&net!==null&&net<=m.claimable){pct=(1-net/m.claimable)*100;source='game-net-claim';}
  if(pct===null&&C.number(o.taxAgeHours)!==null){pct=o.taxAgeHours>=48?10:o.taxAgeHours>=24?5:0;source='game-age';}
  if(pct!==null)return {pct,source,estimated:false,nextAt:C.number(o.claimTaxNextAt),nextPct:validPct(o.claimTaxNextPct)};
  // Account-age fields are not assumed from the first payment. Missing tax is never treated as 0%.
  return {pct:10,source:'docs-maximum',estimated:true,nextAt:null,nextPct:null};
 }
 function analyze(m,now=Date.now()){
  const own=m.own,o=own?.operating||{},claimTax=tax(m),running=own?.running===true;
  let dayTax=claimTax.pct;
  if(claimTax.nextAt!==null&&claimTax.nextPct!==null){const part=Math.max(0,Math.min(1,(claimTax.nextAt-now)/DAY));dayTax=claimTax.pct*part+claimTax.nextPct*(1-part);}
  else if(claimTax.source==='game-age'){
    const age=o.taxAgeHours,boundaries=[24,48],segments=[0,...boundaries.filter(t=>t>age&&t<age+24).map(t=>t-age),24];
    dayTax=0;for(let i=1;i<segments.length;i++){const start=age+segments[i-1];dayTax+=(segments[i]-segments[i-1])/24*(start>=48?10:start>=24?5:0);}
  }
  const gross=m.grossDaily,energy=own?(running?m.energyDaily:0):null;
  const beforeReferral=own&&m.budget!==null&&m.quote?.totalHash>0&&own.myHash!==null&&m.price!==null?m.budget*own.myHash/m.quote.totalHash*m.price:null;
  const carePct=validPct(o.carePct)??10,careMinimum=C.number(o.careMinimumUSD)??.05;
  const pcs=(own?.pcs||[]).filter(p=>p.running&&p.ready&&p.hash>0),sumHash=pcs.reduce((s,p)=>s+p.hash,0);
  const wear=sumHash>0?pcs.reduce((s,p)=>{const hours=p.overclockEnd?Math.max(0,Math.min(24,(p.overclockEnd-now)/3600000)):24;return s+p.hash*(1+((C.number(p.overclockWear)??1)-1)*hours/24)},0)/sumHash:1;
  let care=null,careSource='docs-estimate';
  if(own&&!running){care=0;careSource='stopped';}
  else if(m.p.careDailyUSD!==null){care=m.p.careDailyUSD;careSource='manual';}
  else if(C.number(o.careDailyUSD)!==null){care=o.careDailyUSD;careSource='game-daily';}
  else if(beforeReferral!==null){care=Math.max(beforeReferral*carePct/100*(2+wear)/3,careMinimum*4);careSource=validPct(o.carePct)!==null?'game-rate-estimate':'docs-estimate';}
  const taxCost=gross!==null?gross*dayTax/100:null,received=gross!==null?gross-taxCost:null;
  const sellCost=received!==null?received*m.p.sellFeePct/100:null,gas=m.p.gasDailyUSD;
  const operating=energy!==null&&care!==null?energy+care:null;
  const net=received!==null&&operating!==null?received-sellCost-operating-gas:null;
  const currentNetClaim=C.units(o.netClaimableWei);
  const netClaimable=m.claimable!==null?(claimTax.source!=='manual'&&currentNetClaim!==null&&currentNetClaim<=m.claimable?currentNetClaim:m.claimable*(1-claimTax.pct/100)):null;
  const careNow=C.number(o.careNowUSD)??(C.units(o.careNowWei)!==null&&m.price!==null?C.units(o.careNowWei)*m.price:null);
  return {model:'earnings-care-20261010',asOf:own?.seenAt??null,priceUSD:m.price,priceAt:m.quote?.seenAt??null,personalHash:own?.myHash??null,totalHash:m.quote?.totalHash??null,budgetCRH:m.budget,dayEnd:own?.dayEnd??null,dailyCRH:m.dailyTokens,grossDailyUSD:gross,energyDailyUSD:energy,careDailyUSD:care,carePct,careSource,
    careEstimated:!['manual','game-daily','stopped'].includes(careSource),careCadenceHours:6,careMinimumUSD:careMinimum,careNowUSD:careNow,
    claimTaxPct:claimTax.pct,claimTaxDayPct:dayTax,claimTaxSource:claimTax.source,claimTaxEstimated:claimTax.estimated,claimTaxDailyUSD:taxCost,
    receivedDailyUSD:received,sellDailyUSD:sellCost,gasDailyUSD:gas,operatingDailyUSD:operating,netDailyUSD:net,netClaimable,
    beforeReferralDailyUSD:beforeReferral,wearFactor:wear,hasOverclock:pcs.some(p=>p.overclockEnd>now),running,
    poolChangeAt:own?.rateChange?.startsAt??null,poolNextRatePct:own?.rateChange?.rateBps!=null?own.rateChange.rateBps/100:null};
 }
 function compute(settings,game,chain,market,now=Date.now()){
  const m=C.compute(settings,game,chain,market,now),income=analyze(m,now),netDaily=income.netDailyUSD;
  const paybackDays=m.actionable&&m.remaining===0?0:m.actionable&&netDaily>0&&m.remaining!==null?m.remaining/netDaily:null;
  return {...m,income,netDaily,paybackDays,roi30:m.actionable&&m.basis>0&&netDaily!==null?netDaily*30/m.basis*100:null};
 }
 function capitalReturns(m,pnl){
  const sales=(pnl.rows||[]).filter(r=>r.type==='sell'&&C.number(r.totalUSD)!==null).reduce((sum,r)=>sum+r.totalUSD,0);
  const cashAfterGas=sales-(pnl.gas??0),known=!!pnl.ready&&!pnl.unresolvedGas;
  const assets=known&&pnl.claimIncluded&&C.number(pnl.walletValue)!==null&&C.number(pnl.claimValue)!==null?pnl.walletValue+pnl.claimValue:null;
  function basis(amount){
   if(!(amount>0))return {basisUSD:amount??null,remainingUSD:null,cashRecoveryPct:null,paybackDays:null,roiPct:null};
   const remaining=known?Math.max(0,amount-cashAfterGas):null;
   return {basisUSD:amount,remainingUSD:remaining,cashRecoveryPct:known?Math.max(0,cashAfterGas)/amount*100:null,
    paybackDays:known&&m.actionable?(remaining===0?0:m.netDaily>0?remaining/m.netDaily:null):null,
    roiPct:assets!==null?(assets+cashAfterGas-amount)/amount*100:null};
  }
  return {model:'cash-and-reinvestment-returns-v1',external:basis(pnl.initialInvestment),total:basis(pnl.totalInvestment),
    saleProceedsUSD:known?sales:null,recordedGasUSD:pnl.unresolvedGas?null:pnl.gas,cashAfterGasUSD:known?cashAfterGas:null,
    estimated:!!(m.income?.careEstimated||m.income?.claimTaxEstimated),asOf:m.own?.seenAt??null};
 }
 const api={analyze,compute,capitalReturns};globalThis.CRHIncome=api;if(typeof module!=='undefined')module.exports=api;
})();
