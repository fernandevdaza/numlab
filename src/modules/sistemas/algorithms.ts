// Algoritmos del Tema 3: sistemas de ecuaciones lineales y no lineales, valores propios.
// Funciones puras: devuelven toda la información intermedia para el "paso a paso".
import { clone, eye, inverse, luFactor, luSolve, matVec, norm1, norm2, normInf, normInfM, solve, spectralRadius, transpose, vsub, type Mat, type Vec } from './linalg.ts'
import { L as tr } from '../../i18n.ts' // `L` es la matriz triangular inferior en este archivo

export * from './linalg.ts'

/* ═══════════════════════ Aritmética de t cifras ═══════════════════════ */

/**
 * Redondeo a t cifras significativas (calculadora decimal con t dígitos en la mantisa, redondeo al más cercano,
 * empates hacia afuera), como en los ejemplos 3.1 y 3.2 del texto. t = 0 ⇒ sin redondeo (doble precisión).
 */
export function fl(x: number, t: number): number {
  if (!t || x === 0 || !Number.isFinite(x)) return x
  const ax = Math.abs(x)
  let e = Number(ax.toExponential().split('e')[1]) - t + 1
  // toPrecision(12) elimina el ruido binario (p. ej. 1336.4999999999998 → 1336.5) antes de redondear
  let m = Math.round(Number((ax / 10 ** e).toPrecision(12)))
  if (m >= 10 ** t) {
    m = Math.round(m / 10)
    e++
  }
  return Number(`${x < 0 ? '-' : ''}${m}e${e}`)
}

/* ═══════════════════════ Eliminación de Gauss ═══════════════════════ */

export type Pivot = 'none' | 'parcial' | 'escalado'

export interface GaussStep {
  k: number
  /** filas intercambiadas (0-indexadas) */
  swap: [number, number] | null
  pivot: number
  /** razones |a_ik|/s_i usadas en el pivoteo escalado */
  ratios?: number[]
  mult: { i: number; m: number }[]
  /** matriz aumentada tras el intercambio (antes de eliminar) */
  before: Mat
  /** matriz aumentada tras eliminar la columna k */
  after: Mat
}

export interface BackStep {
  i: number
  rhs: number
  terms: [number, number][]
  diag: number
  x: number
}

/** Operaciones contadas como en la tabla del texto (sección "Rapidez del método de Gauss"). */
export interface GaussOps {
  /** triangularización de la matriz A (sin contar el vector b) */
  tri: { sub: number; mul: number; div: number }
  /** transformación del vector b durante la triangularización */
  rhs: { sub: number; mul: number }
  /** sustitución regresiva */
  back: { sub: number; mul: number; div: number }
}

export interface GaussResult {
  ok: boolean
  error?: string
  aug0: Mat
  steps: GaussStep[]
  /** matriz aumentada final [U | c] */
  aug: Mat
  back: BackStep[]
  x: Vec
  det: number
  swaps: number
  ops: GaussOps
  residual: Vec
}

/**
 * Gauss con pivoteo (texto, §3.2.1). `t` > 0 simula una calculadora de t cifras significativas: se redondea
 * cada dato y el resultado de cada operación elemental (Ej. 3.1).
 */
