// Motor de la calculadora CAS: interpreta líneas de comandos y devuelve resultados en TeX.
// Numérico con mathjs (instancia propia) y simbólico con nerdamer.
import { create, all, type MathNode } from 'mathjs'
import nerdamer from 'nerdamer'
import 'nerdamer/Algebra'
import 'nerdamer/Calculus'
import 'nerdamer/Solve'
import { texMatrix } from '../../components/ui'
import { fmt, texNum } from '../../lib/format'
import { eigenvalues, solve as linSolve, type Complex } from '../sistemas/linalg'
import { integrateNumeric, numericRoots } from './numerico'
import { L, LANG } from '../../i18n'
import { cleanPasted, texToPlain, unicodeToPlain } from '../../lib/pegar'
import { installExtras } from '../../lib/extras'

export { integrateNumeric, numericRoots }

/* ───────────────────────── Instancia de mathjs propia ───────────────────────── */

export const M = create(all, { number: 'number' })
installExtras(M)
M.import(
  {
    ln: (x: number) => Math.log(x),
    sen: (x: number) => Math.sin(x),
    tg: (x: number) => Math.tan(x),
    arcsen: (x: number) => Math.asin(x),
    arccos: (x: number) => Math.acos(x),
    arctan: (x: number) => Math.atan(x),
    arctg: (x: number) => Math.atan(x),
  },
  { override: true },
)

/* ───────────────────────── Tipos de salida ───────────────────────── */

export interface PlotFn {
  label: string
  f: (x: number) => number
}

export type Out =
  | { kind: 'tex'; tex: string; note?: string; extra?: string[]; /** resultado en sintaxis de entrada, para copiar */ plain?: string }
  | { kind: 'text'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'plot'; fns: PlotFn[]; a: number; b: number; tex?: string }
  | { kind: 'help' }
  | { kind: 'none' }

interface UserFn {
  params: string[]
  body: string
}

/* ───────────────────────── Utilidades de texto ───────────────────────── */

