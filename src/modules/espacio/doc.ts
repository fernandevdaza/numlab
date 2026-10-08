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
}

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
  const first = runAll(doc, null, {})
  return runAll(doc, first.session, first.lists)
}