export function gauss(A: Mat, b: Vec, pivot: Pivot, t = 0): GaussResult {
  const R = (x: number) => fl(x, t)
  const n = A.length
  const M = A.map((r, i) => [...r, b[i]].map(R))
  const aug0 = clone(M)
  const steps: GaussStep[] = []
  const ops: GaussOps = { tri: { sub: 0, mul: 0, div: 0 }, rhs: { sub: 0, mul: 0 }, back: { sub: 0, mul: 0, div: 0 } }
  const scale = normInfM(A) || 1
  const s = M.map((r) => Math.max(...r.slice(0, n).map(Math.abs)))
  let swaps = 0
  const fail = (error: string): GaussResult => ({ ok: false, error, aug0, steps, aug: M, back: [], x: [], det: 0, swaps, ops, residual: [] })
  for (let k = 0; k < n - 1; k++) {
    let p = k
    let ratios: number[] | undefined
    if (pivot === 'parcial') {
      for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i
    } else if (pivot === 'escalado') {
      ratios = []
      for (let i = k; i < n; i++) ratios.push(s[i] ? Math.abs(M[i][k]) / s[i] : 0)
      for (let i = k + 1; i < n; i++) if (ratios[i - k] > ratios[p - k]) p = i
    } else if (M[k][k] === 0) {
      // sin pivoteo: sólo se intercambia si el pivote es exactamente cero
      for (let i = k + 1; i < n; i++)
        if (M[i][k] !== 0) {
          p = i
          break
        }
    }
    let swap: [number, number] | null = null
    if (p !== k) {
      ;[M[p], M[k]] = [M[k], M[p]]
      if (pivot === 'escalado') [s[p], s[k]] = [s[k], s[p]]
      swap = [k, p]
      swaps++
    }
    const before = clone(M)
    const piv = M[k][k]
    if (Math.abs(piv) <= 1e-14 * scale) return fail(tr(`Pivote nulo en la columna ${k + 1}: toda la columna bajo la diagonal es cero ⇒ la matriz es singular (det A = 0). El sistema no tiene solución única.`, `Zero pivot in column ${k + 1}: the whole column below the diagonal is zero ⇒ the matrix is singular (det A = 0). The system has no unique solution.`))
    const mult: { i: number; m: number }[] = []
    for (let i = k + 1; i < n; i++) {
      const m = R(M[i][k] / piv)
      ops.tri.div++
      mult.push({ i, m })
      M[i][k] = 0
      for (let j = k + 1; j <= n; j++) {
        M[i][j] = R(M[i][j] - R(m * M[k][j]))
        if (j < n) {
          ops.tri.mul++
          ops.tri.sub++
        } else {
          ops.rhs.mul++
          ops.rhs.sub++
        }
      }
    }
    steps.push({ k, swap, pivot: piv, ratios, mult, before, after: clone(M) })
  }
  if (Math.abs(M[n - 1][n - 1]) <= 1e-14 * scale) return fail(tr(`El último pivote a₍${n}${n}₎ es cero ⇒ la matriz es singular (det A = 0). El sistema es incompatible o tiene infinitas soluciones.`, `The last pivot a₍${n}${n}₎ is zero ⇒ the matrix is singular (det A = 0). The system is inconsistent or has infinitely many solutions.`))
  const x = new Array(n).fill(0)
  const back: BackStep[] = []
  for (let i = n - 1; i >= 0; i--) {
    const terms: [number, number][] = []
    let acc = M[i][n]
    for (let j = i + 1; j < n; j++) {
      terms.push([M[i][j], x[j]])
      acc = R(acc - R(M[i][j] * x[j]))
      ops.back.mul++
      ops.back.sub++
    }
    x[i] = R(acc / M[i][i])
    ops.back.div++
    back.unshift({ i, rhs: M[i][n], terms, diag: M[i][i], x: x[i] })
  }
  const d = M.reduce((p, r, i) => p * r[i], swaps % 2 ? -1 : 1)
  return { ok: true, aug0, steps, aug: M, back, x, det: d, swaps, ops, residual: vsub(b, matVec(A, x)) }
}

/**
 * Número de operaciones de Gauss según la tabla del texto (sin pivoteo y sin contar la transformación de b,
 * que añade (n−1)n/2 multiplicaciones y (n−1)n/2 restas).
 */
export function gaussOps(n: number) {
  const sq = ((n - 1) * n * (2 * n - 1)) / 6
  const tri = { sub: sq, mul: sq, div: ((n - 1) * n) / 2 }
  const back = { sub: ((n - 1) * n) / 2, mul: ((n - 1) * n) / 2, div: n }
  return { tri, back, total: tri.sub + tri.mul + tri.div + back.sub + back.mul + back.div }
}

/* ═══════════════════════ Factorización LU ═══════════════════════ */

export type LUKind = 'doolittle' | 'pivoteo' | 'crout' | 'cholesky'

/** Cálculo de una entrada: value = (a − Σ p·q) / div   ó   √(a − Σ p·q) */
export interface Entry {
  M: 'L' | 'U'
  i: number
  j: number
  a: number
  terms: [number, number][]
  div?: number
  sqrt?: boolean
  value: number
}

export interface LUStep {
  k: number
  swap: [number, number] | null
  mult: { i: number; m: number }[]
  U: Mat
}

export interface SubstStep {
  i: number
  rhs: number
  terms: [number, number][]
  diag: number
  value: number
}

export interface LUResult {
  ok: boolean
  error?: string
  L: Mat
  U: Mat
  P: Mat
  perm: number[]
  entries: Entry[]
  steps: LUStep[]
  Pb: Vec
  y: Vec
  x: Vec
  fwd: SubstStep[]
  bwd: SubstStep[]
  det: number
  residual: Vec
}

/**
 * Factorización LU (texto, §3.2.3): Doolittle (lᵢᵢ = 1, el método que desarrolla el texto) o Crout (uᵢᵢ = 1),
 * más PA = LU con pivoteo parcial y Cholesky como complementos. `t` > 0 simula aritmética de t cifras (Ej. 3.2).
 */
