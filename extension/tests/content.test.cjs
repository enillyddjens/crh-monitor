const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../shared.js'),L=require('../ledger.js'),w='0x'+'2'.repeat(40),id='0x'+'a'.repeat(64);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function listeners(){const values=new Set();return{values,addListener:f=>values.add(f),removeListener:f=>values.delete(f)}}
function harness(options={}){
 const calls=[],windowListeners=new Map(),cleared=[],elements=[],posted=[];let callbacks,tick;
 function element(tag){const value={tag,style:{},children:[],events:new Map(),append(...nodes){this.children.push(...nodes)},attachShadow(){this.shadow=element('shadow');return this.shadow},addEventListener(k,f){if(!this.events.has(k))this.events.set(k,[]);this.events.get(k).push(f)}};elements.push(value);return value;}
 const document={readyState:'complete',body:element('body'),createElement:element,addEventListener(){},removeEventListener(){}};
 const window={addEventListener:(k,f)=>{if(!windowListeners.has(k))windowListeners.set(k,new Set());windowListeners.get(k).add(f)},removeEventListener:(k,f)=>windowListeners.get(k)?.delete(f),postMessage:m=>posted.push(m)};
 const runtime={id:'testing-id',onMessage:listeners(),sendMessage:m=>{calls.push(m);if(options.syncError)throw Error(options.syncError);if(options.asyncError)return Promise.reject(Error(options.asyncError));return Promise.resolve({ok:true});}};
 const chrome={runtime,storage:{onChanged:listeners(),local:{get:key=>{if(key==='collapsed'&&options.collapsedError)return Promise.reject(Error(options.collapsedError));return Promise.resolve(key==='collapsed'?{collapsed:false}:{settings:{...C.defaults(),wallet:w,language:"ru"}})},set:values=>{calls.push({storage:values});return Promise.resolve();}}}};
 const sandbox={CRHMonitor:C,CRHProject:require("../project.js"),CRHLedger:L,CRHI18n:require("../i18n.js"),CRHView:{create:(root,opts)=>{callbacks=opts;return{render(){}}}},chrome,document,window,location:{origin:'https://www.computersrh.xyz',reload:()=>calls.push({reload:true})},setInterval:f=>{tick=f;return 7},clearInterval:n=>cleared.push(n)};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../content.js'),'utf8'),sandbox);
 return{calls,chrome,callbacks,cleared,posted,tick:()=>tick(),mini:elements.find(e=>e.tag==='button'),dispatch:data=>{for(const f of windowListeners.get('message')||[])f({source:window,origin:sandbox.location.origin,data})},messageListeners:()=>windowListeners.get('message')?.size||0};
}
test('settings from game use a message when openOptionsPage is absent in content runtime',async()=>{
 const h=harness();await flush();assert.equal(h.chrome.runtime.openOptionsPage,undefined);await h.callbacks.onSettings();assert.equal(h.calls[0].type,'openOptions');assert.equal(h.cleared.length,0);
});
test('edit operation requests atomic background focus and navigation',async()=>{
 const h=harness();await flush();await h.callbacks.onEdit({wallet:w,id});assert.equal(h.calls.length,1);assert.equal(h.calls[0].type,'openOptions');assert.equal(h.calls[0].focusTx.wallet,w);assert.equal(h.calls[0].focusTx.id,id);
});
test('live context still forwards allowlisted snapshots and order metadata',async()=>{
 const h=harness();await flush();h.dispatch({type:'CRH_MONITOR_STATE_V1',snapshot:{wallet:w,seenAt:Date.now(),gridCapacity:475,signature:'secret'}});h.dispatch({type:'CRH_MONITOR_ORDER_V2',order:{wallet:w,id,action:'build',args:{id:'plot-2'},signature:'secret'}});await flush();assert.equal(h.calls[0].type,'snapshot');assert.equal(h.calls[0].snapshot.gridCapacity,475);assert.equal(h.calls[1].order.label,'Plot 3');assert(!JSON.stringify(h.calls).includes('secret'));
});
test('synchronous invalidation is caught, stops listeners and timer, and offers reload',async()=>{
 const h=harness();await flush();h.chrome.runtime.sendMessage=()=>{h.calls.push({attempt:true});throw Error('Extension context invalidated.')};assert.doesNotThrow(()=>h.dispatch({type:'CRH_MONITOR_STATE_V1',snapshot:{wallet:w}}));await flush();assert.equal(h.messageListeners(),0);assert.deepEqual(h.cleared,[7]);assert.match(h.mini.textContent,/перезагрузить игру/);assert.equal(h.mini.style.display,'block');await h.callbacks.onSettings();h.tick();assert.equal(h.calls.length,1);
});
test('asynchronous invalidation also stops rather than raising an unhandled rejection',async()=>{
 const h=harness({asyncError:'Extension context invalidated.'});await flush();await h.callbacks.onSettings();assert.deepEqual(h.cleared,[7]);assert.equal(h.chrome.runtime.onMessage.values.size,0);assert.equal(h.chrome.storage.onChanged.values.size,0);
});
test('timer detects invalid runtime id without calling extension APIs again',async()=>{
 const h=harness();await flush();h.chrome.runtime.id=undefined;h.tick();await h.callbacks.onSettings();assert.equal(h.calls.length,0);assert.deepEqual(h.cleared,[7]);assert.match(h.mini.textContent,/перезагрузить игру/);
});
test('ordinary collapsed-state read failure stays handled and does not stop a valid context',async()=>{
 const h=harness({collapsedError:'Temporary storage failure'});await flush();await h.callbacks.onSettings();assert.equal(h.calls[0].type,'openOptions');assert.equal(h.cleared.length,0);
});
test('collapsed-state context invalidation is handled even during mount',async()=>{
 const h=harness({collapsedError:'Extension context invalidated.'});await flush();assert.deepEqual(h.cleared,[7]);assert.equal(h.messageListeners(),0);assert.equal(h.mini.textContent,require('../i18n.js').t('CRH Monitor обновлён · перезагрузить игру',C.defaults().language));
});
function background(){
 const calls=[];let handler;const chrome={runtime:{getURL:s=>'chrome-extension://testing-id/'+s,onMessage:{addListener:f=>{handler=f}},onInstalled:listeners(),onStartup:listeners(),openOptionsPage:async()=>{calls.push({open:true})}},storage:{local:{get:async()=>({settings:{...C.defaults(),wallet:w,language:"ru"}}),set:async value=>{calls.push(value)}}},alarms:{create:async()=>{},onAlarm:listeners()}};
 const sandbox={CRHMonitor:C,CRHProject:require("../project.js"),CRHLedger:L,L,chrome,importScripts:()=>{},Promise,Date};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),sandbox);
 return{calls,message:(m,sender)=>new Promise(resolve=>{assert.equal(handler(m,sender,resolve),true)})};
}
test('background opens settings for the game content and extension UI',async()=>{
 const h=background();assert.equal((await h.message({type:'openOptions'},{url:'https://www.computersrh.xyz/play/island',tab:{id:1}})).ok,true);assert.equal((await h.message({type:'openOptions'},{url:'chrome-extension://testing-id/popup.html'})).ok,true);assert.equal(h.calls.filter(v=>v.open).length,2);
});
test('background saves selected operation before opening settings',async()=>{
 const h=background();const result=await h.message({type:'openOptions',focusTx:{wallet:w.toUpperCase().replace('0X','0x'),id}},{url:'https://www.computersrh.xyz/play/island',tab:{id:1}});assert.equal(result.ok,true);assert.equal(h.calls[0].focusTx.wallet,w);assert.equal(h.calls[0].focusTx.id,id);assert.equal(h.calls[1].open,true);
});
test('background rejects unrelated origins and invalid focus without navigation or writes',async()=>{
 const h=background();for(const sender of [{url:'https://evil.example/',tab:{id:1}},{url:'https://www.computersrh.xyz.evil/play/island',tab:{id:1}},{url:'https://www.computersrh.xyz/play/island'}])assert.equal((await h.message({type:'openOptions'},sender)).ok,false);assert.equal((await h.message({type:'openOptions',focusTx:{wallet:'bad',id}},{url:'https://www.computersrh.xyz/play/island',tab:{id:1}})).ok,false);assert.equal(h.calls.length,0);
});

test('overlay manual refresh requests both game state and selected-wallet market refresh',async()=>{
 const h=harness();await flush();await h.callbacks.onRefresh();await flush();assert(h.posted.some(m=>m.type==='CRH_MONITOR_REFRESH_V1'));assert(h.calls.some(m=>m.type==='refreshLive'));
});
