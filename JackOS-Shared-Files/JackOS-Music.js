//JackOS-Music.js
// ===== Music =====
const JACKOS_SERVER_ROOT = '../JackOS-Server-Files/';
const MusicState = {
  mode: 'home',
  page: 'home',
  pageTitle: 'Home',
  visibleSongs: [],
  playbackQueue: [],
  queueActive: false,
  repeatMode: 'off',
  selectedGenre: '',
  selectedArtist: '',
  selectedAlbum: '',
  selectedPlaylist: '',
  searchQuery: '',
  searchScope: 'music',
  searchScopeBeforeOffline: 'music',
  artistScope: 'music',
  albumScope: 'music',
  catalogue: [],
  library: [],
  playlists: [],
  favourites: [],
  currentIndex: -1,
  currentSong: null,
  loop: false,
  offline: false,
  audio: null,
  artworkUrls: new Map()
};
let musicChoiceResolver=null;
function Music_libraryKey(){ return 'jackosMusicLibraryJks:'+UserData_key(); }

function Music_defaultLibrary(){
  try{
    const raw = localStorage.getItem(Music_libraryKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  }catch(e){ return []; }
}
function Music_saveLibrary(list){
  const serialized=JSON.stringify(list || []);
  try{ localStorage.setItem(Music_libraryKey(), serialized); }catch(e){}
  return Music_writeLibraryFile(serialized);
}
async function Music_directory(){
  const root=await navigator.storage.getDirectory();
  const drive=await UserData_dir();
  return await drive.getDirectoryHandle('Music',{create:true});
}
async function Music_readLibraryFile(){
  try{
    const directory=await Music_directory();
    const handle=await directory.getFileHandle('Library.jks');
    const parsed=JSON.parse(await (await handle.getFile()).text());
    return Array.isArray(parsed) ? parsed : [];
  }catch(e){ return null; }
}
async function Music_writeLibraryFile(serialized){
  try{
    const directory=await Music_directory();
    const handle=await directory.getFileHandle('Library.jks',{create:true});
    const writable=await handle.createWritable();
    await writable.write(serialized);
    await writable.close();
  }catch(e){}
}
async function Music_loadStoredLibrary(){
  const stored=await Music_readLibraryFile();
  if(stored) {
    await Music_saveLibrary(stored);
    return stored;
  }
  const fallback=Music_defaultLibrary();
  if(fallback.length) await Music_saveLibrary(fallback);
  return fallback;
}
let musicLibraryQueue=Promise.resolve();

function Music_pick(obj, keys, fallback=''){
  for(const key of keys){ if(obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return String(obj[key]); }
  return fallback;
}
function Music_normalizeSong(raw, id){
  const song=raw || {};
  const fallbackName=String(song.fileName || song.filename || id || '').split('/').pop();
  return {
  id: String(
    song.id ||
    song.slug ||
    id ||
    ''
  ),

  title: Music_pick(
    song,
    ['title'],
    fallbackName
  ),

  artist: Music_pick(
    song,
    ['artist'],
    'Unknown Artist'
  ),

  album: Music_pick(
    song,
    ['album'],
    'Unknown Album'
  ),

  genre: Music_pick(song, ['genre'], ''),
  year: song.year || '',
  artworkData: song.artworkData || '',
  audioData: song.audioData || ''
};
}

function Music_normalizeGenre(value){
  const text=String(value||'').trim().replace(/\s+/g,' ');
  if(!text) return '';
  return text.split(' ').map(word=>word.charAt(0).toLocaleUpperCase()+word.slice(1).toLocaleLowerCase()).join(' ');
}

function Music_readArray(key){
  try{ const value=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(value)?value:[]; }
  catch(e){ return []; }
}

function Music_loadCollections(){
  MusicState.playlists=Music_readArray('jackosMusicPlaylists').filter(item=>item&&typeof item.name==='string').map(item=>({name:item.name,songs:Array.isArray(item.songs)?item.songs.map(String):[]}));
  MusicState.favourites=Music_readArray('jackosMusicFavourites').map(String);
}

function Music_savePlaylists(){ try{ localStorage.setItem('jackosMusicPlaylists',JSON.stringify(MusicState.playlists)); }catch(e){} }
function Music_saveFavourites(){ try{ localStorage.setItem('jackosMusicFavourites',JSON.stringify(MusicState.favourites)); }catch(e){} }


function Music_id(song){ return song.id || `${song.title}|${song.artist}|${song.album}`; }

async function Music_loadCatalogue(){

  const listResponse = await fetch(
    `${JACKOS_SERVER_ROOT}Music/Songs.json`,
    {
      cache:'no-store'
    }
  );

  if(!listResponse.ok){
    throw new Error(
      'Music catalogue unavailable'
    );
  }

  const zipList =
    await listResponse.json();

  const songs=[];
  const loadingWrap =
  document.getElementById(
    'musicLoadingWrap'
  );

const loadingBar =
  document.getElementById(
    'musicLoadingBar'
  );

if(loadingWrap)
  loadingWrap.style.display =
    'block';

if(loadingBar)
  loadingBar.style.width =
    '0%';

const total =
  zipList.length || 1;

let loaded = 0;

  for(const zipPath of zipList){

    try{

      const zipUrl =
        `${JACKOS_SERVER_ROOT}Music/${zipPath}`;

      const response =
        await fetch(zipUrl);

      if(!response.ok)
        continue;

      const blob =
        await response.blob();

      const zip =
        await JSZip.loadAsync(blob);

     const jsonFiles =
  Object.keys(zip.files)
    .filter(name => {

      const lower =
        name.toLowerCase();

      return (
        lower.endsWith('.json')
        &&
        !lower.includes('__macosx/')
        &&
        !lower.includes('/._')
      );

    });

if(jsonFiles.length === 0){

  console.warn(
    'Song skipped (no JSON file):',
    zipPath
  );

  continue;

}

if(jsonFiles.length > 1){

  console.warn(
    'Song skipped (multiple JSON files):',
    zipPath
  );

  continue;

}
     

      if(jsonFiles.length !== 1){

        console.warn(
          'Song skipped (must contain exactly one JSON):',
          zipPath
        );

        continue;

      }

      const metadata =
        JSON.parse(
          await zip.file(
            jsonFiles[0]
          ).async('text')
        );

      const requiredFields=['title','artist','album','genre','audio'];
      const missingField=requiredFields.find(key=>typeof metadata?.[key]!=='string' || !metadata[key].trim());
      if(missingField){
        console.warn('Song skipped (missing required metadata):',zipPath,missingField);
        continue;
      }

      const audioFile =
  Object.values(zip.files)
    .find(file =>
      !file.dir &&
      file.name
        .split('/')
        .pop()
        .toLowerCase() ===
      String(
        metadata.audio
      ).toLowerCase()
    );
      if(!audioFile){

        console.warn(
          'Song skipped (missing audio):',
          zipPath
        );

        continue;

      }

      const audioEntry =
  metadata.audio;

      let artworkData =
        `${JACKOS_SERVER_ROOT}Music/Trans-Music.png`;

     const artworkFile =
  metadata.artwork
    ? Object.values(zip.files)
        .find(file =>
          !file.dir &&
          file.name
            .split('/')
            .pop()
            .toLowerCase() ===
          String(
            metadata.artwork
          ).toLowerCase()
        )
    : null;

if(artworkFile){

        const artworkBlob =
  await artworkFile.async(
    'blob'
  );

        artworkData=await Music_blobToDataUrl(artworkBlob);

      }

      songs.push({

  id: zipPath,

  zipUrl,

  audioEntry,
  artworkEntry: metadata.artwork || '',

  title: metadata.title.trim(),

  artist: metadata.artist.trim(),

  album: metadata.album.trim(),

  genre: Music_normalizeGenre(metadata.genre),

  year: metadata.year || '',

  artworkData

});
loaded++;

const percent =
  Math.floor(
    (loaded / total) * 100
  );

const notice =
  document.getElementById(
    'musicNotice'
  );

if(notice){

  notice.textContent =
    `Loading ${loaded}/${total} (${percent}%)`;

}

if(loadingBar)
  loadingBar.style.width =
    percent + '%';
    }catch(error){

      console.warn(
        'Song skipped:',
        zipPath,
        error
      );

    }

  }

  if(loadingBar)
  loadingBar.style.width =
    '100%';

setTimeout(()=>{

  if(loadingWrap)
    loadingWrap.style.display =
      'none';

},300);

return songs;

}
async function Music_ensureSystem(){
  if(localStorage.getItem(Music_libraryKey()) === null) Music_saveLibrary([]);
  if(navigator.storage?.getDirectory){
    try{
      const music=await Music_directory();

const libraryHandle=
  await music.getFileHandle(
    'Library.jks',
    {create:true}
  );

      const libraryText=await (await libraryHandle.getFile()).text();
      if(!libraryText.trim()) await libraryHandle.createWritable().then(async writable=>{ await writable.write(localStorage.getItem(Music_libraryKey())||'[]'); await writable.close(); });
    }catch(e){ /* The localStorage library remains the portable fallback. */ }
  }
}
function Music_artworkUrl(song){

  return (
    song.artworkData ||
    `${JACKOS_SERVER_ROOT}Music/Trans-Music.png`
  );

}

function Music_audioMime(song){
  const path=String(song?.audioType||song?.audioEntry||song?.fileName||song?.title||song?.id||'').toLowerCase();
  if(path.endsWith('.wav')) return 'audio/wav';
  if(path.endsWith('.mp3')) return 'audio/mpeg';
  if(path.endsWith('.m4a')) return 'audio/mp4';
  if(path.endsWith('.aac')) return 'audio/aac';
  if(path.endsWith('.flac')) return 'audio/flac';
  if(path.endsWith('.ogg')||path.endsWith('.oga')) return 'audio/ogg';
  return 'audio/mpeg';
}

function Music_typedAudioBlob(blob,song){
  const expected=Music_audioMime(song);
  return blob.type&&blob.type!=='application/octet-stream'?blob:new Blob([blob],{type:expected});
}

function Music_typedAudioUrl(value,song){
  if(!value||!value.startsWith('data:')) return value;
  const match=value.match(/^data:([^;,]*)(;base64)?,(.*)$/s);
  if(!match||match[1]!=='application/octet-stream') return value;
  return value.replace(/^data:application\/octet-stream/i,`data:${Music_audioMime(song)}`);
}
function Music_revokeArtworkUrls(){
  for(const url of MusicState.artworkUrls.values()) URL.revokeObjectURL(url);
  MusicState.artworkUrls.clear();
}
function Music_allSongs(){
  if(MusicState.offline) return [...MusicState.library];
  const songs=[...MusicState.catalogue];
  MusicState.library.forEach(song=>{ if(!songs.some(item=>Music_id(item)===Music_id(song))) songs.push(song); });
  return songs;
}

function Music_unique(values){
  const seen=new Set();
  return values.filter(value=>{ const key=String(value||'').trim().toLocaleLowerCase(); if(!key||seen.has(key)) return false; seen.add(key); return true; });
}

function Music_albumGroups(songs){
  const groups=new Map();
  songs.forEach(song=>{
    const title=String(song.album||'Unknown Album').trim();
    const key=title.toLocaleLowerCase();
    if(!groups.has(key)) groups.set(key,{name:title,songs:[]});
    groups.get(key).songs.push(song);
  });
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));
}