export function lu(A0: Mat, b0: Vec, kind: LUKind, t = 0): LUResult {
  const R = (x: number) => fl(x, t)
  const A = A0.map((r) => r.map(R))
  const b = b0.map(R)
  const n = A.length
  const L = eye(n).map((r) => r.map(() => 0))
  const U = eye(n).map((r) => r.map(() => 0))
  let perm = Array.from({ length: n }, (_, i) => i)
  const entries: Entry[] = []
  const steps: LUStep[] = []
  const scale = normInfM(A) || 1
  const tiny = (v: number) => Math.abs(v) <= 1e-14 * scale
  const fail = (error: string): LUResult => ({ ok: false, error, L, U, P: eye(n), perm, entries, steps, Pb: [], y: [], x: [], fwd: [], bwd: [], det: 0, residual: [] })
  let sign = 1

  if (kind === 'doolittle') {
    for (let k = 0; k < n; k++) {
      L[k][k] = 1
      for (let j = k; j < n; j++) {
        const terms: [number, number][] = []
        let v = A[k][j]
        for (let m = 0; m < k; m++) {
          terms.push([L[k][m], U[m][j]])
          v = R(v - R(L[k][m] * U[m][j]))
        }
        U[k][j] = v
        entries.push({ M: 'U', i: k, j, a: A[k][j], terms, value: v })
      }
      if (tiny(U[k][k]) && k < n - 1) return fail(tr(`u₍${k + 1}${k + 1}₎ = 0: Doolittle sin pivoteo no puede continuar. Reordena las ecuaciones o usa la variante con pivoteo parcial (PA = LU).`, `u₍${k + 1}${k + 1}₎ = 0: Doolittle without pivoting cannot continue. Reorder the equations or use the partial-pivoting variant (PA = LU).`))
      for (let i = k + 1; i < n; i++) {
        const terms: [number, number][] = []
        let v = A[i][k]
        for (let m = 0; m < k; m++) {
          terms.push([L[i][m], U[m][k]])
          v = R(v - R(L[i][m] * U[m][k]))
        }
        L[i][k] = R(v / U[k][k])
        entries.push({ M: 'L', i, j: k, a: A[i][k], terms, div: U[k][k], value: L[i][k] })
      }
    }
  } else if (kind === 'crout') {
    for (let k = 0; k < n; k++) {
      U[k][k] = 1
      for (let i = k; i < n; i++) {
        const terms: [number, number][] = []
        let v = A[i][k]
        for (let m = 0; m < k; m++) {
          terms.push([L[i][m], U[m][k]])
          v = R(v - R(L[i][m] * U[m][k]))
        }
        L[i][k] = v
        entries.push({ M: 'L', i, j: k, a: A[i][k], terms, value: v })
      }
      if (tiny(L[k][k]) && k < n - 1) return fail(tr(`l₍${k + 1}${k + 1}₎ = 0: Crout sin pivoteo no puede continuar. Reordena las ecuaciones.`, `l₍${k + 1}${k + 1}₎ = 0: Crout without pivoting cannot continue. Reorder the equations.`))
      for (let j = k + 1; j < n; j++) {
        const terms: [number, number][] = []
        let v = A[k][j]
        for (let m = 0; m < k; m++) {
          terms.push([L[k][m], U[m][j]])
          v = R(v - R(L[k][m] * U[m][j]))
        }
        U[k][j] = R(v / L[k][k])
        entries.push({ M: 'U', i: k, j, a: A[k][j], terms, div: L[k][k], value: U[k][j] })
      }
    }
  } else if (kind === 'cholesky') {
    for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) if (Math.abs(A[i][j] - A[j][i]) > 1e-12 * scale) return fail(tr('Cholesky requiere una matriz simétrica (A = Aᵀ).', 'Cholesky requires a symmetric matrix (A = Aᵀ).'))
    for (let j = 0; j < n; j++) {
      const terms: [number, number][] = []
      let v = A[j][j]
      for (let m = 0; m < j; m++) {
        terms.push([L[j][m], L[j][m]])
        v = R(v - R(L[j][m] ** 2))
      }
      if (!(v > 0)) return fail(tr(`a₍${j + 1}${j + 1}₎ − Σ l²₍${j + 1}k₎ = ${v.toPrecision(6)} ≤ 0: la matriz no es definida positiva, Cholesky no existe.`, `a₍${j + 1}${j + 1}₎ − Σ l²₍${j + 1}k₎ = ${v.toPrecision(6)} ≤ 0: the matrix is not positive definite, so the Cholesky factorization does not exist.`))
      L[j][j] = R(Math.sqrt(v))
      entries.push({ M: 'L', i: j, j, a: A[j][j], terms, sqrt: true, value: L[j][j] })
      for (let i = j + 1; i < n; i++) {
        const tt: [number, number][] = []
        let w = A[i][j]
        for (let m = 0; m < j; m++) {
          tt.push([L[i][m], L[j][m]])
          w = R(w - R(L[i][m] * L[j][m]))
        }
        L[i][j] = R(w / L[j][j])
        entries.push({ M: 'L', i, j, a: A[i][j], terms: tt, div: L[j][j], value: L[i][j] })
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) U[i][j] = L[j][i]
  } else {
    // Eliminación con pivoteo parcial: PA = LU
    const W = clone(A)
    const Lm = eye(n).map((r) => r.map(() => 0))
    for (let k = 0; k < n; k++) {
      let p = k
      for (let i = k + 1; i < n; i++) if (Math.abs(W[i][k]) > Math.abs(W[p][k])) p = i
      let swap: [number, number] | null = null
      if (p !== k) {
        ;[W[p], W[k]] = [W[k], W[p]]
        ;[Lm[p], Lm[k]] = [Lm[k], Lm[p]]
        ;[perm[p], perm[k]] = [perm[k], perm[p]]
        swap = [k, p]
        sign = -sign
      }
      if (tiny(W[k][k])) return fail(tr(`Pivote nulo en la columna ${k + 1} incluso con pivoteo ⇒ la matriz es singular (det A = 0).`, `Zero pivot in column ${k + 1} even with pivoting ⇒ the matrix is singular (det A = 0).`))
      const mult: { i: number; m: number }[] = []
      for (let i = k + 1; i < n; i++) {
        const m = R(W[i][k] / W[k][k])
        Lm[i][k] = m
        mult.push({ i, m })
        W[i][k] = 0
        for (let j = k + 1; j < n; j++) W[i][j] = R(W[i][j] - R(m * W[k][j]))
      }
      if (k < n - 1 || swap) steps.push({ k, swap, mult, U: clone(W) })
    }
    for (let i = 0; i < n; i++) {
      Lm[i][i] = 1
      for (let j = 0; j < n; j++) {
        L[i][j] = Lm[i][j]
        U[i][j] = W[i][j]
      }
    }
  }
  const diagProd = Array.from({ length: n }, (_, i) => L[i][i] * U[i][i]).reduce((a, v) => a * v, sign)
  if (tiny(U[n - 1][n - 1]) || tiny(L[n - 1][n - 1])) return fail(tr('El último elemento diagonal es cero ⇒ la matriz es singular (det A = 0); la factorización existe pero el sistema no tiene solución única.', 'The last diagonal entry is zero ⇒ the matrix is singular (det A = 0); the factorization exists but the system has no unique solution.'))
  const P = perm.map((p) => eye(n)[p])
  const Pb = perm.map((p) => b[p])
  const y = new Array(n).fill(0)
  const fwd: SubstStep[] = []
  for (let i = 0; i < n; i++) {
    const terms: [number, number][] = []
    let v = Pb[i]
    for (let j = 0; j < i; j++) {
      terms.push([L[i][j], y[j]])
      v = R(v - R(L[i][j] * y[j]))
    }
    y[i] = L[i][i] === 1 ? v : R(v / L[i][i])
    fwd.push({ i, rhs: Pb[i], terms, diag: L[i][i], value: y[i] })
  }
  const x = new Array(n).fill(0)
  const bwd: SubstStep[] = []
  for (let i = n - 1; i >= 0; i--) {
    const terms: [number, number][] = []
    let v = y[i]
    for (let j = i + 1; j < n; j++) {
      terms.push([U[i][j], x[j]])
      v = R(v - R(U[i][j] * x[j]))
    }
    x[i] = U[i][i] === 1 ? v : R(v / U[i][i])
    bwd.unshift({ i, rhs: y[i], terms, diag: U[i][i], value: x[i] })
  }
  return { ok: true, L, U, P, perm, entries, steps, Pb, y, x, fwd, bwd, det: diagProd, residual: vsub(b0, matVec(A0, x)) }
}

