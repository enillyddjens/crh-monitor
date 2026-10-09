/* Bounded, resumable scans of indexed CRH Transfer logs on the public RPC. */
const L=CRHLedger;
let ledgerBusy=false,ledgerQueued=false;
const HISTORICAL="https://api.exchange.coinbase.com/products/ETH-USD/candles";
async function historicalEth(at,cache){
  if(!at)return null;
  const minute=Math.floor(at/60000)*60,key=String(minute);
  if(cache[key]?.price>0)return cache[key].price;
  if(cache[key]?.failedAt&&Date.now()-cache[key].failedAt<300000)return null;
  try{
    const url=new URL(HISTORICAL);url.searchParams.set("granularity","60");
    url.searchParams.set("start",new Date((minute-60)*1000).toISOString());url.searchParams.set("end",new Date((minute+60)*1000).toISOString());
    const res=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error("ETH/USD "+res.status);
    const rows=await res.json(),bucket=Array.isArray(rows)?rows.find(r=>r[0]===minute&&Number(r[3])>0):null;
    if(!bucket)throw Error("Нет исторического курса");
    cache[key]={price:Number(bucket[3]),source:"coinbase-minute-open"};return Number(bucket[3]);
  }catch{cache[key]={failedAt:Date.now()};return null}
}
async function fillUSD(record,cache){
  const needsEth=(record.totalUSD===null&&record.nativeWei)||(record.gasUSD===null&&BigInt(record.gasWei||"0")>0n);
  const eth=needsEth?await historicalEth(record.at,cache):null;
  if(record.totalUSD===null&&record.nativeWei&&eth){record.totalUSD=C.units(record.nativeWei)*eth;record.priceUSD=record.totalUSD/C.units(record.quantityWei);record.usdSource="coinbase-minute-open";}
  if(record.gasUSD===null&&eth)record.gasUSD=C.units(record.gasWei)*eth;
  if(record.gasWei==="0")record.gasUSD=0;
  return record;
}
async function saveLedger(w,ledger,cache){
  const x=await chrome.storage.local.get("ledgers");
  await chrome.storage.local.set({ledgers:{...(x.ledgers||{}),[w]:ledger},ethHistory:cache});
}
async function enrichOrders(w,records){
  const x=await chrome.storage.local.get("orders"),known=x.orders?.[w]||{};
  const ids=records.filter(r=>r.orderId&&!known[r.orderId]?.label).map(r=>r.orderId).slice(-4);
  if(!ids.length)return;
  const tabs=await chrome.tabs.query({url:"https://www.computersrh.xyz/*"});
  await Promise.allSettled(tabs.map(t=>chrome.tabs.sendMessage(t.id,{type:"enrichOrders",wallet:w,ids})));
}
async function syncLedger(){
  if(ledgerBusy){ledgerQueued=true;return {ok:true,busy:true};}
  ledgerBusy=true;let w,ledger,cache={};
  try{
    const x=await chrome.storage.local.get(["settings","ledgers","ethHistory"]);
    w=C.cleanSettings(x.settings).wallet;
    if(!w)return {ok:true,needsWallet:true};
    ledger=x.ledgers?.[w]||{wallet:w,cursor:-1,records:[],complete:false};
    cache=x.ethHistory||{};
    const tip=Number(BigInt(await rpc("eth_blockNumber",[]))),end=Math.max(0,tip-12);
    let start=Math.max(0,Math.min(ledger.cursor??-1,end)-31),records=(ledger.records||[]).filter(r=>r.block<=end);
    // 10M is the RPC's inclusive range limit. Re-read 32 blocks for reorgs.
    while(start<=end){
      const until=Math.min(end,start+9999999),topic="0x"+w.slice(2).padStart(64,"0");
      const base={address:C.TOKEN,fromBlock:"0x"+start.toString(16),toBlock:"0x"+until.toString(16)};
      ledger={...ledger,status:"syncing",progress:Math.min(99,Math.floor(until/Math.max(1,end)*100)),error:null};
      await saveLedger(w,ledger,cache);
      const results=await Promise.all([
        rpc("eth_getLogs",[{...base,topics:[L.TRANSFER,topic]}]),
        rpc("eth_getLogs",[{...base,topics:[L.TRANSFER,null,topic]}])
      ]);
      if(results.some(r=>!Array.isArray(r)))throw Error("RPC не вернул журнал CRH");
      const ids=[...new Set(results.flat().filter(l=>!l.removed).map(l=>L.hash(l.transactionHash)).filter(Boolean))];
      const existing=new Map(records.map(r=>[r.id,r]));
      const chunk=[];
      for(const id of ids){
        const [tx,receipt]=await Promise.all([rpc("eth_getTransactionByHash",[id]),rpc("eth_getTransactionReceipt",[id])]);
        if(!tx||!receipt)throw Error("Транзакция ещё не доступна");
        let time=null;
        if(!tx.blockTimestamp||BigInt(tx.blockTimestamp)===0n){const block=await rpc("eth_getBlockByNumber",[tx.blockNumber,false]);time=Number(BigInt(block.timestamp))*1000;}
        const decoded=L.decode(tx,receipt,w,time);
        if(decoded){
          const old=existing.get(id);
          if(old?.blockHash===decoded.blockHash){decoded.totalUSD=old.totalUSD;decoded.gasUSD=old.gasUSD;decoded.usdSource=old.usdSource;decoded.priceUSD=old.priceUSD;}
          await fillUSD(decoded,cache);chunk.push(decoded);
        }
      }
      records=records.filter(r=>r.block<start||r.block>until).concat(chunk).sort((a,b)=>a.block-b.block||(a.index??0)-(b.index??0));
      ledger={...ledger,records,cursor:until,complete:until===end,status:until===end?"ready":"syncing",progress:until===end?100:ledger.progress,at:Date.now(),error:null};
      await saveLedger(w,ledger,cache);
      start=until+1;
    }
    // Retry unavailable historical valuations without rescanning the chain.
    for(const r of records.filter(r=>(r.nativeWei&&r.totalUSD===null)||r.gasUSD===null).slice(-30))await fillUSD(r,cache);
    ledger={...ledger,records,complete:true,status:"ready",progress:100,at:Date.now(),error:null};
    await saveLedger(w,ledger,cache);await enrichOrders(w,records);
    return {ok:true};
  }catch(e){
    if(w){ledger={...(ledger||{wallet:w,records:[]}),status:"error",error:String(e.message).slice(0,150)};await saveLedger(w,ledger,cache)}
    return {ok:false,error:String(e.message)};
  }finally{ledgerBusy=false;if(ledgerQueued){ledgerQueued=false;syncLedger()}}
}
