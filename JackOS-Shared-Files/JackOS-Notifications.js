// JackOS-Notifications.js — native JackOS notification centre.
(function(){
  const SERVER='../JackOS-Server-Files/Notifications/notifications.json';
  const SEEN='jackosSeenNotifications';
  const LOCAL='jackosLocalNotifications';
  const DISMISSED='jackosDismissedNotifications';
  let timer=null;
  const userKey=name=>encodeURIComponent(String(name||window.currentUser||localStorage.getItem('jackosLastUser')||'system'));
  const read=(key,fallback=[])=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(v)?v:fallback}catch(_){return fallback}};
  const save=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v))}catch(_) {}};
  const key=(base,name)=>base+':'+userKey(name);
  const seen=(name)=>read(key(SEEN,name));
  const dismissed=(name)=>read(key(DISMISSED,name));
  const local=(name)=>read(key(LOCAL,name));
  const all=(name)=>local(name).filter(n=>!dismissed(name).includes(n.id)).sort((a,b)=>String(b.timestamp||'').localeCompare(String(a.timestamp||'')));
  function addForUser(name,n){
    if(!name||!n?.id||dismissed(name).includes(n.id)) return false;
    const list=local(name); if(list.some(x=>x.id===n.id)) return false;
    const item={...n,source:n.source||'system',receivedAt:new Date().toISOString()};
    list.push(item);
    save(key(LOCAL,name),list);

    // If Messages is already sitting inside this exact conversation, the
    // notification is immediately considered handled. It is cleared, not
    // marked as read, because the user is already looking at the conversation.
    const current=String(window.currentUser||localStorage.getItem('jackosLastUser')||'');
    const conversation=item.targetConversation||item.conversationId||item.conversation||item.target||'';
    if(String(name)===current && item.appId==='messages' && conversation && typeof Messages_syncActiveConversation==='function'){
      try{Messages_syncActiveConversation(conversation)}catch(_){/* keep notification delivery resilient */}
    }
    return true;
  }
  function markSeen(id){const name=window.currentUser||localStorage.getItem('jackosLastUser');const s=seen(name);if(!s.includes(id)){s.push(id);save(key(SEEN,name),s)}}
  function dismiss(id){const name=window.currentUser||localStorage.getItem('jackosLastUser');const d=dismissed(name);if(!d.includes(id))d.push(id);save(key(DISMISSED,name),d);save(key(LOCAL,name),local(name).filter(n=>n.id!==id));}
  function updateBadge(){
    const name=window.currentUser||localStorage.getItem('jackosLastUser'); const count=all(name).filter(n=>!seen(name).includes(n.id)).length;
    const b=document.getElementById('notificationsBadge'); if(b){b.hidden=count===0;b.textContent=count>99?'99+':String(count)}
  }
  function render(){
    const list=document.getElementById('notificationList'); if(!list)return;
    const name=window.currentUser||localStorage.getItem('jackosLastUser'); const items=all(name), s=seen(name); list.innerHTML='';
    if(!items.length){list.innerHTML='<div class="notification-empty"><span>✓</span><b>All caught up</b><p>No notifications right now.</p></div>';updateBadge();return;}
    items.forEach(n=>{
      const el=document.createElement('article'); el.className='notification-item'+(s.includes(n.id)?' is-seen':'');
      el.innerHTML='<div class="notification-item-icon"></div><div class="notification-item-content"><div class="notification-item-top"><strong></strong><button class="notification-dismiss" aria-label="Remove notification" title="Remove">×</button></div><time></time><p class="notification-message"></p></div>';
      el.querySelector('.notification-item-icon').textContent=n.icon||'●';
      el.querySelector('strong').textContent=n.title||'JackOS notification';
      el.querySelector('time').textContent=n.timestamp?new Date(n.timestamp).toLocaleString('en-GB'):'';
      el.querySelector('.notification-message').textContent=n.message||'';
      el.onclick=()=>{
        // A Messages notification is identified by its conversation reference,
        // not only by appId. Older direct-message notifications may not have
        // appId='messages', so they must still follow the Messages path.
        const conversation=n.targetConversation||n.conversationId||n.conversation||n.target||'';
        const isMessage=String(n.appId||n.targetApp||'')==='messages' || !!conversation && (String(n.title||'').toLowerCase().includes('message') || String(n.source||'').toLowerCase()==='messages');
        if(isMessage){
          close();
          if(conversation) clearForConversation(conversation);
          try{
            Notifications_openTarget?.({...n,appId:'messages',targetConversation:conversation,conversationId:conversation,target:conversation});
          }catch(err){console.warn('Notification action failed:',err)}
          return;
        }

        markSeen(n.id);
        el.classList.add('is-seen');
        updateBadge();
        if(n.appId || n.targetApp || n.action){
          close();
          try{
            if(typeof Notifications_openTarget==='function') Notifications_openTarget(n);
          }catch(err){console.warn('Notification action failed:',err)}
          return;
        }
        el.classList.toggle('expanded');
      };
      el.querySelector('.notification-dismiss').onclick=e=>{e.stopPropagation();dismiss(n.id);render()};
      list.appendChild(el);
    });
    updateBadge();
  }
  async function fetchServer(){
    const name=window.currentUser||localStorage.getItem('jackosLastUser'); if(!name)return;
    try{const r=await fetch(SERVER,{cache:'no-store'});if(!r.ok)return;const data=await r.json();const notes=Array.isArray(data.notifications)?data.notifications:[];let fresh=false;notes.forEach(n=>{if(n&&n.id&&addForUser(name,{...n,source:'server'}))fresh=true});if(fresh)render()}catch(_){/* offline: keep cache */}
  }
  function open(){render();const el=document.getElementById('notificationCentre');if(el){el.inert=false;el.classList.add('show');el.setAttribute('aria-hidden','false')}}
  function close(){const el=document.getElementById('notificationCentre');if(el){if(el.contains(document.activeElement)){try{document.activeElement.blur()}catch(_){}}el.classList.remove('show');el.inert=true;el.setAttribute('aria-hidden','true')}}
  function clearAll(){const name=window.currentUser||localStorage.getItem('jackosLastUser');const d=dismissed(name);all(name).forEach(n=>{if(!d.includes(n.id))d.push(n.id)});save(key(DISMISSED,name),d);save(key(LOCAL,name),[]);render()}
  function clearForConversation(conversation){
    const name=window.currentUser||localStorage.getItem('jackosLastUser');
    if(!name||!conversation)return;

    // One canonical matcher is used for direct and group conversations.
    // Direct: direct:Bob == Bob. Group: group:123 == 123.
    const wanted=String(conversation).trim();
    const wantedIsDirect=wanted.startsWith('direct:');
    const wantedIsGroup=wanted.startsWith('group:');
    const directOther=wantedIsDirect?wanted.slice(7):(!wantedIsGroup?wanted:'');
    const groupId=wantedIsGroup?wanted.slice(6):'';
    const current=all(name);

    const canonicalRefs=n=>[
      n?.targetConversation,
      n?.conversationId,
      n?.conversation,
      n?.target
    ].filter(v=>v!==undefined&&v!==null&&String(v).trim()!=='').map(v=>String(v).trim());

    const matches=n=>{
      const refs=canonicalRefs(n);
      if(refs.some(ref=>ref===wanted))return true;

      if(directOther){
        if(refs.some(ref=>ref===directOther || ref===`direct:${directOther}`))return true;
        // Legacy notifications can have no conversation field at all.
        // Message notifications from Bob are still unambiguously Bob's DM.
        const text=`${n?.title||''} ${n?.message||''}`;
        const escaped=directOther.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        try{
          if(new RegExp(`\\b${escaped}\\b`,'i').test(text) && /message/i.test(text))return true;
        }catch(_){}
      }

      if(groupId && refs.some(ref=>ref===groupId || ref===`group:${groupId}`))return true;
      return false;
    };

    const matched=current.filter(matches);
    if(!matched.length){
      // Even if there is nothing currently displayed, force the notification
      // badge to recalculate so stale UI cannot survive a conversation open.
      updateBadge();
      return;
    }

    const d=dismissed(name);
    matched.forEach(n=>{
      if(!d.includes(n.id))d.push(n.id);
    });
    save(key(DISMISSED,name),d);
    save(key(LOCAL,name),local(name).filter(n=>!matches(n)));

    // IMPORTANT: clearing is deliberately not the same operation as marking
    // a notification seen. The notification disappears because the user has
    // entered the conversation; its seen/read history is left untouched.
    render();
  }
  function boot(){close();fetchServer();clearInterval(timer);timer=setInterval(fetchServer,15*60*1000);render()}
  window.Notifications_boot=boot;
  window.Notifications_open=open; window.Notifications_close=close; window.Notifications_clearAll=clearAll; window.Notifications_clearForConversation=clearForConversation;
  window.Notifications_add=(title,message,opts={})=>{const n={id:opts.id||'local-'+crypto.randomUUID(),title,message,timestamp:new Date().toISOString(),priority:opts.priority||'normal',icon:opts.icon||'●',source:opts.source||'system',appId:opts.appId||opts.targetApp||'',target:opts.target||opts.targetConversation||'',targetConversation:opts.targetConversation||opts.target||'',conversationId:opts.conversationId||opts.targetConversation||opts.target||'',action:opts.action||''};if(addForUser(window.currentUser||localStorage.getItem('jackosLastUser'),n))render()};
  window.Notifications_addForUser=(name,title,message,opts={})=>{const n={id:opts.id||'local-'+crypto.randomUUID(),title,message,timestamp:new Date().toISOString(),priority:opts.priority||'normal',icon:opts.icon||'●',source:opts.source||'system',appId:opts.appId||opts.targetApp||'',target:opts.target||opts.targetConversation||'',targetConversation:opts.targetConversation||opts.target||'',conversationId:opts.conversationId||opts.targetConversation||opts.target||'',action:opts.action||''};if(addForUser(name,n)&&String(name)==String(window.currentUser||localStorage.getItem('jackosLastUser')))render()};
  window.Notifications_openTarget=(n)=>{
    const app=String(n?.appId||n?.targetApp||'');
    const conversation=n?.targetConversation||n?.conversationId||n?.conversation||n?.target||'';
    if(app==='messages' || conversation && (/message/i.test(String(n?.title||'')) || /message/i.test(String(n?.source||'')))){
      // Direct and group notifications both hand off the canonical
      // conversation reference to Messages. Messages itself consumes this
      // handoff when it opens, so there is no separate DM-opening path.
      if(conversation){
        try{ sessionStorage.setItem('jackosPendingMessageConversation',String(conversation)); }catch(_){}
      }
      if(typeof Desktop_launch==='function') Desktop_launch('messages');

      // If Messages is already open, Desktop_launch only focuses it. Consume
      // the handoff immediately in that case; the same openConversation()
      // implementation is used for both DMs and groups.
      if(conversation && typeof Messages_openConversation==='function'){
        setTimeout(()=>{
          try{ Messages_openConversation(conversation); }catch(_){ }
        },0);
      }
      return;
    }
    if(!app)return;
    if(app.startsWith('installed:')){
      if(typeof Desktop_launch==='function') Desktop_launch(app);
      return;
    }
    if(typeof Desktop_launch==='function') Desktop_launch(app);
  };
  ready(()=>{close();updateBadge()});
})();
