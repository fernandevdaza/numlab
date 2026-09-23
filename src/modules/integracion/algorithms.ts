// Algoritmos de derivación e integración numérica (Tema 5).
// Funciones puras: no dependen de React ni del parser de expresiones.

import { L } from '../../i18n.ts'

export type Fn = (x: number) => number
export type Fn2 = (x: number, y: number) => number

const safe = (f: Fn, x: number) => {
  try {
    const v = f(x)
    return typeof v === 'number' ? v : NaN
  } catch {
    return NaN
  }
}

/* ═════════════════════════ Diferencias finitas ═════════════════════════ */

export type DiffScheme =
  | 'progresiva2'
  | 'regresiva2'
  | 'centralMedio'
  | 'extrapolada'
  | 'segunda3'
  | 'centrada3'
  | 'progresiva3'
  | 'regresiva3'
  | 'centrada5'
  | 'segunda5'

export interface SchemeDef {
  label: string
  short: string
  /** true = fórmula tal como la presenta el texto de la materia (sección 5.5) */
  libro: boolean
  /** ecuación del texto, p. ej. "(5.44)" */
  eq?: string
  /** orden de la derivada que aproxima (1 o 2) */
  k: 1 | 2
  /** desplazamientos (en múltiplos de h) de los nodos */
  offsets: number[]
  /** coeficientes enteros de cada nodo */
  coefs: number[]
  /** denominador: la fórmula es Σ cᵢ f(x+oᵢh) / (den · hᵏ) */
  den: number
  /** orden del error de truncamiento O(hᵖ) */
  p: number
  /** true si el error sólo tiene potencias pares de h (fórmula simétrica) */
  even: boolean
  /** |coeficiente| del término de error: |E| = coef · hᵖ · |f⁽ᵏ⁺ᵖ⁾(ξ)| */
  errCoef: number
  /** fórmula en TeX */
  tex: string
  /** término de error E = (valor exacto − aproximación) en TeX */
  errTex: string
}

