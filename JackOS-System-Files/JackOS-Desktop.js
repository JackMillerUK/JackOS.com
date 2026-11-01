//JackOS-Desktop.js
// ===== Desktop =====

const SCREENS=[
  'startup',

  'cloudSyncPrompt',
  'cloudSyncPassword',
  'cloudSyncReady',

  
  'editionReveal',
  'welcome',
  'setup',
  'editionConfig',
  'appInstall',
  'finalSetup',
  'login',
  'transition',
  'desktop',
  'recoveryScreen'
];
let DesktopActiveLayoutUser='';
let DesktopRefreshSequence=0;
const DesktopState={
  selectedEntry:null,
  draggingIcon:null,
  dragId:null,
  dragOffsetX:0,
  dragOffsetY:0,
  dragSession:null,
  nativeDrag:null,
  dropTarget:null,
  suppressOpenUntil:0
};
const DesktopGrid={startX:20,startY:20,colWidth:90,rowHeight:100};

function show(id, fade=false){ const target=document.getElementById(id); if(!target) return; if(fade){ const f=document.getElementById('fadeOverlay'); f.classList.add('show'); setTimeout(()=>{ SCREENS.forEach(s=>{const el=document.getElementById(s); if(el) el.classList.remove('active');}); target.classList.add('active'); setTimeout(()=>f.classList.remove('show'), 250); },220); } else { SCREENS.forEach(s=>{const el=document.getElementById(s); if(el) el.classList.remove('active');}); target.classList.add('active'); }
  

if(id==='desktop'){
  applySavedWallpaper();
  Desktop_UpdateEditionFeatures();
  const desktopUser=Desktop_setLayoutUser(currentUser || localStorage.getItem('jackosLastUser') || 'Guest');
  const refreshDesktop=async()=>{
    if(!target.classList.contains('active') || desktopUser!==Desktop_resolveLayoutUser()) return;
    try{
      Desktop_setLayoutUser(desktopUser);
      // Remove stale installed-app UI before placing this user's files; the scan below
      // rebuilds the installed-app icons using this user's own layout map.
      document.querySelectorAll('#desktop [data-installed-app="true"], #startMenu [data-installed-app="true"]').forEach(el=>el.remove());
      // Reapply in dependency order: built-in icons, user files, then installed apps.
      Desktop_applyUserLayout(desktopUser);
      await Desktop_refreshFiles(desktopUser);
      if(desktopUser!==Desktop_resolveLayoutUser()) return;
      if(typeof InstalledApps_scan==='function') await InstalledApps_scan();
      if(desktopUser!==Desktop_resolveLayoutUser()) return;
      Desktop_refreshTaskbar();
    }catch(err){console.warn('Desktop refresh failed:',err);}
  };
  // Wait until the desktop is visible so bounds are real, then refresh the signed-in user's view.
  setTimeout(refreshDesktop,fade?300:0);
}

if(id==='login'){ Login_resetFields(); Login_applyUser(); applyLoginWallpaper(); }
  if(id==='setup'){ Setup_open(); applyWallpaperTo('setup', localStorage.getItem('jackosWallpaperData') || localStorage.getItem('jackosWallpaper') || '#000'); }
  if(id==='transition'){ applyWallpaperTo('transition', localStorage.getItem('jackosWallpaperData') || localStorage.getItem('jackosWallpaper') || '#000'); }

}
// Startup
const Startup_mainText=document.getElementById('main-text');
window.JackOS_finishNormalBoot=()=>{
  if(document.getElementById('recoveryScreen')?.classList.contains('active')) return;
  if(document.body.classList.contains('jackos-recovery-active')) return;
  const activated=localStorage.getItem('jackosActivated')==='true';
  Users_migrate();
  if(activated && typeof Recovery_checkKeyDelivery==='function'){
    Promise.resolve().then(()=>Recovery_checkKeyDelivery()).catch(err=>console.warn('Recovery key delivery failed',err));
  }
  if(activated){
    if(Users_hasAny()) show('login',true);
    else if(typeof JackOS_OOBE_start==='function') JackOS_OOBE_start();
    else show('setup',true);
  }else{
    const popup=document.getElementById('popup');if(popup)popup.style.display='block';
  }
};

window.addEventListener('load', ()=>{
  const recoveryBoot=sessionStorage.getItem('jackosRecoveryBoot')==='true';
  if(!recoveryBoot){
    sessionStorage.removeItem('jackosRecoveryEntered');
    document.body.classList.remove('jackos-recovery-active');
    document.documentElement.classList.remove('jackos-recovery-active');
    const recovery=document.getElementById('recoveryScreen');
    if(recovery){ recovery.classList.remove('active'); recovery.hidden=true; recovery.style.display='none'; }
  }

  if(recoveryBoot){
    // Recovery boot deliberately holds the monkey boot screen in place.
    // Recovery.js owns the transition from this frozen boot into Recovery.
    if(Startup_mainText){
      Startup_mainText.style.transition='none';
      Startup_mainText.style.opacity='1';
    }
    setTimeout(()=>{ if(typeof Recovery_bootPrompt==='function') Recovery_bootPrompt(); }, 80);
    return;
  }

  setTimeout(()=>Startup_mainText && (Startup_mainText.style.opacity=1), 120);
  setTimeout(()=>{
    if(Startup_mainText) Startup_mainText.style.opacity=0;
    setTimeout(()=>window.JackOS_finishNormalBoot?.(),500);
  },1500);
});

let CloudSyncInfo = null;
let JackOSCurrentActivation =
  null;

async function Startup_checkKey(){
  const input=document.getElementById('activation-key');
  const msg=document.getElementById('activationMsg');
  const key=(input?.value||'').trim();
  const setMsg=(text,kind='')=>{ if(msg){ msg.textContent=text; msg.className='oobe-message '+kind; } };
  if(!key){ setMsg('Enter your activation key.','error'); input?.focus(); return; }
  setMsg('Checking your activation key…','loading');
  try{
    const response=await fetch('../JackOS-Server-Files/Activation-Keys/Activation.json',{cache:'no-store'});
    if(!response.ok) throw new Error('The activation service is unavailable right now.');
    const data=await response.json();
    const licence=(data.keys||[]).find(item=>item.key===key);
    if(!licence){ setMsg('That activation key is not valid. Check it and try again.','error'); return; }
    if(

  typeof licence.block !==
  'boolean'

  ||

  typeof licence[
    'block-pass'
  ] !== 'string'

){

  setMsg(
    'Invalid activation key.',
    'error'
  );

  return;

}
    localStorage.setItem('jackosActivated','true');
    localStorage.setItem('jackosActivationKey',licence.key);
    localStorage.setItem('jackosEdition',licence.edition);
    localStorage.setItem('jackosUpgradeAllowed',String(!!licence.upgrade));
    localStorage.setItem('jackosActivationDate',new Date().toISOString());

    JackOSCurrentActivation =
  licence;
  localStorage.setItem(
  'jackosActivationData',
  JSON.stringify(
    licence
  )
);

    localStorage.removeItem('jackosOobeComplete');
    localStorage.removeItem('jackosOobeStage');
    JACKOS_EDITION=licence.edition;
    localStorage.setItem(
  'jackosCloudSyncPath',
  licence.cloudSync || ''
);
    CloudSyncInfo = {
  licence,
  activationUrl:
    '../JackOS-Server-Files/Activation-Keys/Activation.json'
};
if(

  licence.block

  &&

  !JackOS_IsTemporarilyUnlocked()

){

  JackOS_ShowBlockedScreen();

  return;

}

if(
  licence.cloudSync
){

  show(
    'cloudSyncPrompt',
    true
  );

  return;

}

Users_migrate();

if(Users_hasAny())
  show('login',true);
else if(typeof JackOS_OOBE_start==='function')
  JackOS_OOBE_start();
else
  show('setup',true);
  }catch(error){ setMsg(error?.message||'Activation failed. Please try again.','error'); }
}
function JackOS_IsTemporarilyUnlocked(){

  const unlockUntil =
    Number(
      localStorage.getItem(
        'jackosBlockUnlockUntil'
      ) || 0
    );

  return Date.now() < unlockUntil;

}

