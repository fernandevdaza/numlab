// Motor de la hoja de cálculo del espacio de trabajo.
//
// · Celdas «A1», «B12»…: número, texto o fórmula que empieza con «=».
// · Fórmulas como en Excel: referencias (A1, $B$2), rangos (A1:B5, A:A), funciones de hoja en
//   inglés o español (SUM/SUMA, IF/SI, VLOOKUP/BUSCARV…; ver hoja/funciones.ts), operadores
//   = <> & %, textos "…" y la sintaxis en español con «;». También valen las funciones de mathjs
//   (sin, sqrt, linreg, seq…) y las variables del documento.
// · Columnas con nombre: su lista de números se comparte con el CAS y las gráficas, y una columna
//   puede tener una fórmula propia («=t^2», «=seq(k, k, 1, 10)») que la llena entera.
// · Errores como en Excel: #DIV/0!, #NAME?, #VALUE!, #REF!, #N/A, #NUM!, #CIRC!.
import { create, all } from 'mathjs'
import { installExtras } from '../../lib/extras.ts'
import { FUNCTIONS, XlError, internalName, sheetFunction } from './hoja/funciones.ts'
import { colIndex, colLetter, refBounds, tokenize, usesSpanishSyntax, type Bounds } from './hoja/tokens.ts'

export { colIndex, colLetter }

export const H = create(all, { number: 'number' })
installExtras(H)

// funciones de hoja (las «perezosas» reciben sus argumentos sin evaluar)
{
  const fns: Record<string, any> = {}
  for (const f of FUNCTIONS) {
    if (f.lazy) {
      const g: any = (args: any[], _m: any, scope: any) => f.impl(...args.map((node: any) => () => node.compile().evaluate(scope)))
      g.rawArgs = true
      fns[internalName(f)] = g
    } else fns[internalName(f)] = (...a: any[]) => f.impl(...a)
  }
  // «&» concatena textos (en mathjs sería el «y» bit a bit)
  fns.bitAnd = (a: any, b: any) => String(a ?? '') + String(b ?? '')
  fns.__err = (code: string) => {
    throw new XlError(code)
  }
  H.import(fns, { override: true })
}

export type NumFmt = 'general' | 'number' | 'percent' | 'sci' | 'currency' | 'int'

export interface CellFmt {
  nf?: NumFmt
  /** decimales (number, percent, sci, currency) */
  dec?: number
  b?: boolean
  i?: boolean
  al?: 'left' | 'center' | 'right'
  color?: string
  bg?: string
}

export interface SheetData {
  cells: Record<string, string>
  /** nombre de cada columna (letra → nombre), p. ej. { A: 't', B: 'y' } */
  names: Record<string, string>
  /** fórmula de columna (letra → «=…») */
  colFormulas: Record<string, string>
  cols: number
  rows: number
  /** formato por celda */
  fmt?: Record<string, CellFmt>
  /** ancho de columna en píxeles (letra → px) */
  colW?: Record<string, number>
}

export type CellValue = number | string | boolean | null

export interface CellResult {
  value: CellValue
  /** código de error (#DIV/0!, #NAME?…) */
  error?: string
  /** detalle técnico del error */
  detail?: string
}

export interface SheetResult {
  get(ref: string): CellResult
  /** listas de las columnas con nombre (sólo números, sin huecos al final) */
  lists: Record<string, number[]>
  /** errores de las fórmulas de columna */
  colErrors: Record<string, string>
}

export const emptySheet = (cols = 6, rows = 40): SheetData => ({ cells: {}, names: {}, colFormulas: {}, cols, rows })

export const refOf = (c: number, r: number) => colLetter(c) + (r + 1)
export function parseRef(ref: string): { c: number; r: number } | null {
  const m = ref.replace(/\$/g, '').toUpperCase().match(/^([A-Z]{1,2})(\d+)$/)
  return m ? { c: colIndex(m[1]), r: Number(m[2]) - 1 } : null
}

/* ─────────────── traducción a mathjs ─────────────── */

