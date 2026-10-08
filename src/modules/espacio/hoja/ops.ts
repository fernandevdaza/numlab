// Operaciones de la hoja (puras: devuelven una hoja nueva): relleno con series, copiar y pegar
// ajustando referencias, mover al cortar, insertar y eliminar filas o columnas, Autosuma.
import { colIndex, colLetter, literal, parseRef, refOf, type CellFmt, type SheetData, type SheetResult } from '../hoja.ts'
import { adjustForInsert, moveRefs, shiftFormula, type Bounds } from './tokens.ts'

export type { Bounds }

export const norm = (a: { r: number; c: number }, b: { r: number; c: number }): Bounds => ({ r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) })
export const inBounds = (b: Bounds, r: number, c: number) => r >= b.r0 && r <= b.r1 && c >= b.c0 && c <= b.c1

/** Escribe varias celdas (texto crudo) y amplía la hoja si hace falta. */
export function setCells(sheet: SheetData, entries: [string, string][]): SheetData {
  const cells = { ...sheet.cells }
  let rows = sheet.rows, cols = sheet.cols
  for (const [ref, raw] of entries) {
    if (raw.trim()) cells[ref] = raw
    else delete cells[ref]
    const p = parseRef(ref)
    if (p) ((rows = Math.max(rows, p.r + 2)), (cols = Math.max(cols, p.c + 1)))
  }
  return { ...sheet, cells, rows: Math.min(rows, 5000), cols: Math.min(cols, 52) }
}

export function clearRange(sheet: SheetData, b: Bounds, formats = false): SheetData {
  const cells = { ...sheet.cells }
  const fmt = { ...(sheet.fmt ?? {}) }
  for (let r = b.r0; r <= b.r1; r++)
    for (let c = b.c0; c <= b.c1; c++) {
      delete cells[refOf(c, r)]
      if (formats) delete fmt[refOf(c, r)]
    }
  return { ...sheet, cells, fmt }
}

export function setFormat(sheet: SheetData, b: Bounds, patch: Partial<CellFmt> | null): SheetData {
  const fmt = { ...(sheet.fmt ?? {}) }
  for (let r = b.r0; r <= b.r1; r++)
    for (let c = b.c0; c <= b.c1; c++) {
      const k = refOf(c, r)
      if (!patch) delete fmt[k]
      else {
        const f: CellFmt = { ...fmt[k], ...patch }
        for (const key of Object.keys(f) as (keyof CellFmt)[]) if (f[key] === undefined) delete f[key]
        if (Object.keys(f).length) fmt[k] = f
        else delete fmt[k]
      }
    }
  return { ...sheet, fmt }
}

/* ─────────────── relleno (controlador de relleno, Ctrl+D, Ctrl+R) ─────────────── */

export type FillDir = 'down' | 'up' | 'right' | 'left'

/** Dirección y tamaño de un arrastre del controlador de relleno (gana el eje más alejado). */
export function fillExtent(src: Bounds, p: { r: number; c: number }): { dir: FillDir; count: number } | null {
  const down = p.r - src.r1, up = src.r0 - p.r, right = p.c - src.c1, left = src.c0 - p.c
  const v = Math.max(down, up), h = Math.max(right, left)
  if (v <= 0 && h <= 0) return null
  if (v >= h) return down > 0 ? { dir: 'down', count: down } : { dir: 'up', count: up }
  return right > 0 ? { dir: 'right', count: right } : { dir: 'left', count: left }
}

export function fillTarget(src: Bounds, dir: FillDir, count: number): Bounds {
  if (dir === 'down') return { ...src, r0: src.r1 + 1, r1: src.r1 + count }
  if (dir === 'up') return { ...src, r0: src.r0 - count, r1: src.r0 - 1 }
  if (dir === 'right') return { ...src, c0: src.c1 + 1, c1: src.c1 + count }
  return { ...src, c0: src.c0 - count, c1: src.c0 - 1 }
}

/**
 * Serie de una línea de valores (Excel): dos o más números siguen la tendencia lineal; «Año 1»
 * incrementa su número. null → se copia el patrón.
 */
