// Documento del espacio de trabajo: páginas con apps (calculadora, gráficas, hoja, notas) que
// comparten variables, como un «problema» de TI-Nspire o una construcción de GeoGebra.
import { L } from '../../i18n'
import { Session, type Out } from '../cas/engine'
import { emptySheet, evaluateSheet, type SheetData, type SheetResult } from './hoja'

export type AppKind = 'calc' | 'graph' | 'sheet' | 'notes'

export interface GraphEntry {
  id: string
  src: string
  on: boolean
  color: number
  /** deslizador: rango y paso */
  slider?: { min: number; max: number; step: number }
}

export interface GraphView {
  x: [number, number]
  y: [number, number]
}

export type Pane =
  | { id: string; kind: 'calc'; lines: string[] }
  | { id: string; kind: 'graph'; entries: GraphEntry[]; view: GraphView; equal: boolean; special: boolean; grid: boolean }
  | { id: string; kind: 'sheet'; sheet: SheetData }
  | { id: string; kind: 'notes'; text: string }

export interface Page {
  id: string
  title: string
  panes: Pane[]
  /** dos apps lado a lado: proporción del primer panel (0.3–0.7) */
  split: number
  /** disposición con varias apps (hasta 4): columnas, filas o cuadrícula 2×2 */
  layout?: Layout
  /** proporciones de cada app en columnas o filas (suman 1) */
  sizes?: number[]
  /** cuadrícula: proporción de la primera fila */
  splitY?: number
}

export type Layout = 'cols' | 'rows' | 'grid'
export const MAX_PANES = 4

export interface Doc {
  version: 1
  name: string
  pages: Page[]
  active: number
}

export const uid = () => Math.random().toString(36).slice(2, 9)

export const APP_LABEL: Record<AppKind, string> = {
  calc: L('Calculadora', 'Calculator'),
  graph: L('Gráficas', 'Graphs'),
  sheet: L('Hoja de cálculo', 'Spreadsheet'),
  notes: L('Notas', 'Notes'),
}
export const APP_ICON: Record<AppKind, string> = { calc: '∑', graph: '📈', sheet: '▦', notes: '✎' }

export function newPane(kind: AppKind): Pane {
  const id = uid()
  switch (kind) {
    case 'calc':
      return { id, kind, lines: [''] }
    case 'graph':
      return { id, kind, entries: [{ id: uid(), src: '', on: true, color: 0 }], view: { x: [-10, 10], y: [-7, 7] }, equal: true, special: true, grid: true }
    case 'sheet':
      return { id, kind, sheet: emptySheet() }
    case 'notes':
      return { id, kind, text: '' }
  }
}

export const newPage = (kind: AppKind, title?: string): Page => ({ id: uid(), title: title ?? APP_LABEL[kind], panes: [newPane(kind)], split: 0.5 })

/* ─────────────── ejemplos ─────────────── */

const g = (src: string, color: number, extra: Partial<GraphEntry> = {}): GraphEntry => ({ id: uid(), src, on: true, color, ...extra })

/** Documento de bienvenida: una calculadora y una gráfica que comparten f, y datos con regresión. */
export function exampleDoc(): Doc {
  const sheet = emptySheet(5, 30)
  sheet.names = { A: 't', B: 'v' }
  const ts = [0, 1, 2, 3, 4, 5, 6, 7]
  const vs = [1.1, 2.9, 5.2, 6.8, 9.1, 11.2, 12.8, 15.1]
  ts.forEach((t, i) => {
    sheet.cells['A' + (i + 1)] = String(t)
    sheet.cells['B' + (i + 1)] = String(vs[i])
  })
  sheet.cells.D1 = L('pendiente', 'slope')
  sheet.cells.E1 = '=linreg(t, v)[1]'
  sheet.cells.D2 = L('ordenada', 'intercept')
  sheet.cells.E2 = '=linreg(t, v)[2]'
  sheet.cells.D3 = 'r²'
  sheet.cells.E3 = '=linreg(t, v)[3]'
  return {
    version: 1,
    name: L('Mi documento', 'My document'),
    active: 0,
    pages: [
      {
        id: uid(),
        title: L('Función', 'Function'),
        split: 0.42,
        panes: [
          { id: uid(), kind: 'calc', lines: ['f(x) = x^3 - 3x^2 + 1', L('derivada(f(x), x)', 'diff(f(x), x)'), L('raices(f(x), -2, 4)', 'roots(f(x), -2, 4)'), 'f(a)', ''] },
          {
            id: uid(),
            kind: 'graph',
            entries: [g('f(x)', 0), g('y = a*sin(x)', 1), g('a = 1.5', 2, { slider: { min: -3, max: 3, step: 0.1 } }), g('P = (a, f(a))', 3), g('x^2 + y^2 = 4', 4)],
            view: { x: [-4, 5], y: [-4, 4] },
            equal: true,
            special: true,
            grid: true,
          },
        ],
      },
      {
        id: uid(),
        title: L('Datos', 'Data'),
        split: 0.55,
        panes: [
          { id: uid(), kind: 'sheet', sheet },
          { id: uid(), kind: 'graph', entries: [g('(t, v)', 0), g('r = linreg(t, v)', 1), g('y = r[1]*x + r[2]', 1)], view: { x: [-1, 8], y: [-1, 17] }, equal: false, special: false, grid: true },
        ],
      },
      {
        id: uid(),
        title: L('Notas', 'Notes'),
        split: 0.5,
        panes: [
          {
            id: uid(),
            kind: 'notes',
            text: L(
              '# Espacio de trabajo\n\nLas apps de un documento **comparten variables**: `f` está definida en la calculadora de la página 1 y se dibuja en la gráfica; el deslizador `a` mueve el punto $P = (a, f(a))$.\n\nEn la página 2, las columnas con nombre (`t`, `v`) son listas: la hoja calcula la regresión con `linreg(t, v)` y la gráfica dibuja los puntos y la recta.\n\n$$f\'(x) = 3x^2 - 6x$$',
              '# Workspace\n\nThe apps in a document **share variables**: `f` is defined in the calculator on page 1 and drawn in the graph; the slider `a` moves the point $P = (a, f(a))$.\n\nOn page 2, the named columns (`t`, `v`) are lists: the sheet computes the regression with `linreg(t, v)` and the graph draws the points and the line.\n\n$$f\'(x) = 3x^2 - 6x$$',
            ),
          },
        ],
      },
    ],
  }
}

