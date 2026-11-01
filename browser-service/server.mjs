import http from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,dirname,extname,sep,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {BrowserEngine} from './engine.mjs';
export const VERSION='2.0.0';
export function websiteURL(value){const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw Error('Enter an HTTP or HTTPS address.');if(u.username||u.password)throw Error('Use the website login form, not credentials in the address.');return u.href;}
const limit=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
function json(res,status,data){if(res.headersSent){res.end();return;}res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function readBody(req){let length=0,chunks=[];for await(const c of req){length+=c.length;if(length>29*1024*1024)throw Error('Request exceeds the 20 MB file upload limit.');chunks.push(c);}return length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};}
export function createService({root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),port=8092,engine=new BrowserEngine({executable:process.env.JACKOS_BROWSER})}={}){
 const cookieName='jackos-service-'+port;
 const clients=new Map();
 
 // FIXED/UPDATED: Regex matching exactly: optional subdomains followed by localhost or 127.0.0.1 and your port
 const hostPattern = new RegExp(`^(?:[a-zA-Z0-9-]+\\.)*(?:localhost|127\\.0\\.0\\.1):${port}$`);

 const server=http.createServer(async(req,res)=>{
  try{
   // FIXED/UPDATED: Validates using the new wildcard subdomain regex rule
   if(!hostPattern.test(req.headers.host || '')){json(res,403,{error:'Host rejected'});return;}
   
   const url=new URL(req.url,`http://${req.headers.host}`),api=url.pathname.startsWith('/__browser/');
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('Cache-Control','no-store');
   const key=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);let owner=clients.get(key);
   if(api){
    if(!owner){json(res,403,{error:'Connection expired. Reload this browser tab.',code:'RELOAD'});return;}
    owner.lastUsed=Date.now();
    if(req.method==='POST'&&(req.headers.origin!==url.origin||req.headers['x-jackos-client']!=='1')){json(res,403,{error:'Origin rejected'});return;}
    if(url.pathname==='/__browser/health'&&req.method==='GET'){json(res,200,{version:VERSION,connected:engine.ws?.readyState===1,limits:{tabs:12,uploadMB:20}});return;}
    const download=url.pathname.match(/^\/__browser\/download\/([a-f0-9-]+)$/);
    if(download&&req.method==='GET'){
     const d=owner.downloads.get(download[1]);if(!d||d.state!=='completed'){json(res,404,{error:'Download is not available.'});return;}
     const path=join(owner.dir,'downloads',d.id),info=await stat(path);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':info.size,'Content-Disposition':`attachment; filename="${d.name.replace(/[^a-zA-Z0-9._-]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(d.name)}`});createReadStream(path).pipe(res);return;
    }
    if(url.pathname==='/__browser/sessions'&&req.method==='POST'){const s=await engine.create(owner,await readBody(req));json(res,200,{id:s.id});return;}
    const match=url.pathname.match(/^\/__browser\/([a-f0-9]{32})\/(\w+)$/),s=match&&engine.sessions.get(match[1]);
    if(!s||s.owner!==owner){json(res,410,{error:'This browser session ended. Reconnect to reopen the page.',code:'SESSION_ENDED'});return;}s.lastUsed=Date.now();const action=match[2];
    if(action==='state'&&req.method==='GET'){json(res,200,await engine.state(s));return;}
    if(action==='stream'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive','X-Accel-Buffering':'no'});await engine.stream(s,res);return;}
    if(action==='selection'&&req.method==='GET'){json(res,200,{text:await engine.selection(s)});return;}
    if(req.method!=='POST'){json(res,405,{error:'Method not allowed'});return;}const b=await readBody(req);
    const call=(method,params)=>engine.call(method,params,s.sessionId);
    if(action==='navigate'){const target=websiteURL(b.url);const result=await call('Page.navigate',{url:target});if(result.errorText)throw Error(result.errorText);s.url=target;}
    else if(action==='resize')await engine.resize(s,b.width,b.height);
    else if(action==='reload')await call('Page.reload',{});
    else if(action==='back'||action==='forward')await engine.history(s,action);
    else if(action==='mouse'){
     if(!['mousePressed','mouseReleased','mouseMoved','mouseWheel'].includes(b.type))throw Error('Invalid mouse event');
     await call('Input.dispatchMouseEvent',{type:b.type,x:limit(b.x,0,s.width),y:limit(b.y,0,s.height),button:['left','middle','right'].includes(b.button)?b.button:'none',buttons:limit(b.buttons,0,7),clickCount:['mousePressed','mouseReleased'].includes(b.type)?limit(b.clickCount||1,1,3):0,modifiers:limit(b.modifiers,0,15),...(b.type==='mouseWheel'?{deltaX:limit(b.deltaX,-2000,2000),deltaY:limit(b.deltaY,-2000,2000)}:{})});
    }else if(action==='key'){
     if(!['keyDown','keyUp'].includes(b.type))throw Error('Invalid key event');await call('Input.dispatchKeyEvent',{type:b.type,key:String(b.key||'').slice(0,40),code:String(b.code||'').slice(0,40),windowsVirtualKeyCode:limit(b.keyCode,0,255),modifiers:limit(b.modifiers,0,15)});
    }else if(action==='text')await call('Input.insertText',{text:String(b.text||'').slice(0,50000)});
    else if(action==='dialog')await call('Page.handleJavaScriptDialog',{accept:!!b.accept,promptText:String(b.text||'')});
    else if(action==='upload')await engine.upload(s,b.files);
    else if(action==='cancelUpload')s.fileChooser=null;
    else if(action==='ackPopups')s.popups=s.popups.filter(p=>!b.ids?.includes(p.id));
    else if(action==='close')await engine.close(s);
    else throw Error('Unknown action');json(res,200,{ok:true});return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:'Method not allowed'});return;}
   // Root landing path fallback safely targeting index.html
   const file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root+sep)||decodeURIComponent(url.pathname).split('/').some(x=>x.startsWith('.'))){json(res,403,{error:'Path rejected'});return;}
   const actual=await realpath(file);if(!actual.startsWith(root+sep)||!(await stat(actual)).isFile()){json(res,404,{error:'Not found'});return;}
   if(!owner){const key=randomBytes(32).toString('hex');owner={key,downloads:new Map(),lastUsed:Date.now()};clients.set(key,owner);res.setHeader('Set-Cookie',`${cookieName}=${key}; HttpOnly; SameSite=Strict; Path=/`);}
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.wasm':'application/wasm','.zip':'application/zip'};res.setHeader('Content-Type',types[extname(actual)]||'application/octet-stream');
   if(req.method==='HEAD')res.end();else createReadStream(actual).pipe(res);
  }catch(e){json(res,e.code==='ENOENT'?404:400,{error:e.message});}
 });
 server.requestTimeout=120000;
 const cleanup=setInterval(()=>{for(const [key,c]of clients)if(Date.now()-c.lastUsed>30*60*1000){clients.delete(key);engine.dispose(c).catch(()=>{});}},60000);cleanup.unref();
 return {server,engine,async stop(){clearInterval(cleanup);await engine.stop();await new Promise(r=>server.close(r));}};
}
if(process.argv[2]||process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 // FIXED: Parses the custom positional CLI argument correctly (process.argv[2])
 const port=Number(process.argv[2]||process.env.PORT||8092);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT must be between 1024 and 65535.');
 const endpoint=process.env.JACKOS_TEST_CDP_ENDPOINT;
 if(endpoint&&!/^ws:\/\/127\.0\.0\.1:\d+\//.test(endpoint))throw Error('Test endpoint must use loopback.');
 const service=createService({port,engine:new BrowserEngine({executable:process.env.JACKOS_BROWSER,endpoint})});
 // Listens on 0.0.0.0 to support wildcard subdomains cleanly
 service.server.listen(port,'0.0.0.0',()=>console.log(`JackOS Browser ${VERSION}: http://localhost:${port}/index.html`));
 service.server.on('error',e=>{console.error(e.message);service.stop();});
}
