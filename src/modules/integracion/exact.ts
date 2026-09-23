// Valor de referencia de integrales: intento simbólico (nerdamer) verificado numéricamente,
// con respaldo numérico de alta precisión (Gauss-Kronrod adaptativo).
import nerdamer from 'nerdamer'
import 'nerdamer/Calculus'
import { compile, math, normalize } from '../../lib/expr'
import { adaptiveGK, referenciaDoble, type Fn, type Fn2 } from './algorithms'

export interface Reference {
  value: number
  /** 'simbolico' = F(b) − F(a) con antiderivada exacta; 'numerico' = GK adaptativo; 'ninguno' = no se pudo */
  kind: 'simbolico' | 'numerico' | 'ninguno'
  /** antiderivada en TeX (si es simbólica) */
  antiTex?: string
  /** valor exacto en TeX, p. ej. "e - 2" */
  valueTex?: string
  /** estimación del error (numérico) */
  err?: number
  label: string
}

/** Expresión del usuario → sintaxis que entiende nerdamer (multiplicación explícita, ln → log). */
export function toNerdamer(src: string): string | null {
  try {
    return math.parse(normalize(src)).toString({ implicit: 'show', parenthesis: 'keep' } as any)
  } catch {
    return null
  }
}

const UNSUPPORTED = /integrate|\bi\b|\bSi\(|\bCi\(|\bEi\(|\bShi\(|\bChi\(|\bLi\(|fresnel|gamma|polylog|dawson/

const antiCache = new Map<string, string | null>()

/** Antiderivada simbólica (string mathjs-compatible) o null. */
export function antiderivative(expr: string, v: string): string | null {
  const key = expr + '|' + v
  if (antiCache.has(key)) return antiCache.get(key)!
  let out: string | null = null
  try {
    const F = nerdamer.integrate(expr, v).toString()
    out = UNSUPPORTED.test(F) ? null : F
  } catch {
    out = null
  }
  antiCache.set(key, out)
  return out
}

/** TeX de nerdamer → notación habitual (\\sin, \\ln, \\arctan…). */
export function cleanTex(t: string): string {
  return t
    .replace(/\\mathrm\{log\}/g, '\\ln')
    .replace(/\\mathrm\{(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|arcsin|arccos|arctan|exp)\}/g, '\\$1')
    .replace(/\\mathrm\{a(sin|cos|tan)\}/g, '\\arc$1')
    .replace(/\\mathrm\{erf\}/g, '\\operatorname{erf}')
}

/** Evalúa funciones en 0 con valor trivial: erf(0) = sin(0) = … = 0, cos(0) = 1, log(1) = 0. */
function simplifyZeros(expr: string): string {
  return expr
    .replace(/\b(erf|sin|tan|asin|atan|sinh|tanh|asinh|atanh)\(0\)/g, '0')
    .replace(/\b(cos|cosh|exp)\(0\)/g, '1')
    .replace(/\blog\(1\)/g, '0')
    .replace(/\bsqrt\(0\)/g, '0')
}

/** Sólo mostramos formas cerradas limpias: sin integrales sin evaluar, decimales largos ni expresiones enormes. */
function isClean(t: string): boolean {
  return t.length < 160 && !/\\int|integrate|\.\d{6,}/.test(t)
}

function nTex(expr: string): string | undefined {
  try {
    const t = cleanTex(nerdamer(expr).toTeX())
    return isClean(t) ? t : undefined
  } catch {
    return undefined
  }
}

const close = (x: number, y: number) => Math.abs(x - y) <= 1e-7 * Math.max(1, Math.abs(y))

/** Referencia de ∫ₐᵇ f(x) dx. aSrc/bSrc son los textos de los límites (para el TeX exacto). */
export function referencia1D(src: string, f: Fn, a: number, b: number, aSrc?: string, bSrc?: string): Reference {
  const num = adaptiveGK(f, a, b, 1e-13, 3000)
  const numRef: Reference = num.ok
    ? { value: num.value, kind: 'numerico', err: num.err, label: 'Referencia numérica (Gauss-Kronrod adaptativo, tol 1e-13)' }
    : { value: NaN, kind: 'ninguno', label: 'No se pudo calcular un valor de referencia (¿singularidad o integral divergente?)' }
  const ex = toNerdamer(src)
  if (!ex) return numRef
  const F = antiderivative(ex, 'x')
  if (!F) return numRef
  const Fc = compile(F, ['x'])
  if (!Fc.ok) return numRef
  let v: number
  try {
    v = Fc.f(b) - Fc.f(a)
  } catch {
    return numRef
  }
  if (!Number.isFinite(v) || (num.ok && !close(v, num.value))) return numRef
  let valueTex: string | undefined
  try {
    const A = toNerdamer(aSrc ?? String(a)) ?? String(a)
    const B = toNerdamer(bSrc ?? String(b)) ?? String(b)
    const raw = nerdamer(F, { x: B }).subtract(nerdamer(F, { x: A })).toString()
    const e = nerdamer(simplifyZeros(raw))
    const t = cleanTex(e.toTeX())
    if (isClean(t)) valueTex = t
  } catch {
    valueTex = undefined
  }
  return { value: v, kind: 'simbolico', antiTex: nTex(F), valueTex, label: 'Valor exacto (antiderivada simbólica, F(b) − F(a))' }
}

/** Referencia de ∫ₐᵇ ∫_{c(x)}^{d(x)} f(x,y) dy dx. */
export function referencia2D(src: string, cSrc: string, dSrc: string, f: Fn2, a: number, b: number, c: Fn, d: Fn): Reference {
  const num = referenciaDoble(f, a, b, c, d)
  const numRef: Reference = num.ok
    ? { value: num.value, kind: 'numerico', err: num.err, label: 'Referencia numérica (Gauss-Kronrod adaptativo anidado)' }
    : { value: NaN, kind: 'ninguno', label: 'No se pudo calcular un valor de referencia' }
  const ex = toNerdamer(src)
  const C = toNerdamer(cSrc)
  const D = toNerdamer(dSrc)
  if (!ex || !C || !D) return numRef
  try {
    const Fy = antiderivative(ex, 'y')
    if (!Fy) return numRef
    const G = nerdamer(Fy).sub('y', `(${D})`).subtract(nerdamer(Fy).sub('y', `(${C})`)).toString()
    const F = antiderivative(G, 'x')
    if (!F) return numRef
    const Fc = compile(F, ['x'])
    if (!Fc.ok) return numRef
    const v = Fc.f(b) - Fc.f(a)
    if (!Number.isFinite(v) || (num.ok && !close(v, num.value))) return numRef
    return { value: v, kind: 'simbolico', label: 'Valor exacto (integración simbólica iterada)' }
  } catch {
    return numRef
  }
}