function Music_makeBrowseCard(label,detail,song,onSelect,icon=''){
  const button=document.createElement('button'); button.type='button'; button.className='music-browse-card';
  const artwork=document.createElement('img'); artwork.src=song?Music_artworkUrl(song):`${JACKOS_SERVER_ROOT}Music/Trans-Music.png`; artwork.alt=label+' artwork';
  const text=document.createElement('span'); text.className='music-browse-card-copy';
  const title=document.createElement('strong'); title.textContent=`${icon?icon+' ':''}${label}`;
  const subtitle=document.createElement('small'); subtitle.textContent=detail;
  text.append(title,subtitle); button.append(artwork,text); button.addEventListener('click',onSelect); return button;
}

function Music_makeBrowseEntry(label,detail,song,onSelect,queueSongs,icon=''){
  const entry=document.createElement('div'); entry.className='music-browse-entry';
  entry.appendChild(Music_makeBrowseCard(label,detail,song,onSelect,icon));
  entry.appendChild(Music_makeButton('＋ Queue',()=>Music_addToQueue(queueSongs), 'explorer-btn ghost music-queue-button'));
  return entry;
}

function Music_genres(){
  const byKey=new Map();
  Music_allSongs().forEach(song=>{ const genre=Music_normalizeGenre(song.genre); if(genre&&!byKey.has(genre.toLocaleLowerCase())) byKey.set(genre.toLocaleLowerCase(),genre); });
  return [...byKey.values()].sort((a,b)=>a.localeCompare(b));
}

function Music_makeButton(label,action,className='explorer-btn ghost'){
  const button=document.createElement('button'); button.type='button'; button.className=className; button.textContent=label; button.addEventListener('click',action); return button;
}

