// Utilidades de formato TeX para polinomios y números del módulo de interpolación.
import { fmt, getDigits, texNum } from '../../lib/format'
import { polyClean, toFraction, type Poly } from './algorithms'

/** Número en TeX; si `frac` y el número es una fracción “limpia”, la muestra como \frac{p}{q}. */
export function tn(x: number, frac = false, digits = getDigits()): string {
  if (frac) {
    const fr = toFraction(x)
    if (fr) {
      const [p, q] = fr
      if (q === 1) return String(p)
      return (p < 0 ? '-' : '') + `\\frac{${Math.abs(p)}}{${q}}`
    }
  }
  return texNum(x, digits)
}

/** Número entre paréntesis si es negativo (para sustituciones). */
export function tp(x: number, frac = false, digits = getDigits()): string {
  const s = tn(x, frac, digits)
  return x < 0 ? `(${s})` : s
}

/** Factor (x − x_i) en TeX con el signo simplificado. */
export function texFactor(xi: number, v = 'x', frac = false, digits = getDigits()): string {
  if (xi === 0) return v
  return xi > 0 ? `(${v} - ${tn(xi, frac, digits)})` : `(${v} + ${tn(-xi, frac, digits)})`
}

/** Diferencia (a − b) con paréntesis en b negativo. */
export function texDiff(a: number, b: number, frac = false, digits = getDigits()): string {
  return `(${tn(a, frac, digits)} - ${tp(b, frac, digits)})`
}

/** Polinomio (coef. ascendentes) en TeX, en potencias descendentes. */
export function polyTex(p: Poly, frac = false, digits = getDigits(), v = 'x'): string {
  const q = polyClean(p)
  const parts: string[] = []
  for (let k = q.length - 1; k >= 0; k--) {
    const c = q[k]
    if (c === 0) continue
    const mon = k === 0 ? '' : k === 1 ? v : `${v}^{${k}}`
    const abs = Math.abs(c)
    let coef = tn(abs, frac, digits)
    if (mon && coef === '1') coef = ''
    else if (mon && coef.includes('\\times')) coef = `(${coef})`
    const term = coef + (mon && coef ? '\\,' : '') + mon
    if (!parts.length) parts.push((c < 0 ? '-' : '') + term)
    else parts.push((c < 0 ? ' - ' : ' + ') + term)
  }
  return parts.length ? parts.join('') : '0'
}

/** Polinomio en texto plano (para tablas/leyendas). */
export function polyText(p: Poly, digits = 6): string {
  const q = polyClean(p)
  const parts: string[] = []
  for (let k = q.length - 1; k >= 0; k--) {
    const c = q[k]
    if (c === 0) continue
    const mon = k === 0 ? '' : k === 1 ? 'x' : `x^${k}`
    const a = fmt(Math.abs(c), digits)
    const term = mon ? (a === '1' ? mon : `${a}${mon}`) : a
    parts.push(parts.length ? (c < 0 ? ' − ' : ' + ') + term : (c < 0 ? '−' : '') + term)
  }
  return parts.join('') || '0'
}

/** Número para código Scilab (precisión completa). */
export function sci(x: number): string {
  if (!Number.isFinite(x)) return x > 0 ? '%inf' : x < 0 ? '-%inf' : '%nan'
  return String(+x.toPrecision(15))
}
export function sciVec(v: number[]): string {
  return '[' + v.map(sci).join(', ') + ']'
}

/** Subíndices unicode para etiquetas de texto plano. */
export function sub(n: number): string {
  return String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).replace('-', '₋')
}