/* ═══════════════════════ Thomas (tridiagonal) ═══════════════════════ */

export interface ThomasRow {
  i: number
  a: number
  b: number
  c: number
  d: number
  /** factor a₍ᵢ₎ / b₍ᵢ₋₁₎⁽ⁱ⁻²⁾ con el que se anula el elemento bajo la diagonal (NaN en la fila 1) */
  m: number
  /** diagonal transformada b₍ᵢ₎⁽ⁱ⁻¹⁾ (fórmula 3.8 del texto) */
  bk: number
  /** lado derecho transformado d₍ᵢ₎⁽ⁱ⁻¹⁾ */
  dk: number
  /** = bk (denominador bᵢ − aᵢc′ᵢ₋₁ de la variante normalizada) */
  den: number
  /** variante normalizada: c′ᵢ = cᵢ / bk, d′ᵢ = dk / bk */
  cp: number
  dp: number
  x: number
}

export interface ThomasResult {
  ok: boolean
  error?: string
  rows: ThomasRow[]
  x: Vec
}

/**
 * Método de Thomas tal como lo presenta el texto (§3.2.2, fórmulas 3.8–3.9): se anula el único elemento bajo la
 * diagonal, los cᵢ no cambian, y luego sustitución regresiva xₖ = (dₖ − cₖxₖ₊₁)/bₖ.
 * a: subdiagonal a₂…aₙ (n−1), b: diagonal (n), c: superdiagonal c₁…cₙ₋₁ (n−1), d: lado derecho (n).
 * `t` > 0 simula aritmética de t cifras significativas.
 */
