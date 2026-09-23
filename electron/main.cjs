// Proceso principal de la versión de escritorio de NumLab (Electron).
// Carga la compilación web (dist/index.html) en una ventana aislada, sin acceso a Node.
const { app, BrowserWindow, Menu, shell, nativeTheme } = require('electron')
const path = require('node:path')

const REPO = 'https://github.com/fernandevdaza/numlab'
const DEV_URL = process.env.VITE_DEV_SERVER_URL // p. ej. http://localhost:5173 con `pnpm desktop:dev`

if (!app.requestSingleInstanceLock()) app.quit()

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
              { role: 'about', label: 'Acerca de NumLab' },
              { type: 'separator' },
              { role: 'hide', label: 'Ocultar NumLab' },
              { role: 'hideOthers', label: 'Ocultar otros' },
              { role: 'unhide', label: 'Mostrar todo' },
              { type: 'separator' },
              { role: 'quit', label: 'Salir de NumLab' },
            ],
          },
        ]
      : [{ label: 'Archivo', submenu: [{ role: 'quit', label: 'Salir' }] }]),
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamaño real' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        { label: 'Repositorio en GitHub', click: () => shell.openExternal(REPO) },
        { label: 'Reportar un problema', click: () => shell.openExternal(REPO + '/issues/new') },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.setAboutPanelOptions({
  applicationName: 'NumLab',
  applicationVersion: app.getVersion(),
  copyright: 'Licencia MIT',
  website: REPO,
})

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(() => {
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
