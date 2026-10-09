const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../shared.js'),L=require('../ledger.js'),w='0x'+'2'.repeat(40),word=n=>BigInt(n).toString(16).padStart(64,'0'),topic=a=>'0x'+a.slice(2).padStart(64,'0'),id=n=>'0x'+word(n),other='0x'+'1'.repeat(40);
function harness(){
 const store={settings:{...C.defaults(),wallet:w,language:"ru"}},calls=[],ranges=[];let failAt=null,tip=84000012,present=true,fetches=0,failPrice=false;
 const tx={hash:id(1),from:other,to:other,blockNumber:'0x'+(83000000).toString(16),blockTimestamp:'0x6ac61cfc',input:'0x',transactionIndex:'0x2'};
 const receipt={status:'0x1',transactionHash:id(1),blockHash:id(99),gasUsed:'0x1',effectiveGasPrice:'0x1',logs:[{address:C.TOKEN.toLowerCase(),topics:[L.TRANSFER,topic(other),topic(w)],data:'0x'+word(100n*10n**18n),transactionHash:id(1),blockNumber:tx.blockNumber},{address:L.USDG,topics:[L.TRANSFER,topic(w),topic(other)],data:'0x'+word(100000000)}]};
 const sandbox={C,CRHLedger:L,URL,Date,Math,BigInt,Number,String,Map,Set,Promise,AbortSignal,
 chrome:{storage:{local:{get:async keys=>typeof keys==='string'?{[keys]:structuredClone(store[keys])}:Object.fromEntries(keys.map(k=>[k,structuredClone(store[k])])),set:async data=>Object.assign(store,structuredClone(data))}},tabs:{query:async()=>[],sendMessage:async()=>{}}},
 rpc:async(method,params)=>{
  calls.push(method);if(method==='eth_blockNumber')return '0x'+tip.toString(16);
  if(method==='eth_getLogs'){const f=params[0],start=Number(BigInt(f.fromBlock)),end=Number(BigInt(f.toBlock));ranges.push([start,end]);if(failAt!==null&&start>=failAt)throw Error('temporary RPC failure');return present&&start<=83000000&&end>=83000000&&f.topics[2]===topic(w)?[receipt.logs[0]]:[];}
  if(method==='eth_getTransactionByHash')return tx;if(method==='eth_getTransactionReceipt')return receipt;throw Error('unexpected method '+method);
 },fetch:async url=>{fetches++;if(failPrice)throw Error('unavailable');const minute=Date.parse(new URL(url).searchParams.get('start'))/1000+60;return {ok:true,json:async()=>[[minute-60,1,1,1000,1,1],[minute,1,1,2000,1,1]]};}
 };
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../ledger-sync.js'),'utf8'),sandbox);
 return {store,calls,ranges,run:()=>vm.runInContext('syncLedger()',sandbox),eval:code=>vm.runInContext(code,sandbox),setFail:n=>{failAt=n},setTip:n=>{tip=n},remove:()=>{present=false},fetchCount:()=>fetches,setFailPrice:v=>{failPrice=v}};
}
test('initial indexed scan is bounded and subsequent refresh only scans overlap',async()=>{
 const h=harness();assert.equal((await h.run()).ok,true);const l=h.store.ledgers[w];assert(l.complete);assert.equal(l.records.length,1);assert.equal(l.records[0].totalUSD,100);
 assert.equal(h.ranges.length,18);assert(h.ranges.every(([a,b])=>b-a+1<=10000000));assert(h.calls.every(m=>['eth_blockNumber','eth_getLogs','eth_getTransactionByHash','eth_getTransactionReceipt'].includes(m)));
 const start=h.ranges.length;assert.equal((await h.run()).ok,true);assert.equal(h.ranges.length-start,2);assert(h.ranges.slice(start).every(([a,b])=>b-a+1===32));
});
test('failed scan saves cursor and resumes instead of accepting partial PnL',async()=>{
 const h=harness();h.setFail(10000000);assert.equal((await h.run()).ok,false);assert.equal(h.store.ledgers[w].cursor,9999999);assert.equal(h.store.ledgers[w].complete,false);
 h.setFail(null);const n=h.ranges.length;assert.equal((await h.run()).ok,true);assert.equal(h.ranges[n][0],9999968);assert(h.store.ledgers[w].complete);
});
test('reorg overlap removes replaced transactions and handles a lower tip',async()=>{
 const h=harness();await h.run();h.setTip(83000015);await h.run();assert.equal(h.store.ledgers[w].cursor,83000003);h.remove();await h.run();assert.equal(h.store.ledgers[w].records.length,0);
 h.setTip(82000012);await h.run();assert.equal(h.store.ledgers[w].cursor,82000000);assert(h.store.ledgers[w].complete);
});
test('historical USD uses the exact minute opening price and reuses cache',async()=>{
 const h=harness();h.eval('var priceCache={},priced={at:1791485180000,totalUSD:null,nativeWei:"1000000000000000000",quantityWei:"100000000000000000000",gasWei:"1000000000000000",gasUSD:null};');
 const r=await h.eval('fillUSD(priced,priceCache)');assert.equal(r.totalUSD,2000);assert.equal(r.priceUSD,20);assert.equal(r.gasUSD,2);await h.eval('fillUSD(priced,priceCache)');assert.equal(h.fetchCount(),1);
});
test('unavailable historical rate stays unknown with a bounded retry',async()=>{
 const h=harness();h.setFailPrice(true);h.eval('var priceCache={},priced={at:1791485180000,totalUSD:null,nativeWei:"1000000000000000000",quantityWei:"100000000000000000000",gasWei:"0",gasUSD:null};');
 const r=await h.eval('fillUSD(priced,priceCache)');assert.equal(r.totalUSD,null);assert.equal(r.gasUSD,0);await h.eval('fillUSD(priced,priceCache)');assert.equal(h.fetchCount(),1);
});