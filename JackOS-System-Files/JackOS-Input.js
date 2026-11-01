// =========================================================
// JackOS-Input.js
// Unified keyboard + mouse/game input handling
// =========================================================

const JackOSInput = {

  activeFrame: null,
  pointerLocked: false,
  frameSettings: new WeakMap(),
  preparedFrames: new WeakSet(),
  bridgedDocuments: new WeakSet(),


  // ---------------------------------------------------------
  // Check iframe
  // ---------------------------------------------------------

  isGameFrame(frame) {
    return !!frame && frame.tagName === 'IFRAME';
  },

  isGameUrl(value) {
    try {
      const url = new URL(value, location.href);
      if (url.searchParams.get('jackos-game') === '1') return true;

      const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
      return hostname === 'classic.minecraft.net' ||
        /^(?:play|game)\.minecraft\.net$/.test(hostname) ||
        /(^|\.)eaglercraft\.(?:com|dev|org)$/.test(hostname) ||
        hostname === 'webmc.xyz';
    } catch (_) {
      return false;
    }
  },


  // ---------------------------------------------------------
  // Focus iframe
  // ---------------------------------------------------------

  focusFrame(frame) {

  if (!frame) return;

  try {
    frame.tabIndex = 0;

    frame.focus({
      preventScroll: true
    });
  } catch (_) {}

  try {
    frame.contentWindow?.focus();
  } catch (_) {}

  // Focus the actual game/document inside the installed app.
  // Focus the installed-app iframe itself.
// Some installed apps contain their own nested iframe.
try {
    frame.focus({
        preventScroll: true
    });
} catch (_) {}

try {
    frame.contentWindow?.focus();
} catch (_) {}
},


  // ---------------------------------------------------------
  // Prepare iframe
  // ---------------------------------------------------------

  prepareFrame(frame, options = {}) {

    if (!frame) return;

    const {
      game = true,
      autoPointerLock = false,
      pointerLock = game
    } = options;

    this.frameSettings.set(frame, { game, autoPointerLock: game && autoPointerLock, pointerLock });

    // Make iframe keyboard focusable
    frame.tabIndex = 0;


    // -------------------------------------------------------
    // Sandbox permissions
    // -------------------------------------------------------

    const sandbox = frame.getAttribute('sandbox');

    if (sandbox) {
      const tokens = sandbox.split(/\s+/).filter(token =>
        token && !/^allow-pointer-lock$/i.test(token)
      );
      if (pointerLock) tokens.push('allow-pointer-lock');
      frame.setAttribute('sandbox', tokens.join(' '));
    }


    // -------------------------------------------------------
    // Feature permissions
    // -------------------------------------------------------

    const permissions = (frame.getAttribute('allow') || '')
      .split(';')
      .map(permission => permission.trim())
      .filter(permission => permission && !/^pointer-lock(?:\s|$)/i.test(permission));

    if (!permissions.some(permission => /^fullscreen(?:\s|$)/i.test(permission))) permissions.push('fullscreen');
    if (!permissions.some(permission => /^gamepad(?:\s|$)/i.test(permission))) permissions.push('gamepad');
    if (pointerLock) permissions.push('pointer-lock *');

    frame.setAttribute('allow', permissions.join('; '));

    if (this.preparedFrames.has(frame)) return;
    this.preparedFrames.add(frame);

    // -------------------------------------------------------
    // Mouse / pointer activation
    // -------------------------------------------------------

    frame.addEventListener(
      'pointerdown',
      event => {
        const settings = this.frameSettings.get(frame);
        if (!settings?.game) return;

        this.activeFrame = frame;

        // Focus the iframe immediately
        this.focusFrame(frame);


        // Focus again shortly afterwards.
        // Some WebAssembly games replace their canvas or
        // focusable element when clicked.
        setTimeout(() => {
          if (this.activeFrame === frame) {
            this.focusFrame(frame);
          }
        }, 0);


        setTimeout(() => {
          if (this.activeFrame === frame) {
            this.focusFrame(frame);
          }
        }, 100);


        // Request pointer lock for game frames
        if (
          settings.autoPointerLock &&
          event.button === 0
        ) {

          this.requestPointerLock(frame);
        }

      },
      true
    );


    // -------------------------------------------------------
    // Mouse down
    // -------------------------------------------------------

    frame.addEventListener(
      'mousedown',
      () => {
        if (!this.frameSettings.get(frame)?.game) return;

        this.activeFrame = frame;

        this.focusFrame(frame);

      },
      true
    );


    // -------------------------------------------------------
    // Focus tracking
    // -------------------------------------------------------

    frame.addEventListener(
      'focus',
      () => {
        if (this.frameSettings.get(frame)?.game) this.activeFrame = frame;

      },
      true
    );


    // -------------------------------------------------------
    // Load
    // -------------------------------------------------------

    frame.addEventListener(
      'load',
      () => {

        this.focusFrame(frame);

        this.installSameOriginGameBridge(
          frame
        );

      },
      true
    );


    // -------------------------------------------------------
    // Already loaded iframe
    // -------------------------------------------------------

    try {

      if (
        frame.contentDocument &&
        frame.contentDocument.readyState !== 'loading'
      ) {

        this.installSameOriginGameBridge(
          frame
        );
      }

    } catch (_) {}

  },


  // ---------------------------------------------------------
  // Request Pointer Lock
  // ---------------------------------------------------------

  requestPointerLock(frame) {

    if (!frame) return;


    this.activeFrame = frame;


    // IMPORTANT:
    // Focus before requesting pointer lock.
    this.focusFrame(frame);


    try {

      const doc = frame.contentDocument;

      if (doc && doc.body) {

        const target =
          doc.querySelector('canvas') ||
          doc.documentElement ||
          doc.body;


        if (
          target &&
          typeof target.requestPointerLock === 'function'
        ) {

          target.requestPointerLock();

          return;
        }
      }

    } catch (_) {

      // Cross-origin iframe.
      // The game itself must request Pointer Lock.
    }

  },


  // ---------------------------------------------------------
  // Exit Pointer Lock
  // ---------------------------------------------------------

  exitPointerLock() {

    try {

      if (document.pointerLockElement) {
        document.exitPointerLock();
      }

    } catch (_) {}

    this.pointerLocked = false;
    this.activeFrame = null;
  },


  // ---------------------------------------------------------
  // Same-origin game bridge
  // ---------------------------------------------------------

  installSameOriginGameBridge(frame) {
    try {

      const doc = frame.contentDocument;

      if (!doc) return;

      if (this.bridgedDocuments.has(doc)) return;
      this.bridgedDocuments.add(doc);


      // -----------------------------------------------------
      // DO NOT block keyboard events from the game.
      //
      // The previous version could interfere with some
      // WebAssembly games.
      // -----------------------------------------------------

      // No keyboard interception here.


      // -----------------------------------------------------
      // Auto Pointer Lock
      // -----------------------------------------------------

      const lock = event => {
        if (event.button !== 0 || !this.frameSettings.get(frame)?.autoPointerLock) return;

        const target = doc.querySelector('canvas') || doc.documentElement || doc.body;
        if (target && typeof target.requestPointerLock === 'function') {
          target.requestPointerLock();
        }
      };

      doc.addEventListener('pointerdown', lock, true);

    } catch (_) {

      // Cross-origin iframe.
      // Nothing else needs to happen here.

    }

  }

};


