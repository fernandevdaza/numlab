// Algoritmos de interpolación (Tema 4). Funciones puras, sin dependencias.
// Polinomios: arreglo de coeficientes en orden ASCENDENTE  p[k] = coeficiente de x^k.

export type Poly = number[]

/* ───────────────────────── Polinomios ───────────────────────── */

export function polyAdd(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length)
  return Array.from({ length: n }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0))
}
export function polyScale(a: Poly, k: number): Poly {
  return a.map((c) => c * k)
}
export function polyMul(a: Poly, b: Poly): Poly {
  const out = new Array(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j]
  return out
}
/** Evaluación por Horner. */
export function polyEval(p: Poly, x: number): number {
  let s = 0
  for (let k = p.length - 1; k >= 0; k--) s = s * x + p[k]
  return s
}
/** Elimina coeficientes numéricamente nulos (ruido de redondeo). */
export function polyClean(p: Poly, rel = 1e-12): Poly {
  const m = Math.max(...p.map(Math.abs), 0)
  const q = p.map((c) => (Math.abs(c) <= rel * Math.max(m, 1) ? 0 : c))
  while (q.length > 1 && q[q.length - 1] === 0) q.pop()
  return q
}
export function polyDegree(p: Poly): number {
  const q = polyClean(p)
  return q.length === 1 && q[0] === 0 ? 0 : q.length - 1
}

/* ───────────────────────── Validación de nodos ───────────────────────── */

/** Devuelve los índices del primer par de nodos repetidos, o null. */
export function duplicateNodes(xs: number[]): [number, number] | null {
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++) {
      const scale = Math.max(Math.abs(xs[i]), Math.abs(xs[j]), 1)
      if (Math.abs(xs[i] - xs[j]) <= 1e-13 * scale) return [i, j]
    }
  return null
}

/** Paso h si los nodos están equiespaciados (y en orden), si no null. */
export function equiStep(xs: number[]): number | null {
  if (xs.length < 2) return null
  const h = xs[1] - xs[0]
  if (h === 0) return null
  const tol = 1e-9 * Math.max(Math.abs(h), 1e-300) + 1e-12 * Math.max(...xs.map(Math.abs))
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - xs[i - 1] - h) > tol) return null
  return h
}

export function factorial(n: number): number {
  let f = 1
  for (let k = 2; k <= n; k++) f *= k
  return f
}

/** w(x) = ∏ (x − x_i) */
export function nodeProduct(xs: number[], x: number): number {
  let p = 1
  for (const xi of xs) p *= x - xi
  return p
}

/**
 * Estimación del error (4.31) añadiendo un punto (x_{n+1}, y_{n+1}):
 * R_n(x) ≈ ∏(x − x_i) · f[x_0, …, x_n, x_{n+1}].
 */
export function extraPointEstimate(xs: number[], ys: number[], xe: number, ye: number, x: number): { dd: number; w: number; value: number } {
  const F = dividedDifferences([...xs, xe], [...ys, ye])
  const dd = F[0][xs.length]
  const w = nodeProduct(xs, x)
  return { dd, w, value: w * dd }
}

/* ───────────────────────── Lagrange ───────────────────────── */

export interface LagrangeResult {
  /** coeficientes de cada L_i(x) */
  basis: Poly[]
  /** denominador ∏_{j≠i} (x_i − x_j) */
  denoms: number[]
  /** P(x) = Σ y_i L_i(x) */
  coeffs: Poly
}

export function lagrange(xs: number[], ys: number[]): LagrangeResult {
  const n = xs.length
  const basis: Poly[] = []
  const denoms: number[] = []
  let P: Poly = [0]
  for (let i = 0; i < n; i++) {
    let num: Poly = [1]
    let den = 1
    for (let j = 0; j < n; j++) {
      if (j === i) continue
      num = polyMul(num, [-xs[j], 1])
      den *= xs[i] - xs[j]
    }
    const L = polyScale(num, 1 / den)
    basis.push(L)
    denoms.push(den)
    P = polyAdd(P, polyScale(L, ys[i]))
  }
  return { basis, denoms, coeffs: P }
}

/** Valores L_i(x) evaluados directamente con la forma producto. */
export function lagrangeBasisAt(xs: number[], x: number): number[] {
  return xs.map((xi, i) => {
    let v = 1
    xs.forEach((xj, j) => {
      if (j !== i) v *= (x - xj) / (xi - xj)
    })
    return v
  })
}

/* ───────────────────────── Diferencias divididas ───────────────────────── */

