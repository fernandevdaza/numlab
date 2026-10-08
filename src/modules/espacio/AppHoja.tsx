// App de hoja de cálculo: celdas con fórmulas, columnas con nombre (listas compartidas) y fórmulas
// de columna, como «Listas y hoja de cálculo» de TI-Nspire.
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { L } from '../../i18n'
import { colLetter, pasteBlock, refOf, showCell, type SheetData, type SheetResult } from './hoja'
import type { Pane } from './doc'

type SheetPane = Extract<Pane, { kind: 'sheet' }>
interface Pos {
  c: number
  r: number
}

export function AppHoja({ pane, result, onChange }: { pane: SheetPane; result: SheetResult | undefined; onChange: (p: SheetPane) => void }) {
  const sh = pane.sheet
  const setSheet = (s: SheetData) => onChange({ ...pane, sheet: s })
  const [sel, setSel] = useState<Pos>({ c: 0, r: 0 })
  const [anchor, setAnchor] = useState<Pos | null>(null)
  const [edit, setEdit] = useState<{ pos: Pos; text: string } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLInputElement>(null)
  // campo oculto que recibe el teclado de la cuadrícula: funciona con acentos (teclas muertas),
  // métodos de entrada y teclados de celular, que no generan keydown con el carácter
  const sinkRef = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  const focusGrid = () => requestAnimationFrame(() => sinkRef.current?.focus({ preventScroll: true }))
  const barRef = useRef<HTMLInputElement>(null)

  const raw = (p: Pos) => sh.cells[refOf(p.c, p.r)] ?? ''
  const range = (() => {
    const a = anchor ?? sel
    return { c0: Math.min(a.c, sel.c), c1: Math.max(a.c, sel.c), r0: Math.min(a.r, sel.r), r1: Math.max(a.r, sel.r) }
  })()
  const inRange = (c: number, r: number) => c >= range.c0 && c <= range.c1 && r >= range.r0 && r <= range.r1

  const writeCell = (p: Pos, text: string) => {
    const key = refOf(p.c, p.r)
    const cells = { ...sh.cells }
    if (text.trim()) cells[key] = text
    else delete cells[key]
    setSheet({ ...sh, cells, rows: Math.max(sh.rows, p.r + 2) })
  }
  const move = (dc: number, dr: number, extend = false) => {
    const n = { c: Math.max(0, Math.min(sh.cols - 1, sel.c + dc)), r: Math.max(0, sel.r + dr) }
    if (n.r >= sh.rows) setSheet({ ...sh, rows: n.r + 1 })
    if (extend) setAnchor((a) => a ?? sel)
    else setAnchor(null)
    setSel(n)
  }
  const commit = (dc = 0, dr = 1) => {
    if (!edit) return
    writeCell(edit.pos, edit.text)
    setEdit(null)
    move(dc, dr)
    focusGrid()
  }

  useEffect(() => {
    if (edit) editRef.current?.focus()
  }, [edit?.pos.c, edit?.pos.r]) // eslint-disable-line react-hooks/exhaustive-deps

  // mantener visible la celda activa
  useEffect(() => {
    gridRef.current?.querySelector<HTMLElement>(`[data-ref="${refOf(sel.c, sel.r)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [sel])

  const onGridKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (edit) return
    const k = e.key
    if (k === 'ArrowDown') (e.preventDefault(), move(0, 1, e.shiftKey))
    else if (k === 'ArrowUp') (e.preventDefault(), move(0, -1, e.shiftKey))
    else if (k === 'ArrowRight') (e.preventDefault(), move(1, 0, e.shiftKey))
    else if (k === 'ArrowLeft') (e.preventDefault(), move(-1, 0, e.shiftKey))
    else if (k === 'Tab') (e.preventDefault(), move(e.shiftKey ? -1 : 1, 0))
    else if (k === 'Enter' || k === 'F2') (e.preventDefault(), setEdit({ pos: sel, text: raw(sel) }))
    else if (k === 'Delete' || k === 'Backspace') {
      e.preventDefault()
      const cells = { ...sh.cells }
      for (let c = range.c0; c <= range.c1; c++) for (let r = range.r0; r <= range.r1; r++) delete cells[refOf(c, r)]
      setSheet({ ...sh, cells })
    } else if (k === 'Escape') setAnchor(null)
    // los caracteres llegan por el evento input del campo oculto (startTyping)
  }
  const startTyping = (el: HTMLInputElement) => {
    if (composing.current) return
    const v = el.value
    el.value = ''
    if (v) setEdit({ pos: sel, text: v })
  }

  const onCopy = (e: ClipboardEvent) => {
    if (edit) return
    const lines: string[] = []
    for (let r = range.r0; r <= range.r1; r++) {
      const row: string[] = []
      for (let c = range.c0; c <= range.c1; c++) row.push(showCell(result?.get(refOf(c, r)).value ?? null, 15))
      lines.push(row.join('\t'))
    }
    e.clipboardData.setData('text/plain', lines.join('\n'))
    e.preventDefault()
  }
  const onPaste = (e: ClipboardEvent) => {
    if (edit) return
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()
    // una sola celda: se escribe tal cual (puede ser una fórmula)
    if (!/[\t\n]/.test(text.trim())) writeCell(sel, text.trim())
    else setSheet(pasteBlock(sh, sel, text))
  }

  const setName = (c: number, name: string) => {
    const names = { ...sh.names }
    const clean = name.replace(/[^\p{L}\w]/gu, '')
    if (clean) names[colLetter(c)] = clean
    else delete names[colLetter(c)]
    setSheet({ ...sh, names })
  }
  const setColFormula = (c: number, f: string) => {
    const colFormulas = { ...sh.colFormulas }
    if (f.trim()) colFormulas[colLetter(c)] = f.trim().startsWith('=') ? f.trim() : '=' + f.trim()
    else delete colFormulas[colLetter(c)]
    setSheet({ ...sh, colFormulas })
  }

  const selRes = result?.get(refOf(sel.c, sel.r))
  const cols = Array.from({ length: sh.cols }, (_, c) => c)
  const rows = Array.from({ length: sh.rows }, (_, r) => r)

  return (
    <div className="sx">
      <div className="sx-bar">
        <span className="sx-ref mono">{range.c0 !== range.c1 || range.r0 !== range.r1 ? `${refOf(range.c0, range.r0)}:${refOf(range.c1, range.r1)}` : refOf(sel.c, sel.r)}</span>
        <input
          ref={barRef}
          className="input mono sx-formula"
          data-palette="expr"
          data-paste="cas"
          placeholder={L('Número, texto o fórmula: =A1*2, =SUMA(A1:A10), =linreg(t, v)', 'Number, text or formula: =A1*2, =SUM(A1:A10), =linreg(t, v)')}
          value={edit && edit.pos.c === sel.c && edit.pos.r === sel.r ? edit.text : raw(sel)}
          onFocus={() => !edit && setEdit({ pos: sel, text: raw(sel) })}
          onChange={(e) => setEdit({ pos: sel, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.preventDefault(), commit())
            else if (e.key === 'Escape') (setEdit(null), focusGrid())
          }}
          onBlur={() => edit && (writeCell(edit.pos, edit.text), setEdit(null))}
        />
        {selRes?.error && <span className="sx-errmsg" title={selRes.error}>{selRes.error}</span>}
      </div>
      <div className="sx-scroll">
        <input
          ref={sinkRef}
          className="sx-sink"
          aria-label={L(`Celda ${refOf(sel.c, sel.r)}`, `Cell ${refOf(sel.c, sel.r)}`)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onKeyDown={onGridKey}
          onCopy={onCopy}
          onPaste={onPaste}
          onChange={(e) => startTyping(e.target)}
          onCompositionStart={() => (composing.current = true)}
          onCompositionEnd={(e) => {
            composing.current = false
            startTyping(e.currentTarget)
          }}
        />
        <div ref={gridRef} className="sx-grid" style={{ gridTemplateColumns: `44px repeat(${sh.cols}, minmax(92px, 1fr))` }}>
          {/* letras */}
          <div className="sx-corner" />
          {cols.map((c) => (
            <div key={'h' + c} className={'sx-head' + (c === sel.c ? ' on' : '')}>
              {colLetter(c)}
            </div>
          ))}
          {/* nombres de columna */}
          <div className="sx-side sx-tag" title={L('Nombre de la columna: se comparte como lista', 'Column name: shared as a list')}>
            {L('nombre', 'name')}
          </div>
          {cols.map((c) => (
            <input key={'n' + c} className="sx-name mono" value={sh.names[colLetter(c)] ?? ''} placeholder="—" spellCheck={false} onChange={(e) => setName(c, e.target.value)} />
          ))}
          {/* fórmulas de columna */}
          <div className="sx-side sx-tag" title={L('Fórmula de columna: llena toda la columna', 'Column formula: fills the whole column')}>
            =
          </div>
          {cols.map((c) => {
            const L_ = colLetter(c)
            const err = result?.colErrors[L_]
            return <ColFormula key={'f' + c} value={sh.colFormulas[L_] ?? ''} error={err} onCommit={(v) => setColFormula(c, v)} />
          })}
          {rows.map((r) => [
            <div key={'r' + r} className={'sx-side' + (r === sel.r ? ' on' : '')}>
              {r + 1}
            </div>,
            ...cols.map((c) => {
              const ref = refOf(c, r)
              const isSel = c === sel.c && r === sel.r
              const editing = edit && edit.pos.c === c && edit.pos.r === r && document.activeElement !== barRef.current
              const res = result?.get(ref)
              const v = res?.value ?? null
              const filled = !!sh.colFormulas[colLetter(c)]
              return (
                <div
                  key={ref}
                  data-ref={ref}
                  className={'sx-cell' + (isSel ? ' sel' : inRange(c, r) ? ' in' : '') + (typeof v === 'number' ? ' num' : '') + (res?.error ? ' err' : '') + (filled ? ' fill' : '')}
                  title={res?.error ?? (sh.cells[ref]?.startsWith('=') ? sh.cells[ref] : undefined)}
                  onMouseDown={(e) => {
                    if (edit) commit(0, 0)
                    if (e.shiftKey) setAnchor((a) => a ?? sel)
                    else setAnchor(null)
                    setSel({ c, r })
                    focusGrid()
                  }}
                  onDoubleClick={() => setEdit({ pos: { c, r }, text: raw({ c, r }) })}
                >
                  {editing ? (
                    <input
                      ref={editRef}
                      className="sx-edit mono"
                      value={edit!.text}
                      data-palette="expr"
                      data-paste="cas"
                      spellCheck={false}
                      onChange={(e) => setEdit({ pos: { c, r }, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.preventDefault(), commit(0, e.shiftKey ? -1 : 1))
                        else if (e.key === 'Tab') (e.preventDefault(), commit(e.shiftKey ? -1 : 1, 0))
                        else if (e.key === 'Escape') (e.preventDefault(), setEdit(null), focusGrid())
                      }}
                      onBlur={() => edit && (writeCell(edit.pos, edit.text), setEdit(null))}
                    />
                  ) : res?.error ? (
                    '#ERR'
                  ) : (
                    showCell(v)
                  )}
                </div>
              )
            }),
          ])}
        </div>
      </div>
      <div className="sx-foot">
        <button className="btn ghost sm" onClick={() => setSheet({ ...sh, rows: sh.rows + 10 })}>
          + 10 {L('filas', 'rows')}
        </button>
        <button className="btn ghost sm" onClick={() => sh.cols < 26 && setSheet({ ...sh, cols: sh.cols + 1 })}>
          + {L('columna', 'column')}
        </button>
        <span className="muted">{L('Pega datos de Excel o Sheets con ⌘/Ctrl+V. Las columnas con nombre se usan como listas en la calculadora y las gráficas.', 'Paste data from Excel or Sheets with ⌘/Ctrl+V. Named columns are lists in the calculator and the graphs.')}</span>
      </div>
    </div>
  )
}

/** Fórmula de columna: se edita libremente y se confirma con Enter o al salir. */
function ColFormula({ value, error, onCommit }: { value: string; error?: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <input
      className={'sx-colf mono' + (error ? ' err' : '')}
      value={draft}
      title={error}
      placeholder="="
      spellCheck={false}
      data-palette="expr"
      data-paste="cas"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onCommit(draft)
        } else if (e.key === 'Escape') setDraft(value)
      }}
    />
  )
}
