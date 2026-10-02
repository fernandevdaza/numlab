// Palabras con bits desconocidos: una plantilla como "0 1000101 001a0b11" (la misma letra es el mismo
// bit) y condiciones sobre el valor representado ("74 < x < 77", "|x| ≥ 2^-8"). Se prueban todas las
// asignaciones de las variables y se marcan las que cumplen todas las condiciones.
import { L } from '../../i18n.ts'
import { parseRational, reduce, type Rational } from './float.ts'
import * as Q from './palabra.ts'

export type Rel = '<' | '<=' | '>' | '>=' | '=' | '!='

export interface Cond {
  /** la condición es sobre |x| */
  abs: boolean
  rel: Rel
  value: Rational
}

export const MAX_VARS = 16

export type PatternResult = { ok: true; chars: string[]; vars: string[] } | { ok: false; error: string }

/** Lee la plantilla: ceros, unos y letras (se ignoran espacios). */
export function parsePattern(src: string, total: number): PatternResult {
  const chars = [...src.replace(/\s+/g, '')]
  const bad = chars.find((c) => !/^[01a-wyzA-WYZ]$/.test(c))
  if (bad) return { ok: false, error: /[xX]/.test(bad) ? L('Usa otra letra: x es el valor representado.', 'Use another letter: x is the represented value.') : L(`Carácter no válido: «${bad}». Usa 0, 1 o letras.`, `Invalid character: “${bad}”. Use 0, 1 or letters.`) }
  if (chars.length !== total) return { ok: false, error: L(`La palabra debe tener ${total} posiciones (tiene ${chars.length}).`, `The word must have ${total} positions (it has ${chars.length}).`) }
  const vars = [...new Set(chars.filter((c) => !/[01]/.test(c)))]
  if (vars.length > MAX_VARS) return { ok: false, error: L(`Demasiadas variables (${vars.length}); el máximo es ${MAX_VARS}.`, `Too many variables (${vars.length}); the maximum is ${MAX_VARS}.`) }
  return { ok: true, chars, vars }
}

/** Número exacto: decimal, fracción (1/3) o potencia (2^-8, -2^(3)). */
export function parseExactNumber(src: string): Rational | null {
  const s = src.trim().replace(/\s+/g, '').replace(/[−–]/g, '-')
  const r = parseRational(s)
  if (r) return r
  const m = s.match(/^([+-])?(\d+)\^\(?([+-]?\d+)\)?$/)
  if (!m) return null
  const b = BigInt(m[2]), e = Number(m[3])
  if (Math.abs(e) > 2000) return null
  const p = e >= 0 ? { num: b ** BigInt(e), den: 1n } : { num: 1n, den: b ** BigInt(-e) }
  if (p.den === 0n) return null
  return reduce(m[1] === '-' ? { num: -p.num, den: p.den } : p)
}

const REL: Record<string, Rel> = { '<': '<', '<=': '<=', '≤': '<=', '>': '>', '>=': '>=', '≥': '>=', '=': '=', '==': '=', '!=': '!=', '≠': '!=' }
const FLIP: Record<Rel, Rel> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '=': '=', '!=': '!=' }

/** Lee las condiciones separadas por «;» o saltos de línea. Admite cadenas: «74 < x < 77». */
export function parseConds(src: string): { conds: Cond[]; errors: string[] } {
  const conds: Cond[] = [], errors: string[] = []
  for (const raw of src.split(/[;\n]/)) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split(/(<=|>=|==|!=|≤|≥|≠|<|>|=)/).map((p) => p.trim())
    // parts = [A, op, B] o [A, op, B, op, C]
    const isX = (p: string) => /^(x|\|\s*x\s*\|)$/i.test(p)
    const fail = () => errors.push(L(`No entiendo «${line}». Ejemplos: x < 5e-3 · 74 < x < 77 · |x| ≥ 2^-8`, `Can't read “${line}”. Examples: x < 5e-3 · 74 < x < 77 · |x| ≥ 2^-8`))
    if (parts.length !== 3 && parts.length !== 5) { fail(); continue }
    const xi = parts.findIndex((p, i) => i % 2 === 0 && isX(p))
    if (xi < 0) { fail(); continue }
    const abs = parts[xi].includes('|')
    const add = (rel: Rel, numSrc: string) => {
      const v = parseExactNumber(numSrc)
      if (!v) { fail(); return false }
      conds.push({ abs, rel, value: v })
      return true
    }
    if (parts.length === 3) {
      if (xi === 0) add(REL[parts[1]], parts[2])
      else add(FLIP[REL[parts[1]]], parts[0])
    } else {
      if (xi !== 2) { fail(); continue }
      if (add(FLIP[REL[parts[1]]], parts[0])) add(REL[parts[3]], parts[4])
    }
  }
  return { conds, errors }
}

/** −1, 0, 1 según a ⋚ b. */
function cmp(a: Rational, b: Rational): number {
  const d = a.num * b.den - b.num * a.den
  return d < 0n ? -1 : d > 0n ? 1 : 0
}

/** ¿El valor leído cumple la condición? (∞ se compara como mayor que todo; NaN nunca cumple). */
export function check(d: Q.Decoded, c: Cond): boolean {
  if (d.kind === 'NaN') return false
  let s: number
  if (d.kind === 'infinito') s = c.abs || !d.sign ? 1 : -1
  else s = cmp(c.abs && d.value.num < 0n ? { num: -d.value.num, den: d.value.den } : d.value, c.value)
  switch (c.rel) {
    case '<': return s < 0
    case '<=': return s <= 0
    case '>': return s > 0
    case '>=': return s >= 0
    case '=': return s === 0
    case '!=': return s !== 0
  }
}

export interface Row {
  values: (0 | 1)[]
  bits: string
  d: Q.Decoded
  checks: boolean[]
  ok: boolean
}

/** Todas las asignaciones (la primera variable es el bit más significativo del contador). */
export function solve(chars: string[], vars: string[], conds: Cond[], M: Q.Machine): Row[] {
  const k = vars.length
  const idx = new Map(vars.map((v, i) => [v, i]))
  const rows: Row[] = []
  for (let mask = 0; mask < 1 << k; mask++) {
    const values = vars.map((_, i) => ((mask >> (k - 1 - i)) & 1) as 0 | 1)
    const bits = chars.map((c) => (c === '0' || c === '1' ? c : String(values[idx.get(c)!]))).join('')
    const d = Q.decode(bits, M)
    const checks = conds.map((c) => check(d, c))
    rows.push({ values, bits, d, checks, ok: checks.every(Boolean) })
  }
  return rows
}

/** Valor que toma cada variable en las soluciones: 0, 1 o «ambos». */
export function forced(rows: Row[], vars: string[]): ('0' | '1' | 'libre')[] {
  const sol = rows.filter((r) => r.ok)
  return vars.map((_, i) => {
    const vs = new Set(sol.map((r) => r.values[i]))
    return vs.size === 1 ? (vs.has(1) ? '1' : '0') : 'libre'
  })
}

/** Contribución de los bits fijos y peso de cada variable en un campo (posiciones [from, to) de la palabra). */
export function fieldWeights(chars: string[], from: number, to: number, vars: string[]): { fixed: bigint; weights: { v: string; pow: number }[] } {
  const n = to - from
  let fixed = 0n
  const weights: { v: string; pow: number }[] = []
  for (let i = from; i < to; i++) {
    const pow = n - 1 - (i - from)
    const c = chars[i]
    if (c === '1') fixed += 1n << BigInt(pow)
    else if (c !== '0' && vars.includes(c)) weights.push({ v: c, pow })
  }
  return { fixed, weights }
}