function Music_makeNavButton(icon,label,action,active=false){
  const button=document.createElement('button'); button.type='button'; button.className='music-nav-button'+(active?' active':'');
  const symbol=document.createElement('span'); symbol.className='music-nav-icon'; symbol.textContent=icon;
  const text=document.createElement('span'); text.textContent=label;
  button.append(symbol,text); button.addEventListener('click',action); return button;
}

function Music_makeSection(title,items,action){
  const section=document.createElement('section'); section.className='music-section';
  const heading=document.createElement('h2'); heading.textContent=title; section.appendChild(heading);
  const row=document.createElement('div'); row.className='music-chip-row';
  items.forEach(item=>row.appendChild(Music_makeButton(item,()=>action(item))));
  if(!items.length){ const empty=document.createElement('p'); empty.className='music-muted'; empty.textContent='Nothing here yet.'; row.appendChild(empty); }
  section.appendChild(row); return section;
}

function Music_makeSongCard(song,songs,context='catalogue'){
  const card=document.createElement('article'); card.className='music-card';
  const artwork=document.createElement('img'); artwork.className='music-artwork'; artwork.alt=`${song.album||'Album'} artwork`; artwork.src=Music_artworkUrl(song);
  const meta=document.createElement('div'); meta.className='music-meta';
  const title=document.createElement('strong'); title.textContent=song.title||'Untitled Song';
  const artist=document.createElement('span'); artist.textContent=song.artist||'Unknown Artist';
  const album=document.createElement('button'); album.type='button'; album.className='music-album-line music-album-link'; album.textContent=song.album||'Unknown Album';
  album.addEventListener('click',()=>Music_setPage('album',song.album||'Unknown Album',context==='library'?'library':'music'));
  meta.append(title,artist,album);
  const actions=document.createElement('div'); actions.className='music-actions';
  actions.appendChild(Music_makeButton('▶',()=>Music_playSong(song,songs),'explorer-btn'));
  actions.appendChild(Music_makeButton('＋ Queue',()=>Music_addToQueue([song]),'explorer-btn ghost'));
  const isFavourite=MusicState.favourites.includes(String(Music_id(song)));
  actions.appendChild(Music_makeButton(isFavourite?'♥ Favourited':'♡ Favourite',()=>Music_toggleFavourite(song), 'explorer-btn ghost'));
  const inLibrary=MusicState.library.some(item=>Music_id(item)===Music_id(song));
  if(context==='library') actions.appendChild(Music_makeButton('−',()=>Music_removeFromLibrary(song),'explorer-btn danger'));
  else if(!inLibrary) actions.appendChild(Music_makeButton('Add to library',()=>Music_addToLibrary(song),'explorer-btn ghost'));
  if(MusicState.playlists.length) actions.appendChild(Music_makeButton('Add to playlist',()=>Music_addSongToPlaylist(song),'explorer-btn ghost'));
  if(context==='playlist') actions.appendChild(Music_makeButton('Remove from playlist',()=>Music_removeSongFromPlaylist(song),'explorer-btn danger'));
  card.append(artwork,meta,actions); return card;
}

function Music_showSongs(container,songs,context='catalogue',emptyMessage='No songs found.'){
  MusicState.visibleSongs=songs;
  if(!songs.length){ const empty=document.createElement('div'); empty.className='music-empty'; empty.textContent=emptyMessage; container.appendChild(empty); return; }
  const grid=document.createElement('div'); grid.className='music-song-grid';
  songs.forEach(song=>grid.appendChild(Music_makeSongCard(song,songs,context)));
  container.appendChild(grid);
}

function Music_promptDuplicate(title,message){
  const backdrop=document.getElementById('musicChoiceDialog');
  if(!backdrop){ return Promise.resolve(confirm(`${message}\n\nAdd it again?`)); }
  document.getElementById('musicChoiceTitle').textContent=title;
  document.getElementById('musicChoiceMessage').textContent=message;
  backdrop.hidden=false;
  document.getElementById('musicChoiceSkip')?.focus();
  return new Promise(resolve=>{ musicChoiceResolver=resolve; });
}

function Music_resolveDuplicate(addAgain){
  const backdrop=document.getElementById('musicChoiceDialog');
  if(backdrop) backdrop.hidden=true;
  const resolve=musicChoiceResolver; musicChoiceResolver=null;
  if(resolve) resolve(addAgain);
}

function Music_showQueue(){
  const dialog=document.getElementById('musicQueueDialog'); if(!dialog) return;
  Music_renderQueue(); dialog.hidden=false;
}

function Music_renderQueue(){
  const host=document.getElementById('musicQueueList'); if(!host) return;
  host.replaceChildren();
  const songs=MusicState.playbackQueue;
  if(!songs.length){ const empty=document.createElement('p'); empty.className='music-queue-empty'; empty.textContent='Your queue is empty.'; host.appendChild(empty); return; }
  songs.forEach((song,index)=>{
    const row=document.createElement('article'); row.className='music-queue-row'+(index===MusicState.currentIndex?' current':'');
    const art=document.createElement('img'); art.src=Music_artworkUrl(song); art.alt=`${song.album||'Song'} artwork`;
    const info=document.createElement('div'); info.className='music-queue-info';
    const title=document.createElement('strong'); title.textContent=song.title||'Untitled Song';
    const subtitle=document.createElement('span'); subtitle.textContent=`${song.artist||'Unknown Artist'} · ${song.album||'Unknown Album'}`;
    info.append(title,subtitle);
    const state=document.createElement('small'); state.className='music-queue-state'; state.textContent=index===MusicState.currentIndex?'Playing':index>MusicState.currentIndex?'Next':'Played';
    const remove=Music_makeButton('−',()=>Music_removeFromQueue(index),'explorer-btn ghost music-queue-remove');
    remove.title='Remove from queue'; remove.setAttribute('aria-label',`Remove ${song.title||'song'} from queue`); remove.disabled=index===MusicState.currentIndex;
    row.append(art,info,state,remove); host.appendChild(row);
  });
}