export function thomas(a0: Vec, b0: Vec, c0: Vec, d0: Vec, t = 0): ThomasResult {
  const R = (x: number) => fl(x, t)
  const [a, b, c, d] = [a0, b0, c0, d0].map((v) => v.map(R))
  const n = b.length
  const rows: ThomasRow[] = []
  const bk = new Array(n).fill(0)
  const dk = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    const ai = i > 0 ? a[i - 1] : NaN
    const ci = i < n - 1 ? c[i] : NaN
    let m = NaN
    if (i === 0) {
      bk[0] = b[0]
      dk[0] = d[0]
    } else {
      m = R(ai / bk[i - 1])
      bk[i] = R(b[i] - R(m * c[i - 1]))
      dk[i] = R(d[i] - R(m * dk[i - 1]))
    }
    rows.push({ i, a: ai, b: b[i], c: ci, d: d[i], m, bk: bk[i], dk: dk[i], den: bk[i], cp: i < n - 1 ? ci / bk[i] : NaN, dp: dk[i] / bk[i], x: NaN })
    if (Math.abs(bk[i]) < 1e-300 || !Number.isFinite(bk[i]))
      return { ok: false, error: tr(`Elemento diagonal transformado nulo en la fila ${i + 1} (b${i + 1} = 0 tras la eliminación). Thomas no hace pivoteo; revisa la dominancia diagonal.`, `Zero transformed diagonal entry in row ${i + 1} (b${i + 1} = 0 after elimination). The Thomas algorithm does not pivot; check diagonal dominance.`), rows, x: [] }
  }
  const x = new Array(n).fill(0)
  x[n - 1] = R(dk[n - 1] / bk[n - 1])
  for (let i = n - 2; i >= 0; i--) x[i] = R(R(dk[i] - R(c[i] * x[i + 1])) / bk[i])
  rows.forEach((r, i) => (r.x = x[i]))
  return { ok: true, rows, x }
}

export function tridiagToMatrix(a: Vec, b: Vec, c: Vec): Mat {
  const n = b.length
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (j === i ? b[i] : j === i - 1 ? a[i - 1] : j === i + 1 ? c[i] : 0)))
}

/* ═══════════════════════ Métodos iterativos ═══════════════════════ */

export type IterMethod = 'jacobi' | 'gs'
/** Norma vectorial para el criterio de parada: '2' euclidiana (la que usa el texto), 'inf' máxima, '1' suma. */
export type VecNorm = '2' | 'inf' | '1'

export const vnorm = (v: Vec, p: VecNorm) => (p === '2' ? norm2(v) : p === '1' ? norm1(v) : normInf(v))

export interface IterRow {
  k: number
  x: Vec
  err: number
  errRel: number
}

export interface IterResult {
  ok: boolean
  error?: string
  rows: IterRow[]
  x: Vec
  converged: boolean
  message: string
}

/**
 * Gauss-Jacobi (desplazamientos simultáneos) y Gauss-Seidel (desplazamientos sucesivos) del texto (§3.3), con
 * relajación ω opcional (SOR) en Gauss-Seidel. Se detiene cuando ‖x⁽ᵏ⁾ − x⁽ᵏ⁻¹⁾‖ < eps en la norma elegida.
 */