function JackOS_ShowBlockedScreen(){

  document.getElementById(
    'blockedPassword'
  ).value='';

  document.getElementById(
    'blockedMessage'
  ).textContent='';

  show(
    'blockedScreen',
    true
  );

}
function JackOS_BlockUnlock(){

  const password =
    document.getElementById(
      'blockedPassword'
    ).value;

  const activation =
    JSON.parse(
      localStorage.getItem(
        'jackosActivationData'
      ) || 'null'
    );

  if(!activation)
    return;

  if(
    password ===
    activation['block-pass']
  ){

    localStorage.setItem(
      'jackosBlockUnlockUntil',
      String(
        Date.now() +
        (
          15 *
          60 *
          1000
        )
      )
    );

    show(
      'accessGrantedScreen',
      true
    );

    setTimeout(()=>{

      if(
        activation.cloudSync
      ){

        show(
          'cloudSyncPrompt',
          true
        );

      }else{

        Users_migrate();

        if(
          Users_hasAny()
        ){
          show(
            'login',
            true
          );
        }else{
          show(
            'setup',
            true
          );
        }

      }

    },2500);

    return;

  }

  let attempts =
    Number(
      localStorage.getItem(
        'jackosBlockAttempts'
      ) || 0
    );

  attempts++;

  localStorage.setItem(
    'jackosBlockAttempts',
    attempts
  );

  document.getElementById(
    'blockedDeniedText'
  ).textContent =

`Security verification failed.

The supplied unlock password was incorrect.

Repeated unauthorised access attempts may result in a permanent ban of this JackOS activation key.

If you believe this is an error, please contact Team JackOS.

Attempt ${attempts} of 5`;

  if(attempts >= 5){

    localStorage.setItem(
      'jackosLocked',
      'true'
    );

    show(
      'jackosLockedScreen',
      true
    );

    return;

  }

  show(
    'accessDeniedScreen',
    true
  );

  setTimeout(()=>{

    JackOS_ShowBlockedScreen();

  },4000);

}
async function JackOS_BlockRefresh(){

  const msg =
    document.getElementById(
      'blockedMessage'
    );

  msg.textContent =
    'Checking Activation Keys...';

  try{

    const response =
      await fetch(
        '../JackOS-Server-Files/Activation-Keys/Activation.json',
        {
          cache:'no-store'
        }
      );

    if(!response.ok){

      throw new Error(
        'Unable to check activation keys.'
      );

    }

    const data =
      await response.json();

    const key =
      localStorage.getItem(
        'jackosActivationKey'
      );

    const licence =
      (data.keys || [])
      .find(
        item =>
          item.key === key
      );

    if(!licence){

      msg.textContent =
        'Activation key not found.';

      return;

    }

    localStorage.setItem(
      'jackosActivationData',
      JSON.stringify(
        licence
      )
    );

    JackOSCurrentActivation =
      licence;

    if(
      licence.block === false
    ){

      show(
        'accessGrantedScreen',
        true
      );

      setTimeout(()=>{

        Users_migrate();

        if(
          Users_hasAny()
        ){
          show(
            'login',
            true
          );
        }else{
          show(
            'setup',
            true
          );
        }

      },2500);

      return;

    }

    msg.textContent =
      'Status checked ✓ Key remains banned.';

  }catch(error){

    msg.textContent =
      error.message ||
      'Unable to check activation keys.';

  }

}
async function JackOS_LockedRefresh(){

  const msg =
    document.getElementById(
      'lockedRefreshMsg'
    );

  const btn =
    document.getElementById(
      'lockedRefreshBtn'
    );

  if(btn)
    btn.disabled = true;

  msg.textContent =
    'Checking Activation Keys...';

  try{

    const response =
      await fetch(
        '../JackOS-Server-Files/Activation-Keys/Activation.json',
        {
          cache:'no-store'
        }
      );

    if(!response.ok){

      throw new Error(
        'Unable to check activation keys.'
      );

    }

    const data =
      await response.json();

    const key =
      localStorage.getItem(
        'jackosActivationKey'
      );

    const licence =
      (data.keys || [])
      .find(
        item =>
          item.key === key
      );

    if(
      licence &&
      licence.block === false
    ){

      localStorage.removeItem(
        'jackosLocked'
      );

      localStorage.removeItem(
        'jackosBlockAttempts'
      );

      localStorage.setItem(
        'jackosActivationData',
        JSON.stringify(
          licence
        )
      );

      show(
        'accessGrantedScreen',
        true
      );

      setTimeout(()=>{

        Users_migrate();

        if(
          Users_hasAny()
        ){
          show(
            'login',
            true
          );
        }else{
          show(
            'setup',
            true
          );
        }

      },2500);

      return;

    }

    msg.textContent =
      'Status checked ✓ Key remains banned.';

  }catch(error){

    msg.textContent =
      error.message ||
      'Unable to check activation keys.';

  }

  if(btn)
    btn.disabled = false;

}
function Startup_continueWithoutActivation(){
  const ok=window.confirm('JackOS can continue in limited Home mode without activation.\n\nServer features, App Store access and cloud features will remain unavailable.\n\nContinue?');
  if(!ok) return;
  localStorage.setItem('jackosActivated','false');
  localStorage.setItem('jackosEdition','Home');
  localStorage.removeItem('jackosOobeStage');
  localStorage.removeItem('jackosActivationKey');
  localStorage.removeItem('jackosActivationDate');
  localStorage.removeItem('jackosUpgradeAllowed');
  JACKOS_EDITION='Home';
  Users_migrate();
  if(Users_hasAny()) show('login',true);
  else if(typeof JackOS_OOBE_start==='function') JackOS_OOBE_start();
  else show('setup',true);
}
function CloudSync_skip(){

  Users_migrate();

  if(
    typeof JackOS_OOBE_start ===
    'function'
  ){
    JackOS_OOBE_start();
  }else{
    show(
      'setup',
      true
    );
  }

}

function CloudSync_begin(){

  show(
    'cloudSyncPassword',
    true
  );

}


async function CloudSync_backToPassword(){

  const ok =
    confirm(
      'Are you sure?\n\n' +
      'All restored cloud data will be removed and you will return to the Cloud Sync screen.'
    );

  if(!ok)
    return;

  try{

    localStorage.clear();

    await Backup_clearOPFS();

    localStorage.setItem(
      'jackosActivated',
      'true'
    );

    localStorage.setItem(
      'jackosActivationKey',
      CloudSyncInfo.licence.key
    );

    localStorage.setItem(
      'jackosEdition',
      CloudSyncInfo.licence.edition
    );

    localStorage.setItem(
      'jackosUpgradeAllowed',
      String(
        !!CloudSyncInfo.licence.upgrade
      )
    );

    localStorage.setItem(
      'jackosActivationDate',
      new Date().toISOString()
    );

    JACKOS_EDITION =
      CloudSyncInfo.licence.edition;

  }catch(error){

    console.error(error);

  }

  show(
    'cloudSyncPrompt',
    true
  );

}
function CloudSync_backToPrompt(){

  const input =
    document.getElementById(
      'cloudSyncPasswordInput'
    );

  const msg =
    document.getElementById(
      'cloudSyncPasswordMsg'
    );

  if(input)
    input.value='';

  if(msg)
    msg.textContent='';

  show(
    'cloudSyncPrompt',
    true
  );

}

function CloudSync_finish(){
  // Cloud restore is a completed activation path. Do not send the user
  // through OOBE again: the restored backup already contains the account
  // state. A reload lets the normal startup path rebuild the UI and land on
  // Login with the restored users.
  if(CloudSyncInfo?.licence){
    const licence=CloudSyncInfo.licence;
    localStorage.setItem('jackosActivated','true');
    localStorage.setItem('jackosActivationKey',licence.key||'');
    localStorage.setItem('jackosActivationData',JSON.stringify(licence));
    localStorage.setItem('jackosEdition',licence.edition||'Home');
    localStorage.setItem('jackosUpgradeAllowed',String(!!licence.upgrade));
    localStorage.setItem('jackosActivationDate',new Date().toISOString());
    JACKOS_EDITION=licence.edition||'Home';
  }
  Users_migrate();
  location.reload();
}
async function CloudSync_restore(){

  const msg =
    document.getElementById(
      'cloudSyncPasswordMsg'
    );

  const password =
    document.getElementById(
      'cloudSyncPasswordInput'
    ).value;

  if(
    !password
  ){

    msg.textContent =
      'Enter a password.';

    return;

  }

  try{

    msg.textContent =
      'Downloading backup...';

    const activationUrl =
  new URL(
    '../JackOS-Server-Files/Activation-Keys/Activation.json',
    window.location.href
  );

const syncUrl =
  new URL(
    CloudSyncInfo.licence.cloudSync,
    activationUrl
  );

    const response =
      await fetch(
        syncUrl.href,
        {
          cache:'no-store'
        }
      );

    if(
      !response.ok
    ){
      throw new Error(
        'Cloud backup missing.'
      );
    }

    const blob =
      await response.blob();

    const file =
      new File(
        [blob],
        'CloudSync.zip',
        {
          type:
          'application/zip'
        }
      );

    msg.textContent =
      'Restoring JackOS...';
window.JACKOS_CLOUD_SYNC_MODE =
  true;

try{

  await Backup_restoreCloud(
    file,
    password
  );

}finally{

  window.JACKOS_CLOUD_SYNC_MODE =
    false;

}

    // Backup_restoreCloud intentionally excludes activation/licence keys.
    // Restore them from the licence that was just validated so a synced
    // machine remains activated after the restore. Then restart directly
    // into the normal Login path.
    const licence=CloudSyncInfo?.licence;
    if(!licence) throw new Error('Activation licence is unavailable.');
    localStorage.setItem('jackosActivated','true');
    localStorage.setItem('jackosActivationKey',licence.key||'');
    localStorage.setItem('jackosActivationData',JSON.stringify(licence));
    localStorage.setItem('jackosEdition',licence.edition||'Home');
    localStorage.setItem('jackosUpgradeAllowed',String(!!licence.upgrade));
    localStorage.setItem('jackosActivationDate',new Date().toISOString());
    localStorage.setItem('jackosCloudSyncPath',licence.cloudSync||'');
    JACKOS_EDITION=licence.edition||'Home';
    Users_migrate();
    location.reload();

  }catch(error){

    msg.textContent =
      error.message ||
      'Cloud sync failed.';

  }

}
function Desktop_toggleStartMenu(){ 
  const relockBtn =
  document.getElementById(
    'relockJackOSBtn'
  );

if(relockBtn){

  relockBtn.style.display =
    JackOS_IsTemporarilyUnlocked()
      ? ''
      : 'none';

}
  const sm=document.getElementById('startMenu'); if(sm){ sm.classList.toggle('show'); } 

}
function Desktop_hideStartMenu(){ const sm=document.getElementById('startMenu'); if(sm){ sm.classList.remove('show'); } }
document.addEventListener('click', (e)=>{ const sm=document.getElementById('startMenu'); const btn=e.target.closest('.start-btn'); const insideMenu=e.target.closest('#startMenu'); if(sm && !btn && !insideMenu){ sm.classList.remove('show'); } });

function Desktop_lock(){

  Desktop_hideStartMenu();
  // Locking changes the active account/session boundary: no app window may
  // remain visible behind the next account's desktop.
  try{ Desktop_closeAllApps(); }catch(e){}
  try{ Notifications_close?.(); }catch(e){}

  try{

    MusicState.audio?.pause();

  }catch(e){}

  show('login', true);

}
function Desktop_logout(){

  Desktop_hideStartMenu();

  Desktop_closeAllApps();

  show('login', true);

}

