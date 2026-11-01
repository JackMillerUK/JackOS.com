# JackOS Shared Files

`JackOS.html` is the canonical page for both editions. The root launch page
selects macOS with `?edition=macos`; without that parameter JackOS defaults to
Classic. The existing edition-specific HTML paths remain as redirects for
backwards compatibility.

## Shared Files Report

### Identical files moved from both editions

- `JackOS-Backup.js`
- `JackOS-Camera.js`
- `JackOS-Explorer.js`
- `JackOS-Logo.png`
- `JackOS-Messages.js`
- `JackOS-Music.js`
- `JackOS-Notifications.js`
- `JackOS-Photos.js`
- `JackOS-Recovery.js`
- `JackOS-Restrictions.js`
- `JackOS-Sandbox.js`
- `JackOS-SecurityQuestions.js`
- `JackOS-WindowManager.js`
- `JackOS.css`
- `JackOSziplogic.js`

### Near-identical files consolidated

- `JackOS-Browser.js`
- `JackOS-Calculator.js`
- `JackOS-Games.js`
- `JackOS-Input.js`
- `JackOS-Settings.js`
- `JackOS-Setup-Helper.js`
- `JackOS.js`
- `JackOS-Desktop.js`

## Partial Refactor Report

The following behavior remains edition-specific inside shared files:

- `JackOS-Browser.js`: homepage migration and URL/search normalization are
  shared. The macOS browser keeps its tab and browser-service layer while
  using the shared address normalization; localhost service URLs remain
  supported. Both editions default to `https://bing.com`; the previous
  Apple UK and Purple Mash defaults migrate to Bing while other saved
  homepages are retained.
- `JackOS-Calculator.js` and `JackOS-Games.js`: calculations, games, and score
  storage are shared; macOS window visibility and overlay-aware keyboard
  handling remain conditional.
- `JackOS-Input.js`: iframe permissions are shared; Classic retains its
  pointer-lock permission while macOS does not add it.
- `JackOS-Settings.js` and `JackOS.js`: core logic is shared; both editions
  use the `5.0` build version.
- `JackOS-Setup-Helper.js`: installation logic is shared; Classic's icon URL
  handling and macOS's ZIP-contained icon handling remain conditional.

`JackOS-Desktop.js` shares desktop behavior while retaining edition-specific
icon collision handling and scroll-aware drag coordinates. macOS-only
scripts, stylesheets, and wallpaper assets stay in
`JackOS-macOS-System-Files`.

## Dependency Report

### JackOS Classic

`JackOS-Shared-Files/JackOS.html?edition=classic` (or
`JackOS-System-Files/JackOS.html` for the legacy redirect)
↓
All shared files listed above under `JackOS-Shared-Files/`.

### JackOS macOS

`JackOS-Shared-Files/JackOS.html?edition=macos` (or
`JackOS-macOS-System-Files/JackOS.html` for the legacy redirect)
↓
The same shared files under `JackOS-Shared-Files/`, plus:

- `JackOS-macOS-System-Files/JackOS-macOS.js`
- `JackOS-macOS-System-Files/JackOS-macOS-apps.js`
- `JackOS-macOS-System-Files/JackOS-macOS-desktop.js`
- macOS-specific stylesheets and `macOS-assets/`

The shared logo is also used by both edition entry points and the root
`index.html`.
