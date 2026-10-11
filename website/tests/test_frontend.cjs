const path=require('node:path');
process.chdir(path.resolve(__dirname,'..'));
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/assets/js/store.js','utf8');
async function run(protocol){
 const nodes=new Map(), storage=new Map(), calls=[];
 const node=selector=>{if(!nodes.has(selector)){nodes.set(selector,{id:selector.startsWith('#')?selector.slice(1):selector,textContent:'',innerHTML:'',value:'',hidden:false,disabled:false,required:true,dataset:{},style:{setProperty(){}},classList:{toggle(){}},addEventListener(type,fn){this[type]=fn},setAttribute(){},closest(){return null},focus(){doc.activeElement=this},append(){},appendChild(){},replaceChildren(){},reportValidity(){return true},reset(){this.wasReset=true},querySelector(s){return node(selector+' '+s)}})}return nodes.get(selector)};
 const screens=['catalog','product','cart','checkout','success'].map(node);
 screens.forEach((el,i)=>el.id=['catalog','product','cart','checkout','success'][i]);
 const doc={activeElement:null,documentElement:node('html'),querySelector:node,querySelectorAll(s){if(s==='.screen')return screens;return []},addEventListener(type,fn){this[type]=fn},createElement(){return node('created'+Math.random())}};
 node('[name="delivery"]:checked').value='post';node('#search-demo').value='';node('#sort-demo').value='new';
 const context={document:doc,window:{scrollTo(){},addEventListener(){},open(){}},location:{protocol,hash:'#catalog',replace(hash){this.hash=hash}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> 'fixed-test-token'},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn(),FormData:class{constructor(){this.values={fullname:'Тестовый покупатель',phone:'+79991234567',delivery:'post',address:'Тестовый адрес'}}get(k){return this.values[k]}},fetch:async(path,opts)=>{calls.push([path,opts]);if(path==='/api/shop')return{ok:true,json:async()=>({products:[{id:0,name:'Лампа',category:'Дом',price:4900,photos:[],properties:[],photo:0}],settings:{accent:'#2864e8',background:'#ffffff',text:'#182231',name:'Shoply'}})};if(context.failOrder)throw Error('Потеря соединения');return{ok:true,json:async()=>({id:41,total:4900,delivery:'post'})}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('public/assets/js/products.js','utf8'),context);vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));
 if(protocol==='file:'){assert.equal(node('[form="demo-order"]').disabled,true);assert.equal(node('#order-fields').disabled,true);return;}
 assert.equal(vm.runInContext('serverReady',context),true);
 const clickControl=dataset=>doc.click({target:{closest(selector){return selector==='[data-add]' && dataset.add!==undefined || selector==='[data-quantity]' && dataset.quantity!==undefined ? {dataset} : null}}});
 clickControl({add:'0'});
 assert.equal(vm.runInContext('basket[0]',context),1);
 assert.match(vm.runInContext('purchaseControl(0)',context),/data-quantity="0"/);
 clickControl({quantity:'0',delta:'1'});
 assert.equal(vm.runInContext('basket[0]',context),2);
 assert.equal(node('#basket-count').textContent,2);
 assert.equal(JSON.parse(storage.get('shoply-basket'))[0],2);
 clickControl({quantity:'0',delta:'-1'});
 clickControl({quantity:'0',delta:'-1'});
 assert.equal(vm.runInContext('cartState().count',context),0);
 assert.match(vm.runInContext('purchaseControl(0)',context),/data-add="0"/);
 vm.runInContext('basket={0:999}',context);
 clickControl({quantity:'0',delta:'1'});
 assert.equal(vm.runInContext('basket[0]',context),999);
 assert.match(vm.runInContext('purchaseControl(0, true)',context),/disabled/);
 vm.runInContext('basket={};sync()',context);

 context.location.hash='#checkout';vm.runInContext('screen()',context);assert.equal(context.location.hash,'#cart');
 vm.runInContext('basket={0:1};sync()',context);assert.equal(node('[form="demo-order"]').disabled,false);
 context.location.hash='#checkout';vm.runInContext('screen()',context);assert.equal(node('checkout').hidden,false);
 const form=node('#demo-order');let prevented=false;context.failOrder=true;
 await form.submit({preventDefault(){prevented=true},currentTarget:form});assert(prevented);assert.equal(storage.get('shoply-pending-token'),'fixed-test-token');assert.equal(vm.runInContext('cartState().count',context),1);assert.equal(node('[form="demo-order"]').disabled,false);
 context.failOrder=false;await form.submit({preventDefault(){},currentTarget:form});assert.equal(context.location.hash,'success');assert.equal(node('#order-number').textContent,41);assert.equal(vm.runInContext('cartState().count',context),0);assert.equal(storage.has('shoply-pending-token'),false);
 const total=node('#success [data-total]').textContent;vm.runInContext('basket={0:2};sync()',context);assert.equal(node('#success [data-total]').textContent,total);
 const requests=calls.filter(([path])=>path==='/api/orders').map(([,opts])=>JSON.parse(opts.body));assert.equal(requests.length,2);assert.equal(requests[0].token,requests[1].token);assert.equal(requests[1].items[0].id,0);
}
(async()=>{await run('http:');await run('file:');console.log('OK: переход к оформлению, пустая корзина, сбой/повтор, подтверждение, file-mode.');})().catch(error=>{console.error(error);process.exitCode=1});
