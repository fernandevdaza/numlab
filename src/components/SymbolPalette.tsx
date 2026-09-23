// Teclado de símbolos: aparece cuando se enfoca un campo de expresión y permite insertar
// funciones, constantes y operadores (sintaxis de mathjs) en la posición del cursor.
//
// Es global: se monta una sola vez en App y detecta el campo enfocado con `focusin`, así
// funciona en todas las páginas sin que cada módulo haga nada. Un campo participa si:
//   · es <input class="input mono"> de texto, o <textarea class="input">, o
//   · tiene el atributo data-palette (valores: "expr" | "num" | "matrix"; "off" lo excluye).
// Atributos opcionales del campo:
//   · data-vars="x,y"  → muestra teclas para esas variables.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'
import { IconArrowLeft, IconArrowRight, IconBackspace, IconClose, IconHelp } from './icons'
import { L } from '../i18n'

type Field = HTMLInputElement | HTMLTextAreaElement

const TEXT_TYPES = new Set(['text', 'search', ''])

/** ¿Este elemento debe mostrar el teclado de símbolos? */
export function isMathInput(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false
  if (el.readOnly || el.disabled) return false
  const p = el.dataset.palette
  if (p === 'off' || el.closest('[data-palette="off"]')) return false
  if (el instanceof HTMLInputElement && !TEXT_TYPES.has(el.getAttribute('type') ?? '')) return false
  if (p) return true
  return el.classList.contains('input') && (el instanceof HTMLTextAreaElement || el.classList.contains('mono'))
}

interface Key {
  label: ReactNode
  /** texto a insertar */
  ins: string
  /** cuántos caracteres retroceder el cursor después de insertar (p. ej. 1 para quedar dentro de "()") */
  back?: number
  /** si hay texto seleccionado, envolverlo: [antes, después] */
  wrap?: [string, string]
  title: string
  cls?: string
  /** función: en campos de expresión se inserta con un argumento de ejemplo seleccionado, p. ej. sin(x) */
  fn?: string
  /** valor (constante o variable): si hay un argumento de ejemplo seleccionado, lo reemplaza */
  val?: boolean
}

const fn = (name: string, title: string, label: ReactNode = name): Key => ({ label, ins: name + '()', back: 1, wrap: [name + '(', ')'], title, cls: 'fn', fn: name })

const BASIC: Key[] = [
  { label: 'π', ins: 'pi', title: 'pi (π ≈ 3.14159)', cls: 'op', val: true },
  { label: 'e', ins: 'e', title: L('e (número de Euler ≈ 2.71828)', 'e (Euler’s number ≈ 2.71828)'), cls: 'op', val: true },
  { label: '+', ins: ' + ', title: L('suma', 'addition') },
  { label: '−', ins: ' - ', title: L('resta', 'subtraction') },
  { label: '×', ins: '*', title: L('multiplicación (*)', 'multiplication (*)') },
  { label: '÷', ins: '/', title: L('división (/)', 'division (/)') },
  { label: 'xʸ', ins: '^', title: L('potencia (^)', 'power (^)') },
  { label: 'x²', ins: '^2', title: L('al cuadrado (^2)', 'squared (^2)') },
  { label: 'x³', ins: '^3', title: L('al cubo (^3)', 'cubed (^3)') },
  { label: '(', ins: '(', title: L('abrir paréntesis', 'open parenthesis') },
  { label: ')', ins: ')', title: L('cerrar paréntesis', 'close parenthesis') },
  { label: '( )', ins: '()', back: 1, wrap: ['(', ')'], title: L('paréntesis (envuelve la selección)', 'parentheses (wrap the selection)') },
  { label: ',', ins: ', ', title: L('coma (separa argumentos)', 'comma (separates arguments)') },
  { label: '√', ins: 'sqrt()', back: 1, wrap: ['sqrt(', ')'], title: L('raíz cuadrada sqrt()', 'square root sqrt()'), cls: 'op', fn: 'sqrt' },
  { label: '|x|', ins: 'abs()', back: 1, wrap: ['abs(', ')'], title: L('valor absoluto abs()', 'absolute value abs()'), cls: 'op', fn: 'abs' },
  { label: '10ⁿ', ins: 'e-', title: L('notación científica: 1e-6 = 1·10⁻⁶', 'scientific notation: 1e-6 = 1·10⁻⁶'), cls: 'op' },
]