// =========================================================
// POINTER LOCK STATE
// =========================================================

document.addEventListener(
  'pointerlockchange',
  () => {

    const locked =
      !!document.pointerLockElement;


    JackOSInput.pointerLocked = locked;


    const frame =
      JackOSInput.activeFrame;


    if (frame) {

      frame.classList.toggle(
        'jackos-game-input',
        locked
      );


      // -----------------------------------------------------
      // VERY IMPORTANT:
      // Keep the iframe focused after Pointer Lock begins.
      // -----------------------------------------------------

      if (locked) {

        JackOSInput.focusFrame(frame);


        // Minecraft/WebAssembly games can steal focus during
        // the pointer-lock transition, so restore it twice.
        setTimeout(() => {

          if (
            JackOSInput.pointerLocked &&
            JackOSInput.activeFrame === frame
          ) {

            JackOSInput.focusFrame(frame);
          }

        }, 0);


        setTimeout(() => {

          if (
            JackOSInput.pointerLocked &&
            JackOSInput.activeFrame === frame
          ) {

            JackOSInput.focusFrame(frame);
          }

        }, 150);

      }

    }


    if (!locked) {

      JackOSInput.activeFrame = null;
    }

  },
  true
);


// =========================================================
// ESCAPE
// =========================================================

document.addEventListener(
  'keydown',
  event => {

    if (event.key === 'Escape') {

      if (document.pointerLockElement) {

        try {
          document.exitPointerLock();
        } catch (_) {}

      }

      JackOSInput.pointerLocked = false;
    }

  },
  true
);


// =========================================================
// WINDOW BLUR
// =========================================================

window.addEventListener(
  'blur',
  () => {

    if (!document.pointerLockElement) {

      JackOSInput.activeFrame = null;
    }

  }
);


// =========================================================
// POINTER LOCK ERROR
// =========================================================

document.addEventListener(
  'pointerlockerror',
  () => {

    JackOSInput.pointerLocked = false;

  },
  true
);