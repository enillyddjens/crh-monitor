/* Observe safe economic fields. Session headers remain in this closure. */
(() => {
 "use strict";
 const C=globalThis.CRHMonitor,P=globalThis.CRHProject,original=window.fetch;
 if(!C||!original||window.__crhMonitorBridge)return;
 window.__crhMonitorBridge=true;
 let headers=null,lastSeen=0,inflight=false,lastRefresh=0,lastSnapshot=null;
 const orderCache=new Map(),enriched=new Map();
 let lastBoards=0,boardsBusy=false,lastCatalog=null;const lastBoard={};
 const sendProject=(kind,payload,extra={})=>window.postMessage({type:"CRH_MONITOR_PROJECT_V1",kind,payload,...extra},location.origin);
 const validId=v=>typeof v==="string"&&/^0x[0-9a-f]{64}$/i.test(v)?v.toLowerCase():null;
 function urlOf(input){try{return new URL(typeof input==="string"?input:input.url,location.href)}catch{return null}}
 function emit(raw){
   const s=C.sanitizeState(raw?.state??raw);
   if(s){lastSeen=Date.now();lastSnapshot=s;window.postMessage({type:"CRH_MONITOR_STATE_V1",snapshot:s},location.origin)}
 }
 function order(raw,meta={}){
   const o=raw?.order??raw,id=validId(o?.order_id??raw?.quote?.orderId??o?.orderId??meta.order_id);
   const w=C.wallet(o?.buyer??raw?.quote?.buyer??meta.wallet??headers?.["X-Wallet-Address"]);
   if(!id||!w)return;
   const key=w+":"+id,old=orderCache.get(key)||{};
   const record=C.mergeOrder(old,{id,wallet:w,action:meta.action??o.action??old.action,
     args:meta.args??o.args??old.args,quotePriceUSD:raw?.tokenUsdPrice18?C.units(String(raw.tokenUsdPrice18)):raw?.pricing?.usd_e18_per_x?C.units(String(raw.pricing.usd_e18_per_x)):old.quotePriceUSD});
   if(record){orderCache.set(key,record);if(orderCache.size>500)orderCache.delete(orderCache.keys().next().value);window.postMessage({type:"CRH_MONITOR_ORDER_V2",order:record},location.origin)}
 }
 async function observe(response,path,metaPromise=Promise.resolve({})){
   if(!response.ok)return;
   try{
     const text=await response.clone().text();if(text.length>2000000)return;
     const data=JSON.parse(text);emit(data);
     if(P&&path.startsWith("/api/web3/social/leaderboard")){const b=P.board(data,path.includes("board=spend")?"spend":"hash");if(b){lastBoard[b.board]=b;sendProject("board",b);}}
     if(P&&path.startsWith("/api/web3/prebuilts")){const c=P.catalog(data);if(c){lastCatalog=c;sendProject("catalog",c);}}
     if(path==="/api/web3/state")refreshBoards(false);
     if(path.startsWith("/api/web3/orders/"))order(data,await metaPromise);
   }catch{}
 }
 async function requestMeta(input,init){
   const requestWallet=headers?.["X-Wallet-Address"];
   try{
     const body=typeof init?.body==="string"?init.body:input instanceof Request?await input.clone().text():"";
     if(body.length>100000)return {};
     const data=JSON.parse(body||"{}");
     // Only order ID, action, and allowlisted item identifiers. No signatures or auth payloads.
     return C.orderRequestMeta(data,requestWallet);
   }catch{return {}}
 }
 window.fetch=function(input,init){
   const url=urlOf(input),method=(init?.method??input?.method??"GET").toUpperCase();
   const same=url?.origin===location.origin,state=same&&url.pathname==="/api/web3/state"&&method==="GET";
   const orders=same&&/^\/api\/web3\/orders\/(quote|status|confirm|pending)$/.test(url.pathname);
   if(state){
     try{
       const h=new Headers(input instanceof Request?input.headers:undefined);new Headers(init?.headers).forEach((v,k)=>h.set(k,v));
       const w=C.wallet(h.get("X-Wallet-Address")),v=h.get("X-Session-Version");
       if(w&&/^\d{1,10}$/.test(v||""))headers={"X-Wallet-Address":w,"X-Session-Version":v};
     }catch{}
   }
   const meta=orders?requestMeta(input,init):Promise.resolve({});
   const promise=original.apply(this,arguments);
   if(state||orders||same&&url.pathname==="/api/web3/command"||same&&["/api/web3/social/leaderboard","/api/web3/prebuilts"].includes(url.pathname))promise.then(r=>observe(r,url.pathname+url.search,meta)).catch(()=>{});
   return promise;
 };
 async function refresh(force=false){
   if(inflight||!headers||Date.now()-lastRefresh<10000||(!force&&Date.now()-lastSeen<25000)||(!force&&document.hidden))return;
   inflight=true;lastRefresh=Date.now();
   try{
     const r=await original.call(window,"/api/web3/state",{method:"GET",headers,credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(12000)});
     if(r.status===401||r.status===403)headers=null;
     await observe(r,"/api/web3/state");
   }catch{}finally{inflight=false}
 }
 async function refreshBoards(force=false){
   if(!P||!headers||boardsBusy||Date.now()-lastBoards<(force?60000:3600000))return;
   boardsBusy=true;lastBoards=Date.now();const currentHeaders={...headers};
   const get=async path=>{const r=await original.call(window,path,{method:"GET",headers:currentHeaders,credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(12000)});if(!r.ok){const e=Error();e.status=r.status;throw e;}const t=await r.text();if(t.length>2000000)throw Error();return JSON.parse(t);};
   try{
    for(const kind of ["hash","spend"]){try{
     const base="/api/web3/social/leaderboard?page_size=20"+(kind==="spend"?"&board=spend":""),first=await get(base+"&page=1"),all=[...(first.rows||[])],target=Math.min(100,Math.max(0,Number(first.ranked??first.total)||0)),pages=Math.min(5,Math.max(1,Number(first.pages)||Math.ceil(target/20)));
     for(let page=2;page<=pages;page++){const next=await get(base+"&page="+page);if(next.stale||first.snapshot_id&&next.snapshot_id!==first.snapshot_id||first.as_of!=null&&next.as_of!==first.as_of)throw Error();all.push(...(next.rows||[]));}
     const clean=P.board({...first,board:kind,page:1,query:"",rows:all,complete:true},kind);if(!clean||new Set(clean.rows.map(r=>r.id)).size!==clean.rows.length||clean.rows.length<target)throw Error();
     lastBoard[kind]=clean;sendProject("board",clean);
    }catch(e){sendProject("error",null,{board:kind,status:e.status??0});}}
    try{const c=P.catalog(await get("/api/web3/prebuilts"));if(c){lastCatalog=c;sendProject("catalog",c);}}catch(e){sendProject("error",null,{board:"catalog",status:e.status??0});}
   }finally{boardsBusy=false}
 }
 async function enrich(wallet,ids){
   if(!headers||C.wallet(wallet)!==headers["X-Wallet-Address"]||!Array.isArray(ids))return;
   for(const id of ids.slice(0,4).map(validId).filter(Boolean)){
     if(Date.now()-(enriched.get(id)||0)<300000)continue;
     enriched.set(id,Date.now());
     try{
       const r=await original.call(window,"/api/web3/orders/status?order_id="+id,{method:"GET",headers,credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(12000)});
       await observe(r,"/api/web3/orders/status",Promise.resolve({order_id:id}));
     }catch{}
   }
 }
 window.addEventListener("message",e=>{
   if(e.source!==window||e.origin!==location.origin)return;
   if(e.data?.type==="CRH_MONITOR_HELLO_V1"&&lastSnapshot)window.postMessage({type:"CRH_MONITOR_STATE_V1",snapshot:lastSnapshot},location.origin);
   if(e.data?.type==="CRH_MONITOR_HELLO_V1"){for(const b of Object.values(lastBoard))sendProject("board",b);if(lastCatalog)sendProject("catalog",lastCatalog);}
   if(e.data?.type==="CRH_MONITOR_REFRESH_V1"){refresh(true);refreshBoards(e.data.automatic!==true);}
   if(e.data?.type==="CRH_MONITOR_ENRICH_V2")enrich(e.data.wallet,e.data.ids);
 });
 setInterval(()=>{refresh(false);refreshBoards(false)},60000);
})();