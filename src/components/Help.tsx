// Ayuda global: guía de sintaxis, atajos, anatomía de una página de método, consejos y "acerca de".
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from 'react'
import { CONFIG } from '../config'
import { toTex } from '../lib/expr'
import { Tex } from './Tex'
import { ExprField } from './ui'
import { IconClose, IconGithub } from './icons'
import { LangSwitch } from './LangSwitch'
import { L } from '../i18n'

export type HelpTab = 'sintaxis' | 'atajos' | 'pagina' | 'consejos' | 'acerca'

const TABS: { id: HelpTab; label: string }[] = [
  { id: 'sintaxis', label: L('Cómo escribir funciones', 'Writing functions') },
  { id: 'atajos', label: L('Atajos y teclado', 'Shortcuts & keyboard') },
  { id: 'pagina', label: L('Partes de una página', 'Page layout') },
  { id: 'consejos', label: L('Consejos y preferencias', 'Tips & preferences') },
  { id: 'acerca', label: L('Acerca de', 'About') },
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
            <h2 id={titleId}>{L('Ayuda', 'Help')}</h2>
            <LangSwitch className="modal-lang" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label={L('Cerrar ayuda (Esc)', 'Close help (Esc)')} title={L('Cerrar (Esc)', 'Close (Esc)')}>
              <IconClose />
            </button>
          </div>
          <div className="modal-tabs" role="tablist" aria-label={L('Secciones de la ayuda', 'Help sections')}>
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
  {
    src: 'x^2 - 3*x + 1',
    note: L(
      <>Potencia con <code>^</code> (también <code>**</code>), producto con <code>*</code></>,
      <>Power with <code>^</code> (also <code>**</code>), product with <code>*</code></>,
    ),
  },
  { src: '2x + 3sin(x)', note: L(<>Multiplicación implícita: <code>2x</code> = <code>2*x</code></>, <>Implicit multiplication: <code>2x</code> = <code>2*x</code></>) },
  { src: 'x^(1/3)', note: L(<>Exponentes compuestos entre paréntesis</>, <>Compound exponents go in parentheses</>) },
  { src: 'sqrt(x^2 + 1)', note: L(<>Raíz cuadrada; <code>abs(x)</code> para |x|</>, <>Square root; <code>abs(x)</code> for |x|</>) },
  { src: 'exp(-x^2)', note: L(<>Exponencial; también <code>e^(-x^2)</code></>, <>Exponential; also <code>e^(-x^2)</code></>) },
  {
    src: 'ln(x) + log10(x)',
    note: L(
      <><code>ln</code> y <code>log</code> son el logaritmo natural; <code>log10</code> es base 10</>,
      <><code>ln</code> and <code>log</code> are the natural logarithm; <code>log10</code> is base 10</>,
    ),
  },
  { src: 'log(x, 2)', note: L(<>Logaritmo en base b: <code>log(x, b)</code></>, <>Logarithm to base b: <code>log(x, b)</code></>) },
  {
    src: 'sen(x) + tg(x)',
    note: L(
      <>Alias en español: <code>sen</code>, <code>tg</code>, <code>arcsen</code>, <code>arctg</code></>,
      <>Spanish aliases are accepted: <code>sen</code>, <code>tg</code>, <code>arcsen</code>, <code>arctg</code></>,
    ),
  },
  { src: 'atan(x) - acos(x/2)', note: L(<>Trigonométricas inversas: <code>asin acos atan</code></>, <>Inverse trigonometric functions: <code>asin acos atan</code></>) },
  { src: 'pi/4 + e', note: L(<>Constantes <code>pi</code> (π) y <code>e</code></>, <>Constants <code>pi</code> (π) and <code>e</code></>) },
  {
    src: '3.1416',
    note: L(
      <>Decimales con <b>punto</b>. La coma separa argumentos: <code>log(x, 2)</code></>,
      <>Decimals use a <b>point</b>. The comma separates arguments: <code>log(x, 2)</code></>,
    ),
  },
  {
    src: '1e-6',
    note: L(
      <>Notación científica: <code>1e-6</code> = 10⁻⁶, <code>2.5e3</code> = 2500</>,
      <>Scientific notation: <code>1e-6</code> = 10⁻⁶, <code>2.5e3</code> = 2500</>,
    ),
  },
]