/* ─────────────── reparación de documentos ─────────────── */

const KINDS: AppKind[] = ['calc', 'graph', 'sheet', 'notes']
const num = (v: unknown, def: number, lo = -Infinity, hi = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def)

/** Panel con todos sus campos (completa lo que falte en documentos viejos o dañados). */
function repairPane(q: any): Pane | null {
  if (!q || typeof q !== 'object' || !KINDS.includes(q.kind)) return null
  const base = newPane(q.kind)
  const id = typeof q.id === 'string' && q.id ? q.id : base.id
  switch (q.kind as AppKind) {
    case 'calc':
      return { id, kind: 'calc', lines: Array.isArray(q.lines) && q.lines.length ? q.lines.map((l: unknown) => String(l ?? '')) : [''] }
    case 'notes':
      return { id, kind: 'notes', text: typeof q.text === 'string' ? q.text : '' }
    case 'graph': {
      const b = base as Extract<Pane, { kind: 'graph' }>
      const entries = (Array.isArray(q.entries) ? q.entries : [])
        .filter((e: any) => e && typeof e === 'object')
        .map((e: any) => ({ id: typeof e.id === 'string' ? e.id : uid(), src: String(e.src ?? ''), on: e.on !== false, color: num(e.color, 0, 0, 7), ...(e.slider && typeof e.slider === 'object' ? { slider: { min: num(e.slider.min, -5), max: num(e.slider.max, 5), step: num(e.slider.step, 0.1, 1e-9) } } : {}) }))
      const pair = (v: any, d: [number, number]): [number, number] => (Array.isArray(v) && v.length === 2 && v.every((x) => Number.isFinite(x)) && v[0] < v[1] ? [v[0], v[1]] : d)
      return { id, kind: 'graph', entries: entries.length ? entries : b.entries, view: { x: pair(q.view?.x, b.view.x), y: pair(q.view?.y, b.view.y) }, equal: q.equal !== false, special: q.special !== false, grid: q.grid !== false }
    }
    case 'sheet': {
      const sh = q.sheet && typeof q.sheet === 'object' ? q.sheet : {}
      const obj = (o: any) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {})
      return { id, kind: 'sheet', sheet: { cells: obj(sh.cells), names: obj(sh.names), colFormulas: obj(sh.colFormulas), fmt: obj(sh.fmt), colW: obj(sh.colW), cols: num(sh.cols, 6, 1, 52), rows: num(sh.rows, 40, 5, 5000) } }
    }
  }
}

/** Comprobación rápida: ¿el documento ya tiene la forma correcta? (así no se copia en cada cambio) */
export function isSoundDoc(d: any): d is Doc {
  if (!d || d.version !== 1 || !Array.isArray(d.pages) || !d.pages.length) return false
  if (!Number.isInteger(d.active) || d.active < 0 || d.active >= d.pages.length) return false
  return d.pages.every(
    (p: any) =>
      p &&
      typeof p.id === 'string' &&
      Number.isFinite(p.split) &&
      Array.isArray(p.panes) &&
      p.panes.length >= 1 &&
      p.panes.length <= MAX_PANES &&
      (p.sizes === undefined || (Array.isArray(p.sizes) && p.sizes.length === p.panes.length && p.sizes.every((x: unknown) => typeof x === 'number' && x > 0))) &&
      p.panes.every(
        (q: any) =>
          q &&
          typeof q.id === 'string' &&
          ((q.kind === 'calc' && Array.isArray(q.lines) && q.lines.length > 0) ||
            (q.kind === 'notes' && typeof q.text === 'string') ||
            (q.kind === 'graph' && Array.isArray(q.entries) && q.view && Array.isArray(q.view.x) && Array.isArray(q.view.y)) ||
            (q.kind === 'sheet' && q.sheet && q.sheet.cells && q.sheet.names && q.sheet.colFormulas && Number.isFinite(q.sheet.rows) && Number.isFinite(q.sheet.cols))),
      ),
  )
}

