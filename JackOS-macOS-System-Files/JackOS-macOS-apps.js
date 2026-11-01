/* App-level presentation and browser tabs for the macOS edition. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const paths={back:'M15 5l-7 7 7 7',forward:'M9 5l7 7-7 7',reload:'M20 11a8 8 0 1 0-2 6M20 4v7h-7',home:'m3 11 9-8 9 8M6 10v11h12V10M10 21v-7h4v7',external:'M14 3h7v7m0-7L10 14M10 4H4v16h16v-6',plus:'M12 5v14M5 12h14',search:'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',grid:'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',folder:'M3 6h7l2 3h9v11H3Z',photo:'M3 3h18v18H3Zm0 13 6-6 5 5 3-3 4 4M16 7h.01',music:'M9 18V5l11-2v13M9 9l11-2M9 18a3 3 0 1 1-3-3h3m11 1a3 3 0 1 1-3-3h3',star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z'};
  const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.grid}"/></svg>`;
  function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function iconButton(label,name,handler){const n=node('button','mac-browser-button');n.type='button';n.title=label;n.setAttribute('aria-label',label);n.innerHTML=svg(name);n.onclick=handler;return n;}
  function initBrowser(){
    const win=$('#browserWin'),header=$('#browserHeader'),bar=$('#browserBar'),area=$('#browserArea'),input=$('#browserUrl'),template=$('#browserFrame');
    if(!win||!template)return;
    const START='jackos:start',DEFAULT_HOME='https://bing.com';
    function home(){return typeof Browser_getHome==='function'?Browser_getHome():DEFAULT_HOME;}let serial=0,active=null;const tabs=[];
    const strip=node('div','mac-browser-tabs');strip.setAttribute('role','tablist');strip.setAttribute('aria-label','Browser tabs');
    const tabRow=node('div','mac-browser-tab-row'),add=iconButton('New tab','plus',()=>newTab());tabRow.append(strip,add);header.after(tabRow);
    header.append(bar);header.querySelector('.title').hidden=true;
    input.placeholder='Search or enter website name';input.setAttribute('aria-label','Website address or search');input.autocomplete='off';input.spellcheck=false;
    const address=node('div','mac-browser-address'),search=node('span','mac-address-symbol');search.innerHTML=svg('search');address.append(search,input,$('#browserRefresh'));
    bar.replaceChildren($('#browserBack'),$('#browserFwd'),iconButton('Home','home',()=>navigate(home())),address);
    const start=node('section','mac-browser-start');start.setAttribute('aria-label','Browser start page');
    const content=node('div','mac-start-content');content.append(node('p','mac-start-eyebrow','JACKOS BROWSER'),node('h1','','A little space to explore.'));
    const form=node('form','mac-start-search');form.innerHTML=svg('search');const field=node('input');field.type='search';field.placeholder='Search the web';field.setAttribute('aria-label','Search the web');form.append(field);form.onsubmit=e=>{e.preventDefault();if(field.value.trim())navigate(field.value);};
    content.append(form,node('h2','','Quick links'));const links=node('div','mac-quick-links');
    for(const [title,letter,url,color] of [['Wikipedia','W','https://www.wikipedia.org/','#526073'],['Apple','A','https://apple.com/uk','#313846'],['GitHub','⌘','https://github.com/','#785ad0'],['BBC','BBC','https://www.bbc.co.uk/','#d64c5b']]){
      const b=node('button','mac-quick-link');b.type='button';const tile=node('span','mac-quick-icon',letter);tile.style.background=color;b.append(tile,node('span','',title));b.onclick=()=>navigate(url);links.append(b);
    }
    content.append(links,node('p','mac-start-caption','Your next idea starts here.'));start.append(content);area.append(start);
    const hint=node('div','mac-browser-hint');hint.append(node('span','','Page not displaying? Open it in a full browser tab.'));const external=node('button','','Open in Edge ↗');external.type='button';external.onclick=()=>window.Browser_openExt();hint.append(external);win.append(hint);$('#browserFallback').hidden=true;
    template.classList.add('mac-browser-frame');template.title='Browser page';
    function clean(value){
      const text=String(value||'').trim();if(!text||text===START)return START;
      if(/^https?:\/\//i.test(text)){try{const u=new URL(text);return u.href;}catch{return START;}}
      if(/^(?:localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?)(?:\/|$)/i.test(text))return 'http://'+text;
      if(/^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(text))return 'https://'+text;
      return 'https://www.google.com/search?q='+encodeURIComponent(text);
    }
    function current(tab=active){return tab?.history[tab.index]||START;}
    function gamePage(tab){return typeof JackOSInput!=='undefined'&&JackOSInput.isGameUrl(current(tab));}
    function remote(url){try{return /^https?:$/.test(new URL(url).protocol)&&new URL(url).origin!==location.origin;}catch{return false;}}
    function frameURL(url,tab){return tab?.remoteSession?'/browser-service/view.html?id='+tab.remoteSession:url===START?'about:blank':remote(url)?'/browser-service/view.html?url='+encodeURIComponent(url):url;}
    function title(tab){if(tab?.remoteState?.title)return tab.remoteState.title.slice(0,60);const url=current(tab);if(url===START)return 'Start Page';try{return new URL(url).hostname.replace(/^www\./,'');}catch{return 'Browser';}}
    function render(){
      strip.replaceChildren();
      for(const tab of tabs){
        const item=node('div','mac-browser-tab');item.classList.toggle('selected',tab===active);
        const choose=node('button','mac-browser-tab-title',title(tab));choose.type='button';choose.id='mac-browser-tab-'+tab.id;choose.setAttribute('role','tab');choose.setAttribute('aria-selected',String(tab===active));choose.setAttribute('aria-controls',tab.frame.id);choose.tabIndex=tab===active?0:-1;choose.onclick=()=>select(tab);
        choose.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();let index=tabs.indexOf(tab);index=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;select(tabs[index]);$('#mac-browser-tab-'+active.id)?.focus();}};
        const close=node('button','mac-browser-tab-close','×');close.type='button';close.title='Close tab';close.setAttribute('aria-label','Close '+title(tab)+' tab');close.onclick=()=>closeTab(tab);item.append(choose,close);strip.append(item);
        tab.frame.hidden=tab!==active||current(tab)===START;
        if(remote(current(tab)))tab.frame.contentWindow?.postMessage({action:'visibility',visible:tab===active&&win.style.display!=='none'&&!win.classList.contains('window-minimized'),pointerLock:tab===active&&gamePage(tab)},location.origin);
      }
      const isStart=current()===START;start.hidden=!isStart;hint.hidden=isStart||remote(current());win.classList.toggle('mac-browser-web',!isStart&&!remote(current()));input.value=isStart?'':current();
      $('#browserBack').disabled=active?.remoteState?!active.remoteState.canBack:!active||active.index<=0;$('#browserFwd').disabled=active?.remoteState?!active.remoteState.canForward:!active||active.index>=active.history.length-1;$('#browserRefresh').disabled=isStart;
      browserState.frame=active?.frame;browserState.history=active?.history||[];browserState.index=active?.index??-1;browserState.urlInput=input;browserState.fb=$('#browserFallback');browserState.win=win;
    }
    function select(tab){active=tab;if(tab.suspended&&current(tab)!==START){tab.frame.src=frameURL(current(tab),tab);tab.suspended=false;}render();}
    function newTab(url=home(),remoteSession=null){
      const frame=tabs.length||serial?template.cloneNode(false):template;const tab={id:++serial,frame,history:[remoteSession?url:clean(url)],index:0,suspended:false,remoteSession};
      if(frame!==template){frame.id='mac-browser-frame-'+tab.id;area.append(frame);}
      frame.setAttribute('aria-labelledby','mac-browser-tab-'+tab.id);frame.title=title(tab);
      if(typeof JackOSInput!=='undefined')JackOSInput.prepareFrame(frame,{game:gamePage(tab),autoPointerLock:gamePage(tab),pointerLock:true});
      frame.addEventListener('load',()=>{frame.contentWindow?.postMessage({action:'visibility',visible:tab===active&&win.style.display!=='none'&&!win.classList.contains('window-minimized'),pointerLock:tab===active&&gamePage(tab)},location.origin);});
      frame.src=frameURL(current(tab),tab);
      tabs.push(tab);select(tab);if(remoteSession)frame.focus();else input.focus();return tab;
    }
    function closeTab(tab){const index=tabs.indexOf(tab);tabs.splice(index,1);tab.frame.src='about:blank';tab.frame.remove();if(!tabs.length){newTab();return;}if(active===tab)select(tabs[Math.min(index,tabs.length-1)]);else render();}
    function navigate(value){
      if(!active)newTab();const url=clean(value);if(active.remoteState?.engineRelease===2&&remote(url)){active.frame.contentWindow.postMessage({action:'navigate',url},location.origin);return;}active.remoteSession=null;active.history.splice(active.index+1);if(url!==current()){active.history.push(url);active.index=active.history.length-1;}loadCurrent();
    }
    function loadCurrent(){active.remoteState=null;if(typeof JackOSInput!=='undefined')JackOSInput.prepareFrame(active.frame,{game:gamePage(active),autoPointerLock:gamePage(active),pointerLock:true});active.frame.src=frameURL(current(),active);active.frame.title=title(active);active.suspended=false;render();}
    window.Browser_sanitize=clean;window.Browser_navigate=navigate;window.Browser_go=()=>navigate(input.value);
    window.Browser_back=()=>{if(active?.remoteState)active.frame.contentWindow.postMessage({action:'back'},location.origin);else if(active?.index>0){active.index--;loadCurrent();}};
    window.Browser_forward=()=>{if(active?.remoteState)active.frame.contentWindow.postMessage({action:'forward'},location.origin);else if(active&&active.index<active.history.length-1){active.index++;loadCurrent();}};
    window.Browser_refresh=()=>{if(active?.remoteState)active.frame.contentWindow.postMessage({action:'reload'},location.origin);else if(active&&current()!==START)loadCurrent();};
    window.addEventListener('message',e=>{if(e.origin!==location.origin)return;const tab=tabs.find(t=>t.frame.contentWindow===e.source);if(!tab)return;if(e.data?.type==='jackos-browser-popup'){newTab(e.data.url||'about:blank',e.data.id);e.source.postMessage({action:'popup-accepted',id:e.data.id},location.origin);}if(e.data?.type==='jackos-browser-address'){input.focus();input.select();}if(e.data?.type==='jackos-browser-state'){tab.remoteState=e.data;if(/^https?:\/\//i.test(e.data.url||''))tab.history[tab.index]=e.data.url;if(tab===active){const focused=document.activeElement===input,saved=input.value;render();if(focused)input.value=saved;}}});
    window.Browser_openExt=()=>{const url=current();if(url!==START)window.open(url,'_blank','noopener,noreferrer');};
    for(const [id,label,name,handler] of [['browserBack','Back','back',window.Browser_back],['browserFwd','Forward','forward',window.Browser_forward],['browserRefresh','Reload page','reload',window.Browser_refresh]]){const b=document.getElementById(id);b.type='button';b.className='mac-browser-button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=svg(name);b.onclick=handler;}
    window.Browser_open=()=>{
      win.style.display='block';WindowManager.show('browserWin');
      if(!tabs.length)newTab(home());
      else {select(active);if(current()!==START&&(!active.frame.getAttribute('src')||active.frame.getAttribute('src')==='about:blank'))loadCurrent();}
      window.JackOSMac?.sync();
    };
    const close=()=>{win.style.display='none';for(const tab of tabs){tab.frame.src='about:blank';if(tab.frame!==template)tab.frame.remove();}tabs.length=0;active=null;template.hidden=true;render();};
    if(typeof APP_REGISTRY!=='undefined')APP_REGISTRY.browser.close=close;new MutationObserver(()=>{for(const tab of tabs){const visible=tab===active&&win.style.display!=='none'&&!win.classList.contains('window-minimized');tab.frame.contentWindow?.postMessage({action:'visibility',visible,pointerLock:visible&&gamePage(tab)},location.origin);}}).observe(win,{attributes:true,attributeFilter:['class','style']});
    document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='l'&&win.style.display!=='none'&&!win.classList.contains('mac-inactive')){e.preventDefault();input.focus();input.select();}});
    window.JackOSMacBrowser={newTab,closeTab:()=>active&&closeTab(active),snapshot:()=>({count:tabs.length,url:current(),index:active?.index,history:active?[...active.history]:[]}),sanitize:clean};
  }
  function initApps(){
    initBrowser();
    const store=$('#appStoreApp'),actions=store?.querySelector('.actions');
    if(actions){actions.classList.add('mac-store-sidebar');actions.setAttribute('aria-label','App Store sections');store.append(actions);for(const b of actions.querySelectorAll('button')){b.classList.add('mac-store-link');b.addEventListener('click',()=>{actions.querySelectorAll('button').forEach(n=>n.classList.remove('selected'));b.classList.add('selected');});}actions.querySelector('button')?.classList.add('selected');}
    if(store){
      const importButton=node('button','mac-import-app-button','＋ Import App');importButton.type='button';
      const reason=node('p','mac-import-reason');reason.id='mac-import-reason';reason.setAttribute('role','status');actions?.append(reason);
      store.querySelector('.app-window-header').append(importButton);
      const updateImport=()=>{
        const allowed=AppStore_isImportAllowed();importButton.disabled=!allowed;importButton.setAttribute('aria-describedby','mac-import-reason');
        let message='';if(!allowed){
          if(typeof Recovery_isSafeMode==='function'&&Recovery_isSafeMode())message='Import is unavailable in Safe Mode.';
          else if(Users_find(currentUser)?.guest)message='Sign in to a regular account to import apps.';
          else if(typeof JackOSRestrictions_isImportAllowed==='function'&&!JackOSRestrictions_isImportAllowed(currentUser))message='App importing is disabled in account restrictions.';
          else message='Import apps is available in JackOS Pro and Elite editions.';
        }
        reason.textContent=message;reason.hidden=allowed;importButton.title=allowed?'Import a JackOS app ZIP':message;
      };
      importButton.onclick=()=>{updateImport();if(!importButton.disabled)$('#appStoreImportInput').click();};
      const originalOpen=AppStore_open;window.AppStore_open=function(...args){updateImport();const result=originalOpen.apply(this,args);Promise.resolve(result).then(()=>{updateImport();window.JackOSMac?.sync();});return result;};
      updateImport();
    }
    const photos=$('#photosBody');
    if(photos){const styleEmpty=()=>{const empty=$('#photosEmpty');if(empty&&!empty.dataset.macReady){empty.dataset.macReady='true';const art=node('div','mac-empty-art');art.append(Desktop_appIcon('photos'));const label=node('label','mac-empty-import','Import Photos');label.htmlFor='photosInput';empty.replaceChildren(art,node('h2','','Your memories, together.'),node('p','','Add photos to start your library.'),label);}};new MutationObserver(styleEmpty).observe(photos,{childList:true});styleEmpty();}
    document.querySelectorAll('.music-nav-icon').forEach(n=>{const page=n.closest('button,label')?.dataset.musicPage;n.innerHTML=svg(page==='search'?'search':page==='home'?'home':page==='favourites'?'star':page==='albums'?'grid':page==='playlists'?'folder':'music');});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initApps,{once:true});else initApps();
})();