function Desktop_showOverlay(text, cb, duration=1200){
  // Normal completion/status overlays used to take over the entire screen
  // with a black background. Those are now native JackOS/browser alerts.
  // Power-transition screens (Restarting, Shutting Down, Resetting, etc.)
  // remain full-screen because they are deliberate system transitions.
  const raw=String(text ?? '');
  if(!/power-screen|power-title|power-spinner/i.test(raw)){
    const holder=document.createElement('div');
    holder.innerHTML=raw;
    const message=(holder.innerText||holder.textContent||raw).replace(/\n{3,}/g,'\n\n').trim();
    try{ window.alert(message); }catch(_){ }
    if(cb) cb();
    return;
  }

  const o=document.getElementById('overlay');
  if(!o) return cb?.();
  o.innerHTML=text;
  o.style.display='flex';
  o.style.pointerEvents='auto';
  document.body.classList.add('jackos-power-transition');
  document.documentElement.classList.add('jackos-power-transition');
  setTimeout(()=>{
    o.style.display='none';
    document.body.classList.remove('jackos-power-transition');
    document.documentElement.classList.remove('jackos-power-transition');
    if(cb) cb();
  },duration);
}
function Desktop_powerBoot(){ sessionStorage.removeItem('jackosRecoveryBoot'); location.reload(); }
function Desktop_shutdown(){
  Desktop_hideStartMenu();
  try{ Desktop_closeAllApps(); }catch(e){}
  try{ Notifications_close?.(); }catch(e){}
  try{ MusicState.audio?.pause(); }catch(e){}
  currentUser='';
  localStorage.removeItem('jackosLastUser');
  Desktop_showOverlay('<div class=\"power-screen\"><div class=\"power-icon\">⏼</div><div>Shutting Down</div></div>', ()=>{ Desktop_powerBoot(); },1800);
}
function Desktop_restart(){
  Desktop_hideStartMenu();
  // A restart is a real session boundary: close every app/window, stop
  // media, release pointer lock, and discard the current account session.
  try{ document.exitPointerLock?.(); }catch(e){}
  try{ Desktop_closeAllApps(); }catch(e){}
  try{ Notifications_close?.(); }catch(e){}
  try{ MusicState.audio?.pause(); }catch(e){}
  try{ window.stop?.(); }catch(e){}
  currentUser='';
  localStorage.removeItem('jackosLastUser');
  sessionStorage.setItem('jackosRecoveryBoot','true');
  Desktop_showOverlay('<div class=\"power-screen\"><div class=\"power-spinner\" aria-hidden=\"true\"></div><div class=\"power-title\">Restarting</div><div class=\"power-subtitle\">JackOS is restarting…</div></div>', ()=>{ location.reload(); },2600);
}
function Desktop_sleep(){ Desktop_hideStartMenu(); Desktop_showOverlay('◐<br>Sleeping...', ()=>{ Desktop_powerBoot(); }); }

//Start Menu Power Clean Up Helpers


function Desktop_closeAllApps(){

  const windows=[...document.querySelectorAll(
    '#explorer,\
#browserWin,\
#calcApp,\
#jcamApp,\
#settingsWin,\
#photosApp,\
#musicApp,\
#gamesApp,\
#appStoreApp,\
#messagesWin,\
#flappyApp,\
#tetrisApp,\
#snakeApp,\
#installedAppRuntime, .installed-app-window'
  )];

  windows.forEach(win=>{
    if(typeof WindowManager!=='undefined'&&WindowManager.get(win.id)){
      WindowManager.close(win.id);
      return;
    }

    const appId=typeof Desktop_windowAppId==='function'?Desktop_windowAppId(win.id):win.id;
    try{
      if(typeof APP_REGISTRY!=='undefined') APP_REGISTRY[appId]?.close?.();
    }catch(error){
      console.error(`Unable to close ${win.id}.`,error);
    }
    if(typeof WindowManager!=='undefined') WindowManager.terminateContent(win);
    const installed=typeof InstalledApps_appForWindow==='function'&&InstalledApps_appForWindow(win.id);
    if(installed&&typeof InstalledApps_removeWindow==='function') InstalledApps_removeWindow(installed.fileName);
    else{
      win.style.display='none';
      win.classList.remove('window-minimized','window-maximized');
    }

  });

  DesktopMinimisedApps.clear();

  if(typeof InstalledAppsState!=='undefined'){
    [...InstalledAppsState.windows.keys()].forEach(InstalledApps_removeWindow);
  }

  Explorer_clearPreview();

  Desktop_refreshTaskbar();

}









// ===== Admin/Account auth guards =====
let AdminPendingAction = null;
let AccountPendingAction = null;

function currentUserObj(){ return Users_find(currentUser)||null; }
function isCurrentAdmin(){ const u=currentUserObj(); return !!(u && u.role==='admin'); }
function Admin_require(action){

  AdminPendingAction = action;

  const dlg =
    document.getElementById(
      'adminAuthDialog'
    );

  document.getElementById(
    'adminAuthName'
  ).value='';

  document.getElementById(
    'adminAuthPass'
  ).value='';

  document.getElementById(
    'adminAuthMsg'
  ).textContent='';

  dlg.style.display='flex';

}
function Admin_requireStrict(action, options={}){ // Always prompt for admin credentials
  AdminPendingAction = action; const dlg=document.getElementById('adminAuthDialog');
  const recoveryAuth=!!options?.allowRecoveryForgot;
  const forgot=document.getElementById('adminForgotRecovery');
  if(forgot) forgot.style.display=recoveryAuth?'inline-flex':'none';
  if(forgot) forgot.dataset.recoveryActionLabel=String(options?.recoveryForgotLabel||'this Recovery action');
  if(dlg){
    dlg.classList.toggle('recovery-modal-on-top',recoveryAuth);
    if(recoveryAuth){dlg.style.zIndex='600000';dlg.style.pointerEvents='auto';}
    else{dlg.style.removeProperty('z-index');dlg.style.removeProperty('pointer-events');}
  }
  document.getElementById('adminAuthName').value='';
  document.getElementById('adminAuthPass').value='';
  document.getElementById('adminAuthMsg').textContent='';
  dlg.style.display='flex';
}
function Admin_getPendingRecoveryAction(){ return AdminPendingAction; }
function Admin_getPendingRecoveryLabel(){ return document.getElementById('adminForgotRecovery')?.dataset.recoveryActionLabel || 'this Recovery action'; }

function Admin_cancel(){ AdminPendingAction=null; Admin_closeDialog(); if(document.getElementById('settingsRestrictionsPanel')?.style.display==='block') window.JackOSRestrictions_open?.(); if(document.body.classList.contains('jackos-recovery-active')&&typeof Recovery_report==='function') Recovery_report('Recovery action cancelled at administrator verification. No changes were made.',''); }

function Account_require(action){

  AccountPendingAction =
    action;

  document.getElementById(
    'accountAuthName'
  ).value='';

  document.getElementById(
    'accountAuthPass'
  ).value='';

  document.getElementById(
    'accountAuthMsg'
  ).textContent='';

  document.getElementById(
    'accountAuthDialog'
  ).style.display='flex';

}

function Account_cancel(){

  AccountPendingAction =
    null;

  document.getElementById(
    'accountAuthDialog'
  ).style.display='none';

}

function Account_verifyAndContinue(){

  const name =
    document.getElementById(
      'accountAuthName'
    ).value.trim();

  const pass =
    document.getElementById(
      'accountAuthPass'
    ).value;

  const msg =
    document.getElementById(
      'accountAuthMsg'
    );

  const user =
    Users_find(currentUser);

  if(
    name !== currentUser ||
    !user ||
    user.pass !== pass
  ){

    msg.textContent =
      'Incorrect Credentials.';

    return;

  }

  document.getElementById(
    'accountAuthDialog'
  ).style.display='none';

  const fn =
    AccountPendingAction;

  AccountPendingAction =
    null;

  if(fn)
    fn();

}


function Admin_closeDialog(){
  const forgot=document.getElementById('adminForgotRecovery');
  if(forgot){ forgot.style.display='none'; forgot.removeAttribute('data-recovery-action-label'); }
  const dlg=document.getElementById('adminAuthDialog');
  if(dlg){
    dlg.style.display='none';
    dlg.classList.remove('recovery-modal-on-top');
    dlg.style.removeProperty('z-index');
    dlg.style.removeProperty('pointer-events');
  }
}

