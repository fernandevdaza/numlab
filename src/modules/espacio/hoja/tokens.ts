// Tokenizador de fórmulas de la hoja (para colorear referencias, el modo «apuntar», F4, el
// autocompletado y la traducción a mathjs). Acepta sintaxis en inglés («,» separa argumentos) y en
// español («;» separa argumentos y «,» es el separador decimal).
// Adaptado de las ideas del editor de fórmulas de OpenRiskSim (mismo autor).

export type TokType = 'eq' | 'ws' | 'op' | 'lparen' | 'rparen' | 'sep' | 'number' | 'string' | 'bool' | 'error' | 'ref' | 'func' | 'name' | 'other'

export interface RefPart {
  col: number
  /** −1 en referencias a columnas completas (A:A) */
  row: number
  colAbs: boolean
  rowAbs: boolean
}

export interface RefInfo {
  kind: 'cell' | 'range' | 'cols'
  a: RefPart
  b?: RefPart
}

export interface Token {
  type: TokType
  text: string
  start: number
  end: number
  ref?: RefInfo
}

export interface Bounds {
  r0: number
  c0: number
  r1: number
  c1: number
}

export const MAX_ROW = 99999

const ERRORS = ['#DIV/0!', '#NAME?', '#VALUE!', '#REF!', '#NUM!', '#N/A', '#CIRC!', '#NULL!', '#¡DIV/0!', '#¿NOMBRE?', '#¡VALOR!', '#¡REF!', '#¡NUM!', '#N/D', '#¡CIRC!']
const BOOLS = new Set(['TRUE', 'FALSE', 'VERDADERO', 'FALSO'])

const CELL = '(\\$?)([A-Za-z]{1,2})(\\$?)(\\d{1,5})'
const COLP = '(\\$?)([A-Za-z]{1,2})'
const BOUNDARY = '(?![\\p{L}\\p{N}_.(!$])'
const RE_CELLRANGE = new RegExp(`${CELL}(?::${CELL})?${BOUNDARY}`, 'uy')
const RE_COLRANGE = new RegExp(`${COLP}:${COLP}${BOUNDARY}`, 'uy')
const RE_IDENT = /[\p{L}_][\p{L}\p{N}_.]*/uy
const RE_WS = /[ \t\r\n]+/y
const RE_NUM_EN = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y
const RE_NUM_ES = /(?:\d+(?:[.,]\d+)?|\.\d+)(?:[eE][+-]?\d+)?/y