/** Divide por comas de primer nivel (fuera de (), [], {}). */
export function splitArgs(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++
    if (')]}'.includes(ch)) depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** Si s es "nombre(args)" con el paréntesis que cierra al final, devuelve nombre y args. */
function asCall(s: string): { name: string; args: string[] } | null {
  const m = s.match(/^([A-Za-z_áéíóúñ][\wáéíóúñ]*)\s*\(/)
  if (!m) return null
  let depth = 0
  for (let i = m[0].length - 1; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') {
      depth--
      if (depth === 0) {
        if (i !== s.length - 1) return null
        return { name: m[1], args: splitArgs(s.slice(m[0].length, i)) }
      }
    }
  }
  return null
}

/** Normalización común: sintaxis Scilab, alias en español, ** → ^. */
export function prep(src: string): string {
  let s = /\\[a-zA-Z]|\^\s*\{/.test(src) ? texToPlain(src) : src
  s = unicodeToPlain(s)
  s = s
    .replace(/%pi\b/g, 'pi')
    .replace(/%eps\b/g, '2.220446049250313e-16')
    .replace(/%e\b/g, 'e')
    .replace(/%i\b/g, 'i')
    .replace(/%inf\b/g, 'Infinity')
    .replace(/\*\*/g, '^')
    .replace(/\.\*/g, '*')
    .replace(/\.\//g, '/')
    .replace(/\.\^/g, '^')
    .replace(/\bln\s*\(/g, 'log(')
    .replace(/\bsen\s*\(/g, 'sin(')
    .replace(/\btg\s*\(/g, 'tan(')
    .replace(/\barcsen\s*\(/g, 'asin(')
    .replace(/\barctg\s*\(/g, 'atan(')
    .replace(/\barctan\s*\(/g, 'atan(')
    .replace(/\barccos\s*\(/g, 'acos(')
    .replace(/∞/g, 'Infinity')
    .replace(/\b(inf|infinito|oo)\b/gi, 'Infinity')
    .replace(/π/g, 'pi')
    .trim()
  // matrices estilo Scilab: [1 2; 3 4] → [1, 2; 3, 4]
  s = s.replace(/\[([^\[\]]*)\]/g, (whole, inner: string) => {
    if (inner.includes(',')) return whole
    const rows = inner.split(';').map((r) => r.trim().split(/\s+/).filter(Boolean).join(', '))
    return '[' + rows.join('; ') + ']'
  })
  return s
}

const texFix = (t: string) =>
  t
    .replace(/\\mathrm\{(a)(sin|cos|tan)\}/g, '\\arc$2')
    .replace(/\\mathrm\{(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|exp|arcsin|arccos|arctan)\}/g, '\\$1')
    .replace(/\\mathrm\{log\}/g, '\\ln')
    .replace(/\\mathrm\{atan\}/g, '\\arctan')
    .replace(/\\mathrm\{abs\}\\left\(([^()]*)\\right\)/g, '\\left|$1\\right|')

/** TeX de una expresión en sintaxis mathjs (para mostrar la entrada). */
export function texOf(src: string): string {
  try {
    return M.parse(src)
      .toTex({ parenthesis: 'auto', implicit: 'hide' })
      .replace(/\\mathrm\{log\}/g, '\\ln')
  } catch {
    try {
      return texFix(nerdamer.convertToLaTeX(src))
    } catch {
      return `\\text{${src.replace(/[\\{}]/g, '')}}`
    }
  }
}

const nTex = (e: nerdamer.Expression) => texFix(e.toTeX())

function nDec(e: nerdamer.Expression): string | null {
  try {
    const d = e.evaluate().text('decimals')
    if (/^-?[\d.]+(e[-+]?\d+)?$/i.test(d)) return fmt(Number(d), 14)
    return null
  } catch {
    return null
  }
}

/** Número con formato TeX; complejos incluidos. */
/** Valor en sintaxis de entrada (para copiarlo al editor o a los campos de los módulos). */
export function valuePlain(v: any): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : Number.isNaN(v) ? 'NaN' : v > 0 ? 'Infinity' : '-Infinity'
  if (typeof v === 'boolean') return String(v)
  if (v && v.isComplex) return Math.abs(v.im) < 1e-15 ? valuePlain(v.re) : M.format(v, { precision: 15 })
  if (v && (M.isMatrix(v) || Array.isArray(v))) {
    const arr = M.isMatrix(v) ? (v as any).toArray() : v
    if (Array.isArray(arr[0])) return '[' + (arr as any[][]).map((r) => r.map(valuePlain).join(', ')).join('; ') + ']'
    return '[' + (arr as any[]).map(valuePlain).join(', ') + ']'
  }
  return String(v)
}

function valueTex(v: any): string {
  if (typeof v === 'number') return texNum(v, 14)
  if (typeof v === 'boolean') return v ? L('\\text{verdadero}', '\\text{true}') : L('\\text{falso}', '\\text{false}')
  if (v && v.isComplex) {
    const re = v.re, im = v.im
    if (Math.abs(im) < 1e-15) return texNum(re, 14)
    return `${Math.abs(re) > 1e-15 ? texNum(re, 12) + (im < 0 ? ' - ' : ' + ') : im < 0 ? '-' : ''}${texNum(Math.abs(im), 12)}\\,i`
  }
  if (v && (M.isMatrix(v) || Array.isArray(v))) {
    const arr = M.isMatrix(v) ? (v as any).toArray() : v
    if (!arr.length) return '[\\,]'
    const isNum = (x: any) => typeof x === 'number'
    if (Array.isArray(arr[0])) {
      if ((arr as any[][]).every((r) => r.every(isNum))) return texMatrix(arr as number[][], 8)
      return '\\begin{bmatrix}' + (arr as any[][]).map((r) => r.map(valueTex).join(' & ')).join(' \\\\ ') + '\\end{bmatrix}'
    }
    if ((arr as any[]).every(isNum)) return texMatrix([arr as number[]], 8)
    return '\\left[' + (arr as any[]).map(valueTex).join(',\\ ') + '\\right]'
  }
  if (v && typeof v === 'object' && 'toTex' in v) return v.toTex()
  return `\\text{${String(v)}}`
}

/* ───────────────────────── Álgebra lineal auxiliar ───────────────────────── */

function toMat(v: any): number[][] | null {
  const arr = M.isMatrix(v) ? (v as any).toArray() : v
  if (!Array.isArray(arr) || !arr.length) return null
  const A = Array.isArray(arr[0]) ? arr : [arr]
  if (!A.every((r: any) => Array.isArray(r) && r.length === A[0].length && r.every((x: any) => typeof x === 'number'))) return null
  return A as number[][]
}

function rref(A0: number[][]): { R: number[][]; rank: number; pivots: number[] } {
  const A = A0.map((r) => r.slice())
  const m = A.length, n = A[0].length
  let r = 0
  const pivots: number[] = []
  const tol = 1e-12 * Math.max(1, ...A.flat().map(Math.abs))
  for (let c = 0; c < n && r < m; c++) {
    let p = r
    for (let i = r + 1; i < m; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i
    if (Math.abs(A[p][c]) <= tol) continue
    ;[A[r], A[p]] = [A[p], A[r]]
    const piv = A[r][c]
    for (let j = 0; j < n; j++) A[r][j] /= piv
    for (let i = 0; i < m; i++)
      if (i !== r) {
        const f = A[i][c]
        if (f !== 0) for (let j = 0; j < n; j++) A[i][j] -= f * A[r][j]
      }
    pivots.push(c)
    r++
  }
  for (const row of A) for (let j = 0; j < n; j++) if (Math.abs(row[j]) < tol) row[j] = 0
  return { R: A, rank: r, pivots }
}

/** Vector propio (real) para λ por iteración inversa. */
function eigvec(A: number[][], lam: number): number[] | null {
  const n = A.length
  const shift = lam + 1e-10 * (1 + Math.abs(lam))
  const B = A.map((r, i) => r.map((v, j) => v - (i === j ? shift : 0)))
  let v = Array.from({ length: n }, (_, i) => 1 / Math.sqrt(n) + i * 1e-3)
  for (let it = 0; it < 4; it++) {
    const w = linSolve(B, v)
    if (!w) return null
    const nr = Math.hypot(...w)
    if (!Number.isFinite(nr) || nr === 0) return null
    v = w.map((x) => x / nr)
  }
  // signo: primera componente no nula positiva
  const k = v.findIndex((x) => Math.abs(x) > 1e-12)
  if (k >= 0 && v[k] < 0) v = v.map((x) => -x)
  return v
}

M.import(
  {
    rango: (A: any) => rref(toMat(A) ?? [[0]]).rank,
    rank: (A: any) => rref(toMat(A) ?? [[0]]).rank,
    rref: (A: any) => M.matrix(rref(toMat(A) ?? [[0]]).R),
    inversa: (A: any) => M.inv(A),
    traspuesta: (A: any) => M.transpose(A),
    transpuesta: (A: any) => M.transpose(A),
    traza: (A: any) => M.trace(A),
    inverse: (A: any) => M.inv(A),
    determinante: (A: any) => M.det(A),
    determinant: (A: any) => M.det(A),
    norma: (A: any, p?: any) => (p === undefined ? M.norm(A) : M.norm(A, p)),
    raiz: (x: number) => Math.sqrt(x),
  },
  { override: true },
)

/* ───────────────────────── Comandos simbólicos anidados ───────────────────────── */

const INLINE: Record<string, (args: string[]) => string> = {
  diff: (a) => nerdamer(`diff(${a[0]}, ${a[1] ?? 'x'}, ${a[2] ?? 1})`).toString(),
  integrate: (a) => (a.length >= 4 ? nerdamer(`defint(${a[0]}, ${a[2]}, ${a[3]}, ${a[1]})`).toString() : nerdamer(`integrate(${a[0]}, ${a[1] ?? 'x'})`).toString()),
  simplify: (a) => nerdamer(`simplify(${a[0]})`).toString(),
  expand: (a) => nerdamer(`expand(${a[0]})`).toString(),
  factor: (a) => nerdamer(`factor(${a[0]})`).toString(),
}
/** Nombres (español e inglés) de los comandos que se pueden anidar dentro de otra expresión. */
const INLINE_NAMES = 'derivada|derivar|derivative|diff|integrar|integrate|simplificar|simplify|expandir|expand|factorizar|factor'

/**
 * Reemplaza llamadas simbólicas ANIDADAS (p. ej. graficar(f(x), derivada(f(x), x))) por su resultado,
 * para poder evaluarlas numéricamente con mathjs.
 */
function inlineSymbolic(src: string): string {
  let s = src
  for (let guard = 0; guard < 20; guard++) {
    const re = new RegExp(`\\b(${INLINE_NAMES})\\s*\\(`, 'g')
    let m: RegExpExecArray | null
    let replaced = false
    while ((m = re.exec(s))) {
      const open = m.index + m[0].length - 1
      const close = matchingParen(s, open)
      if (close < 0) break
      const args = splitArgs(s.slice(open + 1, close))
      // resolver primero lo más interno
      if (args.some((a) => new RegExp(`\\b(${INLINE_NAMES})\\s*\\(`).test(a))) {
        const inner = inlineSymbolic(s.slice(open + 1, close))
        s = s.slice(0, open + 1) + inner + s.slice(close)
        replaced = true
        break
      }
      let res: string
      try {
        res = INLINE[CMD[m[1]]](args)
      } catch {
        continue
      }
      if (/\b(integrate|defint|diff)\(/.test(res)) continue
      s = s.slice(0, m.index) + '(' + res + ')' + s.slice(close + 1)
      replaced = true
      break
    }
    if (!replaced) break
  }
  return s
}

function matchingParen(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/* ───────────────────────── Sesión ───────────────────────── */

const factorial = (n: number) => {
  let f = 1
  for (let k = 2; k <= n; k++) f *= k
  return f
}

/**
 * Comandos de la calculadora: cada nombre (en español o en inglés) → nombre canónico.
 * Ambos idiomas funcionan siempre, sea cual sea el idioma de la interfaz.
 */
export const CMD: Record<string, string> = {
  derivada: 'diff', derivar: 'diff', diff: 'diff', derivative: 'diff',
  integrar: 'integrate', integral: 'integrate', integrate: 'integrate',
  simplificar: 'simplify', simplify: 'simplify',
  expandir: 'expand', expand: 'expand',
  factorizar: 'factor', factor: 'factor',
  fracciones_parciales: 'partfrac', partfrac: 'partfrac', partial_fractions: 'partfrac', apart: 'partfrac',
  resolver: 'solve', solve: 'solve',
  resolver_sistema: 'solve_system', sistema: 'solve_system', solve_system: 'solve_system',
  taylor: 'taylor', series: 'taylor',
  limite: 'limit', límite: 'limit', limit: 'limit',
  sumatoria: 'sum', suma: 'sum', sum: 'sum', summation: 'sum',
  graficar: 'plot', plot: 'plot',
  raices: 'roots', raíces: 'roots', roots: 'roots',
  N: 'N', num: 'N', aprox: 'N', approx: 'N',
  eig: 'eig', eigenvalores: 'eig', valores_propios: 'eig', espec: 'eig', spec: 'eig', eigenvalues: 'eig',
  lu: 'lu',
  cond: 'cond',
}
const SYMBOLIC_CMDS = new Set(Object.keys(CMD))

export class Session {
  vars: Record<string, any> = {}
  /** expresiones simbólicas asignadas: g = x^2 + 1 */
  exprs: Record<string, string> = {}
  fns: Record<string, UserFn> = {}

  /** Sustituye funciones de usuario y variables (numéricas o simbólicas), salvo `exclude`. */
  expand(src: string, exclude: string[] = [], depth = 0): string {
    let s = src
    if (depth > 6) return s
    // funciones del usuario
    for (const [name, fn] of Object.entries(this.fns)) {
      let guard = 0
      const re = new RegExp(`(?<![A-Za-z_][A-Za-z0-9_]*)${name}\\s*\\(`)
      let m: RegExpExecArray | null
      while ((m = re.exec(s)) && guard++ < 50) {
        const start = m.index
        let depth2 = 0, end = -1
        for (let i = start + m[0].length - 1; i < s.length; i++) {
          if (s[i] === '(') depth2++
          else if (s[i] === ')') {
            depth2--
            if (depth2 === 0) {
              end = i
              break
            }
          }
        }
        if (end < 0) break
        const args = splitArgs(s.slice(start + m[0].length, end))
        let body = fn.body
        fn.params.forEach((p, i) => {
          body = body.replace(new RegExp(`(?<![A-Za-z_][A-Za-z0-9_]*)${p}(?![A-Za-z0-9_])`, 'g'), `(${args[i] ?? p})`)
        })
        s = s.slice(0, start) + '(' + body + ')' + s.slice(end + 1)
      }
    }
    for (const [name, e] of Object.entries(this.exprs)) {
      if (exclude.includes(name)) continue
      s = s.replace(new RegExp(`(?<![A-Za-z_][A-Za-z0-9_]*)${name}(?![A-Za-z0-9_])(?!\\s*\\()`, 'g'), `(${e})`)
    }
    if (depth < 6 && Object.keys(this.fns).some((n) => new RegExp(`(?<![A-Za-z_][A-Za-z0-9_]*)${n}\\s*\\(`).test(s))) return this.expand(s, exclude, depth + 1)
    return inlineSymbolic(s)
  }

  /** Sustitución de variables numéricas como texto (para nerdamer). */
  numSubs(s: string, exclude: string[] = []): string {
    for (const [name, v] of Object.entries(this.vars)) {
      if (exclude.includes(name) || typeof v !== 'number' || name === 'ans') continue
      s = s.replace(new RegExp(`(?<![A-Za-z_][A-Za-z0-9_]*)${name}(?![A-Za-z0-9_])(?!\\s*\\()`, 'g'), `(${String(v)})`)
    }
    return s
  }

  sym(src: string, exclude: string[] = []): string {
    return this.numSubs(this.expand(prep(src), exclude), exclude)
  }

  /** Scope para mathjs. */
  scope(extra: Record<string, any> = {}): Record<string, any> {
    return { ...this.vars, ...extra }
  }

  compileFn(src: string, v = 'x'): (x: number) => number {
    const code = M.parse(this.expand(prep(src), [v])).compile()
    const sc = this.scope()
    return (x: number) => {
      try {
        const r = code.evaluate({ ...sc, [v]: x })
        return typeof r === 'number' ? r : r && r.isComplex ? (Math.abs(r.im) < 1e-12 ? r.re : NaN) : Number(r)
      } catch {
        return NaN
      }
    }
  }

  num(src: string): number {
    const r = M.evaluate(this.expand(prep(src)), this.scope())
    return typeof r === 'number' ? r : Number(r)
  }

  /** Ejecuta una línea; los resultados TeX llevan también su versión en texto plano (plain). */
  run(line: string): Out {
    const o = this.runRaw(line) as Out & { __value?: any; __sym?: string }
    if (o.kind === 'tex' && o.plain === undefined) {
      try {
        o.plain = o.__value !== undefined ? valuePlain(o.__value) : o.__sym ?? cleanPasted(o.tex)
      } catch {
        /* sin versión en texto */
      }
    }
    return o
  }

  private runRaw(line: string): Out {
    const raw = line.trim()
    try {
      nerdamer.flush()
    } catch {
      /* ignorar */
    }
    if (!raw || raw.startsWith('//') || raw.startsWith('#')) return { kind: 'none' }
    const lower = raw.toLowerCase()
    if (lower === 'ayuda' || lower === 'help' || lower === '?') return { kind: 'help' }
    if (lower === 'vars' || lower === 'variables') return this.listVars()
    try {
      const src = raw.replace(/;\s*$/, '')
      // definición de función: f(x, y) = ...
      const fdef = src.match(/^([A-Za-z_]\w*)\s*\(\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*\)\s*=(?!=)\s*(.+)$/)
      if (fdef) {
        const [, name, ps, body] = fdef
        const params = ps.split(',').map((p) => p.trim())
        this.fns[name] = { params, body: prep(body) }
        delete this.vars[name]
        delete this.exprs[name]
        return { kind: 'tex', tex: `${name}(${params.join(', ')}) := ${texOf(prep(body))}`, note: L('función definida', 'function defined'), plain: prep(body) }
      }
      // asignación: a = ...
      const asg = src.match(/^([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/)
      if (asg) {
        const [, name, rhs] = asg
        const res = this.evaluate(rhs)
        if (res.kind === 'error') return res
        const val = (res as any).__value
        delete this.fns[name]
        if (val !== undefined) {
          this.vars[name] = val
          delete this.exprs[name]
          return { kind: 'tex', tex: `${name} = ${valueTex(val)}`, plain: valuePlain(val) }
        }
        const symVal = (res as any).__sym as string | undefined
        if (symVal) {
          this.exprs[name] = symVal
          delete this.vars[name]
          return { kind: 'tex', tex: `${name} = ${(res as any).__symTex ?? texOf(symVal)}`, note: L('expresión simbólica guardada', 'symbolic expression stored'), plain: symVal }
        }
        return res
      }
      return this.evaluate(src)
    } catch (e: any) {
      return { kind: 'error', text: traducir(e?.message ?? String(e)) }
    }
  }

  listVars(): Out {
    const lines: string[] = []
    for (const [k, v] of Object.entries(this.vars)) lines.push(`${k} = ${valueTex(v)}`)
    for (const [k, v] of Object.entries(this.exprs)) lines.push(`${k} = ${texOf(v)}`)
    for (const [k, f] of Object.entries(this.fns)) lines.push(`${k}(${f.params.join(',')}) = ${texOf(f.body)}`)
    if (!lines.length) return { kind: 'text', text: L('No hay variables definidas.', 'No variables defined.') }
    return { kind: 'tex', tex: '\\begin{array}{l}' + lines.join('\\\\ ') + '\\end{array}' }
  }

  /** Evalúa una expresión o comando (sin asignación). */
  evaluate(src0: string): Out & { __value?: any; __sym?: string; __symTex?: string } {
    const src = prep(src0)
    const call = asCall(src)
    if (call && SYMBOLIC_CMDS.has(call.name) && !this.fns[call.name] && !((call.name === 'sum' || call.name === 'suma') && call.args.length !== 4)) return this.command(call.name, call.args)
    // numérico con mathjs
    const expanded = this.expand(src)
    try {
      const v = M.evaluate(expanded, this.scope())
      if (typeof v === 'function') return { kind: 'text', text: L('función', 'function') }
      if (v && v.entries && Array.isArray(v.entries)) {
        const last = v.entries[v.entries.length - 1]
        this.vars.ans = last
        return { kind: 'tex', tex: v.entries.map(valueTex).join(',\\quad '), __value: last }
      }
      if (typeof v === 'number' || (v && (v.isComplex || M.isMatrix(v))) || typeof v === 'boolean') {
        this.vars.ans = v
        let lhs = ''
        try {
          lhs = texOf(src) + ' = '
        } catch {
          lhs = ''
        }
        // resultado exacto con nerdamer si la entrada tiene fracciones o raíces
        let extra: string[] | undefined
        if (typeof v === 'number' && /[/]|sqrt|pi/.test(src) && !/[[\]]/.test(src)) {
          try {
            const ex = nerdamer(this.sym(src))
            const t = nTex(ex)
            if (!/^-?[\d.]+$/.test(ex.toString()) || ex.toString().includes('/')) extra = [L('\\text{exacto: } ', '\\text{exact: } ') + t]
          } catch {
            /* sin forma exacta */
          }
        }
        return { kind: 'tex', tex: lhs + valueTex(v), extra, __value: v }
      }
      if (typeof v === 'string') return { kind: 'text', text: v }
      if (v === undefined) return { kind: 'none' }
      return { kind: 'tex', tex: valueTex(v), __value: v }
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      if (!/Undefined (symbol|function)/i.test(msg)) return { kind: 'error', text: traducir(msg) }
    }
    // simbólico
    const ex = nerdamer(this.sym(src))
    const tex = nTex(ex)
    const inTex = texOf(expanded)
    return { kind: 'tex', tex: inTex === tex ? tex : `${inTex} = ${tex}`, __sym: ex.toString(), __symTex: tex }
  }

  command(name: string, args: string[]): Out {
    const needs = (k: number, usage: string) => {
      if (args.length < k) throw new Error(L('Uso: ', 'Usage: ') + name + usage)
    }
    const v = (i: number, def = 'x') => (args[i] ?? def).trim()
    switch (CMD[name] ?? name) {
      case 'diff': {
        needs(1, '(expr, x, n)')
        const x = v(1)
        const n = args[2] ? Math.round(this.num(args[2])) : 1
        const e = this.sym(args[0], [x])
        const r = nerdamer(`diff(${e}, ${x}, ${n})`)
        const lhs = n === 1 ? `\\frac{d}{d${x}}` : `\\frac{d^{${n}}}{d${x}^{${n}}}`
        return { kind: 'tex', tex: `${lhs}\\left(${texOf(this.expand(prep(args[0]), [x]))}\\right) = ${nTex(r)}`, __sym: r.toString(), __symTex: nTex(r) } as any
      }
      case 'integrate': {
        needs(1, `(expr, x) ${L('o', 'or')} ${name}(expr, x, a, b)`)
        const x = v(1)
        const e = this.sym(args[0], [x])
        const inTex = texOf(this.expand(prep(args[0]), [x]))
        if (args.length >= 4) {
          const a = this.num(args[2]), b = this.num(args[3])
          const f = this.compileFn(args[0], x)
          const numeric = integrateNumeric(f, a, b)
          let exact: string | null = null
          let exactPlain: string | undefined
          try {
            const r = nerdamer(`defint(${e}, ${this.sym(args[2])}, ${this.sym(args[3])}, ${x})`)
            const rs = r.toString()
            // nerdamer a veces devuelve una aproximación racional (p. ej. 33038016/46384475): no es "exacta"
            if (!rs.includes('defint') && !/^-?\d{6,}\/\d{6,}$/.test(rs)) {
              exact = nTex(r)
              exactPlain = rs
            }
          } catch {
            /* sin forma cerrada */
          }
          const tex = `\\int_{${texOf(prep(args[2]))}}^{${texOf(prep(args[3]))}} ${inTex}\\,d${x} = ${exact && exact !== texNum(numeric, 14) ? exact + ' \\approx ' : ''}${texNum(numeric, 14)}`
          this.vars.ans = numeric
          return { kind: 'tex', tex, note: exact ? undefined : L('valor numérico (Simpson adaptativo)', 'numerical value (adaptive Simpson)'), plain: exactPlain ?? String(numeric) }
        }
        const r = nerdamer(`integrate(${e}, ${x})`)
        if (r.toString().includes('integrate(')) return { kind: 'tex', tex: `\\int ${inTex}\\,d${x}`, note: L(`No se encontró una primitiva en forma cerrada. Prueba la integral definida: ${name}(expr, x, a, b).`, `No closed-form antiderivative found. Try the definite integral: ${name}(expr, x, a, b).`) }
        return { kind: 'tex', tex: `\\int ${inTex}\\,d${x} = ${nTex(r)} + C`, __sym: r.toString(), __symTex: nTex(r) } as any
      }
      case 'simplify': {
        needs(1, '(expr)')
        const r = nerdamer(`simplify(${this.sym(args[0])})`)
        return { kind: 'tex', tex: `${texOf(this.expand(prep(args[0])))} = ${nTex(r)}`, __sym: r.toString(), __symTex: nTex(r) } as any
      }
      case 'expand': {
        needs(1, '(expr)')
        const r = nerdamer(`expand(${this.sym(args[0])})`)
        return { kind: 'tex', tex: `${texOf(this.expand(prep(args[0])))} = ${nTex(r)}`, __sym: r.toString(), __symTex: nTex(r) } as any
      }
      case 'factor': {
        needs(1, '(expr)')
        const r = nerdamer(`factor(${this.sym(args[0])})`)
        return { kind: 'tex', tex: `${texOf(this.expand(prep(args[0])))} = ${nTex(r)}`, __sym: r.toString(), __symTex: nTex(r) } as any
      }
      case 'partfrac': {
        needs(1, '(expr, x)')
        const x = v(1)
        const r = nerdamer(`partfrac(${this.sym(args[0], [x])}, ${x})`)
        return { kind: 'tex', tex: `${texOf(this.expand(prep(args[0]), [x]))} = ${nTex(r)}` }
      }
      case 'solve': {
        needs(1, L('(ecuación, x)', '(equation, x)'))
        const x = v(1)
        const eq = this.sym(args[0], [x])
        let sols: string[] = []
        try {
          const r: any = nerdamer(`solve(${eq}, ${x})`)
          sols = (r.symbol?.elements ?? []).map((s: any) => s.toString())
        } catch {
          sols = []
        }
        const eqTex = eq.includes('=') ? eq.split('=').map((p) => texOf(p)).join(' = ') : texOf(eq) + ' = 0'
        if (!sols.length) {
          // numérico
          const [lhs, rhs = '0'] = eq.split('=')
          const f = this.compileFn(`(${lhs}) - (${rhs})`, x)
          const roots = numericRoots(f, -100, 100, 20000)
          if (!roots.length) return { kind: 'tex', tex: eqTex, note: L('Sin soluciones simbólicas ni raíces reales en [−100, 100].', 'No symbolic solutions and no real roots in [−100, 100].') }
          return { kind: 'tex', tex: `${eqTex}\\;\\Rightarrow\\; ${roots.map((r) => `${x} \\approx ${texNum(r, 12)}`).join(',\\quad ')}`, note: L('raíces numéricas en [−100, 100]', 'numerical roots in [−100, 100]') }
        }
        const items = sols.map((s) => {
          const e = nerdamer(s)
          const t = nTex(e)
          const d = nDec(e)
          const isApproxRational = /^-?\d{6,}\/\d{6,}$/.test(s)
          return { t: isApproxRational && d ? d : t, d: !isApproxRational && d && d !== t ? d : null, num: d !== null ? Number(d.replace(/\s/g, '')) : NaN }
        })
        items.sort((p, q) => (Number.isFinite(p.num) && Number.isFinite(q.num) ? Math.abs(p.num) - Math.abs(q.num) : 0))
        // quitar duplicados numéricos (nerdamer devuelve aproximaciones racionales repetidas)
        const uniq = items.filter((it, i) => !Number.isFinite(it.num) || !items.slice(0, i).some((o) => Number.isFinite(o.num) && Math.abs(o.num - it.num) <= 1e-9 * (1 + Math.abs(it.num))))
        items.length = 0
        items.push(...uniq)
        const shown = items.slice(0, 12)
        return {
          kind: 'tex',
          tex: `${eqTex}\\;\\Rightarrow\\; ` + shown.map((it) => `${x} = ${it.t}${it.d ? ` \\approx ${it.d}` : ''}`).join(',\\quad '),
          note: items.length > 12 ? L(`se muestran las 12 soluciones de menor módulo (de ${items.length})`, `showing the 12 solutions of smallest modulus (out of ${items.length})`) : undefined,
        }
      }
      case 'solve_system': {
        needs(2, L('(ec1, ec2, ...)', '(eq1, eq2, ...)'))
        const eqs = args.map((a) => this.sym(a))
        const r: any = (nerdamer as any).solveEquations(eqs.slice()) // (nerdamer modifica el arreglo)
        const pairs: [string, any][] = Array.isArray(r) ? r : []
        if (!pairs.length) return { kind: 'text', text: L('No se encontró solución.', 'No solution found.') }
        return {
          kind: 'tex',
          tex: `\\begin{cases}${eqs.map((e) => (e.includes('=') ? e.split('=').map(texOf).join(' = ') : texOf(e) + ' = 0')).join('\\\\ ')}\\end{cases}\\;\\Rightarrow\\; ${pairs.map(([k, val]) => `${k} = ${nTex(nerdamer(String(val)))}`).join(',\\ ')}`,
        }
      }
      case 'taylor': {
        needs(1, '(expr, x, x0, n)')
        const x = v(1)
        const x0 = args[2] ? this.sym(args[2]) : '0'
        const n = args[3] ? Math.round(this.num(args[3])) : 5
        if (n > 20) throw new Error(L('Orden máximo 20', 'Maximum order is 20'))
        const e = this.sym(args[0], [x])
        let d = e
        const terms: string[] = []
        for (let k = 0; k <= n; k++) {
          if (k > 0) d = nerdamer(`diff(${d}, ${x})`).toString()
          const ck = nerdamer(d, { [x]: `(${x0})` }).toString()
          if (ck === '0') continue
          terms.push(`(${ck})/${factorial(k)}*(${x}-(${x0}))^${k}`)
        }
        const r = terms.length ? nerdamer(terms.join('+')) : nerdamer('0')
        const x0t = texOf(prep(args[2] ?? '0'))
        return { kind: 'tex', tex: `${texOf(this.expand(prep(args[0]), [x]))} \\approx ${nTex(r)} + O\\left(${x0 === '0' ? x : `(${x}-${x0t})`}^{${n + 1}}\\right)`, __sym: r.toString(), __symTex: nTex(r) } as any
      }
      case 'limit': {
        needs(2, '(expr, x, a)')
        const x = args.length >= 3 ? v(1) : 'x'
        const aSrc = (args.length >= 3 ? args[2] : args[1]).trim().replace(/^(inf|infinito|oo)$/i, 'Infinity').replace(/^-(inf|infinito|oo)$/i, '-Infinity')
        const r = nerdamer(`limit(${this.sym(args[0], [x])}, ${x}, ${this.sym(aSrc)})`)
        const aTex = /Infinity/.test(aSrc) ? (aSrc.startsWith('-') ? '-\\infty' : '\\infty') : texOf(aSrc)
        const res = r.toString().includes('limit') ? null : nTex(r)
        let numTex = ''
        if (!res) {
          // estimación numérica
          const f = this.compileFn(args[0], x)
          const a = this.num(aSrc)
          const est = Number.isFinite(a) ? [1e-4, 1e-6, 1e-8].map((h) => (f(a + h) + f(a - h)) / 2) : [1e4, 1e6, 1e8].map((h) => f(Math.sign(a) * h))
          numTex = `\\approx ${texNum(est[2], 10)}\\ ${L('\\text{(numérico)}', '\\text{(numerical)}')}`
        }
        return { kind: 'tex', tex: `\\lim_{${x} \\to ${aTex}} ${texOf(this.expand(prep(args[0]), [x]))} ${res ? '= ' + res.replace(/infinity/g, '\\infty').replace(/Infinity/g, '\\infty') : numTex}` }
      }
      case 'sum': {
        needs(4, '(expr, k, a, b)')
        const k = v(1, 'k')
        const r = nerdamer(`sum(${this.sym(args[0], [k])}, ${k}, ${this.sym(args[2])}, ${this.sym(args[3])})`)
        const dec = nDec(r)
        return { kind: 'tex', tex: `\\sum_{${k}=${texOf(prep(args[2]))}}^{${texOf(prep(args[3]))}} ${texOf(prep(args[0]))} = ${nTex(r)}${dec && dec !== nTex(r) ? ' \\approx ' + dec : ''}` }
      }
      case 'N': {
        needs(1, '(expr)')
        const val = M.evaluate(this.expand(prep(args[0])), this.scope())
        this.vars.ans = val
        return { kind: 'tex', tex: `${texOf(prep(args[0]))} \\approx ${valueTex(val)}`, __value: val } as any
      }
      case 'plot': {
        needs(1, '(f(x), a, b)')
        let list = args.slice()
        let a = -10, b = 10
        const isConst = (s: string) => {
          try {
            const val = this.num(s)
            return Number.isFinite(val) && !/\bx\b/.test(s)
          } catch {
            return false
          }
        }
        if (list.length >= 3 && isConst(list[list.length - 1]) && isConst(list[list.length - 2])) {
          a = this.num(list[list.length - 2])
          b = this.num(list[list.length - 1])
          list = list.slice(0, -2)
        }
        if (list.length === 1 && /^\[.*\]$/.test(list[0])) list = splitArgs(list[0].slice(1, -1))
        if (!(a < b)) throw new Error(L('El intervalo debe cumplir a < b', 'The interval must satisfy a < b'))
        const fns = list.map((s) => ({ label: s, f: this.compileFn(s, 'x') }))
        return { kind: 'plot', fns, a, b, tex: list.map((s) => texOf(this.expand(prep(s), ['x']))).join(',\\quad ') }
      }
      case 'roots': {
        needs(1, '(f, a, b)')
        const a = args[1] ? this.num(args[1]) : -10, b = args[2] ? this.num(args[2]) : 10
        const f = this.compileFn(args[0], 'x')
        const r = numericRoots(f, a, b, 20000)
        if (!r.length) return { kind: 'text', text: L(`No se encontraron cambios de signo en [${a}, ${b}].`, `No sign changes found in [${a}, ${b}].`) }
        this.vars.ans = r[0]
        return { kind: 'tex', tex: `${texOf(prep(args[0]))} = 0\\;\\Rightarrow\\; ${r.map((x) => `x \\approx ${texNum(x, 13)}`).join(',\\ ')}`, note: L(`raíces reales en [${fmt(a)}, ${fmt(b)}] (muestreo + bisección)`, `real roots in [${fmt(a)}, ${fmt(b)}] (sampling + bisection)`) }
      }
      case 'eig': {
        needs(1, '(A)')
        const A = toMat(M.evaluate(this.expand(prep(args[0])), this.scope()))
        if (!A || A.length !== A[0].length) throw new Error(L(`${name} requiere una matriz cuadrada`, `${name} requires a square matrix`))
        if (A.length > 60) throw new Error(L('Matriz demasiado grande (máx. 60×60)', 'Matrix too large (max. 60×60)'))
        const ev = eigenvalues(A)
        if (!ev) throw new Error(L('El algoritmo QR no convergió', 'The QR algorithm did not converge'))
        ev.sort((p, q) => Math.hypot(q.re, q.im) - Math.hypot(p.re, p.im))
        const lamTex = (c: Complex) => (Math.abs(c.im) < 1e-12 ? texNum(c.re, 10) : `${texNum(c.re, 8)} ${c.im < 0 ? '-' : '+'} ${texNum(Math.abs(c.im), 8)}\\,i`)
        const vecs = ev.map((c) => (Math.abs(c.im) < 1e-12 ? eigvec(A, c.re) : null))
        const extra = vecs.some(Boolean) ? [L('\\text{vectores propios (norma 1):}\\quad ', '\\text{eigenvectors (unit norm):}\\quad ') + ev.map((c, i) => (vecs[i] ? `v_{${i + 1}} = ${texMatrix(vecs[i]!, 6)}` : '')).filter(Boolean).join(',\\ ')] : undefined
        this.vars.ans = ev.every((c) => Math.abs(c.im) < 1e-12) ? M.matrix(ev.map((c) => c.re)) : ev.map((c) => M.complex(c.re, c.im))
        return { kind: 'tex', tex: `\\lambda(${texOf(prep(args[0]))}) = \\left\\{${ev.map(lamTex).join(',\\ ')}\\right\\}`, extra }
      }
      case 'lu': {
        needs(1, '(A)')
        const r: any = M.lup(M.evaluate(this.expand(prep(args[0])), this.scope()))
        const n = r.p.length
        const P = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (r.p[i] === j ? 1 : 0)))
        return { kind: 'tex', tex: `PA = LU:\\quad L = ${valueTex(r.L)},\\quad U = ${valueTex(r.U)},\\quad P = ${texMatrix(P, 3)}` }
      }
      case 'cond': {
        needs(1, '(A)')
        const A = toMat(M.evaluate(this.expand(prep(args[0])), this.scope()))
        if (!A || A.length !== A[0].length) throw new Error(L('cond requiere una matriz cuadrada', 'cond requires a square matrix'))
        const AtA = A[0].map((_, i) => A[0].map((__, j) => A.reduce((s, r) => s + r[i] * r[j], 0)))
        const ev = eigenvalues(AtA)
        if (!ev) throw new Error(L('No convergió', 'Did not converge'))
        const sv = ev.map((c) => Math.sqrt(Math.max(0, c.re)))
        const k = Math.max(...sv) / Math.min(...sv)
        this.vars.ans = k
        return { kind: 'tex', tex: `\\kappa_2(${texOf(prep(args[0]))}) = \\frac{\\sigma_{\\max}}{\\sigma_{\\min}} = ${Number.isFinite(k) ? texNum(k, 8) : '\\infty'}`, note: Number.isFinite(k) ? L(`se pierden ≈ ${Math.max(0, Math.log10(k)).toFixed(1)} cifras al resolver Ax = b`, `≈ ${Math.max(0, Math.log10(k)).toFixed(1)} digits are lost when solving Ax = b`) : L('matriz singular', 'singular matrix') }
      }
    }
    return { kind: 'error', text: L('Comando desconocido: ', 'Unknown command: ') + name }
  }
}

/** Traduce al español los mensajes de error de mathjs (que ya están en inglés). */
function traducir(msg: string): string {
  if (LANG === 'en') return msg
  return msg
    .replace('Unexpected end of expression', 'Expresión incompleta')
    .replace(/Parenthesis \) expected.*/, 'Falta cerrar paréntesis )')
    .replace('Unexpected operator', 'Operador inesperado')
    .replace(/Undefined symbol (\w+)/, 'Símbolo no definido: $1')
    .replace(/Undefined function (\w+)/, 'Función no definida: $1')
    .replace('Value expected', 'Se esperaba un valor')
    .replace(/Dimension mismatch.*/, 'Dimensiones incompatibles')
    .replace('Cannot calculate determinant, matrix is not square', 'El determinante requiere una matriz cuadrada')
    .replace(/Cannot calculate inverse, determinant is zero/, 'La matriz es singular (det = 0): no tiene inversa')
    .replace(/is not a valid variable name/, 'no es un nombre de variable válido')
}

export type { MathNode }
