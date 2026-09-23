// Herramientas numéricas del Tema 1: aritmética de alta precisión (referencia "exacta"),
// evaluación con redondeo en cada operación (simple/doble) y series de Taylor por diferenciación automática.
import { create, all, type MathNode } from 'mathjs'
import { normalize } from '../../lib/expr'
import { exactDecimal, roundP, type Prec } from './float'

/* ───────────────────────── Alta precisión ───────────────────────── */

/** Instancia (perezosa) de mathjs con BigNumber de 100 dígitos: se usa como valor "exacto" de referencia. */
let _mb: ReturnType<typeof create> | null = null
export const mb = () => (_mb ??= create(all, { number: 'BigNumber', precision: 100 }))

export type Big = any

/** Convierte un double a BigNumber usando su valor binario EXACTO. */
export const bigOf = (x: number): Big => mb().bignumber(exactDecimal(x))

/** Evalúa una expresión con 100 dígitos. Las variables se pasan como doubles (se usa su valor exacto). */
export function evalBig(src: string, scope: Record<string, number> = {}): Big | null {
  try {
    const sc: Record<string, Big> = {}
    for (const k in scope) sc[k] = bigOf(scope[k])
    const v = mb().evaluate(normalize(src), sc)
    if (v && typeof v === 'object' && 'isBigNumber' in v) return v
    if (typeof v === 'number') return mb().bignumber(v)
    return null
  } catch {
    return null
  }
}

/** Error relativo |x − ref|/|ref| calculado en alta precisión. */
export function relErrBig(x: number, ref: Big | null): number {
  if (!ref || !Number.isFinite(x)) return NaN
  if (ref.isZero()) return Math.abs(x)
  return bigOf(x).minus(ref).abs().div(ref.abs()).toNumber()
}
export function absErrBig(x: number, ref: Big | null): number {
  if (!ref || !Number.isFinite(x)) return NaN
  return bigOf(x).minus(ref).abs().toNumber()
}

/** Cadena decimal de un BigNumber con `sd` cifras significativas. */
export function bigStr(b: Big | null, sd = 20): string {
  if (!b) return '—'
  try {
    return b.toSignificantDigits(sd).toString()
  } catch {
    return String(b)
  }
}

/** Notación posicional completa (sin exponente) de un BigNumber, sin ceros finales. */
export function bigFixed(b: Big): string {
  let s: string = b.toFixed()
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s
}

/* ───────────────────────── Evaluación con redondeo por operación ───────────────────────── */

export interface TraceOp {
  /** TeX de la subexpresión */
  tex: string
  src: string
  op: string
  value: number
  /** operandos (solo + y −) para medir cancelación */
  a?: number
  b?: number
}

const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, sqrt: Math.sqrt, cbrt: Math.cbrt,
  abs: Math.abs, log1p: Math.log1p, expm1: Math.expm1, log10: Math.log10, log2: Math.log2,
  log: (x: number, b?: number) => (b === undefined ? Math.log(x) : Math.log(x) / Math.log(b)),
  atan2: Math.atan2, sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), cot: (x) => 1 / Math.tan(x),
  sign: Math.sign, floor: Math.floor, ceil: Math.ceil,
}
const CONSTS: Record<string, number> = { pi: Math.PI, PI: Math.PI, e: Math.E, E: Math.E }

/**
 * Evalúa el árbol de mathjs redondeando CADA resultado intermedio a la precisión p
 * (simula aritmética de punto flotante en simple o doble). Opcionalmente registra la traza.
 */
export function evalRounded(node: MathNode, scope: Record<string, number>, p: Prec, trace?: TraceOp[]): number {
  const R = (v: number) => roundP(v, p)
  const rec = (n: any, op: string, value: number, a?: number, b?: number) => {
    if (trace) {
      let tex = ''
      try {
        tex = n.toTex({ parenthesis: 'auto', implicit: 'hide' }).replace(/\\mathrm\{log\}/g, '\\ln')
      } catch {
        tex = n.toString()
      }
      trace.push({ tex, src: n.toString(), op, value, a, b })
    }
    return value
  }
  const ev = (n: any): number => {
    if (n.isParenthesisNode) return ev(n.content)
    if (n.isConstantNode) return R(Number(n.value))
    if (n.isSymbolNode) {
      if (n.name in scope) return R(scope[n.name])
      if (n.name in CONSTS) return R(CONSTS[n.name])
      throw new Error('Símbolo desconocido: ' + n.name)
    }
    if (n.isOperatorNode) {
      const args = n.args.map(ev)
      const [a, b] = args
      switch (n.fn) {
        case 'add': return rec(n, '+', R(a + b), a, b)
        case 'subtract': return rec(n, '−', R(a - b), a, -b)
        case 'multiply': return rec(n, '×', R(a * b))
        case 'divide': return rec(n, '÷', R(a / b))
        case 'pow': return rec(n, '^', R(Math.pow(a, b)))
        case 'unaryMinus': return -a
        case 'unaryPlus': return a
        case 'mod': return rec(n, 'mod', R(a % b))
      }
      throw new Error('Operador no soportado: ' + n.op)
    }
    if (n.isFunctionNode) {
      const name = n.fn.name ?? n.name
      const f = FUNCS[name]
      if (!f) throw new Error('Función no soportada: ' + name)
      const args = n.args.map(ev)
      return rec(n, name, R(f(...args)))
    }
    throw new Error('Expresión no soportada')
  }
  return ev(node)
}