export function colLetter(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
export function colIndex(letters: string): number {
  let n = 0
  for (const c of letters.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

function matchRef(text: string, i: number): { len: number; ref: RefInfo } | null {
  RE_CELLRANGE.lastIndex = i
  let m = RE_CELLRANGE.exec(text)
  if (m) {
    const a: RefPart = { col: colIndex(m[2]), row: Number(m[4]) - 1, colAbs: m[1] === '$', rowAbs: m[3] === '$' }
    if (a.row >= 0 && a.col <= 701) {
      if (m[6] === undefined) return { len: m[0].length, ref: { kind: 'cell', a } }
      const b: RefPart = { col: colIndex(m[6]), row: Number(m[8]) - 1, colAbs: m[5] === '$', rowAbs: m[7] === '$' }
      if (b.row >= 0) return { len: m[0].length, ref: { kind: 'range', a, b } }
    }
  }
  RE_COLRANGE.lastIndex = i
  m = RE_COLRANGE.exec(text)
  if (m) {
    return {
      len: m[0].length,
      ref: { kind: 'cols', a: { col: colIndex(m[2]), row: -1, colAbs: m[1] === '$', rowAbs: false }, b: { col: colIndex(m[4]), row: -1, colAbs: m[3] === '$', rowAbs: false } },
    }
  }
  return null
}

/**
 * ¿La fórmula usa la sintaxis en español? Sí si separa argumentos con «;», o si tiene una coma
 * entre dígitos fuera de todo paréntesis («=2,5*2»: ahí no puede ser un separador).
 */
export function usesSpanishSyntax(text: string): boolean {
  let inStr = false
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') inStr = !inStr
    else if (inStr) continue
    else if (ch === ';') return true
    else if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0 && /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')) return true
  }
  return false
}

/** Divide una fórmula (con o sin «=») en tokens. Nunca lanza. */
export function tokenize(text: string, es = usesSpanishSyntax(text)): Token[] {
  const out: Token[] = []
  const n = text.length
  let i = 0
  const push = (type: TokType, len: number, ref?: RefInfo) => {
    const t: Token = { type, text: text.slice(i, i + len), start: i, end: i + len }
    if (ref) t.ref = ref
    out.push(t)
    i += len
  }
  if (text.startsWith('=')) push('eq', 1)
  while (i < n) {
    const ch = text[i]
    RE_WS.lastIndex = i
    const ws = RE_WS.exec(text)
    if (ws) {
      push('ws', ws[0].length)
      continue
    }
    if (ch === '"') {
      let j = i + 1
      while (j < n) {
        if (text[j] === '"') {
          if (text[j + 1] === '"') j += 2
          else break
        } else j++
      }
      push('string', Math.min(n, j + 1) - i)
      continue
    }
    if (ch === '#') {
      const up = text.slice(i, i + 10).toUpperCase()
      const err = ERRORS.find((e) => up.startsWith(e))
      push(err ? 'error' : 'other', err ? err.length : 1)
      continue
    }
    if (ch === '(') {
      push('lparen', 1)
      continue
    }
    if (ch === ')') {
      push('rparen', 1)
      continue
    }
    if (ch === '$' || /[A-Za-z]/.test(ch)) {
      const prev = out[out.length - 1]
      if (!(prev && prev.end === i && (prev.type === 'name' || prev.type === 'number'))) {
        const r = matchRef(text, i)
        if (r) {
          push('ref', r.len, r.ref)
          continue
        }
      }
    }
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(text[i + 1] ?? ''))) {
      const re = es ? RE_NUM_ES : RE_NUM_EN
      re.lastIndex = i
      const m = re.exec(text)
      if (m && m[0].length) {
        push('number', m[0].length)
        continue
      }
    }
    if (ch === ',' || ch === ';') {
      push('sep', 1)
      continue
    }
    RE_IDENT.lastIndex = i
    const id = RE_IDENT.exec(text)
    if (id) {
      const word = id[0]
      let k = i + word.length
      while (text[k] === ' ') k++
      if (text[k] === '(') push('func', word.length)
      else if (BOOLS.has(word.toUpperCase())) push('bool', word.length)
      else push('name', word.length)
      continue
    }
    const two = text.slice(i, i + 2)
    if (['<=', '>=', '<>', '==', '!='].includes(two)) {
      push('op', 2)
      continue
    }
    if ('+-*/^&=<>%:'.includes(ch)) {
      push('op', 1)
      continue
    }
    push('other', 1)
  }
  return out
}

/* ─────────────── referencias ─────────────── */

function partText(p: RefPart): string {
  return (p.colAbs ? '$' : '') + colLetter(p.col) + (p.row >= 0 ? (p.rowAbs ? '$' : '') + (p.row + 1) : '')
}
export function refToText(ref: RefInfo): string {
  return partText(ref.a) + (ref.b ? ':' + partText(ref.b) : '')
}
export function boundsText(b: Bounds): string {
  const a = colLetter(b.c0) + (b.r0 + 1)
  return b.r0 === b.r1 && b.c0 === b.c1 ? a : `${a}:${colLetter(b.c1)}${b.r1 + 1}`
}
export function refBounds(ref: RefInfo, rows = MAX_ROW): Bounds {
  const a = ref.a, b = ref.b ?? ref.a
  if (ref.kind === 'cols') return { r0: 0, r1: rows - 1, c0: Math.min(a.col, b.col), c1: Math.max(a.col, b.col) }
  return { r0: Math.min(a.row, b.row), r1: Math.max(a.row, b.row), c0: Math.min(a.col, b.col), c1: Math.max(a.col, b.col) }
}
/** «B3» o «A1:C4» → límites. */
export function parseBounds(s: string): Bounds | null {
  const t = tokenize(s.trim().toUpperCase(), false)
  if (t.length !== 1 || t[0].type !== 'ref' || !t[0].ref || t[0].ref.kind === 'cols') return null
  return refBounds(t[0].ref)
}

export interface FormulaRef {
  start: number
  end: number
  bounds: Bounds
  color: number
}