export const SCHEMES: Record<DiffScheme, SchemeDef> = {
  progresiva2: {
    label: L('Diferencia de avance', 'Forward difference'), short: L('Avance', 'Forward'), libro: true, eq: '(5.44)', k: 1, offsets: [0, 1], coefs: [-1, 1], den: 1, p: 1, even: false, errCoef: 1 / 2,
    tex: "f'(x) \\approx \\frac{f(x+h) - f(x)}{h}", errTex: "-\\frac{h}{2}f''(\\xi)",
  },
  regresiva2: {
    label: L('Diferencia de retroceso', 'Backward difference'), short: L('Retroceso', 'Backward'), libro: true, eq: '(5.45)', k: 1, offsets: [-1, 0], coefs: [-1, 1], den: 1, p: 1, even: false, errCoef: 1 / 2,
    tex: "f'(x) \\approx \\frac{f(x) - f(x-h)}{h}", errTex: "+\\frac{h}{2}f''(\\xi)",
  },
  centralMedio: {
    label: L('Diferencia central (x ± h/2)', 'Central difference (x ± h/2)'), short: 'Central', libro: true, eq: '(5.46)', k: 1, offsets: [-0.5, 0.5], coefs: [-1, 1], den: 1, p: 2, even: true, errCoef: 1 / 24,
    tex: "f'(x) \\approx \\frac{f(x+\\frac{h}{2}) - f(x-\\frac{h}{2})}{h}", errTex: "-\\frac{h^2}{24}f'''(\\xi)",
  },
  extrapolada: {
    label: L('Diferencia extrapolada', 'Extrapolated difference'), short: L('Extrapolada', 'Extrapolated'), libro: true, eq: '(5.47)', k: 1, offsets: [-0.5, -0.25, 0.25, 0.5], coefs: [1, -8, 8, -1], den: 3, p: 4, even: true, errCoef: 1 / 7680,
    tex: "f'(x) \\approx \\frac{8[f(x+\\frac{h}{4}) - f(x-\\frac{h}{4})] - [f(x+\\frac{h}{2}) - f(x-\\frac{h}{2})]}{3h}",
    errTex: '+\\frac{h^4}{120\\cdot 64}f^{(5)}(\\xi)',
  },
  segunda3: {
    label: L('Segunda derivada (coef. indeterminados)', 'Second derivative (undetermined coefficients)'), short: L("f'' 3 puntos", "f'' 3-point"), libro: true, eq: '(5.49)', k: 2, offsets: [-1, 0, 1], coefs: [1, -2, 1], den: 1, p: 2, even: true, errCoef: 1 / 12,
    tex: "f''(x) \\approx \\frac{f(x+h) - 2f(x) + f(x-h)}{h^2}", errTex: '-\\frac{h^2}{12}f^{(4)}(\\xi)',
  },
  centrada3: {
    label: L('Centrada con paso h (x ± h)', 'Centered with step h (x ± h)'), short: L('Centrada x±h', 'Centered x±h'), libro: false, k: 1, offsets: [-1, 1], coefs: [-1, 1], den: 2, p: 2, even: true, errCoef: 1 / 6,
    tex: "f'(x) \\approx \\frac{f(x+h) - f(x-h)}{2h}", errTex: "-\\frac{h^2}{6}f'''(\\xi)",
  },
  progresiva3: {
    label: L('Progresiva de 3 puntos', 'Three-point forward'), short: L('Progresiva 3p', 'Forward 3p'), libro: false, k: 1, offsets: [0, 1, 2], coefs: [-3, 4, -1], den: 2, p: 2, even: false, errCoef: 1 / 3,
    tex: "f'(x) \\approx \\frac{-3f(x) + 4f(x+h) - f(x+2h)}{2h}", errTex: "+\\frac{h^2}{3}f'''(\\xi)",
  },
  regresiva3: {
    label: L('Regresiva de 3 puntos', 'Three-point backward'), short: L('Regresiva 3p', 'Backward 3p'), libro: false, k: 1, offsets: [-2, -1, 0], coefs: [1, -4, 3], den: 2, p: 2, even: false, errCoef: 1 / 3,
    tex: "f'(x) \\approx \\frac{f(x-2h) - 4f(x-h) + 3f(x)}{2h}", errTex: "+\\frac{h^2}{3}f'''(\\xi)",
  },
  centrada5: {
    label: L('Centrada de 5 puntos', 'Five-point centered'), short: L('Centrada 5p', 'Centered 5p'), libro: false, k: 1, offsets: [-2, -1, 1, 2], coefs: [1, -8, 8, -1], den: 12, p: 4, even: true, errCoef: 1 / 30,
    tex: "f'(x) \\approx \\frac{f(x-2h) - 8f(x-h) + 8f(x+h) - f(x+2h)}{12h}", errTex: '+\\frac{h^4}{30}f^{(5)}(\\xi)',
  },
  segunda5: {
    label: L('Segunda derivada de 5 puntos', 'Five-point second derivative'), short: L("f'' 5 puntos", "f'' 5-point"), libro: false, k: 2, offsets: [-2, -1, 0, 1, 2], coefs: [-1, 16, -30, 16, -1], den: 12, p: 4, even: true, errCoef: 1 / 90,
    tex: "f''(x) \\approx \\frac{-f(x-2h) + 16f(x-h) - 30f(x) + 16f(x+h) - f(x+2h)}{12h^2}", errTex: '+\\frac{h^4}{90}f^{(6)}(\\xi)',
  },
}

export function diffApprox(f: Fn, x0: number, h: number, s: DiffScheme): number {
  const d = SCHEMES[s]
  let sum = 0
  for (let i = 0; i < d.offsets.length; i++) sum += d.coefs[i] * safe(f, x0 + d.offsets[i] * h)
  return sum / (d.den * h ** d.k)
}

/** Intervalo que cubren los nodos de la fórmula (incluye x): [x + min(oᵢ)h, x + max(oᵢ)h]. */
export function stencilInterval(s: DiffScheme, x0: number, h: number): [number, number] {
  const o = [...SCHEMES[s].offsets, 0]
  return [x0 + Math.min(...o) * h, x0 + Math.max(...o) * h]
}

/**
 * Mayoración del error de truncamiento, como en el Ej. 5.10 del texto:
 * |E| ≤ errCoef · hᵖ · max |f⁽ᵏ⁺ᵖ⁾(z)| con z en el intervalo que cubren los nodos.
 */
export function cotaDerivada(s: DiffScheme, x0: number, h: number, high: Fn): { bound: number; M: number } {
  const [lo, hi] = stencilInterval(s, x0, h)
  const { M } = maxAbs(high, lo, hi, 400)
  return { bound: SCHEMES[s].errCoef * h ** SCHEMES[s].p * M, M }
}

/**
 * h óptimo teórico balanceando truncamiento A·hᵖ con redondeo B/hᵏ,
 * A = errCoef·|f⁽ᵏ⁺ᵖ⁾(x₀)|, B = ε·|f(x₀)|·Σ|cᵢ|/den  ⇒  h* = (k·B/(p·A))^{1/(p+k)}
 */