export function seriesGenerator(line: string[]): ((i: number) => string) | null {
  if (!line.length || line.some((s) => s.trim().startsWith('='))) return null
  const vals = line.map((s) => literal(s))
  if (vals.every((v) => typeof v === 'number')) {
    if (vals.length < 2) return null
    const ys = vals as number[]
    const n = ys.length, mx = (n - 1) / 2, my = ys.reduce((s, y) => s + y, 0) / n
    let sxy = 0, sxx = 0
    ys.forEach((y, i) => ((sxy += (i - mx) * (y - my)), (sxx += (i - mx) ** 2)))
    const b = sxx ? sxy / sxx : 0
    return (i) => String(Number((my - b * mx + b * i).toPrecision(15)))
  }
  if (vals.every((v) => typeof v === 'string')) {
    const parts = (vals as string[]).map((s) => /^(.*?)(\d+)$/.exec(s))
    if (parts.some((m) => !m) || !parts[0]![1] || parts.some((m) => m![1] !== parts[0]![1])) return null
    const nums = parts.map((m) => Number(m![2]))
    const step = nums.length > 1 ? nums[nums.length - 1] - nums[nums.length - 2] : 1
    const base = nums[nums.length - 1] - step * (nums.length - 1)
    return (i) => `${parts[0]![1]}${Math.abs(Math.round(base + step * i))}`
  }
  return null
}

export function fillRange(sheet: SheetData, src: Bounds, dir: FillDir, count: number): SheetData {
  const dst = fillTarget(src, dir, count)
  if (dst.r0 < 0 || dst.c0 < 0) return sheet
  const vertical = dir === 'down' || dir === 'up'
  const entries: [string, string][] = []
  const fmt = { ...(sheet.fmt ?? {}) }
  const lines = vertical ? src.c1 - src.c0 + 1 : src.r1 - src.r0 + 1
  const len = vertical ? src.r1 - src.r0 + 1 : src.c1 - src.c0 + 1
  for (let k = 0; k < lines; k++) {
    const at = (i: number) => (vertical ? { r: src.r0 + i, c: src.c0 + k } : { r: src.r0 + k, c: src.c0 + i })
    const line = Array.from({ length: len }, (_, i) => sheet.cells[refOf(at(i).c, at(i).r)] ?? '')
    const gen = seriesGenerator(line)
    for (let j = 1; j <= count; j++) {
      // índice relativo a la primera celda de la fuente (negativo hacia arriba/izquierda)
      const idx = dir === 'down' || dir === 'right' ? len - 1 + j : -j
      const srcI = ((idx % len) + len) % len
      const from = at(srcI)
      const to = vertical ? { r: src.r0 + idx, c: src.c0 + k } : { r: src.r0 + k, c: src.c0 + idx }
      const raw = sheet.cells[refOf(from.c, from.r)] ?? ''
      const out = gen ? gen(idx) : raw.trim().startsWith('=') ? shiftFormula(raw, to.r - from.r, to.c - from.c) : raw
      entries.push([refOf(to.c, to.r), out])
      const f = sheet.fmt?.[refOf(from.c, from.r)]
      if (f) fmt[refOf(to.c, to.r)] = f
      else delete fmt[refOf(to.c, to.r)]
    }
  }
  return { ...setCells(sheet, entries), fmt }
}

/** Ctrl+Enter: la misma fórmula en todo el rango, con las referencias relativas desplazadas. */
export function fillAll(sheet: SheetData, b: Bounds, anchor: { r: number; c: number }, raw: string): SheetData {
  const entries: [string, string][] = []
  for (let r = b.r0; r <= b.r1; r++) for (let c = b.c0; c <= b.c1; c++) entries.push([refOf(c, r), raw.trim().startsWith('=') ? shiftFormula(raw, r - anchor.r, c - anchor.c) : raw])
  return setCells(sheet, entries)
}

/* ─────────────── portapapeles ─────────────── */

export interface Clip {
  bounds: Bounds
  /** contenido crudo y formato de cada celda copiada, relativo a la esquina */
  raw: string[][]
  fmt: (CellFmt | undefined)[][]
  cut: boolean
  /** texto puesto en el portapapeles del sistema (para reconocer un pegado propio) */
  tsv: string
}

