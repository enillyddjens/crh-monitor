/* Public leaderboard and economy history. No wallet session data is retained. */
(() => {"use strict";
 const C=globalThis.CRHMonitor||(typeof require==='function'?require('./shared.js'):null);
 const ECON_INTERVAL=600000,BOARD_INTERVAL=3600000,DAY=86400000;
 const number=C.number,text=v=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,64):'';
 const id=v=>typeof v==='string'&&/^isl_[0-9a-f]{20}$/.test(v)?v:null;
 const time=v=>{if(typeof v==='string'&&!/^\d+(\.\d+)?$/.test(v)){const d=Date.parse(v);return Number.isFinite(d)?d:null;}const n=number(v);return n===null?null:n<1e12?n*1000:n;};
 function board(raw,hint='hash'){
  if(!raw||!Array.isArray(raw.rows)||!['hash','spend'].includes(raw.board??hint))return null;
  const rows=raw.rows.slice(0,100).map(r=>{if(!id(r?.island_id))return null;const current='owner' in r;return{id:r.island_id,owner:text(current?r.owner:r.name),name:text(current?r.name:r.island_name),rank:number(r.rank),hash:number(r.hashrate),spentTokens:number(r.spent_x),spentUSD:number(r.spent_usd_micro)===null?null:Number(r.spent_usd_micro)/1e6,hall:number(r.island_level),runningPCs:number(r.running_setups)};}).filter(Boolean);
  return {board:raw.board??hint,complete:raw.complete===true,seenAt:Date.now(),asOf:time(raw.as_of),stale:raw.stale===true,page:Math.max(1,number(raw.page)??1),query:text(raw.query),total:number(raw.total),ranked:number(raw.ranked??raw.total),rows};
 }
 function validateBoard(raw){
  if(!raw||!['hash','spend'].includes(raw.board)||!Array.isArray(raw.rows)||!number(raw.seenAt))return null;
  return{board:raw.board,complete:raw.complete===true,seenAt:number(raw.seenAt),asOf:number(raw.asOf),stale:raw.stale===true,page:Math.max(1,number(raw.page)??1),query:text(raw.query),total:number(raw.total),ranked:number(raw.ranked),rows:raw.rows.slice(0,100).filter(r=>id(r?.id)).map(r=>({id:r.id,owner:text(r.owner),name:text(r.name),rank:number(r.rank),hash:number(r.hash),spentTokens:number(r.spentTokens),spentUSD:number(r.spentUSD),hall:number(r.hall),runningPCs:number(r.runningPCs)}))};
 }
 function recipe(v){return Array.isArray(v)?v.slice(0,60).map(c=>{const p=c.product||c;return{id:text(p.id),name:text(p.name),kind:text(p.kind),usd:number(p.usd)??(number(p.price_usd_micro)===null?null:Number(p.price_usd_micro)/1e6),quantity:Math.max(1,Math.min(16,Math.floor(number(c.quantity)??1)))};}).filter(p=>p.id&&p.kind&&p.usd!==null):[];}
 function careCost(parts,pcValue){
   if(!parts.length)return null;let paste=0,fans=0,repairs=0;
   for(const p of parts){if(p.kind==='cpu')paste+=Math.max(.25,.002*p.usd)/2.4;if(p.kind==='gpu')paste+=Math.max(.25,.002*p.usd)/3.2;if(p.kind==='system')paste+=Math.max(.25,.002*p.usd)*(1/2.4+1/3.2);if(p.kind==='fan')fans+=p.quantity;if(p.kind!=='case')repairs+=Math.max(.1,.02*p.usd)*p.quantity/14;}
   return paste+(fans?Math.max(.2* fans,.0001*pcValue)/2:parts.some(p=>p.kind==='system')?Math.max(.2,.0001*pcValue)/2:0)+repairs;
 }
 function card(raw){const parts=recipe(raw.recipe);return{id:text(raw.id),name:text(raw.name),hash:number(raw.hash),usd:number(raw.usd),watts:number(raw.watts),minHall:number(raw.minHall),limit:number(raw.limit),includedHours:number(raw.includedHours),recipe:parts,partsUSD:parts.length?parts.reduce((n,p)=>n+p.usd*p.quantity,0):null,careDaily:careCost(parts,number(raw.usd)??0)};}
 function catalog(raw){
   if(!Array.isArray(raw?.packages))return null;
   const cards=raw.packages.slice(0,40).map(p=>card({id:p.id,name:p.name,hash:p.healthy_base_hashrate??p.hashrate,usd:number(p.card_total_usd_micro??p.price_usd_micro)===null?null:Number(p.card_total_usd_micro??p.price_usd_micro)/1e6,watts:p.watts??p.stats?.power_w,minHall:p.min_island_level,limit:p.island_limit,includedHours:p.included_energy_hours,recipe:p.components})).filter(p=>p.hash>0&&p.usd>0);
   return cards.length?{seenAt:Date.now(),cards}:null;
 }
 function validateCatalog(raw){if(!raw||!Array.isArray(raw.cards)||!number(raw.seenAt))return null;const cards=raw.cards.slice(0,40).map(card).filter(p=>p.hash>0&&p.usd>0);return cards.length?{seenAt:number(raw.seenAt),cards}:null;}
 const empty=()=>({version:1,economy:[],boards:{hash:[],spend:[]},latest:{},profiles:[],events:[],rules:{},catalog:null,errors:{}});
 function clean(raw){const p=empty();if(!raw||typeof raw!=='object')return p;p.economy=Array.isArray(raw.economy)?raw.economy.slice(-5000):[];for(const b of ['hash','spend']){p.boards[b]=Array.isArray(raw.boards?.[b])?raw.boards[b].slice(-336).map(s=>({...s,rows:(s.rows||[]).map(r=>Array.isArray(r)?[...r]:{...r})})):[];p.latest[b]=raw.latest?.[b]??null;}p.profiles=Array.isArray(raw.profiles)?raw.profiles.slice():[];p.events=Array.isArray(raw.events)?raw.events.slice(-150):[];p.rules=raw.rules&&typeof raw.rules==='object'?{...raw.rules}:{};p.catalog=raw.catalog??null;p.errors={...(raw.errors??{})};return p;}
 function compactProfiles(p){const used=new Set();for(const b of ['hash','spend'])for(const s of p.boards[b])for(const r of s.rows)if(Array.isArray(r))used.add(r[0]);const map=new Map(),profiles=[];for(const n of [...used].sort((a,b)=>a-b)){if(p.profiles[n]){map.set(n,profiles.length);profiles.push(p.profiles[n]);}}for(const b of ['hash','spend'])for(const s of p.boards[b])s.rows=s.rows.filter(r=>!Array.isArray(r)||map.has(r[0])).map(r=>Array.isArray(r)?[map.get(r[0]),...r.slice(1)]:r);p.profiles=profiles;}
 function prune(p,now){p.economy=p.economy.filter(e=>e.at>=now-30*DAY).slice(-5000);for(const b of ['hash','spend'])p.boards[b]=p.boards[b].filter(e=>e.seenAt>=now-14*DAY).slice(-336);p.events=p.events.filter(e=>e.at>=now-30*DAY).slice(-150);p.rules=Object.fromEntries(Object.entries(p.rules).slice(-32));compactProfiles(p);while(JSON.stringify({boards:p.boards,profiles:p.profiles}).length>3500000){const b=(p.boards.hash[0]?.seenAt??Infinity)<=(p.boards.spend[0]?.seenAt??Infinity)?'hash':'spend';if(!p.boards[b].length)break;p.boards[b].shift();compactProfiles(p);}return p;}
 function saveBoard(rawProject,input,priceUSD=null){const p=clean(rawProject),b=validateBoard(input);if(!b)return p;
  // Searches and partial pages are never presented as a complete top-100 snapshot.
  if(b.page!==1||b.query)return p;
  if(p.latest[b.board]?.seenAt>b.seenAt)return p;
  if(!b.complete&&p.latest[b.board]?.complete)return p;
  const current={...b,rows:b.rows.slice(0,100),priceUSD:number(priceUSD)};p.latest[b.board]=current;delete p.errors[b.board];
  if(!b.stale&&b.complete){const packed=packBoard(p,current),history=p.boards[b.board],last=history.at(-1),bucket=Math.floor(b.seenAt/BOARD_INTERVAL);if(last&&Math.floor(last.seenAt/BOARD_INTERVAL)===bucket)history[history.length-1]=packed;else history.push(packed);}
  return prune(p,b.seenAt);
 }
 function packBoard(p,b){const index=new Map(p.profiles.map((r,i)=>[r.id+'|'+r.owner+'|'+r.name,i]));const rows=b.rows.map(r=>{const k=r.id+'|'+r.owner+'|'+r.name;let n=index.get(k);if(n===undefined){n=p.profiles.length;p.profiles.push({id:r.id,owner:r.owner,name:r.name});index.set(k,n);}return[n,r.rank,r.hash,r.spentTokens,r.spentUSD,r.hall,r.runningPCs];});return{...b,rows};}
 function unpackBoard(p,b){return b?{...b,rows:(b.rows||[]).map(r=>Array.isArray(r)?{...p.profiles[r[0]],rank:r[1],hash:r[2],spentTokens:r[3],spentUSD:r[4],hall:r[5],runningPCs:r[6]}:r).filter(r=>id(r.id))}:null;}
 function ruleFields(s){return{revision:s.economyRevision??null,rateBps:number(s.rateBps),electricityUSD:number(s.electricityUSD),pendingRate:s.rateChange??null,construction:Object.fromEntries(Object.entries(s.construction||{}).map(([kind,rows])=>[kind,rows.map(j=>({level:j.level,minutes:j.minutes,baseUSD:j.baseUSD,perHashUSD:j.perHashUSD,minHall:j.minHall,minPlots:j.minPlots,bonusPct:j.bonusPct,hashCap:j.hashCap,capacityW:j.capacityW}))])),powerLevels:(s.powerLevels||[]).map(l=>({level:l.level,capacityW:l.capacityW,minutes:l.minutes}))};}
 function key(value){let h=2166136261;for(const c of JSON.stringify(value)){h=Math.imul(h^c.charCodeAt(0),16777619)}return (h>>>0).toString(16);}
 function saveEconomy(rawProject,s,chain=null){const p=clean(rawProject);if(!number(s?.seenAt)||number(s.totalHash)===null)return p;const last=p.economy.at(-1);if(last&&s.seenAt<=last.at)return p;
  const rules=ruleFields(s),rulesId=key(rules),budget=C.units(s.budgetWei),pool=C.units(s.poolWei);
  const point={at:s.seenAt,serverAt:number(s.serverNow),priceUSD:number(s.priceUSD),totalHash:number(s.totalHash),budgetCRH:budget,poolCRH:pool,poolAtStartCRH:budget!==null&&s.rateBps>0?budget/(s.rateBps/10000):null,rateBps:number(s.rateBps),dayEnd:number(s.dayEnd),rateConfirmed:s.rateConfirmed===true,priceQuotable:s.priceQuotable===true,vaultCRH:chain&&Math.abs(s.seenAt-chain.at)<120000?C.units(chain.vaultWei):null,rulesId};
  const changed=last&&last.rulesId!==rulesId;
  if(last&&s.seenAt-last.at<ECON_INTERVAL&&!changed&&point.budgetCRH===last.budgetCRH&&point.dayEnd===last.dayEnd)return p;
  p.rules[rulesId]=rules;
  if(changed)p.events.push({at:s.seenAt,type:'rules',before:last.rulesId,after:rulesId});
  if(last&&last.budgetCRH!==null&&budget!==null&&budget!==last.budgetCRH)p.events.push({at:s.seenAt,type:'budget',before:last.budgetCRH,after:budget});
  if(last&&last.totalHash>0&&Math.abs(point.totalHash/last.totalHash-1)>=.25)p.events.push({at:s.seenAt,type:'hash',before:last.totalHash,after:point.totalHash});
  if(last&&last.priceUSD>0&&point.priceUSD!==null&&Math.abs(point.priceUSD/last.priceUSD-1)>=.2)p.events.push({at:s.seenAt,type:'price',before:last.priceUSD,after:point.priceUSD});
  p.economy.push(point);return prune(p,s.seenAt);
 }
 function delta(points,field,hours=24,now=Date.now()){const valid=points.filter(e=>e.at<=now&&number(e[field])!==null),last=valid.at(-1);if(!last)return null;const start=last.at-hours*3600000;const first=valid.find(e=>e.at>=start)||last;const previous=valid.filter(e=>e.at<=start).at(-1);const baseline=previous&&start-previous.at<=2*ECON_INTERVAL?previous:first;return{current:last[field],before:baseline[field],pct:baseline[field]>0?(last[field]/baseline[field]-1)*100:null,start:baseline.at,end:last.at,fullWindow:!!previous&&start-previous.at<=2*ECON_INTERVAL};}
 function playerValue(row,price,cards=[]){const ratios=cards.filter(c=>c.hash>0&&c.usd>0).map(c=>c.usd/c.hash);return{spentUSD:number(row?.spentUSD),spentTokens:number(row?.spentTokens),tokenValueUSD:number(row?.spentTokens)!==null&&number(price)!==null?row.spentTokens*price:null,hardwareLow:row?.hash>0&&ratios.length?row.hash*Math.min(...ratios)/1.84:null,hardwareHigh:row?.hash>0&&ratios.length?row.hash*Math.max(...ratios)*2:null,ratioLow:ratios.length?Math.min(...ratios):null,ratioHigh:ratios.length?Math.max(...ratios):null};}
 const exportData=p=>({format:'crh-monitor-project-v1',exportedAt:new Date().toISOString(),project:clean(p)});
 function download(p){const url=URL.createObjectURL(new Blob([JSON.stringify(exportData(p),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='crh-project-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const api={ECON_INTERVAL,BOARD_INTERVAL,board,validateBoard,catalog,validateCatalog,careCost,empty,clean,saveBoard,saveEconomy,delta,playerValue,unpackBoard,exportData,download};globalThis.CRHProject=api;if(typeof module!=='undefined')module.exports=api;
})();
