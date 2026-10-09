(() => {
  "use strict";
  const C=CRHMonitor,I=CRHI18n;
  let data={},view=null,host=null,shell=null,mini=null,collapsed=false,stopped=false,timer=null;
  function active(){try{return !!chrome.runtime.id}catch{return false}}
  function stop(){
    if(stopped)return;
    stopped=true;
    if(timer!==null)clearInterval(timer);
    window.removeEventListener("message",onPageMessage);
    document.removeEventListener("DOMContentLoaded",mount);
    try{chrome.runtime.onMessage.removeListener(onRuntimeMessage)}catch{}
    try{chrome.storage.onChanged.removeListener(onStorageChanged)}catch{}
    if(shell&&mini){
      shell.style.display="none";mini.style.display="block";
      mini.textContent=I.t("CRH Monitor обновлён · перезагрузить игру",I.language(C.cleanSettings(data.settings)));
      mini.title=I.t("После обновления расширения вкладку игры нужно перезагрузить",I.language(C.cleanSettings(data.settings)));
      mini.addEventListener("click",()=>location.reload(),{once:true});
    }
  }
  async function extensionCall(call){
    if(stopped)return;
    if(!active()){stop();return;}
    try{return await call()}catch(e){if(!active()||/Extension context invalidated/i.test(String(e?.message??e)))stop();}
  }
  const openSettings=focusTx=>extensionCall(()=>chrome.runtime.sendMessage({type:"openOptions",...(focusTx?{focusTx}:{})}));
  function onPageMessage(event){
    if(stopped||event.source!==window||event.origin!==location.origin)return;
    if(event.data?.type==="CRH_MONITOR_ORDER_V2"){const order=C.sanitizeOrder(event.data.order);if(order)extensionCall(()=>chrome.runtime.sendMessage({type:"order",order}));return;}
    if(event.data?.type==="CRH_MONITOR_PROJECT_V1"){extensionCall(()=>chrome.runtime.sendMessage({type:"project",kind:event.data.kind,payload:event.data.payload,board:event.data.board,status:event.data.status}));return;}
    if(event.data?.type!=="CRH_MONITOR_STATE_V1")return;
    const snapshot=C.validateSnapshot(event.data.snapshot);
    if(snapshot)extensionCall(()=>chrome.runtime.sendMessage({type:"snapshot",snapshot}));
  }
  async function load(){
    const next=await extensionCall(()=>chrome.storage.local.get(["settings","games","market","chain","history","ledgers","orders","corrections","project","priceHistory","priceFeed","accountDynamics","plannerPrefs"]));
    if(next&&!stopped){data=next;render();}
  }
  function render(){
    if(stopped)return;
    if(!active()){stop();return;}
    const settings=C.cleanSettings(data.settings);
    if(host)host.hidden=!settings.overlay;
    if(view)view.render(data);
    if(mini){
      const m=C.compute(settings,data.games?.[settings.wallet],data.chain,data.market);
      const pnl=CRHLedger.analyze(data.ledgers?.[settings.wallet],data.corrections?.[settings.wallet],data.orders?.[settings.wallet],data.chain?.wallet===settings.wallet?data.chain.balanceWei:null,m.freshGame?CRHLedger.claimableAt(data.ledgers?.[settings.wallet],m.claimable,m.own?.serverNow??m.own?.seenAt):null,m.price);
      mini.textContent="CRH "+I.usd(m.price,6,I.language(settings))+" · PnL "+(pnl.pnl===null?"—":(pnl.pnl>=0?"+":"−")+I.usd(Math.abs(pnl.pnl),undefined,I.language(settings)));
    }
  }
  function mount(){
    if(stopped||host||!document.body)return;
    if(!active()){stop();return;}
    host=document.createElement("div");host.id="crh-monitor-extension";
    host.style.cssText="position:fixed;right:16px;bottom:16px;z-index:2147483646;width:350px;max-width:calc(100vw - 24px);color-scheme:dark;";
    const shadow=host.attachShadow({mode:"open"});
    shell=document.createElement("div");shell.style.cssText="max-height:calc(100vh - 32px);overflow:auto;scrollbar-width:thin;border-radius:14px;";shadow.append(shell);
    mini=document.createElement("button");mini.style.cssText="display:none;margin-left:auto;border:1px solid #335447;background:#14291f;color:#a5f3d0;border-radius:12px;padding:12px 16px;box-shadow:0 5px 20px #0006;font:600 13px system-ui;cursor:pointer";
    shadow.append(mini);
    const toggle=()=>{if(stopped)return;collapsed=!collapsed;shell.style.display=collapsed?"none":"block";mini.style.display=collapsed?"block":"none";extensionCall(()=>chrome.storage.local.set({collapsed}));};
    mini.addEventListener("click",toggle);
    view=CRHView.create(shell,{compact:true,onClose:toggle,onLanguage:language=>extensionCall(()=>chrome.runtime.sendMessage({type:"setLanguage",language})),onSettings:()=>openSettings(),onRefresh:()=>{if(!stopped)window.postMessage({type:"CRH_MONITOR_REFRESH_V1"},location.origin)},onEdit:r=>openSettings({wallet:r.wallet,id:r.id})});
    document.body.append(host);
    extensionCall(()=>chrome.storage.local.get("collapsed")).then(x=>{if(x?.collapsed&&!collapsed&&!stopped)toggle();});
    render();
  }
  function onRuntimeMessage(m){if(stopped)return;if(m?.type==="refreshGame")window.postMessage({type:"CRH_MONITOR_REFRESH_V1"},location.origin);if(m?.type==="enrichOrders")window.postMessage({type:"CRH_MONITOR_ENRICH_V2",wallet:m.wallet,ids:m.ids},location.origin);}
  function onStorageChanged(changes,area){
    if(stopped||area!=="local")return;
    for(const [k,v]of Object.entries(changes))data[k]=v.newValue;
    render();
  }
  window.addEventListener("message",onPageMessage);
  try{chrome.runtime.onMessage.addListener(onRuntimeMessage);chrome.storage.onChanged.addListener(onStorageChanged)}catch{stop();return;}
  window.postMessage({type:"CRH_MONITOR_HELLO_V1"},location.origin);
  timer=setInterval(render,10000);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
  load();
})();
