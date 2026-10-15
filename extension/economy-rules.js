/* Rules verified from official Docs on 2026-10-15. Server quotes remain authoritative. */
(() => {"use strict";
 const C=globalThis.CRHMonitor||(typeof require==='function'?require('./shared.js'):null);
 const REVISION='economy-20261015',WS=[0,.12,.19,.26,.33,.40,.47,.54,.61,.68,.75],TIERS={D:5,C:10,B:20,A:40,S:80};
 const n=C.number,sum=(a,f)=>a.reduce((s,p)=>s+f(p),0);
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
  const explicit=n(p.gpuLevel);if(Number.isInteger(explicit)&&explicit<=10)return {level:explicit,source:'game'};
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
  if(!own.running)return {dailyUSD:0,dailyCRH:0,source:'stopped',estimated:false};
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
  const dailyCRH=budget*healthy/totalHash*pct/100*runningWatts/ownedWatts;
  return {dailyUSD:dailyCRH*price,dailyCRH,source:'docs-healthy-owned-estimate',estimated:true,pct,healthyOwnedHash:healthy,ownedWatts,storageKnown:own.storedPCsKnown===true,legacyQuoteIgnored:n(own.electricityUSD)!==null&&!mode};
 }
 const api={REVISION,WS,TIERS,islandHash,nft,inferLevel,ownedBonus,energy};globalThis.CRHEconomy=api;if(typeof module!=='undefined')module.exports=api;
})();