export function makeClip(sheet: SheetData, res: SheetResult | undefined, b: Bounds, cut: boolean, show: (v: any, f?: CellFmt) => string): Clip {
  const raw: string[][] = [], fmt: (CellFmt | undefined)[][] = [], tsv: string[] = []
  for (let r = b.r0; r <= b.r1; r++) {
    const rr: string[] = [], ff: (CellFmt | undefined)[] = [], tt: string[] = []
    for (let c = b.c0; c <= b.c1; c++) {
      const k = refOf(c, r)
      rr.push(sheet.cells[k] ?? '')
      ff.push(sheet.fmt?.[k])
      const v = res?.get(k)
      tt.push(v?.error ?? show(v?.value ?? null, sheet.fmt?.[k]))
    }
    raw.push(rr), fmt.push(ff), tsv.push(tt.join('\t'))
  }
  return { bounds: b, raw, fmt, cut, tsv: tsv.join('\n') }
}

/**
 * Pegado propio: las fórmulas copian con sus referencias desplazadas; si el destino es múltiplo
 * del bloque copiado se repite. Al cortar, las celdas se mueven y las fórmulas que apuntaban a ellas
 * las siguen. `values`: pegar sólo los valores calculados.
 */
export function pasteClip(sheet: SheetData, clip: Clip, target: Bounds, opts: { values?: SheetResult } = {}): { sheet: SheetData; bounds: Bounds } {
  const h = clip.raw.length, w = clip.raw[0]?.length ?? 0
  const th = target.r1 - target.r0 + 1, tw = target.c1 - target.c0 + 1
  const reps = { r: !clip.cut && th % h === 0 ? th / h : 1, c: !clip.cut && tw % w === 0 ? tw / w : 1 }
  const out: Bounds = { r0: target.r0, c0: target.c0, r1: target.r0 + h * reps.r - 1, c1: target.c0 + w * reps.c - 1 }
  let s = sheet
  const dr0 = target.r0 - clip.bounds.r0, dc0 = target.c0 - clip.bounds.c0
  if (clip.cut) {
    // mover: vaciar el origen y actualizar las fórmulas que apuntaban a él
    s = clearRange(s, clip.bounds, true)
    const cells: Record<string, string> = {}
    for (const [k, v] of Object.entries(s.cells)) cells[k] = moveRefs(v, clip.bounds, dr0, dc0)
    const colFormulas: Record<string, string> = {}
    for (const [k, v] of Object.entries(s.colFormulas)) colFormulas[k] = moveRefs(v, clip.bounds, dr0, dc0)
    s = { ...s, cells, colFormulas }
  }
  const entries: [string, string][] = []
  const fmt = { ...(s.fmt ?? {}) }
  for (let rr = 0; rr < reps.r; rr++)
    for (let cc = 0; cc < reps.c; cc++)
      for (let i = 0; i < h; i++)
        for (let j = 0; j < w; j++) {
          const r = target.r0 + rr * h + i, c = target.c0 + cc * w + j
          const k = refOf(c, r)
          let raw = clip.raw[i][j]
          if (opts.values) {
            const v = opts.values.get(refOf(clip.bounds.c0 + j, clip.bounds.r0 + i))
            raw = v.error ?? (v.value === null ? '' : typeof v.value === 'string' ? (literal(v.value) === v.value ? v.value : "'" + v.value) : String(v.value))
          } else if (raw.trim().startsWith('=') && !clip.cut) raw = shiftFormula(raw, r - (clip.bounds.r0 + i), c - (clip.bounds.c0 + j))
          entries.push([k, raw])
          const f = clip.fmt[i][j]
          if (f) fmt[k] = f
          else delete fmt[k]
        }
  return { sheet: { ...setCells(s, entries), fmt }, bounds: out }
}

/* ─────────────── insertar y eliminar filas o columnas ─────────────── */

