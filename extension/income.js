/* Current operating income. No purchases, claims or speculative reinvestment. */
(() => {"use strict";
 const C=globalThis.CRHMonitor||(typeof require==='function'?require('./shared.js'):null),DAY=86400000;
 const E=globalThis.CRHEconomy||(typeof require==='function'?require('./economy-rules.js'):null);
 const validPct=v=>C.number(v)!==null&&v<=100?Number(v):null;
 const taxTier=count=>[5,10,20,40,80][Math.min(4,count)];
 function recordedClaims(m,ledger,now){
  if(!ledger?.complete||ledger.error||!C.wallet(m.own?.wallet)||C.wallet(ledger.wallet)!==C.wallet(m.own?.wallet)||C.number(ledger.at)===null||Math.abs(now-ledger.at)>180000)return null;
  const rows=[...new Map((ledger.records||[]).filter(r=>r.type==='reward'&&C.wallet(r.wallet)===C.wallet(ledger.wallet)&&Number.isFinite(r.at)&&r.at<=now+5000).map(r=>[r.id,r])).values()];
  // A vault Transfer does not distinguish mining, mixed, and tax-exempt Social-only claims.
  if(rows.some(r=>!['mining','mixed','social'].includes(r.rewardKind)))return null;
  const ordinary=rows.filter(r=>r.rewardKind!=='social');
  return {count:ordinary.filter(r=>r.at>now-DAY).length,lastAt:ordinary.length?Math.max(...ordinary.map(r=>r.at)):null};
 }
 function tax(m,now,ledger){
  const o=m.own?.operating||{},manual=m.p.claimTaxPct,history=recordedClaims(m,ledger,now);
  const count=(Number.isInteger(C.number(o.claims24h))?C.number(o.claims24h):null)??history?.count??null,lastAt=C.number(o.lastClaimAt)??history?.lastAt??null;
  if(validPct(manual)!==null)return {pct:manual,source:'manual',estimated:false,count,lastAt};
  let pct=validPct(o.claimTaxPct),source='game';const net=C.units(o.netClaimableWei),social=Math.min(m.claimable??0,C.units(o.socialClaimableWei)??0),taxable=Math.max(0,(m.claimable??0)-social);
  if(pct===null&&taxable>0&&net!==null&&net<=m.claimable&&net>=social){pct=(1-(net-social)/taxable)*100;source='game-net-claim';}
  if(pct===null&&count!==null){pct=taxTier(count);source=history&&C.number(o.claims24h)===null?'ledger-rolling-24h':'game-rolling-24h';}
  if(pct===null&&lastAt!==null&&now-lastAt>=DAY){pct=5;source='game-last-claim';}
  if(pct!==null)return {pct,source,estimated:false,count,lastAt};
  // Legacy account-age tiers are obsolete. Unknown current tax is valued at the documented maximum.
  return {pct:80,source:'docs-maximum',estimated:true,count,lastAt};
 }
 function analyze(m,now=Date.now(),ledger=null){
  const own=m.own,o=own?.operating||{},claimTax=tax(m,now,ledger),running=own?.running===true;
  const cadence=m.p.claimEveryHours,dayTax=claimTax.source==='manual'?claimTax.pct:taxTier(Math.max(0,Math.ceil(24/cadence)-1));
  const gross=m.grossDaily,energyQuote=E.energy(own,m.budget,m.quote?.totalHash,m.price,now),energy=energyQuote.dailyUSD;
  const beforeReferral=own&&m.budget!==null&&m.quote?.totalHash>0&&own.myHash!==null&&m.price!==null?m.budget*own.myHash/m.quote.totalHash*m.price:null;
  const careRate=E.careRate(own,now),carePct=careRate.pct,careMinimum=0,promo=E.sale(own,now);
  const pcs=(own?.pcs||[]).filter(p=>p.running&&p.ready&&p.hash>0),sumHash=pcs.reduce((s,p)=>s+p.hash,0);
  const wear=sumHash>0?pcs.reduce((s,p)=>{const hours=p.overclockEnd?Math.max(0,Math.min(24,(p.overclockEnd-now)/3600000)):24;return s+p.hash*(1+((C.number(p.overclockWear)??1)-1)*hours/24)},0)/sumHash:1;
  const careClockFactor=sumHash>0?pcs.reduce((sum,p)=>{const hours=p.overclockEnd?Math.max(0,Math.min(24,(p.overclockEnd-now)/3600000)):24,wear=1+((C.number(p.overclockWear)??1)-1)*hours/24,fan=E.fanCare(own,p,now);return sum+p.hash*(1+(fan===false?0:1)+wear)/3},0)/sumHash:1;
  let care=null,careSource='docs-estimate';
  if(own&&!running){care=0;careSource='stopped';}
  else if(m.p.careDailyUSD!==null){care=m.p.careDailyUSD;careSource='manual';}
  else if(C.number(o.careDailyUSD)!==null){care=o.careDailyUSD*(o.careDailyDiscounted===false?promo.factor:1);careSource='game-daily';}
  else if(beforeReferral!==null){care=beforeReferral*carePct/100*careClockFactor*promo.factor;careSource=careRate.source;}
  const taxCost=gross!==null?gross*dayTax/100:null,received=gross!==null?gross-taxCost:null;
  const sellCost=received!==null?received*m.p.sellFeePct/100:null,gas=m.p.gasDailyUSD;
  const operating=energy!==null&&care!==null?energy+care:null;
  const net=received!==null&&operating!==null?received-sellCost-operating-gas:null;
  const currentNetClaim=C.units(o.netClaimableWei),socialClaimable=Math.min(m.claimable??0,C.units(o.socialClaimableWei)??0);
  const netClaimable=m.claimable!==null?(claimTax.source!=='manual'&&currentNetClaim!==null&&currentNetClaim<=m.claimable?currentNetClaim:(m.claimable-socialClaimable)*(1-claimTax.pct/100)+socialClaimable):null;
  const uiCare=E.freshUI(own,now)?.careQuote,careNowServer=C.number(o.careNowUSD)??(C.units(o.careNowWei)!==null&&m.price!==null?C.units(o.careNowWei)*m.price:null),careNow=careNowServer??(uiCare&&now-uiCare.at<90000&&uiCare.at<=now+5000&&m.price!==null?uiCare.tokens*m.price:null);
  return {model:E.REVISION,asOf:own?.seenAt??null,priceUSD:m.price,priceAt:m.quote?.seenAt??null,personalHash:own?.myHash??null,totalHash:m.quote?.totalHash??null,budgetCRH:m.budget,dayEnd:own?.dayEnd??null,dailyCRH:m.dailyTokens,grossDailyUSD:gross,energyDailyUSD:energy,energyDailyCRH:energyQuote.dailyCRH,energySource:energyQuote.source,energyEstimated:energyQuote.estimated,energyPricing:energyQuote,nft:E.nft(own),careDailyUSD:care,carePct,careSource,careClockFactor,sale:promo,
    careEstimated:!['manual','game-daily','stopped'].includes(careSource),careCadenceHours:6,careMinimumUSD:careMinimum,careNowUSD:careNow,careNowEstimated:careNowServer===null&&careNow!==null,
    claimTaxPct:claimTax.pct,claimTaxDayPct:dayTax,claimTaxSource:claimTax.source,claimTaxEstimated:claimTax.estimated,claimTaxDailyUSD:taxCost,
    claimEveryHours:cadence,claimTaxDaySource:claimTax.source==='manual'?'manual':'cadence-assumption',claimTaxDayEstimated:claimTax.source!=='manual',claims24h:claimTax.count,lastClaimAt:claimTax.lastAt,
    nextClaimAt:C.number(o.nextClaimAt)??(claimTax.lastAt!==null?claimTax.lastAt+2*3600000:null),lowTaxAt:C.number(o.claimTaxNextPct)===5&&C.number(o.claimTaxNextAt)!==null?o.claimTaxNextAt:claimTax.lastAt!==null?claimTax.lastAt+DAY:null,
    receivedDailyUSD:received,sellDailyUSD:sellCost,gasDailyUSD:gas,operatingDailyUSD:operating,netDailyUSD:net,netClaimable,
    beforeReferralDailyUSD:beforeReferral,wearFactor:wear,socialClaimableTokens:socialClaimable,socialClaimableConfirmed:C.units(o.socialClaimableWei)!==null,hasOverclock:pcs.some(p=>p.overclockEnd>now),running,
    poolChangeAt:own?.rateChange?.startsAt??null,poolNextRatePct:own?.rateChange?.rateBps!=null?own.rateChange.rateBps/100:null};
 }
 function compute(settings,game,chain,market,now=Date.now(),ledger=null){
  const m=C.compute(settings,game,chain,market,now),income=analyze(m,now,ledger),netDaily=income.netDailyUSD;
  const paybackDays=m.actionable&&m.remaining===0?0:m.actionable&&netDaily>0&&m.remaining!==null?m.remaining/netDaily:null;
  return {...m,energyDaily:income.energyDailyUSD,income,netDaily,paybackDays,roi30:m.actionable&&m.basis>0&&netDaily!==null?netDaily*30/m.basis*100:null};
 }
 function careAdvice(m){
  const pcs=(m.own?.pcs||[]).filter(p=>p.running&&p.ready&&p.hash>0);
  if(!pcs.length||pcs.some(p=>C.number(p.wearLossPct)===null||C.number(p.thermalLossPct)===null))return {neglectPct:null,restoredHash:null,gainHash:null};
  const current=pcs.reduce((s,p)=>s+p.hash,0),restored=pcs.reduce((s,p)=>s+p.hash*Math.max(.5,1-p.thermalLossPct/100)/Math.max(.5,1-(p.thermalLossPct+p.wearLossPct)/100),0);
  const factor=restored/current,island=m.own.myHash,a=E.nft(m.own),restoredIsland=a.known?E.islandHash(restored,m.own.bonusPct??0,a):null;
  return {neglectPct:(1-1/factor)*100,restoredHash:restoredIsland,gainHash:island!==null&&restoredIsland!==null?restoredIsland-island:null,source:'observed-loss-estimate'};
 }
 function claimAccess(m,pnl={}){
  const o=m.own?.operating||{},required=C.units(o.claimHoldRequiredWei)??25000,stake=C.units(o.claimStakeWei),average=C.units(o.claimHoldAverageWei);
  const walletNeed=Math.max(0,required-(stake??0)),reserve=m.balance!==null?Math.min(walletNeed,m.balance):null;
  return {requiredTokens:required,windowHours:12,serverEligible:typeof o.claimEligible==='boolean'?o.claimEligible:null,blocked:m.own?.claimBlocked===true,reason:m.own?.claimReason??null,
    observedAverageTokens:average,observedStakeTokens:stake,walletReserveTokens:reserve,aboveReserveTokens:m.balance!==null?Math.max(0,m.balance-walletNeed):null,
    requiredValueUSD:m.price!==null?required*m.price:null,averageBuyUSD:pnl.averageBuy??null,requiredAtAverageBuyUSD:pnl.averageBuy>0?required*pnl.averageBuy:null,
    nextClaimAt:m.income?.nextClaimAt??null,lowTaxAt:m.income?.lowTaxAt??null,reserveSource:stake===null?'wallet-floor-estimate':'observed-stake'};
 }
 function capitalReturns(m,pnl){
  const sales=(pnl.rows||[]).filter(r=>r.type==='sell'&&C.number(r.totalUSD)!==null).reduce((sum,r)=>sum+r.totalUSD,0);
  const cashAfterGas=sales-(pnl.gas??0),known=!!pnl.ready&&!pnl.unresolvedGas;
  const assets=known&&pnl.claimIncluded&&C.number(pnl.walletValue)!==null&&C.number(pnl.claimValue)!==null?pnl.walletValue+pnl.claimValue:null;
  function basis(amount){
   if(!(amount>0))return {basisUSD:amount??null,remainingUSD:null,cashRecoveryPct:null,paybackDays:null,roiPct:null};
   const remaining=known?Math.max(0,amount-cashAfterGas):null;
   return {basisUSD:amount,remainingUSD:remaining,cashRecoveryPct:known?Math.max(0,cashAfterGas)/amount*100:null,
    paybackDays:known&&m.actionable?(remaining===0?0:!m.own?.claimBlocked&&m.netDaily>0?remaining/m.netDaily:null):null,
    roiPct:assets!==null?(assets+cashAfterGas-amount)/amount*100:null};
  }
  return {model:'cash-and-reinvestment-returns-v1',external:basis(pnl.initialInvestment),total:basis(pnl.totalInvestment),
    saleProceedsUSD:known?sales:null,recordedGasUSD:pnl.unresolvedGas?null:pnl.gas,cashAfterGasUSD:known?cashAfterGas:null,
    estimated:!!(m.income?.energyEstimated||m.income?.careEstimated||m.income?.claimTaxDayEstimated),asOf:m.own?.seenAt??null};
 }
 const api={analyze,compute,capitalReturns,careAdvice,claimAccess};globalThis.CRHIncome=api;if(typeof module!=='undefined')module.exports=api;
})();
