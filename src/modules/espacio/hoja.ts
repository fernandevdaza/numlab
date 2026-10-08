// Motor de la hoja de cálculo del espacio de trabajo.
//
// · Celdas «A1», «B12»…: número, texto o fórmula que empieza con «=».
// · Fórmulas en sintaxis mathjs con referencias (A1, $B$2), rangos (A1:B5) y funciones de hoja
//   (SUMA/SUM, PROMEDIO/AVERAGE, CONTAR/COUNT…). También ven las variables del documento.
// · Columnas con nombre: su lista de números se comparte con el CAS y las gráficas, y una columna
//   puede tener una fórmula propia («=t^2», «=seq(k, k, 1, 10)») que la llena entera.
import { create, all } from 'mathjs'
import { installExtras } from '../../lib/extras.ts'

export const H = create(all, { number: 'number' })
installExtras(H)

export interface SheetData {
  cells: Record<string, string>
  /** nombre de cada columna (letra → nombre), p. ej. { A: 't', B: 'y' } */
  names: Record<string, string>
  /** fórmula de columna (letra → «=…») */
  colFormulas: Record<string, string>
  cols: number
  rows: number
}

export type CellValue = number | string | null

export interface CellResult {
  value: CellValue
  error?: string
}

export interface SheetResult {
  get(ref: string): CellResult
  /** listas de las columnas con nombre (sólo números, sin huecos al final) */
  lists: Record<string, number[]>
  /** errores de las fórmulas de columna */
  colErrors: Record<string, string>
}

export const emptySheet = (cols = 6, rows = 30): SheetData => ({ cells: {}, names: {}, colFormulas: {}, cols, rows })

/* ─────────────── referencias ─────────────── */

export const colLetter = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)))
export function colIndex(letters: string): number {
  let n = 0
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}
export const refOf = (c: number, r: number) => colLetter(c) + (r + 1)
export function parseRef(ref: string): { c: number; r: number } | null {
  const m = ref.replace(/\$/g, '').toUpperCase().match(/^([A-Z]{1,2})(\d+)$/)
  return m ? { c: colIndex(m[1]), r: Number(m[2]) - 1 } : null
}

/** Funciones de hoja (mayúsculas, en inglés o español) → funciones de mathjs. */
const FN: Record<string, string> = {
  SUM: 'sum', SUMA: 'sum',
  AVERAGE: 'mean', MEAN: 'mean', PROMEDIO: 'mean', MEDIA: 'mean',
  MEDIAN: 'median', MEDIANA: 'median',
  MIN: 'min', MAX: 'max',
  COUNT: '__count', CONTAR: '__count',
  STDEV: 'std', DESVEST: 'std', STD: 'std',
  VAR: 'variance', VARIANCE: 'variance',
  PRODUCT: 'prod', PRODUCTO: 'prod',
  ABS: 'abs', SQRT: 'sqrt', RAIZ: 'sqrt', EXP: 'exp', LN: 'log', LOG: 'log10', LOG10: 'log10',
  SIN: 'sin', SEN: 'sin', COS: 'cos', TAN: 'tan', ROUND: 'round', REDONDEAR: 'round', FLOOR: 'floor', CEIL: 'ceil',
  POWER: 'pow', POTENCIA: 'pow', MOD: 'mod', PI: 'pi',
  IF: '__if', SI: '__if',
}

