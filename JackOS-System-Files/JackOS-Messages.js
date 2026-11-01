// JackOS-Messages.js — native JackOS Messages application.
//
// Conversations are intentionally modelled as one unified message thread.
// A direct chat has 2 members; a group chat has 3+ members. The message
// renderer does not have a separate group-chat UI: the only difference is
// that incoming group messages show the sender name so participants can tell
// B/C apart.
(function(){
  const KEY='jackosMessages';
  let selected='';

  const db=()=>{
    try{
      const v=JSON.parse(localStorage.getItem(KEY)||'{}');
      return v&&typeof v==='object'?v:{};
    }catch(_){return {}}
  };
  const save=v=>localStorage.setItem(KEY,JSON.stringify(v));
  const me=()=>String(window.currentUser||localStorage.getItem('jackosLastUser')||'');
  const userKey=()=>encodeURIComponent(me()||'system');
  const lastConversationKey=()=>`jackosMessagesLastConversation:${userKey()}`;
  const getLastConversation=()=>String(localStorage.getItem(lastConversationKey())||'');
  const setLastConversation=key=>{ if(key) localStorage.setItem(lastConversationKey(),String(key)); };
  const clearLastConversation=()=>localStorage.removeItem(lastConversationKey());
  const newGroupId=()=>`group-${crypto.randomUUID()}`;

  function ensureShape(d,a,b){
    d.direct=(d.direct&&typeof d.direct==='object'&&!Array.isArray(d.direct))?d.direct:{};
    const aa=String(a||''),bb=String(b||'');
    if(!aa||!bb)return [];
    d.direct[aa]=(d.direct[aa]&&typeof d.direct[aa]==='object'&&!Array.isArray(d.direct[aa]))?d.direct[aa]:{};
    d.direct[aa][bb]=Array.isArray(d.direct[aa][bb])?d.direct[aa][bb]:[];
    return d.direct[aa][bb];
  }

  function directPair(d,a,b){
    const aa=String(a||''),bb=String(b||'');
    if(!aa||!bb)return [[],[]];
    const ab=ensureShape(d,aa,bb);
    const ba=ensureShape(d,bb,aa);
    return [ab,ba];
  }

  // Keep compatibility with the older storage format while making the
  // runtime model uniform.
  function migrate(d){
    d.direct=d.direct&&typeof d.direct==='object'?d.direct:{};
    d.groups=d.groups&&typeof d.groups==='object'?d.groups:{};
    // System messages (such as the device Recovery Key notice from JackOS)
    // are a first-class Messages store. Keep them intact during migration;
    // the old migration loop must never interpret them as legacy DM data.
    d.systemMessages=d.systemMessages&&typeof d.systemMessages==='object'&&!Array.isArray(d.systemMessages)?d.systemMessages:{};

    Object.keys(d).filter(k=>k!=='direct'&&k!=='groups'&&k!=='systemMessages').forEach(a=>{
      if(!d[a]||typeof d[a]!=='object')return;
      Object.keys(d[a]).forEach(b=>{
        if(Array.isArray(d[a][b])){
          ensureShape(d,a,b);
          if(!d.direct[a][b].length)d.direct[a][b]=d[a][b];
        }
      });
      delete d[a];
    });

    // Normalise every group once. A group is one shared conversation with
    // one shared message list. Never create per-user copies of group messages.
    Object.values(d.groups).forEach(g=>{
      if(!g||typeof g!=='object')return;
      g.id=String(g.id||newGroupId());
      // A blank group name is intentional. The visible title is derived per
      // signed-in user below, so an unnamed group never exposes the creator's
      // participant list as a shared/global name.
      const rawName=typeof g.name==='string'?g.name.trim():'';
      g.customName = g.customName===true || (rawName && rawName!=='Group Chat');
      g.name=g.customName?rawName:'';
      g.members=Array.isArray(g.members)?[...new Set(g.members.map(String).filter(Boolean))]:[];
      g.messages=Array.isArray(g.messages)?g.messages:[];
      g.messages=g.messages.map((m,i)=>normalizeMessage(m,i)).filter(Boolean);
    });

    return d;
  }

  function normalizeMessage(m,index=0){
    if(typeof m==='string'){
      return {
        id:`legacy-${index}-${crypto.randomUUID()}`,
        from:'',
        text:m,
        timestamp:new Date(0).toISOString(),
        readBy:[]
      };
    }
    if(!m||typeof m!=='object')return null;
    return {
      id:String(m.id||`message-${index}-${crypto.randomUUID()}`),
      from:String(m.from||m.sender||m.author||''),
      text:String(m.text??m.message??m.body??''),
      timestamp:m.timestamp||new Date(0).toISOString(),
      read:m.read===true,
      to:m.to?String(m.to):'',
      readBy:Array.isArray(m.readBy)?[...new Set(m.readBy.map(String))]:[],
      restrictionRequestId:m.restrictionRequestId?String(m.restrictionRequestId):'',
      restrictionRequestType:m.restrictionRequestType?String(m.restrictionRequestType):''
    };
  }

  function users(){
    return (typeof Users_all==='function'?Users_all():[])
      .filter(u=>u&&u.name&&String(u.name)!==me());
  }

  function directItems(d,a,b){return d.direct?.[a]?.[b]||[]}

  function groupItems(g){
    if(!g||!Array.isArray(g.messages))return [];
    return g.messages.map((m,i)=>normalizeMessage(m,i)).filter(Boolean);
  }

  // Unnamed groups have a viewer-specific title. The current user is omitted
  // because the other participants are what identify the conversation.
  // Examples: "User B & User C", "B, C & D", or "User + 4 Others".
  function groupDisplayName(g,self){
    if(g?.customName && String(g.name||'').trim()) return String(g.name).trim();
    const names=[...new Set((Array.isArray(g?.members)?g.members:[])
      .map(String).filter(Boolean).filter(n=>n!==String(self||'')))];
    if(!names.length)return 'Group Chat';

    const joined=()=>names.length===1?names[0]:names.length===2?`${names[0]} & ${names[1]}`:
      `${names.slice(0,-1).join(', ')} & ${names.at(-1)}`;
    const full=joined();
    // Keep the sidebar/header compact. Preserve the first participant and
    // report the remaining count when the natural name becomes too long.
    const MAX=32;
    if(full.length<=MAX)return full;
    return `${names[0]} + ${names.length-1} ${names.length-1===1?'Other':'Others'}`;
  }

  function systemItems(d,user){
    const items=d.systemMessages?.[String(user)];
    return Array.isArray(items)?items.map((m,i)=>({
      id:String(m?.id||`system-${i}`),
      from:String(m?.from||'JackOS'),
      text:String(m?.text||''),
      timestamp:m?.timestamp||new Date(0).toISOString(),
      read:m?.read===true,
      recoveryKeyNotice:m?.recoveryKeyNotice===true
    })).filter(m=>m.text):[];
  }

  // One thread shape for both direct and group conversations.
  function threadList(){
    const d=migrate(db()),self=me(),out=[];

    const system=systemItems(d,self);
    if(system.length){
      out.push({
        key:'system:JackOS',
        type:'system',
        name:'JackOS',
        members:[self],
        items:system
      });
    }

    users().forEach(u=>{
      const other=String(u.name);
      const items=directItems(d,self,other);
      if(items.length||Users_find(other)){
        out.push({
          key:`direct:${other}`,
          type:'direct',
          name:other,
          members:[self,other],
          items
        });
      }
    });

    Object.values(d.groups).forEach(g=>{
      if(!Array.isArray(g.members)||!g.members.includes(self))return;
      out.push({
        key:`group:${g.id}`,
        type:'group',
        name:groupDisplayName(g,self),
        members:g.members,
        items:groupItems(g)
      });
    });

    out.sort((a,b)=>String(b.items.at(-1)?.timestamp||'').localeCompare(String(a.items.at(-1)?.timestamp||'')));
    return out;
  }

  function getThread(key){return threadList().find(t=>t.key===key)||null}

  function ensureWindow(){
    const w=document.getElementById('messagesWin');
    if(!w)return null;
    if(window.WindowManager&&!WindowManager.get('messagesWin'))WindowManager.attach({id:'messagesWin',title:'Messages',element:w});
    return w;
  }

  function consumePendingConversation(){
    try{
      const pending=sessionStorage.getItem('jackosPendingMessageConversation');
      if(pending){
        sessionStorage.removeItem('jackosPendingMessageConversation');
        return pending;
      }
    }catch(_){}
    return '';
  }

  function open(){
    const w=ensureWindow();
    if(!w)return;

    // A notification can launch Messages before the window has finished
    // opening. Consume the exact conversation handoff here so the normal
    // Messages launch path and notification launch path use the same logic.
    const pending=consumePendingConversation();
    if(pending){
      const pendingKey=conversationKey(pending);
      const pendingThread=pendingKey?getThread(pendingKey):null;
      if(pendingThread) selected=pendingThread.key;
    }

    w.style.display='flex';
    w.classList.remove('window-minimized');
    WindowManager?.show?.('messagesWin');
    // WindowManager.show() uses block for generic windows; Messages is a
    // flex column so the header and composer stay fixed while the message
    // viewport takes the remaining height.
    w.style.display='flex';

    // Messages remembers the last conversation independently for each user.
    // If that conversation still exists, entering Messages immediately
    // counts as opening it: clear its notifications and unread indicator.
    const remembered=getLastConversation();
    if(!selected && remembered){
      const rememberedThread=getThread(remembered);
      if(rememberedThread) selected=rememberedThread.key;
      else clearLastConversation();
    }

    if(selected){
      const active=getThread(selected);
      if(active){
        setLastConversation(active.key);
        markThreadRead(active);
        Notifications_clearForConversation?.(active.key);
      }else{
        selected='';
        clearLastConversation();
      }
    }

    render();
    setTimeout(()=>document.getElementById('messageComposeInput')?.focus(),60);
  }

  // Resolve a conversation reference without ever treating a raw group ID as
  // a direct-chat participant. This was the source of several broken group
  // openings when notifications supplied the raw ID.
  function conversationKey(ref){
    const value=String(ref||'').trim();
    if(!value)return '';
    if(value.startsWith('direct:')||value.startsWith('group:')||value.startsWith('system:'))return value;

    const d=migrate(db());
    if(d.groups?.[value])return `group:${value}`;

    // Some older builds used the group object's id as the reference.
    const group=Object.values(d.groups||{}).find(g=>String(g?.id||'')===value);
    if(group)return `group:${group.id}`;

    return `direct:${value}`;
  }

  function openConversation(ref){
    const key=conversationKey(ref);
    if(!key)return;

    const thread=getThread(key);
    if(!thread)return;

    // Open the app first, then explicitly select the requested thread. This
    // prevents the per-user remembered conversation from winning a race with
    // a notification click. DMs and groups use this exact same path.
    open();
    selected=thread.key;
    setLastConversation(thread.key);
    markThreadRead(thread);

    // Direct and group notifications are cleared through the exact same
    // conversation key. No special group notification path is needed.
    Notifications_clearForConversation?.(thread.key);
    render();
    setTimeout(()=>document.getElementById('messageComposeInput')?.focus(),80);
  }

  function close(){
    // Keep the per-user last conversation so reopening Messages returns here.
    if(selected) setLastConversation(selected);
    selected='';
    const w=document.getElementById('messagesWin');
    if(w){w.style.display='none';w.classList.remove('window-minimized')}
    const modal=document.getElementById('messagesNewConversation');
    if(modal)modal.hidden=true;
    DesktopMinimisedApps?.delete?.('messagesWin');
    Desktop_refreshTaskbar?.();
  }

  function markThreadRead(thread){
    if(!thread)return;
    const d=migrate(db()),self=me();

    if(thread.type==='direct'){
      const other=thread.members.find(x=>x!==self);
      if(!other)return;
      const items=ensureShape(d,self,other);
      items.forEach(m=>{
        if(String(m.to||'')===self)m.read=true;
      });
    }else if(thread.type==='system'){
      const items=Array.isArray(d.systemMessages?.[self])?d.systemMessages[self]:[];
      items.forEach(m=>{if(m)m.read=true});
      if(d.systemMessages)d.systemMessages[self]=items;
    }else{
      const groupId=thread.key.slice('group:'.length);
      const g=d.groups?.[groupId];
      if(!g)return;
      g.messages=(Array.isArray(g.messages)?g.messages:[]).map((m,i)=>{
        const item=normalizeMessage(m,i);
        if(!item)return m;
        if(item.from!==self&&!item.readBy.includes(self))item.readBy.push(self);
        return item;
      });
    }
    save(d);
  }

  function unreadCount(thread){
    const self=me();
    if(thread.type==='direct')return thread.items.filter(m=>m.to===self&&!m.read).length;
    if(thread.type==='system')return thread.items.filter(m=>!m.read).length;
    return thread.items.filter(m=>m.from!==self&&!m.readBy.includes(self)).length;
  }

  function render(){
    const list=document.getElementById('messageThreads');
    if(!list)return;
    list.innerHTML='';

    threadList().forEach(t=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='message-thread'+(selected===t.key?' active':'');
      b.innerHTML='<span class="message-avatar"></span><span class="message-thread-copy"><b></b><small></small></span><span class="message-thread-badge" hidden>0</span>';
      b.querySelector('.message-avatar').textContent=t.type==='group'?'👥':t.type==='system'?'🐵':t.name.slice(0,1).toUpperCase();
      b.querySelector('b').textContent=t.name;
      b.querySelector('small').textContent=t.items.at(-1)?.text||'New conversation';
      const badge=b.querySelector('.message-thread-badge');
      const unread=unreadCount(t);
      badge.hidden=!unread;
      badge.textContent=unread;
      b.onclick=()=>openConversation(t.key);
      list.appendChild(b);
    });

    renderThread();
    updateBadge();
  }

  function renderThread(){
    const head=document.getElementById('messageThreadHeader');
    const list=document.getElementById('messageList');
    if(!head||!list)return;

    const t=getThread(selected);
    if(!t){
      head.innerHTML='<span class="messages-contact-avatar">💬</span><span>Messages</span>';
      list.innerHTML='<div class="message-empty"><b>Your Messages</b><span>Select a conversation to start messaging.</span></div>';
      return;
    }

    // Same header/layout for direct and group conversations.
    head.innerHTML=`<span class="messages-contact-avatar">${t.type==='group'?'👥':t.type==='system'?'🐵':escapeHtml(t.name.slice(0,1).toUpperCase())}</span><span>${escapeHtml(t.name)}</span>`;
    list.innerHTML='';

    // EXACTLY the same bubble rules for every conversation:
    // from === current user => blue/right; otherwise => grey/left.
    t.items.forEach(m=>{
      const mine=String(m.from)===me();
      const row=document.createElement('div');
      row.className=`message-row ${mine?'outgoing':'incoming'}`;

      // The only additional group information is the sender's name on an
      // incoming message. It does not create a different bubble or layout.
      if((t.type==='group'||t.type==='system')&&!mine&&m.from){
        const who=document.createElement('small');
        who.className='message-sender';
        who.textContent=m.from;
        row.appendChild(who);
      }

      const bubble=document.createElement('div');
      bubble.className='message-bubble';
      bubble.textContent=m.text;
      row.appendChild(bubble);

      if(m.restrictionRequestId && !mine && !m.isRestrictionReply){
        const req=(window.JackOSRestrictions_requests?.()||[]).find(r=>r.id===m.restrictionRequestId);
        const canReview=!!req && (window.JackOSRestrictions_canReviewRequest ? window.JackOSRestrictions_canReviewRequest(req.id,me()) : (window.JackOSRestrictions_effective?.(req.targetUser)?.guardian===me() || Users_find(me())?.role==='admin'));
        if(req && req.status==='pending' && canReview){
          const actions=document.createElement('div'); actions.className='message-request-actions';
          const approve=document.createElement('button'); approve.className='explorer-btn'; approve.textContent='Approve'; approve.onclick=()=>{Promise.resolve(window.JackOSRestrictions_approveRequest?.(req.id)).then(ok=>{if(ok)render();else if(Users_find(me())?.role!=='admin')alert('You are not allowed to approve this request.');});};
          const deny=document.createElement('button'); deny.className='explorer-btn danger'; deny.textContent='Deny'; deny.onclick=()=>{if(window.JackOSRestrictions_denyRequest?.(req.id))render();else if(Users_find(me())?.role!=='admin')alert('You are not allowed to deny this request.');};
          const reply=document.createElement('button'); reply.className='explorer-btn ghost'; reply.textContent='Reply'; reply.onclick=()=>{const value=prompt(`Reply to ${req.targetUser}'s request:`,'');if(value&&value.trim()&&window.JackOSRestrictions_replyRequest?.(req.id,value.trim()))render();};
          actions.append(approve,deny,reply); row.appendChild(actions);
        }else if(req){const status=document.createElement('small');status.className='message-request-status';status.textContent=req.status==='approved'?'Approved':req.status==='denied'?'Denied':'Pending';row.appendChild(status)}
      }

      const time=document.createElement('time');
      const stamp=Date.parse(m.timestamp);
      time.textContent=Number.isFinite(stamp)?new Date(stamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'';
      row.appendChild(time);
      list.appendChild(row);
    });

    list.scrollTop=list.scrollHeight;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function send(){
    const self=me();
    const input=document.getElementById('messageComposeInput');
    const text=(input?.value||'').trim();
    const t=getThread(selected);
    if(!self||!t||!text||t.type==='system')return false;

    const d=migrate(db());
    const now=new Date().toISOString();
    const id=crypto.randomUUID();

    if(t.type==='direct'){
      const other=t.members.find(x=>x!==self);
      if(!Users_find(other)){alert('That account no longer exists.');return false;}

      const [mine, theirs]=directPair(d,self,other);
      const message={id,from:self,to:other,text,timestamp:now,read:true};
      mine.push(message);
      theirs.push({...message,read:false});
      save(d);

      Notifications_addForUser?.(other,'New message',`New message from ${self}.`,{
        id:'message-'+id,
        icon:'💬',
        appId:'messages',
        targetConversation:t.key,
        conversationId:t.key,
        target:t.key
      });
    }else{
      const groupId=t.key.slice('group:'.length);
      const g=d.groups?.[groupId];
      if(!g||!Array.isArray(g.members))return false;

      // One message object is shared by the entire group. Every participant
      // sees the exact same message, and the renderer decides blue/grey from
      // the currently logged-in sender.
      const message={id,from:self,text,timestamp:now,readBy:[self]};
      g.messages=Array.isArray(g.messages)?g.messages:[];
      g.messages.push(message);
      save(d);

      g.members.filter(member=>member!==self).forEach(member=>{
        Notifications_addForUser?.(member,'New message',`${self} sent a message in ${g.name}.`,{
          id:'message-'+id+'-'+encodeURIComponent(member),
          icon:'💬',
          appId:'messages',
          targetConversation:t.key,
          conversationId:t.key,
          target:t.key
        });
      });
    }

    input.value='';
    render();
    return true;
  }

  function sendRestrictionRequest(recipient,req){
    const self=me(); const other=String(recipient||''); if(!self||!other||!Users_find(other)||!req)return false;
    const d=migrate(db()); const [mine,theirs]=directPair(d,self,other); const id=crypto.randomUUID();
    const text=`Restriction request: ${req.type==='more-time'?'More Screen Time':req.type==='storage'?'More Storage':req.type==='app-install'?'App Installation Approval':'Restriction Change'}\n${req.details||''}`;
    const message={id,from:self,to:other,text,timestamp:new Date().toISOString(),read:true,restrictionRequestId:req.id,restrictionRequestType:req.type};
    mine.push(message); theirs.push({...message,read:false}); save(d);
    Notifications_addForUser?.(other,'Restriction request',`${self} sent a restriction request.`,{id:'restriction-request-'+req.id,icon:'⏱️',appId:'messages',targetConversation:`direct:${self}`,conversationId:`direct:${self}`,target:`direct:${self}`});
    if(selected===`direct:${other}`)render(); return true;
  }

  function sendRestrictionReply(recipient,req,reply){
    const self=me(); const other=String(recipient||''); if(!self||!other||!Users_find(other)||!req||!String(reply||'').trim())return false;
    const d=migrate(db()); const [mine,theirs]=directPair(d,self,other); const id=crypto.randomUUID();
    const text=`Reply about your ${req.type==='more-time'?'Screen Time':req.type==='storage'?'storage':req.type==='app-install'?'app installation':'restriction change'} request:\n${String(reply).trim()}`;
    const message={id,from:self,to:other,text,timestamp:new Date().toISOString(),read:true,restrictionRequestId:req.id,restrictionRequestType:req.type,isRestrictionReply:true};
    mine.push(message); theirs.push({...message,read:false}); save(d);
    Notifications_addForUser?.(other,'Restriction request reply',`${self} replied to your request.`,{id:'restriction-reply-'+req.id,icon:'💬',appId:'messages',targetConversation:`direct:${self}`,conversationId:`direct:${self}`,target:`direct:${self}`});
    if(selected===`direct:${other}`)render(); return true;
  }

  function syncActiveConversation(conversation){
    if(!selected)return false;
    const key=conversationKey(conversation);
    if(!key || key!==selected)return false;
    const thread=getThread(selected);
    if(!thread)return false;
    markThreadRead(thread);
    Notifications_clearForConversation?.(thread.key);
    render();
    return true;
  }

  function updateBadge(){
    let count=0;
    threadList().forEach(t=>count+=unreadCount(t));
    const b=document.getElementById('messagesBadge');
    if(b){b.hidden=count===0;b.textContent=count>99?'99+':String(count)}
  }

  function newConversation(){
    const modal=document.getElementById('messagesNewConversation');
    const list=document.getElementById('messagesRecipientList');
    if(!modal||!list)return;

    list.innerHTML='';
    users().forEach(u=>{
      const label=document.createElement('label');
      label.className='messages-recipient';
      label.innerHTML='<input type="checkbox" value=""><span class="message-avatar"></span><span></span>';
      label.querySelector('input').value=u.name;
      label.querySelector('.message-avatar').textContent=u.name.slice(0,1).toUpperCase();
      label.querySelector('span:last-child').textContent=u.name;
      list.appendChild(label);
    });

    const name=document.getElementById('messagesGroupName');
    if(name)name.value='';
    modal.hidden=false;
    setTimeout(()=>list.querySelector('input')?.focus(),50);
  }

  function closeNewConversation(){
    const modal=document.getElementById('messagesNewConversation');
    if(modal)modal.hidden=true;
  }

  function createConversation(){
    const checks=[...document.querySelectorAll('#messagesRecipientList input:checked')];
    const chosen=checks.map(x=>String(x.value)).filter(Boolean);
    const self=me();
    if(!chosen.length){alert('Choose at least one person.');return}

    if(chosen.length===1){
      closeNewConversation();
      openConversation(`direct:${chosen[0]}`);
      return;
    }

    const d=migrate(db());
    const id=newGroupId();
    const name=(document.getElementById('messagesGroupName')?.value||'').trim();
    d.groups[id]={
      id,
      name,
      customName:!!name,
      members:[self,...chosen],
      messages:[]
    };
    save(d);
    closeNewConversation();
    openConversation(`group:${id}`);
  }

  ready(()=>{
    ensureWindow();
    document.getElementById('messageComposeInput')?.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}
    });
    window.addEventListener('storage',e=>{
      if(e.key===KEY)render();
    });
  });

  window.Messages_open=open;
  window.Messages_openConversation=openConversation;
  window.Messages_close=close;
  window.Messages_send=send;
  window.Messages_render=render;
  window.Messages_syncActiveConversation=syncActiveConversation;
  window.Messages_newConversation=newConversation;
  window.Messages_closeNewConversation=closeNewConversation;
  window.Messages_createConversation=createConversation;
  window.Messages_sendRestrictionRequest=sendRestrictionRequest;
  window.Messages_sendRestrictionReply=sendRestrictionReply;
})();
