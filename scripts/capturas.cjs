// Genera las imágenes del proyecto con Electron (mismas fuentes y motor que la app):
//   build/icon.png            ícono de la app de escritorio (1024×1024)
//   docs/banner.png           banner del README
//   docs/capturas/*.png       capturas de la app
// Uso: pnpm capturas   (compila la web y ejecuta este script con Electron)
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const out = (...p) => {
  const f = path.join(ROOT, ...p)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  return f
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Crea una ventana fuera de pantalla de w×h px CSS con factor de escala `scale`. */
function makeWin(w, h, scale = 1, transparent = false) {
  const win = new BrowserWindow({
    width: Math.round(w * scale),
    height: Math.round(h * scale),
    show: false,
    frame: false,
    transparent,
    backgroundColor: transparent ? '#00000000' : '#0b0f14',
    webPreferences: { offscreen: true, contextIsolation: true },
  })
  win.webContents.setFrameRate(30)
  win.webContents.on('did-fail-load', (_e, code, desc, url, main) => main && console.error('No se pudo cargar', url, code, desc))
  return win
}

async function capture(win, file) {
  const img = await win.webContents.capturePage()
  fs.writeFileSync(file, img.toPNG())
  console.log('✓', path.relative(ROOT, file), img.getSize())
}

async function icon() {
  const svg = fs.readFileSync(path.join(__dirname, 'marca', 'icono.svg'), 'utf8')
  const win = makeWin(1024, 1024, 1, true)
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`))
  await sleep(400)
  await capture(win, out('build', 'icon.png'))
  win.destroy()
}

async function banner() {
  const scale = 2
  const file = path.join(__dirname, 'marca', 'banner.html')
  // docs/banner.png en inglés (README.md) y docs/banner.es.png en español (README.es.md)
  for (const [lang, name] of [['en', 'banner.png'], ['es', 'banner.es.png']]) {
    const win = makeWin(1280, 480, scale)
    await win.loadFile(file, { search: 'lang=' + lang }).catch(async () => {
      await sleep(500) // la primera carga de un file:// tras otra ventana a veces falla: se reintenta
      await win.loadFile(file, { search: 'lang=' + lang })
    })
    win.webContents.setZoomFactor(scale)
    await sleep(900)
    await capture(win, out('docs', name))
    win.destroy()
  }
}

const SHOTS = [
  { name: 'inicio', hash: '/', theme: 'dark' },
  { name: 'newton', hash: '/raices/newton', theme: 'dark' },
  { name: 'gauss', hash: '/sistemas/gauss', theme: 'dark', tab: 'Paso a paso|Step by step' },
  { name: 'splines', hash: '/interpolacion/splines', theme: 'dark' },
  { name: 'simpson', hash: '/integracion/simpson', theme: 'light' },
  { name: 'runge-kutta', hash: '/edo/runge-kutta', theme: 'dark' },
  { name: 'maquina-16', hash: '/errores/maquina-16', theme: 'light' },
  { name: 'graficador', hash: '/cas/graficador', theme: 'dark' },
  { name: 'cas', hash: '/cas/calculadora', theme: 'dark' },
  { name: 'espacio', hash: '/cas/espacio', theme: 'dark' },
]

async function screenshots() {
  const W = 1440, H = 900, scale = 1.5
  const win = makeWin(W, H, scale)
  const index = path.join(ROOT, 'dist', 'index.html')
  // una carpeta por idioma: docs/capturas/en (README.md) y docs/capturas/es (README.es.md)
  for (const lang of ['en', 'es']) {
    for (const s of SHOTS) {
      await win.loadFile(index)
      await win.webContents.executeJavaScript(
        `localStorage.setItem('numlab:lang', ${JSON.stringify(JSON.stringify(lang))});` +
          `localStorage.setItem('numlab:dark', ${s.theme === 'dark'});` +
          `localStorage.setItem('numlab:palette', 'false');` +
          // la consola CAS muestra su historial de ejemplo en el idioma elegido
          `localStorage.removeItem('numlab:cas:historial'); localStorage.removeItem('numlab:cas:borrador'); localStorage.removeItem('numlab:espacio:doc'); true`,
      )
      await win.loadFile(index, { hash: s.hash })
      win.webContents.setZoomFactor(scale)
      await sleep(1200)
      // asegurar el tema pedido con el mismo botón que usa el usuario
      await win.webContents.executeJavaScript(
        `(() => { const want = ${s.theme === 'dark'}; if ((document.documentElement.dataset.theme === 'dark') !== want) document.querySelector('button[aria-label*="theme" i], button[aria-label*="tema" i]')?.click(); return true })()`,
      )
      await sleep(900)
      if (s.tab)
        await win.webContents.executeJavaScript(
          `(() => { const b = [...document.querySelectorAll('[role=tab]')].find(t => ${JSON.stringify(s.tab)}.split('|').some(x => t.textContent.includes(x))); b && b.click(); return !!b })()`,
        )
      await sleep(1400)
      await capture(win, out('docs', 'capturas', lang, s.name + '.png'))
    }
  }
  win.destroy()
}

app.disableHardwareAcceleration()
// Por defecto Electron termina al cerrar todas las ventanas: aquí se crean y destruyen varias seguidas.
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  try {
    const only = process.argv.slice(2).filter((a) => !a.startsWith('-') && !a.endsWith('.cjs'))
    if (!only.length || only.includes('icono')) await icon()
    if (!only.length || only.includes('banner')) await banner()
    if (!only.length || only.includes('capturas')) await screenshots()
  } catch (e) {
    console.error(e)
    process.exitCode = 1
  }
  app.quit()
})