/** Referencias de una fórmula con su color (la misma referencia → el mismo color, como en Excel). */
export function formulaRefs(text: string, rows = MAX_ROW): FormulaRef[] {
  if (!text.startsWith('=')) return []
  const keys = new Map<string, number>()
  const out: FormulaRef[] = []
  for (const t of tokenize(text)) {
    if (t.type !== 'ref' || !t.ref) continue
    const b = refBounds(t.ref, rows)
    const key = `${b.r0},${b.c0},${b.r1},${b.c1}`
    let color = keys.get(key)
    if (color === undefined) keys.set(key, (color = keys.size))
    out.push({ start: t.start, end: t.end, bounds: b, color })
  }
  return out
}

export const REF_COLORS = ['#2563eb', '#dc2626', '#9333ea', '#16a34a', '#d97706', '#db2777', '#0891b2', '#65a30d']
export const REF_COLORS_DARK = ['#60a5fa', '#f87171', '#c084fc', '#4ade80', '#fbbf24', '#f472b6', '#22d3ee', '#a3e635']
export const refColor = (i: number, dark: boolean) => (dark ? REF_COLORS_DARK : REF_COLORS)[i % 8]

/** F4: A1 → $A$1 → A$1 → $A1 → A1 en la referencia bajo el cursor. */
export function cycleReference(text: string, caret: number): { text: string; start: number; end: number } | null {
  const toks = tokenize(text)
  const tok = toks.find((t) => t.type === 'ref' && t.start < caret && caret <= t.end) ?? toks.find((t) => t.type === 'ref' && t.start === caret)
  if (!tok?.ref) return null
  const r = tok.ref
  const next = (p: RefPart) => (!p.colAbs && !p.rowAbs ? { colAbs: true, rowAbs: true } : p.colAbs && p.rowAbs ? { colAbs: false, rowAbs: true } : !p.colAbs && p.rowAbs ? { colAbs: true, rowAbs: false } : { colAbs: false, rowAbs: false })
  let ref: RefInfo
  if (r.kind === 'cols') {
    const abs = !r.a.colAbs
    ref = { ...r, a: { ...r.a, colAbs: abs }, b: { ...r.b!, colAbs: abs } }
  } else {
    const nx = next(r.a)
    ref = { ...r, a: { ...r.a, ...nx }, b: r.b ? { ...r.b, ...nx } : undefined }
  }
  const s = refToText(ref)
  return { text: text.slice(0, tok.start) + s + text.slice(tok.end), start: tok.start, end: tok.start + s.length }
}

/* ─────────────── contexto del cursor ─────────────── */

export interface CaretContext {
  /** función más interna que contiene el cursor y el número de argumento */
  fn: { name: string; argIndex: number } | null
  /** se puede insertar una referencia en el cursor (modo «apuntar») */
  canInsertRef: boolean
  /** identificador que se está escribiendo (para autocompletar) */
  ident: { text: string; start: number; end: number } | null
}

const operandStart = (t: Token | undefined) => !t || t.type === 'eq' || t.type === 'lparen' || t.type === 'sep' || (t.type === 'op' && t.text !== '%')

export function caretContext(text: string, caret: number): CaretContext {
  const res: CaretContext = { fn: null, canInsertRef: false, ident: null }
  if (!text.startsWith('=') || caret < 1) return res
  const toks = tokenize(text)
  const stack: { name: string | null; argIndex: number }[] = []
  let prevSig: Token | undefined, inside: Token | undefined, atCaret: Token | undefined, endingAt: Token | undefined
  let lastFunc: Token | null = null
  for (const t of toks) {
    if (t.start >= caret) {
      if (t.start === caret) atCaret = t
      break
    }
    if (t.end > caret) {
      inside = t
      break
    }
    if (t.end === caret) endingAt = t
    if (t.type !== 'ws') prevSig = t
    if (t.type === 'func') lastFunc = t
    else if (t.type === 'lparen') {
      stack.push({ name: lastFunc ? lastFunc.text : null, argIndex: 0 })
      lastFunc = null
    } else if (t.type === 'sep') {
      if (stack.length) stack[stack.length - 1].argIndex++
    } else if (t.type === 'rparen') stack.pop()
    else if (t.type !== 'ws') lastFunc = null
  }
  for (let k = stack.length - 1; k >= 0; k--)
    if (stack[k].name) {
      res.fn = { name: stack[k].name!, argIndex: stack[k].argIndex }
      break
    }
  if (!inside) {
    const nextOk = !atCaret || atCaret.type === 'ws' || atCaret.type === 'rparen' || atCaret.type === 'sep' || (atCaret.type === 'op' && atCaret.text !== ':')
    res.canInsertRef = operandStart(prevSig) && nextOk
  }
  const idTok = inside ?? endingAt
  if (idTok && (idTok.type === 'name' || idTok.type === 'bool' || idTok.type === 'func' || (idTok.type === 'ref' && idTok.ref?.kind === 'cell' && !idTok.text.includes('$')))) {
    const before = toks[toks.indexOf(idTok) - 1]
    const typed = text.slice(idTok.start, caret)
    if (operandStart(before) && /^[\p{L}_]/u.test(typed) && text[idTok.end] !== '(') res.ident = { text: typed, start: idTok.start, end: idTok.end }
  }
  return res
}