/** Convierte la fórmula de una celda a una expresión mathjs con llamadas __c("A1") y __r("A1","B5"). */
export function translateFormula(src: string): string {
  let s = src.replace(/^=/, '')
  // rangos y referencias (no dentro de nombres más largos ni de números como 1E5)
  s = s.replace(/(?<![\w.])\$?([A-Za-z]{1,2})\$?(\d+)\s*:\s*\$?([A-Za-z]{1,2})\$?(\d+)(?![\w(])/g, (_, c1, r1, c2, r2) => `__r("${c1.toUpperCase()}${r1}","${c2.toUpperCase()}${r2}")`)
  s = s.replace(/(?<![\w."])\$?([A-Z]{1,2})\$?(\d+)(?![\w(])/g, (_, c, r) => `__c("${c}${r}")`)
  // funciones de hoja en mayúsculas
  s = s.replace(/\b([A-Z][A-Z0-9_]*)\s*\(/g, (m, name: string) => (FN[name] ? FN[name] + '(' : m))
  s = s.replace(/\bPI\b(?!\s*\()/g, 'pi')
  // listas: operaciones elemento a elemento cuando no hay matrices explícitas
  return s
}

const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Valor de una celda escrita a mano (sin «=»). */
function literal(raw: string): CellValue {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  if (/^[-+]?(\d+[.,]?\d*|[.,]\d+)(e[-+]?\d+)?$/i.test(t) && Number.isFinite(n)) return n
  return t
}

function toCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') return v
  if ((v as any)?.isComplex) return H.format(v as any, { precision: 10 })
  if (H.isMatrix(v) || Array.isArray(v)) {
    const arr = (H.isMatrix(v) ? (v as any).toArray() : v).flat(Infinity)
    return arr.length === 1 && numeric(arr[0]) ? arr[0] : H.format(v as any, { precision: 8 })
  }
  return String(v)
}

/** Lista de números de una columna (filas 0…n−1), sin los huecos del final. */
function columnList(get: (ref: string) => CellResult, c: number, rows: number): number[] {
  const out: number[] = []
  let last = -1
  const vals: (number | null)[] = []
  for (let r = 0; r < rows; r++) {
    const v = get(refOf(c, r)).value
    vals.push(numeric(v) ? v : null)
    if (numeric(v)) last = r
  }
  for (let r = 0; r <= last; r++) if (vals[r] !== null) out.push(vals[r] as number)
  return out
}

const isElementwise = (s: string) => s.replace(/\.\^|\.\*|\.\//g, '').length !== s.length

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
  const compileF = (expr: string) => {
    let c = compiled.get(expr)
    if (!c) {
      c = H.parse(expr).compile()
      compiled.set(expr, c)
    }
    return c
  }

  const evalExpr = (src: string): unknown => {
    const expr = translateFormula(src)
    const local: Record<string, any> = {
      ...scope,
      __c: (ref: string) => {
        const v = get(ref)
        if (v.error) throw new Error(v.error)
        return v.value ?? 0
      },
      __r: (a: string, b: string) => {
        const A = parseRef(a), B = parseRef(b)
        if (!A || !B) throw new Error('#REF')
        const [c0, c1] = [Math.min(A.c, B.c), Math.max(A.c, B.c)]
        const [r0, r1] = [Math.min(A.r, B.r), Math.max(A.r, B.r)]
        const rows: number[][] = []
        for (let r = r0; r <= r1; r++) {
          const row: number[] = []
          for (let c = c0; c <= c1; c++) {
            const v = get(refOf(c, r))
            if (v.error) throw new Error(v.error)
            if (numeric(v.value)) row.push(v.value)
          }
          if (row.length) rows.push(row)
        }
        // una sola columna o fila → lista
        if (c0 === c1) return rows.map((r) => r[0])
        if (r0 === r1) return rows[0] ?? []
        return rows
      },
      __count: (...args: any[]) => args.flat(Infinity).filter(numeric).length,
      __if: (cond: any, a: any, b: any) => (cond ? a : b),
    }
    // columnas con nombre como listas, calculadas sólo si la fórmula las usa
    for (const [name, c] of nameToCol)
      if (!(name in scope) || Array.isArray(scope[name])) Object.defineProperty(local, name, { get: () => listOf(c), enumerable: true, configurable: true })
    return compileF(expr).evaluate(local)
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
    if (visiting.has(key)) throw new Error('#CICLO')
    visiting.add(key)
    let out: unknown[] = []
    try {
      let src = f.replace(/^=/, '')
      // «t^2» con t lista: elemento a elemento
      if (!isElementwise(src)) src = src.replace(/\^/g, '.^').replace(/(?<![.])\*/g, '.*').replace(/(?<![.])\//g, './')
      const v = evalExpr('=' + src)
      const arr = H.isMatrix(v) ? (v as any).toArray() : v
      out = Array.isArray(arr) ? arr.flat(Infinity) : [arr]
    } catch (e: any) {
      colErrors[L] = String(e?.message ?? e)
      out = []
    } finally {
      visiting.delete(key)
    }
    colFill.set(c, out)
    return out
  }

  function get(ref: string): CellResult {
    const p = parseRef(ref)
    if (!p) return { value: null, error: '#REF' }
    const key = refOf(p.c, p.r)
    const hit = memo.get(key)
    if (hit) return hit
    if (visiting.has(key)) return { value: null, error: '#CICLO' }
    visiting.add(key)
    let res: CellResult
    try {
      const fill = sheet.colFormulas[colLetter(p.c)]?.trim() ? fillOf(p.c) : null
      const raw = sheet.cells[key] ?? ''
      if (fill) res = { value: p.r < fill.length ? toCell(fill[p.r]) : null }
      else if (raw.trim().startsWith('=')) res = { value: toCell(evalExpr(raw.trim())) }
      else res = { value: literal(raw) }
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      res = { value: null, error: msg.startsWith('#') ? msg : '#ERR: ' + msg }
    } finally {
      visiting.delete(key)
    }
    memo.set(key, res)
    return res
  }

  for (const [name, c] of nameToCol) listOf(c)
  for (const L of Object.keys(sheet.colFormulas)) {
    try {
      fillOf(colIndex(L))
    } catch (e: any) {
      colErrors[L] = String(e?.message ?? e)
    }
  }
  // las listas se recalculan al final por si una columna dependía de otra con fórmula
  for (const [name, c] of nameToCol) lists[name] = columnList(get, c, sheet.rows)
  return { get, lists, colErrors }
}

/** Texto para mostrar el valor de una celda. */
export function showCell(v: CellValue, digits = 8): string {
  if (v === null) return ''
  if (typeof v === 'string') return v
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v)
  const a = Math.abs(v)
  if (a !== 0 && (a < 1e-4 || a >= 1e10)) return v.toExponential(Math.max(0, digits - 2)).replace(/\.?0+e/, 'e')
  return String(Number(v.toPrecision(digits)))
}

/** Pega un bloque TSV/CSV (de Excel, Sheets o una tabla de NumLab) a partir de una celda. */
export function pasteBlock(sheet: SheetData, at: { c: number; r: number }, text: string): SheetData {
  const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n')
  const sep = lines.some((l) => l.includes('\t')) ? '\t' : lines.some((l) => l.includes(';')) ? ';' : ','
  const cells = { ...sheet.cells }
  let cols = sheet.cols, rows = sheet.rows
  lines.forEach((line, i) => {
    line.split(sep).forEach((v, j) => {
      const c = at.c + j, r = at.r + i
      cells[refOf(c, r)] = v.trim()
      cols = Math.max(cols, c + 1)
      rows = Math.max(rows, r + 1)
    })
  })
  return { ...sheet, cells, cols: Math.min(cols, 52), rows: Math.min(rows, 2000) }
}
