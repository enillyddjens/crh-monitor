/* Pure calculations and a strict allowlist of data received from the game. */
(() => {
  "use strict";
  const DEFAULT_WALLET = "";
  const TOKEN = "0xd421141B9d6AfA274572a747E9a3fdd24BA8c400";
  const VAULT = "0x651dbFbD45A0681De3BBc25aAF8b81f0f8514823";
  const RPC = "https://rpc.mainnet.chain.robinhood.com";
  const wallet = v => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v) ? v.toLowerCase() : null;
  const number = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
  const wei = v => typeof v === "string" && /^\d{1,80}$/.test(v) ? BigInt(v).toString() : null;
  const short = v => typeof v === "string" ? v.slice(0,120) : null;
  function units(v, decimals=18) {
    if (wei(v) === null) return null;
    const s = BigInt(v).toString().padStart(decimals+1,"0");
    return Number(s.slice(0,-decimals) + "." + s.slice(-decimals));
  }
  const browserLanguage = () => /^ru\b/i.test(globalThis.navigator?.language||"en")?"ru":"en";
  const defaults = () => ({wallet:null,language:browserLanguage(),overlay:true,positions:{}});
  function position(settings) {
    const p = settings?.positions?.[wallet(settings?.wallet)] || {};
    return {
      capitalUSD:number(p.capitalUSD),returnedUSD:number(p.returnedUSD) ?? 0,
      sellFeePct:Math.min(100,number(p.sellFeePct) ?? 3),
      careDailyUSD:number(p.careDailyUSD),gasDailyUSD:number(p.gasDailyUSD) ?? 0
    };
  }
  function cleanSettings(raw={}) {
    const result=defaults();
    result.wallet=wallet(raw.wallet);
    result.language=raw.language==="ru"||raw.language==="en"?raw.language:result.wallet?"ru":browserLanguage();
    result.overlay=raw.overlay!==false;
    const entries=Object.entries(raw.positions||{}).filter(([key])=>wallet(key)).slice(-20);
    for(const [key,value] of entries) {
      result.positions[wallet(key)]=position({wallet:key,positions:{[wallet(key)]:value}});
    }
    return result;
  }
  const jobs = v => Array.isArray(v) ? v.filter(j=>j&&["plot","grid","island_level"].includes(j.kind)).slice(0,6).map(j=>({kind:j.kind,target:number(j.target),name:short(j.name),startsAt:number(j.startsAt??j.starts_at),endsAt:number(j.endsAt??j.ends_at),usd:number(j.usd??(number(j.usd_micro)===null?null:Number(j.usd_micro)/1e6))})) : [];

  const itemId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)?v:null;
  function slots(raw={}) {
    const out={};for(const key of ['case','board','motherboard','cpu','gpu','ram','ssd','psu','cooler','cpu_cooler','fans','fan','case_fans','system']){const v=raw?.[key];if(itemId(v))out[key]=v;else if(Array.isArray(v))out[key]=v.map(itemId).filter(Boolean).slice(0,16);}return out;
  }
  const pcs=v=>Array.isArray(v)?v.slice(0,8).filter(p=>itemId(p?.id)).map(p=>({id:p.id,plot:number(p.plot),ready:p.ready===true,running:p.running===true,powered:p.powered===true,hash:number(p.hash),healthyHash:number(p.healthyHash),watts:number(p.watts),cpuC:number(p.cpuC),gpuC:number(p.gpuC),thermalLossPct:number(p.thermalLossPct),wearLossPct:number(p.wearLossPct),autoPaste:{cpu:p.autoPaste?.cpu===true,gpu:p.autoPaste?.gpu===true},slots:slots(p.slots),towerSlots:slots(p.towerSlots)})):[];
  const items=v=>Array.isArray(v)?v.slice(0,4000).filter(p=>itemId(p?.id)&&itemId(p?.catalog)).map(p=>({id:p.id,catalog:p.catalog,installedSetup:itemId(p.installedSetup??p.installed_setup),installedSlot:itemId(p.installedSlot??p.installed_slot),wearMs:number(p.wearMs??p.wear_ms),cpuPasteAgeMs:number(p.cpuPasteAgeMs??p.cpu_paste_age_ms),gpuPasteAgeMs:number(p.gpuPasteAgeMs??p.gpu_paste_age_ms),fanAgeMs:number(p.fanAgeMs??p.fan_age_ms),conditionPct:number(p.conditionPct??p.condition_percent),repairUSD:number(p.repairUSD)??(number(p.repair_usd_micro)===null?null:Number(p.repair_usd_micro)/1e6),serviceUSD:number(p.serviceUSD)??(number(p.service_usd_micro)===null?null:Number(p.service_usd_micro)/1e6)})):[];
  const powerLevels=v=>Array.isArray(v)?v.slice(0,14).map(p=>({level:number(p.level),capacityW:number(p.capacityW??p.capacity_w),minutes:number(p.minutes),state:short(p.state)})).filter(p=>p.level!==null&&p.capacityW!==null):[];

  const constructionLevels=v=>Array.isArray(v)?v.slice(0,14).map(p=>({level:number(p.level??p.plot),capacityW:number(p.capacityW??p.capacity_w),minutes:number(p.minutes),minHall:number(p.minHall??p.min_island_level),minPlots:number(p.minPlots??p.min_plots),bonusPct:number(p.bonusPct)??(number(p.total_bonus_bps)===null?null:Number(p.total_bonus_bps)/100),hashCap:number(p.hashCap)??(number(p.pc_hash_cap_micro)===null?null:Number(p.pc_hash_cap_micro)/1e6),usd:number(p.usd)??(number(p.usd_micro)===null?null:Number(p.usd_micro)/1e6),baseUSD:number(p.baseUSD)??(number(p.price_base_usd_micro)===null?null:Number(p.price_base_usd_micro)/1e6),perHashUSD:number(p.perHashUSD)??(number(p.price_usd_micro_per_hs)===null?null:Number(p.price_usd_micro_per_hs)/1e6),state:short(p.state)})).filter(p=>p.level!==null):[];
  const limits=v=>Array.isArray(v)?v.slice(0,40).map(p=>({id:itemId(p.id),owned:number(p.owned),max:number(p.max)})).filter(p=>p.id):[];
  function sanitizeState(raw) {
    if (!raw || typeof raw !== "object" || !wallet(raw.wallet)) return null;
    if (Number(raw.chain_id)!==4663 || wallet(raw.token)!==TOKEN.toLowerCase()) return null;
    const e=raw.island_economy||{}, r=raw.rewards||{}, i=raw.stats?.island||{}, energy=raw.energy||{};
    const exactClaims=wei(r.mining_claimable_wei)!==null && wei(r.referral_claimable_wei)!==null;
    const claimableWei=exactClaims ? (BigInt(r.mining_claimable_wei)+BigInt(r.referral_claimable_wei)).toString() : wei(r.claimable_wei);
    const price=number(raw.price?.usd_per_x) ?? (wei(raw.price?.usd_e18_per_x)!==null ? units(raw.price.usd_e18_per_x) : null);
    const bonus=i.island_bonus||{}, builder=raw.progression?.builder||{};
    return {
      wallet:wallet(raw.wallet),seenAt:Date.now(),serverNow:number(raw.server_now),
      settledAt:number(e.accrued_until??r.accrued_until),
      version:short(raw.version),settlement:short(raw.settlement_status),
      priceUSD:price,priceQuotable:raw.price?.quotable===true,
      priceSource:short(raw.price?.source),
      totalHash:number(e.total_hash_micro)===null ? null : number(e.total_hash_micro)/1e6,
      myHash:number(i.hashrate_micro)===null ? null : number(i.hashrate_micro)/1e6,
      running:i.running===true,watts:number(energy.power_w)??number(i.power_w),
      energyHours:number(energy.hours_remaining??energy.autonomy_hours??energy.coverage_hours),
      energyKwh:number(energy.kwh),electricityUSD:number(energy.price_usd_micro_per_kwh)===null ? null : number(energy.price_usd_micro_per_kwh)/1e6,
      dailyEnergyUSD:number(energy.daily_usd_micro)===null ? null : number(energy.daily_usd_micro)/1e6,
      spentUSD:number(raw.spent_usd_micro)===null ? null : number(raw.spent_usd_micro)/1e6,
      budgetWei:wei(e.day_budget_wei??r.current_period?.day_emission_wei),
      releasedWei:wei(e.released_wei),poolWei:wei(e.pool_wei),
      rateBps:number(e.daily_rate_bps??r.daily_rate_bps),
      rateConfirmed:e.daily_rate_confirmed===true && r.daily_rate_confirmed!==false,
      rateChange:e.daily_rate_change ? {rateBps:number(e.daily_rate_change.rate_bps),startsAt:number(e.daily_rate_change.starts_at)} : null,
      hourlyWei:wei(r.rate_wei_per_hour),claimableWei,
      miningEarnedWei:wei(r.mining_wei??r.earned_wei),referralEarnedWei:wei(r.referral_wei??r.referral_earned_wei),
      claimedWei:wei(r.claimed_wei),
      claimBlocked:!!r.claim_block,claimReason:short(r.claim_block),
      dayEnd:number(r.current_period?.ends_at??r.day_resets_at),
      bonusPct:number(bonus.total_percent),hall:number(raw.progression?.island_level?.level),
      powerLevel:number(raw.progression?.power_level),gridCapacity:number(i.grid_capacity_w),
      gridReserved:number(i.grid_load_w),
      builderEnd:number(builder.current?.ends_at),builderQueueEnd:number(builder.finishes_at),
      builderName:short(builder.current?.name),queued:number(builder.queue_length),
      builderJobs:jobs([builder.current,...(builder.queue||[])]),openPlots:number(raw.island?.plots),
      economyRevision:short(raw.economy_revision??i.economy_revision),hashRecord:number(i.hash_record??raw.island?.hash_record_hs)??(number(raw.hash_record_micro)===null?null:Number(raw.hash_record_micro)/1e6),
      projectedHall:number(raw.progression?.projected?.island_level),projectedPlots:number(raw.progression?.projected?.plots),powerLevels:powerLevels(raw.progression?.power_levels),
      construction:{power:constructionLevels(raw.progression?.power_levels),plots:constructionLevels(raw.progression?.plots),hall:constructionLevels(raw.progression?.island_levels)},packageLimits:limits(Object.entries(raw.island?.package_limits||{}).map(([id,p])=>({id,...p}))),
      pcs:pcs(Object.entries(raw.setups||{}).slice(0,8).map(([id,p])=>{const s=raw.stats?.setups?.[id]||{};return {id,plot:number(p.plot)===null?null:Number(p.plot)+1,ready:s.ready,running:s.running,powered:p.powered,hash:number(s.hashrate_micro)===null?number(s.hashrate):Number(s.hashrate_micro)/1e6,healthyHash:number(s.healthy_base_hashrate)??(number(s.parts_hashrate)>0&&number(s.efficiency_multiplier)>0?Number(s.parts_hashrate)*Number(s.efficiency_multiplier):null),watts:number(s.power_w),cpuC:s.thermal?.cpu_c??s.cpu_c,gpuC:s.thermal?.gpu_c??s.gpu_c,thermalLossPct:number(s.thermal_loss_percent)??(number(s.thermal?.loss_bps)===null?null:Number(s.thermal.loss_bps)/100),wearLossPct:s.maintenance_loss_percent,autoPaste:p.auto_paste,slots:p.slots,towerSlots:p.tower_slots};})),items:items(raw.items)
    };
  }
  function validateSnapshot(s) {
    if(!s || !wallet(s.wallet))return null;
    const out={wallet:wallet(s.wallet)};
    const numbers=["seenAt","serverNow","settledAt","priceUSD","totalHash","myHash","watts","energyHours","energyKwh","electricityUSD","dailyEnergyUSD","spentUSD","rateBps","dayEnd","bonusPct","hall","powerLevel","gridCapacity","gridReserved","builderEnd","builderQueueEnd","openPlots","queued","hashRecord","projectedHall","projectedPlots"];
    const strings=["version","settlement","priceSource","claimReason","builderName","economyRevision"];
    const weis=["budgetWei","releasedWei","poolWei","hourlyWei","claimableWei","miningEarnedWei","referralEarnedWei","claimedWei"];
    numbers.forEach(k=>out[k]=number(s[k]));
    strings.forEach(k=>out[k]=short(s[k]));
    weis.forEach(k=>out[k]=wei(s[k]));
    ["priceQuotable","rateConfirmed","running","claimBlocked"].forEach(k=>out[k]=s[k]===true);
    out.rateChange=s.rateChange?{rateBps:number(s.rateChange.rateBps),startsAt:number(s.rateChange.startsAt)}:null;
    out.construction={power:constructionLevels(s.construction?.power),plots:constructionLevels(s.construction?.plots),hall:constructionLevels(s.construction?.hall)};out.packageLimits=limits(s.packageLimits);
    out.builderJobs=jobs(s.builderJobs);out.powerLevels=powerLevels(s.powerLevels);out.pcs=pcs(s.pcs);out.items=items(s.items);
    return out;
  }
  function orderLabel(action,args={}){
    const pack=args.package_id??args.prebuilt_id??args.package??args.prebuilt;
    if(action==="buy_prebuilt"||action==="choose_starter")return pack?"ПК "+String(pack).replace(/[_-]/g," "):"Покупка ПК";
    if(action==="build"){
      const id=String(args.id??""),kind=String(args.kind??args.type??"");
      const match=id.match(/^(plot|grid|island[-_]level)-(\d+)$/);
      if(match)return (match[1]==="plot"?"Plot "+(Number(match[2])+1):match[1]==="grid"?"Power Level ":"Island Level ")+(match[1]==="plot"?"":match[2]);
      const n=args.level??args.target??args.tier;
      if(kind==="plot")return "Новый участок"+(n!==undefined?" · "+n:"");
      if(kind==="grid"||kind==="power")return "Апгрейд мощности"+(n!==undefined?" · "+n:"");
      if(kind==="island_level")return "Island Level"+(n!==undefined?" · "+n:"");
      return "Стройка / апгрейд";
    }
    return ({energy_refill:"Электричество",energy_buy:"Электричество",buy_paste:"Термопаста",repair:"Ремонт",service:"Обслуживание",buy:"Комплектующие",buy_cart:"Покупка в магазине"})[action]||"Покупка в игре";
  }
  function sanitizeOrder(raw){
    const id=typeof raw?.id==="string"&&/^0x[0-9a-f]{64}$/i.test(raw.id)?raw.id.toLowerCase():null,w=wallet(raw?.wallet);
    if(!id||!w)return null;
    const action=typeof raw.action==="string"?raw.action.slice(0,40):null,args={};
    for(const k of ["package_id","prebuilt_id","package","prebuilt","id","kind","type","level","target","tier","product_id","catalog_id","quantity","component_id","setup"]){
      const v=raw.args?.[k];if(typeof v==="string"&&v.length<81)args[k]=v;else if(typeof v==="number"&&Number.isFinite(v)&&v>=0)args[k]=v;
    }
    return {id,wallet:w,action,args,label:action?orderLabel(action,args):null,quotePriceUSD:number(raw.quotePriceUSD),seenAt:Date.now()};
  }

  const purchaseActions=new Set(['build','buy_prebuilt','choose_starter','energy_refill','energy_buy','buy_paste','repair','service','buy','buy_cart']);
  function orderRequestMeta(raw,w) {
    if(!raw||typeof raw!=='object')return {};
    const safe=sanitizeOrder({id:'0x'+'0'.repeat(64),wallet:w,action:raw.action,args:raw.args??raw});
    return {wallet:safe?.wallet,order_id:typeof raw.order_id==='string'&&/^0x[0-9a-f]{64}$/i.test(raw.order_id)?raw.order_id.toLowerCase():null,action:safe?.action,args:safe?.args};
  }
  function mergeOrder(previous,incoming) {
    const next=sanitizeOrder(incoming);if(!next)return null;
    const old=previous?.id===next.id&&previous?.wallet===next.wallet?sanitizeOrder(previous):null;
    const action=purchaseActions.has(next.action)?next.action:purchaseActions.has(old?.action)?old.action:next.action??old?.action;
    const args={...(old?.action===action?old.args:{}),...(next.action===action?next.args:{})};
    const result=sanitizeOrder({...next,action,args,quotePriceUSD:old?.quotePriceUSD??next.quotePriceUSD});
    if(!result.label&&old?.label)result.label=old.label;return result;
  }

  function compute(settings,game,chain,market,now=Date.now()) {
    const selected=wallet(settings?.wallet), p=position(settings), own=game?.wallet===selected ? game:null;
    const quote=market || own;
    const freshGame=!!own && now-own.seenAt<120000 && own.seenAt<=now+5000 &&
      (own.serverNow===null || own.settledAt===null || own.serverNow-own.settledAt<180000) &&
      (!own.settlement || own.settlement==="ready") && (own.serverNow===null || Math.abs(own.seenAt-own.serverNow)<180000);
    const freshPrice=!!quote && now-quote.seenAt<120000 && quote.seenAt<=now+5000 && quote.priceQuotable && (quote.serverNow===null || Math.abs(quote.seenAt-quote.serverNow)<180000);
    const price=quote?.priceUSD>0?quote.priceUSD:null;
    const balance=chain?.wallet===selected ? units(chain.balanceWei):null;
    const claimable=units(own?.claimableWei);
    const share=!!own && own.myHash!==null && quote?.totalHash>0 ? own.myHash/quote.totalHash:null;
    const dailyTokens=own?.rateConfirmed ? (units(own.hourlyWei)===null ? null : units(own.hourlyWei)*24) : null;
    const energyDaily=own?.dailyEnergyUSD ?? (own?.watts!==null && own?.watts!==undefined && own?.electricityUSD!==null ? own.watts*24/1000*own.electricityUSD:null);
    const grossDaily=dailyTokens!==null && price!==null ? dailyTokens*price:null;
    const netDaily=grossDaily!==null && energyDaily!==null ? grossDaily*(1-p.sellFeePct/100)-energyDaily-(p.careDailyUSD??0)-p.gasDailyUSD:null;
    const basis=p.capitalUSD??own?.spentUSD??null;
    const remaining=basis!==null?Math.max(0,basis-p.returnedUSD):null;
    const actionable=freshGame&&freshPrice&&own?.rateConfirmed&&quote?.rateConfirmed&&(!own.dayEnd||!quote.dayEnd||own.dayEnd===quote.dayEnd);
    const paybackDays=actionable && remaining===0 ? 0 : actionable&&netDaily>0&&remaining!==null ? remaining/netDaily:null;
    const budget=units(quote?.budgetWei);
    const rate=quote?.rateBps;
    const poolAtStart=budget!==null&&rate>0 ? budget/(rate/10000):null;
    return {own,quote,p,freshGame,freshPrice,price,balance,claimable,share,dailyTokens,energyDaily,grossDaily,netDaily,basis,remaining,paybackDays,actionable,budget,poolAtStart,
      balanceUSD:balance!==null&&price!==null?balance*price:null,
      claimableUSD:claimable!==null&&price!==null?claimable*price:null,
      vaultTokens:units(chain?.vaultWei),chainFresh:!!chain&&chain.wallet===selected&&now-chain.at<180000&&!chain.error,
      totalTokens:balance!==null&&claimable!==null?balance+claimable:null,
      roi30:actionable&&basis>0&&netDaily!==null?netDaily*30/basis*100:null
    };
  }
  const fmt=(n,d=2)=>n===null||n===undefined||!Number.isFinite(n)?"—":new Intl.NumberFormat("ru-RU",{maximumFractionDigits:d}).format(n);
  const usd=(n,d)=>n===null||n===undefined||!Number.isFinite(n)?"—":"$"+(d===undefined&&(n===0||Math.abs(n)>=.01)?new Intl.NumberFormat("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n):fmt(n,d??6));
  const address=w=>wallet(w)?w.slice(0,6)+"…"+w.slice(-4):"—";
  const api={DEFAULT_WALLET,TOKEN,VAULT,RPC,wallet,number,wei,units,defaults,position,cleanSettings,sanitizeState,validateSnapshot,sanitizeOrder,orderLabel,orderRequestMeta,mergeOrder,compute,fmt,usd,address};
  globalThis.CRHMonitor=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
