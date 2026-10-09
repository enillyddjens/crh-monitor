/* Conditional stress paths, not probability-weighted predictions. Only observed rules are facts. */
(()=>{'use strict';
 const C=globalThis.CRHMonitor||(typeof require==='function'?require('./shared.js'):null),P=globalThis.CRHProject||(typeof require==='function'?require('./project.js'):null);
 const DAY=86400000,STEP=1/48,LAUNCH=Date.parse('2026-10-09T16:00:00Z');
 const presets=[
  {id:'death',days:3,held:.9,bonus:1.3,mix:['seed','sprout','sapling'],users:1.05,exitDay:2.5,price:[[0,1],[.25,.85],[1,.35],[2,.08],[3,.01]],hash:[[0,1],[.25,1.05],[1,.85],[2,.4],[3,.1]]},
  {id:'slow',days:5,held:.5,bonus:1.35,mix:['seed','sprout','sapling'],users:1.3,price:[[0,1],[1,1.05],[2,.95],[3,1.1],[5,1.1]],hash:[[0,1],[1,1.1],[3,1.3],[5,1.5]]},
  {id:'launch',days:7,held:.8,bonus:1.45,mix:['seed','sprout','sapling'],users:3,launch:true,price:[[0,1],[.125,1.2],[1,.85],[3,.8],[7,.7]],hash:[[0,1],[.125,2],[1,4],[3,5.5],[7,6]]},
  {id:'hype',days:10,held:.35,bonus:1.5,mix:['fern','grove','cedar'],users:8,launch:true,price:[[0,1],[.125,1.8],[1,.9],[2,2.1],[3,1.1],[4,2.4],[5,1.2],[7,1.8],[10,1]],hash:[[0,1],[.125,2.2],[1,4],[3,10],[5,14],[10,18]]}
 ];
 const find=id=>presets.find(p=>p.id===id)||null;
 const interpolate=(points,t)=>{if(t<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(t<=b[0])return a[1]+(b[1]-a[1])*(t-a[0])/(b[0]-a[0]);}return points.at(-1)[1];};
 function knownInflows(data,s,now){
  const p=P.clean(data.project),start=s.dayEnd-DAY,boards=p.boards.spend.filter(b=>b.board==='spend'&&b.complete&&!b.stale&&!b.query&&b.page===1&&(b.asOf??b.seenAt)>=start&&(b.asOf??b.seenAt)<=now&&now-b.seenAt<=DAY).sort((a,b)=>(a.asOf??a.seenAt)-(b.asOf??b.seenAt));
  // A monotone top-100 token-spend sum supplies a lower bound on purchases between snapshots.
  const sum=b=>{const rows=P.unpackBoard(p,b)?.rows||[];return rows.length===Math.min(100,b.ranked??b.total)&&rows.every(r=>r.spentTokens!==null&&r.spentTokens>=0)?rows.reduce((n,r)=>n+r.spentTokens,0):null;};
  const first=boards[0],last=boards.at(-1),a=first&&sum(first),b=last&&sum(last);return{tokens:a!==null&&b!==null&&a!==undefined&&b!==undefined?Math.max(0,b-a):0,from:first?.asOf??null,to:last?.asOf??null};
 }
 function compile(data,o,now=Date.now()){
  const preset=find(o.scenario);if(!preset)return null;
  const settings=C.cleanSettings(data.settings),s=data.games?.[settings.wallet],m=C.compute(settings,s,data.chain,data.market,now),cat=P.validateCatalog(data.project?.catalog);if(!s||!(m.price>0)||!(s.totalHash>0)||!(C.units(s.budgetWei)>0)||!(s.rateBps>0))return null;
  const days=preset.days,launchAt=Number.isFinite(o.launchAt)?o.launchAt:LAUNCH,launchDay=Math.max(0,(launchAt-now)/DAY),shift=preset.launch?(launchAt-now)/DAY:0;
  const trajectory=key=>{const points=preset[key].map(([day,value])=>[day+shift,value]);if(shift>0){const pre=key==='hash'?(preset.id==='hype'?1.3:1.15):(preset.id==='hype'?1.1:1);for(const p of points)p[1]*=pre;points.unshift([0,1]);}const scale=interpolate(points,0);return [[0,1],...points.filter(([t])=>t>0).map(([t,v])=>[t,v/scale])];};
  const pricePoints=trajectory('price'),hashPoints=trajectory('hash'),end=days;
  const priceAt=t=>m.price*interpolate(pricePoints,Math.max(0,Math.min(end,t))),other=s.totalHash-(s.myHash??0),externalAt=t=>Math.max(0,other)*interpolate(hashPoints,Math.max(0,Math.min(end,t)));
  const cards=(cat?.cards||[]).filter(c=>preset.mix.includes(c.id)),median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null;};
  const usdPerHash=(median(cards.map(c=>Math.min(c.usd,c.partsUSD??c.usd)/c.hash))??3.4)*1.12/preset.bonus;
  const opexPerHash=(median(cards.map(c=>(c.watts*24/1000*(s.electricityUSD??.55)+(c.careDaily??0))/c.hash))??.1)/preset.bonus;
  const flow=knownInflows(data,s,now),budget=C.units(s.budgetWei),poolAtStart=budget/(s.rateBps/10000),released=C.units(s.releasedWei)??budget*(1-(s.dayEnd-now)/DAY),actualPool=C.units(s.poolWei),startPool=Math.max(0,actualPool??poolAtStart-released),pendingKnown=actualPool===null?flow.tokens*.6:0;
  const firstReset=(s.dayEnd-now)/DAY,resets=[];for(let t=firstReset;t<=end+1e-9;t+=1)if(t>0)resets.push(t);
  const rateAt=t=>s.rateChange?.rateBps>0&&s.rateChange.startsAt<=now+t*DAY?s.rateChange.rateBps/10000:s.rateBps/10000;
  const knots=new Set([0,end,...resets]);for(let t=STEP;t<end;t+=STEP)knots.add(t);for(const [t]of [...pricePoints,...hashPoints])if(t>0&&t<end)knots.add(t);
  const times=[...knots].sort((a,b)=>a-b),rows=[];let pool=startPool,pending=pendingKnown,daily=budget,spendUSD=0,purchaseTokens=flow.tokens;
  rows.push({day:0,priceUSD:priceAt(0),externalHash:externalAt(0),budgetCRH:daily,poolCRH:pool,pendingPoolCRH:pending,usersMultiplier:1,spendUSD:0,newMarketBuyUSD:0});
  for(let i=1;i<times.length;i++){
   const a=times[i-1],b=times[i],dt=b-a,mid=(a+b)/2,added=Math.max(0,externalAt(b)-externalAt(a));
   const spend=added*usdPerHash+(externalAt(a)+externalAt(b))/2*opexPerHash*dt;
   pending+=.6*spend/priceAt(mid);purchaseTokens+=spend/priceAt(mid);spendUSD+=spend;pool=Math.max(0,pool-daily*dt);
   if(resets.some(t=>Math.abs(t-b)<1e-8)){pool+=pending;pending=0;daily=pool*rateAt(b);}
   rows.push({day:b,priceUSD:priceAt(b),externalHash:externalAt(b),budgetCRH:daily,poolCRH:pool,pendingPoolCRH:pending,usersMultiplier:1+(preset.users-1)*Math.min(1,b/days),spendUSD,newMarketBuyUSD:spendUSD*(1-preset.held)});
  }
  function at(t){t=Math.max(0,Math.min(end,t));let lo=0,hi=rows.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(rows[mid].day<=t+1e-9)lo=mid;else hi=mid-1;}return{...rows[lo],day:t,priceUSD:priceAt(t),externalHash:externalAt(t)};}
  const hashBoard=data.project?.latest?.hash,ranked=hashBoard&&!hashBoard.stale&&now-hashBoard.seenAt<7200000?hashBoard.ranked:null;
  const milestones=[0,launchDay,...Array.from({length:days},(_,i)=>i+1)].filter((t,i,a)=>t>=0&&t<=days&&a.indexOf(t)===i).sort((a,b)=>a-b).map(day=>{const p=at(day);return{...p,ranked:ranked===null?null:Math.round(ranked*p.usersMultiplier)};});
  const maximum={price:Math.max(...rows.map(p=>p.priceUSD)),budget:Math.max(...rows.map(p=>p.budgetCRH)),minimumExternal:Math.min(...rows.map(p=>p.externalHash))};
  const meta={id:preset.id,days,launchAt,launchDay,heldFraction:preset.held,usdPerHash,opexPerHash,initialBudget:budget,initialPool:startPool,knownPurchaseLowerBoundCRH:flow.tokens,knownPurchaseFrom:flow.from,knownPurchaseTo:flow.to,poolBasis:actualPool===null?'budget-minus-released-plus-known-lower-bound':'observed-unearned-pool',rateNow:s.rateBps/10000,rateNext:rateAt(firstReset),ranked,exitDay:preset.exitDay??null,liquidityFails:preset.id==='death',milestones,pricePoints,hashPoints,maximum,disclaimer:'Conditional paths; no probabilities. Price is independent of purchases. Historical unobserved pool inflows and slippage are excluded. Ranked islands include owners with PCs, not active users.'};
  return{meta,rows,at,priceAt,externalAt,rateAt,resets,maximum,days};
 }
 const api={presets:presets.map(p=>({id:p.id,days:p.days})),find,compile,knownInflows,LAUNCH};globalThis.CRHScenarios=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
