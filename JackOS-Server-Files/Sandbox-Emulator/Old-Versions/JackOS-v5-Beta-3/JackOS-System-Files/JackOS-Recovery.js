// JackOS-Recovery.js — restart-only recovery environment.
(function(){
  'use strict';
  const SAFE='jackosSafeMode';
  const RECOVERY_HASH='jackosRecoveryKeyHash';
  const RECOVERY_KEY='jackosRecoveryKey';
  const RECOVERY_RECEIVED='jackosRecoveryKeyReceived';
  let armed=false,count=0,authFailures=0;

  const activated=()=>localStorage.getItem('jackosActivated')==='true';
  const hasAdmin=()=>{try{Users_migrate?.();return Users_all().some(u=>u&&!u.guest&&u.role==='admin')}catch(_){return false}};
  const status=(text,kind='')=>{
    const e=document.getElementById('recoveryStatus');
    if(e){e.textContent=String(text||'');e.className='recovery-status '+kind;}
    const list=document.getElementById('recoveryActivityItems');
    if(list&&String(text||'').trim()){
      const empty=list.querySelector('.recovery-activity-empty');if(empty)empty.remove();
      const row=document.createElement('div');row.className='recovery-activity-item '+kind;
      const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      row.textContent=time+' · '+String(text);
      list.prepend(row);
      while(list.children.length>8)list.lastElementChild.remove();
    }
  };

  async function sha256(text){
    const data=new TextEncoder().encode(String(text));
    const digest=await crypto.subtle.digest('SHA-256',data);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function randomRecoveryKey(){
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes=new Uint8Array(24); crypto.getRandomValues(bytes);
    let raw=''; for(const b of bytes) raw+=alphabet[b%alphabet.length];
    return 'JACKOS-'+raw.match(/.{1,4}/g).join('-');
  }
  async function ensureRecoveryKey(){
    const existing=localStorage.getItem(RECOVERY_KEY)||'';
    if(existing){
      if(!localStorage.getItem(RECOVERY_HASH)) localStorage.setItem(RECOVERY_HASH,await sha256(existing));
      return existing;
    }
    const key=randomRecoveryKey();
    localStorage.setItem(RECOVERY_KEY,key);
    localStorage.setItem(RECOVERY_HASH,await sha256(key));
    return key;
  }

  function recoveryKeyReceived(){
    return localStorage.getItem(RECOVERY_RECEIVED)==='true';
  }

  function recoveryAdmins(){
    try{ return Users_all().filter(u=>u&&!u.guest&&u.role==='admin'&&u.name).map(u=>String(u.name)); }catch(_){ return []; }
  }

  function recoveryMessageDb(){
    try{
      const d=JSON.parse(localStorage.getItem('jackosMessages')||'{}');
      d.systemMessages=d.systemMessages&&typeof d.systemMessages==='object'&&!Array.isArray(d.systemMessages)?d.systemMessages:{};
      return d;
    }catch(_){ return {systemMessages:{}}; }
  }

  async function deliverRecoveryKeyMessage(){
    if(!activated()||recoveryKeyReceived()) return false;
    Users_migrate?.();
    const admins=recoveryAdmins();
    if(!admins.length) return false;

    const key=await ensureRecoveryKey();
    const d=recoveryMessageDb();
    const now=new Date().toISOString();
    const text='Your JackOS Recovery Key is '+key+'. Keep this key somewhere safe. It is required for destructive Recovery actions if administrator credentials are unavailable.';

    admins.forEach(name=>{
      const list=Array.isArray(d.systemMessages[name])?d.systemMessages[name]:[];
      const already=list.some(m=>m&&m.recoveryKeyNotice===true);
      if(!already){
        list.push({
          id:'recovery-key-'+crypto.randomUUID(),
          from:'JackOS',
          text,
          timestamp:now,
          read:false,
          recoveryKeyNotice:true
        });
      }
      d.systemMessages[name]=list;
      try{
        Notifications_addForUser?.(name,'Your JackOS Recovery Key',text,{
          id:'recovery-key-notice-'+encodeURIComponent(name),
          icon:'🔐',
          appId:'messages',
          source:'system',
          targetConversation:'system:JackOS',
          conversationId:'system:JackOS',
          target:'system:JackOS'
        });
      }catch(_){}
    });

    localStorage.setItem('jackosMessages',JSON.stringify(d));
    localStorage.setItem(RECOVERY_RECEIVED,'true');
    return true;
  }
  async function verifyRecoveryKey(key){
    const stored=localStorage.getItem(RECOVERY_HASH)||'';
    if(!stored) return false;
    return (await sha256(String(key).trim().toUpperCase()))===stored;
  }

  function showHome(){
    const home=document.getElementById('recoveryHome');
    const prompt=document.getElementById('recoveryPrompt');
    const hint=document.getElementById('recoveryBootHint');
    const screen=document.getElementById('recoveryScreen');
    if(hint){hint.hidden=true;hint.style.display='none';}
    if(prompt){prompt.hidden=true;prompt.style.display='none';}

    const cloud=document.querySelector('[data-recovery-action="cloud"]');
    let a=null;
    try{a=JSON.parse(localStorage.getItem('jackosActivationData')||'null')}catch(_){ }
    if(cloud) cloud.style.display=a?.cloudSync?'':'none';

    // Recovery is a first-class JackOS screen. Use the same screen routing
    // mechanism as Login, Setup and Desktop instead of layering Recovery over
    // the startup page. This guarantees the Recovery UI gets a real active
    // screen and cannot inherit the startup screen's blank/black state.
    try{ show('recoveryScreen',false); }catch(_){
      document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
      screen?.classList.add('active');
    }

    if(screen){
      screen.hidden=false;
      screen.classList.add('active');
      screen.removeAttribute('aria-hidden');
    }
    if(home){
      home.hidden=false;
      home.removeAttribute('aria-hidden');
      home.style.display='';
      home.style.visibility='';
      home.style.opacity='';
    }
    const shell=screen?.querySelector('.recovery-shell');
    if(shell){
      shell.style.display='flex';
      shell.style.visibility='visible';
      shell.style.opacity='1';
    }

    // Remove every startup transition/overlay that could sit above Recovery.
    const fade=document.getElementById('fadeOverlay');
    if(fade){fade.classList.remove('show');fade.style.display='none';fade.style.visibility='hidden';fade.style.opacity='0';}
    const genericOverlay=document.getElementById('overlay');
    if(genericOverlay){genericOverlay.style.display='none';genericOverlay.style.pointerEvents='none';}
    const loading=document.getElementById('recoveryBootLoading');
    if(loading){loading.hidden=true;loading.style.display='none';}
    const startup=document.getElementById('startup');
    if(startup){startup.classList.remove('active');startup.hidden=true;startup.style.display='none';}

    sessionStorage.setItem('jackosRecoveryEntered','true');
    sessionStorage.removeItem('jackosRecoveryBoot');
    document.body.classList.add('jackos-recovery-active');
    document.documentElement.classList.add('jackos-recovery-active');

    // Put keyboard focus into the Recovery environment so it behaves like a
    // native JackOS destination rather than an inert overlay.
    home?.setAttribute('tabindex','-1');
    requestAnimationFrame(()=>home?.focus?.());
  }

  function continueNormalBoot(){
    if(sessionStorage.getItem('jackosRecoveryEntered')==='true')return;
    const text=document.getElementById('main-text');
    if(text){text.style.transition='opacity 1.2s ease';text.style.opacity='0';}
    setTimeout(()=>{
      const activatedNow=localStorage.getItem('jackosActivated')==='true';
      Users_migrate?.();
      if(activatedNow){
        if(Users_hasAny?.()) show('login',true);
        else if(typeof JackOS_OOBE_start==='function') JackOS_OOBE_start();
        else show('setup',true);
      }else{
        const popup=document.getElementById('popup');if(popup)popup.style.display='block';
      }
    },1200);
  }

  function showRecoveryLoading(){
    const hint=document.getElementById('recoveryBootHint');
    if(hint){hint.hidden=true;hint.style.display='none';}
    const loading=document.getElementById('recoveryBootLoading');
    if(loading){loading.hidden=false;loading.style.display='flex';}
    // Keep the startup screen and monkey visible underneath the loading state.
    // The actual Recovery screen is only activated after the loading phase.
    const text=document.getElementById('main-text');
    if(text){text.style.transition='none';text.style.opacity='1';}
    setTimeout(()=>{
      if(loading){loading.hidden=true;loading.style.display='none';}
      if(sessionStorage.getItem('jackosRecoveryEntered')==='true')showHome();
    },900);
  }

  function armOnRestart(){
    if(!activated()||sessionStorage.getItem('jackosRecoveryBoot')!=='true')return;
    const hint=document.getElementById('recoveryBootHint');
    if(hint){hint.hidden=true;hint.style.display='none';}
    armed=true;count=0;
    const cleanup=()=>{document.removeEventListener('keydown',onKey,true);armed=false;};
    const onKey=e=>{
      if(e.code!=='Space'||!armed)return;
      e.preventDefault();
      count++;
      // Do not reveal the Recovery prompt immediately. The first five Space
      // presses are deliberately invisible so accidental presses do nothing.
      if(count===6 && hint){hint.hidden=false;hint.style.display='block';}
      if(count>=8){
        cleanup();
        sessionStorage.removeItem('jackosRecoveryBoot');
        sessionStorage.setItem('jackosRecoveryEntered','true');
        showRecoveryLoading();
      }
    };
    document.addEventListener('keydown',onKey,true);
    setTimeout(()=>{
      if(!armed)return;
      cleanup();
      sessionStorage.removeItem('jackosRecoveryBoot');
      if(sessionStorage.getItem('jackosRecoveryEntered')!=='true')continueNormalBoot();
    },5200);
  }

  window.JackOS_recoveryBootContinue=continueNormalBoot;

  function showRecoveryKeyDialog(onSuccess){
    const old=document.getElementById('recoveryKeyDialog');old?.remove();
    const dlg=document.createElement('div');dlg.id='recoveryKeyDialog';dlg.className='modal recovery-security-modal';
    dlg.innerHTML='<div class="shade"></div><div class="panel recovery-auth-panel"><div class="recovery-security-icon">🔐</div><h3>Recovery Key Required</h3><p>Use the Recovery Key created when JackOS was first set up.</p><div class="row single"><input id="recoveryKeyInput" type="password" autocomplete="off" placeholder="JACKOS-XXXX-XXXX-XXXX-XXXX-XXXX"></div><div id="recoveryKeyMsg" class="auth-message"></div><div class="footer"><button class="btn ghost" id="recoveryKeyCancel">Cancel</button><button class="btn" id="recoveryKeyVerify">Verify</button></div></div>';
    document.body.appendChild(dlg);dlg.style.display='flex';
    const input=dlg.querySelector('#recoveryKeyInput'),msg=dlg.querySelector('#recoveryKeyMsg');
    const fail=()=>{authFailures++;msg.textContent=authFailures>=5?'Too many failed attempts. Please wait before trying again.':'Recovery Key not recognised.'; if(authFailures>=5){dlg.querySelector('#recoveryKeyVerify').disabled=true;setTimeout(()=>{authFailures=0;dlg.querySelector('#recoveryKeyVerify').disabled=false;msg.textContent='You may try again.'},30000)}};
    dlg.querySelector('#recoveryKeyCancel').onclick=()=>{dlg.remove();status('Recovery Key verification cancelled. No action was performed.','');};
    dlg.querySelector('#recoveryKeyVerify').onclick=async()=>{if(authFailures>=5)return;if(await verifyRecoveryKey(input.value)){dlg.remove();onSuccess?.()}else fail()};
    input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dlg.querySelector('#recoveryKeyVerify').click()}});setTimeout(()=>input?.focus(),50);
  }

  function runReported(label,action){
    status(label+': Starting…','pending');
    return Promise.resolve().then(()=>action()).then(result=>{
      if(result&&result.recoveryInteractive){
        status(label+': '+(result.message||'Waiting for your input.'),result.kind||'pending');
        return result;
      }
      if(result&&result.recoveryCancelled){
        status(label+': '+(result.message||'Cancelled. No changes were made.'),'');
        return result;
      }
      if(result&&result.recoveryRestart){
        status(label+': '+result.message,'success');
        setTimeout(()=>location.reload(),Math.max(300,Number(result.delay)||1200));
        return result;
      }
      const message=typeof result==='string'?result:(result&&result.message)||'Completed successfully.';
      status(label+': '+message,(result&&result.kind)||'success');
      return result;
    }).catch(err=>{
      const message=err?.message||String(err)||'Unknown error';
      console.error('JackOS Recovery action failed:',label,err);
      status(label+': Failed — '+message,'error');
      return {ok:false,message};
    });
  }

  function bootstrap(action,label='Recovery action'){
    const run=()=>runReported(label,action);
    if(hasAdmin()){
      status(label+': Waiting for administrator verification.','pending');
      if(typeof Admin_requireStrict!=='function')throw new Error('Administrator authentication is unavailable.');
      Admin_requireStrict(run,{allowRecoveryForgot:true,recoveryForgotLabel:label});
    }else{
      status(label+': Verify the device Recovery Key to continue.','pending');
      showRecoveryKeyDialog(run);
    }
  }

  function showDestructiveGate(action,label){
    const finalRun=()=>runReported(label,action);
    if(hasAdmin()){
      status(label+': Administrator verification required before the destructive confirmation.','pending');
      if(typeof Admin_requireStrict!=='function')throw new Error('Administrator authentication is unavailable.');
      Admin_requireStrict(()=>showErasePhrase(()=>showRecoveryKeyDialog(finalRun)),{allowRecoveryForgot:true,recoveryForgotLabel:label});
    }else{
      status(label+': Recovery Key verification required.','pending');
      showRecoveryKeyDialog(()=>showErasePhrase(finalRun));
    }
  }

  function showErasePhrase(action){
    const old=document.getElementById('erasePhraseDialog');old?.remove();
    const dlg=document.createElement('div');dlg.id='erasePhraseDialog';dlg.className='modal recovery-security-modal';
    dlg.innerHTML='<div class="shade"></div><div class="panel recovery-auth-panel danger-panel"><div class="recovery-security-icon">⚠️</div><h3>Confirm Erase</h3><p>This is a destructive Recovery action. Type <b>ERASE JACKOS</b> to continue.</p><div class="row single"><input id="erasePhraseInput" autocomplete="off" placeholder="ERASE JACKOS"></div><div id="erasePhraseMsg" class="auth-message"></div><div class="footer"><button class="btn ghost" id="erasePhraseCancel">Cancel</button><button class="btn danger" id="erasePhraseContinue" disabled>Continue</button></div></div>';
    document.body.appendChild(dlg);dlg.style.display='flex';
    const input=dlg.querySelector('#erasePhraseInput'),btn=dlg.querySelector('#erasePhraseContinue');
    input.oninput=()=>{btn.disabled=input.value.trim()!=='ERASE JACKOS'};
    dlg.querySelector('#erasePhraseCancel').onclick=()=>{dlg.remove();status('Destructive action cancelled. No data was erased.','');};
    btn.onclick=()=>{dlg.remove();status('Erase phrase accepted. Verifying the Recovery Key next.','pending');action?.();};
    input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!btn.disabled){e.preventDefault();btn.click()}});
    setTimeout(()=>input?.focus(),50);
  }

  function showEraseConfirmation(mode){
    const old=document.getElementById('eraseWarningDialog');old?.remove();
    const resetMode=mode==='reset';
    const title=resetMode?'Reset JackOS':'Erase Everything';
    const dlg=document.createElement('div');dlg.id='eraseWarningDialog';dlg.className='modal recovery-security-modal';
    dlg.innerHTML='<div class="shade"></div><div class="panel recovery-auth-panel danger-panel"><div class="recovery-security-icon">🗑️</div><h3>'+title+'</h3><p><b>'+(resetMode?'JackOS will be reset to its activation/setup state.':'Everything on this JackOS installation will be permanently erased.')+'</b></p><p class="recovery-warning-list">All local user accounts, files, installed applications, settings and local system data will be removed. This cannot be undone.</p><div class="footer"><button class="btn ghost" id="eraseFinalCancel">Cancel</button><button class="btn danger" id="eraseFinalConfirm">'+title+'</button></div></div>';
    document.body.appendChild(dlg);dlg.style.display='flex';
    dlg.querySelector('#eraseFinalCancel').onclick=()=>{dlg.remove();status(title+': cancelled. No data was removed.','');};
    dlg.querySelector('#eraseFinalConfirm').onclick=()=>{dlg.remove();performErase(mode).catch(err=>{status(title+': Erase failed — '+(err?.message||String(err)),'error');});};
    status(title+': Final confirmation opened. Review the warning before continuing.','pending');
    return {recoveryInteractive:true,message:'Final confirmation is open. No data has been removed yet.'};
  }

  async function performErase(mode){
    const resetMode=mode==='reset';
    const title=resetMode?'Resetting JackOS':'Erasing Everything';
    const overlay=document.getElementById('overlay');
    document.body.classList.add('jackos-power-transition');
    if(overlay){overlay.innerHTML='<div class="power-screen"><div class="power-spinner" aria-hidden="true"></div><div class="power-title">'+title+'</div><div class="power-subtitle">Removing local accounts, files, applications and settings…</div></div>';overlay.style.display='flex';overlay.style.alignItems='center';overlay.style.justifyContent='center';overlay.style.color='#fff';}
    let removedOPFS=0,removedLocal=0,failed=0;
    try{
      if(navigator.storage?.getDirectory){
        const root=await navigator.storage.getDirectory();
        const names=[];for await(const entry of root.values())names.push(entry.name);
        for(const name of names){try{await root.removeEntry(name,{recursive:true});removedOPFS++;}catch(_){failed++;}}
      }else{failed++;}
    }catch(e){failed++;console.warn('Recovery OPFS erase failed',e);}
    try{removedLocal=localStorage.length;localStorage.clear();}catch(_){failed++;}
    try{sessionStorage.clear();}catch(_){failed++;}
    if(overlay){
      overlay.innerHTML='<div class="power-screen"><div class="power-icon">'+(failed?'⚠️':'✓')+'</div><div class="power-title">'+(failed?'Reset finished with a warning':'Completed successfully')+'</div><div class="power-subtitle">'+(failed?'Some browser storage could not be removed.':'Removed '+removed+' local storage area(s).')+' Restarting JackOS…</div></div>';
      overlay.style.display='flex';
    }
    document.body.classList.remove('jackos-power-transition');
    setTimeout(()=>location.reload(),1500);
  }

  function reset(){return showEraseConfirmation('reset')}
  function eraseEverything(){return showEraseConfirmation('erase')}

  function forgotAdmin(){
    // Capture the pending Recovery action/label before closing the auth sheet.
    const action=typeof Admin_getPendingRecoveryAction==='function'?Admin_getPendingRecoveryAction():null;
    const label=typeof Admin_getPendingRecoveryLabel==='function'?Admin_getPendingRecoveryLabel():'this Recovery action';
    // The administrator auth popup must disappear completely when Forgot is chosen.
    if(typeof Admin_closeDialog==='function') Admin_closeDialog();
    else {
      const dlg=document.getElementById('adminAuthDialog');
      if(dlg) dlg.style.display='none';
    }
    if(typeof action!=='function'){
      status('Forgot admin credentials: no Recovery action is currently waiting for verification. No changes were made.','error');
      return;
    }
    status('Forgot admin credentials for '+label+': Recovery Key verification will be used instead of administrator credentials.','pending');
    showRecoveryKeyDialog(()=>{
      status('Recovery Key accepted for '+label+'. Continuing the requested Recovery action.','success');
      return action();
    });
  }

  async function diagnostics(){
    Users_migrate();
    let opfs='Unavailable',apps='Unknown';
    try{const root=await navigator.storage?.getDirectory?.();opfs=root?'Available':'Unavailable'}catch(_){opfs='Error'}
    try{await InstalledApps_scan?.();apps=String(typeof InstalledAppsState!=='undefined'?InstalledAppsState.apps.length:'Unknown')+' valid package(s) for current account'}catch(_){apps='Error'}
    const users=Users_all();
    const admin=users.filter(u=>u&&!u.guest&&u.role==='admin').length;
    const activation=activated()?'Active':'Not active';
    const edition=localStorage.getItem('jackosEdition')||'Home';
    const old=document.getElementById('diagnosticDialog');old?.remove();
    const dlg=document.createElement('div');dlg.id='diagnosticDialog';dlg.className='modal recovery-security-modal';
    dlg.innerHTML='<div class="shade"></div><div class="panel recovery-auth-panel"><div class="recovery-security-icon">🩺</div><h3>Diagnostic Mode</h3><div class="diagnostic-report"><div><span>Activation</span><b>'+activation+'</b></div><div><span>Edition</span><b>'+edition+'</b></div><div><span>User accounts</span><b>'+users.length+'</b></div><div><span>Administrators</span><b>'+admin+'</b></div><div><span>OPFS storage</span><b>'+opfs+'</b></div><div><span>Applications</span><b>'+apps+'</b></div><div><span>Recovery security</span><b>'+((localStorage.getItem(RECOVERY_HASH)&&localStorage.getItem(RECOVERY_RECEIVED)==='true')?'Configured':'Awaiting delivery')+'</b></div></div><div class="footer"><button class="btn" id="diagnosticClose">Done</button></div></div>';
    document.body.appendChild(dlg);dlg.style.display='flex';
    dlg.querySelector('#diagnosticClose').onclick=()=>{dlg.remove();showHome();status('Diagnostic Mode: report reviewed and closed.','success');};
    return {recoveryInteractive:true,message:'Diagnostics completed. Review the report window.'};
  }

  async function startup(){
    Users_migrate();
    const users=Users_all().filter(u=>u&&u.name);
    if(!navigator.storage?.getDirectory)throw new Error('This browser does not provide Origin Private File System (OPFS) storage.');
    let folders=0;
    for(const user of users){
      const dir=await UserData_dir(user.name);
      await dir.getDirectoryHandle('Desktop',{create:true});folders++;
      await dir.getDirectoryHandle('Applications',{create:true});folders++;
    }
    let scanned=0;
    try{const list=await InstalledApps_scan?.();scanned=Array.isArray(list)?list.length:0;}catch(e){throw new Error('User folders were checked, but the installed application registry could not be refreshed: '+(e?.message||e))}
    return 'Checked '+users.length+' account(s), verified '+folders+' user folders, refreshed the current application registry ('+scanned+' package(s)). No personal files were deleted.';
  }

  async function temp(){
    const keys=['jackosAppCache','jackosSearchCache','jackosNotificationFetchError'];
    let removed=0,absent=0;
    for(const key of keys){if(localStorage.getItem(key)!==null){localStorage.removeItem(key);removed++;}else absent++;}
    return 'Cleared '+removed+' temporary cache record(s); '+absent+' cache record(s) were already empty.';
  }

  async function users(){
    const list=Users_all();
    if(!Array.isArray(list)||!list.length)throw new Error('No readable user accounts were found. No accounts were changed.');
    let changed=0;
    for(const user of list){
      if(!user||typeof user!=='object')continue;
      if(user.guest){if(user.role!=='user'||user.pass!==''){user.role='user';user.pass='';changed++;}continue;}
      if(!['admin','user'].includes(user.role)){user.role='user';changed++;}
    }
    let admins=list.filter(u=>u&&!u.guest&&u.role==='admin');
    if(!admins.length){const first=list.find(u=>u&&!u.guest&&String(u.name||'').trim());if(first){first.role='admin';changed++;admins=[first];}}
    Users_save(list);
    Users_migrate();
    return 'Checked '+list.length+' account record(s), normalised '+changed+' role record(s), and confirmed '+admins.length+' administrator account(s). Passwords and security answers were preserved.';
  }

  async function scanAppPackages(){
    if(!navigator.storage?.getDirectory)throw new Error('OPFS storage is unavailable in this browser.');
    Users_migrate();
    const allUsers=Users_all().filter(u=>u&&u.name);
    const damaged=[];let valid=0,checked=0;
    for(const user of allUsers){
      const userDir=await UserData_dir(user.name);
      const appDir=await userDir.getDirectoryHandle('Applications',{create:true});
      for await(const entry of appDir.values()){
        if(entry.kind!=='file'||!entry.name.toLowerCase().endsWith('.zip'))continue;
        checked++;
        try{const pkg=await AppPackage_read(await entry.getFile());if(pkg)valid++;else damaged.push({user:user.name,name:entry.name});}
        catch(_){damaged.push({user:user.name,name:entry.name});}
      }
    }
    return {damaged,valid,checked,userCount:allUsers.length};
  }

  function showDamagedAppsDialog(scan){
    const old=document.getElementById('recoveryDamagedAppsDialog');old?.remove();
    const dlg=document.createElement('div');dlg.id='recoveryDamagedAppsDialog';dlg.className='modal recovery-security-modal';
    const rows=scan.damaged.map((item,i)=>'<label class="recovery-damaged-app"><input type="checkbox" data-damaged-index="'+i+'" checked><span><b>'+item.name.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</b><small>Account: '+String(item.user).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</small></span></label>').join('');
    dlg.innerHTML='<div class="shade"></div><div class="panel recovery-auth-panel"><div class="recovery-security-icon">🧩</div><h3>Damaged Applications Found</h3><p>Scan checked '+scan.checked+' package ZIP(s) across '+scan.userCount+' account(s). '+scan.valid+' package(s) look valid. Select damaged files to remove; no files are removed until you press Remove Selected.</p><div class="recovery-damaged-list">'+rows+'</div><div class="auth-message" id="recoveryDamagedMsg"></div><div class="footer"><button class="btn ghost" id="recoveryDamagedKeep">Keep Files</button><button class="btn danger" id="recoveryDamagedRemove">Remove Selected</button></div></div>';
    document.body.appendChild(dlg);dlg.style.display='flex';
    const remove=dlg.querySelector('#recoveryDamagedRemove');
    const checks=()=>[...dlg.querySelectorAll('[data-damaged-index]:checked')];
    dlg.querySelectorAll('[data-damaged-index]').forEach(c=>c.addEventListener('change',()=>{remove.disabled=!checks().length}));
    dlg.querySelector('#recoveryDamagedKeep').onclick=()=>{dlg.remove();status('Repair Applications: scan finished. '+scan.damaged.length+' damaged package(s) were found and kept; no files were deleted.','');};
    remove.onclick=async()=>{
      const selected=checks().map(c=>scan.damaged[Number(c.dataset.damagedIndex)]).filter(Boolean);
      if(!selected.length)return;
      remove.disabled=true;dlg.querySelector('#recoveryDamagedMsg').textContent='Removing selected damaged packages…';
      let count=0;const errors=[];
      for(const item of selected){try{const dir=await UserData_dir(item.user);const appsDir=await dir.getDirectoryHandle('Applications');await appsDir.removeEntry(item.name);count++;}catch(e){errors.push(item.name+': '+(e?.message||String(e)));}}
      dlg.remove();
      try{await InstalledApps_scan?.();AppStore_render?.();Settings_renderApplications?.();}catch(e){errors.push('Refresh: '+(e?.message||String(e)));}
      if(errors.length)status('Repair Applications: removed '+count+' damaged package(s); '+errors.length+' operation(s) failed — '+errors.join('; '),'error');
      else status('Repair Applications: removed '+count+' damaged package(s). '+(scan.valid)+' valid package(s) were retained.','success');
    };
  }

  async function apps(){
    const scan=await scanAppPackages();
    try{await InstalledApps_scan?.();AppStore_render?.();Settings_renderApplications?.();}catch(_){ }
    if(scan.damaged.length){
      showDamagedAppsDialog(scan);
      return {recoveryInteractive:true,message:'Scan finished: '+scan.valid+' valid package(s), '+scan.damaged.length+' damaged ZIP(s). Choose whether to remove them.'};
    }
    return 'Scanned '+scan.checked+' application ZIP(s) across '+scan.userCount+' account(s). All '+scan.valid+' package(s) passed validation; nothing needed removal.';
  }

  async function backup(){
    const old=document.getElementById('recoveryBackupDialog');old?.remove();
    const dlg=document.createElement('div');dlg.id='recoveryBackupDialog';dlg.className='modal recovery-security-modal';
    dlg.innerHTML='<div class="shade"></div><div class="panel recovery-auth-panel"><div class="recovery-security-icon">📦</div><h3>Restore Backup</h3><p>Select a JackOS system backup ZIP to restore. Existing local data will be replaced only after you confirm the restore prompts.</p><div class="recovery-backup-picker"><input id="recoveryBackupFile" type="file" accept=".zip,application/zip"><label for="recoveryBackupFile" class="btn ghost recovery-file-button">Choose Backup ZIP</label><div id="recoveryBackupName" class="recovery-file-name">No backup selected</div></div><div id="recoveryBackupMsg" class="auth-message" aria-live="polite"></div><div class="footer"><button class="btn ghost" id="recoveryBackupCancel">Cancel</button><button class="btn" id="recoveryBackupRestore" disabled>Restore</button></div></div>';
    document.body.appendChild(dlg);dlg.style.display='flex';
    const input=dlg.querySelector('#recoveryBackupFile'),msg=dlg.querySelector('#recoveryBackupMsg'),name=dlg.querySelector('#recoveryBackupName'),restore=dlg.querySelector('#recoveryBackupRestore');
    input.onchange=()=>{const file=input.files?.[0];restore.disabled=!file;msg.textContent=file?'Selected '+file.name+'. Press Restore to validate and continue.':'Select a backup ZIP.';if(name)name.textContent=file?file.name:'No backup selected';};
    dlg.querySelector('#recoveryBackupCancel').onclick=()=>{dlg.remove();status('Restore Backup: cancelled. No backup was imported.','');};
    restore.onclick=async()=>{
      const file=input.files?.[0];if(!file)return;
      restore.disabled=true;msg.textContent='Validating backup…';status('Restore Backup: validating '+file.name+'…','pending');
      try{
        const result=await Backup_restore(file,{recoveryFlow:true});
        if(result?.ok){dlg.remove();status('Restore Backup: '+(result.message||'backup restored successfully. Restarting JackOS…'),'success');setTimeout(()=>location.reload(),1400);return;}
        if(result?.cancelled){const text=result.message||'Restore cancelled. No changes were made.';msg.textContent=text;restore.disabled=false;status('Restore Backup: '+text,result.kind==='error'?'error':'');return;}
        throw new Error(result?.message||'The backup did not report a successful restore.');
      }catch(e){msg.textContent=e?.message||'Backup restore failed.';restore.disabled=false;status('Restore Backup: failed — '+(e?.message||String(e)),'error');}
    };
    return {recoveryInteractive:true,message:'Backup picker opened. Choose a ZIP, then press Restore to continue.'};
  }

  async function cloud(){
    let a;try{a=JSON.parse(localStorage.getItem('jackosActivationData')||'null')}catch(_){a=null}
    if(!a?.cloudSync)throw new Error('Cloud Sync is not configured for this installation. No data was changed.');
    const p=prompt('Enter the Cloud Sync ZIP password:');
    if(!p)return {recoveryCancelled:true,message:'Password prompt cancelled. No data was changed.'};
    const u=new URL('../JackOS-Server-Files/Activation-Keys/Activation.json',location.href);
    const r=await fetch(new URL(a.cloudSync,u).href,{cache:'no-store'});
    if(!r.ok)throw new Error('Cloud backup unavailable (HTTP '+r.status+'). No local data was changed.');
    const f=new File([await r.blob()],'CloudSync.zip',{type:'application/zip'});
    window.JACKOS_CLOUD_SYNC_MODE=true;
    let result;
    try{result=await Backup_restoreCloud(f,p,{recoveryFlow:true});}finally{window.JACKOS_CLOUD_SYNC_MODE=false;}
    if(!result?.ok){
      if(result?.cancelled)return {recoveryCancelled:true,message:result.message||'Cloud restore was cancelled. No data was changed.'};
      throw new Error(result?.message||'Cloud backup was not restored.');
    }
    localStorage.setItem('jackosActivated','true');
    localStorage.setItem('jackosActivationKey',a.key||localStorage.getItem('jackosActivationKey')||'');
    localStorage.setItem('jackosEdition',a.edition||localStorage.getItem('jackosEdition')||'Home');
    localStorage.setItem('jackosUpgradeAllowed',String(!!a.upgrade));
    localStorage.setItem('jackosActivationData',JSON.stringify(a));
    localStorage.setItem('jackosCloudSyncPath',a.cloudSync||'');
    JACKOS_EDITION=a.edition||'Home';
    Users_migrate();
    return {recoveryRestart:true,message:'Cloud backup restored successfully. Activation details were reinstated; restarting JackOS…',delay:1400};
  }

  async function safe(){
    sessionStorage.setItem('jackosSafeModeBoot','true');
    localStorage.removeItem(SAFE);
    sessionStorage.removeItem('jackosRecoveryBoot');sessionStorage.removeItem('jackosRecoveryEntered');
    return {recoveryRestart:true,message:'Safe Mode has been enabled for this browser tab. JackOS is restarting into a restricted session…',delay:900};
  }

  function restart(){
    document.body.classList.remove('jackos-recovery-active');document.documentElement.classList.remove('jackos-recovery-active');
    sessionStorage.removeItem('jackosRecoveryEntered');sessionStorage.removeItem('jackosRecoveryBoot');sessionStorage.removeItem('jackosSafeModeBoot');localStorage.removeItem(SAFE);
    const overlay=document.getElementById('overlay');
    if(overlay){overlay.innerHTML='<div class="power-screen"><div class="power-spinner" aria-hidden="true"></div><div class="power-title">Restarting JackOS</div><div class="power-subtitle">Leaving Recovery and returning to normal startup…</div></div>';overlay.style.display='flex';overlay.style.alignItems='center';overlay.style.justifyContent='center';overlay.style.color='#fff';}
    document.body.classList.add('jackos-power-transition');setTimeout(()=>location.reload(),900);
    return {recoveryInteractive:true,message:'Restart requested. Returning to normal startup…'};
  }

  function shutdown(){
    const home=document.getElementById('recoveryHome'),p=document.getElementById('recoveryPrompt');
    if(home)home.hidden=true;
    if(p){p.hidden=false;p.innerHTML='<div class="recovery-key-icon">⏻</div><h1>JackOS is shut down</h1><p>Shutdown completed. No JackOS apps are running. You may close this browser tab.</p><button class="btn" onclick="Recovery_action(\'restart\')">Restart JackOS</button>';}
    status('Shutdown: Recovery has stopped. Close this tab or choose Restart JackOS to return to startup.','success');
    return {recoveryInteractive:true,message:'Shutdown screen is displayed.'};
  }

  async function handle(a){
    try{
      if(a==='diagnostics')return await runReported('Diagnostic Mode',diagnostics);
      if(a==='startup')return bootstrap(startup,'Startup Repair');
      if(a==='backup')return bootstrap(backup,'Restore Backup');
      if(a==='cloud')return bootstrap(cloud,'Cloud Sync Restore');
      if(a==='users')return bootstrap(users,'Repair User Accounts');
      if(a==='apps')return bootstrap(apps,'Repair Applications');
      if(a==='safe')return await runReported('Safe Mode',safe);
      if(a==='temp')return await runReported('Clear Temporary Data',temp);
      if(a==='reset')return showDestructiveGate(reset,'Reset JackOS');
      if(a==='erase')return showDestructiveGate(eraseEverything,'Erase Everything');
      if(a==='restart')return restart();
      if(a==='shutdown')return shutdown();
      throw new Error('Unknown Recovery action: '+String(a));
    }catch(err){
      console.error('JackOS Recovery action failed:',a,err);
      status((({startup:'Startup Repair',backup:'Restore Backup',cloud:'Cloud Sync Restore',users:'Repair User Accounts',apps:'Repair Applications',safe:'Safe Mode',temp:'Clear Temporary Data',reset:'Reset JackOS',erase:'Erase Everything'})[a]||'Recovery action')+': Failed — '+(err?.message||String(err)),'error');
    }
  }
  window.Recovery_action=(action)=>handle(String(action||''));window.Recovery_report=(message,kind='')=>status(message,kind);
  window.Recovery_isSafeMode=()=>localStorage.getItem(SAFE)==='true'||sessionStorage.getItem('jackosSafeModeBoot')==='true';window.Recovery_shouldEnterSafeMode=()=>Recovery_isSafeMode();window.Recovery_bootPrompt=armOnRestart;window.Recovery_open=showHome;window.Recovery_enter=showHome;window.Recovery_requireBootstrap=bootstrap;window.Recovery_forgotAdmin=forgotAdmin;window.Recovery_generateKey=ensureRecoveryKey;window.Recovery_checkKeyDelivery=deliverRecoveryKeyMessage;
  ready(()=>{
    // Safe Mode is a tab-scoped boot restriction. It must not be cleared on page load.
  });
})();
