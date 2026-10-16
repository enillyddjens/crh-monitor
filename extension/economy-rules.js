/* Rules verified from official Docs on 2026-10-16. Server quotes remain authoritative. */
(() => {"use strict";
 const C=globalThis.CRHMonitor||(typeof require==='function'?require('./shared.js'):null);
 const REVISION='economy-20261016',WS=[0,.12,.19,.26,.33,.40,.47,.54,.61,.68,.75,.80,.85,.90,.95,1,1.05,1.10,1.15,1.20,1.25],TIERS={D:5,C:10,B:20,A:40,S:80};
 const n=C.number,sum=(a,f)=>a.reduce((s,p)=>s+f(p),0);
 // The fallback starts at the first verified live observation; no historical start is inferred.
 const SALE_START=Date.parse('2026-10-16T07:54:00Z'),SALE_END=Date.parse('2026-10-17T15:47:00Z');
 const BUILDER={plots:[null,{days:0,floor:0},{days:.25,floor:4},{days:.25,floor:15},{days:.35,floor:30},{days:.35,floor:60},{days:.5,floor:120},{days:.5,floor:250},{days:.75,floor:500}],hall:[null,{days:0,floor:0},{days:.5,floor:10},{days:.5,floor:30},{days:.25,floor:60},{days:.25,floor:100},{days:.25,floor:150},{days:.25,floor:250},{days:.25,floor:400},{days:.25,floor:600},{days:.25,floor:900},{days:.5,floor:1500}],power:[400,475,575,725,900,1125,1375,1675,2000,2375,2800,3250,3725,4250].map((floor,level)=>({days:level===0?0:level<=4?.1:level<=9?.2:.3,floor:level===0?0:([400,475,575,725,900,1125,1375,1675,2000,2375,2800,3250,3725])[level-1]}))};
 function sale(own,now=Date.now()){
  const a=own?.sale;if(a&&n(a.pct)!==null&&n(a.endsAt)!==null){const active=a.enabled!==false&&now>=(a.startsAt??0)&&now<a.endsAt;return {pct:active?a.pct:0,factor:active?1-a.pct/100:1,endsAt:a.endsAt,source:'game'};}
  const active=now>=SALE_START&&now<SALE_END;return {pct:active?25:0,factor:active?.75:1,endsAt:SALE_END,source:'verified-announcement'};
 }
 function builder(kind,level,record,qUSD,own,now=Date.now(),row=null){
  const rule=n(row?.priceDays)!==null&&n(row?.floorHash)!==null?{days:row.priceDays,floor:row.floorHash}:BUILDER[kind]?.[level];
  if(!rule||n(record)===null||!(qUSD>=0)||qUSD===null||!Number.isFinite(qUSD))return null;
  const basisHash=Math.max(record,rule.floor),promo=sale(own,now);return {usd:rule.days*basisHash*qUSD*promo.factor,days:rule.days,floorHash:rule.floor,basisHash,discountPct:promo.pct,source:row?.priceDays!=null?'game-rules':'docs-20261016'};
 }
 function freshUI(own,now=Date.now()){const a=own?.uiFacts;return a&&a.wallet===own.wallet&&a.version===(own.version??null)&&Number.isFinite(a.at)&&a.at<=now+5000&&now-a.at<3600000?a:null;}
 function careRate(own,now=Date.now()){const api=n(own?.operating?.carePct);if(api!==null)return {pct:api,source:'game-rate-estimate'};const a=freshUI(own,now),pct=a?.careAt<=now+5000&&now-a.careAt<3600000?n(a?.carePct):null;return pct!==null?{pct,source:'game-ui-rate-estimate',at:a.careAt}:{pct:10,source:'docs-default-estimate'};}
 function fanCare(own,pc,now=Date.now()){
  if(typeof pc.fanCare==='boolean')return pc.fanCare;
  if(pc.slots?.system)return true;
  const installed=(own?.items||[]).filter(x=>x.installedSetup===pc.id&&!Object.values(pc.towerSlots||{}).flat().includes(x.id));
  if(installed.length>=8)return installed.some(x=>/^(retro_fan_|fan_|case_fan_)/.test(x.catalog)||/^(fan|case_fan)/.test(x.installedSlot??''));
  const facts=freshUI(own,now),a=facts?.pcsAt<=now+5000&&now-facts.pcsAt<3600000?facts.pcs?.find(x=>x.plot===pc.plot):null;return typeof a?.fanCare==='boolean'?a.fanCare:null;
 }
 function pcLevel(own,pc,itemLevel,now=Date.now()){const facts=freshUI(own,now),u=facts?.pcsAt<=now+5000&&now-facts.pcsAt<3600000?facts.pcs?.find(x=>x.plot===pc.plot&&x.gpuItem===pc.slots?.gpu):null;return n(pc.gpuLevel)??n(u?.gpuLevel)??n(itemLevel);}
 function islandHash(base,bonusPct=0,nft={}){return base*(1+bonusPct/100)+Math.min(base,n(nft.capHash)??500)*(n(nft.boostPct)??0)/100;}
 function nft(own){
  const a=own?.nft||{},pct=a.active===false?0:n(a.boostPct)??TIERS[a.tier];
  if(pct!==undefined&&pct!==null)return {boostPct:pct,capHash:n(a.capHash)??500,source:'game',known:true,tier:a.tier??null};
  const pcs=(own?.pcs||[]).filter(p=>p.ready&&p.running),base=sum(pcs,p=>p.hash??0),expected=base*(1+(own?.bonusPct??0)/100);
  // Do not interpret an unexplained stake/other boost as an NFT tier.
  if(base>0&&n(own?.myHash)!==null&&Math.abs(own.myHash-expected)<=Math.max(.00001,expected*.005))return {boostPct:0,capHash:500,source:'observed-no-extra-boost',known:true,tier:null};
  return {boostPct:null,capHash:n(a.capHash)??500,source:'unknown',known:false,tier:null};
 }
 function inferLevel(p,gpuHash){
  const explicit=n(p.gpuLevel);if(Number.isInteger(explicit)&&explicit<=20)return {level:explicit,source:'game'};
  if(!(p.hash>0&&p.healthyHash>0&&p.partsHash>0&&gpuHash>0)||!(n(p.wearLossPct)!==null&&n(p.thermalLossPct)!==null)||p.overclockEnd>0||p.overclockWear>1)return null;
  const factor=p.hash/Math.max(.5,1-(p.wearLossPct+p.thermalLossPct)/100)/p.healthyHash;
  const matches=WS.map((v,level)=>({level,error:Math.abs(factor-(1+gpuHash/p.partsHash*v))})).filter(v=>v.error<.0025);
  return matches.length===1?{level:matches[0].level,source:'observed-level-inference'}:null;
 }
 function ownedBonus(pcs,hall,tables,fallback=0){
  if(n(hall)===null)return fallback;
  const strong=Math.max(0,...pcs.map(p=>p.healthyHash??p.healthy??0)),matched=Math.min(8,pcs.filter(p=>(p.healthyHash??p.healthy??0)>=5&&(p.healthyHash??p.healthy??0)>=strong/4).length);
  const hallBonus=tables?.hall?.find(h=>h.level===hall)?.bonusPct??([0,0,6,12,15,18,21,24,27,30,33,36])[hall]??0;
  return matched>=2?(matched-1)*6+(matched===8?6:0)+hallBonus:0;
 }
 function energy(own,budget,totalHash,price,now=Date.now()){
  if(!own)return {dailyUSD:null,dailyCRH:null,source:'missing',estimated:true};
  if(own.running===false)return {dailyUSD:0,dailyCRH:0,source:'stopped',estimated:false};
  const ui=freshUI(own,now),uq=ui?.energy;if(uq&&now-uq.at<90000&&Math.abs(uq.watts-(own.watts??0))<.1&&price!==null)return {dailyUSD:uq.dailyTokens*price,dailyCRH:uq.dailyTokens,source:'game-ui-token-quote',estimated:false,pct:5};
  const a=own.energyPricing||{},pct=n(a.ratePct)??5,mode=a.mode==='earnings-share',fresh=Number.isFinite(own.seenAt)&&Math.abs(now-own.seenAt)<120000;
  // Old $/kWh observations cannot be repriced as today's token-share quotes.
  const quoted=C.units(a.dailyWei);
  if(fresh&&mode&&quoted!==null&&price!==null)return {dailyUSD:quoted*price,dailyCRH:quoted,source:'game-token-quote',estimated:false,pct};
  if(fresh&&mode&&n(own.dailyEnergyUSD)!==null)return {dailyUSD:own.dailyEnergyUSD,dailyCRH:price>0?own.dailyEnergyUSD/price:null,source:'game-daily-quote',estimated:false,pct};
  const pcs=(own.pcs||[]).filter(p=>p.ready),stored=own.storedPCs||[],owned=[...pcs,...stored],runningWatts=own.watts??sum(pcs.filter(p=>p.running),p=>p.watts??0),ownedWatts=n(a.ownedWatts)??sum(owned,p=>p.watts??0);
  let healthy=n(a.ownedHash);
  const activeNFT=nft(own);
  if(healthy===null&&activeNFT.known&&owned.length&&owned.every(p=>p.healthyHash>0&&p.watts>0)){
   const restored=sum(owned,p=>{const observed=p.running&&p.hash>0&&n(p.thermalLossPct)!==null&&n(p.wearLossPct)!==null?p.hash/Math.max(.5,1-(p.thermalLossPct+p.wearLossPct)/100):null;
    const inferred=p.levelFactor??(p.gpuLevel===0?1:null);return observed??(inferred!==null?p.healthyHash*inferred:p.healthyHash);});
   healthy=islandHash(restored,ownedBonus(owned,own.hall,own.construction,own.bonusPct??0),activeNFT);
  }
  if(!(healthy!==null&&healthy>=0&&ownedWatts>0&&budget!==null&&totalHash>0&&price!==null))return {dailyUSD:null,dailyCRH:null,source:'healthy-basis-missing',estimated:true,pct};
  const promo=sale(own,now),dailyCRH=budget*healthy/totalHash*pct/100*runningWatts/ownedWatts*promo.factor;
  return {dailyUSD:dailyCRH*price,dailyCRH,source:'docs-healthy-owned-estimate',estimated:true,pct,healthyOwnedHash:healthy,ownedWatts,storageKnown:own.storedPCsKnown===true||(ui?.storedCount===0&&now-ui.pcsAt<3600000),discountPct:promo.pct,discountEndsAt:promo.endsAt,legacyQuoteIgnored:n(own.electricityUSD)!==null&&!mode};
 }
 const api={REVISION,WS,TIERS,SALE_START,SALE_END,BUILDER,sale,builder,freshUI,careRate,fanCare,pcLevel,islandHash,nft,inferLevel,ownedBonus,energy};globalThis.CRHEconomy=api;if(typeof module!=='undefined')module.exports=api;
})();