async function Music_addToQueue(songs){
  const additions=(Array.isArray(songs)?songs:[songs]).filter(Boolean);
  if(!additions.length){ alert('There are no playable songs to add.'); return; }
  const current=MusicState.playbackQueue.length?MusicState.playbackQueue:(MusicState.currentSong?[MusicState.currentSong]:[]);
  const startIndex=current.length;
  if(!MusicState.playbackQueue.length&&MusicState.currentSong) MusicState.playbackQueue=[MusicState.currentSong];
  if(!MusicState.currentSong&&current.length) MusicState.playbackQueue=[...current];
  let added=0;
  for(const song of additions){
    const duplicate=MusicState.playbackQueue.some(item=>Music_id(item)===Music_id(song));
    if(duplicate){
      const addAgain=await Music_promptDuplicate('Song is already in the queue',`“${song.title}” is already in the queue.`);
      if(!addAgain) continue;
    }
    MusicState.playbackQueue.push(song); added++;
  }
  if(added){
    MusicState.queueActive=true;
    if(!MusicState.currentSong||MusicState.audio?.ended){ const index=MusicState.currentSong?startIndex:0; MusicState.currentIndex=index; Music_play(index,MusicState.playbackQueue); }
    else MusicState.currentIndex=MusicState.playbackQueue.indexOf(MusicState.currentSong);
  }
  Music_renderQueue();
  if(added) alert(`Added ${added} song${added===1?'':'s'} to the queue.`);
}

function Music_removeFromQueue(index){
  if(index===MusicState.currentIndex||index<0||index>=MusicState.playbackQueue.length) return;
  MusicState.playbackQueue.splice(index,1);
  if(index<MusicState.currentIndex) MusicState.currentIndex--;
  if(MusicState.playbackQueue.length<=1) MusicState.queueActive=false;
  Music_renderQueue();
}

async function Music_playSong(song,songs){
  if(MusicState.queueActive){
    const clear=confirm('Playing this selection will clear the current queue. Continue?');
    if(!clear) return;
    MusicState.queueActive=false;
  }
  const queue=[song];
  const index=0;
  MusicState.playbackQueue=queue;
  Music_play(index,queue);
}

async function Music_playSelection(songs){
  if(!songs.length) return;
  if(MusicState.queueActive){
    const clear=confirm('Playing this selection will clear the current queue. Continue?');
    if(!clear) return;
  }
  MusicState.queueActive=songs.length>1;
  MusicState.playbackQueue=songs;
  Music_play(0,songs);
}

function Music_setPage(page,value='',scope='music'){
  MusicState.page=page;
  MusicState.selectedGenre=page==='genre'?value:'';
  MusicState.selectedArtist=page==='artist'?value:'';
  MusicState.selectedAlbum=page==='album'?value:'';
  MusicState.selectedPlaylist=page==='playlist'?value:'';
  if(page==='album') MusicState.albumScope=scope;
  if(page==='artist') MusicState.artistScope=scope;
  MusicState.mode=page==='library'?'library':'home';
  const titles={home:'Home',recent:'Recently Added',artists:'Artists',albums:'Albums',songs:'Songs',genres:'Genres',library:'Library',favourites:'Favourite Songs',playlists:'Playlists',search:'Search Music',genre:value,artist:value,album:value,playlist:value};
  MusicState.pageTitle=titles[page]||'Music';
  document.querySelectorAll('[data-music-page]').forEach(button=>button.classList.toggle('active',button.dataset.musicPage===page));
  Music_render();
}

function Music_renderSidebar(){
  const host=document.getElementById('musicPlaylistNav'); if(!host) return;
  host.replaceChildren();
  MusicState.playlists.forEach(playlist=>host.appendChild(Music_makeNavButton('📁',playlist.name,()=>Music_setPage('playlist',playlist.name),MusicState.page==='playlist'&&MusicState.selectedPlaylist===playlist.name)));
}

