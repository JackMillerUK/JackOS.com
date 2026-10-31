import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import http from 'node:http';
import {once} from 'node:events';
import {createService,websiteURL} from '../server.mjs';
import {BrowserEngine} from '../engine.mjs';
test('legacy homepage migration preserves other custom choices',async()=>{
 const source=(await readFile(new URL('../../JackOS-System-Files/JackOS-Browser.js',import.meta.url),'utf8')).split('const browserState')[0];
 for(const [saved,expected] of [[null,'https://apple.com/uk'],['purplemash.com','https://apple.com/uk'],['https://www.purplemash.com/','https://apple.com/uk'],['https://example.com/','https://example.com/']]){
  let value=saved;const context={localStorage:{getItem:()=>value,setItem:(_,v)=>value=v}};vm.createContext(context);vm.runInContext(source,context);assert.equal(context.Browser_getHome(),expected);
 }
});
test('wheel units, coalescing, serial dispatch, reversal and cancellation',async()=>{
 const context={};vm.createContext(context);vm.runInContext(await readFile(new URL('../wheel.js',import.meta.url),'utf8'),context);
 const {normalize,create}=context.JackOSWheel;assert.equal(normalize({deltaY:3,deltaMode:1}).y,48);assert.equal(normalize({deltaY:1,deltaMode:2},500).y,500);
 let callbacks=[],sent=[],resolve;const wheel=create({schedule:f=>{callbacks.push(f);return callbacks.length;},cancel:()=>callbacks=[],dispatch:p=>{sent.push(p);return new Promise(r=>resolve=r);},height:()=>600});
 for(let i=0;i<100;i++)wheel.enqueue({deltaY:5},{x:4,y:5});assert.equal(callbacks.length,1);callbacks.shift()();await Promise.resolve();assert.equal(sent.length,1);
 for(let i=0;i<20;i++)wheel.enqueue({deltaY:10},{x:4,y:5});assert.equal(callbacks.length,0);wheel.enqueue({deltaY:-70},{x:4,y:5});resolve();await new Promise(setImmediate);callbacks.shift()();await Promise.resolve();assert.equal(sent[1].deltaY,-70);resolve();await new Promise(setImmediate);assert.equal(callbacks.length,0);
 wheel.enqueue({deltaY:100},{});wheel.stop();assert.equal(callbacks.length,0);
});
test('stream retains the final frame when scrolling stops',async()=>{
 const engine=new BrowserEngine();engine.call=async()=>({});const output=[];const s={sessionId:'test',streams:new Set([{destroyed:false,writableLength:0,write:v=>output.push(v)}])};engine.sessions.set('test',s);
 for(const image of ['first','second','final'])engine.message({sessionId:'test',method:'Page.screencastFrame',params:{sessionId:1,data:image}});
 await new Promise(r=>setTimeout(r,35));assert.equal(output.length,1);assert.match(output[0],/final/);
 engine.message({sessionId:'test',method:'Page.screencastFrame',params:{sessionId:2,data:'stopped'}});await new Promise(r=>setTimeout(r,35));assert.match(output[1],/stopped/);
});
test('HTTP(S) URLs only, no embedded credentials',()=>{
 assert.equal(websiteURL('https://apple.com/uk'),'https://apple.com/uk');
 for(const url of ['file:///etc/passwd','javascript:alert(1)','https://user:pass@example.com'])assert.throws(()=>websiteURL(url));
});
test('HTTP session ownership, origin and method guards',async()=>{
 const engine={sessions:new Map(),stop:async()=>{},dispose:async()=>{},create:async(owner)=>{const s={id:'a'.repeat(32),owner,sessionId:'s',width:800,height:600};engine.sessions.set(s.id,s);return s;},state:async()=>({url:'https://apple.com/uk'}),call:async()=>({})};
 const service=createService({port:18992,engine});service.server.listen(18992,'127.0.0.1');await once(service.server,'listening');
 const request=(path,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{const q=http.request({hostname:'127.0.0.1',port:18992,path,method,headers:{Host:'localhost:18992',...headers}},r=>{let text='';r.on('data',c=>text+=c);r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,text}));});q.on('error',reject);q.end(body);});
 try{
  assert.equal((await request('/__browser/health')).status,403);assert.equal((await request('/START-HERE.html',{headers:{Host:'evil.example'}})).status,403);
  const first=await request('/START-HERE.html');assert.equal(first.status,200);const cookie=first.headers['set-cookie'][0].split(';')[0];const headers={Cookie:cookie,Origin:'http://localhost:18992','X-JackOS-Client':'1','Content-Type':'application/json'};
  assert.equal((await request('/__browser/sessions',{method:'POST',headers:{Cookie:cookie},body:'{}'})).status,403);assert.equal((await request('/__browser/sessions',{method:'POST',headers,body:'{}'})).status,200);
  const id='a'.repeat(32);assert.equal((await request('/__browser/'+id+'/state',{headers:{Cookie:cookie}})).status,200);
  const second=await request('/START-HERE.html');const other=second.headers['set-cookie'][0].split(';')[0];assert.equal((await request('/__browser/'+id+'/state',{headers:{Cookie:other}})).status,410);
  assert.equal((await request('/__browser/'+id+'/mouse',{headers:{Cookie:cookie}})).status,405);assert.equal((await request('/__browser/'+id+'/navigate',{method:'POST',headers,body:JSON.stringify({url:'file:///etc/passwd'})})).status,400);
  assert.equal((await request('/%2e%2e%2f%2e%2e%2fetc/passwd',{headers:{Cookie:cookie}})).status,403);
  assert.equal((await request('/%2e%2e/%2e%2e/etc/passwd',{headers:{Cookie:cookie}})).status,404);
 }finally{await service.stop();}
});