export function hOptimo(s: DiffScheme, fx0: number, dHigh: number, eps = 2.220446049250313e-16): number {
  const d = SCHEMES[s]
  const A = d.errCoef * Math.abs(dHigh)
  const B = (eps * Math.max(Math.abs(fx0), 1e-300) * d.coefs.reduce((t, c) => t + Math.abs(c), 0)) / d.den
  if (!(A > 0) || !(B > 0)) return NaN
  return Math.pow((d.k * B) / (d.p * A), 1 / (d.p + d.k))
}

/** Barrido de h = 10^(-e) para ver el compromiso truncamiento / redondeo. */
export function errorVsH(f: Fn, x0: number, s: DiffScheme, exact: number, from = 0, to = 15, step = 0.25) {
  const out: { h: number; D: number; err: number }[] = []
  for (let e = from; e <= to + 1e-9; e += step) {
    const h = 10 ** -e
    const D = diffApprox(f, x0, h, s)
    out.push({ h, D, err: Math.abs(D - exact) })
  }
  return out
}

/**
 * Extrapolación de Richardson para derivadas a partir de cualquier fórmula base.
 * Si el error de la base es c₁hᵖ + c₂hᵖ⁺ˢ + … (s = 2 si la fórmula es simétrica, 1 si no),
 * la columna j usa el factor F_j = 2^{p + s(j−1)}:  N_j(h) = N_{j−1}(h/2) + [N_{j−1}(h/2) − N_{j−1}(h)]/(F_j − 1).
 * N[i][j], i = 0..levels-1 con paso h/2ⁱ.
 */
export function richardsonDeriv(f: Fn, x0: number, h: number, levels: number, base: DiffScheme) {
  const sc = SCHEMES[base]
  const step = sc.even ? 2 : 1
  const factors: number[] = [NaN]
  for (let j = 1; j < levels; j++) factors.push(2 ** (sc.p + step * (j - 1)))
  const N: number[][] = []
  const hs: number[] = []
  for (let i = 0; i < levels; i++) {
    const hi = h / 2 ** i
    hs.push(hi)
    N.push([diffApprox(f, x0, hi, base)])
    for (let j = 1; j <= i; j++) N[i][j] = N[i][j - 1] + (N[i][j - 1] - N[i - 1][j - 1]) / (factors[j] - 1)
  }
  return { N, hs, factors }
}

/* ═════════════════════════ Newton-Cotes ═════════════════════════ */

export type NCRule = 'trapecio' | 'simpson13' | 'simpson38' | 'boole'

export interface NCDef {
  label: string
  /** subintervalos por panel */
  m: number
  /** pesos enteros de un panel */
  w: number[]
  /** factor: (num/den)·h */
  num: number
  den: number
  /** símbolo del paso en la fórmula compuesta: el texto usa H (trapecio y Simpson) */
  hSym: 'H' | 'h'
  /** ecuación de la fórmula compuesta en el texto */
  eq?: string
  factorTex: string
  /** error compuesto: −C·(b−a)·hᵖ·f⁽ᵈ⁾(η) */
  C: number
  /** C en TeX y en Scilab */
  Ctex: string
  Csci: string
  p: number
  deriv: number
  errTex: string
  simpleErrTex: string
  simpleTex: string
  compTex: string
  /** grado de exactitud (polinomios) */
  exact: number
}

