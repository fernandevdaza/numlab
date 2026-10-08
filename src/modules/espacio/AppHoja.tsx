// App de hoja de cálculo, al estilo de Excel (ideas del editor de OpenRiskSim):
// · edición en la celda o en la barra de fórmulas, con referencias de colores, modo «apuntar»
//   (clic, arrastre o flechas para insertar referencias), F4, autocompletado y ayuda de argumentos;
// · selección de rangos, controlador de relleno con series, Ctrl+D/R, Ctrl+Enter;
// · copiar, cortar y pegar ajustando referencias (y pegar valores), deshacer/rehacer;
// · formatos (número, %, decimales, negrita, alineación, colores), insertar/eliminar filas y
//   columnas, Autosuma, mostrar fórmulas, ancho de columnas, importar/exportar CSV;
// · columnas con nombre (listas compartidas con el documento) y fórmulas de columna.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent as RMouseEvent } from 'react'
import { L, LANG } from '../../i18n'
import { useTheme } from '../../components/theme'
import { download } from '../../components/ui'
import { H, colLetter, pasteBlock, refOf, showCell, toCsv, translateFormula, usedExtent, type CellFmt, type SheetData, type SheetResult } from './hoja'
import { boundsText, caretContext, cycleReference, formulaRefs, missingParens, parseBounds, refColor, type Bounds } from './hoja/tokens'
import { FormulaEditor, type EditState, type EditorApi, type Pos } from './hoja/FormulaEditor'
import { autoSumRange, clearRange, errorHelp, fillAll, fillExtent, fillRange, fillTarget, inBounds, insertLines, makeClip, norm, pasteClip, setCells, setFormat, type Clip, type FillDir } from './hoja/ops'
import type { Pane } from './doc'

type SheetPane = Extract<Pane, { kind: 'sheet' }>

const ROW_H = 26
const HEAD_H = 26
const ROWHEAD_W = 44
const DEF_W = 96
const HIST = 100

/** Historial de deshacer por hoja (vive mientras la página está abierta). */
const histories = new Map<string, { undo: SheetData[]; redo: SheetData[] }>()

