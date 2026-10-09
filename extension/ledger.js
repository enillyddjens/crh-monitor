/* Read-only transaction decoding and cash-flow PnL. No wallet provider is used. */
(() => {
  "use strict";
  const C=globalThis.CRHMonitor||(typeof require==="function"?require("./shared.js"):null);
  const SHOP="0x7546cd0c825d1ea8050b2dc4b41b0c28a5b5e5e1";
  const PONS="0x6861639c7b7e70021deb1786941afeb7659ddd45";
  const TRANSFER="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const PONS_TRADE="0xd3f0ba705700f03a5300beb0559400f172fc82deed37ea7dd206fc2eea87de02";
  const USD_PAID="0xcc6da382b81b68b677e2508a01be5737022fffaab341ba1ce928a27f920a2d56";
  const USDG="0x5fc5360d0400a0fd4f2af552add042d716f1d168";
  const WETH="0x0bd7d308f8e1639fab988df18a8011f41eacad73";
  const hash=v=>typeof v==="string"&&/^0x[0-9a-f]{64}$/i.test(v)?v.toLowerCase():null;
  const hex=v=>typeof v==="string"&&/^0x[0-9a-f]+$/i.test(v)?v:null;
  const addrTopic=v=>typeof v==="string"&&/^0x[0-9a-f]{64}$/i.test(v)?C.wallet("0x"+v.slice(-40)):null;
  const words=v=>hex(v)&&v.length>=66?(v.slice(2).match(/.{64}/g)||[]):[];
  const uint=v=>BigInt("0x"+v);
  function netTransfers(logs,token,w) {
    let value=0n;
    for(const l of logs||[]){
      if(l.removed||C.wallet(l.address)!==token||l.topics?.[0]?.toLowerCase()!==TRANSFER||!hex(l.data))continue;
      const n=BigInt(l.data),from=addrTopic(l.topics[1]),to=addrTopic(l.topics[2]);
      if(to===w)value+=n;if(from===w)value-=n;
    }
    return value;
  }
  function decode(tx,receipt,selected,blockTime=null){
    const w=C.wallet(selected),id=hash(tx?.hash),logs=receipt?.logs;
    if(!w||!id||receipt?.status!=="0x1"||hash(receipt.transactionHash)!==id||!Array.isArray(logs))return null;
    const delta=netTransfers(logs,C.TOKEN.toLowerCase(),w);
    if(!delta)return null;
    const input=tx.input||"",callWords=words("0x"+input.slice(10)),caller=C.wallet(tx.from);
    const at=hex(tx.blockTimestamp)&&BigInt(tx.blockTimestamp)>0n?Number(BigInt(tx.blockTimestamp))*1000:blockTime;
    const qty=delta<0n?-delta:delta;
    const gas=caller===w&&hex(receipt.gasUsed)&&hex(receipt.effectiveGasPrice)?(BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice)).toString():"0";
    const item={id,wallet:w,block:Number(BigInt(tx.blockNumber)),index:Number(BigInt(tx.transactionIndex??receipt.transactionIndex??"0x0")),blockHash:hash(receipt.blockHash),at,
      quantityWei:qty.toString(),direction:delta>0n?1:-1,type:delta>0n?"incoming":"outgoing",
      label:delta>0n?"Входящий перевод":"Исходящий перевод",totalUSD:null,nativeWei:null,gasWei:gas,gasUSD:null,
      usdSource:null,orderId:null,priceUSD:null};
    if(delta<0n&&caller===w&&C.wallet(tx.to)===SHOP&&input.slice(0,10).toLowerCase()==="0xe46d96a9"&&callWords.length>=13&&
       addrTopic("0x"+callWords[1])===w&&addrTopic("0x"+callWords[2])===C.TOKEN.toLowerCase()){
      const amount=Number(uint(callWords[4]))/1e6,order=hash("0x"+callWords[0]);
      const paid=logs.find(l=>C.wallet(l.address)===SHOP&&l.topics?.[0]?.toLowerCase()===USD_PAID&&hash(l.topics[1])===order);
      const data=words(paid?.data);
      if(amount>0&&data.length>=3&&Number(uint(data[0]))/1e6===amount){
        Object.assign(item,{type:"game",label:"Покупка в игре",totalUSD:amount,usdSource:"onchain-usd",orderId:order,priceUSD:amount/C.units(item.quantityWei)});
        return item;
      }
    }
    const fromVault=logs.some(l=>C.wallet(l.address)===C.TOKEN.toLowerCase()&&l.topics?.[0]?.toLowerCase()===TRANSFER&&addrTopic(l.topics[1])===C.VAULT.toLowerCase()&&addrTopic(l.topics[2])===w);
    if(delta>0n&&fromVault){Object.assign(item,{type:"reward",label:"Вывод наград",totalUSD:0,usdSource:"reward"});return item;}
    const stable=netTransfers(logs,USDG,w),wrapped=netTransfers(logs,WETH,w);
    if((delta>0n&&stable<0n)||(delta<0n&&stable>0n)){
      Object.assign(item,{type:delta>0n?"buy":"sell",label:delta>0n?"Покупка CRH":"Продажа CRH",
        totalUSD:Number(stable<0n?-stable:stable)/1e6,usdSource:"usdg-peg"});
      item.priceUSD=item.totalUSD/C.units(item.quantityWei);return item;
    }
    let native=wrapped!==0n&&((delta>0n&&wrapped<0n)||(delta<0n&&wrapped>0n))?(wrapped<0n?-wrapped:wrapped):null;
    if(native===null&&C.wallet(tx.to)===PONS){
      const trade=logs.find(l=>C.wallet(l.address)===PONS&&l.topics?.[0]?.toLowerCase()===PONS_TRADE&&addrTopic(l.topics[1])===w&&addrTopic(l.topics[2])===w);
      const d=words(trade?.data);
      if(d.length===4){
        // Cross-check the reported token quantity; tx.value includes a refunded cap and is never used as cost.
        if(delta>0n&&uint(d[3])===qty)native=uint(d[2]);
        if(delta<0n&&uint(d[2])===qty)native=uint(d[3]);
      }
    }
    if(native!==null&&native>0n){
      Object.assign(item,{type:delta>0n?"buy":"sell",label:delta>0n?"Покупка CRH":"Продажа CRH",nativeWei:native.toString(),usdSource:"needs-eth-usd"});
    }
    return item;
  }
  function sanitizeCorrection(v){
    if(!v||!hash(v.id)||!C.wallet(v.wallet))return null;
    const type=["buy","sell","game","reward","incoming","outgoing","withdrawal"].includes(v.type)?v.type:null;
    return {id:hash(v.id),wallet:C.wallet(v.wallet),type,label:typeof v.label==="string"?v.label.trim().slice(0,100):null,
      totalUSD:C.number(v.totalUSD),gasUSD:C.number(v.gasUSD)};
  }
  function effective(record,correction,order){
    const r={...record,labelIsCustom:false};
    if(order?.wallet===r.wallet&&order.id===r.orderId){r.label=order.label||r.label;r.quotePriceUSD=order.quotePriceUSD??null;}
    if(correction?.wallet===r.wallet&&correction.id===r.id){
      if(correction.type&&(r.direction>0?["buy","reward","incoming"]:["sell","game","withdrawal","outgoing"]).includes(correction.type)){r.type=correction.type;if(r.type==="reward")r.totalUSD=0;}
      if(correction.label){r.label=correction.label;r.labelIsCustom=true;}
      if(correction.totalUSD!==null&&correction.totalUSD!==undefined){r.totalUSD=correction.totalUSD;r.usdSource="manual";}
      if(correction.gasUSD!==null&&correction.gasUSD!==undefined)r.gasUSD=correction.gasUSD;
    }
    r.priceUSD=r.totalUSD!==null&&r.type!=="reward"?r.totalUSD/C.units(r.quantityWei):null;
    return r;
  }
  function claimableAt(ledger,amount,observedAt){
    if(amount===null||!observedAt)return null;
    // Do not count old unclaimed rewards after a newer on-chain payout already entered the wallet.
    return (ledger?.records||[]).some(r=>r.type==="reward"&&r.at>observedAt)?null:amount;
  }
  function analyze(ledger,corrections={},orders={},balanceWei=null,claimable=null,price=null){
    const rows=(ledger?.records||[]).map(r=>effective(r,corrections[r.id],orders[r.orderId])).sort((a,b)=>a.block-b.block||(a.index??0)-(b.index??0)||a.id.localeCompare(b.id));
    const issues=[];let buys=0,sales=0,gameSpend=0,gas=0,boughtQty=0,boughtCost=0,inventory=0n;
    let inventoryQty=0,inventoryCost=0,realized=0,gameFX=0,unresolvedGas=false;
    for(const r of rows){
      const qty=C.units(r.quantityWei);
      inventory+=BigInt(r.quantityWei)*BigInt(r.direction);
      if(r.gasUSD===null&&BigInt(r.gasWei||"0")>0n)unresolvedGas=true;else gas+=r.gasUSD??0;
      if(["incoming","outgoing"].includes(r.type)||(["buy","sell","game","withdrawal"].includes(r.type)&&r.totalUSD===null)){
        issues.push(r.id);continue;
      }
      if(r.type==="buy"){
        buys+=r.totalUSD;boughtCost+=r.totalUSD;boughtQty+=qty;inventoryQty+=qty;inventoryCost+=r.totalUSD;
      }else if(r.type==="reward"){inventoryQty+=qty;}
      else if(["sell","game","withdrawal"].includes(r.type)){
        const allocated=inventoryQty>0?inventoryCost*Math.min(1,qty/inventoryQty):0;
        r.acquisitionPriceUSD=inventoryQty>0?inventoryCost/inventoryQty:null;
        if(r.type==="game"){gameSpend+=r.totalUSD;gameFX+=r.totalUSD-allocated;}
        else{sales+=r.totalUSD;realized+=r.totalUSD-allocated;}
        inventoryQty=Math.max(0,inventoryQty-qty);inventoryCost=Math.max(0,inventoryCost-allocated);
      }
    }
    const balanceMatches=C.wei(balanceWei)!==null&&inventory===BigInt(balanceWei);
    const walletValue=C.units(balanceWei)!==null&&price!==null?C.units(balanceWei)*price:null;
    const claimValue=claimable!==null&&price!==null?claimable*price:0;
    const ready=!!ledger?.complete&&!ledger?.error&&!issues.length&&balanceMatches&&walletValue!==null;
    return {rows,issues,ready,balanceMatches,buys,sales,gameSpend,gas,boughtQty,
      averageBuy:boughtQty>0&&!issues.length?boughtCost/boughtQty:null,
      pnl:ready?walletValue+claimValue+sales-buys-gas:null,
      realized:ready?realized:null,unrealized:ready?walletValue-inventoryCost+claimValue:null,
      gameFX:ready?gameFX:null,unresolvedGas,claimIncluded:claimable!==null,
      inventoryWei:inventory.toString(),walletValue,claimValue};
  }
  const api={SHOP,PONS,TRANSFER,USDG,WETH,hash,hex,netTransfers,decode,sanitizeCorrection,effective,claimableAt,analyze};
  globalThis.CRHLedger=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
