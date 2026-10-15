//JackOS-Sandbox.js
// JackOS Sandbox Emulator FOR PRO AND ELITE ONLY
let SE_CURRENT_VERSION = null;
let SE_RUN_ID = 0;
let SE_LOAD_TIMEOUT = null;

function SE_makeReadOnlySandboxGuard(){
  return `
    <script>
      (function(){
        try {
          const makeVolatileStorage = () => {
            const values = new Map();
            const storage = {
              getItem(key){
                key = String(key);
                return values.has(key) ? values.get(key) : null;
              },
              setItem(key, value){ values.set(String(key), String(value)); },
              removeItem(key){ values.delete(String(key)); },
              clear(){ values.clear(); },
              key(index){
                return Array.from(values.keys())[Number(index)] ?? null;
              },
              get length(){
                return values.size;
              }
            };
            return new Proxy(storage, {
              get(target, property, receiver){
                if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
                return values.get(String(property));
              },
              set(target, property, value){
                if (Reflect.has(target, property)) return false;
                values.set(String(property), String(value));
                return true;
              },
              ownKeys(target){ return [...new Set([...Reflect.ownKeys(target), ...values.keys()])]; },
              getOwnPropertyDescriptor(target, property){
                return Reflect.getOwnPropertyDescriptor(target, property) ||
                  (values.has(String(property)) ? { configurable: true, enumerable: true, writable: true, value: values.get(String(property)) } : undefined);
              }
            });
          };

          const readOnlyLS = makeVolatileStorage();
          const readOnlySS = makeVolatileStorage();

          Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get: () => readOnlyLS
          });

          Object.defineProperty(window, 'sessionStorage', {
            configurable: true,
            get: () => readOnlySS
          });

        } catch(e) {}

        try {
          const wrapHandle = (realHandle) => {
            const entry = {
              kind: (realHandle && realHandle.kind) || 'file',
              name: (realHandle && realHandle.name) || '',
              async getFile(){
                if (!realHandle || !realHandle.getFile) return new Blob();
                return await realHandle.getFile();
              },
              async createWritable(){
                return {
                  async write(){},
                  async truncate(){},
                  async seek(){},
                  async close(){},
                  async abort(){}
                };
              },
              async removeEntry(){ return undefined; },
              async getDirectoryHandle(name, options = {}) {
                try {
                  if (!realHandle || !realHandle.getDirectoryHandle) throw new Error('No directory handle');
                  const child = await realHandle.getDirectoryHandle(name, options);
                  return wrapHandle(child);
                } catch(e) {
                  if (options && options.create) {
                    return wrapHandle({
                      kind: 'directory',
                      name,
                      async values(){ return []; },
                      async getDirectoryHandle(){ throw new DOMException('Sandbox write blocked', 'NotAllowedError'); },
                      async getFileHandle(){ throw new DOMException('Sandbox write blocked', 'NotAllowedError'); }
                    });
                  }
                  throw e;
                }
              },
              async getFileHandle(name, options = {}) {
                try {
                  if (!realHandle || !realHandle.getFileHandle) throw new Error('No file handle');
                  const child = await realHandle.getFileHandle(name, options);
                  return wrapHandle(child);
                } catch(e) {
                  if (options && options.create) {
                    return wrapHandle({
                      kind: 'file',
                      name,
                      async getFile(){ return new Blob(); },
                      async createWritable(){
                        return {
                          async write(){},
                          async truncate(){},
                          async seek(){},
                          async close(){},
                          async abort(){}
                        };
                      }
                    });
                  }
                  throw e;
                }
              },
              async *values() {
                if (!realHandle || !realHandle.values) return;
                for await (const child of realHandle.values()) {
                  yield wrapHandle(child);
                }
              }
            };
            return entry;
          };

          if (navigator.storage && navigator.storage.getDirectory) {
            const realGetDirectory = navigator.storage.getDirectory.bind(navigator.storage);
            navigator.storage.getDirectory = async function(){
              const root = await realGetDirectory();
              return wrapHandle(root);
            };
          }
        } catch(e) {}
      })();
    </script>
  `;
}

