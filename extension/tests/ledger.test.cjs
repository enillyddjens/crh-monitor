const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../shared.js'),L=require('../ledger.js'),w='0x'+'2'.repeat(40);
const qty=n=>(BigInt(n)*10n**18n).toString(),word=n=>BigInt(n).toString(16).padStart(64,'0'),topic=a=>'0x'+a.slice(2).padStart(64,'0'),id=n=>'0x'+word(n);
const vault=C.VAULT.toLowerCase(),token=C.TOKEN.toLowerCase(),other='0x'+'1'.repeat(40);
const log=(from,to,n,coin=token)=>({address:coin,topics:[L.TRANSFER,topic(from),topic(to)],data:'0x'+word(n)});
function input(){return {tx:{hash:id(1),from:w,to:L.PONS,input:'0x',value:'0x1000',blockNumber:'0x20',blockTimestamp:'0x6ac61cfc',transactionIndex:'0x2'},receipt:{status:'0x1',transactionHash:id(1),blockHash:id(200),gasUsed:'0x5208',effectiveGasPrice:'0x5',logs:[]}}}
function row(n,type,quantity,total,extra={}){return {id:id(n),wallet:w,block:n,index:0,at:1000*n,quantityWei:qty(quantity),direction:['buy','reward','incoming'].includes(type)?1:-1,type,label:type,totalUSD:total,gasWei:'0',gasUSD:0,usdSource:'manual',...extra}}
const ledger=records=>({wallet:w,complete:true,records}),analyze=(records,balance,price=1,claim=0,corrections={})=>L.analyze(ledger(records),corrections,{},qty(balance),claim,price);
test('Pons actual input excludes refunded tx.value and matches received CRH',()=>{
 const {tx,receipt}=input();tx.value='0x'+word(1000);
 receipt.logs=[log(other,w,100),{address:L.PONS,topics:['0xd3f0ba705700f03a5300beb0559400f172fc82deed37ea7dd206fc2eea87de02',topic(w),topic(w),id(99)],data:'0x'+[1,2,300,100].map(word).join('')}];
 const r=L.decode(tx,receipt,w);assert.equal(r.type,'buy');assert.equal(r.nativeWei,'300');assert.equal(r.totalUSD,null);assert.equal(r.gasWei,'105000');assert.equal(r.index,2);
 receipt.logs[1].data='0x'+[1,2,300,101].map(word).join('');assert.equal(L.decode(tx,receipt,w).type,'incoming');
});
test('USDG multi-hop buys use wallet net stable outflow, never classify as gifts',()=>{
 const {tx,receipt}=input();tx.to=other;receipt.logs=[log(w,other,22000000,L.USDG),log(other,w,BigInt(qty(500)))];
 const r=L.decode(tx,receipt,w);assert.equal(r.type,'buy');assert.equal(r.totalUSD,22);assert.equal(r.priceUSD,.044);
});
test('USDG sale net proceeds and WETH flows are recognized',()=>{
 const {tx,receipt}=input();tx.to=other;receipt.logs=[log(w,other,BigInt(qty(40))),log(other,w,20000000,L.USDG)];
 assert.equal(L.decode(tx,receipt,w).type,'sell');assert.equal(L.decode(tx,receipt,w).totalUSD,20);
 receipt.logs=[log(other,w,BigInt(qty(40))),log(w,other,BigInt(qty(1)),L.WETH)];assert.equal(L.decode(tx,receipt,w).nativeWei,qty(1));
});
test('three-way game split is counted once and on-chain USD price is exact',()=>{
 const {tx,receipt}=input();tx.to=L.SHOP;const args=[word(91),topic(w).slice(2),topic(token).slice(2),topic(other).slice(2),word(25000000),...Array(8).fill(word(0))];tx.input='0xe46d96a9'+args.join('');
 receipt.logs=[log(w,vault,600n*10n**18n),log(w,other,200n*10n**18n),log(w,'0x'+'0'.repeat(40),200n*10n**18n),{address:L.SHOP,topics:['0xcc6da382b81b68b677e2508a01be5737022fffaab341ba1ce928a27f920a2d56',id(91)],data:'0x'+[25000000,25000000000000000n,1000n*10n**18n].map(word).join('')}];
 const r=L.decode(tx,receipt,w);assert.equal(r.type,'game');assert.equal(r.totalUSD,25);assert.equal(r.quantityWei,qty(1000));assert.equal(r.priceUSD,.025);assert.equal(r.orderId,id(91));
 receipt.logs.pop();assert.equal(L.decode(tx,receipt,w).type,'outgoing');
});
test('reverted transactions are ignored; vault payouts have zero acquisition cost',()=>{
 const {tx,receipt}=input();receipt.logs=[log(vault,w,BigInt(qty(2)))];assert.equal(L.decode(tx,receipt,w).type,'reward');
 receipt.status='0x0';assert.equal(L.decode(tx,receipt,w),null);
});
test('unknown transfers need classification and never become free purchases',()=>{
 const {tx,receipt}=input();receipt.logs=[log(other,w,BigInt(qty(10)))];tx.from=other;
 const r=L.decode(tx,receipt,w);assert.equal(r.type,'incoming');assert.equal(r.totalUSD,null);assert.equal(L.analyze(ledger([r]),{},{},qty(10),0,1).ready,false);
});
test('game payments are not subtracted twice from whole-project PnL',()=>{
 const r=analyze([row(1,'buy',100,100),row(2,'game',30,30)],70);assert.equal(r.pnl,-30);assert.equal(r.gameSpend,30);assert.equal(r.gameFX,0);
});
test('buy cheaper and spend after price rises tracks token gain and game expense',()=>{
 const r=analyze([row(1,'buy',100,100),row(2,'game',30,60)],70,2);
 assert.equal(r.pnl,40);assert.equal(r.gameFX,30);assert.equal(r.unrealized,70);assert.equal(r.gameSpend,60);assert.equal(r.rows[1].acquisitionPriceUSD,1);
 assert.equal(r.pnl,r.realized+r.unrealized+r.gameFX-r.gameSpend-r.gas);
});
test('average acquisition cost and realized sales are chronological within a block',()=>{
 const a=row(2,'buy',100,200,{block:3,index:1}),b=row(1,'buy',100,100,{block:3,index:0}),sell=row(3,'sell',40,100,{block:3,index:2});
 const r=analyze([sell,a,b],160,2);assert.equal(r.averageBuy,1.5);assert.equal(r.realized,40);assert.equal(r.unrealized,80);assert.equal(r.pnl,120);
});
test('claiming moves rewards into wallet without increasing PnL again',()=>{
 const before=analyze([row(1,'buy',100,100)],100,1,10),after=analyze([row(1,'buy',100,100),row(2,'reward',10,0)],110,1,0);
 assert.equal(before.pnl,10);assert.equal(after.pnl,10);assert.equal(after.unrealized,10);
});
test('actual gas affects PnL; missing historical gas stays an explicit limitation',()=>{
 const r=analyze([row(1,'buy',100,100,{gasUSD:1})],100);assert.equal(r.pnl,-1);
 const missing=analyze([row(1,'buy',100,100,{gasWei:'100',gasUSD:null})],100);assert.equal(missing.unresolvedGas,true);assert.equal(missing.pnl,0);
});
test('missing purchase price, partial scan, or balance mismatch blocks total PnL',()=>{
 assert.equal(analyze([row(1,'buy',100,null)],100).pnl,null);
 assert.equal(L.analyze({wallet:w,complete:false,records:[row(1,'buy',100,100)]},{},{},qty(100),0,1).pnl,null);
 assert.equal(analyze([row(1,'buy',100,100)],99).pnl,null);
 assert.equal(L.analyze({...ledger([]),error:'RPC unavailable'},{},{},qty(0),0,1).pnl,null);
});
test('manual correction unlocks cost and remains isolated to its wallet and transaction',()=>{
 const purchase=row(1,'buy',100,null),correction=L.sanitizeCorrection({id:purchase.id,wallet:w,type:'buy',totalUSD:90,label:'Покупка за ETH',gasUSD:.2,signature:'secret'});
 const r=analyze([purchase],100,1,0,{[purchase.id]:correction});assert.equal(r.pnl,9.8);assert(!('signature'in correction));
 assert.equal(analyze([purchase],100,1,0,{[purchase.id]:{...correction,wallet:other}}).pnl,null);
 assert.equal(L.sanitizeCorrection({id:'bad',wallet:w}),null);
});
test('direction-changing correction cannot turn spending into earned reward',()=>{
 const spend=row(2,'game',30,30);assert.equal(L.effective(spend,{id:spend.id,wallet:w,type:'reward',totalUSD:null},null).type,'game');
});
test('order labels and launch price join on order ID without creating an expense',()=>{
 const order=C.sanitizeOrder({id:id(25),wallet:w,action:'build',args:{id:'plot-1',secret:'x'},quotePriceUSD:.025,signature:'secret'});
 assert.equal(order.label,'Plot 2');assert(!JSON.stringify(order).includes('secret'));
 const spend=row(2,'game',1000,25,{orderId:id(25)}),joined=L.effective(spend,null,order);
 assert.equal(joined.label,'Plot 2');assert.equal(joined.quotePriceUSD,.025);assert.equal(L.analyze(ledger([]),{}, {[order.id]:order},qty(0),0,1).gameSpend,0);
});
test('older game snapshot cannot count a newly claimed payout a second time',()=>{
 const l=ledger([row(1,'reward',10,0,{at:2000})]);assert.equal(L.claimableAt(l,10,1999),null);assert.equal(L.claimableAt(l,0,2001),0);assert.equal(L.claimableAt(l,10,null),null);
});
test('relayed swap is valued by wallet flows even when tx.from is the relayer',()=>{
 const {tx,receipt}=input();tx.from=other;tx.to=other;receipt.logs=[log(w,other,12699827,L.USDG),log(other,w,BigInt(qty(500)))];
 const r=L.decode(tx,receipt,w);assert.equal(r.type,'buy');assert.equal(r.totalUSD,12.699827);assert.equal(r.gasWei,'0');
});