export function iterativo(A: Mat, b: Vec, x0: Vec, o: { method: IterMethod; omega: number; tol: number; maxIter: number; crit: 'abs' | 'rel'; norm?: VecNorm }): IterResult {
  const n = A.length
  const nrm = o.norm ?? 'inf'
  for (let i = 0; i < n; i++)
    if (A[i][i] === 0) return { ok: false, error: tr(`a₍${i + 1}${i + 1}₎ = 0: el método requiere elementos diagonales no nulos. Reordena las ecuaciones.`, `a₍${i + 1}${i + 1}₎ = 0: the method requires nonzero diagonal entries. Reorder the equations.`), rows: [], x: x0, converged: false, message: '' }
  const rows: IterRow[] = [{ k: 0, x: x0.slice(), err: NaN, errRel: NaN }]
  let x = x0.slice()
  const w = o.method === 'gs' ? o.omega : 1
  for (let k = 1; k <= o.maxIter; k++) {
    const xn = x.slice()
    for (let i = 0; i < n; i++) {
      let s = b[i]
      for (let j = 0; j < n; j++) if (j !== i) s -= A[i][j] * (o.method === 'jacobi' ? x[j] : xn[j])
      const gs = s / A[i][i]
      xn[i] = o.method === 'gs' ? (1 - w) * x[i] + w * gs : gs
    }
    const err = vnorm(vsub(xn, x), nrm)
    const errRel = err / Math.max(vnorm(xn, nrm), 1e-300)
    rows.push({ k, x: xn, err, errRel })
    x = xn
    if (!xn.every(Number.isFinite) || normInf(xn) > 1e12) return { ok: true, rows, x, converged: false, message: tr(`La iteración diverge (‖x⁽ᵏ⁾‖ → ∞ en k = ${k}). Reordena las ecuaciones para que el sistema sea lo más diagonalmente dominante posible.`, `The iteration diverges (‖x⁽ᵏ⁾‖ → ∞ at k = ${k}). Reorder the equations so the system is as diagonally dominant as possible.`) }
    if ((o.crit === 'rel' ? errRel : err) < o.tol) return { ok: true, rows, x, converged: true, message: tr(`Convergió en ${k} iteraciones`, `Converged in ${k} iterations`) }
  }
  return { ok: true, rows, x, converged: false, message: tr(`No alcanzó la tolerancia en ${o.maxIter} iteraciones`, `Tolerance not reached in ${o.maxIter} iterations`) }
}

/** Matriz de iteración T y vector c tales que x⁽ᵏ⁺¹⁾ = T x⁽ᵏ⁾ + c. */
export function iterationMatrix(A: Mat, b: Vec, method: IterMethod, omega = 1): { T: Mat; c: Vec } | null {
  const n = A.length
  if (A.some((r, i) => r[i] === 0)) return null
  if (method === 'jacobi') {
    const T = A.map((r, i) => r.map((v, j) => (i === j ? 0 : -v / r[i])))
    return { T, c: b.map((v, i) => v / A[i][i]) }
  }
  // (D + ωL) x⁽ᵏ⁺¹⁾ = ((1−ω)D − ωU) x⁽ᵏ⁾ + ω b
  const M = A.map((r, i) => r.map((v, j) => (j < i ? omega * v : j === i ? v : 0)))
  const N = A.map((r, i) => r.map((v, j) => (j > i ? -omega * v : j === i ? (1 - omega) * v : 0)))
  const Minv = inverse(M)
  if (!Minv) return null
  const T = Minv.map((r) => N[0].map((_, j) => r.reduce((s, m, k) => s + m * N[k][j], 0)))
  return { T, c: matVec(Minv, b.map((v) => omega * v)) }
}

export interface Dominance {
  rows: { i: number; diag: number; off: number; strict: boolean; weak: boolean }[]
  strict: boolean
  weak: boolean
}

/** Dominancia diagonal por filas: |aᵢᵢ| frente a Σⱼ≠ᵢ |aᵢⱼ|. */
export function diagDominance(A: Mat): Dominance {
  const rows = A.map((r, i) => {
    const diag = Math.abs(r[i])
    const off = r.reduce((s, v, j) => (j === i ? s : s + Math.abs(v)), 0)
    return { i, diag, off, strict: diag > off, weak: diag >= off }
  })
  return { rows, strict: rows.every((r) => r.strict), weak: rows.every((r) => r.weak) && rows.some((r) => r.strict) }
}

/** Dominancia diagonal por columnas: |aⱼⱼ| frente a Σᵢ≠ⱼ |aᵢⱼ| (segunda condición suficiente del texto). */
export const colDominance = (A: Mat): Dominance => diagDominance(transpose(A))

/**
 * Condición suficiente del texto escrita con la matriz C de x = Cx + D (Jacobi, cᵢⱼ = −aᵢⱼ/aᵢᵢ):
 * sumas por filas Σⱼ|cᵢⱼ| < 1 (equivale a la dominancia por filas) o por columnas Σᵢ|cᵢⱼ| < 1.
 */
export function cSums(A: Mat): { row: Vec; col: Vec; rowOk: boolean; colOk: boolean } | null {
  if (A.some((r, i) => r[i] === 0)) return null
  const C = A.map((r, i) => r.map((v, j) => (i === j ? 0 : Math.abs(v / r[i]))))
  const row = C.map((r) => r.reduce((s, v) => s + v, 0))
  const col = C[0].map((_, j) => C.reduce((s, r) => s + r[j], 0))
  return { row, col, rowOk: row.every((v) => v < 1), colOk: col.every((v) => v < 1) }
}