const FUNCS: Key[] = [
  fn('sin', L('seno (también sen)', 'sine (also sen)')),
  fn('cos', L('coseno', 'cosine')),
  fn('tan', L('tangente (también tg)', 'tangent (also tg)')),
  fn('asin', L('arcoseno (también arcsen)', 'arcsine (also arcsen)')),
  fn('acos', L('arcocoseno', 'arccosine')),
  fn('atan', L('arcotangente (también arctg)', 'arctangent (also arctg)')),
  fn('exp', L('exponencial eˣ', 'exponential eˣ')),
  fn('ln', L('logaritmo natural (= log)', 'natural logarithm (= log)')),
  fn('log10', L('logaritmo en base 10', 'base-10 logarithm')),
  fn('sinh', L('seno hiperbólico', 'hyperbolic sine')),
  fn('cosh', L('coseno hiperbólico', 'hyperbolic cosine')),
  fn('tanh', L('tangente hiperbólica', 'hyperbolic tangent')),
]

const MATRIX: Key[] = [
  { label: ';', ins: '; ', title: L('nueva fila (;)', 'new row (;)'), cls: 'op' },
  { label: '↵', ins: '\n', title: L('nueva fila (salto de línea)', 'new row (line break)'), cls: 'op' },
]

/** Inserta texto en el campo en la posición del cursor, disparando el evento `input` (compatible con React).
 *  `sel`: rango [desde, hasta] relativo al texto insertado que queda seleccionado al terminar.
 *  Devuelve la posición donde empezó la inserción. */