/** Convierte la fórmula de una celda (con o sin «=») a una expresión mathjs. */
export function translateFormula(src: string, rows = 1000): string {
  const text = src.replace(/^=/, '')
  const es = usesSpanishSyntax(text)
  let out = ''
  for (const t of tokenize(text, es)) {
    switch (t.type) {
      case 'ref': {
        const r = t.ref!
        if (r.kind === 'cell') out += `__c("${colLetter(r.a.col)}${r.a.row + 1}")`
        else {
          const b: Bounds = refBounds(r, rows)
          out += `__r("${colLetter(b.c0)}${b.r0 + 1}","${colLetter(b.c1)}${b.r1 + 1}")`
        }
        break
      }
      case 'func': {
        const name = t.text.trim()
        // «log» en minúscula es el logaritmo natural de mathjs; en mayúscula, el LOG de Excel
        const f = name === 'log' ? undefined : sheetFunction(name)
        out += f ? internalName(f) : name
        break
      }
      case 'string':
        out += JSON.stringify(t.text.slice(1, t.text.endsWith('"') && t.text.length > 1 ? -1 : undefined).replace(/""/g, '"'))
        break
      case 'bool':
        out += /^(TRUE|VERDADERO)$/i.test(t.text) ? 'true' : 'false'
        break
      case 'number':
        out += es ? t.text.replace(',', '.') : t.text
        break
      case 'sep':
        out += ','
        break
      case 'error':
        out += `__err("${t.text.toUpperCase()}")`
        break
      case 'op':
        out += t.text === '<>' ? '!=' : t.text === '=' ? '==' : t.text
        break
      default:
        out += t.text
    }
  }
  return out
}

/* ─────────────── evaluación ─────────────── */

const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Valor de una celda escrita a mano (sin «=»). */
export function literal(raw: string): CellValue {
  const t = raw.trim()
  if (!t) return null
  if (t.startsWith("'")) return t.slice(1)
  if (/^[-+]?(\d+[.,]?\d*|[.,]\d+)(e[-+]?\d+)?%?$/i.test(t)) {
    const pct = t.endsWith('%')
    const n = Number(t.replace('%', '').replace(',', '.'))
    if (Number.isFinite(n)) return pct ? n / 100 : n
  }
  if (/^(true|verdadero)$/i.test(t)) return true
  if (/^(false|falso)$/i.test(t)) return false
  return t
}

function toCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') {
    if (Number.isNaN(v)) throw new XlError('#NUM!')
    if (!Number.isFinite(v)) throw new XlError('#DIV/0!')
    return v
  }
  if (typeof v === 'boolean' || typeof v === 'string') return v
  if ((v as any)?.isComplex) {
    const c = v as any
    if (Math.abs(c.im) < 1e-14) return c.re
    throw new XlError('#NUM!', 'resultado complejo')
  }
  if (H.isMatrix(v) || Array.isArray(v)) {
    const arr = (H.isMatrix(v) ? (v as any).toArray() : v).flat(Infinity)
    return arr.length === 1 ? toCell(arr[0]) : H.format(v as any, { precision: 8 })
  }
  return String(v)
}