/** F[i][j] = f[x_i, …, x_{i+j}]  (j = orden). */
export function dividedDifferences(xs: number[], ys: number[]): number[][] {
  const n = xs.length
  const F: number[][] = xs.map((_, i) => [ys[i]])
  for (let j = 1; j < n; j++)
    for (let i = 0; i + j < n; i++) F[i][j] = (F[i + 1][j - 1] - F[i][j - 1]) / (xs[i + j] - xs[i])
  return F
}

/** Evaluación anidada (Horner generalizado) de la forma de Newton. */
export function newtonEval(xs: number[], a: number[], x: number): number {
  let s = a[a.length - 1]
  for (let k = a.length - 2; k >= 0; k--) s = s * (x - xs[k]) + a[k]
  return s
}

/** Convierte la forma de Newton a coeficientes en potencias de x. */
export function newtonToPoly(xs: number[], a: number[]): Poly {
  let p: Poly = [a[a.length - 1]]
  for (let k = a.length - 2; k >= 0; k--) p = polyAdd(polyMul(p, [-xs[k], 1]), [a[k]])
  return p
}

/* ───────────────────────── Diferencias finitas ───────────────────────── */

/** D[k][i] = Δ^k y_i  (k = 0..n, i = 0..n−k). */
export function forwardDifferences(ys: number[]): number[][] {
  const D: number[][] = [ys.slice()]
  for (let k = 1; k < ys.length; k++) {
    const prev = D[k - 1]
    D.push(prev.slice(1).map((v, i) => v - prev[i]))
  }
  return D
}

export interface FiniteTerm {
  k: number
  /** coeficiente binomial generalizado */
  coef: number
  /** Δ^k y_0  o  ∇^k y_n */
  delta: number
  value: number
}
export interface FiniteResult {
  s: number
  terms: FiniteTerm[]
  value: number
}

/** C(s, k) = s(s−1)…(s−k+1)/k! */
export function binomGen(s: number, k: number): number {
  let p = 1
  for (let m = 0; m < k; m++) p *= (s - m) / (m + 1)
  return p
}
/** s(s+1)…(s+k−1)/k!  = C(s+k−1, k) */
export function binomRising(s: number, k: number): number {
  let p = 1
  for (let m = 0; m < k; m++) p *= (s + m) / (m + 1)
  return p
}

/**
 * Diferencias finitas de avance (4.24): P_m(s) = Σ_{k=0}^{m} s(s−1)…(s−k+1)/k! · Δ^k f(x_k0),  s = (x − x_k0)/h.
 * `deltas[k]` = Δ^k f(x_k0) (x_k0 = nodo de apoyo).
 */
export function newtonForward(deltas: number[], xk: number, h: number, x: number): FiniteResult {
  const s = (x - xk) / h
  const terms = deltas.map((delta, k) => {
    const coef = binomGen(s, k)
    return { k, coef, delta, value: coef * delta }
  })
  return { s, terms, value: terms.reduce((a, t) => a + t.value, 0) }
}

/**
 * Diferencias finitas de retroceso (4.28): P_m(s) = Σ_{k=0}^{m} s(s+1)…(s+k−1)/k! · ∇^k f(x_k0),  s = (x − x_k0)/h.
 * Para s ≤ 0 coincide con la forma del texto Σ (−1)^k C(|s|, k) ∇^k f(x_k0).  `nablas[k]` = ∇^k f(x_k0).
 */
export function newtonBackward(nablas: number[], xk: number, h: number, x: number): FiniteResult {
  const s = (x - xk) / h
  const terms = nablas.map((delta, k) => {
    const coef = binomRising(s, k)
    return { k, coef, delta, value: coef * delta }
  })
  return { s, terms, value: terms.reduce((a, t) => a + t.value, 0) }
}

export type Direction = 'avance' | 'retroceso'

/**
 * Índices de los nodos que usa un polinomio de grado m «apoyado en x_k» (terminología del texto):
 * avance → x_k, x_{k+1}, …, x_{k+m};  retroceso → x_k, x_{k−1}, …, x_{k−m}.  null si no hay datos suficientes.
 */
export function supportIndices(n: number, k: number, m: number, dir: Direction): number[] | null {
  if (!Number.isInteger(k) || !Number.isInteger(m) || m < 0 || k < 0 || k > n) return null
  if (dir === 'avance' ? k + m > n : k - m < 0) return null
  return Array.from({ length: m + 1 }, (_, j) => (dir === 'avance' ? k + j : k - j))
}