export function insertAtCaret(el: Field, k: Pick<Key, 'ins' | 'back' | 'wrap'> & { sel?: [number, number] }): number {
  el.focus({ preventScroll: true })
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  const sel = el.value.slice(start, end)
  let text = k.ins
  let back = k.back ?? 0
  if (k.wrap && sel) {
    text = k.wrap[0] + sel + k.wrap[1]
    back = 0
  }
  // Evitar dobles espacios alrededor de operadores
  if (text.startsWith(' ') && /\s$/.test(el.value.slice(0, start))) text = text.slice(1)
  if (text.endsWith(' ') && /^\s/.test(el.value.slice(end))) text = text.slice(0, -1)

  let ok = false
  try {
    // execCommand conserva el historial de deshacer (Ctrl+Z) y dispara `input`.
    ok = document.execCommand('insertText', false, text)
  } catch {
    ok = false
  }
  if (!ok || el.value.slice(start, start + text.length) !== text) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    const v = el.value.slice(0, start) + text + el.value.slice(end)
    setter ? setter.call(el, v) : (el.value = v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const pos = start + text.length - back
  try {
    if (k.sel && !(k.wrap && sel)) el.setSelectionRange(start + k.sel[0], start + k.sel[1])
    else el.setSelectionRange(pos, pos)
  } catch {
    /* algunos tipos de input no admiten selección */
  }
  return start
}

/** Modo del campo y variables declaradas (data-palette / data-vars). */
function fieldInfo(el: Field) {
  const mode = el.dataset.palette ?? (el instanceof HTMLTextAreaElement && el.classList.contains('matrix') ? 'matrix' : 'expr')
  const vars = (el.dataset.vars ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return { mode, vars }
}

/**
 * Argumento de ejemplo seleccionado tras insertar una función (sin(x) con la x seleccionada).
 * Evita dejar "sin()" en el campo, que math.js acepta al compilar pero falla al evaluar.
 */
const placeholders = new WeakMap<Field, { s: number; e: number; text: string }>()

function pressKey(el: Field, k: Key) {
  const { mode, vars } = fieldInfo(el)
  let s = el.selectionStart ?? el.value.length
  let e = el.selectionEnd ?? s
  const ph = placeholders.get(el)
  placeholders.delete(el)
  const onPh = !!ph && ph.s === s && ph.e === e && el.value.slice(s, e) === ph.text
  if (onPh && !k.val) {
    if (k.wrap) {
      // sin(x) + √ → sin(sqrt(x)) con la x todavía seleccionada
      const a = k.wrap[0].length
      const st = insertAtCaret(el, { ins: k.wrap[0] + ph.text + k.wrap[1], sel: [a, a + ph.text.length] })
      placeholders.set(el, { s: st + a, e: st + a + ph.text.length, text: ph.text })
      return
    }
    // operadores: continuar después del argumento, sin borrarlo (sin(x) + ^2 → sin(x^2))
    el.setSelectionRange(e, e)
    s = e
  }
  if (k.fn && mode === 'expr' && s === e) {
    const v = vars[0] ?? 'x'
    const a = k.fn.length + 1
    const st = insertAtCaret(el, { ins: `${k.fn}(${v})`, sel: [a, a + v.length] })
    placeholders.set(el, { s: st + a, e: st + a + v.length, text: v })
    return
  }
  // En vectores y matrices el espacio separa valores: "1 + 2" serían tres elementos.
  if (mode !== 'expr' && k.ins.trim() !== k.ins && k.ins !== '\n') {
    insertAtCaret(el, { ...k, ins: k.ins.trim() })
    return
  }
  insertAtCaret(el, k)
}

function moveCaret(el: Field, d: number) {
  el.focus({ preventScroll: true })
  const s = el.selectionStart ?? 0
  const e = el.selectionEnd ?? s
  const p = s !== e ? (d < 0 ? s : e) : Math.max(0, Math.min(el.value.length, s + d))
  el.setSelectionRange(p, p)
}

function backspace(el: Field) {
  el.focus({ preventScroll: true })
  const s = el.selectionStart ?? el.value.length
  const e = el.selectionEnd ?? s
  if (s === e && s === 0) return
  let ok = false
  try {
    ok = document.execCommand('delete', false)
  } catch {
    ok = false
  }
  if (!ok) {
    const a = s === e ? s - 1 : s
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, el.value.slice(0, a) + el.value.slice(e))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.setSelectionRange(a, a)
  }
}

/** Evita que un clic/toque en el teclado le quite el foco al campo. */
const keep = (e: SyntheticEvent) => e.preventDefault()

export function SymbolPalette({ enabled, setEnabled, onHelp }: { enabled: boolean; setEnabled: (v: boolean) => void; onHelp?: () => void }) {
  const [target, setTarget] = useState<Field | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onIn = (e: FocusEvent) => {
      if (isMathInput(e.target)) setTarget(e.target)
    }
    const onOut = () => {
      setTimeout(() => {
        const a = document.activeElement
        if (isMathInput(a)) return
        if (a && panelRef.current?.contains(a)) return
        setTarget(null)
      }, 0)
    }
    const onRoute = () => setTarget(null)
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    window.addEventListener('hashchange', onRoute)
    if (isMathInput(document.activeElement)) setTarget(document.activeElement)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
      window.removeEventListener('hashchange', onRoute)
    }
  }, [])

  // Teclado virtual en móvil: subir el panel por encima del teclado del sistema.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const upd = () => {
      const off = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--kb-offset', Math.round(off) + 'px')
    }
    upd()
    vv.addEventListener('resize', upd)
    vv.addEventListener('scroll', upd)
    return () => {
      vv.removeEventListener('resize', upd)
      vv.removeEventListener('scroll', upd)
    }
  }, [])

  const visible = !!target && enabled && target.isConnected

  // Reservar espacio abajo (padding / scroll-padding) mientras el panel está visible.
  useLayoutEffect(() => {
    const root = document.documentElement
    const el = panelRef.current
    if (!visible || !el) {
      root.style.setProperty('--palette-h', '0px')
      return
    }
    const set = () => root.style.setProperty('--palette-h', Math.ceil(el.getBoundingClientRect().height + 14) + 'px')
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty('--palette-h', '0px')
    }
  }, [visible])

  // Si el panel tapa el campo enfocado, desplazarlo a la vista.
  useEffect(() => {
    if (!visible || !target || !panelRef.current) return
    const t = setTimeout(() => {
      const r = target.getBoundingClientRect()
      const p = panelRef.current?.getBoundingClientRect()
      if (p && r.bottom > p.top - 8) target.scrollIntoView({ block: 'nearest' })
    }, 60)
    return () => clearTimeout(t)
  }, [visible, target])

  const press = useCallback(
    (k: Key) => {
      if (target) pressKey(target, k)
    },
    [target],
  )

  if (!target || !target.isConnected) return null

  if (!enabled) {
    return (
      <button type="button" className="sympad-fab" onPointerDown={keep} onMouseDown={keep} onClick={() => setEnabled(true)} title={L('Mostrar el teclado de símbolos', 'Show the symbol keyboard')}>
        <b>∑</b> {L('Símbolos', 'Symbols')}
      </button>
    )
  }

  const { mode, vars } = fieldInfo(target)
  const varKeys: Key[] = mode === 'num' || mode === 'matrix' ? [] : vars.map((v) => ({ label: v, ins: v, title: 'variable ' + v, cls: 'var', val: true }))
  const extra = mode === 'matrix' ? MATRIX : []

  const render = (k: Key, i: number) => (
    <button key={i} type="button" tabIndex={-1} className={'sympad-key ' + (k.cls ?? '')} title={k.title} aria-label={k.title} onPointerDown={keep} onMouseDown={keep} onClick={() => press(k)}>
      {k.label}
    </button>
  )

  return (
    <div className="sympad-dock">
      <div className="sympad" ref={panelRef} role="toolbar" aria-label={L('Teclado de símbolos matemáticos', 'Math symbol keyboard')} onPointerDown={keep} onMouseDown={keep}>
        <div className="sympad-row">
          {varKeys.map(render)}
          {varKeys.length > 0 && <span className="sympad-sep" />}
          {BASIC.map(render)}
          {extra.map(render)}
          <div className="sympad-end">
            <button type="button" tabIndex={-1} className="sympad-key ctl" title={L('Mover el cursor a la izquierda', 'Move the cursor left')} aria-label={L('Cursor a la izquierda', 'Cursor left')} onPointerDown={keep} onMouseDown={keep} onClick={() => moveCaret(target, -1)}>
              <IconArrowLeft size={15} />
            </button>
            <button type="button" tabIndex={-1} className="sympad-key ctl" title={L('Mover el cursor a la derecha', 'Move the cursor right')} aria-label={L('Cursor a la derecha', 'Cursor right')} onPointerDown={keep} onMouseDown={keep} onClick={() => moveCaret(target, 1)}>
              <IconArrowRight size={15} />
            </button>
            <button type="button" tabIndex={-1} className="sympad-key ctl" title={L('Borrar', 'Backspace')} aria-label={L('Borrar', 'Backspace')} onPointerDown={keep} onMouseDown={keep} onClick={() => backspace(target)}>
              <IconBackspace size={16} />
            </button>
          </div>
        </div>
        <div className="sympad-row">
          <span className="sympad-title">{L('Funciones', 'Functions')}</span>
          {FUNCS.map(render)}
          <div className="sympad-end">
            {onHelp && (
              <button type="button" tabIndex={-1} className="sympad-key ctl" title={L('Guía de sintaxis', 'Syntax guide')} aria-label={L('Guía de sintaxis', 'Syntax guide')} onPointerDown={keep} onMouseDown={keep} onClick={onHelp}>
                <IconHelp size={15} />
              </button>
            )}
            <button type="button" tabIndex={-1} className="sympad-key ctl" title={L('Ocultar el teclado de símbolos', 'Hide the symbol keyboard')} aria-label={L('Ocultar el teclado de símbolos', 'Hide the symbol keyboard')} onPointerDown={keep} onMouseDown={keep} onClick={() => setEnabled(false)}>
              <IconClose size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
