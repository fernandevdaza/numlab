// Ayuda global: guía de sintaxis, atajos, anatomía de una página de método, consejos y "acerca de".
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from 'react'
import { CONFIG } from '../config'
import { toTex } from '../lib/expr'
import { Tex } from './Tex'
import { ExprField } from './ui'
import { IconClose, IconGithub } from './icons'

export type HelpTab = 'sintaxis' | 'atajos' | 'pagina' | 'consejos' | 'acerca'

const TABS: { id: HelpTab; label: string }[] = [
  { id: 'sintaxis', label: 'Cómo escribir funciones' },
  { id: 'atajos', label: 'Atajos y teclado' },
  { id: 'pagina', label: 'Partes de una página' },
  { id: 'consejos', label: 'Consejos' },
  { id: 'acerca', label: 'Acerca de' },
]

export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'

interface Props {
  open: boolean
  onClose: () => void
  tab: HelpTab
  setTab: (t: HelpTab) => void
  paletteEnabled: boolean
  setPaletteEnabled: (v: boolean) => void
}

export function HelpDialog({ open, onClose, tab, setTab, paletteEnabled, setPaletteEnabled }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      // enfocar la pestaña activa (showModal enfoca el primer elemento: el botón cerrar)
      requestAnimationFrame(() => tabRefs.current[TABS.findIndex((t) => t.id === tab)]?.focus())
    } else if (!open && d.open) d.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Trampa de foco explícita (además del `inert` que aplica showModal al resto de la página).
  const onKeyDown = (e: RKeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab' || !ref.current) return
    const f = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null)
    if (!f.length) return
    const first = f[0]
    const last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const onTabKey = (e: RKeyboardEvent, i: number) => {
    let j = -1
    if (e.key === 'ArrowRight') j = (i + 1) % TABS.length
    if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length
    if (e.key === 'Home') j = 0
    if (e.key === 'End') j = TABS.length - 1
    if (j >= 0) {
      e.preventDefault()
      setTab(TABS[j].id)
      tabRefs.current[j]?.focus()
    }
  }

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <>
          <div className="modal-head">
            <h2 id={titleId}>Ayuda</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar ayuda (Esc)" title="Cerrar (Esc)">
              <IconClose />
            </button>
          </div>
          <div className="modal-tabs" role="tablist" aria-label="Secciones de la ayuda">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el
                }}
                type="button"
                role="tab"
                id={titleId + '-tab-' + t.id}
                aria-selected={tab === t.id}
                aria-controls={titleId + '-panel'}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="modal-body" role="tabpanel" id={titleId + '-panel'} aria-labelledby={titleId + '-tab-' + tab} tabIndex={0}>
            {tab === 'sintaxis' && <Syntax />}
            {tab === 'atajos' && <Shortcuts paletteEnabled={paletteEnabled} setPaletteEnabled={setPaletteEnabled} />}
            {tab === 'pagina' && <Anatomy />}
            {tab === 'consejos' && <Tips />}
            {tab === 'acerca' && <About />}
          </div>
        </>
      )}
    </dialog>
  )
}

/* ───────────────────────── Secciones ───────────────────────── */

const SYNTAX: { src: string; note: ReactNode }[] = [
  { src: 'x^2 - 3*x + 1', note: <>Potencia con <code>^</code> (también <code>**</code>), producto con <code>*</code></> },
  { src: '2x + 3sin(x)', note: <>Multiplicación implícita: <code>2x</code> = <code>2*x</code></> },
  { src: 'x^(1/3)', note: <>Exponentes compuestos entre paréntesis</> },
  { src: 'sqrt(x^2 + 1)', note: <>Raíz cuadrada; <code>abs(x)</code> para |x|</> },
  { src: 'exp(-x^2)', note: <>Exponencial; también <code>e^(-x^2)</code></> },
  { src: 'ln(x) + log10(x)', note: <><code>ln</code> y <code>log</code> son el logaritmo natural; <code>log10</code> es base 10</> },
  { src: 'log(x, 2)', note: <>Logaritmo en base b: <code>log(x, b)</code></> },
  { src: 'sen(x) + tg(x)', note: <>Alias en español: <code>sen</code>, <code>tg</code>, <code>arcsen</code>, <code>arctg</code></> },
  { src: 'atan(x) - acos(x/2)', note: <>Trigonométricas inversas: <code>asin acos atan</code></> },
  { src: 'pi/4 + e', note: <>Constantes <code>pi</code> (π) y <code>e</code></> },
  { src: '3.1416', note: <>Decimales con <b>punto</b>. La coma separa argumentos: <code>log(x, 2)</code></> },
  { src: '1e-6', note: <>Notación científica: <code>1e-6</code> = 10⁻⁶, <code>2.5e3</code> = 2500</> },
]

