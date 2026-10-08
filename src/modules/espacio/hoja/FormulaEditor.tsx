// Editor de fórmulas de la hoja (en la celda y en la barra de fórmulas): un <textarea> transparente
// sobre una copia coloreada del texto, con referencias de colores, autocompletado de funciones,
// ayuda de argumentos, F4, modo «apuntar» con las flechas y las teclas de Excel.
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { L, LANG } from '../../../i18n'
import { FUNCTIONS, sheetFunction, type FnDef } from './funciones'
import { caretContext, refColor, tokenize } from './tokens'

export interface Pos {
  r: number
  c: number
}

export interface EditState {
  pos: Pos
  text: string
  /** enter: empezó escribiendo (las flechas apuntan o confirman); edit: F2/doble clic (flechas = cursor) */
  mode: 'enter' | 'edit'
  source: 'cell' | 'bar'
  caret: number
  caretEnd: number
  /** cambia cuando el texto o el cursor se fijan desde fuera (hay que llevarlo al DOM) */
  nonce: number
  /** referencia que se está apuntando con el ratón o las flechas */
  point: { start: number; end: number; anchor: Pos; focus: Pos } | null
  error: string | null
}

export interface EditorApi {
  setText(text: string, caret: number, caretEnd?: number): void
  setCaret(caret: number, caretEnd: number): void
  replace(text: string, caret: number): void
  commit(move: [number, number], all?: boolean): void
  cancel(): void
  canPoint(): boolean
  pointMove(dr: number, dc: number, extend: boolean): void
  cycleRef(): void
  toggleMode(): void
  startFromBar(caret: number): void
  /** el foco salió del editor (no hacia otro editor): confirmar sin moverse */
  blur(): void
}

/** Funciones para el autocompletado, con el nombre en el idioma de la interfaz. */
const COMPLETIONS = FUNCTIONS.map((f) => ({ f, label: LANG === 'es' ? f.es : f.en, other: LANG === 'es' ? f.en : f.es }))
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

function rank(typed: string, names: string[]) {
  const q = fold(typed)
  const fns = COMPLETIONS.filter((x) => fold(x.label).startsWith(q) || fold(x.other).startsWith(q))
    .sort((a, b) => Number(fold(b.label).startsWith(q)) - Number(fold(a.label).startsWith(q)) || a.label.length - b.label.length)
    .map((x) => ({ kind: 'fn' as const, label: fold(x.label).startsWith(q) ? x.label : x.other, f: x.f as FnDef | undefined }))
  const vars = names.filter((n) => fold(n).startsWith(q) && n.toUpperCase() !== q).map((n) => ({ kind: 'name' as const, label: n, f: undefined }))
  return [...vars, ...fns].slice(0, 8)
}

/** Texto coloreado (referencias con su color, funciones, textos, números y errores). */
function highlight(text: string, dark: boolean): ReactNode[] {
  if (!text.startsWith('=')) return [text]
  const colors = new Map<string, number>()
  return tokenize(text).map((t, i) => {
    if (t.type === 'ref') {
      const key = t.text.replace(/\$/g, '').toUpperCase()
      let ci = colors.get(key)
      if (ci === undefined) colors.set(key, (ci = colors.size))
      return (
        <span key={i} style={{ color: refColor(ci, dark) }}>
          {t.text}
        </span>
      )
    }
    const cls = t.type === 'func' ? 'fx-fn' : t.type === 'string' ? 'fx-str' : t.type === 'number' ? 'fx-num' : t.type === 'error' ? 'fx-err' : t.type === 'bool' ? 'fx-num' : null
    return cls ? (
      <span key={i} className={cls}>
        {t.text}
      </span>
    ) : (
      t.text
    )
  })
}

let measureCtx: CanvasRenderingContext2D | null = null