function Music_render(){
  const list=document.getElementById('musicList'); if(!list) return;
  MusicState.visibleSongs=[];
  Music_revokeArtworkUrls();
  const heading=document.getElementById('musicPageTitle'); if(heading) heading.textContent=MusicState.pageTitle;
  const searchPanel=document.getElementById('musicSearchPanel'); if(searchPanel) searchPanel.hidden=MusicState.page!=='search';
  const searchInput=document.getElementById('musicSearchInput'); if(searchInput&&MusicState.page==='search'&&document.activeElement!==searchInput) searchInput.value=MusicState.searchQuery;
  if(MusicState.offline) MusicState.searchScope='library';
  document.querySelectorAll('[data-music-search-scope]').forEach(button=>{
    const isMusicScope=button.dataset.musicSearchScope==='music';
    button.hidden=MusicState.offline&&isMusicScope;
    button.disabled=MusicState.offline&&isMusicScope;
    button.classList.toggle('active',button.dataset.musicSearchScope===(MusicState.offline?'library':MusicState.searchScope));
  });
  Music_renderSidebar(); list.replaceChildren();
  const all=Music_allSongs();
  const albums=Music_albumGroups(all);
  const artists=Music_unique(all.map(song=>song.artist)).sort((a,b)=>a.localeCompare(b));
  const genres=Music_genres();
  let visible=[];

  if(MusicState.page==='home'){
    const recent=[...MusicState.library].slice(-8).reverse();
    const recentSection=document.createElement('section'); recentSection.className='music-section';
    const recentHeading=document.createElement('h2'); recentHeading.textContent='Recently Added'; recentSection.appendChild(recentHeading);
    Music_showSongs(recentSection,recent,'library','Your recently added music will appear here.'); list.appendChild(recentSection);
    list.append(Music_makeSection('Genres',genres,value=>Music_setPage('genre',value)));
    list.append(Music_makeSection('Artists',artists,value=>Music_setPage('artist',value)));
    return;
  }
  if(MusicState.page==='search'){
    const browse=document.createElement('section'); browse.className='music-section';
    const browseHeading=document.createElement('h2'); browseHeading.textContent='Browse Categories'; browse.appendChild(browseHeading);
    const chips=document.createElement('div'); chips.className='music-chip-row';
    genres.forEach(genre=>chips.appendChild(Music_makeButton(genre,()=>Music_setPage('genre',genre))));
    if(!genres.length){ const empty=document.createElement('p'); empty.className='music-muted'; empty.textContent='Genres will appear here when music is available.'; chips.appendChild(empty); }
    browse.appendChild(chips); list.appendChild(browse);
    if(MusicState.searchQuery){
      const query=MusicState.searchQuery.toLocaleLowerCase();
      const searchSongs=MusicState.searchScope==='library'?MusicState.library:MusicState.catalogue;
      visible=searchSongs.filter(song=>[song.title,song.artist,song.album].some(value=>String(value||'').toLocaleLowerCase().includes(query)));
      const artistMatches=Music_unique(searchSongs.filter(song=>String(song.artist||'').toLocaleLowerCase().includes(query)).map(song=>song.artist));
      const albumMatches=Music_albumGroups(searchSongs).filter(group=>group.name.toLocaleLowerCase().includes(query));
      const playlistMatches=MusicState.playlists.filter(playlist=>playlist.name.toLocaleLowerCase().includes(query));
      const resultHeading=document.createElement('h2'); resultHeading.textContent='Results'; list.appendChild(resultHeading);
      artistMatches.forEach(artist=>list.appendChild(Music_makeBrowseCard(artist,'Artist',searchSongs.find(song=>song.artist===artist),()=>Music_setPage('artist',artist,MusicState.searchScope),'🎤')));
      albumMatches.forEach(group=>list.appendChild(Music_makeBrowseEntry(group.name,`${group.songs.length} songs`,group.songs[0],()=>Music_setPage('album',group.name,MusicState.searchScope),group.songs,'💿')));
      playlistMatches.forEach(playlist=>{ const playlistSongs=playlist.songs.map(id=>Music_allSongs().find(song=>String(Music_id(song))===String(id))).filter(Boolean); list.appendChild(Music_makeBrowseEntry(playlist.name,'Playlist',playlistSongs[0],()=>Music_setPage('playlist',playlist.name),playlistSongs,'📁')); });
      Music_showSongs(list,visible,MusicState.searchScope==='library'?'library':'catalogue','No matching songs, artists, albums or playlists.');
    }
    return;
  }
  if(MusicState.page==='recent'){
    Music_showSongs(list,[...MusicState.library].reverse(),'library','Your recently added music will appear here.'); return;
  }
  else if(MusicState.page==='songs') visible=all;
  else if(MusicState.page==='library') visible=MusicState.library;
  else if(MusicState.page==='favourites') visible=MusicState.favourites.map(id=>all.find(song=>String(Music_id(song))===id)).filter(Boolean);
  else if(MusicState.page==='genre') visible=all.filter(song=>Music_normalizeGenre(song.genre).toLocaleLowerCase()===MusicState.selectedGenre.toLocaleLowerCase());
  else if(MusicState.page==='artist'){
    const artistSource=MusicState.artistScope==='library'?MusicState.library:all;
    visible=artistSource.filter(song=>song.artist===MusicState.selectedArtist);
    const artistAlbums=Music_albumGroups(visible);
    artistAlbums.forEach(group=>list.appendChild(Music_makeBrowseEntry(group.name,`${group.songs.length} ${group.songs.length===1?'song':'songs'}`,group.songs[0],()=>Music_setPage('album',group.name,MusicState.artistScope),group.songs,'💿')));
    const heading=document.createElement('h2'); heading.textContent='Songs'; list.appendChild(heading);
  } else if(MusicState.page==='album'){
    const albumSource=MusicState.albumScope==='library'?MusicState.library:all;
    visible=albumSource.filter(song=>String(song.album||'').trim().toLocaleLowerCase()===MusicState.selectedAlbum.trim().toLocaleLowerCase());
    if(visible.length){
      const detail=document.createElement('div'); detail.className='music-album-detail';
      const art=document.createElement('img'); art.src=Music_artworkUrl(visible[0]); art.alt=`${MusicState.selectedAlbum} artwork`; art.className='music-album-artwork';
      const info=document.createElement('div'); const title=document.createElement('h2'); title.textContent=MusicState.selectedAlbum; const artist=document.createElement('p'); artist.textContent=visible[0].artist; const year=document.createElement('p'); year.textContent=visible[0].year?String(visible[0].year):''; info.append(title,artist,year,Music_makeButton('▶ Play Album',()=>Music_playSelection(visible),'explorer-btn'),Music_makeButton('＋ Add album to queue',()=>Music_addToQueue(visible),'explorer-btn ghost')); detail.append(art,info); list.appendChild(detail);
    }
  } else if(MusicState.page==='artists'){
    artists.forEach(artist=>{ const artistSongs=all.filter(song=>song.artist===artist); list.appendChild(Music_makeBrowseCard(artist,`${artistSongs.length} ${artistSongs.length===1?'song':'songs'}`,artistSongs[0],()=>Music_setPage('artist',artist),'🎤')); }); return;
  } else if(MusicState.page==='albums'){
    albums.forEach(group=>list.appendChild(Music_makeBrowseEntry(group.name,`${group.songs.length} ${group.songs.length===1?'song':'songs'}`,group.songs[0],()=>Music_setPage('album',group.name),group.songs,'💿'))); return;
  } else if(MusicState.page==='genres'){
    genres.forEach(genre=>{ const songs=all.filter(song=>Music_normalizeGenre(song.genre).toLocaleLowerCase()===genre.toLocaleLowerCase()); list.appendChild(Music_makeBrowseCard(genre,`${songs.length} ${songs.length===1?'song':'songs'}`,songs[0],()=>Music_setPage('genre',genre),'🏷')); }); return;
  } else if(MusicState.page==='playlists'){
    const create=Music_makeButton('＋ New Playlist',Music_createPlaylist,'explorer-btn'); list.appendChild(create);
    if(!MusicState.playlists.length){ const empty=document.createElement('div'); empty.className='music-empty'; empty.textContent='Create a playlist to get started.'; list.appendChild(empty); return; }
    MusicState.playlists.forEach(playlist=>{
      const card=document.createElement('article'); card.className='music-playlist-card';
      const playlistSongs=playlist.songs.map(id=>all.find(song=>String(Music_id(song))===String(id))).filter(Boolean);
      card.append(Music_makeBrowseCard(playlist.name,`${playlistSongs.length} songs`,playlistSongs[0],()=>Music_setPage('playlist',playlist.name)));
      card.appendChild(Music_makeButton('＋ Queue Playlist',()=>Music_addToQueue(playlistSongs),'explorer-btn ghost music-queue-button'));
      card.append(Music_makeButton('Rename',()=>Music_renamePlaylist(playlist),'explorer-btn ghost'),Music_makeButton('Delete',()=>Music_deletePlaylist(playlist),'explorer-btn danger')); list.appendChild(card);
    }); return;
  } else if(MusicState.page==='playlist'){
    const playlist=MusicState.playlists.find(item=>item.name===MusicState.selectedPlaylist);
    if(!playlist){ Music_setPage('playlists'); return; }
    const toolbar=document.createElement('div'); toolbar.className='music-detail-actions';
    visible=playlist.songs.map(id=>all.find(song=>String(Music_id(song))===String(id))).filter(Boolean);
    toolbar.append(Music_makeButton('▶ Play Playlist',()=>Music_playSelection(visible),'explorer-btn'),Music_makeButton('＋ Queue Playlist',()=>Music_addToQueue(visible)),Music_makeButton('Rename playlist',()=>Music_renamePlaylist(playlist)),Music_makeButton('Delete playlist',()=>Music_deletePlaylist(playlist),'explorer-btn danger')); list.appendChild(toolbar);
    Music_showSongs(list,visible,'playlist','This playlist is empty. Add songs from Songs or an album.'); return;
  }
  MusicState.visibleSongs=visible;
  const context=MusicState.page==='library'||(MusicState.page==='album'&&MusicState.albumScope==='library')?'library':'catalogue';
  Music_showSongs(list,visible,context,MusicState.page==='library'?'Your library is empty.':'No songs found.');
}

