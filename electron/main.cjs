// Proceso principal de la versión de escritorio de NumLab (Electron).
// Carga la compilación web (dist/index.html) en una ventana aislada, sin acceso a Node.
const { app, BrowserWindow, Menu, shell, nativeTheme } = require('electron')
const path = require('node:path')

const REPO = 'https://github.com/fernandevdaza/numlab'
const DEV_URL = process.env.VITE_DEV_SERVER_URL // p. ej. http://localhost:5173 con `pnpm desktop:dev`

if (!app.requestSingleInstanceLock()) app.quit()

/**
 * Idioma de los menús: el que el usuario eligió en la app (localStorage 'numlab:lang', se lee al
 * cargar la página) o, si no eligió, el del sistema. Español si empieza con 'es', si no inglés.
 * @type {'es' | 'en'}
 */
let lang = 'es'
function systemLang() {
  let code = ''
  try {
    code = (app.getPreferredSystemLanguages?.()[0] || app.getLocale() || '').toLowerCase()
  } catch {
    code = ''
  }
  return code.startsWith('es') ? 'es' : 'en'
}
/** @template T @param {T} es @param {T} en @returns {T} */
const L = (es, en) => (lang === 'en' ? en : es)

/** @type {BrowserWindow | null} */
let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: 'NumLab',
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0f14' : '#f7f6f2',
    autoHideMenuBar: process.platform !== 'darwin',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  if (DEV_URL) win.loadURL(DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  win.once('ready-to-show', () => win?.show())

  // Si el usuario eligió un idioma en la app (selector ES | EN), los menús lo siguen.
  win.webContents.on('did-finish-load', () => {
    win?.webContents
      .executeJavaScript(`(() => { try { return JSON.parse(localStorage.getItem('numlab:lang') || 'null') } catch (e) { return null } })()`)
      .then((v) => {
        const next = v === 'es' || v === 'en' ? v : systemLang()
        if (next !== lang) {
          lang = next
          buildMenu()
        }
      })
      .catch(() => {})
  })

  // Enlaces externos (repositorio, documentación…) en el navegador del sistema.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  // La ventana nunca sale de la aplicación (la navegación interna usa #/tema/metodo).
  win.webContents.on('will-navigate', (e, url) => {
    const current = win?.webContents.getURL() ?? ''
    if (url.split('#')[0] === current.split('#')[0]) return
    e.preventDefault()
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  })

  win.on('closed', () => (win = null))
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [
          {
            label: 'NumLab',
            submenu: [
              { role: 'about', label: L('Acerca de NumLab', 'About NumLab') },
              { type: 'separator' },
              { role: 'hide', label: L('Ocultar NumLab', 'Hide NumLab') },
              { role: 'hideOthers', label: L('Ocultar otros', 'Hide Others') },
              { role: 'unhide', label: L('Mostrar todo', 'Show All') },
              { type: 'separator' },
              { role: 'quit', label: L('Salir de NumLab', 'Quit NumLab') },
            ],
          },
        ]
      : [{ label: L('Archivo', 'File'), submenu: [{ role: 'quit', label: L('Salir', 'Exit') }] }]),
    {
      label: L('Edición', 'Edit'),
      submenu: [
        { role: 'undo', label: L('Deshacer', 'Undo') },
        { role: 'redo', label: L('Rehacer', 'Redo') },
        { type: 'separator' },
        { role: 'cut', label: L('Cortar', 'Cut') },
        { role: 'copy', label: L('Copiar', 'Copy') },
        { role: 'paste', label: L('Pegar', 'Paste') },
        { role: 'selectAll', label: L('Seleccionar todo', 'Select All') },
      ],
    },
    {
      label: L('Ver', 'View'),
      submenu: [
        { role: 'reload', label: L('Recargar', 'Reload') },
        { type: 'separator' },
        { role: 'resetZoom', label: L('Tamaño real', 'Actual Size') },
        { role: 'zoomIn', label: L('Acercar', 'Zoom In') },
        { role: 'zoomOut', label: L('Alejar', 'Zoom Out') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: L('Pantalla completa', 'Toggle Full Screen') },
        { role: 'toggleDevTools', label: L('Herramientas de desarrollo', 'Developer Tools') },
      ],
    },
    {
      label: L('Ayuda', 'Help'),
      submenu: [
        { label: L('Repositorio en GitHub', 'GitHub Repository'), click: () => shell.openExternal(REPO) },
        { label: L('Reportar un problema', 'Report an Issue'), click: () => shell.openExternal(REPO + '/issues/new') },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  app.setAboutPanelOptions({
    applicationName: 'NumLab',
    applicationVersion: app.getVersion(),
    copyright: L('Licencia MIT', 'MIT License'),
    website: REPO,
  })
}

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(() => {
  lang = systemLang()
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
