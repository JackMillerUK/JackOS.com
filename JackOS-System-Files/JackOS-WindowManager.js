//JackOS-WindowManager.js
// Shared application window manager used by built-in and installed apps.
const WindowManager={
  windows:new Map(),
  z:100,

  register(config){
    if(!config?.id||!config.element) return null;
    const record=Object.assign(this.windows.get(config.id)||{}, {
      id:config.id,title:config.title||config.id,element:config.element,
      minimised:config.element.classList.contains('window-minimized'),
      maximised:config.element.classList.contains('window-maximized')
    });
    this.windows.set(config.id,record);
    return record;
  },

  get(id){ return this.windows.get(id)||null; },

  bounds(win){
    const rect=win.getBoundingClientRect();
    const header=win.querySelector('.window-titlebar,.header,.game-header,.app-window-header,#browserBar,#calcHeader,#jcamHeader,#settingsHeader,#photosHeader,#musicHeader');
    const headerHeight=header?.getBoundingClientRect().height||42;
    const desktop=document.querySelector('#desktop .desktop');
    const workArea=desktop?.getBoundingClientRect();
    const workBottom=Math.min(innerHeight,workArea?.bottom||innerHeight);
    const minLeft=Math.min(50-rect.width,innerWidth-rect.width);
    const maxLeft=Math.max(minLeft,innerWidth-50);
    const minTop=Math.min(24-headerHeight,innerHeight-headerHeight);
    const maxTop=Math.max(minTop,workBottom-50);
    return {minLeft,maxLeft,minTop,maxTop,width:rect.width,height:rect.height,workBottom};
  },

  clamp(win,left,top){
    const b=this.bounds(win);
    return {left:Math.max(b.minLeft,Math.min(b.maxLeft,left)),top:Math.max(b.minTop,Math.min(b.maxTop,top))};
  },

  focus(id){
    const record=this.get(id); if(!record) return;
    if(record.element.classList.contains('window-minimized')) return this.restore(id);
    if(typeof DesktopWindows!=='undefined') this.z=Math.max(this.z,DesktopWindows.z);
    record.element.style.zIndex=String(++this.z);
    if(typeof DesktopWindows!=='undefined') DesktopWindows.z=Math.max(DesktopWindows.z,this.z);
    if(typeof Desktop_refreshTaskbar==='function') Desktop_refreshTaskbar();
  },

  show(id){
    const record=this.get(id); if(!record) return;
    record.minimised=false;
    record.element.classList.remove('window-minimized');
    record.element.style.display='block';
    if(typeof DesktopMinimisedApps!=='undefined') DesktopMinimisedApps.delete(id);
    this.focus(id);
  },

  restore(id){ this.show(id); },

  minimize(id){
    const record=this.get(id); if(!record) return;
    record.minimised=true;
    record.element.classList.add('window-minimized');
    if(typeof DesktopMinimisedApps!=='undefined') DesktopMinimisedApps.add(id);
    if(typeof Desktop_refreshTaskbar==='function') Desktop_refreshTaskbar();
  },

  toggleMaximize(id){
    const record=this.get(id); if(!record) return;
    record.maximised=record.element.classList.toggle('window-maximized');
    this.focus(id);
  },

  restoreToScreen(id){
    const record=this.get(id); if(!record) return;
    this.show(id);
    const win=record.element;
    win.classList.remove('window-maximized'); record.maximised=false;
    const rect=win.getBoundingClientRect();
    const desktop=document.querySelector('#desktop .desktop');
    const workBottom=Math.min(innerHeight,desktop?.getBoundingClientRect().bottom||innerHeight);
    win.style.left=`${Math.max(12,Math.min(innerWidth-rect.width-12,rect.left))}px`;
    win.style.top=`${Math.max(12,Math.min(workBottom-rect.height-12,rect.top))}px`;
    win.style.transform='none'; this.focus(id);
  },

  close(id){
    const record=this.get(id); if(!record) return;
    if(typeof DesktopMinimisedApps!=='undefined') DesktopMinimisedApps.delete(id);
    const appId=typeof Desktop_windowAppId==='function'?Desktop_windowAppId(id):id;
    const app=typeof APP_REGISTRY!=='undefined'?APP_REGISTRY[appId]:null;
    if(app?.close){ try{app.close();}catch(error){record.element.style.display='none';} }
    else record.element.style.display='none';
    if(typeof Desktop_refreshTaskbar==='function') Desktop_refreshTaskbar();
  },

  attach(config){
    const record=this.register(config); if(!record) return null;
    const win=record.element; if(win.dataset.windowReady==='true') return record;
    const header=win.querySelector('.window-titlebar,.header,.game-header,.app-window-header,#browserBar,#calcHeader,#jcamHeader,#settingsHeader,#photosHeader,#musicHeader');
    if(!header) return record;
    win.dataset.windowReady='true'; header.classList.add('window-titlebar');
    let controls=header.querySelector('.window-controls');
    if(!controls){
      controls=document.createElement('div'); controls.className='window-controls';
      const min=document.createElement('button'); min.className='window-control'; min.type='button'; min.textContent='−'; min.title='Minimize'; min.setAttribute('aria-label','Minimize window');
      const max=document.createElement('button'); max.className='window-control'; max.type='button'; max.textContent='□'; max.title='Maximize'; max.setAttribute('aria-label','Maximize window');
      const close=document.createElement('button'); close.className='window-control close'; close.type='button'; close.textContent='×'; close.title='Close'; close.setAttribute('aria-label','Close window');
      controls.append(min,max,close); header.append(controls);
      min.addEventListener('click',event=>{event.stopPropagation();this.minimize(config.id);});
      max.addEventListener('click',event=>{event.stopPropagation();this.toggleMaximize(config.id);});
      close.addEventListener('click',event=>{event.stopPropagation();this.close(config.id);});
    }

    win.addEventListener('pointerdown',()=>this.focus(config.id));
    let drag=null;
    header.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button,input,label,.controls,.actions')||win.classList.contains('window-maximized')) return;
      const rect=win.getBoundingClientRect(); win.style.left=`${rect.left}px`; win.style.top=`${rect.top}px`; win.style.transform='none';
      drag={pointerId:event.pointerId,x:event.clientX-rect.left,y:event.clientY-rect.top};
      try{header.setPointerCapture(event.pointerId);}catch(error){}
      event.preventDefault();
    });
    header.addEventListener('pointermove',event=>{
      if(!drag||drag.pointerId!==event.pointerId||win.classList.contains('window-maximized')) return;
      const position=this.clamp(win,event.clientX-drag.x,event.clientY-drag.y);
      win.style.left=`${position.left}px`; win.style.top=`${position.top}px`;
    });
    const stopDrag=event=>{if(drag&&drag.pointerId===event.pointerId) drag=null;};
    header.addEventListener('pointerup',stopDrag); header.addEventListener('pointercancel',stopDrag);
    header.addEventListener('dblclick',event=>{
      if(event.target.closest('button,input,label,.controls,.actions')) return;
      event.preventDefault(); this.restoreToScreen(config.id);
    });

    ['n','s','e','w','nw','ne','sw','se'].forEach(direction=>{
      const handle=document.createElement('div'); handle.className=`window-resize-handle ${direction}`; handle.setAttribute('aria-hidden','true'); win.append(handle);
      let resize=null;
      handle.addEventListener('pointerdown',event=>{
        if(win.classList.contains('window-maximized')) return;
        event.preventDefault();event.stopPropagation();
        const rect=win.getBoundingClientRect();win.style.left=`${rect.left}px`;win.style.top=`${rect.top}px`;win.style.width=`${rect.width}px`;win.style.height=`${rect.height}px`;win.style.transform='none';
        resize={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,width:rect.width,height:rect.height};
        try{handle.setPointerCapture(event.pointerId);}catch(error){}
        this.focus(config.id);
      });
      handle.addEventListener('pointermove',event=>{
        if(!resize||win.classList.contains('window-maximized')) return;
        const dx=event.clientX-resize.x,dy=event.clientY-resize.y;
        let left=resize.left,top=resize.top,width=resize.width,height=resize.height;
        if(direction.includes('e')) width=Math.max(260,resize.width+dx);
        if(direction.includes('s')) height=Math.max(180,resize.height+dy);
        if(direction.includes('w')){width=Math.max(260,resize.width-dx);left=resize.left+resize.width-width;}
        if(direction.includes('n')){height=Math.max(180,resize.height-dy);top=resize.top+resize.height-height;}
        const position=this.clamp(win,left,top);
        width=Math.min(width,Math.max(260,innerWidth+50-position.left));
        height=Math.min(height,Math.max(180,innerHeight+50-position.top));
        win.style.left=`${position.left}px`;win.style.top=`${position.top}px`;win.style.width=`${width}px`;win.style.height=`${height}px`;
      });
      const stopResize=()=>{resize=null;};handle.addEventListener('pointerup',stopResize);handle.addEventListener('pointercancel',stopResize);
    });
    return record;
  }
};