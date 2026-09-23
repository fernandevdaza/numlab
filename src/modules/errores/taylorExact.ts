// Forma algebraica (exacta) del polinomio de Taylor: f^(k)(x0) y c_k = f^(k)(x0)/k! como
// fracciones, raíces, π, e… usando nerdamer. Si algo no se puede simplificar se reconoce la
// fracción a partir del valor numérico, y en último caso se deja el decimal.

import nerdamer from 'nerdamer'
import 'nerdamer/Algebra'
import 'nerdamer/Calculus'
import { math, normalize } from '../../lib/expr'
import { texNum } from '../../lib/format'

export interface ExactTerm {
  k: number
  /** f^(k)(x0) exacto en TeX (sin signo) */
  derivTex: string
  /** c_k = f^(k)(x0)/k! simplificado en TeX (sin signo) */
  coefTex: string
  /** signo del término */
  neg: boolean
  zero: boolean
  /** true si se obtuvo en forma exacta (no decimal) */
  exact: boolean
}

export interface ExactTaylor {
  terms: ExactTerm[]
  /** (x − x0) en TeX, o x si x0 = 0 */
  base: string
  /** x0 en TeX */
  x0Tex: string
}

const factorial = (n: number) => {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

/** Fracción p/q con q ≤ 10⁶ que aproxima v con error relativo < 1e-11 (fracciones continuas). */
export function toFraction(v: number): [number, number] | null {
  if (!Number.isFinite(v)) return null
  if (Number.isInteger(v)) return [v, 1]
  const sgn = v < 0 ? -1 : 1
  let x = Math.abs(v)
  let [h0, h1, k0, k1] = [0, 1, 1, 0]
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(x)
    ;[h0, h1] = [h1, a * h1 + h0]
    ;[k0, k1] = [k1, a * k1 + k0]
    if (k1 > 1e6) return null
    if (Math.abs(h1 / k1 - Math.abs(v)) <= 1e-11 * Math.max(1, Math.abs(v))) return [sgn * h1, k1]
    const r = x - a
    if (r < 1e-15) break
    x = 1 / r
  }
  return null
}

function fracTex(p: number, q: number): string {
  return q === 1 ? String(Math.abs(p)) : `\\frac{${Math.abs(p)}}{${q}}`
}

/** nerdamer.toTeX con algunos retoques: \cdot antes de e^, \mathrm{…} de funciones. */
function cleanN(t: string): string {
  return t.replace(/\\mathrm\{(sin|cos|tan|sec|csc|cot|log|exp)\}/g, '\\$1').replace(/\\log/g, '\\ln').replace(/(\d)\s*\\cdot\s*(?=[a-zA-Z\\])/g, '$1\\,')
}

/** ¿Quedó algo sin evaluar como tan(0), sec(0), log(3)…? */
const unevaluated = (s: string) => /\b(sin|cos|tan|sec|csc|cot|asin|acos|atan|log|sinh|cosh|tanh)\(/.test(s)

/**
 * Calcula la forma exacta de los términos 0..n. `coefNum` son los coeficientes numéricos
 * (diferenciación automática) que se usan como respaldo y para el signo.
 */
export function exactTaylor(fSrc: string, x0Src: string, n: number, coefNum: number[], budgetMs = 600): ExactTaylor {
  const t0 = performance.now()
  let fN = ''
  let x0N = ''
  try {
    fN = math.parse(normalize(fSrc)).toString({ implicit: 'show' })
    x0N = math.parse(normalize(x0Src)).toString({ implicit: 'show' })
  } catch {
    /* se usa el respaldo numérico */
  }
  const x0Num = Number(math.evaluate(normalize(x0Src)))
  let x0Tex = texNum(x0Num, 8)
  try {
    const t = cleanN(nerdamer(x0N).toTeX())
    if (!unevaluated(t)) x0Tex = t
  } catch {
    /* decimal */
  }
  const x0Abs = x0Num < 0 ? (x0Tex.startsWith('-') ? x0Tex.slice(1).trim() : texNum(-x0Num, 8)) : x0Tex
  const base = x0Num === 0 ? 'x' : `\\left(x ${x0Num > 0 ? '-' : '+'} ${x0Abs}\\right)`

  const terms: ExactTerm[] = []
  let d: any = null
  let symOk = !!fN
  for (let k = 0; k <= n; k++) {
    const num = coefNum[k] ?? NaN
    const derivNum = num * factorial(k)
    const zero = Math.abs(num) < 1e-14 * Math.max(1, ...coefNum.slice(0, n + 1).map(Math.abs))
    const neg = num < 0
    let derivTex: string | null = null
    let coefTex: string | null = null
    // 1) simbólico con nerdamer (mientras haya presupuesto de tiempo)
    if (symOk && performance.now() - t0 < budgetMs && k <= 16) {
      try {
        d = k === 0 ? nerdamer(fN) : nerdamer.diff(d, 'x')
        const v = nerdamer(d.toString(), { x: x0N })
        const vs = v.toString()
        if (!unevaluated(vs) && Number.isFinite(Number(v.evaluate().text('decimals')))) {
          const mag = neg ? nerdamer(`-(${vs})`) : v
          derivTex = cleanN(mag.toTeX())
          const c = nerdamer(`(${mag.toString()})/${factorial(k)}`)
          coefTex = cleanN(c.toTeX())
        }
      } catch {
        symOk = false // la cadena de derivadas se rompió: el resto usa el respaldo numérico
      }
    }
    // 2) respaldo: reconocer fracciones en el valor numérico
    if (derivTex === null) {
      const fr = toFraction(derivNum)
      derivTex = fr ? fracTex(fr[0], fr[1]) : texNum(Math.abs(derivNum), 10)
    }
    if (coefTex === null) {
      const fr = toFraction(num)
      coefTex = fr ? fracTex(fr[0], fr[1]) : texNum(Math.abs(num), 10)
    }
    terms.push({ k, derivTex, coefTex, neg, zero, exact: !/\d\.\d/.test(coefTex) })
  }
  return { terms, base, x0Tex }
}

const pw = (base: string, k: number) => (k === 0 ? '' : k === 1 ? base : `${base}^{${k}}`)
const wrapIfSum = (t: string) => (/[+-]/.test(t.replace(/^-/, '').replace(/\{[^}]*\}/g, '')) ? `\\left(${t}\\right)` : t)