/**
 * Coeficientes de Newton tomados de la tabla de diferencias divididas F (F[i][j] = f[x_i,…,x_{i+j}]).
 * avance (4.17): a_j = f[x_k,…,x_{k+j}] = F[k][j];  retroceso (4.19): a_j = f[x_{k−j},…,x_k] = F[k−j][j].
 * El polinomio es a_0 + a_1(x − z_0) + a_2(x − z_0)(x − z_1) + …  con z = nodos en el orden de `supportIndices`.
 */
export function newtonCoefs(F: number[][], k: number, m: number, dir: Direction): number[] {
  return Array.from({ length: m + 1 }, (_, j) => (dir === 'avance' ? F[k][j] : F[k - j][j]))
}

/** Δ^j f(x_k) (avance) o ∇^j f(x_k) = Δ^j f(x_{k−j}) (retroceso), j = 0..m, leídos de la tabla D[j][i] = Δ^j f(x_i). */
export function finiteCoefs(D: number[][], k: number, m: number, dir: Direction): number[] {
  return Array.from({ length: m + 1 }, (_, j) => (dir === 'avance' ? D[j][k] : D[j][k - j]))
}

/* ───────────────────────── Runge / Chebyshev ───────────────────────── */

/** n+1 nodos de Chebyshev en [a,b], ordenados de menor a mayor. */
export function chebyshevNodes(a: number, b: number, n: number): number[] {
  const out: number[] = []
  for (let k = 0; k <= n; k++) out.push((a + b) / 2 + ((b - a) / 2) * Math.cos(((2 * k + 1) * Math.PI) / (2 * (n + 1))))
  return out.reverse()
}
export function equiNodes(a: number, b: number, n: number): number[] {
  return Array.from({ length: n + 1 }, (_, k) => (n === 0 ? (a + b) / 2 : a + ((b - a) * k) / n))
}

/** Pesos baricéntricos w_i = 1/∏_{j≠i}(x_i − x_j) (evaluación estable de Lagrange). */
export function baryWeights(xs: number[]): number[] {
  return xs.map((xi, i) => {
    let p = 1
    xs.forEach((xj, j) => {
      if (j !== i) p *= xi - xj
    })
    return 1 / p
  })
}
export function baryEval(xs: number[], ys: number[], w: number[], x: number): number {
  let num = 0
  let den = 0
  for (let i = 0; i < xs.length; i++) {
    const d = x - xs[i]
    if (d === 0) return ys[i]
    const t = w[i] / d
    num += t * ys[i]
    den += t
  }
  return num / den
}

/* ───────────────────────── Splines cúbicos ───────────────────────── */

export type SplineBC = 'natural' | 'sujeto'

export interface Spline {
  bc: SplineBC
  xs: number[]
  h: number[]
  a: number[]
  b: number[]
  c: number[]
  d: number[]
  /** sistema tridiagonal completo (n+1)×(n+1) para c_0 … c_n */
  A: number[][]
  r: number[]
}

/** Resuelve un sistema tridiagonal (algoritmo de Thomas). lo[i] = A[i][i−1], di = A[i][i], up[i] = A[i][i+1]. */
export function thomas(lo: number[], di: number[], up: number[], r: number[]): number[] {
  const n = di.length
  const cp = new Array(n).fill(0)
  const dp = new Array(n).fill(0)
  cp[0] = up[0] / di[0]
  dp[0] = r[0] / di[0]
  for (let i = 1; i < n; i++) {
    const m = di[i] - lo[i] * cp[i - 1]
    cp[i] = i < n - 1 ? up[i] / m : 0
    dp[i] = (r[i] - lo[i] * dp[i - 1]) / m
  }
  const x = new Array(n).fill(0)
  x[n - 1] = dp[n - 1]
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1]
  return x
}

/**
 * Spline cúbico S_i(x) = a_i + b_i(x−x_i) + c_i(x−x_i)² + d_i(x−x_i)³ en [x_i, x_{i+1}]
 * (notación de Burden & Faires). Los nodos deben estar en orden creciente.
 */