function Admin_verifyAndContinue(){

  const name =
    (
      document.getElementById(
        'adminAuthName'
      ).value || ''
    ).trim();

  const pass =
    document.getElementById(
      'adminAuthPass'
    ).value || '';

  const msg =
    document.getElementById(
      'adminAuthMsg'
    );

  const user =
    Users_find(name);

  if(
    !user ||
    user.role!=='admin'
  ){

    msg.textContent =
      'Admin user not found';

    return;

  }

  if(isCurrentAdmin()){

    if(name !== currentUser){

      msg.textContent =
        'The logged in Admin\'s credentials are required to proceed.';

      return;

    }

    if(user.pass !== pass){

      msg.textContent =
        'Incorrect Credentials.';

      return;

    }

  }else{

    if(user.pass !== pass){

      msg.textContent =
        'Incorrect Credentials.';

      return;

    }

  }

  const fn = AdminPendingAction;
  AdminPendingAction = null;

  // Close the authentication sheet before the requested Recovery action
  // starts, and guarantee it stays closed when the action finishes.
  Admin_closeDialog();

  if(fn){
    try{
      const result=fn();
      if(result && typeof result.finally==='function') result.finally(Admin_closeDialog);
      else Admin_closeDialog();
    }catch(err){
      Admin_closeDialog();
      throw err;
    }
  }else{
    Admin_closeDialog();
  }

}
// ===== Guarded Reset (always requires admin auth) =====
function Desktop_resetJackOS_guarded(){ Desktop_hideStartMenu(); Admin_requireStrict(async ()=>{ const ok=confirm('This will erase all JackOS data and cannot be undone. Continue?'); if(!ok) return; try{ localStorage.clear(); if(navigator.storage && navigator.storage.getDirectory){ const root = await navigator.storage.getDirectory(); for(const name of ['JackOSDrive','Applications','Users','JackOSDrive']){ try { await root.removeEntry(name, {recursive:true}); } catch(e){} } } }catch(e){ console.warn('Reset error', e); } Desktop_showOverlay('🧹<br>Resetting JackOS…', ()=> location.reload()); }); }
// ===== Wallpaper helpers =====
function applyWallpaperTo(elId, url){ const el=document.getElementById(elId); if(!el) return; const value=url || '#000'; el.style.background = value.startsWith('#') ? value : `url('${value}') no-repeat center center fixed`; el.style.backgroundSize = value.startsWith('#') ? 'auto' : 'cover'; }
function applySavedWallpaper(){ const data=localStorage.getItem('jackosWallpaperData'); const saved=localStorage.getItem('jackosWallpaper'); const url = data || saved || '#000'; applyWallpaperTo('desktop', url); applyWallpaperTo('login', url); }
function applyLoginWallpaper(){ const data=localStorage.getItem('jackosWallpaperData'); const saved=localStorage.getItem('jackosWallpaper'); const url = data || saved || '#000'; applyWallpaperTo('login', url); }
function Desktop_setWallpaper(image){ localStorage.setItem('jackosWallpaper', image); localStorage.removeItem('jackosWallpaperData'); applySavedWallpaper(); }
function Desktop_setWallpaperFromData(dataUrl){ localStorage.setItem('jackosWallpaperData', dataUrl); applySavedWallpaper(); }
// Clock & Date
(function(){ const clock=document.getElementById('clock'); const dateEl=document.getElementById('date'); function updClock(){ const now=new Date(); clock.textContent=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`; } function updDate(){ const now=new Date(); const opts={ day:'numeric', month:'short', year:'numeric' }; dateEl.textContent = now.toLocaleDateString('en-GB', opts); } updClock(); updDate(); setInterval(updClock, 1000); setInterval(updDate, 60*1000); })();
// ===== Login with Transition + ENTER-to-login =====
let currentUser = localStorage.getItem('jackosLastUser') || (Users_all().find(u=>!u.guest)?.name || '');
try{ Object.defineProperty(window,'currentUser',{configurable:true,get:()=>currentUser,set:v=>{currentUser=String(v??'');}}); }catch(_){ window.currentUser=currentUser; }
function Login_renderUserButtons(){ const cont=document.getElementById('userSwitch'); if(!cont) return; const users=Users_all().filter(u=>!u.guest); cont.innerHTML=''; users.forEach(u=>{ const btn=document.createElement('button'); btn.className='user-btn'+(u.name===currentUser? ' active':''); btn.textContent=u.name; btn.dataset.user=u.name; btn.addEventListener('click', ()=> Login_switchUser(u.name)); cont.appendChild(btn); }); cont.style.display = users.length? 'flex':'none'; const guestBtn=document.getElementById('guestLoginBtn'); if(guestBtn) guestBtn.style.display=Users_guest()?'block':'none'; }
function Login_applyUser(){ const cu=document.getElementById('current-user'); if(!currentUser || Users_find(currentUser)?.guest){ const user=Users_all().find(u=>!u.guest); currentUser=user?.name||''; } if(cu) cu.textContent=currentUser || '--'; Login_renderUserButtons(); }
function Login_switchUser(u){ currentUser=u; localStorage.setItem('jackosLastUser', currentUser); Login_applyUser(); const m=document.getElementById('message'); if(m) m.textContent=''; const p=document.getElementById('password'); if(p){ p.value=''; try{ p.focus(); }catch(e){} } }
function Login_resetFields(){ const p=document.getElementById('password'); const m=document.getElementById('message'); if(p) p.value=''; if(m){ m.textContent=''; m.style.color=''; } }
function Login_guest(){ const guest=Users_guest(); if(!guest) return; currentUser=guest.name; localStorage.setItem('jackosLastUser', currentUser); Login_enterDesktop(); }
function Login_enterDesktop(){
  Desktop_setLayoutUser(currentUser || localStorage.getItem('jackosLastUser') || 'Guest');
  UserData_resetRuntime();
  localStorage.setItem('jackosLastUser',currentUser);
  try{ window.currentUser=currentUser; }catch(_){}
  try{ JackOSRestrictions_refreshVisibility?.(); }catch(_){}
  try{ Notifications_boot?.(); }catch(_){}
  try{ Desktop_refreshTaskbar(); }catch(_){}
  const title=document.getElementById('transTitle');
  if(title) title.textContent = 'Welcome '+currentUser;
  show('transition', true);

  setTimeout(()=>{
    show('desktop', true);
    setTimeout(()=>{ Desktop_refreshForUser(currentUser).catch(err=>console.warn('Login desktop refresh failed:',err)); },320);
  },1400);
}


  function Login_login(){ const pwd=(document.getElementById('password')?.value)||''; const msg=document.getElementById('message'); const user=Users_find(currentUser);
  if(!user){ if(msg){ msg.style.color='salmon'; msg.textContent='No accounts yet -- run setup'; } show('setup', true); return; }
  if(user.guest && pwd===''){ Login_enterDesktop(); } else if(pwd && user.pass===pwd){ Login_enterDesktop(); } else { if(msg){ msg.style.color='salmon'; msg.textContent='Incorrect password'; } } }
ready(()=>{ const pw=document.getElementById('password'); if(pw){ pw.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); Login_login(); } }); } });
ready(Login_applyUser);

function Desktop_windowAppId(id){

  if(typeof id==='string'&&id.startsWith('installedApp-')){
    const installed=typeof InstalledApps_appForWindow==='function'?InstalledApps_appForWindow(id):null;
    if(installed?.fileName) return 'installed:'+installed.fileName;
  }

  return ({
    explorer:'explorer',
    browserWin:'browser',
    calcApp:'calculator',
    jcamApp:'camera',
    settingsWin:'settings',
    photosApp:'photos',
    musicApp:'music',
    gamesApp:'games',
    appStoreApp:'appstore',
    messagesWin:'messages',
    flappyApp:'flappy',
    tetrisApp:'tetris',
    snakeApp:'snake'
  })[id] || id;

}

function Desktop_taskbarPinsKey(){
  return 'jackosTaskbarPins:'+UserData_key();
}

function Desktop_getTaskbarPins(){
  const key=Desktop_taskbarPinsKey();
  let pins=null;
  try{
    const raw=localStorage.getItem(key);
    if(raw!==null) pins=JSON.parse(raw);
  }catch(e){}

  // Migrate the old global setting once for the first/current user only.
  if(!Array.isArray(pins)){
    try{
      const legacy=JSON.parse(localStorage.getItem('jackosTaskbarPins')||'[]');
      pins=Array.isArray(legacy)?legacy:[];
      localStorage.setItem(key,JSON.stringify(pins));
    }catch(e){ pins=[]; }
  }

  // Always store canonical app IDs so a pinned app cannot duplicate itself
  // when its window ID differs from its launch/app ID.
  pins=[...new Set(pins.map(id=>Desktop_windowAppId(id)))];
  return pins;
}

function Desktop_setTaskbarPins(pins){
  const clean=[...new Set((Array.isArray(pins)?pins:[]).map(id=>Desktop_windowAppId(id)))];
  localStorage.setItem(Desktop_taskbarPinsKey(),JSON.stringify(clean));
  // Keep the legacy key out of the active path; it is no longer global.
  Desktop_refreshTaskbar();
}

function Desktop_appAvailable(id){
  const appId=Desktop_windowAppId(id);
  if(typeof appId==='string' && appId.startsWith('installed:')){
    const installed=InstalledAppsState?.byFile?.get?.(appId.slice(10));
    return !!installed && (typeof JackOSRestrictions_isAppAllowed!=='function'||JackOSRestrictions_isAppAllowed(installed,currentUser));
  }
  return (typeof JackOSRestrictions_isAppAllowed!=='function'||JackOSRestrictions_isAppAllowed(appId,currentUser)) && (appId!=='music'||Edition_IsPrivateOrPro());
}


function Desktop_appIcon(id){

 if(typeof InstalledApps_appForWindow==='function'){
    const installed=InstalledApps_appForWindow(id);
    if(installed) return InstalledApps_icon(installed);
  }
  if(typeof id==='string' && id.startsWith('installed:')){
    const installed=InstalledAppsState?.byFile?.get?.(id.slice(10));
    if(installed) return InstalledApps_icon(installed);
  }

 if(
    id === 'installedAppRuntime' &&
    InstalledAppActive
  ){
    return InstalledApps_icon(
      InstalledAppActive
    );
  }

  const source =
    document.querySelector(
      `#desktop .icon[data-app="${Desktop_windowAppId(id)}"] .icon-box`
    );

  if(source)
    return source.cloneNode(true);

  const icon =
    document.createElement('span');

  icon.textContent='▣';

  return icon;

}


function Desktop_appName(id){

  const names = {
    explorer: 'Explorer',
    browser: 'Browser',
    calculator: 'Calculator',
    camera: 'Camera',
    settings: 'Settings',
    photos: 'Photos',
    music: 'Music',
    games: 'Games',
    flappy: 'Flappy Bird',
    tetris: 'Tetris',
    snake: 'Snake',
    appstore: 'App Store',
    messages: 'Messages'
  };

  if(typeof id==='string' && id.startsWith('installed:')){
    const installed=InstalledAppsState?.byFile?.get?.(id.slice(10));
    return installed?.name || String(id.slice(10));
  }

  return (typeof InstalledApps_appForWindow==='function'&&InstalledApps_appForWindow(id)?.name)||names[id]||String(id);

}

//Bug Fix

const DesktopMinimisedApps = new Set();


// Desktop Windows Fix


const DesktopWindows = {

  z: 100,

  ids: [
    'explorer',
    'browserWin',
    'calcApp',
    'jcamApp',
    'settingsWin',
    'photosApp',
    'musicApp',
    'gamesApp',
    'appStoreApp',
    'messagesWin',
    'flappyApp',
    'tetrisApp',
    'snakeApp'
  ],

  names: {

    explorer: 'Explorer',
    browserWin: 'Browser',
    calcApp: 'Calculator',
    jcamApp: 'Camera',
    settingsWin: 'Settings',
    photosApp: 'Photos',
    musicApp: 'Music',
    gamesApp: 'Games',
    appStoreApp: 'App Store',
    messagesWin: 'Messages',

    flappyApp: 'Flappy Bird',
    tetrisApp: 'Tetris',
    snakeApp: 'Snake',

    installedAppRuntime: 'App'

  }

};



function Desktop_refreshTaskbar(){
  const bar=document.getElementById('taskbarApps');
  if(!bar) return;
  bar.innerHTML='';

  const pinned=Desktop_getTaskbarPins();
  const open=DesktopWindows.ids.filter(id=>{
    const win=document.getElementById(id);
    if(win) return getComputedStyle(win).display!=='none' || DesktopMinimisedApps.has(id);
    if(id.startsWith('installedApp-')){
      const fileName=InstalledAppsState.windowFiles.get(id);
      const installedWin=fileName?InstalledAppsState.windows.get(fileName):null;
      return !!installedWin && getComputedStyle(installedWin).display!=='none' && !DesktopMinimisedApps.has(id);
    }
    return false;
  });

  const openApps=open.map(id=>Desktop_windowAppId(id));
  const ids=[...new Set([...pinned.filter(Desktop_appAvailable),...openApps])];

  ids.forEach(id=>{
    let win=document.getElementById(id);
    if(!win){
      const map={games:'gamesApp',browser:'browserWin',calculator:'calcApp',camera:'jcamApp',settings:'settingsWin',photos:'photosApp',music:'musicApp',appstore:'appStoreApp',messages:'messagesWin',flappy:'flappyApp',tetris:'tetrisApp',snake:'snakeApp'};
      if(map[id]) win=document.getElementById(map[id]);
      if(id.startsWith('installed:')) win=InstalledAppsState.windows.get(id.slice(10))||null;
    }

    if(!Desktop_appAvailable(id)) return;

    const button=document.createElement('button');
    const active=openApps.includes(id);
    button.className='taskbar-app'+(active?' active':'');
    button.setAttribute('aria-label',Desktop_appName(id));
    button.title=Desktop_appName(id);
    button.append(Desktop_appIcon(id));

    button.onclick=()=>{
      const restrictionApp=id.startsWith('installed:')?(InstalledAppsState?.byFile?.get?.(id.slice(10))||id):id;
      const gate=typeof JackOSRestrictions_canLaunchApp==='function'?JackOSRestrictions_canLaunchApp(restrictionApp,currentUser):{ok:true};
      if(!gate.ok){
        if(gate.reason==='screen-time')JackOSRestrictions_handleLockedApp?.(restrictionApp);
        else alert('This app is restricted for this account.');
        return;
      }
      if(id.startsWith('installed:')){
        Desktop_launch(id);
        return;
      }
      const target=win||document.getElementById(({games:'gamesApp',browser:'browserWin',calculator:'calcApp',camera:'jcamApp',settings:'settingsWin',photos:'photosApp',music:'musicApp',appstore:'appStoreApp',messages:'messagesWin',flappy:'flappyApp',tetris:'tetrisApp',snake:'snakeApp'})[id]||'');
      if(target && typeof WindowManager!=='undefined' && WindowManager.get(target.id)) WindowManager.show(target.id);
      else if(target){ DesktopMinimisedApps.delete(target.id); target.style.display='block'; target.classList.remove('window-minimized'); target.style.zIndex=++DesktopWindows.z; Desktop_refreshTaskbar(); }
      else Desktop_launch(id);
    };

    button.addEventListener('mouseenter',()=>{
      const tip=document.getElementById('taskbarTooltip');
      if(!tip) return;
      tip.textContent=Desktop_appName(id);
      tip.style.display='block';
      const rect=button.getBoundingClientRect();
      requestAnimationFrame(()=>{
        const tipRect=tip.getBoundingClientRect();
        tip.style.left=(rect.left+rect.width/2-tipRect.width/2)+'px';
        tip.style.top=(rect.top-tipRect.height-12)+'px';
      });
    });
    button.addEventListener('mouseleave',()=>{ const tip=document.getElementById('taskbarTooltip'); if(tip) tip.style.display='none'; });
    bar.append(button);
  });

  const user=document.getElementById('taskbarUser');
  if(user){
    user.textContent=JackOS_IsActivated()?('✓ '+JACKOS_EDITION+' '+(currentUser||'--')):('✖ -- '+(currentUser||'--'));
  }
  document.querySelector('#desktop .taskbar')?.classList.toggle('compact',localStorage.getItem('jackosTaskbarCompact')==='true');
}


function Desktop_searchApps(value){

  const results =
    document.getElementById(
      'taskbarSearchResults'
    );

  if(!results)
    return;

  results.innerHTML='';

  const query =
    value.trim().toLowerCase();

  if(!query){
    results.classList.remove('show');
    return;
  }

 // Built-in apps
DesktopWindows.ids
  .filter(id =>

    id !== 'installedAppRuntime' &&
    !id.startsWith('installedApp-') &&

    Desktop_appAvailable(id) &&
    (typeof JackOSRestrictions_isAppAllowed!=='function'||JackOSRestrictions_isAppAllowed(id,currentUser)) &&

    DesktopWindows.names[id]
      ?.toLowerCase()
      .includes(query)

  )
    .forEach(id => {

      const item =
        document.createElement('button');

      item.className =
        'taskbar-search-result';

      item.append(
        Desktop_appIcon(id),
        DesktopWindows.names[id]
      );

      item.onclick = () => {

        Desktop_launch(
          Desktop_windowAppId(id)
        );

        results.classList.remove('show');

        document.getElementById(
          'taskbarSearch'
        ).value='';

      };
      

      results.append(item);

    });

  // Installed apps
InstalledAppsState.apps
  .filter(app =>
    app.name?.toLowerCase().includes(query) &&
    (typeof JackOSRestrictions_isAppAllowed!=='function' || JackOSRestrictions_isAppAllowed(app,currentUser))
  )
  .forEach(app => {

    const item =
      document.createElement('button');

    item.className =
      'taskbar-search-result';

    const icon =
      InstalledApps_icon(app);

    const name =
      document.createElement('span');

    name.textContent =
      app.name;

    item.append(
      icon,
      name
    );

    item.onclick = () => {

      Desktop_hideStartMenu();

      Desktop_launch(
        'installed:' +
        app.fileName
      );

      results.classList.remove('show');

      document.getElementById(
        'taskbarSearch'
      ).value='';

    };

    results.append(item);

  });

  results.classList.toggle(
    'show',
    results.children.length > 0
  );

}



function Desktop_initWindows(){
  DesktopWindows.z=Math.max(DesktopWindows.z,100);
  DesktopWindows.ids.forEach(id=>{
    const win=document.getElementById(id);
    if(!win||win.dataset.windowReady) return;
    WindowManager.attach({id,title:Desktop_appName(id),element:win});
  });
}
ready(()=>{
  Desktop_initWindows();
  const hidden=Desktop_hiddenApps();
  document.querySelectorAll('#desktop .icon[data-app]').forEach(icon=>{
    if(hidden[icon.dataset.app]) icon.style.display='none';
    icon.style.position='absolute';
    icon.dataset.layoutId='app:'+icon.dataset.app;
    icon.style.cursor='pointer';
    Desktop_bindIconDrag(icon);
    if(!icon.dataset.desktopOpenBound){
      icon.dataset.desktopOpenBound='true';
      icon.addEventListener('dblclick',e=>{
        if(DesktopState.suppressOpenUntil>Date.now()) { e.preventDefault(); e.stopPropagation(); return; }
        e.preventDefault(); e.stopPropagation(); Desktop_launch(icon.dataset.app);
      });
    }
  });
  Desktop_setLayoutUser(currentUser || localStorage.getItem('jackosLastUser') || 'Guest');
  Desktop_applyUserLayout();
  const search=document.getElementById('taskbarSearch');
  search?.addEventListener('input',()=>Desktop_searchApps(search.value));
  const desktop=document.querySelector('#desktop > .desktop');
  Desktop_bindDragSurface();
  Desktop_bindGlobalPointerDrag();
  desktop?.addEventListener('click',()=>setTimeout(Desktop_refreshTaskbar,0));
  const desktopScreen=document.getElementById('desktop');
  desktopScreen?.addEventListener('contextmenu',e=>{
    // Only open the wallpaper menu on the empty wallpaper surface, never inside an app/window/icon.
    if(e.target===desktop || e.target===desktopScreen) Desktop_openWallpaperContextMenu(e);
  });
});
// ===== Setup (first account admin) =====
const SetupState = { list: [] };
function Setup_open(){ const msg=document.getElementById('setupMsg'); if(msg) msg.textContent=''; const stored=Users_all(); SetupState.list = Array.isArray(stored)&&stored.length? [...stored] : []; Setup_render(); }
function Setup_clearInputs(){ ['su-name','su-pass','su-pass2'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.value=''; } }); const name=document.getElementById('su-name'); try{ name && name.focus(); }catch(e){} }
function Setup_addGuest(){ if(Users_guest() || SetupState.list.some(u=>u.guest)){ const msg=document.getElementById('setupMsg'); if(msg) msg.textContent='A Guest account already exists'; return; } SetupState.list.push({name:'Guest', pass:'', role:'user', guest:true}); Setup_render(); }
function Setup_addUser(){ const name=(document.getElementById('su-name')?.value||'').trim(); const pass=(document.getElementById('su-pass')?.value||''); const pass2=(document.getElementById('su-pass2')?.value||''); const msg=document.getElementById('setupMsg'); if(!name){ msg.textContent='Enter a name'; return; } if(!pass){ msg.textContent='Enter a password'; return; } if(pass!==pass2){ msg.textContent='Passwords don\'t match'; return; } if(SetupState.list.find(u=>u.name.toLowerCase()===name.toLowerCase())){ msg.textContent='That name already exists'; return; } const role = (SetupState.list.length===0)? 'admin' : 'user'; SetupState.list.push({name, pass, role}); msg.textContent='Added '+name+' ✓' + (role==='admin'?' (Admin)':''); Setup_clearInputs(); Setup_render(); }
function Setup_remove(idx){ SetupState.list.splice(idx,1); Setup_render(); }
function Setup_render(){ const list=document.getElementById('setupList'); const btn=document.getElementById('setupFinishBtn'); if(list){ list.innerHTML=''; if(!SetupState.list.length){ list.innerHTML='<div style="opacity:.8;">No accounts yet. Add at least one.</div>'; } else { SetupState.list.forEach((u,i)=>{ const row=document.createElement('div'); row.className='setup-user'; const label=document.createElement('label'); label.innerHTML=`👤 <b>${u.name}</b> `; if(!u.guest){ const admin=document.createElement('input'); admin.type='checkbox'; admin.checked=u.role==='admin'; admin.setAttribute('aria-label',`Make ${u.name} admin`); admin.onchange=()=>{ u.role=admin.checked?'admin':'user'; if(!SetupState.list.some(x=>x.role==='admin')){ admin.checked=true; u.role='admin'; } Setup_render(); }; label.appendChild(admin); label.append(' Admin'); } else label.append(' Guest'); row.appendChild(label); const rm=document.createElement('button'); rm.className='btn danger'; rm.textContent='Remove'; rm.onclick=()=>Setup_remove(i); row.appendChild(rm); list.appendChild(row); }); } } if(btn){ btn.disabled = SetupState.list.length===0; } }
function Setup_finish(){ 
  if(!SetupState.list.length){ 
    alert('Add at least one account'); 
    return; 
  } 
  if(!SetupState.list.some(u=>!u.guest && u.role==='admin')){ alert('Choose at least one non-Guest admin.'); return; }
  Users_save(SetupState.list); 
  currentUser = SetupState.list[0].name; 
  localStorage.setItem('jackosLastUser', currentUser); 
  Login_applyUser(); 
  
  // Initialize security questions setup for all accounts
  SetupSecQState.accountIndex = 0;
  SetupSecQState.accountNames = SetupState.list.filter(u=>!u.guest).map(u => u.name);
  Setup_promptSecurityQuestions();
}