export const NC: Record<NCRule, NCDef> = {
  trapecio: {
    label: L('Regla del trapecio', 'Trapezoidal rule'), m: 1, w: [1, 1], num: 1, den: 2, hSym: 'H', eq: '(5.11)', factorTex: '\\frac{H}{2}', C: 1 / 12, Ctex: '\\frac{1}{12}', Csci: '1/12', p: 2, deriv: 2, exact: 1,
    simpleTex: '\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\big[f(x_0)+f(x_1)\\big],\\quad h=b-a',
    compTex: '\\int_a^b f(x)\\,dx \\approx \\frac{H}{2}\\Big[f(a) + 2\\sum_{k=1}^{N-1} f(x_k) + f(b)\\Big],\\quad H=\\frac{b-a}{N}',
    simpleErrTex: "E_1 = -\\frac{1}{12}(b-a)^3 f''(\\eta)",
    errTex: "E_N = -\\frac{H^2}{12}(b-a)f''(\\eta)",
  },
  simpson13: {
    label: 'Simpson 1/3', m: 2, w: [1, 4, 1], num: 1, den: 3, hSym: 'H', eq: '(5.21)', factorTex: '\\frac{H}{3}', C: 1 / 180, Ctex: '\\frac{1}{180}', Csci: '1/180', p: 4, deriv: 4, exact: 3,
    simpleTex: '\\int_a^b f(x)\\,dx \\approx \\frac{h}{3}\\Big[f(a)+4f\\big(\\tfrac{a+b}{2}\\big)+f(b)\\Big],\\quad h=\\frac{b-a}{2}',
    compTex: '\\int_a^b f(x)\\,dx \\approx \\frac{H}{3}\\Big[f(a) + 4\\sum_{k=0}^{N-1} f(x_{2k+1}) + 2\\sum_{k=0}^{N-2} f(x_{2k+2}) + f(b)\\Big],\\quad H=\\frac{b-a}{2N}',
    simpleErrTex: 'E_2 = -\\frac{1}{90}\\Big(\\frac{b-a}{2}\\Big)^5 f^{(4)}(\\eta)',
    errTex: 'E_{2N} = -\\frac{H^4}{180}(b-a)f^{(4)}(\\eta)',
  },
  simpson38: {
    label: 'Simpson 3/8', m: 3, w: [1, 3, 3, 1], num: 3, den: 8, hSym: 'h', factorTex: '\\frac{3h}{8}', C: 1 / 80, Ctex: '\\frac{1}{80}', Csci: '1/80', p: 4, deriv: 4, exact: 3,
    simpleTex: '\\int_{x_0}^{x_3} f(x)\\,dx \\approx \\frac{3h}{8}\\big[f(x_0)+3f(x_1)+3f(x_2)+f(x_3)\\big]',
    compTex: '\\int_a^b f(x)\\,dx \\approx \\frac{3h}{8}\\Big[f(x_0) + 3\\!\\!\\sum_{3\\nmid i}\\! f(x_i) + 2\\!\\!\\sum_{3\\mid i}\\! f(x_i) + f(x_n)\\Big]',
    simpleErrTex: 'E = -\\frac{3h^5}{80}f^{(4)}(\\xi)',
    errTex: 'E = -\\frac{(b-a)h^4}{80}f^{(4)}(\\xi)',
  },
  boole: {
    label: L('Regla de Boole', "Boole's rule"), m: 4, w: [7, 32, 12, 32, 7], num: 2, den: 45, hSym: 'h', factorTex: '\\frac{2h}{45}', C: 2 / 945, Ctex: '\\frac{2}{945}', Csci: '2/945', p: 6, deriv: 6, exact: 5,
    simpleTex: '\\int_{x_0}^{x_4} f(x)\\,dx \\approx \\frac{2h}{45}\\big[7f_0+32f_1+12f_2+32f_3+7f_4\\big]',
    compTex: '\\int_a^b f(x)\\,dx \\approx \\frac{2h}{45}\\Big[7f_0 + 32f_1 + 12f_2 + 32f_3 + 14f_4 + \\cdots + 7f_n\\Big]',
    simpleErrTex: 'E = -\\frac{8h^7}{945}f^{(6)}(\\xi)',
    errTex: 'E = -\\frac{2(b-a)h^6}{945}f^{(6)}(\\xi)',
  },
}

/** Coeficientes enteros compuestos cᵢ para n subintervalos (n múltiplo de m). */
export function ncCoefs(n: number, rule: NCRule): number[] {
  const { m, w } = NC[rule]
  const c = new Array(n + 1).fill(0)
  for (let p = 0; p < n; p += m) for (let k = 0; k <= m; k++) c[p + k] += w[k]
  return c
}

export function ncValidN(n: number, rule: NCRule): string | null {
  const m = NC[rule].m
  if (!Number.isInteger(n) || n < 1) return L('n debe ser un entero positivo.', 'n must be a positive integer.')
  if (n % m !== 0) {
    if (rule === 'simpson13') return L(
        `Simpson 1/3 requiere un número PAR de subintervalos (n = ${n} es impar). Usa n = ${n + 1}.`,
        `Simpson's 1/3 rule requires an EVEN number of subintervals (n = ${n} is odd). Use n = ${n + 1}.`,
      )
    if (rule === 'simpson38') return L(
        `Simpson 3/8 requiere n múltiplo de 3 (n = ${n}). Usa n = ${Math.ceil(n / 3) * 3}.`,
        `Simpson's 3/8 rule requires n to be a multiple of 3 (n = ${n}). Use n = ${Math.ceil(n / 3) * 3}.`,
      )
    if (rule === 'boole') return L(
        `Boole requiere n múltiplo de 4 (n = ${n}). Usa n = ${Math.ceil(n / 4) * 4}.`,
        `Boole's rule requires n to be a multiple of 4 (n = ${n}). Use n = ${Math.ceil(n / 4) * 4}.`,
      )
  }
  return null
}