/** Código de error a partir de una excepción de mathjs o de la hoja. */
function errorOf(e: any): { error: string; detail: string } {
  const msg = String(e?.message ?? e)
  if (e instanceof XlError || /^#/.test(msg)) return { error: msg.split(' ')[0], detail: msg }
  if (/Undefined (symbol|function)|is not a function|Unknown function/i.test(msg)) return { error: '#NAME?', detail: msg }
  if (/Unexpected|expected|Parenthesis|end of expression|Value expected|Invalid/i.test(msg)) return { error: '#ERROR!', detail: msg }
  if (/Index out of range|Dimension mismatch/i.test(msg)) return { error: '#REF!', detail: msg }
  return { error: '#VALUE!', detail: msg }
}

/** Lista de números de una columna (filas 0…n−1), sin los huecos del final. */
function columnList(get: (ref: string) => CellResult, c: number, rows: number): number[] {
  const vals: (number | null)[] = []
  let last = -1
  for (let r = 0; r < rows; r++) {
    const v = get(refOf(c, r)).value
    vals.push(numeric(v) ? v : null)
    if (numeric(v)) last = r
  }
  const out: number[] = []
  for (let r = 0; r <= last; r++) if (vals[r] !== null) out.push(vals[r] as number)
  return out
}

const isElementwise = (s: string) => /\.\^|\.\*|\.\//.test(s)

/**
 * Evalúa la hoja. `scope`: variables del documento (números, listas, funciones de mathjs).
 * Las celdas se calculan a demanda, con memoria y detección de ciclos.
 */
export function evaluateSheet(sheet: SheetData, scope: Record<string, any> = {}): SheetResult {
  const memo = new Map<string, CellResult>()
  const visiting = new Set<string>()
  const colFill = new Map<number, unknown[]>()
  const colErrors: Record<string, string> = {}
  const lists: Record<string, number[]> = {}
  const nameToCol = new Map<string, number>()
  for (const [L, n] of Object.entries(sheet.names)) if (n?.trim()) nameToCol.set(n.trim(), colIndex(L))

  const compiled = new Map<string, any>()
  const compileF = (src: string) => {
    let c = compiled.get(src)
    if (!c) {
      c = H.parse(translateFormula(src, sheet.rows)).compile()
      compiled.set(src, c)
    }
    return c
  }

  const rangeValue = (a: string, b: string) => {
    const A = parseRef(a), B = parseRef(b)
    if (!A || !B) throw new XlError('#REF!')
    const r1 = Math.min(Math.max(A.r, B.r), sheet.rows - 1)
    const c0 = Math.min(A.c, B.c), c1 = Math.max(A.c, B.c), r0 = Math.min(A.r, B.r)
    const cells: CellValue[][] = []
    for (let r = r0; r <= r1; r++) {
      const row: CellValue[] = []
      for (let c = c0; c <= c1; c++) {
        const v = get(refOf(c, r))
        if (v.error) throw new XlError(v.error)
        row.push(v.value)
      }
      cells.push(row)
    }
    // para las funciones de mathjs: sólo los números (lista si es una fila o columna)
    const out: any = c0 === c1 ? cells.map((r) => r[0]).filter(numeric) : r0 === r1 ? cells[0].filter(numeric) : cells.map((r) => r.map((v) => (numeric(v) ? v : 0)))
    Object.defineProperty(out, 'cells', { value: cells, enumerable: false })
    return out
  }

  const evalExpr = (src: string): unknown => {
    const local: Record<string, any> = {
      ...scope,
      __c: (ref: string) => {
        const v = get(ref)
        if (v.error) throw new XlError(v.error)
        return v.value ?? 0
      },
      __r: rangeValue,
    }
    // columnas con nombre como listas, calculadas sólo si la fórmula las usa
    for (const [name, c] of nameToCol)
      if (!(name in scope) || Array.isArray(scope[name])) Object.defineProperty(local, name, { get: () => listOf(c), enumerable: true, configurable: true })
    return compileF(src).evaluate(local)
  }

  const listOf = (c: number): number[] => {
    const name = sheet.names[colLetter(c)]?.trim()
    if (name && lists[name]) return lists[name]
    const l = columnList(get, c, sheet.rows)
    if (name) lists[name] = l
    return l
  }

  const fillOf = (c: number): unknown[] | null => {
    if (colFill.has(c)) return colFill.get(c)!
    const L = colLetter(c)
    const f = sheet.colFormulas[L]?.trim()
    if (!f) return null
    const key = '#col' + L
    if (visiting.has(key)) throw new XlError('#CIRC!')
    visiting.add(key)
    let out: unknown[] = []
    try {
      let src = f.replace(/^=/, '')
      // «t^2» con t lista: elemento a elemento
      if (!isElementwise(src)) src = src.replace(/\^/g, '.^').replace(/(?<![.])\*/g, '.*').replace(/(?<![.])\//g, './')
      const v = evalExpr(src)
      const arr = H.isMatrix(v) ? (v as any).toArray() : v
      out = Array.isArray(arr) ? arr.flat(Infinity) : [arr]
    } catch (e: any) {
      const er = errorOf(e)
      colErrors[L] = `${er.error} ${er.detail}`
      out = []
    } finally {
      visiting.delete(key)
    }
    colFill.set(c, out)
    return out
  }

  function get(ref: string): CellResult {
    const p = parseRef(ref)
    if (!p) return { value: null, error: '#REF!' }
    const key = refOf(p.c, p.r)
    const hit = memo.get(key)
    if (hit) return hit
    if (visiting.has(key)) return { value: null, error: '#CIRC!', detail: key }
    visiting.add(key)
    let res: CellResult
    try {
      const fill = sheet.colFormulas[colLetter(p.c)]?.trim() ? fillOf(p.c) : null
      const raw = sheet.cells[key] ?? ''
      if (fill) res = { value: p.r < fill.length ? toCell(fill[p.r]) : null }
      else if (raw.trim().startsWith('=') && raw.trim().length > 1) res = { value: toCell(evalExpr(raw.trim())) }
      else res = { value: literal(raw) }
    } catch (e: any) {
      const er = errorOf(e)
      res = { value: null, error: er.error, detail: er.detail }
    } finally {
      visiting.delete(key)
    }
    memo.set(key, res)
    return res
  }

  for (const c of nameToCol.values()) listOf(c)
  for (const L of Object.keys(sheet.colFormulas)) {
    try {
      fillOf(colIndex(L))
    } catch (e: any) {
      colErrors[L] = errorOf(e).error
    }
  }
  // las listas se recalculan al final por si una columna dependía de otra con fórmula
  for (const [name, c] of nameToCol) lists[name] = columnList(get, c, sheet.rows)
  return { get, lists, colErrors }
}

/* ─────────────── formato ─────────────── */

/** Texto para mostrar el valor de una celda con su formato. */
export function showCell(v: CellValue, fmt?: CellFmt, digits = 10): string {
  if (v === null) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'string') return v
  const d = fmt?.dec ?? 2
  switch (fmt?.nf ?? 'general') {
    case 'number':
      return v.toFixed(d)
    case 'int':
      return String(Math.round(v))
    case 'percent':
      return (v * 100).toFixed(d) + '%'
    case 'sci':
      return v.toExponential(d)
    case 'currency':
      return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  }
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v)
  const a = Math.abs(v)
  if (a !== 0 && (a < 1e-4 || a >= 1e11)) return v.toExponential(Math.max(0, digits - 4)).replace(/\.?0+e/, 'e')
  return String(Number(v.toPrecision(digits)))
}