//Helpers To Help With Desktop Folders And Files To Appear On Wallpaper/Desktop

async function Desktop_dir(name=currentUser){
  const userDir=await UserData_dir(name);
  return userDir.getDirectoryHandle('Desktop',{create:true});
}
function Desktop_resolveLayoutUser(name){
  const explicit=String(name ?? '').trim();
  if(explicit) return explicit;
  return String(currentUser || localStorage.getItem('jackosLastUser') || 'Guest').trim() || 'Guest';
}
function Desktop_setLayoutUser(name){
  const resolved=Desktop_resolveLayoutUser(name);
  if(resolved!==DesktopActiveLayoutUser){
    if(DesktopActiveLayoutUser){
      DesktopRefreshSequence++;
      // Invalidate any drag before changing the owner of layout writes.
      if(DesktopState.dragSession || DesktopState.nativeDrag){
        const session=DesktopState.dragSession;
        if(session?.icon?.isConnected){
          session.icon.style.left=session.startLeft+'px';
          session.icon.style.top=session.startTop+'px';
          session.icon.style.zIndex='1';
          session.icon.style.cursor='pointer';
        }
        DesktopState.dragSession=null;
        DesktopState.nativeDrag=null;
        DesktopState.dropTarget=null;
        DesktopState.draggingIcon=null;
        DesktopState.dragId=null;
      }
      document.querySelectorAll('#desktop .desktop-file-icon, #desktop [data-installed-app="true"], #startMenu [data-installed-app="true"]').forEach(el=>el.remove());
    }
    DesktopActiveLayoutUser=resolved;
  }
  return DesktopActiveLayoutUser;
}
function Desktop_layoutKey(user=DesktopActiveLayoutUser || Desktop_resolveLayoutUser()){
  return 'jackosDesktopLayout:'+encodeURIComponent(Desktop_resolveLayoutUser(user));
}
function Desktop_layout(user=DesktopActiveLayoutUser || Desktop_resolveLayoutUser()){
  try{
    const stored=JSON.parse(localStorage.getItem(Desktop_layoutKey(user))||'{}');
    return stored && typeof stored==='object' && !Array.isArray(stored) ? stored : {};
  }catch(_){ return {}; }
}
function Desktop_saveLayout(id,data,user=DesktopActiveLayoutUser || Desktop_resolveLayoutUser()){
  if(!id || !data) return;
  const key=Desktop_layoutKey(user);
  const layout=Desktop_layout(user);
  layout[id]={...(layout[id]||{}),...data};
  try{ localStorage.setItem(key,JSON.stringify(layout)); }
  catch(err){ console.warn('Could not save Desktop layout:',err); }
}
function Desktop_getLayout(id,user=DesktopActiveLayoutUser || Desktop_resolveLayoutUser()){
  return Desktop_layout(user)[id];
}

