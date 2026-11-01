// JackOS-Restrictions.js — Admin-managed Restrictions, Screen Time, guardians and requests.
(function(){
  'use strict';

  const KEY = 'jackosRestrictionsV2';
  const REQUEST_KEY = 'jackosRestrictionRequests';
  const CATS = ['games','productivity','utilities','media','education','developer','other'];
  const BUILTIN = {
    explorer:{name:'Explorer',category:'utilities'}, browser:{name:'Browser',category:'utilities'},
    photos:{name:'Photos',category:'media'}, calculator:{name:'Calculator',category:'utilities'},
    camera:{name:'Camera',category:'media'}, settings:{name:'Settings',category:'utilities'},
    music:{name:'Music',category:'media'}, games:{name:'Games',category:'games'},
    flappy:{name:'Flappy Bird',category:'games'}, tetris:{name:'Tetris',category:'games'},
    snake:{name:'Snake',category:'games'}, appstore:{name:'App Store',category:'utilities'},
    messages:{name:'Messages',category:'utilities'}
  };
  const LIMITS = [15,30,60,90,120,180,240,300,360,480,600,720];
  const STORAGE = [100,250,500,1024,2048,5120,10240,20480,51200];
  let catalogCache = [];
  let selectedTarget = '';
  let lastTick = Date.now();
  let pendingLockedApp = '';
  let trackedTimeUser = '';
  let lastObservedTimeOverride = false;

  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const localDay = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

  function baseProfile(){
    return { guardian:'', dailyLimitMode:'inherit', dailyLimitMinutes:null, screenTimePasscode:'',
      blockCustomImports:false, alwaysAllowedApps:['settings','messages'], blockedApps:[],
      blockedCategories:[], blockedDevelopers:[], storageLimitMode:'inherit', storageLimitMB:null,
      appPermissions:{} };
  }
  function normaliseProfile(raw){
    const p = raw && typeof raw==='object' ? raw : {};
    const hadDailyMode = Object.prototype.hasOwnProperty.call(p,'dailyLimitMode');
    const hadStorageMode = Object.prototype.hasOwnProperty.call(p,'storageLimitMode');
    const oldDailyLimit = p.dailyLimitMinutes;
    const oldStorageLimit = p.storageLimitMB;
    const b = baseProfile();
    Object.keys(b).forEach(k=>{ if(p[k]===undefined) p[k]=clone(b[k]); });
    ['blockedApps','blockedCategories','blockedDevelopers','alwaysAllowedApps'].forEach(k=>{ if(!Array.isArray(p[k])) p[k]=[]; });
    if(!p.alwaysAllowedApps.includes('settings')) p.alwaysAllowedApps.unshift('settings');
    if(!p.alwaysAllowedApps.includes('messages')) p.alwaysAllowedApps.unshift('messages');
    if(!p.appPermissions || typeof p.appPermissions!=='object' || Array.isArray(p.appPermissions)) p.appPermissions={};
    if(typeof p.screenTimePasscode!=='string') p.screenTimePasscode='';
    if(typeof p.guardian!=='string') p.guardian='';
    if(typeof p.blockCustomImports!=='boolean') p.blockCustomImports=false;
    if(typeof p.dailyLimitMinutes!=='number' || p.dailyLimitMinutes<0) p.dailyLimitMinutes=null;
    if(typeof p.storageLimitMB!=='number' || p.storageLimitMB<0) p.storageLimitMB=null;
    // Migrate older profiles: a saved numeric limit was explicitly set; null inherited the old global default.
    if(!hadDailyMode) p.dailyLimitMode=(typeof oldDailyLimit==='number' && oldDailyLimit>0)?'custom':'inherit';
    if(!hadStorageMode) p.storageLimitMode=(typeof oldStorageLimit==='number' && oldStorageLimit>0)?'custom':'inherit';
    if(!['inherit','none','custom'].includes(p.dailyLimitMode)) p.dailyLimitMode=(p.dailyLimitMinutes!==null && p.dailyLimitMinutes>0)?'custom':'inherit';
    if(!['inherit','none','custom'].includes(p.storageLimitMode)) p.storageLimitMode=(p.storageLimitMB!==null && p.storageLimitMB>0)?'custom':'inherit';
    if(p.dailyLimitMinutes===0){p.dailyLimitMinutes=null;p.dailyLimitMode='none';}
    if(p.storageLimitMB===0){p.storageLimitMB=null;p.storageLimitMode='none';}
    return p;
  }
  function normaliseGlobal(raw){
    const g=raw && typeof raw==='object' ? raw : {};
    if(typeof g.blockCustomImports!=='boolean') g.blockCustomImports=false;
    ['blockedApps','blockedCategories','blockedDevelopers'].forEach(k=>{if(!Array.isArray(g[k]))g[k]=[];});
    if(!Array.isArray(g.alwaysAllowedApps))g.alwaysAllowedApps=['settings','messages'];
    if(!g.alwaysAllowedApps.includes('settings'))g.alwaysAllowedApps.unshift('settings');
    if(!g.alwaysAllowedApps.includes('messages'))g.alwaysAllowedApps.unshift('messages');
    if(typeof g.dailyLimitMinutes!=='number'||g.dailyLimitMinutes<=0)g.dailyLimitMinutes=null;
    if(typeof g.storageLimitMB!=='number'||g.storageLimitMB<=0)g.storageLimitMB=null;
    return g;
  }
  function db(){
    let d={};
    try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))d=v;}catch(_){}
    const before=JSON.stringify(d);
    if(!d.users||typeof d.users!=='object'||Array.isArray(d.users))d.users={};
    d.global=normaliseGlobal(d.global);
    if(!Array.isArray(d.guardians))d.guardians=[];
    const accountList=typeof Users_all==='function'?Users_all():[];
    const names=new Set(accountList.filter(u=>u&&!u.guest).map(u=>u.name));
    // Migrate guardian assignments made by the previous build into the admin-managed guardian directory.
    Object.keys(d.users).forEach(name=>{
      const p=normaliseProfile(d.users[name]);
      d.users[name]=p;
      if(p.guardian && names.has(p.guardian) && !d.guardians.includes(p.guardian))d.guardians.push(p.guardian);
    });
    d.guardians=[...new Set(d.guardians.filter(n=>names.has(n)&&accountList.some(u=>u.name===n&&!u.guest&&u.role!=='admin')))];
    if(JSON.stringify(d)!==before){try{localStorage.setItem(KEY,JSON.stringify(d));}catch(_){}}
    return d;
  }
  function saveDB(d){const value=JSON.stringify(d);if(localStorage.getItem(KEY)!==value)localStorage.setItem(KEY,value);}
  function ensureProfile(d,name){
    if(!d.users[name])d.users[name]=baseProfile();
    d.users[name]=normaliseProfile(d.users[name]);
    return d.users[name];
  }
  function profile(name){const d=db();const p=ensureProfile(d,String(name||''));saveDB(d);return clone(p);}
  function globalPolicy(){const d=db();const g=normaliseGlobal(d.global);d.global=g;saveDB(d);return clone(g);}
  function mutateProfile(name,fn){
    const target=String(name||'');const d=db();const p=ensureProfile(d,target);fn(p,d);saveDB(d);
    if(target&&target===String(currentUser||''))setTimeout(()=>{
      if(target!==String(currentUser||''))return;
      if(limitReached(target)&&!hasTimeOverride(target)){hideWindowsBlockedByScreenTime(target);if(!lockDialogVisible())showLock('');}
      else restoreTimeHiddenWindows(target);
    },0);
    return clone(p);
  }
  function mutateGlobal(fn){const d=db();d.global=normaliseGlobal(d.global);fn(d.global,d);saveDB(d);return clone(d.global);}
  function requests(){try{const r=JSON.parse(localStorage.getItem(REQUEST_KEY)||'[]');return Array.isArray(r)?r:[];}catch(_){return [];}}
  function saveRequests(list){localStorage.setItem(REQUEST_KEY,JSON.stringify(list));}
  function findUser(name){return typeof Users_find==='function'?Users_find(name):null;}
  function allUsers(){return typeof Users_all==='function'?Users_all():[];}
  function isAdmin(name=currentUser){const u=findUser(name);return !!u&&u.role==='admin'&&!u.guest;}
  function isGuardian(name=currentUser){return !findUser(name)?.guest && db().guardians.includes(String(name||''));}
  function isGuardianFor(actor,target){if(!actor||!target||actor===target)return false;const u=findUser(target);if(!u||u.guest)return false;return isGuardian(actor)&&profile(target).guardian===actor;}
  function canManage(target,actor=currentUser){return isAdmin(actor)||isGuardianFor(actor,target);}
  function canReviewRequest(id,actor=currentUser){const r=requests().find(x=>x.id===id);return !!r&&r.status==='pending'&&(isAdmin(actor)||isGuardianFor(actor,r.targetUser));}

  function effective(target){
    target=String(target||currentUser||'');
    const d=db(), user=findUser(target), p=ensureProfile(d,target), g=normaliseGlobal(d.global);
    d.global=g;saveDB(d);
    const admin=!!user&&user.role==='admin'&&!user.guest;
    const daily = admin ? (p.dailyLimitMode==='custom'?p.dailyLimitMinutes:null) :
      p.dailyLimitMode==='none' ? null : p.dailyLimitMode==='custom' ? p.dailyLimitMinutes : g.dailyLimitMinutes;
    const storage = admin ? (p.storageLimitMode==='custom'?p.storageLimitMB:null) :
      p.storageLimitMode==='none' ? null : p.storageLimitMode==='custom' ? p.storageLimitMB : g.storageLimitMB;
    const merge=(a,b)=>[...new Set([...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])])];
    return {
      guardian:p.guardian, isGuardian:isGuardian(target), dailyLimitMode:p.dailyLimitMode,
      dailyLimitMinutes:daily, screenTimePasscode:p.screenTimePasscode,
      alwaysAllowedApps:admin?merge(['settings','messages'],p.alwaysAllowedApps):merge(g.alwaysAllowedApps,p.alwaysAllowedApps),
      blockedApps:admin?[...p.blockedApps]:merge(g.blockedApps,p.blockedApps),
      blockedCategories:admin?[...p.blockedCategories]:merge(g.blockedCategories,p.blockedCategories),
      blockedDevelopers:admin?[...p.blockedDevelopers]:merge(g.blockedDevelopers,p.blockedDevelopers),
      storageLimitMode:p.storageLimitMode, storageLimitMB:storage,
      blockCustomImports:admin?!!p.blockCustomImports:!!(p.blockCustomImports||g.blockCustomImports),
      appPermissions:p.appPermissions||{}
    };
  }

  function dayKey(user=currentUser){return 'jackosScreenTime:'+encodeURIComponent(String(user||''));}
  function usage(user=currentUser){let v={};try{v=JSON.parse(localStorage.getItem(dayKey(user))||'{}')||{};}catch(_){}if(v.date!==localDay())v={date:localDay(),seconds:0};if(typeof v.seconds!=='number'||!Number.isFinite(v.seconds)||v.seconds<0)v.seconds=0;return v;}
  function saveUsage(user,v){localStorage.setItem(dayKey(user),JSON.stringify(v));}
  function minutesUsed(user=currentUser){return Math.floor(usage(user).seconds/60);}
  function limit(user=currentUser){return effective(user).dailyLimitMinutes;}
  function remaining(user=currentUser){const l=limit(user);return l===null?Infinity:Math.max(0,l-minutesUsed(user));}
  function limitReached(user=currentUser){const l=limit(user);return l!==null&&l>0&&minutesUsed(user)>=l;}

  function appMeta(app){
    if(typeof app!=='string')return app||{};
    let id=app;
    if(id.startsWith('installed:'))id=id.slice(10);
    if(BUILTIN[id])return {id,fileName:id,...BUILTIN[id]};
    try{const inst=window.InstalledAppsState?.byFile?.get?.(id);if(inst)return {...inst,id:inst.fileName||id,fileName:inst.fileName||id};}catch(_){}
    return {id,fileName:id,name:id,category:'other'};
  }
  function appKey(app){const a=appMeta(app);return String(a.fileName||a.id||a.name||app||'');}
  function isBlocked(app,user=currentUser){
    const p=effective(user),a=appMeta(app),key=appKey(a),name=String(a.name||''),dev=String(a.author||a.developer||'').trim().toLowerCase();
    return p.blockedApps.includes(key)||p.blockedApps.includes(name)||p.blockedCategories.includes(String(a.category||'other').toLowerCase())||(dev&&p.blockedDevelopers.includes(dev));
  }
  function permissions(app,user=currentUser){const p=effective(user),a=appMeta(app),key=String(a.fileName||a.id||a.name||app);const x=p.appPermissions[key]||{};return {launch:x.launch!==false,update:x.update!==false,delete:x.delete!==false};}
  function appAllowed(app,user=currentUser){
    const a=appMeta(app),id=appKey(a),name=String(a.name||'');
    // Settings and Messages remain available so a user can read restrictions or send requests.
    if(['settings','messages'].includes(id.toLowerCase())||['Settings','Messages'].includes(name))return true;
    if(isBlocked(a,user))return false;
    return permissions(a,user).launch;
  }
  function installAllowed(app,user=currentUser){if(findUser(user)?.guest)return false;return !isBlocked(app,user);}
  function importAllowed(user=currentUser){const p=effective(user);return !p.blockCustomImports&&!findUser(user)?.guest;}
  function hasTimeOverride(user=currentUser){let override=0;try{override=Number(localStorage.getItem('jackosScreenTimeOverride:'+encodeURIComponent(String(user)))||0);}catch(_){}return override>Date.now();}
  function canLaunch(app,user=currentUser){
    const id=appKey(appMeta(app));
    if(!appAllowed(app,user))return {ok:false,reason:'restricted'};
    const p=effective(user);
    if(p.alwaysAllowedApps.some(x=>String(x).toLowerCase()===id.toLowerCase()||String(x).toLowerCase()===String(appMeta(app).name||'').toLowerCase()))return {ok:true};
    if(hasTimeOverride(user))return {ok:true};
    if(p.dailyLimitMinutes!==null&&p.dailyLimitMinutes>0&&minutesUsed(user)>=p.dailyLimitMinutes)return {ok:false,reason:'screen-time'};
    return {ok:true};
  }
  async function storageUsed(user=currentUser){
    try{const root=await UserData_dir(user);let bytes=0;async function walk(dir){for await(const e of dir.values()){if(e.kind==='file')bytes+=(await e.getFile()).size;else await walk(e);}}await walk(root);return bytes;}catch(_){return 0;}
  }
  function storageLimit(user=currentUser){return effective(user).storageLimitMB;}
  async function canAddBytes(user,bytes,oldBytes=0){
    const l=storageLimit(user);if(l===null||l<=0)return true;
    const used=await storageUsed(user),next=used-Math.max(0,Number(oldBytes)||0)+Math.max(0,Number(bytes)||0);
    if(next<=l*1024*1024)return true;
    if(String(user)===String(currentUser||'')&&!isAdmin(user))setTimeout(()=>showStorageRequestDialog(user),0);
    return false;
  }
  function notify(title,message,opts={}){try{window.Notifications_addForUser?.(opts.to||currentUser,title,message,{id:opts.id||'restriction-'+uid(),icon:opts.icon||'⏱️',appId:opts.appId||'settings'});}catch(_){}}
  function sendRequest(type,preferredRecipient,details,meta={}){
    const actor=String(currentUser||'');if(!actor||!findUser(actor))return null;
    const recipients=new Set();if(preferredRecipient&&findUser(preferredRecipient))recipients.add(preferredRecipient);
    const actorProfile=profile(actor);if(actorProfile.guardian&&findUser(actorProfile.guardian))recipients.add(actorProfile.guardian);
    allUsers().filter(u=>u&&u.role==='admin'&&!u.guest).forEach(u=>recipients.add(u.name));
    recipients.delete(actor);
    const req={id:uid(),type,targetUser:actor,createdAt:new Date().toISOString(),status:'pending',details:String(details||''),meta:meta||{},recipients:[...recipients]};
    const arr=requests();arr.push(req);saveRequests(arr);
    if(window.Messages_sendRestrictionRequest)req.recipients.forEach(r=>{try{window.Messages_sendRestrictionRequest(r,req);}catch(_){notify('Restriction request',`${actor} sent a restriction request.`,{to:r,appId:'messages'});}});
    else req.recipients.forEach(r=>notify('Restriction request',`${actor} requested a restriction change.`,{to:r,appId:'messages'}));
    render();return req;
  }
  function requestMoreTime(user=currentUser){
    const lockDialog=document.getElementById('screenTimeLockDialog');
    const lockIsOpen=!!lockDialog&&!lockDialog.hidden;
    const amount=lockIsOpen?(document.getElementById('screenTimeRequestMinutes')?.value||'30'):(document.getElementById('restrictionRequestMoreTimeAmount')?.value||'30');
    const why=(lockIsOpen?(document.getElementById('screenTimeRequestExplanation')?.value||''):(document.getElementById('restrictionMoreTimeExplanation')?.value||'')).trim();
    if(!why){const msg=document.getElementById('screenTimeRequestMessage');if(msg)msg.textContent='Please explain why you need more time.';else alert('Please explain why you need more time.');return false;}
    const req=sendRequest('more-time',profile(user).guardian,`${amount} minutes — ${why}`,{minutes:Number(amount)});
    if(req){closeLock();alert('Request sent to your guardian and administrator(s) in Messages.');return true;}return false;
  }
  function requestStorage(user=currentUser){
    const amount=document.getElementById('restrictionRequestStorageAmount')?.value||'1024';
    const why=(document.getElementById('restrictionRequestStorageExplanation')?.value||'').trim();
    if(!why){alert('Please explain why you need more storage.');return false;}
    const req=sendRequest('storage',profile(user).guardian,`${amount} MB — ${why}`,{amountMB:Number(amount)});
    if(req){alert('Storage request sent in Messages.');return true;}return false;
  }
  function requestChange(user=currentUser){
    const kind=document.getElementById('restrictionChangeKind')?.value||'other';
    const why=(document.getElementById('restrictionChangeExplanation')?.value||'').trim();
    if(!why){alert('Please explain what you would like changed.');return false;}
    const req=sendRequest('restriction-change',profile(user).guardian,`${kind}: ${why}`,{kind});
    if(req){const el=document.getElementById('restrictionChangeExplanation');if(el)el.value='';alert('Request sent to your guardian and administrator(s) in Messages.');return true;}return false;
  }
  function guardEdit(actor,target,fn){
    if(isAdmin(actor))return Admin_requireStrict(()=>{fn();});
    if(isGuardianFor(actor,target))return fn();
    alert('Only an administrator or the guardian assigned to this account can change these settings.');return false;
  }
  function setProfileValue(target,key,value){mutateProfile(target,p=>{p[key]=value;});render(target);}
  function appOptions(){
    const arr=Object.entries(BUILTIN).map(([id,v])=>({id,fileName:id,...v}));
    try{(window.InstalledAppsState?.apps||[]).forEach(a=>arr.push({id:a.fileName,fileName:a.fileName,name:a.name,category:a.category||'other',author:a.author||a.developer||''}));}catch(_){}
    (catalogCache||[]).forEach(a=>{if(!arr.some(x=>x.fileName===a.fileName))arr.push({id:a.fileName,fileName:a.fileName,name:a.name,category:a.category||'other',author:a.author||a.developer||''});});
    return arr;
  }
  async function installedAppsForUser(user){
    const found=[];
    try{
      if(typeof Applications_dir!=='function'||typeof AppPackage_read!=='function')return found;
      const dir=await Applications_dir(user);
      for await(const entry of dir.values()){
        if(entry.kind!=='file'||!String(entry.name||'').toLowerCase().endsWith('.zip'))continue;
        try{
          const file=await entry.getFile();
          const pkg=await AppPackage_read(file);
          if(!pkg)continue;
          const m=pkg.manifest||{};
          found.push({id:entry.name,fileName:entry.name,name:String(m.name||entry.name),category:String(m.category||'other').toLowerCase(),author:String(m.author||m.developer||''),developer:String(m.developer||m.author||''),version:m.version||'',description:m.description||'',fileSize:file.size,pkg});
        }catch(_){}
      }
    }catch(e){console.warn('Could not read installed apps for restriction settings:',e);}
    found.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    return found;
  }
  function mk(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
  function button(label,fn,cls='explorer-btn'){const b=mk('button',cls,label);b.type='button';b.onclick=fn;return b;}
  function selectField(label,options,value,onchange,disabled=false){
    const wrap=mk('label','restriction-field');wrap.appendChild(mk('span','',label));const s=document.createElement('select');
    options.forEach(o=>{const op=document.createElement('option');op.value=String(o.value);op.textContent=o.label;s.appendChild(op);});s.value=String(value??'');s.disabled=!!disabled;s.onchange=()=>onchange(s.value);wrap.appendChild(s);return wrap;
  }
  function section(title,desc){const s=mk('section','restriction-section');s.appendChild(mk('h4','',title));if(desc)s.appendChild(mk('p','settings-subtext',desc));return s;}
  function chipList(host,label,values,remove){const wrap=mk('div','restriction-chip-list');if(!values.length)wrap.appendChild(mk('div','restriction-readonly',`No ${label.toLowerCase()} added.`));values.forEach(value=>wrap.appendChild(button(`${label}: ${value}  ×`,()=>remove(value),'explorer-btn ghost')));host.appendChild(wrap);}
  function listAccountsForPanel(actor){
    const users=allUsers();
    if(isAdmin(actor))return users;
    if(isGuardian(actor))return users.filter(u=>u.name===actor||profile(u.name).guardian===actor);
    return users.filter(u=>u.name===actor);
  }
  function render(){
    try{window.JackOSRestrictions_refreshVisibility?.();}catch(_){}
    const panel=document.getElementById('settingsRestrictionsPanel');if(!panel)return;
    const oldTarget=panel.querySelector('#restrictionTargetUser')?.value;
    const actor=String(currentUser||'');const users=listAccountsForPanel(actor);
    let target=oldTarget||selectedTarget;if(!users.some(u=>u.name===target))target=actor;if(!users.some(u=>u.name===target))target=users[0]?.name||actor;selectedTarget=target;
    panel.innerHTML='';
    const head=mk('div','restriction-head');const title=mk('div');title.appendChild(mk('span','eyebrow','SCREEN TIME & RESTRICTIONS'));title.appendChild(mk('h3','', 'Restrictions & Screen Time'));
    title.appendChild(mk('p','settings-subtext',isAdmin(actor)?'Set Screen Time, app access, storage limits and delegated guardian access. Admin actions ask you to authenticate before saving.':isGuardian(actor)?'View your own settings or manage restrictions for accounts assigned to you.':'View your restrictions, check today’s Screen Time and send requests for changes.'));
    head.appendChild(title);panel.appendChild(head);
    const toolbar=mk('div','restriction-toolbar');
    if(users.length>1){const targetSelect=selectField('Account',users.map(u=>({value:u.name,label:u.name+(u.guest?' · Guest':u.role==='admin'?' · Admin':db().guardians.includes(u.name)?' · Guardian':'')})),target,v=>{selectedTarget=v;render();});targetSelect.querySelector('select').id='restrictionTargetUser';toolbar.appendChild(targetSelect);}
    else {const chosen=mk('div','restriction-summary');chosen.appendChild(mk('b','',target||'Current account'));chosen.appendChild(mk('span','',isAdmin(actor)?'Administrator account':'Your account'));toolbar.appendChild(chosen);}
    const ep=effective(actor),used=minutesUsed(actor);const summary=mk('div','restriction-summary');summary.appendChild(mk('b','','Today'));summary.appendChild(mk('span','',ep.dailyLimitMinutes===null?'No daily limit':`${Math.min(used,ep.dailyLimitMinutes)} of ${ep.dailyLimitMinutes} minutes used`));toolbar.appendChild(summary);panel.appendChild(toolbar);
    const content=mk('div','restriction-content');panel.appendChild(content);
    if(isAdmin(actor)){renderGuardians(content);renderGlobal(content);}
    const targetHost=mk('div','restriction-target-host');content.appendChild(targetHost);
    renderTarget(target,targetHost);
    if(isAdmin(actor)||isGuardian(actor))renderRequestInbox(content,actor);
    const foot=mk('div','set-actions');foot.style.marginTop='12px';foot.appendChild(button('Back',Settings_backToMain,'explorer-btn ghost'));panel.appendChild(foot);
  }
  function renderGuardians(host){
    const d=db();const sec=section('Guardians','Administrators stay in control. Add regular accounts as guardians, then assign them to individual users below. Guardians can manage only accounts assigned to them; administrators can always override them.');
    const available=allUsers().filter(u=>u&&!u.guest&&u.role!=='admin'&&!d.guardians.includes(u.name));
    const picker=selectField('Account to add as guardian',[{value:'',label:available.length?'Choose an account…':'No eligible accounts'} ,...available.map(u=>({value:u.name,label:u.name}))],'',()=>{});
    picker.querySelector('select').id='restrictionAddGuardianSelect';sec.appendChild(picker);
    const add=button('Add Guardian',()=>{const name=document.getElementById('restrictionAddGuardianSelect')?.value;if(!name){alert('Choose an account first.');return;}if(!allUsers().some(u=>u.name===name&&!u.guest&&u.role!=='admin')){alert('That account cannot be a guardian.');return;}Admin_requireStrict(()=>{const d2=db();if(!d2.guardians.includes(name))d2.guardians.push(name);saveDB(d2);render();});});add.disabled=!available.length;sec.appendChild(add);
    const entries=mk('div','restriction-guardian-list');
    if(!d.guardians.length)entries.appendChild(mk('div','restriction-readonly','No guardians have been added yet.'));
    d.guardians.forEach(name=>{const assigned=allUsers().filter(u=>profile(u.name).guardian===name).length;const row=mk('div','restriction-guardian-row');const info=mk('div');info.appendChild(mk('b','',name));info.appendChild(mk('small','',`${assigned} assigned account${assigned===1?'':'s'}`));row.appendChild(info);row.appendChild(button('Remove Guardian',()=>Admin_requireStrict(()=>{const d2=db();d2.guardians=d2.guardians.filter(n=>n!==name);Object.keys(d2.users||{}).forEach(u=>{if(d2.users[u]?.guardian===name)d2.users[u].guardian='';});saveDB(d2);render();}),'explorer-btn danger'));entries.appendChild(row);});
    sec.appendChild(entries);host.appendChild(sec);
  }
  function globalLimitOptions(current){return [{value:'',label:'No limit'},...LIMITS.map(v=>({value:String(v),label:limitLabel(v)}))];}
  function limitLabel(v){return v<60?`${v} minutes`:v%60?`${Math.floor(v/60)} hr ${v%60} min`:`${v/60} hr${v===60?'':'s'}`;}
  function renderGlobal(host){
    const g=globalPolicy();const sec=section('Defaults for All Non-Admins','These defaults apply to every non-admin account unless a per-user setting overrides the daily limit or storage limit. Global app blocks always apply to non-admin accounts.');
    const daily=selectField('Default Daily Screen Time Limit',[{value:'',label:'No limit'},...LIMITS.map(v=>({value:String(v),label:limitLabel(v)}))],g.dailyLimitMinutes??'',v=>Admin_requireStrict(()=>{mutateGlobal(x=>{x.dailyLimitMinutes=v===''?null:Number(v)||null;});render();}));sec.appendChild(daily);
    const storage=selectField('Default Storage Limit',[{value:'',label:'Unlimited'},...STORAGE.map(v=>({value:String(v),label:storageLabel(v)}))],g.storageLimitMB??'',v=>Admin_requireStrict(()=>{mutateGlobal(x=>{x.storageLimitMB=v===''?null:Number(v)||null;});render();}));sec.appendChild(storage);
    const importWrap=mk('label','restriction-chip-list');const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!g.blockCustomImports;cb.onchange=()=>{const value=cb.checked;Admin_requireStrict(()=>{mutateGlobal(x=>{x.blockCustomImports=value;});render();});};importWrap.append(cb,document.createTextNode('Block custom imported apps for non-admins'));sec.appendChild(importWrap);
    sec.appendChild(selectField('Block App', [{value:'',label:'Choose an app…'},...appOptions().filter(a=>!['settings','messages'].includes(String(a.fileName).toLowerCase())).map(a=>({value:a.fileName,label:a.name}))],'',v=>{if(!v)return;Admin_requireStrict(()=>{mutateGlobal(x=>{if(!x.blockedApps.includes(v))x.blockedApps.push(v);});render();});}));
    sec.appendChild(selectField('Block Category',[{value:'',label:'Choose category…'},...CATS.map(c=>({value:c,label:labelCase(c)}))],'',v=>{if(!v)return;Admin_requireStrict(()=>{mutateGlobal(x=>{if(!x.blockedCategories.includes(v))x.blockedCategories.push(v);});render();});}));
    const devs=[...new Set(appOptions().map(a=>a.author).filter(Boolean))];sec.appendChild(selectField('Block Developer',[{value:'',label:'Choose developer…'},...devs.map(v=>({value:String(v).toLowerCase(),label:v}))],'',v=>{if(!v)return;Admin_requireStrict(()=>{mutateGlobal(x=>{if(!x.blockedDevelopers.includes(v))x.blockedDevelopers.push(v);});render();});}));
    const active=mk('div','restriction-active-rules');
    [['Apps',g.blockedApps,'blockedApps'],['Categories',g.blockedCategories,'blockedCategories'],['Developers',g.blockedDevelopers,'blockedDevelopers']].forEach(([title,values,key])=>values.forEach(v=>active.appendChild(button(`${title}: ${v}  ×`,()=>Admin_requireStrict(()=>{mutateGlobal(x=>{x[key]=x[key].filter(n=>n!==v);});render();}),'explorer-btn ghost'))));
    if(!active.childNodes.length)active.appendChild(mk('div','restriction-readonly','No global app, category or developer blocks.'));sec.appendChild(active);host.appendChild(sec);
  }
  function storageLabel(v){return v<1024?`${v} MB`:`${v/1024} GB`;}
  function labelCase(v){return String(v).charAt(0).toUpperCase()+String(v).slice(1);}
  async function renderTarget(target,host){
    const box=host||document.getElementById('restrictionTargetContent');
    if(!box)return;
    const user=findUser(target);
    if(!user)return;
    box.innerHTML='';
    box.appendChild(mk('div','restriction-readonly','Loading this account’s restrictions and installed apps…'));
    const targetApps=await installedAppsForUser(target);
    // A user switch or Settings re-render may detach this host while OPFS is being read.
    if(!box.isConnected)return;
    box.innerHTML='';

    const p=profile(target),eff=effective(target),actor=String(currentUser||''),admin=isAdmin(actor),guardian=isGuardianFor(actor,target),editable=admin||guardian;
    const optMap=new Map(appOptions().map(a=>[a.fileName,a]));
    targetApps.forEach(a=>optMap.set(a.fileName,{...(optMap.get(a.fileName)||{}),...a}));
    const opts=[...optMap.values()].filter(a=>a.fileName);

    const sec=section(`Screen Time for ${target}`,'The daily limit applies to this account only. When it is reached, apps are locked except Settings, Messages and apps explicitly allowed below.');
    const mode=p.dailyLimitMode||'inherit';
    const selectedLimit=mode==='inherit'?'inherit':mode==='none'?'none':String(p.dailyLimitMinutes??'none');
    const limitOptions=[{value:'inherit',label:'Use global default'},{value:'none',label:'No Limit'},...LIMITS.map(v=>({value:String(v),label:limitLabel(v)}))];
    sec.appendChild(selectField('Daily Limit',limitOptions,selectedLimit,v=>guardEdit(actor,target,()=>{
      mutateProfile(target,q=>{q.dailyLimitMode=v==='inherit'?'inherit':v==='none'?'none':'custom';q.dailyLimitMinutes=['inherit','none'].includes(v)?null:Number(v);});
      render(target);
    }),!editable));
    if(editable){
      const pass=mk('label','restriction-field');pass.appendChild(mk('span','','Screen Time Passcode'));
      const input=document.createElement('input');input.type='password';input.inputMode='numeric';input.maxLength=8;input.placeholder='4–8 digit passcode';input.value=p.screenTimePasscode||'';input.autocomplete='new-password';
      input.onchange=()=>{const value=input.value.trim();if(value&&(!/^\d{4,8}$/.test(value))){alert('Use a 4–8 digit numeric passcode, or leave it empty to remove it.');input.value=p.screenTimePasscode||'';return;}guardEdit(actor,target,()=>setProfileValue(target,'screenTimePasscode',value));};
      pass.appendChild(input);sec.appendChild(pass);
    }else sec.appendChild(mk('div','restriction-readonly',p.screenTimePasscode?'A Screen Time passcode is set. Only the administrator or assigned guardian can change it.':'No Screen Time passcode is set.'));
    const usageCard=mk('div','restriction-screen-summary');
    usageCard.appendChild(mk('b','','Today'));
    usageCard.appendChild(mk('span','',eff.dailyLimitMinutes===null?`${minutesUsed(target)} minutes used · No Limit`:`${Math.min(minutesUsed(target),eff.dailyLimitMinutes)} of ${eff.dailyLimitMinutes} minutes used`));
    sec.appendChild(usageCard);box.appendChild(sec);

    const allowedSec=section('Always Allowed','These apps remain available when Screen Time runs out. Settings and Messages are always allowed so the user can ask for help.');
    const allowed=mk('div','restriction-chip-list');
    opts.forEach(a=>{
      const lab=mk('label');const cb=document.createElement('input');cb.type='checkbox';
      cb.checked=eff.alwaysAllowedApps.includes(a.fileName)||eff.alwaysAllowedApps.includes(a.name);
      cb.disabled=!editable||['settings','messages'].includes(String(a.fileName).toLowerCase());
      cb.onchange=()=>guardEdit(actor,target,()=>{
        mutateProfile(target,q=>{const old=Array.isArray(q.alwaysAllowedApps)?q.alwaysAllowedApps:[];q.alwaysAllowedApps=[...new Set(old.filter(k=>k!==a.fileName&&k!==a.name).concat(cb.checked?[a.fileName]:[]))];});
        render(target);
      });
      lab.append(cb,document.createTextNode(a.name||a.fileName));allowed.appendChild(lab);
    });
    allowedSec.appendChild(allowed);box.appendChild(allowedSec);

    const appSec=section('App Restrictions','Blocked apps cannot launch and are hidden from the Desktop, Start Menu and Search.');
    const blocked=mk('div','restriction-chip-list');
    const g=normaliseGlobal(db().global);const targetIsAdmin=isAdmin(target);
    opts.forEach(a=>{
      const key=String(a.fileName),name=String(a.name||key),dev=String(a.author||a.developer||'').toLowerCase(),category=String(a.category||'other').toLowerCase();
      const globallyBlocked=!targetIsAdmin&&(g.blockedApps.includes(key)||g.blockedApps.includes(name)||g.blockedCategories.includes(category)||(dev&&g.blockedDevelopers.includes(dev)));
      const lab=mk('label');const cb=document.createElement('input');cb.type='checkbox';
      cb.checked=eff.blockedApps.includes(key)||eff.blockedApps.includes(name);
      const alwaysAvailable=['settings','messages'].includes(key.toLowerCase());
      cb.disabled=!editable||globallyBlocked||alwaysAvailable;
      if(globallyBlocked)lab.title='This app is blocked by the global policy for non-admin accounts.';
      else if(alwaysAvailable)lab.title='Settings and Messages stay available so users can manage settings and request help.';
      cb.onchange=()=>guardEdit(actor,target,()=>{
        mutateProfile(target,q=>{q.blockedApps=[...new Set((q.blockedApps||[]).filter(k=>k!==key&&k!==name).concat(cb.checked?[key]:[]))];});
        render(target);
      });
      lab.append(cb,document.createTextNode(name+(globallyBlocked?' · Global block':alwaysAvailable?' · Always allowed':'')));blocked.appendChild(lab);
    });
    appSec.appendChild(blocked);box.appendChild(appSec);

    const store=section('App Store & Installed App Permissions','Restrict imported apps, categories and developers. Launch, update and delete permissions are independent for each app installed for this account.');
    const importWrap=mk('label','restriction-chip-list');const importCb=document.createElement('input');importCb.type='checkbox';importCb.checked=!!p.blockCustomImports;importCb.disabled=!editable;
    importCb.onchange=()=>guardEdit(actor,target,()=>setProfileValue(target,'blockCustomImports',importCb.checked));
    importWrap.append(importCb,document.createTextNode('Block custom imported apps for this account'));store.appendChild(importWrap);
    store.appendChild(selectField('Blocked Category',[{value:'',label:'Choose category…'},...CATS.map(c=>({value:c,label:labelCase(c)}))],'',v=>{
      if(!v)return;guardEdit(actor,target,()=>{mutateProfile(target,q=>{if(!q.blockedCategories.includes(v))q.blockedCategories.push(v);});render(target);});
    },!editable));
    const devs=[...new Set(opts.map(a=>a.author||a.developer).filter(Boolean))];
    store.appendChild(selectField('Blocked Developer',[{value:'',label:'Choose developer…'},...devs.map(v=>({value:String(v).toLowerCase(),label:String(v)}))],'',v=>{
      if(!v)return;guardEdit(actor,target,()=>{mutateProfile(target,q=>{if(!q.blockedDevelopers.includes(v))q.blockedDevelopers.push(v);});render(target);});
    },!editable));
    const rules=mk('div','restriction-active-rules');
    [['Apps',p.blockedApps,'blockedApps'],['Categories',p.blockedCategories,'blockedCategories'],['Developers',p.blockedDevelopers,'blockedDevelopers']].forEach(([label,values,key])=>values.forEach(v=>rules.appendChild(button(`${label}: ${v}  ×`,()=>guardEdit(actor,target,()=>{
      mutateProfile(target,q=>{q[key]=q[key].filter(n=>n!==v);});render(target);
    }),'explorer-btn ghost'))));
    if(!rules.childNodes.length)rules.appendChild(mk('div','restriction-readonly','No per-user app, category or developer blocks.'));
    store.appendChild(rules);

    const perms=mk('div','restriction-permissions');
    if(!targetApps.length)perms.appendChild(mk('div','restriction-readonly','No installed App Store applications are assigned to this account.'));
    targetApps.forEach(a=>{
      const key=a.fileName,current=eff.appPermissions[key]||{};const row=mk('div','restriction-permission-row');
      row.appendChild(mk('b','',a.name||key));
      [['launch','Launch'],['update','Update'],['delete','Delete']].forEach(([k,label])=>{
        const lab=mk('label');const cb=document.createElement('input');cb.type='checkbox';cb.checked=current[k]!==false;cb.disabled=!editable;
        cb.onchange=()=>guardEdit(actor,target,()=>{mutateProfile(target,q=>{q.appPermissions[key]=q.appPermissions[key]||{};q.appPermissions[key][k]=cb.checked;});});
        lab.append(cb,document.createTextNode(label));row.appendChild(lab);
      });
      perms.appendChild(row);
    });
    store.appendChild(perms);box.appendChild(store);

    const storage=section('Storage','Set a per-user storage limit. When there is not enough room to save or import data, the user can send a request for more storage.');
    const storageMode=p.storageLimitMode||'inherit';
    const storageValue=storageMode==='inherit'?'inherit':storageMode==='none'?'none':String(p.storageLimitMB??'none');
    storage.appendChild(selectField('Storage Limit',[{value:'inherit',label:'Use global default'},{value:'none',label:'Unlimited'},...STORAGE.map(v=>({value:String(v),label:storageLabel(v)}))],storageValue,v=>guardEdit(actor,target,()=>{
      mutateProfile(target,q=>{q.storageLimitMode=v==='inherit'?'inherit':v==='none'?'none':'custom';q.storageLimitMB=['inherit','none'].includes(v)?null:Number(v);});render(target);
    }),!editable));
    const used=mk('div','restriction-readonly','Checking storage use…');storage.appendChild(used);
    storageUsed(target).then(bytes=>{if(!used.isConnected)return;used.textContent=`Used: ${(bytes/1024/1024).toFixed(1)} MB${eff.storageLimitMB?` of ${eff.storageLimitMB} MB`:''}`;});
    box.appendChild(storage);

    const guardianSec=section('Assigned Guardian',admin?'Choose which approved guardian may manage this account. The administrator always retains access.':'Your assigned guardian can manage these settings. Only an administrator can change the assignment.');
    if(admin){
      const guardianOptions=[{value:'',label:'No guardian'},...db().guardians.map(name=>({value:name,label:name}))];
      guardianSec.appendChild(selectField('Guardian',guardianOptions,p.guardian,v=>Admin_requireStrict(()=>{setProfileValue(target,'guardian',v);}),false));
    }else guardianSec.appendChild(mk('div','restriction-readonly',p.guardian||'No guardian assigned. Contact an administrator if you need one.'));
    box.appendChild(guardianSec);

    if(target===actor){renderRequestComposer(box,target);renderOwnRequests(box,target);}
    if(admin){
      const install=section(`App Store for ${target}`,'Browse the catalog and install an application directly into this account. Installed apps remain separate for each user.');
      const tools=mk('div','restriction-store-tools');const search=document.createElement('input');search.type='search';search.className='restriction-store-search';search.placeholder='Search apps…';search.setAttribute('aria-label','Search App Store apps');
      const category=document.createElement('select');category.className='restriction-store-category';category.appendChild(new Option('All categories','all'));CATS.forEach(c=>category.appendChild(new Option(labelCase(c),c)));
      tools.append(search,category);install.appendChild(tools);
      const catalogue=mk('div','restriction-store-catalogue');catalogue.appendChild(mk('div','restriction-readonly','Loading App Store…'));install.appendChild(catalogue);
      const drawCatalogue=list=>{
        const term=search.value.trim().toLowerCase(),cat=category.value;catalogue.innerHTML='';
        const filtered=(list||[]).filter(a=>(!term||`${a.name||''} ${a.author||a.developer||''} ${a.description||''}`.toLowerCase().includes(term))&&(cat==='all'||String(a.category||'other').toLowerCase()===cat));
        if(!filtered.length){catalogue.appendChild(mk('div','restriction-readonly','No matching apps in the catalog.'));return;}
        filtered.forEach(a=>{
          const card=mk('div','restriction-store-card');const detail=mk('div','restriction-store-description');detail.appendChild(mk('b','',a.name||a.fileName));
          const meta=[a.category||'Other',a.author||a.developer||'Unknown developer',a.version?`Version ${a.version}`:''].filter(Boolean).join(' · ');detail.appendChild(mk('small','',meta));if(a.description)detail.appendChild(mk('p','',a.description));
          const installKey=typeof UserData_key==='function'?`jackosAppInstall:${UserData_key(target)}:${a.fileName}`:'';
          const previouslyInstalled=targetApps.some(inst=>inst.fileName===a.fileName)||(installKey&&!!localStorage.getItem(installKey));
          const installBtn=button(previouslyInstalled?'Update / Reinstall':'Install',()=>Admin_requireStrict(async()=>{
            try{
              await AppStore_installPackageForUser(target,a.fileName,a.pkg,true);
              notify('App installed',`${a.name||a.fileName} was installed for ${target}.`,{to:target,icon:'＋',appId:'installed:'+a.fileName});
              alert(`Installed ${a.name||a.fileName} for ${target}.`);
              selectedTarget=target;
              render();
            }catch(e){alert('Installation failed: '+(e?.message||e));}
          }));
          card.append(detail,installBtn);catalogue.appendChild(card);
        });
      };
      search.addEventListener('input',()=>drawCatalogue(catalogCache));category.addEventListener('change',()=>drawCatalogue(catalogCache));
      if(typeof AppStore_serverPackages==='function')AppStore_serverPackages().then(list=>{catalogCache=list||[];drawCatalogue(catalogCache);}).catch(()=>{catalogue.innerHTML='';catalogue.appendChild(mk('div','restriction-readonly','The App Store catalog is unavailable while offline.'));});
      else {catalogue.innerHTML='';catalogue.appendChild(mk('div','restriction-readonly','The App Store catalog is unavailable while offline.'));}
      box.appendChild(install);
    }
  }
  function renderRequestComposer(host,target){
    const s=section('Request a Change','Requests are sent to your assigned guardian and all administrator accounts through Messages. Include a clear explanation so they can review it.');
    const kind=selectField('What would you like changed?',[{value:'daily-limit',label:'Daily Screen Time limit'},{value:'always-allowed-apps',label:'Always Allowed apps'},{value:'blocked-app',label:'Blocked or allowed app'},{value:'app-store',label:'App Store restriction or installation'},{value:'storage',label:'Storage limit'},{value:'other',label:'Other restriction'}],'daily-limit',()=>{});kind.querySelector('select').id='restrictionChangeKind';s.appendChild(kind);
    const why=document.createElement('textarea');why.id='restrictionChangeExplanation';why.className='restriction-request-text';why.placeholder='Explain what you would like changed…';s.appendChild(why);
    s.appendChild(button('Send Restriction Request',()=>requestChange(target)));
    const storageRow=mk('div','restriction-storage-request');storageRow.appendChild(mk('h4','','Request More Storage'));
    const amt=selectField('Additional storage requested',[{value:'500',label:'500 MB'},{value:'1024',label:'1 GB'},{value:'5120',label:'5 GB'}],'1024',()=>{});amt.querySelector('select').id='restrictionRequestStorageAmount';storageRow.appendChild(amt);
    const storageWhy=document.createElement('textarea');storageWhy.id='restrictionRequestStorageExplanation';storageWhy.className='restriction-request-text';storageWhy.placeholder='Why do you need more storage?';storageRow.appendChild(storageWhy);
    storageRow.appendChild(button('Send Storage Request',()=>requestStorage(target)));s.appendChild(storageRow);
    if(limitReached(target)){
      const timeRow=mk('div','restriction-storage-request');timeRow.appendChild(mk('h4','','Request More Screen Time'));
      const tm=selectField('Extra time requested',[{value:'15',label:'15 minutes'},{value:'30',label:'30 minutes'},{value:'60',label:'1 hour'},{value:'120',label:'2 hours'}],'30',()=>{});tm.querySelector('select').id='restrictionRequestMoreTimeAmount';timeRow.appendChild(tm);
      const timeWhy=document.createElement('textarea');timeWhy.id='restrictionMoreTimeExplanation';timeWhy.className='restriction-request-text';timeWhy.placeholder='Why do you need more time?';timeRow.appendChild(timeWhy);
      timeRow.appendChild(button('Send Screen Time Request',()=>requestMoreTime(target)));s.appendChild(timeRow);
    }
    host.appendChild(s);
  }
  function renderOwnRequests(host,target){
    const own=requests().filter(r=>r.targetUser===target).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,8);const s=section('Your Requests','Track restriction, Screen Time, app installation and storage requests sent through Messages.');
    if(!own.length)s.appendChild(mk('div','restriction-readonly','You have not sent any requests.'));
    own.forEach(r=>{const row=mk('div','restriction-request-card');row.appendChild(mk('b','',`${requestTypeLabel(r.type)} · ${r.status.toUpperCase()}`));row.appendChild(mk('small','',new Date(r.createdAt).toLocaleString()));row.appendChild(mk('p','',r.details));s.appendChild(row);});host.appendChild(s);
  }
  function renderRequestInbox(host,actor){
    const list=requests().filter(r=>r.status==='pending'&&(isAdmin(actor)||r.recipients?.includes(actor)||isGuardianFor(actor,r.targetUser))).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
    const s=section('Requests Inbox','Requests from users are also delivered as direct conversations in Messages. You can review them here.');
    if(!list.length)s.appendChild(mk('div','restriction-readonly','No pending requests.'));
    list.forEach(r=>{const row=mk('div','restriction-request-card');row.appendChild(mk('b','',`${requestTypeLabel(r.type)} · ${r.targetUser}`));row.appendChild(mk('small','',new Date(r.createdAt).toLocaleString()));row.appendChild(mk('p','',r.details));const actions=mk('div','restriction-request-actions');actions.appendChild(button('Approve',()=>{approveRequest(r.id).then(ok=>{if(ok)render();else if(!isAdmin(actor))alert('You are not allowed to approve this request.');});}));actions.appendChild(button('Deny',()=>{if(denyRequest(r.id))render();else if(!isAdmin(actor))alert('You are not allowed to deny this request.');},'explorer-btn danger'));actions.appendChild(button('Reply',()=>replyPrompt(r.id),'explorer-btn ghost'));row.appendChild(actions);s.appendChild(row);});host.appendChild(s);
  }
  function requestTypeLabel(type){return ({'more-time':'More Screen Time','storage':'More Storage','app-install':'App Installation Approval','restriction-change':'Restriction Change'})[type]||'Request';}
  function replyPrompt(id){const r=requests().find(x=>x.id===id);if(!r||!canReviewRequest(id,currentUser)){alert('You are not allowed to reply to this request.');return;}const reply=prompt(`Reply to ${r.targetUser}'s request:`,'');if(reply&&reply.trim())replyRequest(id,reply.trim());}
  async function approveRequest(id,adminVerified=false){
    const arr=requests(),r=arr.find(x=>x.id===id);if(!r||!canReviewRequest(id,currentUser))return false;
    if(isAdmin(currentUser)&&!adminVerified){Admin_requireStrict(()=>approveRequest(id,true));return false;}
    try{
      if(r.type==='more-time'){
        const requested=Math.max(5,Math.min(720,Number(r.meta?.minutes)||parseInt(String(r.details).match(/\d+/)?.[0]||'30',10)));
        localStorage.setItem('jackosScreenTimeOverride:'+encodeURIComponent(String(r.targetUser)),String(Date.now()+requested*60*1000));
      }else if(r.type==='storage'){
        const add=Math.max(100,Number(r.meta?.amountMB)||parseInt(String(r.details).match(/\d+/)?.[0]||'1024',10));
        const usedMB=Math.ceil((await storageUsed(r.targetUser))/1024/1024);
        mutateProfile(r.targetUser,p=>{const current=effective(r.targetUser).storageLimitMB||usedMB;p.storageLimitMode='custom';p.storageLimitMB=Math.max(usedMB,current)+add;});
      }else if(r.type==='app-install'&&r.meta?.fileName){
        const catalogue=await window.AppStore_serverPackages?.();const a=(catalogue||[]).find(x=>x.fileName===r.meta.fileName);if(!a)throw new Error('App is no longer available in the App Store.');await window.AppStore_installPackageForUser(r.targetUser,r.meta.fileName,a.pkg,true);
      }
      r.status='approved';r.reviewedBy=currentUser;r.reviewedAt=new Date().toISOString();saveRequests(arr);
      notify('Request approved',`Your ${requestTypeLabel(r.type).toLowerCase()} request was approved.`,{to:r.targetUser,icon:'✓',appId:'messages'});window.Messages_render?.();render();return true;
    }catch(e){alert('Could not approve request: '+(e?.message||e));return false;}
  }
  function denyRequest(id,adminVerified=false){const arr=requests(),r=arr.find(x=>x.id===id);if(!r||!canReviewRequest(id,currentUser))return false;if(isAdmin(currentUser)&&!adminVerified){Admin_requireStrict(()=>denyRequest(id,true));return false;}r.status='denied';r.reviewedBy=currentUser;r.reviewedAt=new Date().toISOString();saveRequests(arr);notify('Request denied','Your request was denied.',{to:r.targetUser,icon:'✕',appId:'messages'});window.Messages_render?.();render();return true;}
  function replyRequest(id,reply,adminVerified=false){const r=requests().find(x=>x.id===id);if(!r||!canReviewRequest(id,currentUser)||!String(reply||'').trim())return false;if(isAdmin(currentUser)&&!adminVerified){Admin_requireStrict(()=>replyRequest(id,reply,true));return false;}if(window.Messages_sendRestrictionReply){window.Messages_sendRestrictionReply(r.targetUser,r,String(reply).trim());window.Messages_render?.();render();return true;}notify('Restriction request reply',String(reply).trim(),{to:r.targetUser,appId:'messages'});render();return true;}

  function showStorageRequestDialog(user=currentUser){
    if(String(user)!==String(currentUser||''))return;
    let overlay=document.getElementById('restrictionStorageRequestOverlay');
    if(!overlay){
      overlay=mk('div','restriction-lock-overlay');overlay.id='restrictionStorageRequestOverlay';
      const card=mk('div','restriction-lock-card');card.appendChild(mk('div','eyebrow','STORAGE LIMIT'));
      card.appendChild(mk('h2','','Storage Limit Reached'));card.appendChild(mk('p','','Would you like to send a request for more storage? Choose an amount and explain why you need it.'));
      const amount=document.createElement('select');amount.id='restrictionStorageDialogAmount';[['500','500 MB'],['1024','1 GB'],['5120','5 GB']].forEach(([v,t])=>amount.appendChild(new Option(t,v)));card.appendChild(amount);
      const why=document.createElement('textarea');why.id='restrictionStorageDialogWhy';why.className='restriction-request-text';why.placeholder='Explain why you need more storage…';card.appendChild(why);
      const actions=mk('div','restriction-lock-actions');actions.appendChild(button('Send Request',()=>{const explanation=why.value.trim();if(!explanation){why.focus();alert('Please explain why you need more storage.');return;}const amountValue=amount.value;const req=sendRequest('storage',profile(user).guardian,`${amountValue} MB — ${explanation}`,{amountMB:Number(amountValue)});if(req){overlay.remove();alert('Storage request sent in Messages.');}},'explorer-btn'));
      actions.appendChild(button('Not Now',()=>overlay.remove(),'explorer-btn ghost'));card.appendChild(actions);overlay.appendChild(card);document.body.appendChild(overlay);
    }else overlay.hidden=false;
  }
  function showLock(app){
    pendingLockedApp=app?(typeof app==='string'?app:(app.fileName?`installed:${app.fileName}`:(app.id||app.name||''))):'';
    const d=document.getElementById('screenTimeLockDialog');if(!d)return;d.hidden=false;d.style.display='grid';
    const p=effective(currentUser),text=document.getElementById('screenTimeLockText');
    if(text)text.textContent=p.dailyLimitMinutes===null?'Your daily Screen Time limit has been reached.':`Your ${p.dailyLimitMinutes}-minute daily Screen Time limit has been reached. Request extra time or use your Screen Time passcode.`;
    const area=document.getElementById('screenTimePasscodeArea');if(area)area.hidden=true;
    const input=document.getElementById('screenTimePasscodeInput');if(input)input.value='';
    const msg=document.getElementById('screenTimePasscodeMessage');if(msg)msg.textContent='';
    const why=document.getElementById('screenTimeRequestExplanation');if(why)why.value='';
  }
  function closeLock(){const d=document.getElementById('screenTimeLockDialog');if(d){d.hidden=true;d.style.display='none';}}
  function windowAppId(id){
    if(String(id||'').startsWith('installedApp-')){
      const fileName=window.InstalledAppsState?.windowFiles?.get?.(id);
      return fileName ? (window.InstalledAppsState?.byFile?.get?.(fileName)||`installed:${fileName}`) : id;
    }
    return typeof Desktop_windowAppId==='function'?Desktop_windowAppId(id):id;
  }
  function hideWindowsBlockedByScreenTime(user){
    const wm=window.WindowManager;
    if(!wm?.windows)return;
    for(const [id,record] of wm.windows.entries()){
      const el=record?.element;if(!el||!el.isConnected)continue;
      let isVisible=true;
      try{isVisible=getComputedStyle(el).display!=='none';}catch(_){isVisible=el.style.display!=='none';}
      if(!isVisible||el.classList.contains('window-minimized'))continue;
      const app=windowAppId(id),gate=canLaunch(app,user);
      if(gate.ok)continue;
      el.dataset.screenTimeHidden='true';
      el.dataset.screenTimePreviousDisplay=el.style.display||'';
      el.style.display='none';
    }
    try{window.Desktop_refreshTaskbar?.();}catch(_){}
  }
  function restoreTimeHiddenWindows(user=currentUser){
    const wm=window.WindowManager;
    if(!wm?.windows)return;
    for(const [id,record] of wm.windows.entries()){
      const el=record?.element;if(!el||!el.isConnected||el.dataset.screenTimeHidden!=='true')continue;
      const app=windowAppId(id);
      if(!canLaunch(app,user).ok)continue;
      el.style.display=el.dataset.screenTimePreviousDisplay||'block';
      delete el.dataset.screenTimeHidden;delete el.dataset.screenTimePreviousDisplay;
    }
    try{window.Desktop_refreshTaskbar?.();}catch(_){}
  }
  function lockDialogVisible(){const d=document.getElementById('screenTimeLockDialog');return !!d&&!d.hidden;}
  function tick(){
    const user=String(currentUser||''),now=Date.now();
    if(!user){trackedTimeUser='';lastObservedTimeOverride=false;lastTick=now;return;}
    if(document.hidden){lastTick=now;return;}
    const userChanged=user!==trackedTimeUser;
    if(userChanged){trackedTimeUser=user;lastTick=now;lastObservedTimeOverride=hasTimeOverride(user);}
    const p=effective(user),l=p.dailyLimitMinutes;
    if(l===null||l<=0){restoreTimeHiddenWindows(user);lastObservedTimeOverride=false;lastTick=now;return;}
    const over=hasTimeOverride(user),d=usage(user),before=d.seconds;
    if(before>=l*60){
      if(over){restoreTimeHiddenWindows(user);}
      else if(lastObservedTimeOverride||userChanged){hideWindowsBlockedByScreenTime(user);if(!lockDialogVisible())showLock('');}
      lastObservedTimeOverride=over;lastTick=now;return;
    }
    // A changed/raised limit may make previously hidden windows available again.
    restoreTimeHiddenWindows(user);
    const delta=Math.max(0,Math.min(15,(now-lastTick)/1000));lastTick=now;
    d.seconds=Math.min(l*60,before+delta);saveUsage(user,d);
    lastObservedTimeOverride=hasTimeOverride(user);
    if(before<l*60&&d.seconds>=l*60){window.dispatchEvent(new CustomEvent('jackos:screentime',{detail:{user}}));}
  }
  setInterval(tick,10000);window.addEventListener('focus',()=>{lastTick=Date.now();});
  window.addEventListener('jackos:screentime',e=>{
    if(e?.detail?.user&&e.detail.user!==currentUser)return;
    hideWindowsBlockedByScreenTime(currentUser);
    showLock('');
  });

  function refreshVisibility(){
    const actor=String(currentUser||'');
    const els=document.querySelectorAll('#desktop .icon[data-app], #desktop [data-installed-app="true"], #startMenu .menu-item[data-app]');
    els.forEach(el=>{
      const raw=el.dataset.app || (el.dataset.installedAppFile?`installed:${el.dataset.installedAppFile}`:(String(el.dataset.layoutId||'').startsWith('installed:')?el.dataset.layoutId:''));
      const id=raw.startsWith('installed:')?raw.slice(10):raw;
      const meta=appMeta(id);const allowed=appAllowed(meta,actor);
      if(!allowed){if(!el.dataset.jackosRestrictedHidden){el.dataset.jackosRestrictedHidden='1';el.dataset.jackosRestrictionPrevDisplay=el.style.display||'';}el.style.display='none';}
      else if(el.dataset.jackosRestrictedHidden==='1'){el.style.display=el.dataset.jackosRestrictionPrevDisplay||'';delete el.dataset.jackosRestrictedHidden;delete el.dataset.jackosRestrictionPrevDisplay;}
    });
  }
  function open(){render();['settingsMain','settingsAccountsPanel','settingsDataPanel','settingsSandboxPanel','settingsApplicationsPanel','settingsTaskbarPanel','settingsAboutPanel'].forEach(id=>document.getElementById(id)?.style.setProperty('display','none'));document.getElementById('settingsRestrictionsPanel')?.style.setProperty('display','block');}

  window.JackOSRestrictions_isAppAllowed=appAllowed;
  window.JackOSRestrictions_isInstallAllowed=installAllowed;
  window.JackOSRestrictions_isImportAllowed=importAllowed;
  window.JackOSRestrictions_canLaunchApp=canLaunch;
  window.JackOSRestrictions_handleLockedApp=function(app){const r=canLaunch(app,currentUser);if(r.ok)return true;if(r.reason==='screen-time'){hideWindowsBlockedByScreenTime(currentUser);showLock(app);return false;}alert('This app is restricted for this account.');return false;};
  window.JackOSRestrictions_openPasscode=function(){const area=document.getElementById('screenTimePasscodeArea');if(area)area.hidden=false;const msg=document.getElementById('screenTimePasscodeMessage');if(!effective(currentUser).screenTimePasscode&&msg)msg.textContent='No Screen Time passcode is set. Request more time or contact your administrator or guardian.';setTimeout(()=>document.getElementById('screenTimePasscodeInput')?.focus(),20);};
  window.JackOSRestrictions_submitPasscode=function(){const p=effective(currentUser),input=document.getElementById('screenTimePasscodeInput'),msg=document.getElementById('screenTimePasscodeMessage');if(!input||!p.screenTimePasscode||input.value!==p.screenTimePasscode){if(msg)msg.textContent='Incorrect Screen Time passcode.';return;}localStorage.setItem('jackosScreenTimeOverride:'+encodeURIComponent(String(currentUser)),String(Date.now()+15*60*1000));lastObservedTimeOverride=true;restoreTimeHiddenWindows(currentUser);const app=pendingLockedApp;pendingLockedApp='';closeLock();if(app)Desktop_launch(app);};
  window.JackOSRestrictions_openMessages=function(){closeLock();Desktop_launch('messages');};
  window.JackOSRestrictions_openSettings=function(){closeLock();Desktop_launch('settings');};
  window.JackOSRestrictions_refreshVisibility=refreshVisibility;
  window.JackOSRestrictions_restoreTimeHiddenWindows=()=>restoreTimeHiddenWindows(currentUser);
  window.JackOSRestrictions_categories=CATS;
  window.JackOSRestrictions_storageLimit=storageLimit;
  window.JackOSRestrictions_canAddBytes=canAddBytes;
  window.JackOSRestrictions_storageUsed=storageUsed;
  window.JackOSRestrictions_minutesUsed=minutesUsed;
  window.JackOSRestrictions_dailyLimit=limit;
  window.JackOSRestrictions_sendRequest=sendRequest;
  window.JackOSRestrictions_requestStorage=requestStorage;
  window.JackOSRestrictions_requestChange=requestChange;
  window.JackOSRestrictions_requestMoreTime=requestMoreTime;
  window.JackOSRestrictions_approveRequest=approveRequest;
  window.JackOSRestrictions_denyRequest=denyRequest;
  window.JackOSRestrictions_replyRequest=replyRequest;
  window.JackOSRestrictions_canReviewRequest=canReviewRequest;
  window.JackOSRestrictions_canManage=canManage;
  window.JackOSRestrictions_isGuardian=isGuardian;
  window.JackOSRestrictions_open=open;
  window.JackOSRestrictions_profile=profile;
  window.JackOSRestrictions_effective=effective;
  window.JackOSRestrictions_requests=requests;
  window.JackOSRestrictions_limitReached=limitReached;
  window.JackOSRestrictions_hasTimeOverride=hasTimeOverride;

  if(typeof ready==='function')ready(()=>{
    setTimeout(()=>{try{refreshVisibility();if(limitReached(currentUser)){/* show the lock on the next blocked app or at the active limit transition */}}catch(_){}},300);
    try{window.AppStore_serverPackages?.().then(v=>{catalogCache=v||[];if(document.getElementById('settingsRestrictionsPanel')?.style.display==='block')render();}).catch(()=>{});}catch(_){}
    window.addEventListener('storage',e=>{try{
      if(e.key===KEY||e.key==='jackosUsers'){
        refreshVisibility();if(document.getElementById('settingsRestrictionsPanel')?.style.display==='block')render();
        if(limitReached(currentUser)&&!hasTimeOverride(currentUser)){hideWindowsBlockedByScreenTime(currentUser);if(!lockDialogVisible())showLock('');}
        else {restoreTimeHiddenWindows(currentUser);closeLock();}
      }
      if(e.key&&e.key.startsWith('jackosScreenTimeOverride:')&&e.key==='jackosScreenTimeOverride:'+encodeURIComponent(String(currentUser||''))&&hasTimeOverride(currentUser)){lastObservedTimeOverride=true;restoreTimeHiddenWindows(currentUser);closeLock();}
    }catch(_){}});
  });
})();
