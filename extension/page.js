(() => {
 "use strict";
 const C=CRHMonitor,L=CRHLedger,I=CRHI18n,compact=document.body.classList.contains("popup"),keys=["settings","games","chain","market","history","ledgers","orders","corrections","focusTx","project","priceHistory","priceFeed","accountDynamics","plannerPrefs","plannerForecasts"];
 let data={},editing=null,lang=I.language({});
 const t=key=>I.t(key,lang),fmt=(n,d)=>I.fmt(n,d,lang);
 const $=id=>document.getElementById(id);
 const view=CRHView.create($("app"),{compact,onRefresh:refresh,onSettings:()=>{
   if(compact){chrome.runtime.openOptionsPage();return;}
   $("settings").open=true;$("settings").scrollIntoView({behavior:"smooth"});
 },onEdit:edit,onLanguage:async language=>{try{await chrome.runtime.sendMessage({type:"setLanguage",language});await load()}catch{}}});
 const localize=I.bind(document.documentElement);
 function applyLanguage(){lang=I.language(C.cleanSettings(data.settings));document.documentElement.lang=lang;localize(lang);for(const id of ["saveStatus","editorStatus"])if($(id))$(id).textContent=I.t($(id).textContent,lang);if($("export"))$("export").disabled=!C.cleanSettings(data.settings).wallet;}
 async function load(){data=await chrome.storage.local.get(keys);applyLanguage();view.render(data)}
 async function refresh(){
   const button=view.panel.querySelector('[data-action="refresh"]');button.disabled=true;
   try{
     const tabs=await chrome.tabs.query({url:"https://www.computersrh.xyz/*"});
     await Promise.allSettled(tabs.map(t=>chrome.tabs.sendMessage(t.id,{type:"refreshGame"})));
     await chrome.runtime.sendMessage({type:"refreshWallet"});await load();
   }finally{button.disabled=false}
 }
 $("openGame")?.addEventListener("click",()=>chrome.tabs.create({url:"https://www.computersrh.xyz/play/island"}));
 $("openDashboard")?.addEventListener("click",()=>chrome.runtime.openOptionsPage());
 function fill(){
   const settings=C.cleanSettings(data.settings),p=C.position(settings);
   $("wallet").value=settings.wallet??"";$("overlay").checked=settings.overlay;
   for(const k of ["capitalUSD","returnedUSD","sellFeePct","careDailyUSD","gasDailyUSD"])$(k).value=p[k]??"";
 }
 $("settingsForm")?.addEventListener("submit",async e=>{
   e.preventDefault();
   const settings=C.cleanSettings(data.settings),selected=C.wallet($("wallet").value.trim());if(!selected)return;
   const p={};for(const k of ["capitalUSD","returnedUSD","sellFeePct","careDailyUSD","gasDailyUSD"])p[k]=C.number($(k).value);
   settings.wallet=selected;settings.overlay=$("overlay").checked;settings.positions[selected]=p;
   $("saveStatus").textContent=t("Сохраняю…");
   try{const r=await chrome.runtime.sendMessage({type:"saveSettings",settings});await load();fill();$("saveStatus").textContent=r.ok?t("Сохранено"):t("Сохранено; сеть сейчас недоступна")}catch{$("saveStatus").textContent=t("Не удалось сохранить")}
 });
 $("wallet")?.addEventListener("change",e=>{
   const selected=C.wallet(e.target.value.trim());if(!selected)return;
   const p=C.position({...C.cleanSettings(data.settings),wallet:selected});
   for(const k of ["capitalUSD","returnedUSD","sellFeePct","careDailyUSD","gasDailyUSD"])$(k).value=p[k]??"";
 });
 function edit(r){
   if(compact){chrome.storage.local.set({focusTx:{wallet:r.wallet,id:r.id}}).then(()=>chrome.runtime.openOptionsPage());return;}
   const raw=data.ledgers?.[r.wallet]?.records.find(v=>v.id===r.id);if(!raw)return;
   const old=data.corrections?.[r.wallet]?.[r.id]||{};
   editing={raw,old,effective:r};
   const types=r.direction>0?[['buy',t("Покупка CRH")],['reward',t("Награды / безвозмездное получение")],['incoming',t("Неизвестный входящий перевод")]]:[['game',t("Оплата в игре")],['sell',t("Продажа CRH")],['withdrawal',t("Перевод с учётом стоимости вне этого кошелька")],['outgoing',t("Неизвестный исходящий перевод")]];
   $("editorType").replaceChildren(...types.map(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o}));
   $("editorType").value=r.type;$("editorLabel").value=I.label(r,lang);$("editorTotal").value=r.totalUSD??"";$("editorGas").value=r.gasUSD??"";
   $("editorTotal").readOnly=raw.usdSource==='onchain-usd';
   $("editorClaimPrice").value=r.claimPriceUSD??"";editorFields();
   $("editorMeta").textContent=(r.at?new Date(r.at).toLocaleString(I.locale(lang))+' · ':'')+fmt(C.units(r.quantityWei),2)+' CRH · '+C.address(r.wallet);
   $("editorHint").textContent=raw.usdSource==='onchain-usd'?t("USD-сумма оплаты подтверждена сетью. Можно уточнить название покупки."):t("Укажите фактическую USD-стоимость. Награды имеют нулевую себестоимость. Входящий перевод между своими кошельками требует стоимости приобретения, а не текущего курса.");
   $("editorStatus").textContent="";$("entryEditor").showModal();
 }
 function editorFields(){const reward=$("editorType")?.value==='reward';if($("editorClaimField"))$("editorClaimField").hidden=!reward;if($("editorTotalField"))$("editorTotalField").hidden=reward;}
 $("editorType")?.addEventListener('change',editorFields);
 function closeEditor(){$("entryEditor").close();editing=null}
 $("editorClose")?.addEventListener('click',closeEditor);
 $("entryEditor")?.addEventListener('cancel',()=>{editing=null});
 $("entryForm")?.addEventListener('submit',async e=>{
   e.preventDefault();if(!editing)return;
   const {raw,old,effective:r}=editing,type=$("editorType").value,total=C.number($("editorTotal").value),gas=C.number($("editorGas").value);
   if(['buy','sell','game','withdrawal'].includes(type)&&total===null){$("editorStatus").textContent=t("Укажите стоимость операции");return;}
   const correction={id:raw.id,wallet:raw.wallet,type,label:$("editorLabel").value===I.label(r,lang)?(old.label??null):$("editorLabel").value,
     totalUSD:raw.usdSource==='onchain-usd'?null:total===r.totalUSD?(old.totalUSD??null):total,
     gasUSD:gas===r.gasUSD?(old.gasUSD??null):gas,
     claimPriceUSD:type==='reward'?(C.number($("editorClaimPrice").value)===r.claimPriceUSD?(old.claimPriceUSD??null):C.number($("editorClaimPrice").value)):null,spendKind:old.spendKind??null};
   if(type==='reward')correction.totalUSD=null;
   $("editorStatus").textContent=t("Сохраняю…");
   try{const result=await chrome.runtime.sendMessage({type:'saveCorrection',correction});if(!result?.ok)throw Error();closeEditor();await load()}catch{$("editorStatus").textContent=t("Не удалось сохранить")}
 });
 $("editorReset")?.addEventListener('click',async()=>{
   if(!editing)return;
   const {raw}=editing;
   const result=await chrome.runtime.sendMessage({type:'saveCorrection',correction:{id:raw.id,wallet:raw.wallet,type:null,label:null,totalUSD:null,gasUSD:null,claimPriceUSD:null,spendKind:null}});
   if(result?.ok){closeEditor();await load()}else $("editorStatus").textContent=t("Не удалось сбросить");
 });
 async function focusEntry(){
   const focus=data.focusTx,w=C.cleanSettings(data.settings).wallet;if(compact||!focus||focus.wallet!==w)return;
   const rows=L.analyze(data.ledgers?.[w],data.corrections?.[w],data.orders?.[w],null,null,null,[...(data.history||[]),...(data.priceHistory||[])]).rows,r=rows.find(v=>v.id===focus.id);
   if(r){await chrome.storage.local.remove('focusTx');view.tab('journal');edit(r)}
 }
 function investmentSummary(settings,w){const ledger=data.ledgers?.[w],m=C.compute(settings,data.games?.[w],data.chain,data.market),claim=m.freshGame?L.claimableAt(ledger,m.claimable,m.own?.serverNow??m.own?.seenAt):null,a=L.analyze(ledger,data.corrections?.[w],data.orders?.[w],data.chain?.wallet===w?data.chain.balanceWei:null,claim,m.price,[...(data.history||[]),...(data.priceHistory||[])]);return{initialInvestment:a.initialInvestment,totalInvestment:a.totalInvestment,projectPnL:a.pnl,resultBeforeReinvestment:a.pnlWithReinvest,reinvestment:a.reinvest,ready:a.ready};}
 function CRHPriceObservations(){return (data.priceHistory||[]).filter(s=>s.source==='dexscreener'&&s.token===C.TOKEN.toLowerCase()).map(s=>({at:s.at,priceUSD:s.priceUSD,source:s.source,token:s.token,chainId:s.chainId,pair:s.pair}));}
 $("export")?.addEventListener('click',async()=>{
   await load();const settings=C.cleanSettings(data.settings),w=settings.wallet;if(!w)return;
   const exported={format:'crh-monitor-v3',extensionVersion:chrome.runtime.getManifest().version,uiLanguage:lang,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,exportedAt:new Date().toISOString(),wallet:w,accounting:C.position(settings),game:data.games?.[w]??null,chain:data.chain?.wallet===w?data.chain:null,ledger:data.ledgers?.[w]??null,corrections:data.corrections?.[w]??{},orders:data.orders?.[w]??{},observations:(data.history||[]).filter(s=>s.wallet===w),investmentSummary:investmentSummary(settings,w),priceObservations:CRHPriceObservations(),positionObservations:data.accountDynamics?.[w]??[],plannerOptions:data.plannerPrefs?.[w]??null,plannerForecast:data.plannerForecasts?.[w]??null,project:CRHProject.clean(data.project)};
   const url=URL.createObjectURL(new Blob([JSON.stringify(exported,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;const date=new Date(),pad=v=>String(v).padStart(2,'0');a.download='crh-monitor-'+date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'-'+pad(date.getHours())+pad(date.getMinutes())+'-'+w.slice(2,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;for(const [k,v]of Object.entries(changes))data[k]=v.newValue;applyLanguage();view.render(data);if(changes.focusTx)focusEntry().catch(()=>{})});
 load().then(()=>{if(!compact)fill();return focusEntry()}).catch(()=>{});setInterval(()=>view.render(data),10000);refresh().catch(()=>{});
})();