function Music_setMode(mode){ Music_setPage(mode==='library'?'library':'home'); }

function Music_toggleFavourite(song){
  const id=String(Music_id(song));
  MusicState.favourites=MusicState.favourites.includes(id)?MusicState.favourites.filter(item=>item!==id):[...MusicState.favourites,id];
  Music_saveFavourites(); Music_render();
}

function Music_createPlaylist(){
  const name=(prompt('Playlist name:')||'').trim(); if(!name) return;
  if(MusicState.playlists.some(item=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase())){ alert('A playlist with that name already exists.'); return; }
  MusicState.playlists.push({name,songs:[]}); Music_savePlaylists(); Music_setPage('playlist',name);
}

function Music_renamePlaylist(playlist){
  const name=(prompt('Rename playlist:',playlist.name)||'').trim(); if(!name||name===playlist.name) return;
  if(MusicState.playlists.some(item=>item!==playlist&&item.name.toLocaleLowerCase()===name.toLocaleLowerCase())){ alert('A playlist with that name already exists.'); return; }
  const oldName=playlist.name; playlist.name=name; Music_savePlaylists(); if(MusicState.selectedPlaylist===oldName) MusicState.selectedPlaylist=name; Music_render();
}

function Music_deletePlaylist(playlist){
  if(!confirm(`Delete playlist “${playlist.name}”? Songs will remain in your library.`)) return;
  MusicState.playlists=MusicState.playlists.filter(item=>item!==playlist); Music_savePlaylists(); Music_setPage('playlists');
}

async function Music_addSongToPlaylist(song){
  if(!MusicState.playlists.length){ alert('Create a playlist first.'); return; }
  const options=MusicState.playlists.map((item,index)=>`${index+1}. ${item.name}`).join('\n');
  const answer=prompt(`Add to which playlist? Enter its number or exact name.\n${options}`,'1'); if(!answer) return;
  const playlist=MusicState.playlists[Number(answer)-1]||MusicState.playlists.find(item=>item.name.toLocaleLowerCase()===answer.trim().toLocaleLowerCase());
  if(!playlist){ alert('Playlist not found.'); return; }
  const id=String(Music_id(song));
  if(playlist.songs.includes(id)){
    const addAgain=await Music_promptDuplicate('Song is already in the playlist',`“${song.title}” is already in “${playlist.name}”.`);
    if(!addAgain) return;
  }
  playlist.songs.push(id); Music_savePlaylists(); Music_render();
}

function Music_removeSongFromPlaylist(song){
  const playlist=MusicState.playlists.find(item=>item.name===MusicState.selectedPlaylist); if(!playlist) return;
  playlist.songs=playlist.songs.filter(id=>String(id)!==String(Music_id(song))); Music_savePlaylists(); Music_render();
}
async function Music_removeFromLibrary(song){
  if(!confirm(`Remove “${song.title}” from your library?`)) return;
  musicLibraryQueue=musicLibraryQueue.then(async()=>{
    const library=(await Music_readLibraryFile()) || Music_defaultLibrary();
    const next=library.filter(item=>Music_id(item)!==Music_id(song));
    if(next.length===library.length) return;
    await Music_saveLibrary(next);
    MusicState.library=next;
    if(MusicState.currentSong && Music_id(MusicState.currentSong)===Music_id(song)){
      MusicState.currentSong=null;
      MusicState.currentIndex=-1;
      MusicState.playbackQueue=[];
      MusicState.audio?.pause();
    }
    Music_render();
  });
  try{ await musicLibraryQueue; }catch(e){ alert('Could not remove this song from your library.'); }
}
async function Music_addToLibrary(song, button){
  try{
    let audioBlob=null;
    let artworkData=song.artworkData||'';
    if(song.audioData){
      const response=await fetch(song.audioData); if(!response.ok) throw new Error('Audio unavailable'); audioBlob=await response.blob();
    }else if(song.zipUrl){
      const response=await fetch(song.zipUrl); if(!response.ok) throw new Error('Song package unavailable');
      const zip=await JSZip.loadAsync(await response.blob());
      const audioFile=Object.values(zip.files).find(file=>!file.dir&&file.name.split('/').pop().toLowerCase()===String(song.audioEntry||'').split('/').pop().toLowerCase());
      if(!audioFile) throw new Error('Audio file unavailable');
      audioBlob=Music_typedAudioBlob(await audioFile.async('blob'),Object.assign({},song,{audioEntry:song.audioEntry}));
      if(song.artworkEntry){
        const imageFile=Object.values(zip.files).find(file=>!file.dir&&file.name.split('/').pop().toLowerCase()===String(song.artworkEntry).split('/').pop().toLowerCase());
        if(imageFile) artworkData=await Music_blobToDataUrl(await imageFile.async('blob'));
      }
    }else throw new Error('Audio unavailable');
    const audioData=await Music_blobToDataUrl(Music_typedAudioBlob(audioBlob,song));
    if(artworkData.startsWith('blob:')){ const image=await fetch(artworkData); if(image.ok) artworkData=await Music_blobToDataUrl(await image.blob()); }
    const savedSong=Object.assign({},song,{audioData,artworkData});
    musicLibraryQueue=musicLibraryQueue.then(async()=>{
      const library=(await Music_readLibraryFile())||Music_defaultLibrary();
      if(library.some(item=>Music_id(item)===Music_id(savedSong))){ MusicState.library=library; return; }
      library.push(savedSong); await Music_saveLibrary(library); MusicState.library=library;
    });
    await musicLibraryQueue; Music_render();
  }catch(e){ alert('Could not add this song to your library.'); }
}

function Music_blobToDataUrl(blob){
  return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(blob); });
}