function Syntax() {
  const [trial, setTrial] = useState('sen(x)^2 + 2x/3')
  const rows = useMemo(() => SYNTAX.map((r) => ({ ...r, tex: toTex(r.src) })), [])
  return (
    <>
      <h3>Escribir expresiones</h3>
      <p className="muted">
        Los campos de funciones usan la sintaxis de <b>math.js</b>. Debajo de cada campo aparece la fórmula interpretada: si se ve como
        esperabas, está bien escrita.
      </p>
      <table className="help-table">
        <thead>
          <tr>
            <th>Escribe</th>
            <th>Se interpreta</th>
            <th>Nota</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.src}>
              <td>
                <code>{r.src}</code>
              </td>
              <td>
                <Tex>{r.tex}</Tex>
              </td>
              <td className="out">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="help-try" data-palette="off">
        <ExprField label="Pruébalo aquí" value={trial} onChange={setTrial} vars={['x', 'y', 't']} texPrefix="f =" hint="Variables permitidas en este ejemplo: x, y, t" />
      </div>
      <h3>Campos numéricos y matrices</h3>
      <ul>
        <li>
          Los campos numéricos aceptan expresiones constantes: <code>pi/2</code>, <code>sqrt(3)</code>, <code>2^-10</code>, <code>1e-8</code>.
        </li>
        <li>
          Matrices: una fila por línea (o separadas por <code>;</code>) y valores separados por espacios o comas, p. ej. <code>4 -1 0; -1 4 -1; 0 -1 4</code>.
        </li>
        <li>
          Vectores: valores separados por espacios o comas, p. ej. <code>1, 2, 3</code>.
        </li>
      </ul>
      <h3>Errores comunes</h3>
      <ul>
        <li>
          <code>sin x</code> sin paréntesis → escribe <code>sin(x)</code>.
        </li>
        <li>
          <code>2x^2</code> es <Tex>{'2x^2'}</Tex>; para <Tex>{'(2x)^2'}</Tex> escribe <code>(2x)^2</code>.
        </li>
        <li>
          <code>1/2x</code> se lee como <code>(1/2)·x</code>; para <Tex>{'\\frac{1}{2x}'}</Tex> escribe <code>1/(2x)</code>.
        </li>
        <li>
          <code>3,5</code> se convierte a <code>3.5</code> sólo si no hay espacio tras la coma; es más seguro usar punto.
        </li>
      </ul>
    </>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>
}