export function cubicSpline(xs: number[], ys: number[], bc: SplineBC, fpa = 0, fpb = 0): Spline {
  const n = xs.length - 1
  const h = Array.from({ length: n }, (_, i) => xs[i + 1] - xs[i])
  const a = ys.slice()
  const A: number[][] = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0))
  const r = new Array(n + 1).fill(0)
  if (bc === 'natural') {
    A[0][0] = 1
    A[n][n] = 1
  } else {
    A[0][0] = 2 * h[0]
    A[0][1] = h[0]
    r[0] = (3 * (a[1] - a[0])) / h[0] - 3 * fpa
    A[n][n - 1] = h[n - 1]
    A[n][n] = 2 * h[n - 1]
    r[n] = 3 * fpb - (3 * (a[n] - a[n - 1])) / h[n - 1]
  }
  for (let i = 1; i < n; i++) {
    A[i][i - 1] = h[i - 1]
    A[i][i] = 2 * (h[i - 1] + h[i])
    A[i][i + 1] = h[i]
    r[i] = (3 * (a[i + 1] - a[i])) / h[i] - (3 * (a[i] - a[i - 1])) / h[i - 1]
  }
  const lo = A.map((row, i) => (i > 0 ? row[i - 1] : 0))
  const di = A.map((row, i) => row[i])
  const up = A.map((row, i) => (i < n ? row[i + 1] : 0))
  const c = thomas(lo, di, up, r)
  const b: number[] = []
  const d: number[] = []
  for (let i = 0; i < n; i++) {
    b.push((a[i + 1] - a[i]) / h[i] - (h[i] * (c[i + 1] + 2 * c[i])) / 3)
    d.push((c[i + 1] - c[i]) / (3 * h[i]))
  }
  return { bc, xs: xs.slice(), h, a, b, c, d, A, r }
}

/** Índice del tramo que contiene x (extrapola con los tramos extremos). */
export function splineInterval(sp: Spline, x: number): number {
  const n = sp.xs.length - 1
  if (x <= sp.xs[0]) return 0
  for (let i = 0; i < n; i++) if (x <= sp.xs[i + 1]) return i
  return n - 1
}
export function splineEval(sp: Spline, x: number): number {
  const i = splineInterval(sp, x)
  const t = x - sp.xs[i]
  return sp.a[i] + t * (sp.b[i] + t * (sp.c[i] + t * sp.d[i]))
}
/** Derivadas S', S'' (para verificar condiciones de frontera). */
export function splineDeriv(sp: Spline, x: number, order: 1 | 2): number {
  const i = splineInterval(sp, x)
  const t = x - sp.xs[i]
  return order === 1 ? sp.b[i] + 2 * sp.c[i] * t + 3 * sp.d[i] * t * t : 2 * sp.c[i] + 6 * sp.d[i] * t
}

/* ──────────── Splines cúbicas: formulación del texto (segundas derivadas M_i) ──────────── */

export interface SplineM {
  bc: SplineBC
  xs: number[]
  ys: number[]
  h: number[]
  /** M_i = S''(x_i), i = 0..n */
  M: number[]
  /** índices de las incógnitas del sistema: 0..n (forzada, 4.41) o 1..n−1 (natural, 4.42) */
  idx: number[]
  /** sistema tridiagonal H·M = Y tal como lo plantea el texto (4.43)/(4.44) */
  A: number[][]
  r: number[]
}

/**
 * Spline cúbica del texto (4.38)–(4.42). Ecuaciones interiores, i = 1..n−1:
 *   h_{i−1}/6·M_{i−1} + (h_{i−1}+h_i)/3·M_i + h_i/6·M_{i+1} = (y_{i+1}−y_i)/h_i − (y_i−y_{i−1})/h_{i−1}
 * Forzada (primera derivada): h_0/3·M_0 + h_0/6·M_1 = (y_1−y_0)/h_0 − y'_0,
 *                             h_{n−1}/6·M_{n−1} + h_{n−1}/3·M_n = y'_n − (y_n−y_{n−1})/h_{n−1}.
 * Natural (segunda derivada): M_0 = M_n = 0 y el sistema queda de n−1 ecuaciones.
 * Se resuelve con el método de Thomas. Los nodos deben estar en orden creciente.
 */
export function cubicSplineM(xs: number[], ys: number[], bc: SplineBC, fpa = 0, fpb = 0): SplineM {
  const n = xs.length - 1
  const h = Array.from({ length: n }, (_, i) => xs[i + 1] - xs[i])
  const slope = (i: number) => (ys[i + 1] - ys[i]) / h[i]
  const idx = bc === 'natural' ? Array.from({ length: Math.max(n - 1, 0) }, (_, j) => j + 1) : Array.from({ length: n + 1 }, (_, j) => j)
  const N = idx.length
  const A: number[][] = Array.from({ length: N }, () => new Array(N).fill(0))
  const r = new Array(N).fill(0)
  idx.forEach((i, row) => {
    const col = (j: number) => idx.indexOf(j)
    const put = (j: number, v: number) => {
      const c = col(j)
      if (c >= 0) A[row][c] += v
    }
    if (i === 0) {
      put(0, h[0] / 3)
      put(1, h[0] / 6)
      r[row] = slope(0) - fpa
    } else if (i === n) {
      put(n - 1, h[n - 1] / 6)
      put(n, h[n - 1] / 3)
      r[row] = fpb - slope(n - 1)
    } else {
      put(i - 1, h[i - 1] / 6)
      put(i, (h[i - 1] + h[i]) / 3)
      put(i + 1, h[i] / 6)
      r[row] = slope(i) - slope(i - 1)
    }
  })
  const M = new Array(n + 1).fill(0)
  if (N > 0) {
    const lo = A.map((row, i) => (i > 0 ? row[i - 1] : 0))
    const di = A.map((row, i) => row[i])
    const up = A.map((row, i) => (i < N - 1 ? row[i + 1] : 0))
    const sol = thomas(lo, di, up, r)
    idx.forEach((i, j) => (M[i] = sol[j]))
  }
  return { bc, xs: xs.slice(), ys: ys.slice(), h, M, idx, A, r }
}