export interface NCResult {
  value: number
  h: number
  xs: number[]
  ys: number[]
  coefs: number[]
  n: number
}

/** Newton-Cotes compuesta sobre valores equiespaciados ys con paso h. */
export function newtonCotesData(xs: number[], ys: number[], rule: NCRule): NCResult {
  const n = ys.length - 1
  const h = (xs[n] - xs[0]) / n
  const coefs = ncCoefs(n, rule)
  const { num, den } = NC[rule]
  let s = 0
  for (let i = 0; i <= n; i++) s += coefs[i] * ys[i]
  return { value: (num / den) * h * s, h, xs, ys, coefs, n }
}

export function newtonCotes(f: Fn, a: number, b: number, n: number, rule: NCRule): NCResult {
  const h = (b - a) / n
  const xs = Array.from({ length: n + 1 }, (_, i) => (i === n ? b : a + i * h))
  const ys = xs.map((x) => safe(f, x))
  return newtonCotesData(xs, ys, rule)
}

/** Trapecio para datos no equiespaciados. */
export function trapecioNoUniforme(xs: number[], ys: number[]): number {
  let s = 0
  for (let i = 0; i < xs.length - 1; i++) s += ((xs[i + 1] - xs[i]) * (ys[i] + ys[i + 1])) / 2
  return s
}

export function isEquispaced(xs: number[]): boolean {
  if (xs.length < 2) return true
  const h = (xs[xs.length - 1] - xs[0]) / (xs.length - 1)
  return xs.every((x, i) => Math.abs(x - (xs[0] + i * h)) <= 1e-9 * Math.max(1, Math.abs(h), Math.abs(x)))
}

/** Máximo de |g| en [a,b] por muestreo (estimación de M = max|f⁽ᵏ⁾|). */
export function maxAbs(g: Fn, a: number, b: number, N = 600): { M: number; at: number } {
  let M = 0
  let at = a
  for (let i = 0; i <= N; i++) {
    const x = a + ((b - a) * i) / N
    const v = Math.abs(safe(g, x))
    if (Number.isFinite(v) && v > M) {
      M = v
      at = x
    }
  }
  return { M, at }
}

/** Polinomio de Lagrange por los puntos (xs, ys), evaluado en x. */
export function lagrange(xs: number[], ys: number[], x: number): number {
  let s = 0
  for (let i = 0; i < xs.length; i++) {
    let L = 1
    for (let j = 0; j < xs.length; j++) if (j !== i) L *= (x - xs[j]) / (xs[i] - xs[j])
    s += ys[i] * L
  }
  return s
}

/* ═════════════════════════ Romberg ═════════════════════════ */

export interface RombergResult {
  /**
   * Tabla en la disposición de Burden: R[k][j] (triangular inferior). En la notación del texto
   * (ec. 5.29) es R[k][j] = I_{k−j}^{(j)}; ver `rombergLibro`.
   */
  R: number[][]
  /** paso h_k = (b−a)/2ᵏ de cada fila */
  hs: number[]
  /** suma de f en los nuevos puntos medios de cada fila (k ≥ 1) */
  sums: number[]
  /** true si se detuvo por la tolerancia (sólo cuando tol > 0) */
  converged: boolean
  value: number
  evals: number
  message: string
}

/** Dígitos en superíndice para textos como I₀⁽³⁾. */
export const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d])

/**
 * Romberg-Richardson (sección 5.2.3 del texto). maxLevel = número de filas = k_max + 1.
 * Con tol > 0 se detiene cuando |I_0^{(k)} − I_0^{(k−1)}| < tol; con tol ≤ 0 (o NaN) calcula todas las filas,
 * que es como lo aplica el texto (k_max fijo).
 */
