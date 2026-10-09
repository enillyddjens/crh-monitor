importScripts("shared.js","ledger.js","project.js","price-feed.js","analytics.js");
const C=CRHMonitor,P=CRHProject;
importScripts("ledger-sync.js");
let rpcId=0,refreshing=false,refreshQueued=false,gameWrites=Promise.resolve();
async function storeDefaults(){
  const x=await chrome.storage.local.get("settings");
  if(!x.settings)await chrome.storage.local.set({settings:C.defaults(),collapsed:true});
  await chrome.alarms.create("crh-wallet",{periodInMinutes:2});
  await chrome.alarms.create("crh-price",{periodInMinutes:1});
}
async function rpc(method,params){
  const r=await fetch(C.RPC,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:++rpcId,method,params}),signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error("RPC HTTP "+r.status);
  const data=await r.json();
  if(data.error||!("result" in data))throw new Error(data.error?.message||"RPC не вернул корректный ответ");
  return data.result;
}
let priceBusy=false;
async function refreshPrice(){
 if(priceBusy)return {ok:true,busy:true};priceBusy=true;
 try{
  const res=await fetch(CRHPrice.API,{signal:AbortSignal.timeout(12000),credentials:"omit"});if(!res.ok)throw Error("DEX HTTP "+res.status);
  const sample=CRHPrice.quote(await res.json());if(!sample)throw Error("No verified CRH quote");
  const x=await chrome.storage.local.get("priceHistory");await chrome.storage.local.set({priceHistory:CRHPrice.append(x.priceHistory,sample),priceFeed:{...sample,error:null}});return {ok:true};
 }catch(e){const x=await chrome.storage.local.get("priceFeed");await chrome.storage.local.set({priceFeed:{...x.priceFeed,error:String(e.message).slice(0,100),failedAt:Date.now()}});return {ok:false};}
 finally{priceBusy=false;}
}
const balanceData=w=>"0x70a08231"+w.slice(2).padStart(64,"0");
async function refreshWallet(){
  if(refreshing){refreshQueued=true;return {ok:true,busy:true};}
  refreshing=true;
  let selected;
  try{
    const {settings}=await chrome.storage.local.get("settings");
    selected=C.cleanSettings(settings).wallet;
    if(!selected)return {ok:true,needsWallet:true};
    const chainId=await rpc("eth_chainId",[]);
    if(BigInt(chainId)!==4663n)throw new Error("RPC вернул другую сеть");
    const block=await rpc("eth_blockNumber",[]);
    const [balance,vault,eth]=await Promise.all([
      rpc("eth_call",[{to:C.TOKEN,data:balanceData(selected)},block]),
      rpc("eth_call",[{to:C.TOKEN,data:balanceData(C.VAULT.toLowerCase())},block]),
      rpc("eth_getBalance",[selected,block])
    ]);
    // Do not let a response for the previous wallet overwrite the new selection.
    const current=await chrome.storage.local.get("settings");
    if(C.cleanSettings(current.settings).wallet===selected)
      await chrome.storage.local.set({chain:{wallet:selected,at:Date.now(),block,balanceWei:BigInt(balance).toString(),vaultWei:BigInt(vault).toString(),ethWei:BigInt(eth).toString(),error:null}});
    return {ok:true};
  }catch(e){
    const x=await chrome.storage.local.get(["chain","settings"]);
    if(selected===C.cleanSettings(x.settings).wallet)
      await chrome.storage.local.set({chain:{...(x.chain?.wallet===selected?x.chain:{}),wallet:selected,error:String(e.message).slice(0,160),failedAt:Date.now()}});
    return {ok:false,error:String(e.message)};
  }finally{refreshing=false;if(refreshQueued){refreshQueued=false;refreshWallet()}}
}
async function acceptSnapshot(raw,sender){
  if(!sender.tab||!sender.url?.startsWith("https://www.computersrh.xyz/"))return {ok:false};
  const s=C.validateSnapshot(raw);
  if(!s||!s.seenAt||Math.abs(Date.now()-s.seenAt)>10000)return {ok:false};
  const x=await chrome.storage.local.get(["games","market","history","settings","project","chain","accountDynamics"]);
  const games=x.games||{};
  if(games[s.wallet]?.seenAt>s.seenAt)return {ok:true};
  games[s.wallet]=s;
  const sorted=Object.entries(games).sort((a,b)=>a[1].seenAt-b[1].seenAt).slice(-8);
  const history=x.history||[];
  const last=history.findLast?.(v=>v.wallet===s.wallet);
  if(!last||s.seenAt-last.at>=60000)
    history.push({wallet:s.wallet,at:s.seenAt,priceUSD:s.priceUSD,priceQuotable:s.priceQuotable,totalHash:s.totalHash,myHash:s.myHash,budgetWei:s.budgetWei,claimableWei:s.claimableWei,spentUSD:s.spentUSD,hourlyWei:s.hourlyWei});
  const update={accountDynamics:CRHAnalytics.save(x.accountDynamics,s,x.history||[]),games:Object.fromEntries(sorted),history:history.slice(-2880),project:P.saveEconomy(x.project,s,x.chain)};
  const settings=C.cleanSettings(x.settings);if(!settings.wallet)update.settings={...settings,wallet:s.wallet};
  if(!x.market||s.seenAt>=x.market.seenAt)update.market=s;
  await chrome.storage.local.set(update);
  return {ok:true};
}
async function acceptOrder(raw,sender){
 if(!sender.tab||!sender.url?.startsWith("https://www.computersrh.xyz/"))return {ok:false};
 const order=C.sanitizeOrder(raw);if(!order)return {ok:false};
 const x=await chrome.storage.local.get("orders"),all=x.orders||{},own=all[order.wallet]||{};
 const previous=own[order.id]||{};own[order.id]=C.mergeOrder(previous,order);all[order.wallet]=Object.fromEntries(Object.entries(own).slice(-2000));await chrome.storage.local.set({orders:all});return {ok:true};
}
async function acceptProject(m,sender){
 if(!sender.tab||!sender.url?.startsWith("https://www.computersrh.xyz/"))return {ok:false};
 const x=await chrome.storage.local.get(["project","market"]);let project=P.clean(x.project);
 if(m.kind==="board"){const b=P.validateBoard(m.payload);if(!b||Math.abs(Date.now()-b.seenAt)>10000)return {ok:false};project=P.saveBoard(project,b,x.market&&Date.now()-x.market.seenAt<120000?x.market.priceUSD:null);}
 else if(m.kind==="catalog"){const c=P.validateCatalog(m.payload);if(!c||Math.abs(Date.now()-c.seenAt)>10000)return {ok:false};project.catalog=c;}
 else if(m.kind==="error"&&["hash","spend","catalog"].includes(m.board)){project.errors={...project.errors,[m.board]:{at:Date.now(),status:Math.trunc(C.number(m.status)??0)}};}
 else return {ok:false};await chrome.storage.local.set({project});return {ok:true};
}
const allowedUiSender=sender=>sender.url?.startsWith(chrome.runtime.getURL(""))||(sender.tab&&sender.url?.startsWith("https://www.computersrh.xyz/"));
async function setLanguage(m,sender){
 if(!allowedUiSender(sender)||!["ru","en"].includes(m.language))return {ok:false};
 const {settings}=await chrome.storage.local.get("settings");await chrome.storage.local.set({settings:{...C.cleanSettings(settings),language:m.language}});return {ok:true};
}
async function openOptions(m,sender){
 const allowed=allowedUiSender(sender);
 if(!allowed)return {ok:false};
 try{
  if(m.focusTx){
   const wallet=C.wallet(m.focusTx.wallet),id=typeof m.focusTx.id==="string"&&/^0x[0-9a-f]{64}$/i.test(m.focusTx.id)?m.focusTx.id.toLowerCase():null;
   if(!wallet||!id)return {ok:false};
   await chrome.storage.local.set({focusTx:{wallet,id}});
  }
  await chrome.runtime.openOptionsPage();
  return {ok:true};
 }catch(e){return {ok:false,error:String(e.message).slice(0,160)}}
}
chrome.runtime.onMessage.addListener((m,sender,send)=>{
  if(m?.type==="project"){gameWrites=gameWrites.catch(()=>{}).then(()=>acceptProject(m,sender));gameWrites.then(send,()=>send({ok:false}));return true;}
  if(m?.type==="setLanguage"){gameWrites=gameWrites.catch(()=>{}).then(()=>setLanguage(m,sender));gameWrites.then(send,()=>send({ok:false}));return true;}
  if(m?.type==="openOptions"){openOptions(m,sender).then(send);return true;}
  if(m?.type==="snapshot"){
    gameWrites=gameWrites.catch(()=>{}).then(()=>acceptSnapshot(m.snapshot,sender));
    gameWrites.then(send,()=>send({ok:false}));return true;
  }
  if(m?.type==="order"){gameWrites=gameWrites.catch(()=>{}).then(()=>acceptOrder(m.order,sender));gameWrites.then(send,()=>send({ok:false}));return true;}
  // Only extension-owned UI can request RPC/settings operations.
  if(!sender.url?.startsWith(chrome.runtime.getURL("")))return;
  if(m?.type==="refreshWallet"){refreshWallet().then(send);refreshPrice().then(()=>syncLedger());return true;}
  if(m?.type==="syncLedger"){syncLedger().then(send);return true;}
  if(m?.type==="saveCorrection"){const v=L.sanitizeCorrection(m.correction);if(!v){send({ok:false});return;}chrome.storage.local.get(["corrections","ledgers"]).then(async x=>{const r=x.ledgers?.[v.wallet]?.records?.find(r=>r.id===v.id);if(!r||r.direction>0&&["sell","game","withdrawal"].includes(v.type)||r.direction<0&&["buy","reward"].includes(v.type)){send({ok:false});return;}await chrome.storage.local.set({corrections:{...(x.corrections||{}),[v.wallet]:{...(x.corrections?.[v.wallet]||{}),[v.id]:v}}});send({ok:true})}).catch(()=>send({ok:false}));return true;}
  if(m?.type==="saveSettings"){
    chrome.storage.local.set({settings:C.cleanSettings(m.settings)}).then(()=>{syncLedger();return refreshWallet()}).then(send);
    return true;
  }
});
chrome.runtime.onInstalled.addListener(()=>storeDefaults().then(()=>Promise.allSettled([refreshWallet(),refreshPrice().then(()=>syncLedger())])));
chrome.runtime.onStartup.addListener(()=>storeDefaults().then(()=>Promise.allSettled([refreshWallet(),refreshPrice().then(()=>syncLedger())])));
async function refreshGameTabs(){const tabs=await chrome.tabs.query({url:"https://www.computersrh.xyz/*"});await Promise.allSettled(tabs.map(t=>chrome.tabs.sendMessage(t.id,{type:"refreshGame",automatic:true})));}
chrome.alarms.onAlarm.addListener(a=>{if(a.name==="crh-wallet")Promise.allSettled([refreshWallet(),refreshGameTabs(),syncLedger()]);else if(a.name==="crh-price")refreshPrice()});
storeDefaults().catch(()=>{});