/** Índice del tramo [x_i, x_{i+1}] que contiene x (extrapola con los tramos extremos). */
export function nodeInterval(xs: number[], x: number): number {
  const n = xs.length - 1
  if (x <= xs[0]) return 0
  for (let i = 0; i < n; i++) if (x <= xs[i + 1]) return i
  return n - 1
}

/** (4.40): S_i(x) = [(x_{i+1}−x)³M_i + (x−x_i)³M_{i+1}]/(6h_i) + [(x_{i+1}−x)y_i + (x−x_i)y_{i+1}]/h_i − h_i/6·[(x_{i+1}−x)M_i + (x−x_i)M_{i+1}] */
export function splineMEval(sp: SplineM, x: number, i = nodeInterval(sp.xs, x)): number {
  const { xs, ys, h, M } = sp
  const u = xs[i + 1] - x
  const v = x - xs[i]
  return (u ** 3 * M[i] + v ** 3 * M[i + 1]) / (6 * h[i]) + (u * ys[i] + v * ys[i + 1]) / h[i] - (h[i] / 6) * (u * M[i] + v * M[i + 1])
}

/** Tramo S_i desarrollado en potencias de x (definición del texto S_i(x) = a_i + b_i x + c_i x² + d_i x³). */
export function splineMPiece(sp: SplineM, i: number): Poly {
  const { xs, ys, h, M } = sp
  const U: Poly = [xs[i + 1], -1] // x_{i+1} − x
  const V: Poly = [-xs[i], 1] // x − x_i
  const cube = (p: Poly) => polyMul(p, polyMul(p, p))
  let P = polyAdd(polyScale(cube(U), M[i] / (6 * h[i])), polyScale(cube(V), M[i + 1] / (6 * h[i])))
  P = polyAdd(P, polyScale(U, ys[i] / h[i] - (h[i] * M[i]) / 6))
  P = polyAdd(P, polyScale(V, ys[i + 1] / h[i] - (h[i] * M[i + 1]) / 6))
  return P
}

/* ───────────────────────── Utilidades ───────────────────────── */

/** Aproxima x por una fracción p/q con q ≤ maxDen, si es (casi) exacta. */
export function toFraction(x: number, maxDen = 10000): [number, number] | null {
  if (!Number.isFinite(x)) return null
  if (Number.isInteger(x)) return [x, 1]
  const sign = x < 0 ? -1 : 1
  let v = Math.abs(x)
  let h0 = 0, h1 = 1, k0 = 1, k1 = 0
  for (let it = 0; it < 30; it++) {
    const ai = Math.floor(v)
    const h2 = ai * h1 + h0
    const k2 = ai * k1 + k0
    if (k2 > maxDen) break
    h0 = h1; h1 = h2; k0 = k1; k1 = k2
    if (Math.abs(Math.abs(x) - h1 / k1) <= 1e-11 * Math.max(1, Math.abs(x))) return [sign * h1, k1]
    const frac = v - ai
    if (frac < 1e-15) break
    v = 1 / frac
  }
  return null
}

/** Máximo de |g| muestreando N+1 puntos en [a,b]; devuelve también dónde. */
export function maxAbsSample(g: (x: number) => number, a: number, b: number, N = 2000): { max: number; at: number; min: number; minAt: number } {
  let max = -Infinity, at = a, min = Infinity, minAt = a
  for (let k = 0; k <= N; k++) {
    const x = a + ((b - a) * k) / N
    const v = Math.abs(g(x))
    if (!Number.isFinite(v)) continue
    if (v > max) { max = v; at = x }
    if (v < min) { min = v; minAt = x }
  }
  return { max, at, min, minAt }
}
