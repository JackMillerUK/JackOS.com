import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';

export class BrowserEngine {
  constructor({executable,endpoint}={}) {
    this.executable=executable||'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
    this.endpoint=endpoint;this.sessions=new Map();this.clients=new Set();this.pending=new Map();this.next=0;
  }
  async start() {
    if(this.ws?.readyState===1)return;
    if(this.starting)return this.starting;
    this.starting=this.launch().finally(()=>{this.starting=null;});return this.starting;
  }
  async launch() {
    let endpoint=this.endpoint;
    if(!endpoint){
      this.profile=await mkdtemp(join(tmpdir(),'jackos-engine-'));
      this.child=spawn(this.executable,['--headless=new','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${this.profile}`,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:['ignore','ignore','pipe']});
      endpoint=await new Promise((resolve,reject)=>{
        let stderr='';const finish=(error,value)=>{clearTimeout(timer);error?reject(error):resolve(value);};
        const timer=setTimeout(()=>finish(Error('Browser startup timed out. Check the Edge installation.')),20000);
        this.child.once('error',e=>finish(Error('Cannot launch Edge: '+e.message)));
        this.child.once('exit',(code,signal)=>finish(Error('Edge stopped during startup ('+(signal||code)+').')));
        this.child.stderr.on('data',b=>{stderr=(stderr+b).slice(-5000);const m=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m)finish(null,m[1]);});
      }).catch(async e=>{this.child.kill();await rm(this.profile,{recursive:true,force:true});throw e;});
    }
    const ws=new WebSocket(endpoint);this.ws=ws;
    await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',()=>reject(Error('Cannot connect to the browser engine.')),{once:true});});
    ws.addEventListener('message',e=>this.message(JSON.parse(e.data)));
    ws.addEventListener('close',()=>{
      for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Browser disconnected. Reload the tab to reconnect.'));}this.pending.clear();
      for(const s of this.sessions.values())for(const stream of s.streams)stream.end();this.sessions.clear();
      for(const c of this.clients){c.context=null;c.contextPromise=null;}
    });
    await this.call('Target.setDiscoverTargets',{discover:true});
  }
  call(method,params={},sessionId) {
    if(this.ws?.readyState!==1)return Promise.reject(Error('Browser engine is offline. Reload the tab to reconnect.'));
    return new Promise((resolve,reject)=>{const id=++this.next,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Browser command timed out.'));},15000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  }
  message(m) {
    if(m.id){const p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}return;}
    const s=[...this.sessions.values()].find(s=>s.sessionId===m.sessionId);
    if(m.method==='Target.targetCreated'&&m.params.targetInfo.openerId){
      const info=m.params.targetInfo,opener=[...this.sessions.values()].find(s=>s.targetId===info.openerId);
      if(opener)this.attach(opener.owner,info.targetId,opener.width,opener.height).then(popup=>opener.popups.push({id:popup.id,url:popup.url})).catch(()=>this.call('Target.closeTarget',{targetId:info.targetId}).catch(()=>{}));
    }
    if(m.method==='Browser.downloadWillBegin'){
      const d=m.params,owner=[...this.sessions.values()].find(s=>s.frames.has(d.frameId))?.owner;
      if(owner)owner.downloads.set(d.guid,{id:d.guid,name:d.suggestedFilename||'download',received:0,total:0,state:'inProgress'});
    }
    if(m.method==='Browser.downloadProgress')for(const c of this.clients){const d=c.downloads.get(m.params.guid);if(d)Object.assign(d,{received:m.params.receivedBytes,total:m.params.totalBytes,state:m.params.state});}
    if(!s)return;
    if(m.method==='Page.frameNavigated'){s.frames.add(m.params.frame.id);if(!m.params.frame.parentId)s.url=m.params.frame.url;}
    if(m.method==='Page.navigatedWithinDocument')s.url=m.params.url;
    if(m.method==='Page.javascriptDialogOpening')s.dialog={type:m.params.type,message:m.params.message};
    if(m.method==='Page.javascriptDialogClosed')s.dialog=null;
    if(m.method==='Page.fileChooserOpened')s.fileChooser={node:m.params.backendNodeId,multiple:m.params.mode==='selectMultiple'};
    if(m.method==='Page.screencastFrame'){
      this.call('Page.screencastFrameAck',{sessionId:m.params.sessionId},s.sessionId).catch(()=>{});
      // Keep the newest frame, including the final frame when scrolling stops.
      s.pendingFrame=m.params.data;
      if(!s.frameTimer)s.frameTimer=setTimeout(()=>{
        s.frameTimer=null;
        const data='data: '+JSON.stringify({image:s.pendingFrame})+'\n\n';s.pendingFrame=null;
        for(const stream of s.streams)if(!stream.destroyed&&stream.writableLength<256*1024)stream.write(data);
      },16);
    }
  }
  async context(owner) {
    await this.start();if(owner.context)return owner.context;
    if(owner.contextPromise)return owner.contextPromise;
    owner.contextPromise=(async()=>{
      owner.dir ||= await mkdtemp(join(tmpdir(),'jackos-private-'));await mkdir(join(owner.dir,'downloads'),{recursive:true});await mkdir(join(owner.dir,'uploads'),{recursive:true});
      const {browserContextId}=await this.call('Target.createBrowserContext',{disposeOnDetach:true});owner.context=browserContextId;this.clients.add(owner);
      await this.call('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:join(owner.dir,'downloads'),browserContextId,eventsEnabled:true});
      return browserContextId;
    })().finally(()=>{owner.contextPromise=null;});return owner.contextPromise;
  }
  async create(owner,{width=1024,height=700}={}) {
    const context=await this.context(owner);if([...this.sessions.values()].filter(s=>s.owner===owner).length>=12)throw Error('The 12-tab limit has been reached. Close a tab first.');
    const {targetId}=await this.call('Target.createTarget',{url:'about:blank',browserContextId:context});return this.attach(owner,targetId,width,height);
  }
  async attach(owner,targetId,width,height) {
    if([...this.sessions.values()].filter(s=>s.owner===owner).length>=12)throw Error('Tab limit reached.');
    const {sessionId}=await this.call('Target.attachToTarget',{targetId,flatten:true});
    const s={id:randomBytes(16).toString('hex'),targetId,sessionId,owner,url:'about:blank',frames:new Set(),streams:new Set(),popups:[],lastUsed:Date.now()};this.sessions.set(s.id,s);
    try{await this.call('Page.enable',{},sessionId);await this.call('Page.setInterceptFileChooserDialog',{enabled:true},sessionId);await this.resize(s,width,height);const tree=await this.call('Page.getFrameTree',{},sessionId);s.frames.add(tree.frameTree.frame.id);s.url=tree.frameTree.frame.url;return s;}catch(e){await this.close(s);throw e;}
  }
  async resize(s,width,height) {
    width=Math.round(Math.max(320,Math.min(1920,Number(width)||1024)));height=Math.round(Math.max(200,Math.min(1200,Number(height)||700)));
    await this.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s.sessionId);s.width=width;s.height=height;
  }
  async state(s) {
    const h=await this.call('Page.getNavigationHistory',{},s.sessionId),valid=e=>/^https?:/.test(e.url);
    return {url:s.url,title:h.entries[h.currentIndex]?.title||s.url,canBack:h.entries.slice(0,h.currentIndex).some(valid),canForward:h.entries.slice(h.currentIndex+1).some(valid),dialog:s.dialog,fileChooser:s.fileChooser?{multiple:s.fileChooser.multiple}:null,popups:s.popups,downloads:[...s.owner.downloads.values()],width:s.width,height:s.height};
  }
  async history(s,direction) {const h=await this.call('Page.getNavigationHistory',{},s.sessionId),e=(direction==='back'?h.entries.slice(0,h.currentIndex).reverse():h.entries.slice(h.currentIndex+1)).find(e=>/^https?:/.test(e.url));if(e)await this.call('Page.navigateToHistoryEntry',{entryId:e.id},s.sessionId);}
  async stream(s,response) {
    s.streams.add(response);response.write(': connected\n\n');
    response.on('close',()=>{s.streams.delete(response);if(!s.streams.size)this.call('Page.stopScreencast',{},s.sessionId).catch(()=>{});});
    await this.call('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:1920,maxHeight:1200,everyNthFrame:1},s.sessionId);
  }
  async upload(s,files) {
    if(!s.fileChooser)throw Error('No website file picker is open.');if(!Array.isArray(files)||!files.length||files.length>10||(!s.fileChooser.multiple&&files.length>1))throw Error('Invalid file selection.');
    const paths=[];let size=0;
    for(const file of files){const bytes=Buffer.from(String(file.data||''),'base64');size+=bytes.length;if(size>20*1024*1024)throw Error('Select at most 20 MB per upload.');const name=String(file.name||'file').replace(/[^\p{L}\p{N}._-]/gu,'_').slice(0,160),path=join(s.owner.dir,'uploads',randomBytes(6).toString('hex')+'-'+name);await writeFile(path,bytes);paths.push(path);}
    await this.call('DOM.setFileInputFiles',{files:paths,backendNodeId:s.fileChooser.node},s.sessionId);s.fileChooser=null;
  }
  async selection(s) {const r=await this.call('Runtime.evaluate',{expression:'(()=>{const e=document.activeElement;return e&&typeof e.selectionStart==="number"?e.value.slice(e.selectionStart,e.selectionEnd):String(window.getSelection()||"")})()',returnByValue:true},s.sessionId);return String(r.result.value||'');}
  async close(s){clearTimeout(s.frameTimer);this.sessions.delete(s.id);for(const stream of s.streams)stream.end();await this.call('Target.closeTarget',{targetId:s.targetId}).catch(()=>{});}
  async dispose(owner){for(const s of [...this.sessions.values()])if(s.owner===owner)await this.close(s);if(owner.context)await this.call('Target.disposeBrowserContext',{browserContextId:owner.context}).catch(()=>{});this.clients.delete(owner);if(owner.dir)await rm(owner.dir,{recursive:true,force:true});}
  async stop(){for(const c of [...this.clients])await this.dispose(c);if(!this.endpoint)await this.call('Browser.close').catch(()=>{});this.ws?.close();this.child?.kill();if(this.profile)await rm(this.profile,{recursive:true,force:true});}
}