/** Busca un reordenamiento de filas que haga A estrictamente diagonal dominante. order[p] = fila original que va a la posición p. */
export function dominantOrder(A: Mat): number[] | null {
  const n = A.length
  const order = new Array(n).fill(-1)
  for (let i = 0; i < n; i++) {
    const r = A[i]
    const tot = r.reduce((s, v) => s + Math.abs(v), 0)
    const p = r.findIndex((v) => Math.abs(v) > tot - Math.abs(v))
    if (p < 0 || order[p] >= 0) return null
    order[p] = i
  }
  return order
}

/** ω óptimo de SOR (matrices consistentemente ordenadas, p. ej. tridiagonales): 2/(1+√(1−ρ_J²)). */
export function omegaOptimo(rhoJ: number): number {
  return rhoJ < 1 ? 2 / (1 + Math.sqrt(1 - rhoJ * rhoJ)) : NaN
}

export function rhoOf(A: Mat, b: Vec, method: IterMethod, omega = 1): number {
  const it = iterationMatrix(A, b, method, omega)
  return it ? spectralRadius(it.T) : NaN
}

/* ═══════════════════════ Newton para sistemas no lineales ═══════════════════════ */

export type FnN = (...x: number[]) => number

export interface NewtonRow {
  k: number
  x: Vec
  F: Vec
  J: Mat
  dx: Vec
  xn: Vec
  normF: number
  err: number
}

export interface NewtonResult {
  rows: NewtonRow[]
  x: Vec
  converged: boolean
  message: string
  iterates: Vec[]
}

export function newtonSistema(F: FnN[], J: FnN[][], x0: Vec, o: { tol: number; maxIter: number }): NewtonResult {
  const rows: NewtonRow[] = []
  const iterates = [x0.slice()]
  let x = x0.slice()
  for (let k = 0; k < o.maxIter; k++) {
    const Fx = F.map((f) => f(...x))
    const Jx = J.map((r) => r.map((f) => f(...x)))
    if (!Fx.every(Number.isFinite) || !Jx.every((r) => r.every(Number.isFinite)))
      return { rows, x, converged: false, message: tr(`F(x) o J(x) no es finito en x⁽${k}⁾: revisa el dominio de las funciones o el valor inicial.`, `F(x) or J(x) is not finite at x⁽${k}⁾: check the domain of the functions or the initial value.`), iterates }
    const dx = solve(Jx, Fx.map((v) => -v))
    if (!dx) return { rows, x, converged: false, message: tr(`El Jacobiano es singular en x⁽${k}⁾ (det J = 0): Newton no puede continuar. Prueba otro valor inicial.`, `The Jacobian is singular at x⁽${k}⁾ (det J = 0): Newton cannot continue. Try another initial value.`), iterates }
    const xn = x.map((v, i) => v + dx[i])
    const err = normInf(dx)
    rows.push({ k, x, F: Fx, J: Jx, dx, xn, normF: normInf(Fx), err })
    iterates.push(xn)
    x = xn
    if (!xn.every(Number.isFinite) || normInf(xn) > 1e12) return { rows, x, converged: false, message: tr('La iteración diverge.', 'The iteration diverges.'), iterates }
    if (err < o.tol) return { rows, x, converged: true, message: tr(`Convergió en ${k + 1} iteraciones`, `Converged in ${k + 1} iterations`), iterates }
  }
  return { rows, x, converged: false, message: tr(`No alcanzó la tolerancia en ${o.maxIter} iteraciones`, `Tolerance not reached in ${o.maxIter} iterations`), iterates }
}

/* ═══════════════════════ Punto fijo para sistemas no lineales ═══════════════════════ */

export interface PFSRow {
  k: number
  x: Vec
  /** ‖x⁽ᵏ⁾ − x⁽ᵏ⁻¹⁾‖∞ (NaN en k = 0) */
  err: number
}

export interface PFSResult {
  rows: PFSRow[]
  x: Vec
  converged: boolean
  message: string
}

/**
 * Punto fijo para sistemas (texto, §3.5.2): xᵢ⁽ᵏ⁺¹⁾ = gᵢ(x⁽ᵏ⁾). Con `seidel` se usan de inmediato las componentes ya
 * actualizadas (el "método iterativo de Seidel" de la nota 1 del texto).
 */
