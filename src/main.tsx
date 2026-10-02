import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ThemeProvider } from './components/theme'
// Fuentes empaquetadas con la app (funcionan sin conexión, p. ej. en la versión de escritorio)
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/newsreader/wght-italic.css'
import './styles.css'
import { L, LANG } from './i18n'
import { CONFIG } from './config'
import { installClipboard } from './lib/pegar'

// Copiar fórmulas en sintaxis de entrada y limpiar lo que se pega en los campos matemáticos.
installClipboard()

// Metadatos del documento acordes al idioma elegido (index.html trae la versión en español).
document.documentElement.lang = LANG
document.title = `${CONFIG.appName} · ${CONFIG.courseName}`
document
  .querySelector<HTMLMetaElement>('meta[name="description"]')
  ?.setAttribute(
    'content',
    L(
      'NumLab: laboratorio interactivo de métodos numéricos con tablas de iteraciones, gráficas, desarrollo paso a paso y código Scilab.',
      'NumLab: an interactive numerical methods lab with iteration tables, plots, step-by-step solutions and Scilab code.',
    ),
  )

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
