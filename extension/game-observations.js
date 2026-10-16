/* Read visible, first-party game panels only. No clicks, requests, auth or arbitrary text storage. */
(() => {"use strict";
 const C=globalThis.CRHMonitor||(typeof require==='function'?require('./shared.js'):null);
 function panel(text,cards,now,snapshot){
  const match=text.match(/Maintenance costs\s+(\d+(?:\.\d+)?)% of each PC's daily earnings/i),pcs=[];
  for(const card of cards){const plot=Number(card.label?.match(/^PC (\d+),/)?.[1]),own=snapshot.pcs?.find(p=>p.plot===plot&&p.ready);if(!own)continue;
   const watts=Number(card.text.match(/(\d+(?:\.\d+)?)\s*W\s*[·/]/)?.[1]);if(!Number.isFinite(watts)||Math.abs(watts-own.watts)>.1)return null;
   const level=Number(card.text.match(/GPU\s+Lv\s*(\d+)/i)?.[1]);pcs.push({plot,fanCare:!/FANS\s*[—–]/i.test(card.text),gpuLevel:Number.isInteger(level)&&level<=20?level:null,gpuItem:own.slots?.gpu??null});
  }
  if(!pcs.length||pcs.length!==snapshot.pcs.filter(p=>p.ready).length)return null;
  const care=text.match(/Care all PCs\s+([\d,.]+)\s*CRH/i),stored=text.match(/Stored PCs \(not mining\)\s*(\d+)/i);return {wallet:snapshot.wallet,at:now,version:snapshot.version??null,carePct:match?Number(match[1]):null,careAt:match?now:null,careQuote:care?{at:now,tokens:Number(care[1].replace(/,/g,''))}:null,pcs,pcsAt:now,storedCount:stored?Number(stored[1]):null,energy:null};
 }
 function read(root,snapshot,previous,now=Date.now()){
  if(!root?.querySelectorAll||!snapshot?.wallet)return previous??null;
  const connected=root.querySelector('button[aria-label^="Connected wallet:"]')?.getAttribute('aria-label')?.match(/0x[0-9a-fA-F]{40}/)?.[0];
  if(C.wallet(connected)!==snapshot.wallet)return null;
  let facts=null;const dialog=root.querySelector('dialog.mypcs-window[open]');
  if(dialog)facts=panel(dialog.innerText,Array.from(dialog.querySelectorAll('article.mypcs-card')).map(e=>({label:e.getAttribute('aria-label'),text:e.innerText})),now,snapshot);
  const quote=Array.from(root.querySelectorAll('button[aria-label]')).find(e=>/^Add 24 hours for every powered PC:/.test(e.getAttribute('aria-label')??''));
  if(quote){const match=quote.getAttribute('aria-label').match(/:\s*([\d,.]+) kWh for ([\d,.]+) Tokens/);if(match){facts=facts??{wallet:snapshot.wallet,at:now,version:snapshot.version??null};facts.energy={at:now,watts:Number(match[1].replace(/,/g,''))/24*1000,dailyTokens:Number(match[2].replace(/,/g,''))};}}
  return C.mergeUI({...snapshot,uiFacts:facts},{uiFacts:previous},now).uiFacts;
 }
 const api={panel,read};globalThis.CRHGameObservations=api;if(typeof module!=='undefined')module.exports=api;
})();
