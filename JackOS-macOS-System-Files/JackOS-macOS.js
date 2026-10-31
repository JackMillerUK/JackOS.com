/* JackOS macOS edition: a presentation layer over the existing JackOS APIs. */
(() => {
  'use strict';
  if (window.JackOSMac) return;
  const root=document.documentElement;
  root.classList.add('jackos-macos');
  const $=selector=>document.querySelector(selector);
  const storage={get(key,fallback){try{return localStorage.getItem('jackosMac:'+key)??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('jackosMac:'+key,String(value));}catch{}}};
  let uid=0,returnFocus=null,menuAnchor=null;
  const glyphs={
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    controls:'<path d="M3 6h18M3 18h18"/><rect x="6" y="3" width="5" height="6" rx="2" fill="currentColor"/><rect x="14" y="15" width="5" height="6" rx="2" fill="currentColor"/>',
    wifi:'<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>',
    moon:'<path d="M20 14.5A9 9 0 0 1 9.5 4 9 9 0 1 0 20 14.5Z"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    zoom:'<path d="M4 9V4h5m6 0h5v5M4 15v5h5m11-5v5h-5M8 12h8m-4-4v8"/>',
    bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5Zm5 3h4"/>',
    system:'<path d="M5 5h14v9a7 7 0 0 1-14 0h4a3 3 0 0 0 6 0V9H5Z" fill="currentColor" stroke="none"/>',
    folder:'<path d="M3 6h7l2 3h9v11H3Z"/>',
    person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'
  };
  const glyph=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[name]||glyphs.grid}</svg>`;
  const iconSpecs={
    explorer:['#80d2ff','#1683ec','<path d="M32 5h20a7 7 0 0 1 7 7v40a7 7 0 0 1-7 7H31V40h-7l7-35Z" fill="#e6f3ff"/><path d="M19 22v5m25-5v5M18 40q14 12 28 0" fill="none" stroke="#18466e" stroke-width="3" stroke-linecap="round"/><path d="M33 13l-5 24h8v16" fill="none" stroke="#18466e" stroke-width="1.5"/>'],
    browser:['#64d8ff','#0860dc','<circle cx="32" cy="32" r="23" fill="#edf9ff"/><circle cx="32" cy="32" r="20" fill="#2ba8ef"/><path d="M32 13v4m0 30v4M13 32h4m30 0h4M18 18l3 3m22 22 3 3M18 46l3-3m22-22 3-3" stroke="white" stroke-width="1.4"/><path d="m43 18-7 18-18 10 10-18Z" fill="#f5f7fa"/><path d="m43 18-7 18-8-8Z" fill="#ff514c"/>'],
    music:['#ff7288','#ed164b','<path d="M27 42V20l23-5v24" fill="none" stroke="white" stroke-width="5" stroke-linejoin="round"/><path d="m27 26 23-5" stroke="white" stroke-width="4"/><ellipse cx="21" cy="43" rx="8" ry="6" fill="white"/><ellipse cx="44" cy="40" rx="8" ry="6" fill="white"/>'],
    photos:['#fff','#e9ecf2',Array.from({length:8},(_,i)=>`<ellipse cx="32" cy="21" rx="8" ry="14" transform="rotate(${i*45} 32 32)" fill="${['#ffab25','#fa6b5a','#ed6aa7','#bd80d9','#789ded','#59c7e2','#66cd8e','#b6db4c'][i]}" fill-opacity=".82"/>`).join('')+'<circle cx="32" cy="32" r="6" fill="#fff" fill-opacity=".55"/>'],
    messages:['#73e567','#17b43a','<path d="M52 29c0 11-10 18-21 18h-4l-12 6 3-10c-5-3-8-8-8-14 0-11 10-18 21-18s21 7 21 18Z" fill="white"/>'],
    settings:['#d8dde6','#8e99ae','<g transform="translate(32 32)" fill="#536074">'+Array.from({length:12},(_,i)=>`<rect x="-3" y="-26" width="6" height="13" rx="1" transform="rotate(${i*30})"/>`).join('')+'<circle r="21"/><circle r="15" fill="#d9e0ea"/><circle r="11"/><circle r="5" fill="#d9e0ea"/></g>'],
    appstore:['#46b7ff','#0869e8','<path d="m25 16 21 35M38 16 17 51M12 40h40" fill="none" stroke="white" stroke-width="5.5" stroke-linecap="round"/>'],
    calculator:['#646d7b','#252b38','<rect x="11" y="9" width="42" height="15" rx="4" fill="#d9e3dd"/><g fill="#b9c1cc"><rect x="12" y="31" width="10" height="10" rx="3"/><rect x="27" y="31" width="10" height="10" rx="3"/><rect x="12" y="46" width="10" height="10" rx="3"/><rect x="27" y="46" width="10" height="10" rx="3"/></g><rect x="42" y="31" width="10" height="25" rx="4" fill="#ff9e24"/>'],
    camera:['#cad4e1','#718499','<rect x="9" y="19" width="46" height="32" rx="7" fill="#384657"/><path d="m20 20 4-8h16l4 8" fill="#384657"/><circle cx="32" cy="34" r="12" fill="#102b48" stroke="#a8c0d3" stroke-width="3"/><circle cx="30" cy="31" r="5" fill="#489bc5"/><circle cx="47" cy="25" r="2" fill="#f3d687"/>'],
    games:['#ae85fb','#6544d5','<path d="M20 22h24c7 0 13 25 8 27-4 3-11-8-14-8H26c-3 0-10 11-14 8-5-2 1-27 8-27Z" fill="#fbf8ff"/><path d="M19 29v11m-5-5h10" stroke="#795ac3" stroke-width="3"/><circle cx="43" cy="30" r="2.7" fill="#fa728c"/><circle cx="49" cy="36" r="2.7" fill="#53b5e7"/>'],
    flappy:['#87e4d4','#24aa9b','<ellipse cx="31" cy="32" rx="19" ry="14" fill="#ffdc45"/><ellipse cx="19" cy="35" rx="10" ry="7" fill="#fff4b1"/><circle cx="40" cy="26" r="7" fill="white"/><circle cx="43" cy="26" r="3" fill="#242b3b"/><path d="M42 35h17l-7 7H39" fill="#ff7b4c"/>'],
    tetris:['#7c9cf7','#4956bd','<g stroke="#fff5" stroke-width="1.5"><path d="M13 11h13v13H13Zm13 0h13v13H26Zm0 13h13v13H26Z" fill="#be8cff"/><path d="M13 37h13v13H13Zm13 0h13v13H26Zm13-13h13v13H39Zm0 13h13v13H39Z" fill="#ffbf65"/></g>'],
    snake:['#b9e773','#4baf57','<path d="M18 18h23a10 10 0 0 1 0 20H24a6 6 0 0 0 0 12h23" stroke="#f6ffe8" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="16" cy="16" r="2" fill="#255b36"/>'],
    launchpad:['#d8e8fb','#91a9cf',Array.from({length:9},(_,i)=>`<rect x="${12+(i%3)*15}" y="${12+Math.floor(i/3)*15}" width="11" height="11" rx="3" fill="${['#f8fbff','#fd847a','#ffcf75','#8ae0c1','#7ac8ff','#b99fee','#b4cffa','#fff','#ff97b1'][i]}"/>`).join('')],
    trash:['#e8eff5','#bac8d5','<path d="M19 20h27l-3 35H22Z" fill="#f6faff" stroke="#8195a9" stroke-width="1.5"/><path d="M16 17h32M26 12h13M28 26v22m9-22v22" stroke="#8195a9" stroke-width="3" stroke-linecap="round"/>']
  };
  function icon(id){
    const spec=iconSpecs[id]||iconSpecs.launchpad,gradient='mac-icon-'+(++uid);
    return `<svg class="mac-icon" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${gradient}" x2="0" y2="1"><stop stop-color="${spec[0]}"/><stop offset="1" stop-color="${spec[1]}"/></linearGradient></defs><rect x="3" y="3" width="58" height="58" rx="14" fill="url(#${gradient})"/><rect x="3.5" y="3.5" width="57" height="57" rx="13.5" fill="none" stroke="#ffffff66"/>${spec[2]}</svg>`;
  }
  function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
  function button(label,html,action,cls){const node=el('button',cls);node.type='button';node.setAttribute('aria-label',label);node.title=label;node.innerHTML=html;node.addEventListener('click',action);return node;}
  const userKey=()=>typeof currentUser==='string'?(currentUser.trim()||'Guest'):'Guest';
  const desktopActive=()=>$('#desktop')?.classList.contains('active');
  function applyPreferences(){
    for(const [key,fallback] of [['appearance','light'],['zoom','true'],['widgets','true']])root.dataset['mac'+key[0].toUpperCase()+key.slice(1)]=storage.get(key,fallback);
    const wallpapers={aurora:'aurora.svg',ocean:'ocean.svg',dusk:'dusk.svg'};
    const name=wallpapers[storage.get('wallpaper','aurora')]||wallpapers.aurora;
    root.style.setProperty('--mac-wallpaper',`url('${new URL('macOS-assets/'+name,scriptBase).href}')`);
    document.querySelectorAll('[data-mac-appearance-choice]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.macAppearanceChoice===root.dataset.macAppearance)));
    for(const id of ['desktop','login']){
      const target=document.getElementById(id);if(!target)continue;
      let custom='';try{custom=localStorage.getItem('jackosWallpaperData')||localStorage.getItem('jackosWallpaper')||'';}catch{}
      const isImage=/^(data:image\/|https?:|blob:)/.test(custom);
      const choice=storage.get('wallpaper','');
      target.dataset.macCustomWallpaper=String(isImage&&(!choice||choice==='custom'));
      if(isImage)target.style.setProperty('--mac-custom-wallpaper',`url(${JSON.stringify(custom)})`);
    }
    window.JackOSMacDesktop?.refresh();
  }
  const scriptBase=document.currentScript?.src||new URL('JackOS-macOS.js',location.href).href;
  let popover,overlay,controls,appLabel,launcherInput,appGrid,widgetDate,widgetTime,widgetGreeting,week,clock;
  function closePanels(restore=true){
    for(const panel of [popover,overlay,controls])if(panel)panel.hidden=true;
    document.querySelectorAll('.mac-menu-bar [aria-expanded]').forEach(n=>n.setAttribute('aria-expanded','false'));
    menuAnchor=null;if(restore&&returnFocus?.isConnected)returnFocus.focus();
  }
  function beginPanel(anchor,panel){const wasOpen=!panel.hidden&&menuAnchor===anchor;closePanels(false);if(wasOpen)return false;returnFocus=anchor||document.activeElement;menuAnchor=anchor;panel.hidden=false;anchor?.setAttribute('aria-expanded','true');return true;}
  function menu(anchor,items){
    if(!beginPanel(anchor,popover))return;
    popover.replaceChildren();
    for(const item of items){
      if(!item){popover.append(el('hr'));continue;}
      const entry=el('button','mac-menu-item',item.label);entry.type='button';entry.setAttribute('role','menuitem');
      if(item.hint)entry.append(el('small','',item.hint));
      if(item.disabled)entry.disabled=true;
      entry.addEventListener('click',()=>{closePanels(false);item.action?.();});popover.append(entry);
    }
    const rect=anchor.getBoundingClientRect();popover.style.left=Math.max(8,Math.min(rect.left,innerWidth-260))+'px';
    popover.querySelector('button:not(:disabled)')?.focus();
  }
  function launch(id){closePanels(false);Desktop_launch(id);setTimeout(sync,80);}
  function showDesktop(){for(const record of WindowManager.windows.values())if(getComputedStyle(record.element).display!=='none')WindowManager.minimize(record.id);sync();}
  function appearance(value){storage.set('appearance',value);applyPreferences();}
  function togglePref(key){storage.set(key,storage.get(key,'true')==='true'?'false':'true');applyPreferences();renderControls();}
  function renderControls(){
    controls.replaceChildren(el('h3','', 'Control Centre'));
    const grid=el('div','mac-controls-grid');
    for(const [label,name,key,action,active] of [
      ['Dark appearance','moon','appearance',()=>{appearance(root.dataset.macAppearance==='dark'?'light':'dark');renderControls();},root.dataset.macAppearance==='dark'],
      ['Desktop widgets','grid','widgets',()=>togglePref('widgets'),root.dataset.macWidgets==='true'],
      ['Dock magnification','zoom','zoom',()=>togglePref('zoom'),root.dataset.macZoom==='true'],
      ['Full screen','expand','fullscreen',()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{});},!!document.fullscreenElement]
    ]){const b=button(label,glyph(name)+`<span>${label}</span>`,action,'mac-control-tile');b.setAttribute('aria-pressed',String(active));b.dataset.control=key;grid.append(b);}
    controls.append(grid,el('p','mac-popover-title','Wallpaper'));
    const choices=el('div','mac-wallpaper-options');
    for(const name of ['aurora','ocean','dusk']){const b=button(name[0].toUpperCase()+name.slice(1)+' wallpaper','',()=>{storage.set('wallpaper',name);applyPreferences();renderControls();},'mac-wallpaper-choice');b.style.backgroundImage=`url('${new URL('macOS-assets/'+name+'.svg',scriptBase).href}')`;b.setAttribute('aria-pressed',String(storage.get('wallpaper','aurora')===name));choices.append(b);}
    controls.append(choices,button('Open System Settings','System Settings…',()=>launch('settings'),'mac-menu-item'));
  }
  function allApps(){
    const ids=[...document.querySelectorAll('#desktop>.desktop>.icon[data-app]')].map(n=>n.dataset.app);
    if(typeof InstalledAppsState!=='undefined')ids.push(...InstalledAppsState.apps.map(a=>'installed:'+a.fileName));
    return [...new Set(ids)].filter(id=>Desktop_appAvailable(id)).map(id=>({id,name:Desktop_appName(id)}));
  }
  function renderApps(){
    const query=launcherInput.value.trim().toLowerCase();appGrid.replaceChildren();
    const apps=allApps().filter(app=>app.name.toLowerCase().includes(query));
    for(const app of apps){const b=el('button','mac-app-tile');b.type='button';b.setAttribute('aria-label','Open '+app.name);b.append(Desktop_appIcon(app.id),el('span','',app.name));b.addEventListener('click',()=>launch(app.id));appGrid.append(b);}
    if(!apps.length)appGrid.append(el('p','mac-no-results','No apps found. Try another name.'));
    $('#mac-app-count').textContent=apps.length+' applications';
  }
  function openLauncher(anchor){if(!beginPanel(anchor,overlay))return;launcherInput.value='';renderApps();launcherInput.focus();}
  function buildChrome(){
    const desktop=$('#desktop'),bar=el('nav','mac-menu-bar');bar.setAttribute('aria-label','Desktop menu bar');
    const system=button('JackOS menu',glyph('system'),()=>menu(system,[{label:'About JackOS',action:()=>{launch('settings');Settings_showAboutJackOS();}},null,{label:'System Settings…',action:()=>launch('settings')},{label:'App Store…',action:()=>launch('appstore')},null,{label:'Lock Screen',action:()=>Desktop_lock()},{label:'Log Out…',action:()=>Desktop_logout()}]),'mac-system');
    appLabel=button('Active application','Finder',()=>menu(appLabel,[{label:'All Applications',action:()=>openLauncher(appLabel)},{label:'Show Desktop',action:showDesktop}]),'mac-active-app');
    const file=button('File menu','File',()=>menu(file,[{label:'Open Finder',action:()=>launch('explorer')},{label:'New Folder on Desktop',action:()=>Desktop_newFolderFromWallpaper()},{label:'New File on Desktop',action:()=>Desktop_newFileFromWallpaper()},null,{label:'Open App Store',action:()=>launch('appstore')}]),'mac-menu-secondary');
    const view=button('View menu','View',()=>menu(view,[{label:'Show Desktop',action:showDesktop},{label:'Applications',hint:'⌃ Space',action:()=>openLauncher(view)},{label:root.dataset.macWidgets==='true'?'Hide Widgets':'Show Widgets',action:()=>togglePref('widgets')},null,{label:root.dataset.macAppearance==='dark'?'Use Light Appearance':'Use Dark Appearance',action:()=>appearance(root.dataset.macAppearance==='dark'?'light':'dark')}]),'mac-menu-secondary');
    const go=button('Go menu','Go',()=>menu(go,[{label:'Home',action:()=>{launch('explorer');Explorer_showHome();}},{label:'JackOS Drive',action:()=>{launch('explorer');Explorer_openJackOSDrive();}},{label:'Applications',action:()=>{launch('explorer');Explorer_openApplications();}},{label:'Trash',action:()=>{launch('explorer');Explorer_openRecycleBin();}}]),'mac-menu-secondary');
    const windows=button('Window menu','Window',()=>{const records=[...WindowManager.windows.values()].filter(r=>getComputedStyle(r.element).display!=='none'||r.minimised);menu(windows,[{label:'Show Desktop',action:showDesktop},null,...records.map(r=>({label:r.title,action:()=>WindowManager.show(r.id)}))]);},'mac-menu-secondary');
    const help=button('Help menu','Help',()=>menu(help,[{label:'Search and open apps',hint:'⌃ Space',action:()=>openLauncher(help)},{label:'Appearance and wallpaper',action:()=>{beginPanel(cc,controls);renderControls();}},{label:'About this edition',action:()=>{launch('settings');Settings_backToMain();$('#mac-appearance-settings')?.scrollIntoView({block:'center'});}}]),'mac-menu-secondary');
    const network=el('span','mac-network mac-hide-mobile');network.innerHTML=glyph('wifi');network.title=navigator.onLine?'Browser is online':'Browser is offline';network.setAttribute('aria-label',network.title);
    const search=button('Search applications',glyph('search'),()=>openLauncher(search),'mac-search-button');
    const cc=button('Control Centre',glyph('controls'),()=>{if(beginPanel(cc,controls))renderControls();},'mac-control-button');
    const notifications=button('Notification Centre',glyph('bell'),()=>{closePanels(false);Notifications_open();},'mac-hide-mobile');
    clock=button('Date and time','',()=>{closePanels(false);Notifications_open();},'mac-menu-clock');
    for(const b of [system,appLabel,file,view,go,windows,help,search,cc]){b.setAttribute('aria-haspopup',b===search?'dialog':'menu');b.setAttribute('aria-expanded','false');}
    bar.append(system,appLabel,file,view,go,windows,help,el('span','mac-menu-spacer'),network,search,cc,notifications,clock);desktop.append(bar);
    popover=el('div','mac-popover');popover.hidden=true;popover.setAttribute('role','menu');popover.setAttribute('aria-label','Desktop menu');
    controls=el('div','mac-popover mac-controls');controls.hidden=true;controls.setAttribute('role','dialog');controls.setAttribute('aria-label','Control Centre');
    overlay=el('div','mac-overlay');overlay.hidden=true;
    const panel=el('section','mac-launcher');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Applications');
    const head=el('div','mac-launcher-head'),field=el('label','mac-search-field');field.innerHTML=glyph('search');
    launcherInput=el('input');launcherInput.type='search';launcherInput.placeholder='Search applications';launcherInput.setAttribute('aria-label','Search applications');launcherInput.addEventListener('input',renderApps);field.append(launcherInput);
    head.append(field,button('Close applications','×',()=>closePanels(),'mac-panel-close'));
    appGrid=el('div','mac-app-grid');appGrid.setAttribute('aria-live','polite');
    const foot=el('div','mac-launcher-foot');const count=el('span');count.id='mac-app-count';foot.append(count,el('span','','Esc to close · Enter to open'));
    panel.append(head,appGrid,foot);overlay.append(panel);overlay.addEventListener('click',e=>{if(e.target===overlay)closePanels();});
    launcherInput.addEventListener('keydown',e=>{if(e.key==='Enter'){appGrid.querySelector('button')?.click();}if(e.key==='ArrowDown'){e.preventDefault();appGrid.querySelector('button')?.focus();}});
    desktop.append(popover,controls,overlay);
    const dock=$('#desktop .taskbar');dock.setAttribute('aria-label','Dock');
    const appsButton=button('Applications',icon('launchpad'),()=>openLauncher(appsButton),'mac-dock-button');
    const trash=button('Trash',icon('trash'),()=>{launch('explorer');Explorer_openRecycleBin();},'mac-dock-button');
    dock.prepend(appsButton);dock.append(el('span','mac-dock-separator'),trash);
    const widgets=el('aside','mac-widgets');widgets.setAttribute('aria-label','Desktop widgets');
    const calendar=el('section','mac-widget');widgetDate=el('div','mac-widget-date');week=el('div','mac-week');
    const month=el('div','mac-widget-month');month.id='mac-month';const day=el('div','mac-widget-label');day.id='mac-day';calendar.append(day,widgetDate,month,week);
    const time=el('section','mac-widget mac-clock-widget');widgetTime=el('div','mac-widget-time');widgetGreeting=el('div','mac-widget-greeting');const lines=el('div','mac-clock-lines');for(const h of [7,11,16,21,17,23,13,9,16,20,13,7,10,15,21,12,8,14]){const line=el('i');line.style.height=h+'px';lines.append(line);}time.append(el('div','mac-widget-label','LOCAL TIME'),widgetTime,lines,widgetGreeting);widgets.append(calendar,time);
    $('#desktop>.desktop').prepend(widgets);$('#desktop>.desktop').append(el('div','mac-desktop-signature','JACKOS / MAC EDITION'));
    const settings=el('section');settings.id='mac-appearance-settings';settings.append(el('h3','','Appearance'));
    const row=el('div','mac-appearance-row');for(const value of ['light','dark']){const b=button(value+' appearance',value==='light'?'☀  Light':'☾  Dark',()=>appearance(value));b.dataset.macAppearanceChoice=value;row.append(b);}settings.append(row);$('#settingsMain')?.prepend(settings);
  }
  function updateClock(){
    const now=new Date();clock.textContent=now.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+'  '+now.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
    widgetTime.textContent=now.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hour12:false});
    widgetDate.textContent=now.getDate();$('#mac-month').textContent=now.toLocaleDateString(undefined,{month:'long',year:'numeric'}).toUpperCase();$('#mac-day').textContent=now.toLocaleDateString(undefined,{weekday:'long'});
    const hour=now.getHours();widgetGreeting.textContent=`Good ${hour<12?'morning':hour<18?'afternoon':'evening'}, ${userKey()}.`;
    week.replaceChildren();for(const label of ['M','T','W','T','F','S','S'])week.append(el('b','',label));
    const monday=new Date(now);monday.setDate(now.getDate()-((now.getDay()+6)%7));for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(d.getDate()+i);week.append(el('span',d.toDateString()===now.toDateString()?'today':'',d.getDate()));}
    const network=$('.mac-network');if(network){network.title=navigator.onLine?'Browser is online':'Browser is offline';network.setAttribute('aria-label',network.title);network.style.opacity=navigator.onLine?'1':'.4';}
  }
  function sync(){
    if(!appLabel)return;
    const visible=[...WindowManager.windows.values()].filter(r=>getComputedStyle(r.element).display!=='none'&&!r.element.classList.contains('window-minimized'));
    visible.sort((a,b)=>(+b.element.style.zIndex||0)-(+a.element.style.zIndex||0));const active=visible[0];
    appLabel.textContent=active?(active.id==='explorer'?'Finder':active.title):'Finder';
    for(const r of WindowManager.windows.values())r.element.classList.toggle('mac-inactive',!!active&&r!==active);
    if(!overlay.hidden)renderApps();
  }
  function init(){
    if(!$('#desktop')||typeof Desktop_launch!=='function')return;
    for(const source of document.querySelectorAll('#desktop>.desktop>.icon[data-app]')){const box=source.querySelector('.icon-box');if(box&&iconSpecs[source.dataset.app]){box.innerHTML=icon(source.dataset.app);box.style.fontSize='';}const label=source.lastElementChild;if(label!==box&&source.dataset.app==='explorer')label.textContent='Finder';if(label!==box&&source.dataset.app==='settings')label.textContent='System Settings';}
    const nativeIcon=Desktop_appIcon;
    window.Desktop_appIcon=function(id){const key=Desktop_windowAppId(id);if(!iconSpecs[key])return nativeIcon(id);const box=el('span','icon-box');box.innerHTML=icon(key);box.setAttribute('aria-hidden','true');return box;};
    const nativeName=Desktop_appName;window.Desktop_appName=function(id){const key=Desktop_windowAppId(id);return key==='explorer'?'Finder':key==='settings'?'System Settings':nativeName(id);};
    for(const record of WindowManager.windows.values())record.title=Desktop_appName(Desktop_windowAppId(record.id));
    const nativePins=Desktop_getTaskbarPins,nativeSetPins=Desktop_setTaskbarPins;
    window.Desktop_getTaskbarPins=function(){const pins=nativePins();return pins.length||storage.get('dockConfigured:'+userKey(),'')?pins:['explorer','browser','messages','photos','music','appstore','settings'];};
    window.Desktop_setTaskbarPins=function(pins){storage.set('dockConfigured:'+userKey(),'true');return nativeSetPins(pins);};
    buildChrome();applyPreferences();updateClock();setInterval(updateClock,15000);
    const nativeRefresh=Desktop_refreshTaskbar;window.Desktop_refreshTaskbar=function(...args){const result=nativeRefresh(...args);sync();return result;};
    const nativeWallpaper=applySavedWallpaper;window.applySavedWallpaper=function(...args){const result=nativeWallpaper(...args);applyPreferences();return result;};
    for(const name of ['Desktop_setWallpaper','Desktop_setWallpaperFromData']){const original=window[name];window[name]=function(...args){const result=original.apply(this,args);storage.set('wallpaper','custom');applyPreferences();return result;};}
    for(const name of ['focus','minimize','close','show','toggleMaximize']){const original=WindowManager[name];WindowManager[name]=function(...args){const result=original.apply(this,args);if(name==='close'){const record=this.get(args[0]);if(record){record.minimised=false;record.element.classList.remove('window-minimized');}}sync();return result;};}
    WindowManager.bounds=function(win){const rect=win.getBoundingClientRect(),workBottom=innerHeight-100;return {minLeft:8,maxLeft:Math.max(8,innerWidth-rect.width-8),minTop:40,maxTop:Math.max(40,workBottom-rect.height),width:rect.width,height:rect.height,workBottom};};
    WindowManager.restoreToScreen=function(id){const record=this.get(id);if(!record)return;this.show(id);record.maximised=false;record.element.classList.remove('window-maximized');const rect=record.element.getBoundingClientRect(),position=this.clamp(record.element,rect.left,rect.top);record.element.style.left=position.left+'px';record.element.style.top=position.top+'px';record.element.style.transform='none';this.focus(id);};
    window.addEventListener('resize',()=>{for(const record of WindowManager.windows.values()){if(getComputedStyle(record.element).display==='none'||record.element.classList.contains('window-maximized'))continue;const rect=record.element.getBoundingClientRect(),position=WindowManager.clamp(record.element,rect.left,rect.top);record.element.style.left=position.left+'px';record.element.style.top=position.top+'px';record.element.style.transform='none';}});
    const observer=new MutationObserver(()=>{if(!desktopActive())closePanels(false);updateClock();});observer.observe($('#desktop'),{attributes:true,attributeFilter:['class']});
    const headers=[['#explorer .header .title','Finder'],['#settingsHeader .title','System Settings']];for(const [selector,name] of headers)if($(selector))$(selector).textContent=name;
    document.querySelectorAll('#explorerSidebar button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#explorerSidebar button').forEach(n=>n.classList.remove('mac-selected'));b.classList.add('mac-selected');}));
    document.addEventListener('pointerdown',e=>{if(!e.target.closest('.mac-menu-bar,.mac-popover,.mac-overlay,.mac-dock-button'))closePanels(false);});
    document.addEventListener('keydown',e=>{
      if(!desktopActive())return;
      if(e.ctrlKey&&e.code==='Space'){e.preventDefault();openLauncher($('.mac-search-button'));return;}
      if(e.key==='Escape'&&[popover,overlay,controls].some(p=>!p.hidden)){e.preventDefault();closePanels();return;}
      const panel=[overlay,controls,popover].find(p=>!p.hidden);if(!panel)return;
      const items=[...panel.querySelectorAll('button:not(:disabled),input')];
      if(e.key==='Tab'&&items.length){const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
      if(panel===popover&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const at=items.indexOf(document.activeElement),next=(at+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();}
    });
    window.addEventListener('online',updateClock);window.addEventListener('offline',updateClock);
    Desktop_refreshTaskbar();sync();
  }
  window.JackOSMac={version:'2.0.0',init,openLauncher,closePanels,appearance,sync};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
