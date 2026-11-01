//JackOS-WindowManager.js
// Shared application window manager used by built-in and installed apps.
const WindowManager={
  windows:new Map(),
  z:100,
  fullscreenId:null,
  fullscreenWasMaximised:false,
  revealTimer:0,
  fullscreenEdges:[],
  fullscreenRevealTargets:[],

  register(config){
    if(!config?.id||!config.element) return null;
    const record=Object.assign(this.windows.get(config.id)||{}, {
      id:config.id,title:config.title||config.id,element:config.element,
      minimised:config.element.classList.contains('window-minimized'),
      maximised:config.element.classList.contains('window-maximized')
    });
    this.updateRenderingClass(record);
    this.windows.set(config.id,record);
    return record;
  },

  get(id){ return this.windows.get(id)||null; },

  updateRenderingClass(record){
    if(!record?.element) return;
    record.element.classList.toggle(
      'jackos-performance-window',
      !!record.element.querySelector('iframe,canvas,video')
    );
  },

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
    this.updateRenderingClass(record);
    if(this.fullscreenId&&this.fullscreenId!==id) this.exitFullscreen();
    if(record.element.classList.contains('window-minimized')) return this.restore(id);
    if(typeof DesktopWindows!=='undefined') this.z=Math.max(this.z,DesktopWindows.z);
    record.element.style.zIndex=String(++this.z);
    if(typeof DesktopWindows!=='undefined') DesktopWindows.z=Math.max(DesktopWindows.z,this.z);
    if(typeof Desktop_refreshTaskbar==='function') Desktop_refreshTaskbar();
  },

  show(id){
    const record=this.get(id); if(!record) return;
    if(this.fullscreenId&&this.fullscreenId!==id) this.exitFullscreen();
    record.minimised=false;
    record.element.classList.remove('window-minimized');
    record.element.style.display='block';
    if(typeof DesktopMinimisedApps!=='undefined') DesktopMinimisedApps.delete(id);
    this.focus(id);
  },

  restore(id){ this.show(id); },

  minimize(id){
    const record=this.get(id); if(!record) return;
    if(this.fullscreenId===id) this.exitFullscreen(id);
    record.minimised=true;
    record.element.classList.add('window-minimized');
    if(typeof DesktopMinimisedApps!=='undefined') DesktopMinimisedApps.add(id);
    if(typeof Desktop_refreshTaskbar==='function') Desktop_refreshTaskbar();
  },

  toggleMaximize(id){
    const record=this.get(id); if(!record) return;
    if(this.fullscreenId===id){
      this.exitFullscreen(id);
      return;
    }
    this.exitFullscreen();
    this.fullscreenWasMaximised=record.element.classList.contains('window-maximized');
    this.fullscreenId=id;
    record.maximised=true;
    record.element.classList.add('window-maximized','jackos-fullscreen-app');
    document.documentElement.classList.add('jackos-app-fullscreen');
    document.documentElement.dataset.jackosFullscreenApp=id;
    const control=record.element.querySelector('.window-control.fullscreen');
    if(control){
      control.title='Exit fullscreen';
      control.setAttribute('aria-label','Exit fullscreen');
      control.setAttribute('aria-pressed','true');
    }
    this.createFullscreenEdges();
    this.focus(id);
  },

  exitFullscreen(id=this.fullscreenId){
    if(!this.fullscreenId||(id&&this.fullscreenId!==id)) return;
    const record=this.get(this.fullscreenId);
    record?.element.classList.remove('jackos-fullscreen-app');
    if(record){
      if(!this.fullscreenWasMaximised) record.element.classList.remove('window-maximized');
      record.maximised=this.fullscreenWasMaximised;
      const control=record.element.querySelector('.window-control.fullscreen');
      if(control){
        control.title='Fullscreen';
        control.setAttribute('aria-label','Enter fullscreen');
        control.setAttribute('aria-pressed','false');
      }
    }
    this.fullscreenId=null;
    this.fullscreenWasMaximised=false;
    document.documentElement.classList.remove('jackos-app-fullscreen','jackos-fullscreen-taskbar-visible','jackos-fullscreen-chrome-visible');
    delete document.documentElement.dataset.jackosFullscreenApp;
    clearTimeout(this.revealTimer);
    this.fullscreenEdges.forEach(edge=>edge.remove());
    this.fullscreenEdges=[];
    document.removeEventListener('pointermove',this.handleFullscreenPointerMove);
    document.removeEventListener('keydown',this.handleFullscreenKeydown,true);
    this.fullscreenRevealTargets.forEach(target=>{
      target.removeEventListener('pointerleave',this.handleFullscreenChromeLeave);
      target.removeEventListener('pointerleave',this.handleFullscreenTaskbarLeave);
    });
    this.fullscreenRevealTargets=[];
  },

  createFullscreenEdges(){
    if(this.fullscreenEdges.length) return;
    for(const edgeName of ['top','bottom']){
      const edge=document.createElement('div');
      edge.className=`jackos-fullscreen-edge jackos-fullscreen-edge-${edgeName}`;
      edge.setAttribute('aria-hidden','true');
      edge.addEventListener('pointerenter',()=>{
        clearTimeout(this.revealTimer);
        document.documentElement.classList.add(edgeName==='top'?'jackos-fullscreen-chrome-visible':'jackos-fullscreen-taskbar-visible');
      });
      edge.addEventListener('pointerleave',event=>{
        const y=event.clientY;
        this.revealTimer=setTimeout(()=>{
          if(!this.fullscreenId) return;
          const taskbar=document.querySelector('#desktop .taskbar');
          const titlebar=this.get(this.fullscreenId)?.element.querySelector('.window-titlebar');
          if(edgeName==='top'&&y>16&&!titlebar?.matches(':hover')){
            document.documentElement.classList.remove('jackos-fullscreen-chrome-visible');
          }
          if(edgeName==='bottom'&&y<innerHeight-16&&!taskbar?.matches(':hover')){
            document.documentElement.classList.remove('jackos-fullscreen-taskbar-visible');
          }
        },120);
      });
      (document.getElementById('desktop')||document.body).append(edge);
      this.fullscreenEdges.push(edge);
    }
    const app=this.get(this.fullscreenId)?.element;
    const taskbar=document.querySelector('#desktop .taskbar');
    const menuBar=document.querySelector('.mac-menu-bar');
    [app?.querySelector('.window-titlebar'),menuBar].filter(Boolean).forEach(target=>{
      target.addEventListener('pointerleave',this.handleFullscreenChromeLeave);
      this.fullscreenRevealTargets.push(target);
    });
    if(taskbar){
      taskbar.addEventListener('pointerleave',this.handleFullscreenTaskbarLeave);
      this.fullscreenRevealTargets.push(taskbar);
    }
    document.addEventListener('pointermove',this.handleFullscreenPointerMove);
    document.addEventListener('keydown',this.handleFullscreenKeydown,true);
  },

  handleFullscreenPointerMove(event){
    if(!WindowManager.fullscreenId) return;
    const root=document.documentElement;
    const taskbar=document.querySelector('#desktop .taskbar');
    const titlebar=WindowManager.get(WindowManager.fullscreenId)?.element.querySelector('.window-titlebar');
    root.classList.toggle('jackos-fullscreen-taskbar-visible',event.clientY>=innerHeight-12||!!taskbar?.matches(':hover'));
    root.classList.toggle('jackos-fullscreen-chrome-visible',event.clientY<=12||!!titlebar?.matches(':hover'));
  },

  handleFullscreenKeydown(event){
    if(event.key==='Escape'&&WindowManager.fullscreenId){
      event.preventDefault();
      WindowManager.exitFullscreen();
    }
  },

  handleFullscreenChromeLeave(event){
    if(!WindowManager.fullscreenId||event.clientY<=16) return;
    WindowManager.revealTimer=setTimeout(()=>{
      const titlebar=WindowManager.get(WindowManager.fullscreenId)?.element.querySelector('.window-titlebar');
      const menuBar=document.querySelector('.mac-menu-bar');
      const topEdge=document.querySelector('.jackos-fullscreen-edge-top');
      if(!titlebar?.matches(':hover')&&!menuBar?.matches(':hover')&&!topEdge?.matches(':hover')){
        document.documentElement.classList.remove('jackos-fullscreen-chrome-visible');
      }
    },120);
  },

  handleFullscreenTaskbarLeave(event){
    if(!WindowManager.fullscreenId||event.clientY>=innerHeight-16) return;
    WindowManager.revealTimer=setTimeout(()=>{
      const taskbar=document.querySelector('#desktop .taskbar');
      const bottomEdge=document.querySelector('.jackos-fullscreen-edge-bottom');
      if(!taskbar?.matches(':hover')&&!bottomEdge?.matches(':hover')){
        document.documentElement.classList.remove('jackos-fullscreen-taskbar-visible');
      }
    },120);
  },

  restoreToScreen(id){
    const record=this.get(id); if(!record) return;
    if(this.fullscreenId===id) this.exitFullscreen(id);
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

  terminateContent(win){
    if(!win) return;
    win.querySelectorAll('iframe').forEach(frame=>{
      frame.removeAttribute('srcdoc');
      frame.src='about:blank';
    });
    win.querySelectorAll('audio,video').forEach(media=>{
      media.pause();
      if(media.srcObject){
        media.srcObject.getTracks().forEach(track=>track.stop());
        media.srcObject=null;
      }
      media.removeAttribute('src');
      media.querySelectorAll('source').forEach(source=>source.remove());
      media.load();
    });
    win.getAnimations?.({subtree:true}).forEach(animation=>animation.cancel());
  },

  close(id){
    const record=this.get(id); if(!record) return;
    if(this.fullscreenId===id) this.exitFullscreen(id);
    if(typeof DesktopMinimisedApps!=='undefined') DesktopMinimisedApps.delete(id);
    const appId=typeof Desktop_windowAppId==='function'?Desktop_windowAppId(id):id;
    const app=typeof APP_REGISTRY!=='undefined'?APP_REGISTRY[appId]:null;
    const installed=typeof InstalledApps_appForWindow==='function'&&InstalledApps_appForWindow(id);
    if(typeof JackOSInput!=='undefined'&&JackOSInput.activeFrame&&record.element.contains(JackOSInput.activeFrame)){
      JackOSInput.exitPointerLock();
    }
    try{
      if(app?.close) app.close();
    }catch(error){
      console.error(`Unable to close ${record.title}.`,error);
    }finally{
      this.terminateContent(record.element);
      if(installed&&typeof InstalledApps_removeWindow==='function'){
        InstalledApps_removeWindow(installed.fileName);
      }else{
        record.element.style.display='none';
      }
      record.element.classList.remove('window-minimized','window-maximized');
    }
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
      const max=document.createElement('button'); max.className='window-control fullscreen'; max.type='button'; max.textContent='⛶'; max.title='Fullscreen'; max.setAttribute('aria-label','Enter fullscreen'); max.setAttribute('aria-pressed','false');
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