function Desktop_hiddenApps(){

  return JSON.parse(
    localStorage.getItem(
      'jackosHiddenApps'
    ) || '{}'
  );

}

function Desktop_hideApp(
  app
){

  const hidden =
    Desktop_hiddenApps();

  hidden[app] = true;

  localStorage.setItem(
    'jackosHiddenApps',
    JSON.stringify(hidden)
  );

  const icon =
    document.querySelector(
      `.icon[data-app="${app}"]`
    );

  if(icon)
    icon.style.display='none';

}

function Desktop_showApp(
  app
){

  const hidden =
    Desktop_hiddenApps();

  delete hidden[app];

  localStorage.setItem(
    'jackosHiddenApps',
    JSON.stringify(hidden)
  );

  const icon =
    document.querySelector(
      `.icon[data-app="${app}"]`
    );

  if(icon)
    icon.style.display='block';

}

function Desktop_slotKey(slot){ return `${slot.col}:${slot.row}`; }
function Desktop_slotToPosition(slot){ return {left:DesktopGrid.startX+slot.col*DesktopGrid.colWidth,top:DesktopGrid.startY+slot.row*DesktopGrid.rowHeight}; }
function Desktop_gridBounds(){
  const el=document.querySelector('#desktop > .desktop');
  const width=el?.clientWidth||window.innerWidth||1280;
  const height=el?.clientHeight||Math.max(300,(window.innerHeight||720)-DesktopGrid.startY);
  return {maxCol:Math.max(0,Math.floor((width-DesktopGrid.startX-86)/DesktopGrid.colWidth)),maxRow:Math.max(0,Math.floor((height-DesktopGrid.startY-86)/DesktopGrid.rowHeight))};
}
function Desktop_positionToSlot(left,top){
  const b=Desktop_gridBounds();
  return {col:Math.min(b.maxCol,Math.max(0,Math.round((left-DesktopGrid.startX)/DesktopGrid.colWidth))),row:Math.min(b.maxRow,Math.max(0,Math.round((top-DesktopGrid.startY)/DesktopGrid.rowHeight)))};
}
function Desktop_positionExactSlot(left,top,tolerance=1){
  const slot=Desktop_positionToSlot(left,top),pos=Desktop_slotToPosition(slot);
  return Math.abs(left-pos.left)<=tolerance && Math.abs(top-pos.top)<=tolerance ? slot : null;
}
function Desktop_iconRectAt(icon,left,top){
  const w=icon.offsetWidth||86,h=icon.offsetHeight||86;
  return {left,top,right:left+w,bottom:top+h,width:w,height:h};
}
function Desktop_rectsOverlap(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}
function Desktop_iconElements(){
  const desktop=document.querySelector('#desktop > .desktop');
  return desktop?[...desktop.children].filter(el=>el.classList?.contains('icon')&&el.dataset.layoutId):[];
}
function Desktop_findFreePosition(icon,wantedLeft,wantedTop,ignoreId=null){
  const desktop=document.querySelector('#desktop > .desktop');
  const width=desktop?.clientWidth||window.innerWidth||1280;
  const height=desktop?.clientHeight||Math.max(300,(window.innerHeight||720)-DesktopGrid.startY);
  const w=icon.offsetWidth||86,h=icon.offsetHeight||86;
  const minX=DesktopGrid.startX,minY=DesktopGrid.startY,maxX=Math.max(minX,width-w-DesktopGrid.startX),maxY=Math.max(minY,height-h);
  const base={left:Math.max(minX,Math.min(maxX,Number.isFinite(Number(wantedLeft))?Number(wantedLeft):minX)),top:Math.max(minY,Math.min(maxY,Number.isFinite(Number(wantedTop))?Number(wantedTop):minY))};
  const others=Desktop_iconElements().filter(x=>x!==icon&&x.dataset.layoutId!==ignoreId&&getComputedStyle(x).display!=='none');
  const free=(p)=>!others.some(x=>Desktop_rectsOverlap(Desktop_iconRectAt(icon,p.left,p.top),Desktop_iconRectAt(x,parseFloat(x.style.left)||0,parseFloat(x.style.top)||0)));
  if(free(base)) return base;
  // Search nearby free-form coordinates at a fixed, repeatable interval.
  const step=8,limit=Math.max(width,height);
  for(let radius=step;radius<=limit;radius+=step){
    const points=[];
    for(let dx=-radius;dx<=radius;dx+=step){points.push([dx,-radius],[dx,radius]);}
    for(let dy=-radius+step;dy<radius;dy+=step){points.push([-radius,dy],[radius,dy]);}
    points.sort((a,b)=>Math.hypot(a[0],a[1])-Math.hypot(b[0],b[1])||a[1]-b[1]||a[0]-b[0]);
    for(const [dx,dy] of points){
      const p={left:Math.max(minX,Math.min(maxX,base.left+dx)),top:Math.max(minY,Math.min(maxY,base.top+dy))};
      if(free(p)) return p;
    }
  }
  return base;
}
function Desktop_applyUserLayout(requestedUser=Desktop_resolveLayoutUser()){
  const desktop=document.querySelector('#desktop > .desktop');
  if(!desktop) return;
  const user=Desktop_resolveLayoutUser(requestedUser);
  if(user!==Desktop_resolveLayoutUser()) return;
  Desktop_setLayoutUser(user);
  const icons=[...desktop.children].filter(icon=>icon.classList?.contains('icon')&&icon.matches('[data-app]'));
  // Park unprocessed app icons outside the visible surface so they cannot
  // falsely occupy a position while this user's saved layout is reapplied.
  icons.forEach(icon=>{
    icon.style.position='absolute';
    icon.dataset.layoutId='app:'+icon.dataset.app;
    icon.style.left='-10000px'; icon.style.top='-10000px';
    Desktop_bindIconDrag(icon);
  });
  const bounds=Desktop_gridBounds(),columns=bounds.maxCol+1;
  icons.forEach((icon,index)=>{
    const id=icon.dataset.layoutId,saved=Desktop_getLayout(id,user);
    let wanted;
    if(saved && Number.isFinite(Number(saved.left)) && Number.isFinite(Number(saved.top))){
      wanted={left:Number(saved.left),top:Number(saved.top)};
    }else if(saved?.slot && Number.isFinite(Number(saved.slot.col)) && Number.isFinite(Number(saved.slot.row))){
      wanted=Desktop_slotToPosition({col:Number(saved.slot.col),row:Number(saved.slot.row)});
    }else{
      wanted=Desktop_slotToPosition({col:index%columns,row:Math.floor(index/columns)});
    }
    const pos=Desktop_findFreePosition(icon,wanted.left,wanted.top,id);
    icon.style.left=pos.left+'px'; icon.style.top=pos.top+'px';
    const slot=Desktop_positionExactSlot(pos.left,pos.top);
    const oldSlotKey=saved?.slot?Desktop_slotKey(saved.slot):null;
    const newSlotKey=slot?Desktop_slotKey(slot):null;
    if(!saved || pos.left!==wanted.left || pos.top!==wanted.top || oldSlotKey!==newSlotKey){
      Desktop_saveLayout(id,{left:pos.left,top:pos.top,slot},user);
    }
  });
}
function Desktop_dragExcludedTarget(target){
  return !!target?.closest?.('#explorer,#browserWin,#calcApp,#jcamApp,#settingsWin,#photosApp,#musicApp,#gamesApp,#appStoreApp,#messagesWin,#flappyApp,#tetrisApp,#snakeApp,#startMenu,.taskbar,.installed-app-window');
}
function Desktop_clearDropTarget(){
  if(DesktopState.dropTarget?.classList) DesktopState.dropTarget.classList.remove('desktop-drop-target');
  DesktopState.dropTarget=null;
}
function Desktop_bindIconDrag(icon){
  if(!icon || icon.dataset.desktopDragBound==='true') return;
  icon.dataset.desktopDragBound='true';
  icon.draggable=false;
  icon.style.userSelect='none';
  icon.style.webkitUserSelect='none';
  icon.style.touchAction='none';

  icon.addEventListener('pointerdown',e=>{
    if(e.button!==0 || !icon.isConnected) return;
    const user=Desktop_resolveLayoutUser();
    if(user!==DesktopActiveLayoutUser) return;
    const desktop=document.querySelector('#desktop > .desktop');
    if(!desktop) return;
    const rect=icon.getBoundingClientRect();
    const drect=desktop.getBoundingClientRect();
    DesktopState.dragSession={
      icon,
      id:icon.dataset.layoutId || (icon.dataset.installedAppFile?`installed:${icon.dataset.installedAppFile}`:''),
      user,
      pointerId:e.pointerId,
      startClientX:e.clientX,
      startClientY:e.clientY,
      offsetX:Math.max(0,Math.min(rect.width,e.clientX-rect.left)),
      offsetY:Math.max(0,Math.min(rect.height,e.clientY-rect.top)),
      startLeft:parseFloat(icon.style.left)||0,
      startTop:parseFloat(icon.style.top)||0,
      entry:icon._desktopEntry||null,
      moved:false,
      desktopRect:drect
    };
    DesktopState.draggingIcon=icon;
    DesktopState.dragId=DesktopState.dragSession.id;
    DesktopState.suppressOpenUntil=0;
    // Do not use pointer capture here. A document-level pointerup is more
    // reliable in Edge when the icon temporarily stops receiving hit-tests.
    e.preventDefault();
  });
}

