/* Validated public DEX quotes, stored as observations, never as exact historical execution prices. */
(() => {
 "use strict";
 const C=globalThis.CRHMonitor||(typeof require==="function"?require("./shared.js"):null);
 const API="https://api.dexscreener.com/token-pairs/v1/robinhood/"+C.TOKEN;
 function quote(raw,at=Date.now()){
   if(!Array.isArray(raw)||!Number.isFinite(at))return null;
   const candidates=raw.slice(0,100).filter(p=>p?.chainId==="robinhood"&&C.wallet(p.baseToken?.address)===C.TOKEN.toLowerCase()&&
     typeof p.pairAddress==="string"&&/^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(p.pairAddress)&&
     Number(p.priceUsd)>0&&Number.isFinite(Number(p.priceUsd))&&Number(p.liquidity?.usd)>=1000);
   candidates.sort((a,b)=>Number(b.liquidity.usd)-Number(a.liquidity.usd));const p=candidates[0];
   return p?{at,priceUSD:Number(p.priceUsd),source:"dexscreener",token:C.TOKEN.toLowerCase(),chainId:"robinhood",pair:p.pairAddress.toLowerCase()}:null;
 }
 function append(history,sample,now=Date.now()){
   const rows=(Array.isArray(history)?history:[]).filter(s=>s.source==="dexscreener"&&s.token===C.TOKEN.toLowerCase()&&s.chainId==="robinhood"&&Number.isFinite(s.at)&&s.at>=now-30*86400000&&s.at<=now+5000&&s.priceUSD>0&&Number.isFinite(s.priceUSD));
   if(sample&&(!rows.length||sample.at-rows[rows.length-1].at>=30000))rows.push(sample);
   return rows.slice(-43200);
 }
 const api={API,quote,append};globalThis.CRHPrice=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