export function puntoFijoSistema(G: FnN[], x0: Vec, o: { tol: number; maxIter: number; seidel: boolean }): PFSResult {
  const rows: PFSRow[] = [{ k: 0, x: x0.slice(), err: NaN }]
  let x = x0.slice()
  for (let k = 1; k <= o.maxIter; k++) {
    const xn = x.slice()
    for (let i = 0; i < G.length; i++) xn[i] = G[i](...(o.seidel ? xn : x))
    const err = normInf(vsub(xn, x))
    rows.push({ k, x: xn, err })
    x = xn
    if (!xn.every(Number.isFinite)) return { rows, x, converged: false, message: tr(`g(x⁽${k - 1}⁾) no es un número real (fuera del dominio de alguna gᵢ, p. ej. raíz de un negativo): prueba otro despeje o otro valor inicial.`, `g(x⁽${k - 1}⁾) is not a real number (outside the domain of some gᵢ, e.g. square root of a negative): try another rearrangement or another initial value.`) }
    if (normInf(xn) > 1e12) return { rows, x, converged: false, message: tr('La iteración diverge: la condición de suficiencia no se cumple cerca de la solución; prueba otro despeje gᵢ.', 'The iteration diverges: the sufficient condition does not hold near the solution; try another rearrangement gᵢ.') }
    if (err < o.tol) return { rows, x, converged: true, message: tr(`Convergió en ${k} iteraciones`, `Converged in ${k} iterations`) }
  }
  return { rows, x, converged: false, message: tr(`No alcanzó la tolerancia en ${o.maxIter} iteraciones`, `Tolerance not reached in ${o.maxIter} iterations`) }
}

/* ═══════════════════════ Método de la potencia ═══════════════════════ */

export type PowerVariant = 'directa' | 'inversa'

export interface PowerRow {
  k: number
  x: Vec
  y: Vec
  mu: number
  lambda: number
  p: number
  err: number
  errL: number
}

export interface PowerResult {
  ok: boolean
  error?: string
  rows: PowerRow[]
  lambda: number
  v: Vec
  converged: boolean
  message: string
}

const argmaxAbs = (v: Vec) => v.reduce((p, x, i) => (Math.abs(x) > Math.abs(v[p]) ? i : p), 0)

/** Potencia (Burden, alg. 9.1) y potencia inversa con desplazamiento q (alg. 9.3), normalización con ‖·‖∞. */
export function potencia(A: Mat, x0: Vec, o: { variant: PowerVariant; shift: number; tol: number; maxIter: number }): PowerResult {
  const n = A.length
  const rows: PowerRow[] = []
  if (normInf(x0) === 0) return { ok: false, error: tr('El vector inicial no puede ser cero.', 'The initial vector cannot be zero.'), rows, lambda: NaN, v: x0, converged: false, message: '' }
  let fac: ReturnType<typeof luFactor> = null
  if (o.variant === 'inversa') {
    const B = A.map((r, i) => r.map((v, j) => (i === j ? v - o.shift : v)))
    fac = luFactor(B)
    if (!fac) return { ok: false, error: tr(`A − qI es singular: q = ${o.shift} ya es un valor propio exacto de A. Cambia ligeramente el desplazamiento.`, `A − qI is singular: q = ${o.shift} is already an exact eigenvalue of A. Change the shift slightly.`), rows, lambda: o.shift, v: x0, converged: false, message: '' }
  }
  let p = argmaxAbs(x0)
  let x = x0.map((v) => v / x0[p])
  let lamOld = NaN
  for (let k = 1; k <= o.maxIter; k++) {
    const y = o.variant === 'inversa' ? luSolve(fac!, x) : matVec(A, x)
    const mu = y[p]
    const lambda = o.variant === 'inversa' ? 1 / mu + o.shift : mu
    const pn = argmaxAbs(y)
    if (y[pn] === 0)
      return { ok: true, rows, lambda: 0, v: x, converged: true, message: tr('Ax = 0: A tiene el valor propio 0 con vector propio x; elige otro vector inicial.', 'Ax = 0: A has the eigenvalue 0 with eigenvector x; choose another initial vector.') }
    const xn = y.map((v) => v / y[pn])
    const err = normInf(vsub(x, xn))
    const errL = Math.abs(lambda - lamOld)
    rows.push({ k, x, y, mu, lambda, p, err, errL })
    x = xn
    p = pn
    lamOld = lambda
    if (!Number.isFinite(lambda)) return { ok: true, rows, lambda, v: x, converged: false, message: tr('Se obtuvo un valor no finito.', 'A non-finite value was obtained.') }
    if (err < o.tol) return { ok: true, rows, lambda, v: x, converged: true, message: tr(`Convergió en ${k} iteraciones`, `Converged in ${k} iterations`) }
  }
  return {
    ok: true,
    rows,
    lambda: lamOld,
    v: x,
    converged: false,
    message: tr(`No alcanzó la tolerancia en ${o.maxIter} iteraciones (puede haber dos valores propios dominantes de igual módulo, p. ej. λ y −λ, o complejos conjugados).`, `Tolerance not reached in ${o.maxIter} iterations (there may be two dominant eigenvalues of equal modulus, e.g. λ and −λ, or a complex-conjugate pair).`),
  }
}