async function Music_importZip(file){
  const zip=await JSZip.loadAsync(file);
  const jsonFiles=Object.keys(zip.files).filter(name=>{
    const lower=name.toLowerCase();
    return lower.endsWith('.json')&&!lower.includes('__macosx/')&&!lower.split('/').pop().startsWith('._');
  });
  if(jsonFiles.length!==1) throw new Error(`${file.name}: ZIP must contain exactly one song metadata JSON file.`);
  const metadata=JSON.parse(await zip.file(jsonFiles[0]).async('text'));
  const required=['title','artist','album','genre','audio'];
  const missing=required.find(key=>typeof metadata?.[key]!=='string'||!metadata[key].trim());
  if(missing) throw new Error(`${file.name}: missing required metadata “${missing}”.`);
  const audioFile=Object.values(zip.files).find(entry=>!entry.dir&&entry.name.split('/').pop().toLocaleLowerCase()===metadata.audio.split('/').pop().toLocaleLowerCase());
  if(!audioFile) throw new Error(`${file.name}: audio member “${metadata.audio}” was not found.`);
  const artworkFile=metadata.artwork?Object.values(zip.files).find(entry=>!entry.dir&&entry.name.split('/').pop().toLocaleLowerCase()===String(metadata.artwork).split('/').pop().toLocaleLowerCase()):null;
  return {
    id:`import:zip:${file.name}:${file.lastModified}:${jsonFiles[0]}`,
    title:metadata.title.trim(),artist:metadata.artist.trim(),album:metadata.album.trim(),
    genre:Music_normalizeGenre(metadata.genre),year:metadata.year||'',
    audioEntry:metadata.audio,audioType:metadata.audio,
    audioData:await Music_blobToDataUrl(Music_typedAudioBlob(await audioFile.async('blob'),{audioEntry:metadata.audio})),
    artworkData:artworkFile?await Music_blobToDataUrl(await artworkFile.async('blob')):'',
    imported:true,importedAt:Date.now()
  };
}

async function Music_play(index,sourceSongs){
  const songs=sourceSongs||(MusicState.playbackQueue.length?MusicState.playbackQueue:(MusicState.mode==='library'?MusicState.library:MusicState.catalogue));
  const song=songs[index]; if(!song || !MusicState.audio) return;
  MusicState.playbackQueue=songs; MusicState.currentIndex=index; MusicState.currentSong=song;
  
  
  try{
  if(!song.audioData&&song.zipUrl){

  const response =
    await fetch(
      song.zipUrl
    );

  const zip =
    await JSZip.loadAsync(
      await response.blob()
    );

  const audioFile =
  Object.values(zip.files)
    .find(file =>
      !file.dir &&
      file.name
        .split('/')
        .pop()
        .toLowerCase() ===
      String(
        song.audioEntry
      ).toLowerCase()
    );

if(!audioFile){

  throw new Error(
    `Audio file not found: ${song.audioEntry}`
  );

}

const audioBlob =
  await audioFile.async(
    'blob'
  );

  song.audioData=URL.createObjectURL(Music_typedAudioBlob(audioBlob,song));

}

const playableUrl=Music_typedAudioUrl(song.audioData,song);
MusicState.audio.src=playableUrl;

  MusicState.audio.load();
  document.getElementById('musicPlayerTitle').textContent=song.title;
  document.getElementById('musicPlayerArtist').textContent=`${song.artist} · ${song.album}`;
  const artwork=document.getElementById('musicPlayerArtwork'); artwork.src=Music_artworkUrl(song) || '';
  const progress=document.getElementById('musicProgress'); if(progress) progress.value=0;
  await MusicState.audio.play();
  document.getElementById('musicPlayPause').textContent=MusicState.audio.paused?'▶':'⏸';
  }catch(error){
    const notice=document.getElementById('musicNotice');
    if(notice) notice.textContent=`Could not play “${song.title}”. Check that the audio file is valid and in a supported format.`;
    document.getElementById('musicPlayPause').textContent='▶';
  }
}


function Music_togglePlay(){

  if(!MusicState.audio)
    return;

  if(!MusicState.currentSong){

    const songs=MusicState.playbackQueue.length?MusicState.playbackQueue:(MusicState.visibleSongs.length?MusicState.visibleSongs:(MusicState.mode==='library'?MusicState.library:MusicState.catalogue));
    if(songs.length){
      Music_play(0,songs);
    }

    return;

  }

  const btn =
    document.getElementById(
      'musicPlayPause'
    );

  if(MusicState.audio.paused){

    MusicState.audio.play().then(()=>{ if(btn) btn.textContent='⏸'; }).catch(()=>{
      const notice=document.getElementById('musicNotice');
      if(notice) notice.textContent='This audio could not be played. Check its file format or choose another song.';
      if(btn) btn.textContent='▶';
    });

  }else{

    MusicState.audio.pause();

    if(btn)
      btn.textContent='▶';

  }

}

function Music_toggleLoop(){
  const modes=['off','all','one'];
  MusicState.repeatMode=modes[(modes.indexOf(MusicState.repeatMode)+1)%modes.length];
  MusicState.loop=MusicState.repeatMode!=='off';
  if(MusicState.audio) MusicState.audio.loop=false;
  const button=document.getElementById('musicLoop');
  if(button){
    button.classList.toggle('active',MusicState.repeatMode==='all');
    button.classList.toggle('repeat-one',MusicState.repeatMode==='one');
    button.textContent=MusicState.repeatMode==='one'?'🔂':'🔁';
    button.setAttribute('aria-pressed',String(MusicState.repeatMode!=='off'));
    button.title=MusicState.repeatMode==='one'?'Repeat one song':MusicState.repeatMode==='all'?'Repeat queue':'Repeat is off';
    button.setAttribute('aria-label',button.title);
  }
}

function Music_skip(offset){ const songs=MusicState.playbackQueue.length?MusicState.playbackQueue:(MusicState.mode==='library'?MusicState.library:MusicState.catalogue); if(!songs.length) return; const next=(MusicState.currentIndex+offset+songs.length)%songs.length; Music_play(next,songs); }