export function FormulaEditor({
  variant,
  edit,
  idleText,
  api,
  names,
  dark,
  style,
  className,
  ariaLabel,
}: {
  variant: 'cell' | 'bar'
  edit: EditState | null
  idleText: string
  api: EditorApi
  names: string[]
  dark: boolean
  style?: CSSProperties
  className?: string
  ariaLabel: string
}) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const hl = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const [index, setIndex] = useState(0)
  const [dismissed, setDismissed] = useState('')
  const mine = !!edit && edit.source === variant
  const text = edit ? edit.text : idleText

  // cambios programáticos del texto o el cursor → DOM
  useLayoutEffect(() => {
    const el = ta.current
    if (!el || !mine || !edit) return
    if (document.activeElement !== el) el.focus({ preventScroll: true })
    if (el.selectionStart !== edit.caret || el.selectionEnd !== edit.caretEnd) el.setSelectionRange(Math.min(edit.caret, edit.caretEnd), Math.max(edit.caret, edit.caretEnd))
    sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit?.nonce, edit?.source, mine])

  const sync = () => {
    if (ta.current && hl.current) {
      hl.current.scrollTop = ta.current.scrollTop
      hl.current.scrollLeft = ta.current.scrollLeft
    }
  }

  const active = mine && focused && !!edit && edit.text.startsWith('=')
  const ctx = useMemo(() => (active && edit ? caretContext(edit.text, edit.caret) : null), [active, edit])
  const key = edit ? `${edit.text}|${edit.caret}` : ''
  const items = useMemo(() => (ctx?.ident && dismissed !== key ? rank(ctx.ident.text, names) : []), [ctx, dismissed, key, names])
  const identText = ctx?.ident?.text ?? ''
  useLayoutEffect(() => setIndex(0), [identText])
  const sig = useMemo(() => {
    if (!ctx?.fn) return null
    const f = sheetFunction(ctx.fn.name)
    return f ? { f, arg: ctx.fn.argIndex } : null
  }, [ctx])

  const caretX = useMemo(() => {
    const el = ta.current
    if (!el || !edit || !mine) return 0
    measureCtx ??= document.createElement('canvas').getContext('2d')
    if (!measureCtx) return 0
    const cs = getComputedStyle(el)
    measureCtx.font = `${cs.fontSize} ${cs.fontFamily}`
    const before = edit.text.slice(0, ctx?.ident?.start ?? edit.caret)
    const line = before.slice(before.lastIndexOf('\n') + 1)
    return Math.max(0, Math.min(el.clientWidth - 40, measureCtx.measureText(line).width + parseFloat(cs.paddingLeft) - el.scrollLeft))
  }, [edit, mine, ctx])

  const accept = (i: number) => {
    const it = items[i]
    if (!edit || !it || !ctx?.ident) return
    const ins = it.kind === 'fn' ? `${it.label}(` : it.label
    const t = edit.text.slice(0, ctx.ident.start) + ins + edit.text.slice(ctx.ident.end)
    api.replace(t, ctx.ident.start + ins.length)
  }

  const MOVES: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

  return (
    <div className={'fx ' + (className ?? '') + (edit?.error && mine ? ' bad' : '')} style={style}>
      <div ref={hl} className="fx-hl mono" aria-hidden>
        {highlight(text, dark)}
        {'​'}
      </div>
      <textarea
        ref={ta}
        className="fx-ta mono"
        value={text}
        rows={1}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        aria-label={ariaLabel}
        data-keep-edit
        onFocus={(e) => {
          setFocused(true)
          if (!edit && variant === 'bar') api.startFromBar(e.currentTarget.selectionStart)
        }}
        onBlur={(e) => {
          setFocused(false)
          const to = e.relatedTarget as HTMLElement | null
          if (mine && !to?.closest?.('[data-keep-edit], .fx')) api.blur()
        }}
        onScroll={sync}
        onChange={(e) => {
          if (!edit && variant === 'bar') api.startFromBar(e.target.selectionStart)
          api.setText(e.target.value, e.target.selectionStart, e.target.selectionEnd)
        }}
        onSelect={(e) => mine && api.setCaret(e.currentTarget.selectionStart, e.currentTarget.selectionEnd)}
        onKeyDown={(e) => {
          if (!edit || !mine) return
          const k = e.key
          if (items.length) {
            if (k === 'ArrowDown' || k === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => (i + (k === 'ArrowDown' ? 1 : items.length - 1)) % items.length)
              return
            }
            if (k === 'Tab' || (k === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey)) {
              e.preventDefault()
              accept(index)
              return
            }
            if (k === 'Escape') {
              e.preventDefault()
              setDismissed(key)
              return
            }
          }
          if (k === 'Enter' && e.altKey) {
            e.preventDefault()
            const el = e.currentTarget
            api.replace(edit.text.slice(0, el.selectionStart) + '\n' + edit.text.slice(el.selectionEnd), el.selectionStart + 1)
          } else if (k === 'Enter') {
            e.preventDefault()
            api.commit(e.shiftKey ? [-1, 0] : [1, 0], e.ctrlKey || e.metaKey)
          } else if (k === 'Tab') {
            e.preventDefault()
            api.commit(e.shiftKey ? [0, -1] : [0, 1])
          } else if (k === 'Escape') {
            e.preventDefault()
            api.cancel()
          } else if (k === 'F4') {
            e.preventDefault()
            api.cycleRef()
          } else if (k === 'F2') {
            e.preventDefault()
            api.toggleMode()
          } else if (MOVES[k] && edit.mode === 'enter' && variant === 'cell') {
            e.preventDefault()
            const [dr, dc] = MOVES[k]
            if (api.canPoint()) api.pointMove(dr, dc, e.shiftKey)
            else api.commit([dr, dc])
          }
        }}
      />
      {mine && focused && (items.length > 0 || sig) && (
        <div className="fx-pop" style={{ left: caretX }}>
          {items.length > 0 ? (
            <ul className="fx-list" role="listbox">
              {items.map((it, i) => (
                <li
                  key={it.kind + it.label}
                  role="option"
                  aria-selected={i === index}
                  className={i === index ? 'on' : ''}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    accept(i)
                  }}
                >
                  <span className="mono">{it.label}</span>
                  <span className="fx-desc">{it.f ? (LANG === 'es' ? it.f.descEs : it.f.desc) : L('columna / variable', 'column / variable')}</span>
                </li>
              ))}
            </ul>
          ) : sig ? (
            <Signature f={sig.f} arg={sig.arg} />
          ) : null}
        </div>
      )}
      {mine && edit?.error && <div className="fx-error">{edit.error}</div>}
    </div>
  )
}

/** SUMA(número1, [número2], …) con el argumento actual en negrita y su descripción. */
function Signature({ f, arg }: { f: FnDef; arg: number }) {
  const es = LANG === 'es'
  const sep = es ? '; ' : ', '
  const args = f.args
  const repIdx = args.findIndex((a) => a.rep)
  const cur = repIdx >= 0 && arg >= repIdx ? repIdx : Math.min(arg, args.length - 1)
  return (
    <div className="fx-sig">
      <div className="mono">
        {es ? f.es : f.en}(
        {args.map((a, i) => (
          <span key={i}>
            {i ? sep : ''}
            <span className={i === cur ? 'fx-cur' : ''}>
              {a.optional ? '[' : ''}
              {es ? a.es : a.name}
              {a.optional ? ']' : ''}
            </span>
            {a.rep ? sep + '…' : ''}
          </span>
        ))}
        )
      </div>
      {args[cur] && <div className="fx-desc">{es ? args[cur].descEs : args[cur].desc}</div>}
    </div>
  )
}