/** Paréntesis sin cerrar (Excel los cierra al confirmar). */
export function missingParens(text: string): number {
  let d = 0
  for (const t of tokenize(text)) {
    if (t.type === 'lparen') d++
    else if (t.type === 'rparen') d = Math.max(0, d - 1)
  }
  return d
}

/* ─────────────── mover referencias ─────────────── */

/**
 * Desplaza las referencias relativas (copiar, rellenar). Las partes con $ no cambian; una
 * referencia que sale de la hoja se vuelve #REF!.
 */
export function shiftFormula(text: string, dr: number, dc: number): string {
  if (!text.startsWith('=') || (dr === 0 && dc === 0)) return text
  let out = ''
  for (const t of tokenize(text)) {
    if (t.type !== 'ref' || !t.ref) {
      out += t.text
      continue
    }
    const mv = (p: RefPart): RefPart | null => {
      const q = { ...p, col: p.colAbs ? p.col : p.col + dc, row: p.row < 0 || p.rowAbs ? p.row : p.row + dr }
      return q.col < 0 || (p.row >= 0 && q.row < 0) ? null : q
    }
    const a = mv(t.ref.a), b = t.ref.b ? mv(t.ref.b) : undefined
    out += !a || b === null ? '#REF!' : refToText({ ...t.ref, a, b: b ?? undefined })
  }
  return out
}

/**
 * Insertar (count > 0) o eliminar (count < 0) filas o columnas en `at`: ajusta todas las
 * referencias (también las absolutas), como Excel. Una celda eliminada a la que se apunta → #REF!.
 */
export function adjustForInsert(text: string, axis: 'row' | 'col', at: number, count: number): string {
  if (!text.startsWith('=')) return text
  const key = axis === 'row' ? 'row' : 'col'
  const delEnd = at - count // fin (exclusivo) de lo eliminado cuando count < 0
  let out = ''
  for (const t of tokenize(text)) {
    if (t.type !== 'ref' || !t.ref || (axis === 'row' && t.ref.kind === 'cols')) {
      out += t.text
      continue
    }
    const r = t.ref
    const fix = (p: RefPart, isEnd: boolean): RefPart | null => {
      const v = p[key]
      if (count > 0) return v >= at ? { ...p, [key]: v + count } : p
      if (v < at) return p
      if (v >= delEnd) return { ...p, [key]: v + count }
      // dentro de lo eliminado
      if (!r.b) return null
      return { ...p, [key]: isEnd ? at - 1 : at }
    }
    const a = fix(r.a, false), b = r.b ? fix(r.b, true) : undefined
    if (!a || b === null || (b && b[key] < a[key])) out += '#REF!'
    else out += refToText({ ...r, a, b: b ?? undefined })
  }
  return out
}

/** Mueve las referencias que apuntan dentro de `src` (cortar y pegar): cambian a la nueva posición. */
export function moveRefs(text: string, src: Bounds, dr: number, dc: number): string {
  if (!text.startsWith('=')) return text
  const inside = (p: RefPart) => p.row >= src.r0 && p.row <= src.r1 && p.col >= src.c0 && p.col <= src.c1
  let out = ''
  for (const t of tokenize(text)) {
    const r = t.ref
    if (t.type !== 'ref' || !r || r.kind === 'cols' || !inside(r.a) || (r.b && !inside(r.b))) {
      out += t.text
      continue
    }
    const mv = (p: RefPart): RefPart => ({ ...p, row: p.row + dr, col: p.col + dc })
    out += refToText({ ...r, a: mv(r.a), b: r.b ? mv(r.b) : undefined })
  }
  return out
}