async function SE_run(path){
  const runId = ++SE_RUN_ID;
  if(SE_LOAD_TIMEOUT){
    clearTimeout(SE_LOAD_TIMEOUT);
    SE_LOAD_TIMEOUT = null;
  }

  if(!window.SE_Data || !Array.isArray(window.SE_Data.versions)) return;
  const version =
    window.SE_Data.versions.find(
      v => v.pathway === path
    );

  if(!version) return;

  SE_CURRENT_VERSION = version;

  const sandboxWindow =
    document.getElementById(
      "sandboxWindow"
    );

  const loader =
    document.getElementById(
      "sandboxLoader"
    );

  const loaderText =
    document.getElementById(
      "sandboxLoaderText"
    );

  if(loaderText)
    loaderText.textContent =
      "Launching " +
      version.version +
      "...";

  if(loader)
    loader.style.display =
      "flex";

  if(sandboxWindow)
    sandboxWindow.style.display =
      "block";

  const oldFrame =
    document.getElementById(
      "sandboxFrame"
    );

  const freshFrame =
    document.createElement(
      "iframe"
    );

  freshFrame.id =
    "sandboxFrame";

  freshFrame.setAttribute(
  "sandbox",
  "allow-scripts allow-forms allow-modals allow-popups allow-same-origin allow-pointer-lock"
);

freshFrame.setAttribute(
  "allow",
  "pointer-lock; fullscreen; gamepad"
);

freshFrame.tabIndex = 0;
JackOSInput.prepareFrame(freshFrame, {
  game: true,
  autoPointerLock: true
});
  freshFrame.setAttribute(
    "referrerpolicy",
    "no-referrer"
  );

  freshFrame.src = "about:blank";

  let navigatingToVersion = false;
  const hideLoader = () => {
    if(runId !== SE_RUN_ID || !navigatingToVersion) return;
    if(loader) loader.style.display = "none";
  };

  freshFrame.addEventListener("load", hideLoader);
  freshFrame.addEventListener("error", hideLoader);

  if(oldFrame && oldFrame.parentNode)
    oldFrame.parentNode.replaceChild(
      freshFrame,
      oldFrame
    );
  else if(sandboxWindow)
    sandboxWindow.appendChild(
      freshFrame
    );

  const pageUrl = new URL(
    "../JackOS-Server-Files/Sandbox-Emulator/" + path,
    document.baseURI
  );

  // A srcdoc document otherwise resolves relative URLs against JackOS itself.
  const baseHref = pageUrl.href.replace(/&/g, "&amp;").replace(/\"/g, "&quot;");
  const injection = `<base href="${baseHref}">${SE_makeReadOnlySandboxGuard()}`;

  try{
    const response = await fetch(pageUrl.href);
    if(!response.ok) throw new Error(`Failed to load ${pageUrl.href}: ${response.status}`);
    const html = await response.text();
    if(runId !== SE_RUN_ID) return;

    const headMatch = /<head\b[^>]*>/i;
    if(headMatch.test(html)){
      navigatingToVersion = true;
      freshFrame.srcdoc = html.replace(headMatch, match => match + injection);
    }else{
      const htmlMatch = /<html\b[^>]*>/i;
      navigatingToVersion = true;
      freshFrame.srcdoc = htmlMatch.test(html)
        ? html.replace(htmlMatch, match => match + `<head>${injection}</head>`)
        : `<!doctype html><html><head>${injection}</head><body>${html}</body></html>`;
    }

  }catch(err){
    if(runId !== SE_RUN_ID) return;
    console.error("Sandbox version could not be loaded through srcdoc; opening the archived page directly.", err);
    navigatingToVersion = true;
    freshFrame.src = pageUrl.href;

  }

  if(sandboxWindow) sandboxWindow.style.display = "block";
  SE_LOAD_TIMEOUT = setTimeout(hideLoader, 15000);

}


async function Settings_showSandbox(){

  const main =
    document.getElementById(
      "settingsMain"
    );

  const sandbox =
    document.getElementById(
      "settingsSandboxPanel"
    );

  if(main)
    main.style.display = "none";

  if(sandbox)
    sandbox.style.display = "block";

  await SE_open();

}

async function SE_open(){

  const content =
    document.getElementById(
      "sandboxContent"
    );

  if(content)
    content.innerHTML =
      "Loading versions...";

  try{

    const response =
      await fetch(
        "../JackOS-Server-Files/Sandbox-Emulator/JackOS-Versions.json"
      );

    if(!response.ok){

      content.innerHTML =
        "Failed to load version list.";

      return;
    }

    const text =
  await response.text();



const data =
  JSON.parse(text);


    let html =
      "<h4>Available Versions</h4>";

    data.versions.forEach(
      version => {

        html += `
          <button
            class="explorer-btn"
            style="display:block;margin-bottom:8px;"
            onclick="SE_showVersion('${version.version}')"
          >
            ${version.version}
          </button>
        `;

      }
    );

    content.innerHTML = html;

    window.SE_Data = data;

 }catch(err){

  content.innerHTML =
    "Failed to load Sandbox Emulator. Servers may be offline or JackOS isn't connected to the internet. Please try again later.";

  console.error(err);

}



}

function SE_showVersion(name){

  const version =
    window.SE_Data.versions.find(
      v => v.version === name
    );

  if(!version)
    return;

  const content =
    document.getElementById(
      "sandboxContent"
    );

  content.innerHTML = `

    <button
      class="explorer-btn ghost"
      onclick="SE_open()"
    >
      ← Back
    </button>

    <h3>${version.version}</h3>

    <p>
      ${version.description}
    </p>

    <p>
      Release Date:
      ${version.releaseDate}
    </p>

    <p style="
      color:#ffd66b;
      font-size:13px;
    ">
      Sandbox Notice:<br><br>

      Running old versions is safe.

      Changes made inside the
      Sandbox Emulator are not
      saved and will not affect
      your current JackOS
      installation.
    </p>

    <button
      class="explorer-btn"
      onclick="SE_run('${version.pathway}')"
    >
      Run
    </button>
  `;

}
// Sandbox Emulator Helpers

function SE_close(){

  ++SE_RUN_ID;
  if(SE_LOAD_TIMEOUT){
    clearTimeout(SE_LOAD_TIMEOUT);
    SE_LOAD_TIMEOUT = null;
  }

  const loaderText = document.getElementById(
    "sandboxLoaderText"
  );
  if(loaderText) loaderText.textContent =
    "Closing " +
    (
      SE_CURRENT_VERSION
      ? SE_CURRENT_VERSION.version
      : "Sandbox"
    ) +
    "...";

  const loader = document.getElementById(
    "sandboxLoader"
  );
  if(loader) loader.style.display = "flex";

  setTimeout(()=>{
    const frame =
      document.getElementById(
        "sandboxFrame"
      );

    if(frame) frame.src = "about:blank";

    const sandboxWindow = document.getElementById(
      "sandboxWindow"
    );
    if(sandboxWindow) sandboxWindow.style.display = "none";

    if(loader) loader.style.display = "none";

    const settingsWindow = document.getElementById(
      "settingsWin"
    );
    if(settingsWindow) settingsWindow.style.display = "block";

    if(SE_CURRENT_VERSION){

      SE_showVersion(
        SE_CURRENT_VERSION.version
      );

      SE_CURRENT_VERSION = null;
    }

  },2500);
}