export function romberg(f: Fn, a: number, b: number, maxLevel: number, tol: number): RombergResult {
  const R: number[][] = []
  const hs: number[] = []
  const sums: number[] = [NaN]
  let h = b - a
  R.push([(h / 2) * (safe(f, a) + safe(f, b))])
  hs.push(h)
  let evals = 2
  const useTol = tol > 0
  for (let k = 1; k < maxLevel; k++) {
    h /= 2
    let s = 0
    const cnt = 2 ** (k - 1)
    for (let i = 1; i <= cnt; i++) s += safe(f, a + (2 * i - 1) * h)
    evals += cnt
    sums.push(s)
    hs.push(h)
    const row = [R[k - 1][0] / 2 + h * s]
    for (let j = 1; j <= k; j++) row.push(row[j - 1] + (row[j - 1] - R[k - 1][j - 1]) / (4 ** j - 1))
    R.push(row)
    if (!Number.isFinite(row[k])) return { R, hs, sums, converged: false, value: row[k], evals, message: L('Se obtuvo un valor no finito: f tiene una singularidad en [a, b].', 'A non-finite value was obtained: f has a singularity in [a, b].') }
    if (useTol && Math.abs(row[k] - R[k - 1][k - 1]) < tol)
      return { R, hs, sums, converged: true, value: row[k], evals, message: L(
          `Se alcanzó la tolerancia con k_max = ${k}: |I₀⁽${sup(k)}⁾ − I₀⁽${sup(k - 1)}⁾| < tol.`,
          `Tolerance reached with k_max = ${k}: |I₀⁽${sup(k)}⁾ − I₀⁽${sup(k - 1)}⁾| < tol.`,
        ) }
  }
  const last = R[R.length - 1]
  const K = R.length - 1
  return {
    R,
    hs,
    sums,
    converged: false,
    value: last[last.length - 1],
    evals,
    message: useTol
      ? L(`No se alcanzó la tolerancia con k_max = ${K}; se muestra I₀⁽${sup(K)}⁾.`, `Tolerance not reached with k_max = ${K}; showing I₀⁽${sup(K)}⁾.`)
      : L(
          `Tabla completa con k_max = ${K} (${evals} evaluaciones de f); la mejor estimación es I₀⁽${sup(K)}⁾.`,
          `Full table with k_max = ${K} (${evals} evaluations of f); the best estimate is I₀⁽${sup(K)}⁾.`,
        ),
  }
}

/**
 * Tabla de Romberg en la notación del texto (ec. 5.29):
 * I[k][m] = I_k^{(m)} = (4ᵐ I_{k+1}^{(m−1)} − I_k^{(m−1)}) / (4ᵐ − 1), k = 0..k_max − m.
 * Equivale a I_k^{(m)} = R[k+m][m] de la disposición de Burden.
 */
export function rombergLibro(R: number[][]): number[][] {
  const K = R.length - 1
  return Array.from({ length: K + 1 }, (_, k) => Array.from({ length: K - k + 1 }, (_, m) => R[k + m][m]))
}

/**
 * Romberg-Richardson con datos tabulados equiespaciados (problema 7 del texto):
 * requiere 2^K + 1 puntos. La columna I_k^{(0)} es el trapecio con n = 2ᵏ subintervalos.
 */
export function rombergDatos(xs: number[], ys: number[]): RombergResult | { error: string } {
  const n = ys.length - 1
  const K = Math.round(Math.log2(n))
  if (n < 1 || 2 ** K !== n) return {
      error: L(
        `Romberg con datos necesita 2ᵏ + 1 puntos equiespaciados (hay ${ys.length}: usa 2, 3, 5, 9, 17… puntos).`,
        `Romberg with data needs 2ᵏ + 1 equally spaced points (there are ${ys.length}: use 2, 3, 5, 9, 17… points).`,
      ),
    }
  const R: number[][] = []
  const hs: number[] = []
  const sums: number[] = [NaN]
  const len = xs[n] - xs[0]
  for (let k = 0; k <= K; k++) {
    const step = n / 2 ** k
    const h = len / 2 ** k
    let s = 0
    if (k > 0) for (let i = step; i < n; i += 2 * step) s += ys[i]
    const T0 = k === 0 ? (h / 2) * (ys[0] + ys[n]) : R[k - 1][0] / 2 + h * s
    if (k > 0) sums.push(s)
    hs.push(h)
    const row = [T0]
    for (let j = 1; j <= k; j++) row.push(row[j - 1] + (row[j - 1] - R[k - 1][j - 1]) / (4 ** j - 1))
    R.push(row)
  }
  return { R, hs, sums, converged: false, value: R[K][K], evals: n + 1, message: L(
    `Tabla completa con k_max = ${K} (los ${n + 1} datos); la mejor estimación es I₀⁽${sup(K)}⁾.`,
    `Full table with k_max = ${K} (all ${n + 1} data points); the best estimate is I₀⁽${sup(K)}⁾.`,
  ) }
}

/* ═════════════════════════ Gauss-Legendre ═════════════════════════ */

/** Pₙ(x) y Pₙ′(x) por la recurrencia de Bonnet. */
export function legendre(n: number, x: number): { p: number; dp: number } {
  let p0 = 1
  let p1 = x
  if (n === 0) return { p: 1, dp: 0 }
  for (let k = 2; k <= n; k++) {
    const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k
    p0 = p1
    p1 = p2
  }
  const dp = (n * (x * p1 - p0)) / (x * x - 1)
  return { p: p1, dp }
}