/** count > 0 inserta en `at`; count < 0 elimina |count| desde `at`. */
export function insertLines(sheet: SheetData, axis: 'row' | 'col', at: number, count: number): SheetData {
  const move = (k: string): string | null => {
    const p = parseRef(k)
    if (!p) return k
    const v = axis === 'row' ? p.r : p.c
    if (count < 0 && v >= at && v < at - count) return null
    const nv = v >= at ? v + count : v
    return axis === 'row' ? refOf(p.c, nv) : refOf(nv, p.r)
  }
  const cells: Record<string, string> = {}
  for (const [k, raw] of Object.entries(sheet.cells)) {
    const nk = move(k)
    if (nk) cells[nk] = adjustForInsert(raw, axis, at, count)
  }
  const fmt: Record<string, CellFmt> = {}
  for (const [k, f] of Object.entries(sheet.fmt ?? {})) {
    const nk = move(k)
    if (nk) fmt[nk] = f
  }
  const moveCol = <T,>(obj: Record<string, T> | undefined, map: (v: T) => T = (v) => v): Record<string, T> => {
    const o: Record<string, T> = {}
    for (const [L, v] of Object.entries(obj ?? {})) {
      const c = colIndex(L)
      if (axis === 'col') {
        if (count < 0 && c >= at && c < at - count) continue
        o[colLetter(c >= at ? c + count : c)] = map(v)
      } else o[L] = map(v)
    }
    return o
  }
  return {
    ...sheet,
    cells,
    fmt,
    names: moveCol(sheet.names),
    colFormulas: moveCol(sheet.colFormulas, (f) => adjustForInsert(f, axis, at, count)),
    colW: moveCol(sheet.colW),
    rows: axis === 'row' ? Math.max(5, sheet.rows + count) : sheet.rows,
    cols: axis === 'col' ? Math.min(52, Math.max(1, sheet.cols + count)) : sheet.cols,
  }
}

/* ─────────────── Autosuma ─────────────── */

/** Rango de números contiguos encima (o, si no hay, a la izquierda) de una celda. */
export function autoSumRange(res: SheetResult, at: { r: number; c: number }): Bounds | null {
  const isNum = (r: number, c: number) => typeof res.get(refOf(c, r)).value === 'number'
  if (at.r > 0 && isNum(at.r - 1, at.c)) {
    let r0 = at.r - 1
    while (r0 > 0 && isNum(r0 - 1, at.c)) r0--
    return { r0, r1: at.r - 1, c0: at.c, c1: at.c }
  }
  if (at.c > 0 && isNum(at.r, at.c - 1)) {
    let c0 = at.c - 1
    while (c0 > 0 && isNum(at.r, c0 - 1)) c0--
    return { r0: at.r, r1: at.r, c0, c1: at.c - 1 }
  }
  return null
}

/** Explicación sencilla de un error (para la barra de fórmulas). */
export function errorHelp(code: string, es: boolean): string {
  const m: Record<string, [string, string]> = {
    '#DIV/0!': ['División entre cero (o una celda vacía usada como divisor).', 'Division by zero (or an empty cell used as a divisor).'],
    '#NAME?': ['Nombre desconocido: revisa la función o la variable (¿falta una comilla en un texto?).', 'Unknown name: check the function or variable (missing quotes around a text?).'],
    '#VALUE!': ['Tipo de dato incorrecto: por ejemplo, un texto donde se esperaba un número.', 'Wrong data type: e.g. a text where a number was expected.'],
    '#REF!': ['Referencia no válida: la celda fue eliminada o está fuera de la hoja.', 'Invalid reference: the cell was deleted or is outside the sheet.'],
    '#N/A': ['No se encontró el valor buscado.', 'The value was not found.'],
    '#NUM!': ['Problema numérico: resultado no válido o el método no converge.', 'Numeric problem: invalid result or the method does not converge.'],
    '#CIRC!': ['Referencia circular: la fórmula depende de sí misma.', 'Circular reference: the formula depends on itself.'],
    '#ERROR!': ['Fórmula mal escrita (paréntesis, operadores o separadores).', 'Malformed formula (parentheses, operators or separators).'],
  }
  const t = m[code]
  return t ? (es ? t[0] : t[1]) : ''
}
