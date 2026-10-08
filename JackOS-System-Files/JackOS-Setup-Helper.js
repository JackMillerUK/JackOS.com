// JackOS-Onboarding.js
// JackOS v5 first-run experience. Extends the existing setup/account/app architecture.

(function(){
  'use strict';

  const OOBE_KEY='jackosOobeComplete';
  const STAGE_KEY='jackosOobeStage';
  const INSTALL_KEY='jackosOobeAppSelections';
  const OOBE={
    Home:{
      icon:'🏠', label:'HOME', title:'JackOS Home', tagline:'Fast. Simple. Reliable.',
      description:'Designed for everyday use.',
      accent:'home',
      features:[
        ['🗂️','Explorer','Manage your files and folders.'],
        ['📷','Photos & Camera','Capture and organise your memories.'],
        ['🌐','Browser','Browse the web from your desktop.'],
        ['🧮','Calculator','Quick calculations whenever you need them.'],
        ['⚙️','Settings','Personalise JackOS and manage accounts.'],
        ['👥','Multi-user accounts','Give everyone their own JackOS space.'],
        ['🛡️','Security Questions','Built-in account recovery protection.'],
        ['💾','System Import / Export','Back up and restore your JackOS system.']
      ]
    },
    Private:{
      icon:'🏢', label:'PRIVATE', title:'JackOS Private', tagline:'Connected Everywhere. Cloud Powered.',
      description:'A cloud-connected experience for families, private users and organisations.',
      accent:'private',
      features:[
        ['☁️','Cloud Sync','Backup, restore and sync your JackOS data between devices.'],
        ['🎨','Cloud Wallpaper Sync','Keep your personal look with you.'],
        ['🛒','App Store','Discover and install JackOS applications.'],
        ['📦','App Installation','Install JackOS app packages into individual accounts.'],
        ['📄','Word Processing','Create and edit documents with JackWord.'],
        ['🎵','Music','Streaming and offline music support.'],
        ['💾','Extended Storage','More room for your files and personal data.'],
        ['🏷️','Private Edition Badge','A distinctive Private experience throughout JackOS.']
      ]
    },
    Pro:{
      icon:'💼', label:'PRO', title:'JackOS Pro', tagline:'Power Meets Freedom.',
      description:'Advanced tools for creators, developers and power users.',
      accent:'pro',
      features:[
        ['✨','Everything in Private','All Private edition features are included.'],
        ['🧪','Sandbox Emulator','Run isolated experimental environments.'],
        ['⚙️','Advanced Settings','More control over the JackOS experience.'],
        ['🗄️','Server Content Libraries','Access advanced server-backed content.'],
        ['🚀','Early Access Features','Try selected features before general release.'],
        ['🛒','App Store & Packages','Install and manage JackOS applications.'],
        ['🎵','Music + Offline','Streaming and offline music support.'],
        ['🏷️','Pro Edition Badge','A distinctive Pro experience throughout JackOS.']
      ]
    },
    Elite:{
      icon:'👑', label:'ELITE', title:'JackOS Elite', tagline:'Build. Test. Push Further.',
      description:'The staff and development edition for testing, development and internal tools.',
      accent:'elite',
      features:[
        ['✨','Everything in Pro','All Pro edition features are included.'],
        ['🧰','Development Tools','Tools for building and testing JackOS features.'],
        ['🧪','Internal Testing','Internal and experimental testing features.'],
        ['🚀','Beta Builds','Access selected development builds.'],
        ['🖥️','Server Management','Tools for authorised server management.'],
        ['🔬','Experimental Features','Features that may change or be removed.'],
        ['🧩','JFE Access','JackOS Feature Engineering access.'],
        ['🏷️','Elite Edition Badge','A distinctive Elite experience throughout JackOS.']
      ]
    }
  };

  function edition(){
    return localStorage.getItem('jackosEdition') || window.JACKOS_EDITION || 'Home';
  }
  function info(){
    return OOBE[edition()] || OOBE.Home;
  }
  function setStage(stage){
    localStorage.setItem(STAGE_KEY,stage);
  }
  function complete(){
    return localStorage.getItem(OOBE_KEY)==='true';
  }
  window.JackOS_OOBE_isComplete=complete;

  function setText(id,value){
    const el=document.getElementById(id); if(el) el.textContent=value;
  }
  function setBadge(id){
    const el=document.getElementById(id); if(!el) return;
    const i=info(); el.textContent=i.label; el.className='edition-badge edition-'+i.accent;
  }
  function applyEditionClass(){
    document.body.dataset.edition=info().accent;
    document.documentElement.style.setProperty('--oobe-accent', ({
      home:'#0a84ff', private:'#8b5cf6', pro:'#2f9bff', elite:'#eab308'
    })[info().accent] || '#0a84ff');
  }
  function screen(id,fade=true){
    applyEditionClass();
    if(typeof show==='function') show(id,fade);
  }

  window.JackOS_OOBE_start=function(){
    applyEditionClass();
    const i=info();
    const popup=document.getElementById('popup'); if(popup) popup.style.display='none';
    setStage('editionReveal');
    setText('revealIcon',i.icon);
    setText('revealTitle',i.title);
    setText('revealTagline',i.tagline);
    setBadge('revealEditionBadge');
    screen('editionReveal',true);
    const reveal=document.getElementById('editionReveal');
    reveal?.classList.remove('reveal-playing');
    requestAnimationFrame(()=>reveal?.classList.add('reveal-playing'));
    clearTimeout(window.__jackosRevealTimer);
    window.__jackosRevealTimer=setTimeout(()=>{
      setStage('welcome');
      JackOS_OOBE_showWelcome();
    },2600);
  };

  window.JackOS_OOBE_resume=function(){
    applyEditionClass();
    try{
      Users_migrate();
      if(Users_hasAny()){
        localStorage.removeItem(STAGE_KEY);
        localStorage.removeItem(OOBE_KEY);
        show('login',true);
        return;
      }
    }catch(e){}
    const stage=localStorage.getItem(STAGE_KEY)||'editionReveal';
    switch(stage){
      case 'welcome': JackOS_OOBE_showWelcome(); break;
      case 'setup': screen('setup',true); break;
      case 'config': JackOS_OOBE_showConfig(); break;
      case 'apps': JackOS_OOBE_showApps(); break;
      case 'security': JackOS_OOBE_startSecurity(); break;
      case 'final': JackOS_OOBE_finalise(); break;
      default: JackOS_OOBE_start(); break;
    }
  };

  window.JackOS_OOBE_showWelcome=function(){
    const i=info();
    setText('welcomeIcon',i.icon);
    setText('welcomeDescription',i.description);
    setBadge('welcomeBadge');
    screen('welcome',true);
  };

  window.JackOS_OOBE_begin=function(){
    if(Users_hasAny()){
      // Existing users are preserved; the setup screen becomes an account review.
      SetupState.list=Users_all().slice();
    }
    setStage('setup');
    screen('setup',true);
  };

  window.JackOS_OOBE_backToAccounts=function(){
    setStage('setup'); screen('setup',true);
  };

  window.JackOS_OOBE_showConfig=function(){
    const i=info();
    setText('configTitle',
      edition()==='Home' ? 'Everything you need.' :
      edition()==='Private' ? 'More of what you love.' :
      edition()==='Pro' ? 'Built for more.' : 'Built to build JackOS.');
    setText('configSubtitle',i.description);
    setBadge('configEditionBadge');
    const box=document.getElementById('configCards');
    if(box){
      box.innerHTML='';
      i.features.forEach(([icon,title,desc],idx)=>{
        const card=document.createElement('article');
        card.className='feature-card';
        card.style.animationDelay=(idx*35)+'ms';
        card.innerHTML='<div class="feature-icon">'+icon+'</div><div><h3></h3><p></p></div>';
        card.querySelector('h3').textContent=title;
        card.querySelector('p').textContent=desc;
        box.appendChild(card);
      });
    }
    setStage('config'); screen('editionConfig',true);
  };

  window.JackOS_OOBE_continueFromConfig=function(){
    if(['Private','Pro','Elite'].includes(edition())){
      setStage('apps'); JackOS_OOBE_showApps();
    }else{
      setStage('security'); JackOS_OOBE_startSecurity();
    }
  };

  // Preserve the existing account data model, but replace the old setup->security jump.
  window.Setup_finish=function(){
    const list=Array.isArray(SetupState.list)?SetupState.list:[];
    const nonGuests=list.filter(u=>!u.guest);
    if(!list.length){
      const msg=document.getElementById('setupMsg'); if(msg) msg.textContent='Add at least one account to continue.'; return;
    }
    if(!nonGuests.some(u=>u.role==='admin')){
      const msg=document.getElementById('setupMsg'); if(msg) msg.textContent='Choose at least one non-Guest account as an administrator.'; return;
    }
    Users_save(list);
    currentUser=list.find(u=>!u.guest)?.name || list[0].name;
    localStorage.setItem('jackosLastUser',currentUser);
    try{ Login_applyUser(); }catch(e){}
    setStage('config');
    JackOS_OOBE_showConfig();
  };

  function guestSafeUsers(){
    return Users_all().filter(u=>!u.guest);
  }

  async function loadCatalogue(){
    if(typeof AppStore_serverPackages!=='function') return [];
    try{
      const packages=await AppStore_serverPackages();
      return Array.isArray(packages)?packages:[];
    }catch(e){ return []; }
  }

  function selectionStore(){
    try{ return JSON.parse(localStorage.getItem(INSTALL_KEY)||'{}'); }catch(e){ return {}; }
  }
  function saveSelectionStore(data){
    try{ localStorage.setItem(INSTALL_KEY,JSON.stringify(data)); }catch(e){}
  }

  function appKey(pkg){ return String(pkg.fileName || pkg.name || '').trim(); }
  function pkgDescription(pkg){
    return String(pkg.description || pkg.summary || pkg.tagline || 'A JackOS application.');
  }

  function renderAppCard(pkg,index){
    const key=appKey(pkg);
    const store=selectionStore();
    const selected=Array.isArray(store[key])?store[key]:[];
    const users=guestSafeUsers();
    const card=document.createElement('article');
    card.className='app-install-card';
    card.dataset.appKey=key;

    const header=document.createElement('div');
    header.className='app-card-header';
    const icon=document.createElement('div'); icon.className='app-card-icon';
    icon.textContent=pkg.icon ? '' : '📦';
    if(pkg.icon){ icon.style.backgroundImage=`url('${String(pkg.icon).replace(/'/g,"%27")}')`; icon.classList.add('image-icon'); }
    const title=document.createElement('div'); title.className='app-card-title';
    const h=document.createElement('h3'); h.textContent=pkg.name||key;
    const p=document.createElement('p'); p.textContent=pkgDescription(pkg);
    title.append(h,p); header.append(icon,title);

    const body=document.createElement('div'); body.className='app-card-users';
    const allLabel=document.createElement('label'); allLabel.className='user-chip all-users';
    const all=document.createElement('input'); all.type='checkbox'; all.checked=users.length>0 && users.every(u=>selected.includes(u.name));
    all.addEventListener('change',()=>{
      const next=all.checked?users.map(u=>u.name):[];
      store[key]=next; saveSelectionStore(store); renderAppCardState(card,key,next);
      card.querySelectorAll('input[data-user]').forEach(x=>x.checked=all.checked);
    });
    allLabel.append(all,document.createTextNode(' All non-guest users')); body.append(allLabel);

    users.forEach(u=>{
      const label=document.createElement('label'); label.className='user-chip';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.dataset.user=u.name; cb.checked=selected.includes(u.name);
      cb.addEventListener('change',()=>{
        let next=Array.isArray(store[key])?store[key].slice():[];
        if(cb.checked && !next.includes(u.name)) next.push(u.name);
        if(!cb.checked) next=next.filter(n=>n!==u.name);
        store[key]=next; saveSelectionStore(store);
        all.checked=users.length>0 && users.every(x=>next.includes(x.name));
        renderAppCardState(card,key,next);
      });
      label.append(cb,document.createTextNode(' '+u.name)); body.append(label);
    });
    if(!users.length){
      const empty=document.createElement('p'); empty.textContent='No installable user accounts are available.'; body.append(empty);
    }

    const status=document.createElement('div'); status.className='app-card-status'; status.textContent=selected.length?'Selected':'Choose accounts';
    card.append(header,body,status);
    return card;
  }

  function renderAppCardState(card,key,selected){
    card.classList.toggle('selected',selected.length>0);
    const status=card.querySelector('.app-card-status'); if(status) status.textContent=selected.length ? `${selected.length} account${selected.length===1?'':'s'} selected` : 'Choose accounts';
  }

  window.JackOS_OOBE_showApps=async function(){
    if(!['Private','Pro','Elite'].includes(edition())){
      JackOS_OOBE_startSecurity(); return;
    }
    setBadge('installEditionBadge');
    const grid=document.getElementById('installAppsGrid');
    const status=document.getElementById('installStatus');
    if(status) status.textContent='';
    if(grid) grid.innerHTML='<div class="loading-state"><span class="spinner"></span><span>Loading available apps…</span></div>';
    screen('appInstall',true);
    const users=guestSafeUsers();
    if(grid && !users.length){
      grid.innerHTML='<div class="empty-state">Create a standard or administrator account before choosing applications.</div>';
      return;
    }
    const packages=await loadCatalogue();
    if(!grid) return;
    grid.innerHTML='';
    if(!packages.length){
      grid.innerHTML='<div class="empty-state"><strong>No installable apps are available right now.</strong><span>JackOS will continue without preinstalled App Store packages. You can install apps later.</span></div>';
      return;
    }
    packages.forEach((pkg,i)=>{
      const card=renderAppCard(pkg,i);
      grid.appendChild(card);
      renderAppCardState(card,appKey(pkg),selectionStore()[appKey(pkg)]||[]);
    });
  };

  window.JackOS_OOBE_backToConfig=function(){ setStage('config'); JackOS_OOBE_showConfig(); };

  async function writePackageForUser(user,pkg,bytes){
    const root=await UserData_dir(user);
    const dir=await root.getDirectoryHandle('Applications',{create:true});
    const name=String(pkg.fileName||((pkg.name||'App')+'.zip')).replace(/[^a-zA-Z0-9._-]/g,'_');
    const handle=await dir.getFileHandle(name,{create:true});
    const writable=await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
    localStorage.setItem('jackosAppInstall:'+UserData_key(user)+':'+name,new Date().toISOString());
  }

  window.JackOS_OOBE_installSelected=async function(){
    const btn=document.getElementById('installContinueBtn');
    const status=document.getElementById('installStatus');
    const store=selectionStore();
    const assignments=Object.entries(store).filter(([,users])=>Array.isArray(users)&&users.length);
    const users=guestSafeUsers();

    if(btn) btn.disabled=true;
    if(status) status.textContent='Preparing your selected applications…';

    try{
      if(typeof AppStore_serverPackages!=='function') throw new Error('The App Store service is not available.');
      const packages=await loadCatalogue();
      const byKey=new Map(packages.map(p=>[appKey(p),p]));
      let completed=0;
      const total=assignments.reduce((n,[,names])=>n+names.length,0);

      for(const [key,names] of assignments){
        const pkg=byKey.get(key);
        if(!pkg?.pkg?.zip) continue;
        const bytes=await pkg.pkg.zip.generateAsync({type:'uint8array'});
        for(const name of names){
          if(!users.some(u=>u.name===name)) continue;
          if(status) status.textContent=`Installing ${pkg.name||key} for ${name}…`;
          await writePackageForUser(name,pkg,bytes);
          completed++;
        }
      }

      saveSelectionStore({});
      if(status) status.textContent=total ? `${completed} installation${completed===1?'':'s'} ready.` : 'No apps selected. You can install apps later.';
      setStage('security');
      setTimeout(()=>JackOS_OOBE_startSecurity(),550);
    }catch(error){
      if(status) status.textContent='Some apps could not be installed. '+(error?.message||'Please try again.');
      if(btn) btn.disabled=false;
    }
  };

  // Modernise the existing security-question modal without replacing its storage logic.
  window.Setup_promptSecurityQuestions=function(){
    const names=SetupSecQState.accountNames || [];
    if(SetupSecQState.accountIndex < names.length){
      const name=names[SetupSecQState.accountIndex];
      const dialog=document.getElementById('secqSetupDialog');
      const heading=dialog?.querySelector('h3');
      if(heading) heading.textContent='Protect '+name+'';
      const intro=dialog?.querySelector('.panel > div[style*="opacity"]');
      if(intro) intro.innerHTML='<span class="security-progress">Question set '+(SetupSecQState.accountIndex+1)+' of '+names.length+'</span><br>Choose three questions only you can answer.';
      if(dialog){
        dialog.dataset.user=name;
        dialog.style.display='flex';
        dialog.classList.add('oobe-modal');
        if(typeof SecQ_openSetupWizard==='function') SecQ_openSetupWizard(name);
      }
      setStage('security');
    }else{
      const dialog=document.getElementById('secqSetupDialog'); if(dialog) dialog.style.display='none';
      setStage('final'); JackOS_OOBE_finalise();
    }
  };

  window.Setup_nextAccount=function(){
    SetupSecQState.accountIndex++;
    Setup_promptSecurityQuestions();
  };

  window.JackOS_OOBE_startSecurity=function(){
    const names=Users_all().filter(u=>!u.guest).map(u=>u.name);
    SetupSecQState.accountIndex=0;
    SetupSecQState.accountNames=names;
    if(!names.length){ setStage('final'); JackOS_OOBE_finalise(); return; }
    Setup_promptSecurityQuestions();
  };

  window.JackOS_OOBE_finalise=function(){
    setStage('final');
    screen('finalSetup',true);
    const list=document.getElementById('finalChecklist');
    const bar=document.getElementById('finalProgressBar');
    if(!list) return;
    list.innerHTML='';
    const steps=[
      ['profiles','Creating User Profiles'],
      ['security','Configuring Security'],
      ['apps','Installing Applications'],
      ['edition','Applying Edition Features'],
      ['finish','Finalising JackOS']
    ];
    steps.forEach(([key,label])=>{
      const row=document.createElement('div'); row.className='final-step'; row.dataset.step=key;
      row.innerHTML='<span class="final-step-icon">○</span><span class="final-step-label"></span>';
      row.querySelector('.final-step-label').textContent=label;
      list.appendChild(row);
    });

    const mark=(key,state)=>{
      const row=list.querySelector(`[data-step="${key}"]`); if(!row) return;
      row.classList.remove('active','done'); row.classList.add(state);
      const icon=row.querySelector('.final-step-icon'); if(icon) icon.textContent=state==='done'?'✓':state==='active'?'…':'○';
    };
    const progress=(n)=>{ if(bar) bar.style.width=Math.round(n/steps.length*100)+'%'; };

    mark('profiles','active'); progress(0);
    setTimeout(()=>{mark('profiles','done');mark('security','active');progress(1);},500);
    setTimeout(()=>{mark('security','done');mark('apps','active');progress(2);},950);
    setTimeout(()=>{mark('apps','done');mark('edition','active');progress(3);},1400);
    setTimeout(()=>{mark('edition','done');mark('finish','active');progress(4);},1850);
    setTimeout(()=>{
      mark('finish','done'); progress(5);
      localStorage.setItem(OOBE_KEY,'true');
      localStorage.removeItem(STAGE_KEY);
      setTimeout(()=>{
        show('login',true);
        currentUser=Users_all().find(u=>!u.guest)?.name || Users_all()[0]?.name || '';
        localStorage.setItem('jackosLastUser',currentUser);
        Login_applyUser();
      },700);
    },2250);
  };

  // Improve the account screen's live edition label whenever it opens.
  const originalSetupOpen=window.Setup_open;
  window.Setup_open=function(){
    if(typeof originalSetupOpen==='function') originalSetupOpen();
    setBadge('setupEditionBadge');
  };

  // Fill in the setup modal through the existing security-question engine.
  // SecQ_openSetupWizard is defined by JackOS-SecurityQuestions.js.
  const originalSecQSave=window.SecQ_setupSave;
  if(originalSecQSave){
    // Keep the original implementation; it already saves per-account records.
  }

  // Upgrade edition helper gaps so Elite inherits Private/Pro capabilities.
  window.Edition_IsPrivateOrPro=function(){
    return JackOS_IsActivated() && ['Private','Pro','Elite'].includes(JACKOS_EDITION);
  };
  window.Edition_IsPro=function(){
    return JackOS_IsActivated() && ['Pro','Elite'].includes(JACKOS_EDITION);
  };

  // Patch the existing setup dialog copy so it feels like OOBE rather than a legacy modal.
  document.addEventListener('DOMContentLoaded',()=>{
    const d=document.getElementById('secqSetupDialog');
    if(d){
      d.classList.add('oobe-modal');
      const p=d.querySelector('.panel');
      if(p) p.classList.add('oobe-security-panel');
    }
  });

  // If the page was opened with an activated edition but no startup event can run,
  // keep the normal login/setup fallback available.
  window.JackOS_OOBE_startIfNeeded=function(){
    if(complete()) return;
    if(JackOS_IsActivated()) JackOS_OOBE_resume();
  };
})();