/* ───────────────────────── Series de Taylor (diferenciación automática) ───────────────────────── */

type Ser = number[]

const sAdd = (a: Ser, b: Ser) => a.map((v, i) => v + b[i])
const sSub = (a: Ser, b: Ser) => a.map((v, i) => v - b[i])
function sMul(a: Ser, b: Ser): Ser {
  const N = a.length
  const c = new Array(N).fill(0)
  for (let i = 0; i < N; i++) if (a[i] !== 0) for (let j = 0; i + j < N; j++) c[i + j] += a[i] * b[j]
  return c
}
function sDiv(a: Ser, b: Ser): Ser {
  const N = a.length
  const c = new Array(N).fill(0)
  if (b[0] === 0) throw new Error('División por cero en el desarrollo')
  for (let k = 0; k < N; k++) {
    let s = a[k]
    for (let j = 1; j <= k; j++) s -= b[j] * c[k - j]
    c[k] = s / b[0]
  }
  return c
}
function sExp(a: Ser): Ser {
  const N = a.length
  const e = new Array(N).fill(0)
  e[0] = Math.exp(a[0])
  for (let k = 1; k < N; k++) {
    let s = 0
    for (let j = 1; j <= k; j++) s += j * a[j] * e[k - j]
    e[k] = s / k
  }
  return e
}
function sLog(a: Ser): Ser {
  const N = a.length
  const l = new Array(N).fill(0)
  if (!(a[0] > 0)) throw new Error('log no es analítico en ese punto')
  l[0] = Math.log(a[0])
  for (let k = 1; k < N; k++) {
    let s = 0
    for (let j = 1; j < k; j++) s += j * l[j] * a[k - j]
    l[k] = (a[k] - s / k) / a[0]
  }
  return l
}
function sSinCos(a: Ser): [Ser, Ser] {
  const N = a.length
  const s = new Array(N).fill(0), c = new Array(N).fill(0)
  s[0] = Math.sin(a[0])
  c[0] = Math.cos(a[0])
  for (let k = 1; k < N; k++) {
    let ss = 0, cc = 0
    for (let j = 1; j <= k; j++) {
      ss += j * a[j] * c[k - j]
      cc += j * a[j] * s[k - j]
    }
    s[k] = ss / k
    c[k] = -cc / k
  }
  return [s, c]
}
function sPowConst(a: Ser, p: number): Ser {
  const N = a.length
  if (Number.isInteger(p) && p >= 0) {
    let r: Ser = new Array(N).fill(0)
    r[0] = 1
    for (let i = 0; i < p; i++) r = sMul(r, a)
    return r
  }
  if (Number.isInteger(p) && p < 0) return sDiv(cst(1, N), sPowConst(a, -p))
  if (a[0] === 0) throw new Error('Potencia no analítica en ese punto')
  if (a[0] < 0) throw new Error('Base negativa con exponente no entero')
  const y = new Array(N).fill(0)
  y[0] = Math.pow(a[0], p)
  for (let k = 1; k < N; k++) {
    let s = 0
    for (let j = 1; j <= k; j++) s += ((p + 1) * j - k) * a[j] * y[k - j]
    y[k] = s / (k * a[0])
  }
  return y
}
/** Integra la serie de la derivada: f = f0 + ∫ d. */
function sIntegrate(f0: number, d: Ser): Ser {
  const N = d.length
  const r = new Array(N).fill(0)
  r[0] = f0
  for (let k = 1; k < N; k++) r[k] = d[k - 1] / k
  return r
}
const sDeriv = (a: Ser): Ser => a.map((_, k) => (k + 1 < a.length ? (k + 1) * a[k + 1] : 0))
const cst = (v: number, N: number): Ser => {
  const r = new Array(N).fill(0)
  r[0] = v
  return r
}

/**
 * Coeficientes de Taylor c_k = f^(k)(x0)/k!, k = 0..n, calculados por diferenciación automática
 * (aritmética de series truncadas). Exactos salvo redondeo; no sufren el crecimiento de las derivadas simbólicas.
 */