function Shortcuts({ paletteEnabled, setPaletteEnabled }: { paletteEnabled: boolean; setPaletteEnabled: (v: boolean) => void }) {
  const rows: [ReactNode, string][] = [
    [<><Kbd>{MOD_KEY}</Kbd> <Kbd>K</Kbd></>, 'Buscar un método'],
    [<Kbd>/</Kbd>, 'Buscar (cuando no estás escribiendo en un campo)'],
    [<><Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>Enter</Kbd></>, 'Moverse por los resultados de búsqueda y abrir uno'],
    [<><Kbd>?</Kbd> o <Kbd>{MOD_KEY}</Kbd> <Kbd>/</Kbd></>, 'Abrir esta ayuda'],
    [<Kbd>Esc</Kbd>, 'Cerrar la ayuda, el menú o limpiar la búsqueda'],
    [<><Kbd>{MOD_KEY}</Kbd> <Kbd>Z</Kbd></>, 'Deshacer en un campo (también lo insertado con el teclado de símbolos)'],
    [<><Kbd>Enter</Kbd> · <Kbd>Shift</Kbd> <Kbd>Enter</Kbd></>, 'Calculadora CAS: ejecutar · nueva línea'],
    [<><Kbd>↑</Kbd> <Kbd>↓</Kbd></>, 'Calculadora CAS: recorrer el historial'],
  ]
  return (
    <>
      <h3>Teclado de símbolos</h3>
      <div className="help-switch">
        <div>
          <b>Mostrar al escribir una expresión</b>
          <span>Botones para π, √, ^, sin, ln… que se insertan donde está el cursor. Útil en celular y tablet.</span>
        </div>
        <button type="button" role="switch" className="switch" aria-checked={paletteEnabled} aria-label="Mostrar el teclado de símbolos" onClick={() => setPaletteEnabled(!paletteEnabled)} />
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Si seleccionas texto y pulsas una función (p. ej. <code>sqrt</code>), la selección queda dentro de los paréntesis. También puedes
        activarlo o desactivarlo con el botón de teclado de la barra superior.
      </p>
      <h3>Atajos</h3>
      <table className="help-table">
        <tbody>
          {rows.map(([k, d], i) => (
            <tr key={i}>
              <td>{k}</td>
              <td className="out">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Anatomy() {
  const parts: [string, string][] = [
    ['Parámetros', 'Columna izquierda: la función, el intervalo o valores iniciales, la tolerancia y el máximo de iteraciones. Todo se recalcula al escribir.'],
    ['Ejemplos', 'Botones al final de los parámetros que cargan ejercicios típicos (incluidos casos que divergen o fallan, para ver por qué).'],
    ['Teoría y fórmulas', 'Panel plegable arriba: fórmula de iteración, hipótesis de convergencia, orden y cota del error.'],
    ['Indicadores', 'Tarjetas con el resultado principal (resaltado), número de iteraciones, error o residuo final y orden estimado.'],
    ['Gráfica', 'Interactiva: arrastra para mover, rueda o selección para acercar, doble clic para restablecer; el ícono de cámara descarga un PNG.'],
    ['Tabla de iteraciones', 'Una fila por iteración con los valores y errores. La fila resaltada es la solución. Botón CSV para Excel.'],
    ['Paso a paso', 'El desarrollo como en el cuaderno: sustitución en la fórmula de las primeras iteraciones.'],
    ['Código Scilab', 'Programa equivalente listo para copiar o descargar como .sce y ejecutar en Scilab.'],
    ['Cifras', 'Selector en la parte inferior del menú: cuántas cifras significativas se muestran en tablas y resultados.'],
  ]
  return (
    <>
      <h3>Qué hay en cada página de método</h3>
      <div className="help-anatomy">
        {parts.map(([t, d]) => (
          <div key={t}>
            <b>{t}</b>
            <span>{d}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function Tips() {
  const [cleared, setCleared] = useState(false)
  const clear = () => {
    if (!window.confirm('¿Borrar las entradas guardadas de todos los métodos? Se restablecerán los valores de ejemplo. (El tema y las preferencias se conservan.)')) return
    const keep = new Set(['numlab:dark', 'numlab:digits', 'numlab:palette', 'numlab:nav-collapsed'])
    for (const k of Object.keys(localStorage)) if (k.startsWith('numlab:') && !keep.has(k)) localStorage.removeItem(k)
    setCleared(true)
  }
  return (
    <>
      <h3>Consejos</h3>
      <ul>
        <li>Tus entradas se guardan automáticamente en este navegador: al volver a un método, lo encuentras como lo dejaste.</li>
        <li>
          Si la gráfica se ve aplastada (por ejemplo por una asíntota), fija el rango con <b>x mín</b> / <b>x máx</b>.
        </li>
        <li>Compara criterios de parada (error absoluto, relativo o residuo): cambian el número de iteraciones.</li>
        <li>Prueba los ejemplos que divergen: entender por qué falla un método es parte del examen.</li>
        <li>
          Las páginas <b>Comparar</b> de cada tema ponen varios métodos lado a lado con el mismo problema.
        </li>
        <li>
          Para imprimir o guardar como PDF usa <Kbd>{MOD_KEY}</Kbd> <Kbd>P</Kbd>: el menú lateral se oculta automáticamente.
        </li>
      </ul>
      <h3>Datos guardados</h3>
      <div className="help-switch">
        <div>
          <b>Restablecer todas las entradas</b>
          <span>Vuelve a los valores de ejemplo en todos los métodos.</span>
        </div>
        <button type="button" className="btn sm" onClick={clear} disabled={cleared}>
          {cleared ? 'Borrado · recarga la página' : 'Borrar datos'}
        </button>
      </div>
    </>
  )
}

function About() {
  const course = [CONFIG.courseName, CONFIG.courseCode, CONFIG.institution].filter(Boolean).join(' · ')
  return (
    <>
      <h3>{CONFIG.appName}</h3>
      <p>
        Laboratorio interactivo de métodos numéricos{course ? <> para <b>{course}</b></> : null}: cada método con tabla de iteraciones, gráficas,
        análisis de error, desarrollo paso a paso y exportación a Scilab.
      </p>
      <p className="muted">
        Proyecto de código abierto hecho por y para estudiantes. ¿Encontraste un error o quieres agregar un método? Abre un <i>issue</i> o un{' '}
        <i>pull request</i> en el repositorio.
      </p>
      {CONFIG.repoUrl && (
        <p>
          <a className="btn" href={CONFIG.repoUrl} target="_blank" rel="noopener noreferrer">
            <IconGithub /> Código fuente en GitHub
          </a>
        </p>
      )}
      <h3>Licencia</h3>
      <p className="muted">
        {CONFIG.license ? (
          <>
            Distribuido bajo la licencia <b>{CONFIG.license}</b>.{' '}
          </>
        ) : (
          <>Consulta el archivo LICENSE del repositorio para conocer los términos de uso y distribución. </>
        )}
        {CONFIG.licenseUrl && (
          <a href={CONFIG.licenseUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
            Ver LICENSE
          </a>
        )}
      </p>
      <h3>Construido con</h3>
      <p className="muted">React, TypeScript y Vite · KaTeX para las fórmulas · Plotly para las gráficas · math.js y nerdamer para el cálculo simbólico.</p>
      <h3>Adaptar a tu curso</h3>
      <p className="muted">
        La sigla, la universidad, el semestre y las fechas de examen están en <code>src/config.ts</code>. Si dejas la lista de exámenes vacía,
        la cuenta regresiva se oculta.
      </p>
    </>
  )
}