/* ─────────────── pegar e importar ─────────────── */

/** Separa un bloque TSV/CSV (de Excel, Sheets o una tabla de NumLab) en filas y celdas. */
export function parseBlock(text: string): string[][] {
  const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n')
  const sep = lines.some((l) => l.includes('\t')) ? '\t' : lines.some((l) => l.includes(';')) ? ';' : ','
  return lines.map((l) => l.split(sep).map((v) => v.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"')))
}

/** Pega un bloque TSV/CSV a partir de una celda. */
export function pasteBlock(sheet: SheetData, at: { c: number; r: number }, text: string): SheetData {
  const cells = { ...sheet.cells }
  let cols = sheet.cols, rows = sheet.rows
  parseBlock(text).forEach((line, i) => {
    line.forEach((v, j) => {
      const c = at.c + j, r = at.r + i
      if (v) cells[refOf(c, r)] = v
      else delete cells[refOf(c, r)]
      cols = Math.max(cols, c + 1)
      rows = Math.max(rows, r + 2)
    })
  })
  return { ...sheet, cells, cols: Math.min(cols, 52), rows: Math.min(rows, 5000) }
}

/** Celdas usadas (última fila y columna con contenido). */
export function usedExtent(sheet: SheetData): { rows: number; cols: number } {
  let r = 0, c = 0
  for (const k of Object.keys(sheet.cells)) {
    const p = parseRef(k)
    if (p) ((r = Math.max(r, p.r + 1)), (c = Math.max(c, p.c + 1)))
  }
  for (const L of Object.keys(sheet.colFormulas)) c = Math.max(c, colIndex(L) + 1)
  return { rows: r, cols: c }
}

/** CSV de los valores calculados (para exportar). */
export function toCsv(sheet: SheetData, res: SheetResult): string {
  const ext = usedExtent(sheet)
  const filled = Math.max(ext.rows, ...Object.keys(sheet.colFormulas).map((L) => res.lists[sheet.names[L]]?.length ?? 0))
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines: string[] = []
  const names = Array.from({ length: ext.cols }, (_, c) => sheet.names[colLetter(c)] ?? '')
  if (names.some(Boolean)) lines.push(names.map(cell).join(','))
  for (let r = 0; r < filled; r++) {
    const row: string[] = []
    for (let c = 0; c < ext.cols; c++) {
      const v = res.get(refOf(c, r))
      row.push(cell(v.error ?? (v.value === null ? '' : String(v.value))))
    }
    lines.push(row.join(','))
  }
  return lines.join('\n')
}