/**
 * Peso de Gauss con la fórmula del texto (ec. 5.39): w_{n,i} = −2 / [(n+1) Pₙ′(z_{n,i}) P_{n+1}(z_{n,i})].
 * Es equivalente a 2 / [(1 − z²) Pₙ′(z)²].
 */
export function pesoGaussLibro(n: number, z: number): number {
  return -2 / ((n + 1) * legendre(n, z).dp * legendre(n + 1, z).p)
}

const GL_CACHE = new Map<number, { t: number[]; w: number[] }>()

/** Nodos z_{n,i} (raíces de Pₙ) y pesos w_{n,i} en [−1, 1], orden creciente (en el código: t y w). */
export function gaussLegendre(n: number): { t: number[]; w: number[] } {
  const c = GL_CACHE.get(n)
  if (c) return c
  const t: number[] = new Array(n)
  const w: number[] = new Array(n)
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    let x = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5))
    for (let it = 0; it < 100; it++) {
      const { p, dp } = legendre(n, x)
      const dx = p / dp
      x -= dx
      if (Math.abs(dx) < 1e-16) break
    }
    const { dp } = legendre(n, x)
    const wi = 2 / ((1 - x * x) * dp * dp)
    t[i] = -x
    t[n - 1 - i] = x
    w[i] = wi
    w[n - 1 - i] = wi
  }
  if (n % 2 === 1) t[(n - 1) / 2] = 0
  const r = { t, w }
  GL_CACHE.set(n, r)
  return r
}

export function gaussQuad(f: Fn, a: number, b: number, n: number) {
  const { t, w } = gaussLegendre(n)
  const half = (b - a) / 2
  const mid = (a + b) / 2
  const xs = t.map((ti) => half * ti + mid)
  const fx = xs.map((x) => safe(f, x))
  let s = 0
  for (let i = 0; i < n; i++) s += w[i] * fx[i]
  return { value: half * s, t, w, xs, fx, half, mid }
}

/** Gauss-Legendre compuesta: m subintervalos con n puntos cada uno. */
export function gaussCompuesta(f: Fn, a: number, b: number, n: number, m: number): number {
  const H = (b - a) / m
  let s = 0
  for (let k = 0; k < m; k++) s += gaussQuad(f, a + k * H, a + (k + 1) * H, n).value
  return s
}

/** Constante del error de Gauss: E = K·(b−a)^{2n+1} f⁽²ⁿ⁾(ξ), K = (n!)⁴/((2n+1)[(2n)!]³). */
export function gaussErrConst(n: number): number {
  const fact = (k: number) => {
    let r = 1
    for (let i = 2; i <= k; i++) r *= i
    return r
  }
  return fact(n) ** 4 / ((2 * n + 1) * fact(2 * n) ** 3)
}

/* ═════════════════════════ Referencia adaptativa (Gauss-Kronrod 7-15) ═════════════════════════ */

const XGK = [0.991455371120812639206854697526329, 0.949107912342758524526189684047851, 0.864864423359769072789712788640926, 0.741531185599394439863864773280788, 0.586087235467691130294144845693013, 0.405845151377397166906606412076961, 0.207784955007898467600689403773245, 0]
const WGK = [0.02293532201052922496373200805897, 0.063092092629978553290700663189204, 0.104790010322250183839876322541518, 0.140653259715525918745189590510238, 0.16900472663926790282658342659855, 0.190350578064785409913256402421014, 0.204432940075298892414161999234649, 0.209482141084727828012999174891714]
const WG = [0.129484966168869693270611432679082, 0.27970539148927666790146777142378, 0.381830050505118944950369775488975, 0.417959183673469387755102040816327]

function gk15(f: Fn, a: number, b: number): { K: number; err: number } {
  const c = (a + b) / 2
  const h = (b - a) / 2
  const fc = safe(f, c)
  let K = WGK[7] * fc
  let G = WG[3] * fc
  for (let j = 0; j < 7; j++) {
    const dx = h * XGK[j]
    const s = safe(f, c - dx) + safe(f, c + dx)
    K += WGK[j] * s
    if (j % 2 === 1) G += WG[(j - 1) / 2] * s
  }
  return { K: K * h, err: Math.abs((K - G) * h) }
}

export interface AdaptResult {
  value: number
  err: number
  intervals: number
  ok: boolean
}

