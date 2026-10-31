(() => {
 'use strict';
 const $=id=>document.getElementById(id),screen=$('screen'),keyboard=$('keyboard');
 const query=new URLSearchParams(location.search);let id=query.get('id'),url=query.get('url'),closed=false,active=true,stream,sequence=Promise.resolve(),lastState='',width=0,height=0,failures=0,composing=false;const seenPopups=new Set();
 const modifiers=e=>(e.altKey?1:0)|(e.ctrlKey?2:0)|(e.metaKey?4:0)|(e.shiftKey?8:0);
 async function api(action,data){const response=await fetch('/__browser/'+(id?id+'/':'')+action,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json','X-JackOS-Client':'1'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});if(!response.ok){const error=await response.json().catch(()=>({error:'Cannot reach the local browser service.'}));throw Error(error.error);}return response;}
 function send(action,data){const result=sequence.then(()=>api(action,data));sequence=result.catch(e=>showError(e));return result;}
 function showError(error){$('status').hidden=false;$('status').querySelector('h2').textContent='Connection interrupted';$('statusText').textContent=error.message;$('reconnect').hidden=false;$('connection').textContent='Disconnected';}
 $('reconnect').onclick=()=>{location.href='view.html?url='+encodeURIComponent(url||'https://apple.com/uk');};
 function pointer(e){const r=screen.getBoundingClientRect();return {x:(e.clientX-r.left)*width/r.width,y:(e.clientY-r.top)*height/r.height,modifiers:modifiers(e)};}
 const button=e=>['left','middle','right'][e.button]||'none';
 screen.addEventListener('pointerdown',e=>{keyboard.focus({preventScroll:true});screen.setPointerCapture(e.pointerId);e.preventDefault();send('mouse',{...pointer(e),type:'mousePressed',button:button(e),buttons:e.buttons,clickCount:e.detail||1});});
 screen.addEventListener('pointerup',e=>{e.preventDefault();send('mouse',{...pointer(e),type:'mouseReleased',button:button(e),buttons:0,clickCount:e.detail||1});});
 screen.addEventListener('pointercancel',e=>send('mouse',{...pointer(e),type:'mouseReleased',button:'left',buttons:0,clickCount:1}));
 let lastMove=0;screen.addEventListener('pointermove',e=>{if(Date.now()-lastMove<30)return;lastMove=Date.now();send('mouse',{...pointer(e),type:'mouseMoved',button:e.buttons?'left':'none',buttons:e.buttons});});
 const wheel=JackOSWheel.create({dispatch:payload=>api('mouse',payload),height:()=>screen.clientHeight,onError:showError});
 screen.addEventListener('wheel',e=>{e.preventDefault();wheel.enqueue(e,pointer(e));},{passive:false});screen.addEventListener('contextmenu',e=>e.preventDefault());
 keyboard.addEventListener('compositionstart',()=>{composing=true;});keyboard.addEventListener('compositionend',e=>{composing=false;if(e.data)send('text',{text:e.data});keyboard.value='';});
 keyboard.addEventListener('input',e=>{if(composing||e.isComposing)return;if(keyboard.value)send('text',{text:keyboard.value});keyboard.value='';});
 const printable=e=>e.key.length===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey;
 for(const type of ['keydown','keyup'])keyboard.addEventListener(type,e=>{
  if(composing||e.isComposing)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='l'){e.preventDefault();if(type==='keydown')parent.postMessage({type:'jackos-browser-address'},location.origin);return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){e.preventDefault();if(type==='keydown')copy();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v')return;
  if(printable(e))return;e.preventDefault();send('key',{type:type==='keydown'?'keyDown':'keyUp',key:e.key,code:e.code,keyCode:e.keyCode,modifiers:modifiers(e)});
 });
 keyboard.addEventListener('paste',e=>{e.preventDefault();send('text',{text:e.clipboardData.getData('text/plain')});});
 async function copy(){try{const data=await(await api('selection')).json();if(!data.text)return;try{await navigator.clipboard.writeText(data.text);}catch{$('copyDialog').hidden=false;$('copyText').value=data.text;$('copyText').focus();$('copyText').select();}}catch(e){showError(e);}}
 $('copy').onclick=copy;$('closeCopy').onclick=()=>{$('copyDialog').hidden=true;keyboard.focus();};
 function connectStream(){if(stream||!active||document.hidden||!id)return;stream=new EventSource('/__browser/'+id+'/stream');stream.onmessage=e=>{const data=JSON.parse(e.data);latestFrame=data.image;paintFrame();};stream.onerror=()=>{$('connection').textContent='Reconnecting…';};}
 let latestFrame=null,decoding=false;
 async function paintFrame(){
  if(decoding||!latestFrame)return;
  decoding=true;const frame=latestFrame;latestFrame=null;
  try{const image=new Image();image.src='data:image/jpeg;base64,'+frame;await image.decode();
   if(!closed&&active){screen.src=image.src;$('status').hidden=true;$('connection').textContent='Private browsing';failures=0;}
  }catch{}finally{decoding=false;if(latestFrame)paintFrame();}
 }
 function visibility(){if(!active||document.hidden){wheel.reset();stream?.close();stream=null;}else connectStream();}
 addEventListener('visibilitychange',visibility);
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.action==='visibility'){active=!!e.data.visible;visibility();return;}if(!id)return;if(['back','forward','reload'].includes(e.data?.action))send(e.data.action,{});if(e.data?.action==='navigate')send('navigate',{url:e.data.url});if(e.data?.action==='popup-accepted'){$('popup').hidden=true;send('ackPopups',{ids:[e.data.id]});}});
 function downloads(items){$('downloads').replaceChildren();const h=document.createElement('strong');h.textContent=items.length?'Downloads':'No downloads yet';$('downloads').append(h);for(const d of items.slice().reverse()){const row=document.createElement('div');row.className='download-row';const text=document.createElement('span');text.textContent=d.name+' — '+(d.state==='completed'?'Ready':d.state==='canceled'?'Cancelled':Math.round(d.received/1024)+' KB');row.append(text);if(d.state==='completed'){const link=document.createElement('a');link.className='download-link';link.href='/__browser/download/'+d.id;link.download=d.name;link.textContent='Save to this computer';row.append(link);}$('downloads').append(row);}$('downloadsButton').textContent='Downloads'+(items.length?' ('+items.length+')':'');}
 $('downloadsButton').onclick=()=>{$('downloads').hidden=!$('downloads').hidden;};
 async function poll(){if(closed)return;if(!active||document.hidden){setTimeout(poll,800);return;}try{const state=await(await api('state')).json();failures=0;if(state.url&&state.url!=='about:blank')url=state.url;const value=JSON.stringify(state);if(value!==lastState){lastState=value;parent.postMessage({type:'jackos-browser-state',engineRelease:2,...state},location.origin);downloads(state.downloads||[]);const d=$('dialog');d.hidden=!state.dialog;if(state.dialog){$('message').textContent=state.dialog.message;$('prompt').hidden=state.dialog.type!=='prompt';$('cancel').hidden=state.dialog.type==='alert';}
 $('uploadDialog').hidden=!state.fileChooser;if(state.fileChooser)$('upload').multiple=state.fileChooser.multiple;
 for(const popup of state.popups||[])if(!seenPopups.has(popup.id)){seenPopups.add(popup.id);parent.postMessage({type:'jackos-browser-popup',...popup},location.origin);const button=document.createElement('button');button.textContent='Open new website tab';button.onclick=()=>{location.href='view.html?id='+popup.id;};$('popup').replaceChildren(button);$('popup').hidden=false;}
 }}catch(e){if(++failures>=3)showError(e);}finally{if(!closed)setTimeout(poll,650);}}
 for(const accept of [true,false])$(accept?'accept':'cancel').onclick=()=>send('dialog',{accept,text:$('prompt').value});
 $('cancelUpload').onclick=()=>send('cancelUpload',{});
 $('upload').onchange=async()=>{try{const files=[...$('upload').files];if(!files.length)return;if(files.reduce((sum,f)=>sum+f.size,0)>20*1024*1024)throw Error('Select no more than 20 MB in total.');const encoded=[];for(const f of files){const bytes=new Uint8Array(await f.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));encoded.push({name:f.name,data:btoa(text)});}await send('upload',{files:encoded});$('upload').value='';$('uploadError').textContent='';}catch(e){$('uploadError').textContent=e.message;}};
 let resize;function measure(){width=$('stage').clientWidth;height=$('stage').clientHeight;}
 addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(()=>{measure();if(id)send('resize',{width,height});},180);});
 addEventListener('pagehide',()=>{closed=true;wheel.stop();stream?.close();if(id)fetch('/__browser/'+id+'/close',{method:'POST',headers:{'Content-Type':'application/json','X-JackOS-Client':'1'},body:'{}',keepalive:true}).catch(()=>{});});
 (async()=>{try{measure();if(!id)id=(await(await api('sessions',{width,height})).json()).id;if(url)await api('navigate',{url});connectStream();poll();}catch(e){showError(e);}})();
})();