function Syntax() {
  const [trial, setTrial] = useState('sen(x)^2 + 2x/3')
  const rows = useMemo(() => SYNTAX.map((r) => ({ ...r, tex: toTex(r.src) })), [])
  return (
    <>
      <h3>{L('Escribir expresiones', 'Writing expressions')}</h3>
      <p className="muted">
        {L(
          <>
            Los campos de funciones usan la sintaxis de <b>math.js</b>. Debajo de cada campo aparece la fórmula interpretada: si se ve como
            esperabas, está bien escrita.
          </>,
          <>
            Function fields use <b>math.js</b> syntax. The parsed formula is shown below each field: if it looks the way you expected, it is
            written correctly.
          </>,
        )}
      </p>
      <table className="help-table">
        <thead>
          <tr>
            <th>{L('Escribe', 'Type')}</th>
            <th>{L('Se interpreta', 'Parsed as')}</th>
            <th>{L('Nota', 'Note')}</th>
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
        <ExprField
          label={L('Pruébalo aquí', 'Try it here')}
          value={trial}
          onChange={setTrial}
          vars={['x', 'y', 't']}
          texPrefix="f ="
          hint={L('Variables permitidas en este ejemplo: x, y, t', 'Allowed variables in this example: x, y, t')}
        />
      </div>
      <h3>{L('Campos numéricos y matrices', 'Numeric fields and matrices')}</h3>
      {L(
        <ul>
          <li>
            Los campos numéricos aceptan expresiones constantes: <code>pi/2</code>, <code>sqrt(3)</code>, <code>2^-10</code>, <code>1e-8</code>.
          </li>
          <li>
            Matrices: una fila por línea (o separadas por <code>;</code>) y valores separados por espacios o comas, p. ej.{' '}
            <code>4 -1 0; -1 4 -1; 0 -1 4</code>.
          </li>
          <li>
            Vectores: valores separados por espacios o comas, p. ej. <code>1, 2, 3</code>.
          </li>
        </ul>,
        <ul>
          <li>
            Numeric fields accept constant expressions: <code>pi/2</code>, <code>sqrt(3)</code>, <code>2^-10</code>, <code>1e-8</code>.
          </li>
          <li>
            Matrices: one row per line (or rows separated by <code>;</code>) and values separated by spaces or commas, e.g.{' '}
            <code>4 -1 0; -1 4 -1; 0 -1 4</code>.
          </li>
          <li>
            Vectors: values separated by spaces or commas, e.g. <code>1, 2, 3</code>.
          </li>
        </ul>,
      )}
      <h3>{L('Errores comunes', 'Common mistakes')}</h3>
      {L(
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
        </ul>,
        <ul>
          <li>
            <code>sin x</code> without parentheses → write <code>sin(x)</code>.
          </li>
          <li>
            <code>2x^2</code> is <Tex>{'2x^2'}</Tex>; for <Tex>{'(2x)^2'}</Tex> write <code>(2x)^2</code>.
          </li>
          <li>
            <code>1/2x</code> is read as <code>(1/2)·x</code>; for <Tex>{'\\frac{1}{2x}'}</Tex> write <code>1/(2x)</code>.
          </li>
          <li>
            <code>3,5</code> is turned into <code>3.5</code> only when there is no space after the comma; using a point is safer.
          </li>
        </ul>,
      )}
    </>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>
}

function Shortcuts({ paletteEnabled, setPaletteEnabled }: { paletteEnabled: boolean; setPaletteEnabled: (v: boolean) => void }) {
  const rows: [ReactNode, string][] = [
    [<><Kbd>{MOD_KEY}</Kbd> <Kbd>K</Kbd></>, L('Buscar un método', 'Search for a method')],
    [<Kbd>/</Kbd>, L('Buscar (cuando no estás escribiendo en un campo)', 'Search (when you are not typing in a field)')],
    [<><Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>Enter</Kbd></>, L('Moverse por los resultados de búsqueda y abrir uno', 'Move through the search results and open one')],
    [<><Kbd>?</Kbd> {L('o', 'or')} <Kbd>{MOD_KEY}</Kbd> <Kbd>/</Kbd></>, L('Abrir esta ayuda', 'Open this help')],
    [<Kbd>Esc</Kbd>, L('Cerrar la ayuda, el menú o limpiar la búsqueda', 'Close the help or the menu, or clear the search')],
    [<><Kbd>{MOD_KEY}</Kbd> <Kbd>Z</Kbd></>, L('Deshacer en un campo (también lo insertado con el teclado de símbolos)', 'Undo in a field (including what the symbol keyboard inserted)')],
    [<><Kbd>Enter</Kbd> · <Kbd>Shift</Kbd> <Kbd>Enter</Kbd></>, L('Calculadora CAS: ejecutar · nueva línea', 'CAS calculator: run · new line')],
    [<><Kbd>↑</Kbd> <Kbd>↓</Kbd></>, L('Calculadora CAS: recorrer el historial', 'CAS calculator: browse the history')],
  ]
  return (
    <>
      <h3>{L('Teclado de símbolos', 'Symbol keyboard')}</h3>
      <div className="help-switch">
        <div>
          <b>{L('Mostrar al escribir una expresión', 'Show while typing an expression')}</b>
          <span>
            {L(
              'Botones para π, √, ^, sin, ln… que se insertan donde está el cursor. Útil en celular y tablet.',
              'Buttons for π, √, ^, sin, ln… inserted at the cursor. Handy on phones and tablets.',
            )}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          className="switch"
          aria-checked={paletteEnabled}
          aria-label={L('Mostrar el teclado de símbolos', 'Show the symbol keyboard')}
          onClick={() => setPaletteEnabled(!paletteEnabled)}
        />
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        {L(
          <>
            Si seleccionas texto y pulsas una función (p. ej. <code>sqrt</code>), la selección queda dentro de los paréntesis. También puedes
            activarlo o desactivarlo con el botón de teclado de la barra superior.
          </>,
          <>
            If you select some text and press a function (e.g. <code>sqrt</code>), the selection ends up inside the parentheses. You can also turn
            it on or off with the keyboard button in the top bar.
          </>,
        )}
      </p>
      <h3>{L('Atajos', 'Shortcuts')}</h3>
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
  const parts: [string, string][] = L(
    [
      ['Parámetros', 'Columna izquierda: la función, el intervalo o valores iniciales, la tolerancia y el máximo de iteraciones. Todo se recalcula al escribir.'],
      ['Ejemplos', 'Botones al final de los parámetros que cargan ejercicios típicos (incluidos casos que divergen o fallan, para ver por qué).'],
      ['Teoría y fórmulas', 'Panel plegable arriba: fórmula de iteración, hipótesis de convergencia, orden y cota del error.'],
      ['Indicadores', 'Tarjetas con el resultado principal (resaltado), número de iteraciones, error o residuo final y orden estimado.'],
      ['Gráfica', 'Interactiva: arrastra para mover, rueda o selección para acercar, doble clic para restablecer; el ícono de cámara descarga un PNG.'],
      ['Tabla de iteraciones', 'Una fila por iteración con los valores y errores. La fila resaltada es la solución. Botón CSV para Excel.'],
      ['Paso a paso', 'El desarrollo como en el cuaderno: sustitución en la fórmula de las primeras iteraciones.'],
      ['Código Scilab', 'Programa equivalente listo para copiar o descargar como .sce y ejecutar en Scilab.'],
      ['Cifras', 'Selector en la parte inferior del menú: cuántas cifras significativas se muestran en tablas y resultados.'],
    ],
    [
      ['Parameters', 'Left column: the function, the interval or initial values, the tolerance and the maximum number of iterations. Everything is recomputed as you type.'],
      ['Examples', 'Buttons below the parameters that load typical exercises (including cases that diverge or fail, so you can see why).'],
      ['Theory & formulas', 'Collapsible panel at the top: iteration formula, convergence hypotheses, order and error bound.'],
      ['Indicators', 'Cards with the main result (highlighted), number of iterations, final error or residual and estimated order.'],
      ['Plot', 'Interactive: drag to pan, scroll or select to zoom, double-click to reset; the camera icon downloads a PNG.'],
      ['Iteration table', 'One row per iteration with the values and errors. The highlighted row is the solution. CSV button for Excel.'],
      ['Step by step', 'The worked solution as in your notebook: substitution into the formula for the first iterations.'],
      ['Scilab code', 'Equivalent program, ready to copy or download as .sce and run in Scilab.'],
      ['Digits', 'Selector at the bottom of the menu: how many significant digits are shown in tables and results.'],
    ],
  )
  return (
    <>
      <h3>{L('Qué hay en cada página de método', 'What each method page contains')}</h3>
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
    if (
      !window.confirm(
        L(
          '¿Borrar las entradas guardadas de todos los métodos? Se restablecerán los valores de ejemplo. (El tema y las preferencias se conservan.)',
          'Delete the saved inputs of every method? The example values will be restored. (Theme and preferences are kept.)',
        ),
      )
    )
      return
    const keep = new Set(['numlab:dark', 'numlab:digits', 'numlab:palette', 'numlab:nav-collapsed', 'numlab:lang'])
    for (const k of Object.keys(localStorage)) if (k.startsWith('numlab:') && !keep.has(k)) localStorage.removeItem(k)
    setCleared(true)
  }
  return (
    <>
      <h3>{L('Idioma', 'Language')}</h3>
      <div className="help-switch">
        <div>
          <b>{L('Idioma de la interfaz', 'Interface language')}</b>
          <span>
            {L(
              'Textos, teoría, tablas y código Scilab generado. Al cambiarlo la página se recarga; tus entradas se conservan.',
              'Labels, theory, tables and the generated Scilab code. Changing it reloads the page; your inputs are kept.',
            )}
          </span>
        </div>
        <LangSwitch full />
      </div>
      <h3>{L('Consejos', 'Tips')}</h3>
      {L(
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
        </ul>,
        <ul>
          <li>Your inputs are saved automatically in this browser: when you come back to a method, you find it as you left it.</li>
          <li>
            If the plot looks squashed (for instance by an asymptote), fix the range with <b>x min</b> / <b>x max</b>.
          </li>
          <li>Compare stopping criteria (absolute error, relative error or residual): they change the number of iterations.</li>
          <li>Try the examples that diverge: understanding why a method fails is part of the exam.</li>
          <li>
            The <b>Compare</b> page of each topic puts several methods side by side on the same problem.
          </li>
          <li>
            To print or save as PDF use <Kbd>{MOD_KEY}</Kbd> <Kbd>P</Kbd>: the side menu is hidden automatically.
          </li>
        </ul>,
      )}
      <h3>{L('Datos guardados', 'Saved data')}</h3>
      <div className="help-switch">
        <div>
          <b>{L('Restablecer todas las entradas', 'Reset all inputs')}</b>
          <span>{L('Vuelve a los valores de ejemplo en todos los métodos.', 'Restores the example values in every method.')}</span>
        </div>
        <button type="button" className="btn sm" onClick={clear} disabled={cleared}>
          {cleared ? L('Borrado · recarga la página', 'Deleted · reload the page') : L('Borrar datos', 'Delete data')}
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
        {L(
          <>
            Laboratorio interactivo de métodos numéricos{course ? <> para <b>{course}</b></> : null}: cada método con tabla de iteraciones,
            gráficas, análisis de error, desarrollo paso a paso y exportación a Scilab.
          </>,
          <>
            Interactive numerical methods lab{course ? <> for <b>{course}</b></> : null}: every method with an iteration table, plots, error
            analysis, a step-by-step solution and export to Scilab.
          </>,
        )}
      </p>
      <p className="muted">
        {L(
          <>
            Proyecto de código abierto hecho por y para estudiantes. ¿Encontraste un error o quieres agregar un método? Abre un <i>issue</i> o un{' '}
            <i>pull request</i> en el repositorio.
          </>,
          <>
            Open-source project made by and for students. Found a bug or want to add a method? Open an <i>issue</i> or a <i>pull request</i> in the
            repository.
          </>,
        )}
      </p>
      {CONFIG.repoUrl && (
        <p>
          <a className="btn" href={CONFIG.repoUrl} target="_blank" rel="noopener noreferrer">
            <IconGithub /> {L('Código fuente en GitHub', 'Source code on GitHub')}
          </a>
        </p>
      )}
      <h3>{L('Licencia', 'License')}</h3>
      <p className="muted">
        {CONFIG.license ? (
          L(
            <>
              Distribuido bajo la licencia <b>{CONFIG.license}</b>.{' '}
            </>,
            <>
              Released under the <b>{CONFIG.license}</b> license.{' '}
            </>,
          )
        ) : (
          <>
            {L(
              'Consulta el archivo LICENSE del repositorio para conocer los términos de uso y distribución.',
              'See the LICENSE file in the repository for the terms of use and distribution.',
            )}{' '}
          </>
        )}
        {CONFIG.licenseUrl && (
          <a href={CONFIG.licenseUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
            {L('Ver LICENSE', 'View LICENSE')}
          </a>
        )}
      </p>
      <h3>{L('Construido con', 'Built with')}</h3>
      <p className="muted">
        {L(
          'React, TypeScript y Vite · KaTeX para las fórmulas · Plotly para las gráficas · math.js y nerdamer para el cálculo simbólico.',
          'React, TypeScript and Vite · KaTeX for the formulas · Plotly for the plots · math.js and nerdamer for symbolic computation.',
        )}
      </p>
      <h3>{L('Idioma', 'Language')}</h3>
      <p className="muted">
        {L(
          'NumLab está disponible en español e inglés. El idioma se elige con el selector ES | EN de la barra superior o en Consejos y preferencias.',
          'NumLab is available in Spanish and English. Choose the language with the ES | EN selector in the top bar or under Tips & preferences.',
        )}
      </p>
      <h3>{L('Adaptar a tu curso', 'Adapting it to your course')}</h3>
      <p className="muted">
        {L(
          <>
            La sigla, la universidad, el semestre y las fechas de examen están en <code>src/config.ts</code>. Si dejas la lista de exámenes vacía,
            la cuenta regresiva se oculta.
          </>,
          <>
            The course code, university, term and exam dates live in <code>src/config.ts</code>. If you leave the list of exams empty, the
            countdown is hidden.
          </>,
        )}
      </p>
    </>
  )
}