/** Integración adaptativa global (bisecta el subintervalo de mayor error). */
export function adaptiveGK(f: Fn, a: number, b: number, tol = 1e-13, maxIntervals = 2000): AdaptResult {
  if (a === b) return { value: 0, err: 0, intervals: 0, ok: true }
  const list: { a: number; b: number; K: number; err: number }[] = []
  const first = gk15(f, a, b)
  list.push({ a, b, ...first })
  let total = first.K
  let totErr = first.err
  while (list.length < maxIntervals) {
    if (!Number.isFinite(total)) return { value: NaN, err: Infinity, intervals: list.length, ok: false }
    if (totErr <= Math.max(tol, tol * Math.abs(total))) break
    let iMax = 0
    for (let i = 1; i < list.length; i++) if (list[i].err > list[iMax].err) iMax = i
    const it = list[iMax]
    const m = (it.a + it.b) / 2
    if (m === it.a || m === it.b) break
    const L = gk15(f, it.a, m)
    const R = gk15(f, m, it.b)
    list[iMax] = { a: it.a, b: m, ...L }
    list.push({ a: m, b: it.b, ...R })
    total = 0
    totErr = 0
    for (const s of list) {
      total += s.K
      totErr += s.err
    }
  }
  const ok = Number.isFinite(total) && totErr <= Math.max(1e-6, 1e-6 * Math.abs(total))
  return { value: total, err: totErr, intervals: list.length, ok }
}

/* ═════════════════════════ Integrales dobles ═════════════════════════ */

export type Rule2D = 'trapecio' | 'simpson13' | 'simpson38' | 'gauss'

export interface DoubleRow {
  i: number
  x: number
  c: number
  d: number
  k: number
  g: number
  /** peso exterior (entero cᵢ para NC o wᵢ para Gauss) */
  w: number
  ys: number[]
  fs: number[]
  wy: number[]
}

export interface DoubleResult {
  value: number
  h: number
  rows: DoubleRow[]
  evals: number
}

/** ∫ₐᵇ ∫_{c(x)}^{d(x)} f(x,y) dy dx por reglas iteradas (Newton-Cotes compuesta o Gauss). */
export function integralDoble(f: Fn2, a: number, b: number, c: Fn, d: Fn, rule: Rule2D, n: number, m: number): DoubleResult {
  const rows: DoubleRow[] = []
  let evals = 0
  const F = (x: number, y: number) => {
    evals++
    try {
      return f(x, y)
    } catch {
      return NaN
    }
  }
  if (rule === 'gauss') {
    const gx = gaussLegendre(n)
    const gy = gaussLegendre(m)
    const hx = (b - a) / 2
    let outer = 0
    gx.t.forEach((t, i) => {
      const x = hx * t + (a + b) / 2
      const ci = safe(c, x)
      const di = safe(d, x)
      const k = (di - ci) / 2
      const ys = gy.t.map((s) => k * s + (ci + di) / 2)
      const fs = ys.map((y) => F(x, y))
      const g = k * fs.reduce((acc, v, j) => acc + gy.w[j] * v, 0)
      rows.push({ i, x, c: ci, d: di, k, g, w: gx.w[i], ys, fs, wy: gy.w })
      outer += gx.w[i] * g
    })
    return { value: hx * outer, h: hx, rows, evals }
  }
  const def = NC[rule]
  const cx = ncCoefs(n, rule)
  const cy = ncCoefs(m, rule)
  const hx = (b - a) / n
  const fac = def.num / def.den
  let outer = 0
  for (let i = 0; i <= n; i++) {
    const x = i === n ? b : a + i * hx
    const ci = safe(c, x)
    const di = safe(d, x)
    const k = (di - ci) / m
    const ys = Array.from({ length: m + 1 }, (_, j) => (j === m ? di : ci + j * k))
    const fs = ys.map((y) => F(x, y))
    const g = fac * k * fs.reduce((acc, v, j) => acc + cy[j] * v, 0)
    rows.push({ i, x, c: ci, d: di, k, g, w: cx[i], ys, fs, wy: cy })
    outer += cx[i] * g
  }
  return { value: fac * hx * outer, h: hx, rows, evals }
}

/** Referencia numérica de alta precisión para la integral doble (GK adaptativo anidado). */
export function referenciaDoble(f: Fn2, a: number, b: number, c: Fn, d: Fn, tol = 1e-11): AdaptResult {
  let innerOk = true
  const g = (x: number) => {
    const r = adaptiveGK((y) => f(x, y), safe(c, x), safe(d, x), tol * 0.1, 300)
    if (!r.ok) innerOk = false
    return r.value
  }
  const r = adaptiveGK(g, a, b, tol, 300)
  return { ...r, ok: r.ok && innerOk }
}
