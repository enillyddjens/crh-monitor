const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../shared.js'),w='0x'+'2'.repeat(40),other='0x'+'1'.repeat(40),id='0x'+'a'.repeat(64);
function harness(){const emitted=[],handlers={};let delayed=null;const original=async(input)=>{const u=new URL(input);if(u.pathname==='/api/web3/orders/quote'){await new Promise(resolve=>{delayed=resolve});return {ok:true,clone:()=>({text:async()=>JSON.stringify({quote:{orderId:id},tokenUsdPrice18:'500000000000000'})})};}return {ok:true,clone:()=>({text:async()=>JSON.stringify(u.pathname==='/api/web3/state'?{wallet:new URL(input).searchParams.get('w')||w,chain_id:4663,token:C.TOKEN}:{order:{order_id:id,action:'purchase_confirmed'},tokenUsdPrice18:'800000000000000'})})};};const window={fetch:original,postMessage:m=>emitted.push(m),addEventListener:(k,fn)=>{handlers[k]=fn}};const sandbox={CRHMonitor:C,CRHProject:require("../project.js"),window,location:{href:'https://www.computersrh.xyz/play/island',origin:'https://www.computersrh.xyz'},URL,Headers,Request,Date,JSON,Map,setInterval:()=>{},document:{hidden:false},AbortSignal};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../bridge.js'),'utf8'),sandbox);return {window,emitted,release:()=>delayed()};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('observed quote retains flat build metadata and account after wallet switches, then survives confirmation',async()=>{
 const h=harness();await h.window.fetch('https://www.computersrh.xyz/api/web3/state',{headers:{'X-Wallet-Address':w,'X-Session-Version':'1'}});await flush();
 const pending=h.window.fetch('https://www.computersrh.xyz/api/web3/orders/quote',{method:'POST',body:JSON.stringify({action:'build',id:'plot-2',signature:'secret'})});
 await h.window.fetch('https://www.computersrh.xyz/api/web3/state',{headers:{'X-Wallet-Address':other,'X-Session-Version':'1'}});h.release();await pending;await flush();
 const quote=h.emitted.findLast(m=>m.type==='CRH_MONITOR_ORDER_V2').order;assert.equal(quote.wallet,w);assert.equal(quote.label,'Plot 3');assert.equal(quote.quotePriceUSD,.0005);assert(!JSON.stringify(quote).includes('secret'));
 await h.window.fetch('https://www.computersrh.xyz/api/web3/orders/confirm',{method:'POST',body:JSON.stringify({order_id:id})});await flush();
 // A response without buyer belongs to the request's current wallet, not cached data from another account.
 const cross=h.emitted.findLast(m=>m.type==='CRH_MONITOR_ORDER_V2').order;assert.equal(cross.wallet,other);assert.equal(cross.label,'Покупка в игре');
 await h.window.fetch('https://www.computersrh.xyz/api/web3/state',{headers:{'X-Wallet-Address':w,'X-Session-Version':'1'}});await h.window.fetch('https://www.computersrh.xyz/api/web3/orders/confirm',{method:'POST',body:JSON.stringify({order_id:id})});await flush();
 // Per-wallet bridge caches retain the original quote across account switches.
 const final=h.emitted.findLast(m=>m.type==='CRH_MONITOR_ORDER_V2').order;assert.equal(final.wallet,w);assert.equal(final.label,'Plot 3');assert.equal(final.quotePriceUSD,.0005);
});