export function AppHoja({ pane, result, onChange }: { pane: SheetPane; result: SheetResult | undefined; onChange: (p: SheetPane) => void }) {
  const sh = pane.sheet
  const { dark } = useTheme()
  const shRef = useRef(sh)
  shRef.current = sh
  const hist = histories.get(pane.id) ?? histories.set(pane.id, { undo: [], redo: [] }).get(pane.id)!

  /** Cambio con deshacer. */
  const apply = (next: SheetData) => {
    hist.undo.push(shRef.current)
    if (hist.undo.length > HIST) hist.undo.shift()
    hist.redo = []
    shRef.current = next
    onChange({ ...pane, sheet: next })
  }
  /** Cambio sin historial (tamaño, scroll). */
  const quiet = (next: SheetData) => {
    shRef.current = next
    onChange({ ...pane, sheet: next })
  }
  const undo = () => {
    const prev = hist.undo.pop()
    if (!prev) return
    hist.redo.push(shRef.current)
    shRef.current = prev
    onChange({ ...pane, sheet: prev })
  }
  const redo = () => {
    const next = hist.redo.pop()
    if (!next) return
    hist.undo.push(shRef.current)
    shRef.current = next
    onChange({ ...pane, sheet: next })
  }

  /* ─────────────── selección y edición ─────────────── */

  const [anchor, setAnchor] = useState<Pos>({ r: 0, c: 0 })
  const [focus, setFocus] = useState<Pos>({ r: 0, c: 0 })
  const sel = norm(anchor, focus)
  const [edit, setEditState] = useState<EditState | null>(null)
  const editRef = useRef(edit)
  editRef.current = edit
  const setEdit = (e: EditState | null) => {
    editRef.current = e
    setEditState(e)
  }
  const [clip, setClip] = useState<Clip | null>(null)
  const [showFormulas, setShowFormulas] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [fillPreview, setFillPreview] = useState<Bounds | null>(null)

  const sinkRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  // el foco vuelve a la cuadrícula al instante (para no perder lo que se escribe enseguida) y otra
  // vez tras el clic, que al soltar puede llevárselo al <body>
  const focusGrid = () => {
    sinkRef.current?.focus({ preventScroll: true })
    requestAnimationFrame(() => sinkRef.current?.focus({ preventScroll: true }))
  }

  const raw = (p: Pos) => sh.cells[refOf(p.c, p.r)] ?? ''
  const select = (a: Pos, f: Pos = a) => {
    setAnchor(a)
    setFocus(f)
  }
  const moveTo = (p: Pos, extend = false) => {
    const q = { r: Math.max(0, Math.min(p.r, 4999)), c: Math.max(0, Math.min(p.c, sh.cols - 1)) }
    if (q.r >= shRef.current.rows - 1) quiet({ ...shRef.current, rows: Math.min(5000, q.r + 20) })
    if (extend) setFocus(q)
    else select(q)
  }

  const nonce = useRef(0)
  const start = (text: string, mode: 'enter' | 'edit', source: 'cell' | 'bar' = 'cell', caret = text.length) => {
    setEdit({ pos: { ...focus }, text, mode, source, caret, caretEnd: caret, nonce: ++nonce.current, point: null, error: null })
    setAnchor(focus)
  }

  const commitText = (ed: EditState, all: boolean): boolean => {
    let text = ed.text
    if (text.trim().startsWith('=')) {
      text = text.trim() + ')'.repeat(missingParens(text))
      try {
        H.parse(translateFormula(text, sh.rows))
      } catch (e: any) {
        setEdit({ ...ed, text, error: L('Hay un problema con esta fórmula: ', 'There is a problem with this formula: ') + String(e?.message ?? e), nonce: ++nonce.current })
        return false
      }
    }
    const s = shRef.current
    if (all && (sel.r0 !== sel.r1 || sel.c0 !== sel.c1)) apply(fillAll(s, sel, ed.pos, text))
    else if ((s.cells[refOf(ed.pos.c, ed.pos.r)] ?? '') !== text) apply(setCells(s, [[refOf(ed.pos.c, ed.pos.r), text]]))
    setClip((c) => (c && !c.cut ? null : c))
    return true
  }

  const api: EditorApi = {
    setText: (text, caret, caretEnd = caret) => {
      const ed = editRef.current
      if (ed) setEdit({ ...ed, text, caret, caretEnd, point: null, error: null })
    },
    setCaret: (caret, caretEnd) => {
      const ed = editRef.current
      if (!ed || (ed.caret === caret && ed.caretEnd === caretEnd)) return
      const keep = ed.point && caret === ed.point.end && caretEnd === caret
      setEdit({ ...ed, caret, caretEnd, point: keep ? ed.point : null })
    },
    replace: (text, caret) => {
      const ed = editRef.current
      if (ed) setEdit({ ...ed, text, caret, caretEnd: caret, nonce: ++nonce.current, point: null, error: null })
    },
    commit: (move, all) => {
      const ed = editRef.current
      if (!ed || !commitText(ed, !!all)) return
      setEdit(null)
      if (!all) moveTo({ r: ed.pos.r + move[0], c: ed.pos.c + move[1] })
      focusGrid()
    },
    cancel: () => {
      setEdit(null)
      focusGrid()
    },
    canPoint: () => {
      const ed = editRef.current
      if (!ed || !ed.text.startsWith('=') || ed.caret !== ed.caretEnd) return false
      if (ed.point && ed.caret === ed.point.end) return true
      return caretContext(ed.text, ed.caret).canInsertRef
    },
    pointMove: (dr, dc, extend) => {
      const ed = editRef.current
      if (!ed) return
      const base = ed.point ? ed.point.focus : ed.pos
      const f = { r: Math.max(0, base.r + dr), c: Math.max(0, Math.min(sh.cols - 1, base.c + dc)) }
      pointTo(extend && ed.point ? ed.point.anchor : f, f)
    },
    cycleRef: () => {
      const ed = editRef.current
      if (!ed) return
      const r = cycleReference(ed.text, ed.caret)
      if (r) setEdit({ ...ed, text: r.text, caret: r.end, caretEnd: r.end, nonce: ++nonce.current, point: null })
    },
    toggleMode: () => {
      const ed = editRef.current
      if (ed) setEdit({ ...ed, mode: ed.mode === 'enter' ? 'edit' : 'enter' })
    },
    blur: () => {
      const ed = editRef.current
      if (ed && commitText(ed, false)) setEdit(null)
    },
    startFromBar: (caret) => {
      if (editRef.current) return
      setEdit({ pos: { ...focus }, text: raw(focus), mode: 'edit', source: 'bar', caret, caretEnd: caret, nonce: nonce.current, point: null, error: null })
    },
  }

  /** Inserta (o reemplaza) la referencia que se está apuntando. */
  function pointTo(a: Pos, f: Pos) {
    const ed = editRef.current
    if (!ed) return
    const ref = boundsText(norm(a, f))
    const s = ed.point ? ed.point.start : Math.min(ed.caret, ed.caretEnd)
    const e = ed.point ? ed.point.end : Math.max(ed.caret, ed.caretEnd)
    const text = ed.text.slice(0, s) + ref + ed.text.slice(e)
    setEdit({ ...ed, text, caret: s + ref.length, caretEnd: s + ref.length, nonce: ++nonce.current, point: { start: s, end: s + ref.length, anchor: a, focus: f }, error: null })
  }

  /* ─────────────── geometría ─────────────── */

  const widthOf = (c: number) => sh.colW?.[colLetter(c)] ?? DEF_W
  const colX = useMemo(() => {
    const xs = [0]
    for (let c = 0; c < sh.cols; c++) xs.push(xs[c] + widthOf(c))
    return xs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sh.cols, sh.colW])
  const totalW = colX[sh.cols]
  const [view, setView] = useState({ top: 0, height: 600 })
  const firstRow = Math.max(0, Math.floor(view.top / ROW_H) - 4)
  const lastRow = Math.min(sh.rows - 1, Math.ceil((view.top + view.height) / ROW_H) + 4)
  const rect = (b: Bounds) => ({ left: ROWHEAD_W + colX[b.c0], top: b.r0 * ROW_H, width: colX[Math.min(b.c1 + 1, sh.cols)] - colX[b.c0], height: (b.r1 - b.r0 + 1) * ROW_H })

  const cellAt = (x: number, y: number): Pos => {
    const box = bodyRef.current!.getBoundingClientRect()
    const px = x - box.left - ROWHEAD_W, py = y - box.top
    let c = 0
    while (c < sh.cols - 1 && colX[c + 1] <= px) c++
    return { r: Math.max(0, Math.floor(py / ROW_H)), c: px < 0 ? 0 : c }
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const on = () => {
      setView({ top: Math.max(0, el.scrollTop - HEAD_H * 3), height: el.clientHeight })
      // crecer al llegar abajo
      if (el.scrollTop + el.clientHeight > el.scrollHeight - 4 * ROW_H && shRef.current.rows < 5000) quiet({ ...shRef.current, rows: shRef.current.rows + 50 })
    }
    on()
    el.addEventListener('scroll', on, { passive: true })
    const ro = new ResizeObserver(on)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', on)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // mantener visible la celda activa
  useEffect(() => {
    const el = scrollRef.current
    if (!el || edit) return
    const y = HEAD_H * 3 + focus.r * ROW_H, x = ROWHEAD_W + colX[focus.c]
    if (y < el.scrollTop + HEAD_H * 3) el.scrollTop = y - HEAD_H * 3
    else if (y + ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = y + ROW_H - el.clientHeight
    if (x < el.scrollLeft + ROWHEAD_W) el.scrollLeft = x - ROWHEAD_W
    else if (x + widthOf(focus.c) > el.scrollLeft + el.clientWidth) el.scrollLeft = x + widthOf(focus.c) - el.clientWidth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.r, focus.c])

  /* ─────────────── ratón ─────────────── */

  const dragLoop = (onMove: (p: Pos) => void, onUp?: () => void) => {
    const move = (ev: MouseEvent) => {
      onMove(cellAt(ev.clientX, ev.clientY))
      // desplazar al acercarse al borde
      const el = scrollRef.current!
      const box = el.getBoundingClientRect()
      if (ev.clientY > box.bottom - 20) el.scrollTop += 20
      else if (ev.clientY < box.top + HEAD_H * 3 + 10) el.scrollTop -= 20
      if (ev.clientX > box.right - 20) el.scrollLeft += 20
      else if (ev.clientX < box.left + ROWHEAD_W + 10) el.scrollLeft -= 20
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      onUp?.()
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onBodyDown = (e: RMouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.fx')) return
    const p = cellAt(e.clientX, e.clientY)
    setMenu(null)
    const ed = editRef.current
    // modo «apuntar»: clic o arrastre inserta la referencia en la fórmula
    if (ed && api.canPoint()) {
      e.preventDefault()
      const a = e.shiftKey && ed.point ? ed.point.anchor : p
      pointTo(a, p)
      dragLoop((q) => pointTo(a, q))
      return
    }
    if (ed && !commitText(ed, false)) return
    if (ed) setEdit(null)
    if (e.shiftKey) setFocus(p)
    else select(p)
    focusGrid()
    const a = e.shiftKey ? anchor : p
    dragLoop((q) => {
      setAnchor(a)
      setFocus(q)
    })
  }

  const onFillDown = (e: RMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const src = sel
    let res: { dir: FillDir; count: number } | null = null
    dragLoop(
      (q) => {
        res = fillExtent(src, q)
        setFillPreview(res ? fillTarget(src, res.dir, res.count) : null)
      },
      () => {
        setFillPreview(null)
        if (!res) return
        const r = res as { dir: FillDir; count: number }
        apply(fillRange(shRef.current, src, r.dir, r.count))
        const t = fillTarget(src, r.dir, r.count)
        select({ r: Math.min(src.r0, t.r0), c: Math.min(src.c0, t.c0) }, { r: Math.max(src.r1, t.r1), c: Math.max(src.c1, t.c1) })
        focusGrid()
      },
    )
  }
  /** Doble clic en el controlador: rellenar hacia abajo hasta donde haya datos en la columna vecina. */
  const fillToData = () => {
    const nb = sel.c0 > 0 ? sel.c0 - 1 : sel.c1 + 1
    let r = sel.r1
    while (r + 1 < sh.rows && (sh.cells[refOf(nb, r + 1)] ?? '') !== '') r++
    if (r > sel.r1) apply(fillRange(sh, sel, 'down', r - sel.r1))
  }

  /* ─────────────── teclado ─────────────── */

  const dataEdge = (p: Pos, dr: number, dc: number): Pos => {
    const ext = usedExtent(sh)
    if (dr > 0) return { r: Math.max(p.r, ext.rows - 1), c: p.c }
    if (dr < 0) return { r: 0, c: p.c }
    if (dc > 0) return { r: p.r, c: Math.max(p.c, Math.min(sh.cols - 1, ext.cols - 1)) }
    return { r: p.r, c: 0 }
  }

  const onGridKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (editRef.current) return
    const mod = e.metaKey || e.ctrlKey
    const k = e.key
    const MOVES: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const handled = () => e.preventDefault()
    if (MOVES[k]) {
      handled()
      const [dr, dc] = MOVES[k]
      moveTo(mod ? dataEdge(focus, dr, dc) : { r: focus.r + dr, c: focus.c + dc }, e.shiftKey)
    } else if (k === 'Tab') (handled(), moveTo({ r: focus.r, c: focus.c + (e.shiftKey ? -1 : 1) }))
    else if (k === 'Enter') (handled(), moveTo({ r: focus.r + (e.shiftKey ? -1 : 1), c: focus.c }))
    else if (k === 'PageDown' || k === 'PageUp') (handled(), moveTo({ r: focus.r + (k === 'PageDown' ? 20 : -20), c: focus.c }, e.shiftKey))
    else if (k === 'Home') (handled(), moveTo(mod ? { r: 0, c: 0 } : { r: focus.r, c: 0 }, e.shiftKey))
    else if (k === 'F2') (handled(), start(raw(focus), 'edit'))
    else if (k === 'Delete' || k === 'Backspace') (handled(), apply(clearRange(sh, sel)))
    else if (k === 'Escape') setClip(null)
    else if (mod && k.toLowerCase() === 'z') (handled(), e.shiftKey ? redo() : undo())
    else if (mod && k.toLowerCase() === 'y') (handled(), redo())
    else if (mod && k.toLowerCase() === 'a') (handled(), select({ r: 0, c: 0 }, { r: sh.rows - 1, c: sh.cols - 1 }))
    else if (mod && k.toLowerCase() === 'd' && sel.r1 > sel.r0) (handled(), apply(fillRange(sh, { ...sel, r1: sel.r0 }, 'down', sel.r1 - sel.r0)))
    else if (mod && k.toLowerCase() === 'r' && sel.c1 > sel.c0) (handled(), apply(fillRange(sh, { ...sel, c1: sel.c0 }, 'right', sel.c1 - sel.c0)))
    else if (mod && k.toLowerCase() === 'b') (handled(), toggleFmt('b'))
    else if (mod && k.toLowerCase() === 'i') (handled(), toggleFmt('i'))
    else if (mod && k === '`') (handled(), setShowFormulas((v) => !v))
    else if (mod && e.shiftKey && k.toLowerCase() === 'v' && clip) (handled(), doPaste(true))
    else if (e.altKey && (k === '=' || e.code === 'Equal')) (handled(), autoSum())
  }

  const startTyping = (el: HTMLInputElement) => {
    if (composing.current) return
    const v = el.value
    el.value = ''
    if (v) start(v, 'enter')
  }

  /* ─────────────── portapapeles ─────────────── */

  const copy = (cut: boolean, e?: ClipboardEvent) => {
    const c = makeClip(sh, result, sel, cut, (v, f) => showCell(v, f, 15))
    setClip(c)
    if (e) {
      e.clipboardData.setData('text/plain', c.tsv)
      e.preventDefault()
    } else navigator.clipboard?.writeText(c.tsv).catch(() => {})
  }
  const doPaste = (values = false, text?: string) => {
    const s = shRef.current
    if (clip && (text === undefined || text === clip.tsv)) {
      const target = sel.r0 === sel.r1 && sel.c0 === sel.c1 ? { r0: sel.r0, c0: sel.c0, r1: sel.r0 + clip.bounds.r1 - clip.bounds.r0, c1: sel.c0 + clip.bounds.c1 - clip.bounds.c0 } : sel
      const out = pasteClip(s, clip, target, values ? { values: result } : {})
      apply(out.sheet)
      select({ r: out.bounds.r0, c: out.bounds.c0 }, { r: out.bounds.r1, c: out.bounds.c1 })
      if (clip.cut) setClip(null)
      return
    }
    if (text === undefined) return
    // texto de fuera: un valor suelto llena toda la selección
    if (!/[\t\n]/.test(text.trim())) {
      const entries: [string, string][] = []
      for (let r = sel.r0; r <= sel.r1; r++) for (let c = sel.c0; c <= sel.c1; c++) entries.push([refOf(c, r), text.trim()])
      apply(setCells(s, entries))
    } else apply(pasteBlock(s, { r: sel.r0, c: sel.c0 }, text))
  }

  /* ─────────────── formatos y comandos ─────────────── */

  const cur: CellFmt = sh.fmt?.[refOf(focus.c, focus.r)] ?? {}
  const patchFmt = (p: Partial<CellFmt> | null) => apply(setFormat(sh, sel, p))
  const toggleFmt = (k: 'b' | 'i') => patchFmt({ [k]: cur[k] ? undefined : true })
  const stepDec = (d: number) => {
    const nf = cur.nf && cur.nf !== 'general' && cur.nf !== 'int' ? cur.nf : 'number'
    patchFmt({ nf, dec: Math.max(0, Math.min(10, (cur.dec ?? 2) + d)) })
  }
  const autoSum = () => {
    if (!result) return
    const b = autoSumRange(result, focus)
    const fn = LANG === 'es' ? 'SUMA' : 'SUM'
    const text = `=${fn}(${b ? boundsText(b) : ''})`
    start(text, 'edit', 'cell', b ? text.length : text.length - 1)
  }
  const lines = (axis: 'row' | 'col', where: 'before' | 'after' | 'delete') => {
    const at = axis === 'row' ? (where === 'after' ? sel.r1 + 1 : sel.r0) : where === 'after' ? sel.c1 + 1 : sel.c0
    const n = axis === 'row' ? sel.r1 - sel.r0 + 1 : sel.c1 - sel.c0 + 1
    apply(insertLines(sh, axis, at, where === 'delete' ? -n : n))
    setMenu(null)
    focusGrid()
  }
  const importCsv = async (file: File) => apply(pasteBlock(sh, { r: sel.r0, c: sel.c0 }, await file.text()))
  const csvRef = useRef<HTMLInputElement>(null)

  const names = useMemo(() => Object.values(sh.names).filter(Boolean), [sh.names])
  const selRes = result?.get(refOf(focus.c, focus.r))
  const editRefs = edit && edit.text.startsWith('=') ? formulaRefs(edit.text, sh.rows) : []
  const mode = edit ? (edit.point || (edit.mode === 'enter' && api.canPoint()) ? L('Apuntar', 'Point') : edit.mode === 'enter' ? L('Introducir', 'Enter') : L('Modificar', 'Edit')) : L('Listo', 'Ready')
  const stats = useMemo(() => {
    if (!result || (sel.r0 === sel.r1 && sel.c0 === sel.c1)) return null
    let n = 0, sum = 0, count = 0, min = Infinity, max = -Infinity
    const R1 = Math.min(sel.r1, sel.r0 + 2000)
    for (let r = sel.r0; r <= R1; r++)
      for (let c = sel.c0; c <= sel.c1; c++) {
        const v = result.get(refOf(c, r)).value
        if (v !== null) count++
        if (typeof v === 'number') ((n += 1), (sum += v), (min = Math.min(min, v)), (max = Math.max(max, v)))
      }
    return { n, sum, count, avg: n ? sum / n : 0, min, max }
  }, [result, sel.r0, sel.r1, sel.c0, sel.c1])

  const [nameBox, setNameBox] = useState<string | null>(null)
  const selText = sel.r0 === sel.r1 && sel.c0 === sel.c1 ? refOf(sel.c0, sel.r0) : boundsText(sel)
  const cols = Array.from({ length: sh.cols }, (_, c) => c)

  const resizeCol = (c: number, e: RMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const x0 = e.clientX, w0 = widthOf(c)
    const move = (ev: MouseEvent) => quiet({ ...shRef.current, colW: { ...(shRef.current.colW ?? {}), [colLetter(c)]: Math.max(40, Math.min(600, w0 + ev.clientX - x0)) } })
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const closeMenu = (fn: () => void) => () => {
    fn()
    setMenu(null)
    focusGrid()
  }

  /* ─────────────── render ─────────────── */

  return (
    <div className="sx" onMouseDown={() => menu && setMenu(null)}>
      <div className="sx-tools">
        <button className="sx-tb" title={L('Deshacer (Ctrl+Z)', 'Undo (Ctrl+Z)')} onClick={undo} disabled={!hist.undo.length}>
          ↶
        </button>
        <button className="sx-tb" title={L('Rehacer (Ctrl+Y)', 'Redo (Ctrl+Y)')} onClick={redo} disabled={!hist.redo.length}>
          ↷
        </button>
        <span className="sx-sep" />
        <button className={'sx-tb' + (cur.b ? ' on' : '')} title={L('Negrita (Ctrl+B)', 'Bold (Ctrl+B)')} onClick={() => toggleFmt('b')}>
          <b>B</b>
        </button>
        <button className={'sx-tb' + (cur.i ? ' on' : '')} title={L('Cursiva (Ctrl+I)', 'Italic (Ctrl+I)')} onClick={() => toggleFmt('i')}>
          <i>I</i>
        </button>
        {(['left', 'center', 'right'] as const).map((a) => (
          <button key={a} className={'sx-tb' + (cur.al === a ? ' on' : '')} title={{ left: L('Alinear a la izquierda', 'Align left'), center: L('Centrar', 'Center'), right: L('Alinear a la derecha', 'Align right') }[a]} onClick={() => patchFmt({ al: cur.al === a ? undefined : a })}>
            {{ left: '⇤', center: '↔', right: '⇥' }[a]}
          </button>
        ))}
        <span className="sx-sep" />
        <select className="sx-sel" value={cur.nf ?? 'general'} onChange={(e) => patchFmt({ nf: e.target.value as CellFmt['nf'] })} title={L('Formato de número', 'Number format')}>
          <option value="general">{L('General', 'General')}</option>
          <option value="number">{L('Número', 'Number')}</option>
          <option value="int">{L('Entero', 'Integer')}</option>
          <option value="percent">{L('Porcentaje', 'Percent')}</option>
          <option value="sci">{L('Científica', 'Scientific')}</option>
          <option value="currency">{L('Moneda', 'Currency')}</option>
        </select>
        <button className="sx-tb" title={L('Menos decimales', 'Fewer decimals')} onClick={() => stepDec(-1)}>
          .0
        </button>
        <button className="sx-tb" title={L('Más decimales', 'More decimals')} onClick={() => stepDec(1)}>
          .00
        </button>
        <label className="sx-tb sx-color" title={L('Color de relleno', 'Fill color')}>
          <span className="sx-swatch" style={{ background: cur.bg ?? 'transparent' }} />
          <input type="color" value={cur.bg ?? '#fde68a'} onChange={(e) => patchFmt({ bg: e.target.value })} />
        </label>
        <label className="sx-tb sx-color" title={L('Color del texto', 'Text color')}>
          <span style={{ color: cur.color, fontWeight: 700 }}>A</span>
          <input type="color" value={cur.color ?? '#2563eb'} onChange={(e) => patchFmt({ color: e.target.value })} />
        </label>
        <button className="sx-tb" title={L('Quitar formato', 'Clear formatting')} onClick={() => patchFmt(null)}>
          ⌫
        </button>
        <span className="sx-sep" />
        <button className="sx-tb" title={L('Autosuma (Alt+=)', 'AutoSum (Alt+=)')} onClick={autoSum}>
          Σ
        </button>
        <button className={'sx-tb' + (showFormulas ? ' on' : '')} title={L('Mostrar fórmulas (Ctrl+`)', 'Show formulas (Ctrl+`)')} onClick={() => setShowFormulas((v) => !v)}>
          ƒx
        </button>
        <span className="sx-sep" />
        <button className="sx-tb wide" title={L('Importar CSV en la celda activa', 'Import CSV at the active cell')} onClick={() => csvRef.current?.click()}>
          ⬆ CSV
        </button>
        <input ref={csvRef} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
        <button className="sx-tb wide" title={L('Exportar los valores como CSV', 'Export the values as CSV')} onClick={() => result && download('hoja.csv', toCsv(sh, result), 'text/csv')}>
          ⬇ CSV
        </button>
      </div>

      <div className="sx-bar">
        <input
          className="sx-ref mono"
          value={nameBox ?? selText}
          aria-label={L('Cuadro de nombres', 'Name box')}
          onFocus={(e) => {
            setNameBox(selText)
            const el = e.target
            requestAnimationFrame(() => el.select())
          }}
          onChange={(e) => setNameBox(e.target.value)}
          onBlur={() => setNameBox(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const b = parseBounds(nameBox ?? '')
              if (b) select({ r: b.r0, c: b.c0 }, { r: b.r1, c: b.c1 })
              setNameBox(null)
              focusGrid()
            } else if (e.key === 'Escape') (setNameBox(null), focusGrid())
          }}
        />
        <span className="sx-fx">ƒx</span>
        <FormulaEditor variant="bar" edit={edit} idleText={raw(focus)} api={api} names={names} dark={dark} className="sx-formula" ariaLabel={L('Barra de fórmulas', 'Formula bar')} />
      </div>
      {!edit && selRes?.error && (
        <div className="sx-errline">
          <b>{selRes.error}</b> {errorHelp(selRes.error, LANG === 'es')} {selRes.detail && selRes.detail !== selRes.error ? <span className="muted mono">({selRes.detail})</span> : null}
        </div>
      )}

      <div className="sx-scroll" ref={scrollRef}>
        <input
          ref={sinkRef}
          className="sx-sink"
          aria-label={L(`Celda ${refOf(focus.c, focus.r)}`, `Cell ${refOf(focus.c, focus.r)}`)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onKeyDown={onGridKey}
          onCopy={(e) => copy(false, e)}
          onCut={(e) => copy(true, e)}
          onPaste={(e) => {
            e.preventDefault()
            doPaste(false, e.clipboardData.getData('text/plain'))
          }}
          onChange={(e) => startTyping(e.target)}
          onCompositionStart={() => (composing.current = true)}
          onCompositionEnd={(e) => {
            composing.current = false
            startTyping(e.currentTarget)
          }}
        />
        <div className="sx-sheet" style={{ width: ROWHEAD_W + totalW }}>
          <div className="sx-heads">
            <div className="sx-hrow">
              <div className="sx-corner" title={L('Seleccionar todo', 'Select all')} onMouseDown={() => (select({ r: 0, c: 0 }, { r: sh.rows - 1, c: sh.cols - 1 }), focusGrid())} />
              {cols.map((c) => (
                <div
                  key={c}
                  className={'sx-head' + (c >= sel.c0 && c <= sel.c1 ? ' on' : '')}
                  style={{ width: widthOf(c) }}
                  onMouseDown={(e) => {
                    if (editRef.current) return
                    if (e.shiftKey) select({ r: 0, c: anchor.c }, { r: sh.rows - 1, c })
                    else select({ r: 0, c }, { r: sh.rows - 1, c })
                    focusGrid()
                  }}
                >
                  {colLetter(c)}
                  <span className="sx-resize" onMouseDown={(e) => resizeCol(c, e)} onDoubleClick={() => quiet({ ...sh, colW: { ...(sh.colW ?? {}), [colLetter(c)]: DEF_W } })} />
                </div>
              ))}
            </div>
            <div className="sx-hrow">
              <div className="sx-side sx-tag" title={L('Nombre de la columna: se comparte como lista con el documento', 'Column name: shared as a list with the document')}>
                {L('nombre', 'name')}
              </div>
              {cols.map((c) => (
                <ColName key={c} width={widthOf(c)} value={sh.names[colLetter(c)] ?? ''} onCommit={(v) => apply(setName(shRef.current, c, v))} />
              ))}
            </div>
            <div className="sx-hrow">
              <div className="sx-side sx-tag" title={L('Fórmula de columna: llena toda la columna', 'Column formula: fills the whole column')}>
                =
              </div>
              {cols.map((c) => (
                <ColFormula key={c} width={widthOf(c)} value={sh.colFormulas[colLetter(c)] ?? ''} error={result?.colErrors[colLetter(c)]} onCommit={(v) => apply(setColFormula(shRef.current, c, v))} />
              ))}
            </div>
          </div>

          <div
            ref={bodyRef}
            className="sx-body"
            style={{ height: sh.rows * ROW_H }}
            onMouseDown={onBodyDown}
            onDoubleClick={(e) => {
              if ((e.target as HTMLElement).closest('.fx, .sx-handle')) return
              const p = cellAt(e.clientX, e.clientY)
              if (!editRef.current) {
                select(p)
                const t = raw(p)
                setEdit({ pos: p, text: t, mode: 'edit', source: 'cell', caret: t.length, caretEnd: t.length, nonce: ++nonce.current, point: null, error: null })
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              const p = cellAt(e.clientX, e.clientY)
              if (!inBounds(sel, p.r, p.c)) select(p)
              const box = (e.currentTarget.closest('.sx') as HTMLElement).getBoundingClientRect()
              setMenu({ x: Math.min(e.clientX - box.left, box.width - 240), y: Math.min(e.clientY - box.top, box.height - 380) })
            }}
          >
            {Array.from({ length: Math.max(0, lastRow - firstRow + 1) }, (_, k) => {
              const r = firstRow + k
              return (
                <div key={r} className="sx-row" style={{ top: r * ROW_H }}>
                  <div
                    className={'sx-side' + (r >= sel.r0 && r <= sel.r1 ? ' on' : '')}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      if (editRef.current) return
                      if (e.shiftKey) select({ r: anchor.r, c: 0 }, { r, c: sh.cols - 1 })
                      else select({ r, c: 0 }, { r, c: sh.cols - 1 })
                      focusGrid()
                    }}
                  >
                    {r + 1}
                  </div>
                  {cols.map((c) => {
                    const ref = refOf(c, r)
                    const res = result?.get(ref)
                    const f = sh.fmt?.[ref]
                    const v = res?.value ?? null
                    const rawText = sh.cells[ref]
                    const formula = showFormulas && rawText?.startsWith('=')
                    const text = formula ? rawText : (res?.error ?? showCell(v, f))
                    const al = f?.al ?? (formula ? 'left' : typeof v === 'number' ? 'right' : typeof v === 'boolean' || res?.error ? 'center' : 'left')
                    return (
                      <div
                        key={c}
                        className={'sx-cell' + (res?.error ? ' err' : '') + (sh.colFormulas[colLetter(c)] ? ' fill' : '')}
                        style={{ width: widthOf(c), justifyContent: al === 'right' ? 'flex-end' : al === 'center' ? 'center' : 'flex-start', fontWeight: f?.b ? 700 : undefined, fontStyle: f?.i ? 'italic' : undefined, color: f?.color, background: f?.bg }}
                        title={res?.error ? `${res.error} · ${errorHelp(res.error, LANG === 'es')}` : rawText?.startsWith('=') ? rawText : undefined}
                      >
                        {text}
                        {res?.error && <span className="sx-errmark" />}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {(() => {
              const R = rect(sel)
              const A = rect({ r0: focus.r, r1: focus.r, c0: focus.c, c1: focus.c })
              const multi = sel.r0 !== sel.r1 || sel.c0 !== sel.c1
              return (
                <>
                  {multi && <div className="sx-selbox" style={R} />}
                  <div className="sx-active" style={edit ? rect({ r0: edit.pos.r, r1: edit.pos.r, c0: edit.pos.c, c1: edit.pos.c }) : A} />
                  {!edit && (
                    <div
                      className="sx-handle"
                      style={{ left: R.left + R.width - 4, top: R.top + R.height - 4 }}
                      title={L('Arrastra para rellenar · doble clic: hasta el final de los datos', 'Drag to fill · double-click: to the end of the data')}
                      onMouseDown={onFillDown}
                      onDoubleClick={(e) => (e.stopPropagation(), fillToData())}
                    />
                  )}
                </>
              )
            })()}
            {fillPreview && <div className="sx-fillprev" style={rect(fillPreview)} />}
            {clip && <div className={'sx-ants' + (clip.cut ? ' cut' : '')} style={rect(clip.bounds)} />}
            {editRefs.map((r, i) => {
              const b = { ...r.bounds, r1: Math.min(r.bounds.r1, sh.rows - 1), c1: Math.min(r.bounds.c1, sh.cols - 1) }
              if (b.c0 >= sh.cols) return null
              const col = refColor(r.color, dark)
              const pointed = edit?.point && r.start === edit.point.start
              return <div key={i} className={'sx-refbox' + (pointed ? ' pointed' : '')} style={{ ...rect(b), borderColor: col, background: col + '18' }} />
            })}

            {edit && edit.source === 'cell' && (
              <FormulaEditor
                variant="cell"
                edit={edit}
                idleText=""
                api={api}
                names={names}
                dark={dark}
                className="sx-celledit"
                style={{ left: ROWHEAD_W + colX[edit.pos.c], top: edit.pos.r * ROW_H, minWidth: widthOf(edit.pos.c) }}
                ariaLabel={L(`Editar ${refOf(edit.pos.c, edit.pos.r)}`, `Edit ${refOf(edit.pos.c, edit.pos.r)}`)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="sx-status">
        <span className="sx-mode">{mode}</span>
        {stats && (
          <span className="sx-stats mono">
            {stats.n > 0 && `${L('Suma', 'Sum')}: ${showCell(stats.sum)} · ${L('Promedio', 'Average')}: ${showCell(stats.avg)} · ${L('Mín', 'Min')}: ${showCell(stats.min)} · ${L('Máx', 'Max')}: ${showCell(stats.max)} · `}
            {L('Recuento', 'Count')}: {stats.count}
          </span>
        )}
        <span className="sx-spacer" />
        <span className="muted sx-hint">{L('= para fórmulas · clic en celdas para referenciarlas · F4 fija $ · arrastra la esquina para rellenar · clic derecho: más opciones', '= for formulas · click cells to reference them · F4 toggles $ · drag the corner to fill · right-click: more options')}</span>
      </div>

      {menu && (
        <div className="sx-menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={closeMenu(() => copy(true))}>
            {L('Cortar', 'Cut')} <kbd>⌘X</kbd>
          </button>
          <button onClick={closeMenu(() => copy(false))}>
            {L('Copiar', 'Copy')} <kbd>⌘C</kbd>
          </button>
          <button
            onClick={async () => {
              setMenu(null)
              let text: string | undefined
              try {
                text = await navigator.clipboard.readText()
              } catch {
                text = clip?.tsv
              }
              doPaste(false, text)
              focusGrid()
            }}
          >
            {L('Pegar', 'Paste')} <kbd>⌘V</kbd>
          </button>
          <button disabled={!clip} onClick={closeMenu(() => doPaste(true))}>
            {L('Pegar valores', 'Paste values')} <kbd>⌘⇧V</kbd>
          </button>
          <hr />
          <button onClick={() => lines('row', 'before')}>{L('Insertar filas arriba', 'Insert rows above')}</button>
          <button onClick={() => lines('row', 'after')}>{L('Insertar filas debajo', 'Insert rows below')}</button>
          <button onClick={() => lines('row', 'delete')}>{L('Eliminar filas', 'Delete rows')}</button>
          <hr />
          <button onClick={() => lines('col', 'before')}>{L('Insertar columnas a la izquierda', 'Insert columns left')}</button>
          <button onClick={() => lines('col', 'after')}>{L('Insertar columnas a la derecha', 'Insert columns right')}</button>
          <button onClick={() => lines('col', 'delete')}>{L('Eliminar columnas', 'Delete columns')}</button>
          <hr />
          <button onClick={closeMenu(() => apply(clearRange(sh, sel)))}>
            {L('Borrar contenido', 'Clear contents')} <kbd>Supr</kbd>
          </button>
          <button onClick={closeMenu(() => apply(clearRange(sh, sel, true)))}>{L('Borrar todo (con formato)', 'Clear all (with formatting)')}</button>
        </div>
      )}
    </div>
  )
}

function setName(sh: SheetData, c: number, name: string): SheetData {
  const names = { ...sh.names }
  const clean = name.replace(/[^\p{L}\w]/gu, '')
  if (clean) names[colLetter(c)] = clean
  else delete names[colLetter(c)]
  return { ...sh, names }
}
function setColFormula(sh: SheetData, c: number, f: string): SheetData {
  const colFormulas = { ...sh.colFormulas }
  if (f.trim()) colFormulas[colLetter(c)] = f.trim().startsWith('=') ? f.trim() : '=' + f.trim()
  else delete colFormulas[colLetter(c)]
  return { ...sh, colFormulas }
}

/** Nombre de columna: se confirma con Enter o al salir. */
function ColName({ value, width, onCommit }: { value: string; width: number; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <input
      className="sx-name mono"
      style={{ width }}
      value={draft}
      placeholder="—"
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') setDraft(value)
      }}
    />
  )
}

/** Fórmula de columna: se edita libremente y se confirma con Enter o al salir. */
function ColFormula({ value, error, width, onCommit }: { value: string; error?: string; width: number; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <input
      className={'sx-colf mono' + (error ? ' err' : '')}
      style={{ width }}
      value={draft}
      title={error}
      placeholder="="
      spellCheck={false}
      data-palette="expr"
      data-paste="cas"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') setDraft(value)
      }}
    />
  )
}
