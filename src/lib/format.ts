// Formato de números para tablas y resultados.

let DIGITS = 8

export function setDigits(d: number) {
  DIGITS = d
}
export function getDigits() {
  return DIGITS
}

/** Formatea un número con `digits` cifras significativas, usando notación científica si es muy grande/pequeño. */
export function fmt(x: number | null | undefined, digits = DIGITS): string {
  if (x === null || x === undefined) return '—'
  if (typeof x !== 'number') return String(x)
  if (Number.isNaN(x)) return 'NaN'
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞'
  if (x === 0) return '0'
  const ax = Math.abs(x)
  if (ax < 1e-4 || ax >= 1e9) return x.toExponential(Math.max(1, digits - 1)).replace('e', 'e')
  // Mostrar decimales fijos hasta `digits` cifras significativas
  const s = x.toPrecision(digits)
  if (s.includes('e')) return x.toExponential(Math.max(1, digits - 1))
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

/** Formato de errores: siempre científica corta. */
export function fmtErr(x: number | null | undefined): string {
  if (x === null || x === undefined) return '—'
  if (Number.isNaN(x)) return 'NaN'
  if (!Number.isFinite(x)) return '∞'
  if (x === 0) return '0'
  return x.toExponential(3)
}

/** Número a TeX (maneja notación científica). */
export function texNum(x: number, digits = DIGITS): string {
  const s = fmt(x, digits)
  const m = s.match(/^(-?[\d.]+)e([+-]\d+)$/)
  if (m) return `${m[1]}\\times 10^{${Number(m[2])}}`
  return s.replace('∞', '\\infty').replace('−', '-')
}

/** Rango de n puntos equiespaciados. */
export function linspace(a: number, b: number, n: number): number[] {
  if (n < 2) return [a]
  const h = (b - a) / (n - 1)
  return Array.from({ length: n }, (_, i) => a + i * h)
}