/** Une términos con saltos de línea cada `per` términos. */
function joinTerms(parts: { neg: boolean; body: string }[], lhs: string, per = 4): string {
  if (!parts.length) return `${lhs} = 0`
  const lines: string[] = []
  let cur = ''
  parts.forEach((p, i) => {
    const sign = i === 0 ? (p.neg ? '-' : '') : p.neg ? ' - ' : ' + '
    cur += sign + p.body
    if ((i + 1) % per === 0 && i < parts.length - 1) {
      lines.push(cur)
      cur = ''
    }
  })
  lines.push(cur)
  if (lines.length === 1) return `${lhs} = ${lines[0]}`
  return `\\begin{aligned} ${lhs} &= ${lines[0]} \\\\ ${lines.slice(1).map((l) => `&\\quad ${l}`).join(' \\\\ ')} \\end{aligned}`
}

const prime = (k: number) => (k === 0 ? 'f' : k <= 3 ? `f${"'".repeat(k)}` : `f^{(${k})}`)

/** P_n(x) = f(x0) + f'(x0)(x−x0) + f''(x0)/2! (x−x0)² + …  (notación general) */
export function generalTex(ex: ExactTaylor, n: number): string {
  const b = ex.x0Tex === '0' ? 'x' : '(x - x_0)'
  const parts = Array.from({ length: n + 1 }, (_, k) => ({
    neg: false,
    body: k === 0 ? 'f(x_0)' : k === 1 ? `f'(x_0)\\,${b}` : `\\frac{${prime(k)}(x_0)}{${k}!}\\,${b}^{${k}}`,
  }))
  return joinTerms(parts, `P_{${n}}(x)`, 4)
}

/** Con los valores exactos de las derivadas y los factoriales sin simplificar. */
export function factorialTex(ex: ExactTaylor, n: number): string {
  const parts = ex.terms
    .filter((t) => !t.zero && t.k <= n)
    .map((t) => ({
      neg: t.neg,
      body: t.k === 0 ? t.derivTex : `\\frac{${t.derivTex}}{${t.k}!}\\,${pw(ex.base, t.k)}`,
    }))
  return joinTerms(parts, `P_{${n}}(x)`, 4)
}

/** Coeficientes simplificados (fracciones). */
export function simplifiedTex(ex: ExactTaylor, n: number): string {
  const parts = ex.terms
    .filter((t) => !t.zero && t.k <= n)
    .map((t) => {
      const one = t.coefTex === '1'
      const coef = t.k === 0 ? t.coefTex : one ? '' : wrapIfSum(t.coefTex)
      return { neg: t.neg, body: `${coef}${coef && t.k > 0 ? '\\,' : ''}${pw(ex.base, t.k)}` }
    })
  return joinTerms(parts, `P_{${n}}(x)`, 5)
}