export function taylorCoeffs(node: MathNode, x0: number, n: number, v = 'x'): number[] {
  const N = n + 1
  const ev = (nd: any): Ser => {
    if (nd.isParenthesisNode) return ev(nd.content)
    if (nd.isConstantNode) return cst(Number(nd.value), N)
    if (nd.isSymbolNode) {
      if (nd.name === v) {
        const r = cst(x0, N)
        if (N > 1) r[1] = 1
        return r
      }
      if (nd.name in CONSTS) return cst(CONSTS[nd.name], N)
      throw new Error('Símbolo desconocido: ' + nd.name)
    }
    if (nd.isOperatorNode) {
      const A: Ser[] = nd.args.map(ev)
      switch (nd.fn) {
        case 'add': return sAdd(A[0], A[1])
        case 'subtract': return sSub(A[0], A[1])
        case 'multiply': return sMul(A[0], A[1])
        case 'divide': return sDiv(A[0], A[1])
        case 'unaryMinus': return A[0].map((t: number) => -t)
        case 'unaryPlus': return A[0]
        case 'pow': {
          const expConst = A[1].slice(1).every((t: number) => t === 0)
          if (expConst) return sPowConst(A[0], A[1][0])
          return sExp(sMul(A[1], sLog(A[0])))
        }
      }
      throw new Error('Operador no soportado: ' + nd.op)
    }
    if (nd.isFunctionNode) {
      const name = nd.fn.name ?? nd.name
      const A: Ser[] = nd.args.map(ev)
      const a: Ser = A[0]
      switch (name) {
        case 'exp': return sExp(a)
        case 'log':
          if (A.length === 2) return sDiv(sLog(a), cst(Math.log(A[1][0]), N))
          return sLog(a)
        case 'log10': return sLog(a).map((t) => t / Math.LN10)
        case 'log2': return sLog(a).map((t) => t / Math.LN2)
        case 'log1p': return sLog(sAdd(a, cst(1, N)))
        case 'expm1': return sSub(sExp(a), cst(1, N))
        case 'sqrt': return sPowConst(a, 0.5)
        case 'cbrt': return a[0] < 0 ? sPowConst(a.map((t) => -t), 1 / 3).map((t) => -t) : sPowConst(a, 1 / 3)
        case 'sin': return sSinCos(a)[0]
        case 'cos': return sSinCos(a)[1]
        case 'tan': {
          const [s, c] = sSinCos(a)
          return sDiv(s, c)
        }
        case 'sec': return sDiv(cst(1, N), sSinCos(a)[1])
        case 'csc': return sDiv(cst(1, N), sSinCos(a)[0])
        case 'cot': {
          const [s, c] = sSinCos(a)
          return sDiv(c, s)
        }
        case 'sinh': {
          const e1 = sExp(a), e2 = sExp(a.map((t) => -t))
          return sSub(e1, e2).map((t) => t / 2)
        }
        case 'cosh': {
          const e1 = sExp(a), e2 = sExp(a.map((t) => -t))
          return sAdd(e1, e2).map((t) => t / 2)
        }
        case 'tanh': {
          const e1 = sExp(a), e2 = sExp(a.map((t) => -t))
          return sDiv(sSub(e1, e2), sAdd(e1, e2))
        }
        case 'atan': return sIntegrate(Math.atan(a[0]), sDiv(sDeriv(a), sAdd(cst(1, N), sMul(a, a))))
        case 'asin': return sIntegrate(Math.asin(a[0]), sDiv(sDeriv(a), sPowConst(sSub(cst(1, N), sMul(a, a)), 0.5)))
        case 'acos': return sIntegrate(Math.acos(a[0]), sDiv(sDeriv(a), sPowConst(sSub(cst(1, N), sMul(a, a)), 0.5)).map((t) => -t))
        case 'abs': return a[0] === 0 ? (() => { throw new Error('|x| no es derivable en 0') })() : a[0] > 0 ? a : a.map((t) => -t)
      }
      throw new Error('Función no soportada en el desarrollo: ' + name)
    }
    throw new Error('Expresión no soportada')
  }
  // la derivación de sDeriv pierde el último coeficiente; se calcula con un orden extra y se recorta
  return ev(node).slice(0, N)
}

/** Evalúa el polinomio de Taylor Σ c_k (x − x0)^k (Horner). */
export function evalTaylor(c: number[], x0: number, x: number, n = c.length - 1): number {
  let s = 0
  const h = x - x0
  for (let k = n; k >= 0; k--) s = s * h + c[k]
  return s
}

export function factorial(n: number): number {
  let f = 1
  for (let k = 2; k <= n; k++) f *= k
  return f
}

/* ───────────────────────── Errores y cifras significativas ───────────────────────── */

/**
 * Cifras significativas correctas (definición de Burden): p* aproxima a p con t cifras
 * si t es el mayor entero no negativo con |p − p*|/|p| ≤ 5·10^(−t).
 */
export function sigDigits(rel: number): number {
  if (!Number.isFinite(rel)) return 0
  if (rel === 0) return Infinity
  const t = Math.floor(Math.log10(5 / rel) + 1e-12)
  return Math.max(0, t)
}

/**
 * Cifras significativas según el texto de la materia (Dr. Hugo Rojas, Cap. 1): el mayor entero
 * m ≥ 0 con |x − x_A|/|x| ≤ 5·10^(−(m+1)). Equivale a la de Burden menos uno.
 */
export function sigDigitsTexto(rel: number): number {
  const t = sigDigits(rel)
  return t === Infinity ? Infinity : Math.max(0, t - 1)
}

/** Decimales correctos: mayor d con |p − p*| ≤ 0.5·10^(−d). */
export function decimalDigits(abs: number): number {
  if (abs === 0) return Infinity
  const d = Math.floor(Math.log10(0.5 / abs) + 1e-12)
  return d
}