/**
 * Documento válido a partir de lo guardado (localStorage o un archivo): descarta lo dañado y completa
 * lo que falte, para que un estado raro no deje el espacio de trabajo roto. null si no se puede usar.
 */
export function repairDoc(d: any): Doc | null {
  if (!d || typeof d !== 'object' || !Array.isArray(d.pages)) return null
  const pages: Page[] = []
  for (const p of d.pages) {
    if (!p || typeof p !== 'object') continue
    const panes = (Array.isArray(p.panes) ? p.panes : []).map(repairPane).filter(Boolean).slice(0, MAX_PANES) as Pane[]
    if (!panes.length) continue
    const sizes = Array.isArray(p.sizes) && p.sizes.length === panes.length && p.sizes.every((x: unknown) => typeof x === 'number' && x > 0) ? p.sizes : undefined
    pages.push({
      id: typeof p.id === 'string' && p.id ? p.id : uid(),
      title: typeof p.title === 'string' && p.title.trim() ? p.title : APP_LABEL[panes[0].kind],
      panes,
      split: num(p.split, 0.5, 0.2, 0.8),
      ...(['cols', 'rows', 'grid'].includes(p.layout) ? { layout: p.layout as Layout } : {}),
      ...(sizes ? { sizes } : {}),
      ...(p.splitY !== undefined ? { splitY: num(p.splitY, 0.5, 0.2, 0.8) } : {}),
    })
  }
  if (!pages.length) return null
  return { version: 1, name: typeof d.name === 'string' ? d.name : '', pages, active: Math.round(num(d.active, 0, 0, pages.length - 1)) }
}

export function blankDoc(): Doc {
  return { version: 1, name: L('Documento nuevo', 'New document'), active: 0, pages: [newPage('calc')] }
}

/* ─────────────── evaluación compartida ─────────────── */

/** ¿La entrada de la gráfica es una definición que debe ver el resto del documento? */
export function graphDefinition(src: string): boolean {
  const s = src.trim()
  // f(x) = …  ·  a = 3  ·  P = (1, 2)  (no «y = …» ni ecuaciones en x, y)
  return /^[A-Za-z_]\w*\s*(\([^)]*\))?\s*=(?!=)/.test(s) && !/^[xy]\s*=/.test(s)
}

export interface DocEval {
  session: Session
  calc: Record<string, Out[]>
  sheets: Record<string, SheetResult>
  /** variables compartidas al final de la evaluación (para el panel de variables) */
  lists: Record<string, number[]>
}

function runAll(doc: Doc, seed: Session | null, seedLists: Record<string, number[]>): DocEval {
  const session = new Session()
  if (seed) {
    session.vars = { ...seed.vars }
    session.exprs = { ...seed.exprs }
    session.fns = { ...seed.fns }
  }
  for (const [k, v] of Object.entries(seedLists)) session.vars[k] = v
  const calc: Record<string, Out[]> = {}
  const sheets: Record<string, SheetResult> = {}
  const lists: Record<string, number[]> = { ...seedLists }
  for (const page of doc.pages) {
    for (const pane of page.panes) {
      // un panel con problemas no debe impedir que se evalúen los demás
      try {
        if (pane.kind === 'calc') calc[pane.id] = pane.lines.map((l) => session.run(l))
        else if (pane.kind === 'graph') {
          for (const e of pane.entries) if (e.src.trim() && graphDefinition(e.src)) session.run(e.src)
        } else if (pane.kind === 'sheet') {
          const res = evaluateSheet(pane.sheet, session.scope())
          sheets[pane.id] = res
          for (const [k, v] of Object.entries(res.lists)) {
            lists[k] = v
            session.vars[k] = v
          }
        }
      } catch (e) {
        console.error('[NumLab] Error al evaluar un panel del espacio de trabajo', pane.kind, e)
      }
    }
  }
  return { session, calc, sheets, lists }
}

/**
 * Evalúa todo el documento en orden (páginas y paneles). Se hacen dos pasadas para que una app
 * pueda usar lo que se define más adelante (p. ej. la calculadora de la página 1 con las listas de
 * la hoja de la página 2).
 */
export function evaluateDoc(doc: Doc): DocEval {
  try {
    const first = runAll(doc, null, {})
    return runAll(doc, first.session, first.lists)
  } catch (e) {
    console.error('[NumLab] Error al evaluar el documento', e)
    return { session: new Session(), calc: {}, sheets: {}, lists: {} }
  }
}
