// =========================================================
// JackOS-Input.js
// Unified keyboard + mouse/game input handling
// =========================================================

const JackOSInput = {

  activeFrame: null,
  pointerLocked: false,


  // ---------------------------------------------------------
  // Check iframe
  // ---------------------------------------------------------

  isGameFrame(frame) {
    return !!frame && frame.tagName === 'IFRAME';
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
      autoPointerLock = false
    } = options;


    // Make iframe keyboard focusable
    frame.tabIndex = 0;


    // -------------------------------------------------------
    // Sandbox permissions
    // -------------------------------------------------------

    const sandbox = frame.getAttribute('sandbox');

    if (
      sandbox &&
      !/\ballow-pointer-lock\b/i.test(sandbox)
    ) {

      frame.setAttribute(
        'sandbox',
        sandbox + ' allow-pointer-lock'
      );
    }


    // -------------------------------------------------------
    // Feature permissions
    // -------------------------------------------------------

    const allow = frame.getAttribute('allow') || '';

    const permissions = [];

    if (!/\bpointer-lock\b/i.test(allow)) {
      permissions.push('pointer-lock');
    }

    if (!/\bfullscreen\b/i.test(allow)) {
      permissions.push('fullscreen');
    }

    if (!/\bgamepad\b/i.test(allow)) {
      permissions.push('gamepad');
    }

    if (permissions.length) {

      frame.setAttribute(
        'allow',
        (allow ? allow + '; ' : '') +
        permissions.join('; ')
      );
    }


    if (!game) return;


    // -------------------------------------------------------
    // Mouse / pointer activation
    // -------------------------------------------------------

    frame.addEventListener(
      'pointerdown',
      event => {

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
          autoPointerLock &&
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

        this.activeFrame = frame;

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
          frame,
          {
            autoPointerLock
          }
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
          frame,
          {
            autoPointerLock
          }
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

  installSameOriginGameBridge(frame, options = {}) {

    const {
      autoPointerLock = false
    } = options;


    try {

      const doc = frame.contentDocument;

      if (!doc) return;


      if (
        doc.documentElement &&
        doc.documentElement.dataset.jackosInputInstalled === 'true'
      ) {

        return;
      }


      if (doc.documentElement) {

        doc.documentElement.dataset.jackosInputInstalled = 'true';
      }


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

      if (autoPointerLock) {

        const lock = event => {

          if (event.button !== 0) return;


          const target =
            doc.querySelector('canvas') ||
            doc.documentElement ||
            doc.body;


          try {

            if (
              target &&
              typeof target.requestPointerLock === 'function'
            ) {

              target.requestPointerLock();
            }

          } catch (_) {}

        };


        doc.addEventListener(
          'pointerdown',
          lock,
          true
        );

      }

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