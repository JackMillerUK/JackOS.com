//JackOS-Browser.js
// ===== Browser =====
function Browser_getHome(){
  const fallback='https://bing.com';
  try{
    const saved=localStorage.getItem('jackosBrowserHome');
    if(!saved||/^(?:https?:\/\/)?(?:www\.)?purplemash\.com(?:[/?#]|$)/i.test(saved.trim())){
      localStorage.setItem('jackosBrowserHome',fallback);
      return fallback;
    }
    return saved;
  }catch{return fallback;}
}
const BROWSER_HOME=JACKOS_IS_MACOS?Browser_getHome():(localStorage.getItem('jackosBrowserHome')||'purplemash.com');
const BROWSER_START='jackos:start';
const browserState={history:[],index:-1,frame:null,urlInput:null,fb:null,win:null};

function Browser_isSearchQuery(value){
  const text=String(value||'').trim();
  return !!text&&!/^(?:https?:\/\/|localhost(?::\d+)?(?:\/|$)|127\.0\.0\.1(?::\d+)?(?:\/|$)|[\w.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#]|$))/i.test(text);
}

async function Browser_searchUrl(query){
  const text=String(query||'').trim();
  if(!text)return '';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),2500);
  try{
    await fetch('https://www.bing.com/favicon.ico',{mode:'no-cors',cache:'no-store',signal:controller.signal});
    return 'https://www.bing.com/search?q='+encodeURIComponent(text);
  }catch(error){
    if(error?.name!=='AbortError'&&error?.name!=='TypeError')throw error;
    return 'https://www.google.com/search?q='+encodeURIComponent(text);
  }finally{clearTimeout(timeout);}
}

function Browser_showStartPage(){
  const start=document.getElementById('browserStartPage');
  if(start)start.hidden=false;
  if(browserState.frame){browserState.frame.src='about:blank';browserState.frame.hidden=true;}
  if(browserState.fb)browserState.fb.style.display='none';
  if(browserState.urlInput)browserState.urlInput.value='';
  document.getElementById('browserStartSearchInput')?.focus({preventScroll:true});
}

function Browser_open(){
  const win=document.getElementById('browserWin');
  const frame=document.getElementById('browserFrame');
  browserState.frame=frame;
  browserState.urlInput=document.getElementById('browserUrl');
  browserState.fb=document.getElementById('browserFallback');
  browserState.win=win;
  JackOSInput.prepareFrame(frame,{game:false,pointerLock:true});
  win.style.display='block';
  if(typeof WindowManager!=='undefined'&&WindowManager.get('browserWin'))WindowManager.focus('browserWin');
  Browser_showStartPage();
}

function Browser_sanitize(value){
  const text=String(value||'').trim();
  if(!text)return '';
  if(/^https?:\/\//i.test(text))return text;
  if(/^(?:localhost(?::\d+)?(?:\/|$)|127\.0\.0\.1(?::\d+)?(?:\/|$)|[\w.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#]|$))/i.test(text))return 'https://'+text;
  return 'https://www.google.com/search?q='+encodeURIComponent(text);
}

async function Browser_navigate(value,recordHistory=true){
  const text=String(value||'').trim();
  if(text===BROWSER_START){
    if(recordHistory){browserState.history=browserState.history.slice(0,browserState.index+1);browserState.history.push(BROWSER_START);browserState.index=browserState.history.length-1;}
    Browser_showStartPage();
    return;
  }
  const url=Browser_isSearchQuery(text)?await Browser_searchUrl(text):Browser_sanitize(text);
  if(!url)return;
  const game=JackOSInput.isGameUrl(url),start=document.getElementById('browserStartPage');
  if(start)start.hidden=true;
  browserState.frame.hidden=false;
  JackOSInput.prepareFrame(browserState.frame,{game,autoPointerLock:game,pointerLock:true});
  browserState.fb.style.display='none';
  browserState.frame.src='about:blank';
  setTimeout(()=>{
    try{browserState.frame.src=url;}catch(error){console.warn('Unable to navigate browser frame.',error);}
    if(recordHistory){browserState.history=browserState.history.slice(0,browserState.index+1);browserState.history.push(url);browserState.index=browserState.history.length-1;}
    browserState.urlInput.value=url;
    if(typeof Browser_checkFallback==='function')setTimeout(Browser_checkFallback,1200);
  },10);
}

function Browser_go(){Browser_navigate(browserState.urlInput.value);}
function Browser_back(){if(browserState.index>0){browserState.index--;Browser_navigate(browserState.history[browserState.index],false);}}
function Browser_forward(){if(browserState.index<browserState.history.length-1){browserState.index++;Browser_navigate(browserState.history[browserState.index],false);}}
function Browser_refresh(){if(browserState.index>=0)Browser_navigate(browserState.history[browserState.index],false);}
function Browser_openExt(){const url=browserState.urlInput.value||BROWSER_HOME;try{window.open(url,'_blank','noopener');}catch(error){console.warn('Unable to open external browser.',error);}}

ready(()=>{
  const q=id=>document.getElementById(id);
  q('browserBack').onclick=Browser_back;
  q('browserFwd').onclick=Browser_forward;
  q('browserHome').onclick=()=>Browser_navigate(BROWSER_START);
  q('browserRefresh').onclick=Browser_refresh;
  const win=q('browserWin'),frame=q('browserFrame'),url=q('browserUrl');
  if(win)win.style.display='none';
  if(frame){frame.src='about:blank';frame.hidden=true;}
  url?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();Browser_go();}});
  q('browserStartSearch')?.addEventListener('submit',event=>{
    event.preventDefault();
    Browser_navigate(q('browserStartSearchInput').value);
  });
  q('browserStartPage')?.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link)return;
    event.preventDefault();
    Browser_navigate(link.href);
  });
});