function Music_handleEnded(){
  const songs=MusicState.playbackQueue;
  if(!songs.length||MusicState.currentIndex<0) return;
  if(MusicState.repeatMode==='one'){ Music_play(MusicState.currentIndex,songs); return; }
  if(MusicState.currentIndex+1<songs.length){ Music_play(MusicState.currentIndex+1,songs); return; }
  if(MusicState.repeatMode==='all') Music_play(0,songs);
  else MusicState.queueActive=false;
}
async function Music_refresh(){

  const notice =
    document.getElementById(
      'musicNotice'
    );

  if(notice)
    notice.textContent =
      'Refreshing catalogue...';

  try{

    MusicState.catalogue =
      await Music_loadCatalogue();
    MusicState.offline=false;

    if(notice)
      notice.textContent='';

    Music_render();

  }catch(e){
    MusicState.offline=true;
    if(notice) notice.textContent='Offline — searching JackOS Music is unavailable. Your Library is still available.';
    Music_render();

  }

}
async function Music_open(){
  if(!Edition_IsPrivateOrPro()) return;
  const app=document.getElementById('musicApp'); if(!app) return;
  app.style.display='block'; MusicState.audio=document.getElementById('musicAudio');
  await Music_ensureSystem(); MusicState.library=await Music_loadStoredLibrary();
  Music_loadCollections();
  const notice=document.getElementById('musicNotice'); if(notice) notice.textContent='Loading catalogue...';
  try{ MusicState.catalogue=await Music_loadCatalogue(); MusicState.offline=false; if(notice) notice.textContent=''; Music_setMode('home'); }
  catch(e){ MusicState.offline=true; 
    
    if(notice) notice.textContent='Offline — searching JackOS Music is unavailable. Your Library is still available.';

    Music_setPage('recent'); }
}
function Music_close(){

  const app =
    document.getElementById(
      'musicApp'
    );

  const audio =
    document.getElementById(
      'musicAudio'
    );

  const playBtn =
    document.getElementById(
      'musicPlayPause'
    );

  if(audio){

    audio.pause();

    audio.currentTime = 0;

  }

  if(playBtn){

    playBtn.textContent =
      '▶';

  }

  Music_revokeArtworkUrls();

  if(app)
    app.style.display='none';

}
ready(()=>{
  document.querySelectorAll('[data-music-page]').forEach(button=>button.addEventListener('click',()=>Music_setPage(button.dataset.musicPage)));
  document.getElementById('musicRefresh')?.addEventListener('click',Music_refresh);
  document.getElementById('musicNewPlaylist')?.addEventListener('click',Music_createPlaylist);
  document.getElementById('musicQueueButton')?.addEventListener('click',Music_showQueue);
  document.getElementById('musicQueueClose')?.addEventListener('click',()=>{ const dialog=document.getElementById('musicQueueDialog'); if(dialog) dialog.hidden=true; });
  document.getElementById('musicQueueDialog')?.addEventListener('click',event=>{ if(event.target.id==='musicQueueDialog') event.currentTarget.hidden=true; });
  document.getElementById('musicChoiceAdd')?.addEventListener('click',()=>Music_resolveDuplicate(true));
  document.getElementById('musicChoiceSkip')?.addEventListener('click',()=>Music_resolveDuplicate(false));
  document.getElementById('musicChoiceDialog')?.addEventListener('click',event=>{ if(event.target.id==='musicChoiceDialog') Music_resolveDuplicate(false); });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape') return;
    const queueDialog=document.getElementById('musicQueueDialog');
    if(queueDialog&&!queueDialog.hidden) queueDialog.hidden=true;
    const choiceDialog=document.getElementById('musicChoiceDialog');
    if(choiceDialog&&!choiceDialog.hidden) Music_resolveDuplicate(false);
  });
  document.getElementById('musicSearchPanel')?.addEventListener('submit',event=>{
    event.preventDefault();
    MusicState.searchQuery=(document.getElementById('musicSearchInput')?.value||'').trim();
    if(MusicState.offline) MusicState.searchScope='library';
    Music_setPage('search');
  });
  document.querySelectorAll('[data-music-search-scope]').forEach(button=>button.addEventListener('click',()=>{
    if(MusicState.offline&&button.dataset.musicSearchScope==='music') return;
    MusicState.searchScope=button.dataset.musicSearchScope;
    document.querySelectorAll('[data-music-search-scope]').forEach(item=>item.classList.toggle('active',item===button));
  }));
  const audio=document.getElementById('musicAudio'); if(!audio) return; MusicState.audio=audio;
  audio.loop=false;
  const loopButton=document.getElementById('musicLoop');
  if(loopButton){
    loopButton.classList.toggle('active',MusicState.repeatMode==='all');
    loopButton.classList.toggle('repeat-one',MusicState.repeatMode==='one');
    loopButton.textContent=MusicState.repeatMode==='one'?'🔂':'🔁';
    loopButton.setAttribute('aria-pressed',String(MusicState.repeatMode!=='off'));
    loopButton.title=MusicState.repeatMode==='one'?'Repeat one song':MusicState.repeatMode==='all'?'Repeat queue':'Repeat is off';
    loopButton.addEventListener('click',Music_toggleLoop);
  }
  const volume=document.getElementById('musicVolume'); if(volume) audio.volume=Number(volume.value);
  audio.addEventListener('timeupdate',()=>{ const progress=document.getElementById('musicProgress'); if(progress && audio.duration) progress.value=(audio.currentTime/audio.duration)*100; });
  audio.addEventListener('ended',Music_handleEnded);

audio.addEventListener(
  'play',
  ()=>{
    const btn =
      document.getElementById(
        'musicPlayPause'
      );

    if(btn)
      btn.textContent='⏸';
  }
);

audio.addEventListener(
  'pause',
  ()=>{
    const btn =
      document.getElementById(
        'musicPlayPause'
      );

    if(btn)
      btn.textContent='▶';
  }
);


  document.getElementById('musicPlayPause')?.addEventListener('click',Music_togglePlay);
  document.getElementById('musicPrevious')?.addEventListener('click',()=>Music_skip(-1));
  document.getElementById('musicNext')?.addEventListener('click',()=>Music_skip(1));
  document.getElementById('musicVolume')?.addEventListener('input',e=>{ audio.volume=Number(e.target.value); });
  document.getElementById('musicProgress')?.addEventListener('input',e=>{ if(audio.duration) audio.currentTime=(Number(e.target.value)/100)*audio.duration; });
  const input=document.getElementById('musicInput');
  input?.addEventListener('change',async()=>{
    const files=[...(input.files||[])]; input.value=''; if(!files.length) return;
    try{
      const library=(await Music_readLibraryFile()) || Music_defaultLibrary();
      const errors=[];
      let imported=0;
      for(const file of files){
        try{
          const song=/\.zip$/i.test(file.name)?await Music_importZip(file):Music_normalizeSong({id:`import:${file.name}:${file.lastModified}`,fileName:file.name,title:file.name,artist:file.name,album:'Imported Music',audioType:file.name,audioData:await Music_blobToDataUrl(file),imported:true,importedAt:Date.now()},file.name);
          if(!library.some(item=>Music_id(item)===Music_id(song))){ library.push(song); imported++; }
        }catch(error){ errors.push(error.message); }
      }
      await Music_saveLibrary(library); MusicState.library=library; Music_setPage('recent');
      const notice=document.getElementById('musicNotice');
      if(notice) notice.textContent=errors.length?`${imported} added. Skipped: ${errors.join(' ')}`:`${imported} music file${imported===1?'':'s'} added to Recently Added.`;
    }catch(e){ alert('Music import failed: '+e.message); }
  });
});