function Desktop_finishPointerDrag(e,cancelled=false){
  const s=DesktopState.dragSession;
  if(!s || e.pointerId!==s.pointerId) return;
  const icon=s.icon;
  const clear=()=>{
    Desktop_clearDropTarget();
    if(icon?.isConnected){
      icon.classList.remove('desktop-dragging');
      icon.style.pointerEvents='';
      icon.style.opacity='';
    }
    DesktopState.dragSession=null;
    DesktopState.draggingIcon=null;
    DesktopState.dragId=null;
  };
  if(cancelled){
    if(icon?.isConnected){icon.style.left=s.startLeft+'px';icon.style.top=s.startTop+'px';}
    clear();
    return;
  }
  if(!s.moved){ clear(); return; }

  const desktop=document.querySelector('#desktop > .desktop');
  if(!desktop){ clear(); return; }
  const user=s.user;
  const finish=async()=>{
    try{
      // Hide only for hit-testing; the document listener remains active.
      const oldPE=icon.style.pointerEvents;
      icon.style.pointerEvents='none';
      const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('#desktop > .desktop > .icon');
      icon.style.pointerEvents=oldPE;
      Desktop_clearDropTarget();
      if(s.entry&&target&&target!==icon&&target._desktopEntry?.kind==='directory'){
        const result=await Explorer_moveOne(s.entry,target._desktopEntry.handle);
        if(result?.moved){
          await Desktop_refreshFiles(user);
        }else{
          icon.style.left=s.startLeft+'px';icon.style.top=s.startTop+'px';
        }
      }else{
        const wantedLeft=parseFloat(icon.style.left)||s.startLeft;
        const wantedTop=parseFloat(icon.style.top)||s.startTop;
        const targetIcon=Desktop_iconElements().find(x=>x!==icon&&x.dataset.layoutId&&Desktop_rectsOverlap(
          Desktop_iconRectAt(icon,wantedLeft,wantedTop),
          Desktop_iconRectAt(x,parseFloat(x.style.left)||0,parseFloat(x.style.top)||0)
        ));
        if(targetIcon && !JACKOS_IS_MACOS){
          const targetLeft=parseFloat(targetIcon.style.left)||0;
          const targetTop=parseFloat(targetIcon.style.top)||0;
          const targetPos=Desktop_findFreePosition(targetIcon,targetLeft,targetTop,targetIcon.dataset.layoutId);
          targetIcon.style.left=targetPos.left+'px';
          targetIcon.style.top=targetPos.top+'px';
          Desktop_saveLayout(targetIcon.dataset.layoutId,{left:targetPos.left,top:targetPos.top,slot:Desktop_positionExactSlot(targetPos.left,targetPos.top)},user);
        }
        const pos=Desktop_findFreePosition(icon,wantedLeft,wantedTop,s.id);
        icon.style.left=pos.left+'px';
        icon.style.top=pos.top+'px';
        Desktop_saveLayout(s.id,{left:pos.left,top:pos.top,slot:Desktop_positionExactSlot(pos.left,pos.top)},user);
      }
    }catch(err){
      console.error('Desktop drag failed:',err);
      if(icon?.isConnected){icon.style.left=s.startLeft+'px';icon.style.top=s.startTop+'px';}
    }finally{
      clear();
    }
  };
  finish();
}

function Desktop_bindGlobalPointerDrag(){
  if(window.__jackosDesktopGlobalPointerDrag) return;
  window.__jackosDesktopGlobalPointerDrag=true;
  document.addEventListener('pointermove',e=>{
    const s=DesktopState.dragSession;
    if(!s || e.pointerId!==s.pointerId || !s.icon?.isConnected) return;
    const dx=e.clientX-s.startClientX,dy=e.clientY-s.startClientY;
    if(!s.moved && Math.hypot(dx,dy)<5) return;
    s.moved=true;
    DesktopState.suppressOpenUntil=Date.now()+500;
    const icon=s.icon;
    const desktop=document.querySelector('#desktop > .desktop');
    if(!desktop) return;
    const dr=desktop.getBoundingClientRect();
    const wantedLeft=e.clientX-dr.left-s.offsetX+(JACKOS_IS_MACOS?desktop.scrollLeft:0);
    const wantedTop=e.clientY-dr.top-s.offsetY+(JACKOS_IS_MACOS?desktop.scrollTop:0);
    const w=icon.offsetWidth||86,h=icon.offsetHeight||86;
    const maxLeft=Math.max(0,(JACKOS_IS_MACOS?desktop.scrollWidth:dr.width)-w),maxTop=Math.max(0,(JACKOS_IS_MACOS?desktop.scrollHeight:dr.height)-h);
    icon.style.left=Math.max(0,Math.min(maxLeft,wantedLeft))+'px';
    icon.style.top=Math.max(0,Math.min(maxTop,wantedTop))+'px';
    icon.classList.add('desktop-dragging');
    icon.style.pointerEvents='none';
    const under=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('#desktop > .desktop > .icon');
    icon.style.pointerEvents='';
    Desktop_clearDropTarget();
    if(under&&under!==icon&&s.entry&&under._desktopEntry?.kind==='directory'){
      under.classList.add('desktop-drop-target');
      DesktopState.dropTarget=under;
    }
    e.preventDefault();
  },{passive:false});
  document.addEventListener('pointerup',e=>Desktop_finishPointerDrag(e,false));
  document.addEventListener('pointercancel',e=>Desktop_finishPointerDrag(e,true));
}

function Desktop_bindDragSurface(){
  const desktop=document.querySelector('#desktop > .desktop');
  if(!desktop || desktop.dataset.desktopDropBound==='true') return;
  desktop.dataset.desktopDropBound='true';
  // Pointer based desktop dragging is handled by each icon. Keep this surface
  // handler for legacy native drags and for wallpaper drag targets.
  desktop.addEventListener('dragover',e=>{ if(DesktopState.nativeDrag){e.preventDefault();e.dataTransfer.dropEffect='move';} });
  desktop.addEventListener('drop',e=>{ if(DesktopState.nativeDrag){e.preventDefault();} });
}
function Desktop_dropPoint(desktop,event,offsetX=43,offsetY=30){
  const rect=desktop.getBoundingClientRect();
  return {left:event.clientX-rect.left-offsetX+(JACKOS_IS_MACOS?desktop.scrollLeft:0),top:event.clientY-rect.top-offsetY+(JACKOS_IS_MACOS?desktop.scrollTop:0)};
}

function Desktop_cleanUp(){
  const desktop=document.querySelector('#desktop > .desktop');
  if(!desktop) return;
  const user=Desktop_resolveLayoutUser();
  if(user!==DesktopActiveLayoutUser) Desktop_setLayoutUser(user);
  Desktop_bindDragSurface();
  const icons=Desktop_iconElements().filter(icon=>
    icon.isConnected && getComputedStyle(icon).display!=='none' &&
    !icon.closest('.taskbar,#startMenu,#explorer,#browserWin,#calcApp,#jcamApp,#settingsWin,#photosApp,#musicApp,#gamesApp,#appStoreApp,#messagesWin,#flappyApp,#tetrisApp,#snakeApp')
  );
  if(!icons.length) return;
  // Ensure every visible desktop icon has a stable layout ID before saving. This
  // keeps built-in, installed, and Desktop-folder entries in the same layout model.
  icons.forEach(icon=>{
    if(!icon.dataset.layoutId){
      if(icon.dataset.app) icon.dataset.layoutId='app:'+icon.dataset.app;
      else if(icon.dataset.installedAppFile) icon.dataset.layoutId='installed:'+icon.dataset.installedAppFile;
      else if(icon.dataset.installedApp==='true') icon.dataset.layoutId='installed:'+String(icon.dataset.entryName||icon.textContent||'app');
    }
    icon.style.position='absolute';
  });
  const usable=icons.filter(icon=>icon.dataset.layoutId);
  const bounds=Desktop_gridBounds();
  const occupied=new Set();
  const current=icon=>({
    left:Number.isFinite(parseFloat(icon.style.left))?parseFloat(icon.style.left):DesktopGrid.startX,
    top:Number.isFinite(parseFloat(icon.style.top))?parseFloat(icon.style.top):DesktopGrid.startY
  });
  const order=(a,b)=>{const pa=current(a),pb=current(b);return pa.top-pb.top||pa.left-pb.left||String(a.dataset.layoutId).localeCompare(String(b.dataset.layoutId));};
  const pending=[];
  // Keep icons already on a valid, unoccupied grid point completely untouched.
  [...usable].sort(order).forEach(icon=>{
    const p=current(icon),slot=Desktop_positionExactSlot(p.left,p.top,1);
    if(slot&&slot.col<=bounds.maxCol&&slot.row<=bounds.maxRow&&!occupied.has(Desktop_slotKey(slot))){
      occupied.add(Desktop_slotKey(slot));
      Desktop_saveLayout(icon.dataset.layoutId,{left:p.left,top:p.top,slot},user);
    }else pending.push(icon);
  });
  // Every remaining item snaps to its nearest grid point that no other icon has reserved.
  pending.sort(order).forEach(icon=>{
    const p=current(icon);let best=null,bestDistance=Infinity;
    for(let row=0;row<=bounds.maxRow;row++) for(let col=0;col<=bounds.maxCol;col++){
      const slot={col,row},key=Desktop_slotKey(slot);
      if(occupied.has(key)) continue;
      const grid=Desktop_slotToPosition(slot);
      const distance=Math.hypot(grid.left-p.left,grid.top-p.top);
      if(distance<bestDistance){best=slot;bestDistance=distance;}
    }
    if(!best) return;
    occupied.add(Desktop_slotKey(best));
    const pos=Desktop_slotToPosition(best);
    icon.style.left=pos.left+'px';icon.style.top=pos.top+'px';
    Desktop_saveLayout(icon.dataset.layoutId,{left:pos.left,top:pos.top,slot:best},user);
  });
  // Persisted layout is authoritative for this account; force all open icon nodes
  // to reflect the exact coordinates just saved without reflowing the grid.
  try{localStorage.setItem(Desktop_layoutKey(user),JSON.stringify(Desktop_layout(user)));}catch(_){}
}
async function Desktop_refreshForUser(userName=currentUser || localStorage.getItem('jackosLastUser') || 'Guest'){
  const user=Desktop_resolveLayoutUser(userName);
  if(!user) return;
  Desktop_setLayoutUser(user);
  try{localStorage.setItem('jackosLastUser',user);}catch(_){}
  if(typeof currentUser!=='undefined') currentUser=user;
  const desktop=document.querySelector('#desktop > .desktop');
  if(!desktop) return;
  Desktop_applyUserLayout(user);
  await Desktop_refreshFiles(user);
  if(user!==Desktop_resolveLayoutUser()) return;
  if(typeof InstalledApps_scan==='function') await InstalledApps_scan();
  if(user!==Desktop_resolveLayoutUser()) return;
  Desktop_refreshTaskbar();
}
window.Desktop_refreshForUser=Desktop_refreshForUser;
window.Desktop_cleanUp=Desktop_cleanUp;
async function Desktop_cleanUpFromMenu(){
  Explorer_closeContextMenu();
  try{
    Desktop_cleanUp();
    await Desktop_refreshFiles(Desktop_resolveLayoutUser());
    if(typeof InstalledApps_scan==='function') await InstalledApps_scan();
    Desktop_applyUserLayout(Desktop_resolveLayoutUser());
  }catch(err){
    console.error('Desktop Clean Up failed:',err);
    alert('Clean Up failed: '+(err?.message||err));
  }
}
window.Desktop_cleanUpFromMenu=Desktop_cleanUpFromMenu;

async function Desktop_refreshFiles(requestedUser=Desktop_resolveLayoutUser()){
  const desktop=document.querySelector('#desktop > .desktop');
  if(!desktop) return;
  const user=Desktop_resolveLayoutUser(requestedUser);
  if(user!==Desktop_resolveLayoutUser()) return;
  Desktop_setLayoutUser(user);
  const sequence=++DesktopRefreshSequence;
  const dir=await Desktop_dir(user);
  const entries=[];
  for await(const handle of dir.values()) entries.push({name:handle.name,kind:handle.kind,handle,parent:dir,virtual:false,path:'Desktop/'+handle.name+(handle.kind==='directory'?'/':'')});
  if(sequence!==DesktopRefreshSequence || user!==DesktopActiveLayoutUser) return;
  Desktop_bindDragSurface();
  const liveKeys=new Set(entries.map(entry=>'file:'+entry.name));
  const layout=Desktop_layout(user);
  let pruned=false;
  for(const key of Object.keys(layout)) if(key.startsWith('file:')&&!liveKeys.has(key)){delete layout[key];pruned=true;}
  if(pruned){try{localStorage.setItem(Desktop_layoutKey(user),JSON.stringify(layout));}catch(_) {}}
  [...desktop.children].filter(icon=>icon.classList?.contains('desktop-file-icon')).forEach(icon=>icon.remove());
  const bounds=Desktop_gridBounds(),columns=bounds.maxCol+1;
  for(let index=0;index<entries.length;index++){
    if(sequence!==DesktopRefreshSequence || user!==DesktopActiveLayoutUser) return;
    const entry=entries[index],id='file:'+entry.name;
    const icon=document.createElement('div');
    icon.className='icon desktop-file-icon';icon.style.position='absolute';
    icon.dataset.userFile='true';icon.dataset.entryName=entry.name;icon.dataset.layoutId=id;
    icon._desktopEntry=entry;icon.draggable=false;
    const saved=Desktop_getLayout(id,user);
    let wanted;
    if(saved && Number.isFinite(Number(saved.left)) && Number.isFinite(Number(saved.top))) wanted={left:Number(saved.left),top:Number(saved.top)};
    else if(saved?.slot && Number.isFinite(Number(saved.slot.col)) && Number.isFinite(Number(saved.slot.row))) wanted=Desktop_slotToPosition({col:Number(saved.slot.col),row:Number(saved.slot.row)});
    else wanted=Desktop_slotToPosition({col:index%columns,row:Math.floor(index/columns)});
    icon.style.left='-10000px';icon.style.top='-10000px';
    icon.innerHTML=`<div class="icon-box">${entry.kind==='directory'?'📁':'📄'}</div><div class="desktop-icon-label"></div>`;
    icon.querySelector('.desktop-icon-label').textContent=entry.name;
    icon.addEventListener('dblclick',e=>{ if(DesktopState.suppressOpenUntil>Date.now()){e.preventDefault();e.stopPropagation();return;} e.preventDefault();Desktop_openFileEntry(entry); });
    icon.addEventListener('contextmenu',e=>{
      e.preventDefault();e.stopPropagation();DesktopState.selectedEntry=entry;
      Explorer_showContextMenu(e.pageX,e.pageY,`<div class="context-item" onclick="Desktop_openSelected()">📂 Open</div><div class="context-item" onclick="Desktop_renameSelected()">✏ Rename</div><div class="context-item" onclick="Desktop_moveSelected()">📂 Move</div><div class="context-item" onclick="Desktop_duplicateSelected()">📋 Duplicate</div><div class="context-item" onclick="Desktop_deleteSelected()">🗑 Delete</div><div class="context-item" onclick="Desktop_exportSelected()">📤 Export</div><div class="context-item" onclick="Desktop_propertiesSelected()">ℹ Properties</div>`);
    });
    desktop.append(icon);
    Desktop_bindIconDrag(icon);
    const pos=Desktop_findFreePosition(icon,wanted.left,wanted.top,id);
    icon.style.left=pos.left+'px';icon.style.top=pos.top+'px';
    Desktop_saveLayout(id,{left:pos.left,top:pos.top,slot:Desktop_positionExactSlot(pos.left,pos.top)},user);
  }
}

function Desktop_openWallpaperContextMenu(e){
  e.preventDefault(); e.stopPropagation();
  const menu=`
<div class="context-item" onclick="Desktop_newFileFromWallpaper()">📄 New File</div>
<div class="context-item" onclick="Desktop_newFolderFromWallpaper()">📁 New Folder</div>
<div class="context-item" onclick="Desktop_cleanUpFromMenu()">🧹 Clean Up</div>`;
  Explorer_showContextMenu(e.pageX,e.pageY,menu);
}
async function Desktop_prepareWallpaperCwd(){
  await Explorer_openJackOSDrive();
  const desktop=await ExplorerState.driveRoot.getDirectoryHandle('Desktop',{create:true});
  ExplorerState.driveCwd=desktop; ExplorerState.cwdPath=['Desktop']; ExplorerState.virtualPath=[];
}
async function Desktop_newFileFromWallpaper(){
  Explorer_closeContextMenu(); try{await Desktop_prepareWallpaperCwd();await Explorer_createFile();await Desktop_refreshFiles();}catch(e){alert('Create file failed: '+e.message);}
}
async function Desktop_newFolderFromWallpaper(){
  Explorer_closeContextMenu(); try{await Desktop_prepareWallpaperCwd();await Explorer_createFolder();await Desktop_refreshFiles();}catch(e){alert('Create folder failed: '+e.message);}
}

async function Desktop_openFileEntry(
  entry
){

  Explorer_open();

  await Explorer_openJackOSDrive();

  const desktop =
    await ExplorerState.driveRoot
      .getDirectoryHandle(
        'Desktop'
      );

  ExplorerState.driveCwd =
    desktop;

  ExplorerState.cwdPath =
    ['Desktop'];

  await Explorer_listDriveCwd();

  const idx =
    ExplorerState.files.findIndex(
      f=>f.name===entry.name
    );

  if(idx>=0){

  Explorer_setSelection(
    idx
  );

  if(
    ExplorerState.files[idx]
      .kind==='directory'
  ){

    await Explorer_enterFolder(
      idx
    );

  }
  else{

    Explorer_showEntry(
      ExplorerState.files[idx]
    );

  }

}

}
function Desktop_openSelected(){

  if(
    !DesktopState.selectedEntry
  )
    return;

  Desktop_openFileEntry(
    DesktopState.selectedEntry
  );

}
async function Desktop_selectInExplorer(){

  if(!DesktopState.selectedEntry)
    return false;

  await Explorer_openJackOSDrive();

  const desktop =
    await ExplorerState.driveRoot
      .getDirectoryHandle(
        'Desktop'
      );

  ExplorerState.driveCwd =
    desktop;

  ExplorerState.cwdPath =
    ['Desktop'];

  await Explorer_listDriveCwd();

  const idx =
    ExplorerState.files.findIndex(
      f =>
        f.name===
        DesktopState.selectedEntry.name
    );

  if(idx<0)
    return false;

  Explorer_setSelection(idx);

  return true;

}

async function Desktop_renameSelected(){

  Explorer_open();

  if(
    await Desktop_selectInExplorer()
  ){

    await Explorer_rename();

    await Desktop_refreshFiles();

  }

}

async function Desktop_moveSelected(){

  Explorer_closeContextMenu();

  if(
    await Desktop_selectInExplorer()
  ){

    Explorer_openDestDialog(
      'move'
    );

  }

}
async function Desktop_duplicateSelected(){

  Explorer_closeContextMenu();

  if(
    await Desktop_selectInExplorer()
  ){

    Explorer_openDestDialog(
      'duplicate'
    );

  }

}
async function Desktop_deleteSelected(){

  Explorer_closeContextMenu();

  if(
    await Desktop_selectInExplorer()
  ){

    await Explorer_deleteSelected();

  }

}
async function Desktop_exportSelected(){Explorer_closeContextMenu();if(await Desktop_selectInExplorer())await Explorer_exportSelected();}

async function Desktop_propertiesSelected(){

  Explorer_closeContextMenu();

  if(
    await Desktop_selectInExplorer()
  ){

    Explorer_showProperties();

  }

}