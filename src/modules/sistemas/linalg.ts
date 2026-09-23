// Utilidades de álgebra lineal (puras, sin dependencias) para el Tema 3.

export type Mat = number[][]
export type Vec = number[]

export const clone = (A: Mat): Mat => A.map((r) => r.slice())
export const zeros = (n: number, m = n): Mat => Array.from({ length: n }, () => new Array(m).fill(0))
export const eye = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
export const transpose = (A: Mat): Mat => A[0].map((_, j) => A.map((r) => r[j]))
export const matVec = (A: Mat, x: Vec): Vec => A.map((r) => r.reduce((s, a, j) => s + a * x[j], 0))
export const matMul = (A: Mat, B: Mat): Mat => A.map((r) => B[0].map((_, j) => r.reduce((s, a, k) => s + a * B[k][j], 0)))
export const vsub = (a: Vec, b: Vec): Vec => a.map((v, i) => v - b[i])
export const normInf = (v: Vec) => v.reduce((m, x) => Math.max(m, Math.abs(x)), 0)
export const norm2 = (v: Vec) => Math.sqrt(v.reduce((s, x) => s + x * x, 0))
export const norm1 = (v: Vec) => v.reduce((s, x) => s + Math.abs(x), 0)
/** Norma infinito de matriz: máxima suma de fila. */
export const normInfM = (A: Mat) => A.reduce((m, r) => Math.max(m, norm1(r)), 0)
/** Norma 1 de matriz: máxima suma de columna. */
export const norm1M = (A: Mat) => normInfM(transpose(A))
export const isSquare = (A: Mat) => A.length > 0 && A.every((r) => r.length === A.length)
export const isSymmetric = (A: Mat, tol = 1e-12) => A.every((r, i) => r.every((v, j) => Math.abs(v - A[j][i]) <= tol * (1 + Math.abs(v))))

/** Factorización PA = LU con pivoteo parcial (compacta). Devuelve null si es singular. */
export function luFactor(A: Mat): { LU: Mat; perm: number[]; sign: number } | null {
  const n = A.length
  const LU = clone(A)
  const perm = Array.from({ length: n }, (_, i) => i)
  let sign = 1
  const scale = normInfM(A) || 1
  for (let k = 0; k < n; k++) {
    let p = k
    for (let i = k + 1; i < n; i++) if (Math.abs(LU[i][k]) > Math.abs(LU[p][k])) p = i
    if (Math.abs(LU[p][k]) <= 1e-14 * scale) return null
    if (p !== k) {
      ;[LU[p], LU[k]] = [LU[k], LU[p]]
      ;[perm[p], perm[k]] = [perm[k], perm[p]]
      sign = -sign
    }
    for (let i = k + 1; i < n; i++) {
      const m = (LU[i][k] /= LU[k][k])
      for (let j = k + 1; j < n; j++) LU[i][j] -= m * LU[k][j]
    }
  }
  return { LU, perm, sign }
}

export function luSolve(f: { LU: Mat; perm: number[] }, b: Vec): Vec {
  const n = b.length
  const y = f.perm.map((p) => b[p])
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) y[i] -= f.LU[i][j] * y[j]
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j < n; j++) y[i] -= f.LU[i][j] * y[j]
    y[i] /= f.LU[i][i]
  }
  return y
}

export function solve(A: Mat, b: Vec): Vec | null {
  const f = luFactor(A)
  return f ? luSolve(f, b) : null
}

export function inverse(A: Mat): Mat | null {
  const f = luFactor(A)
  if (!f) return null
  const n = A.length
  const cols = Array.from({ length: n }, (_, j) => luSolve(f, eye(n)[j]))
  return transpose(cols)
}

export function det(A: Mat): number {
  const f = luFactor(A)
  if (!f) return 0
  return f.LU.reduce((p, r, i) => p * r[i], f.sign)
}

/* ─────────────── Valores propios (Hessenberg + QR de Francis) ─────────────── */

export interface Complex {
  re: number
  im: number
}

/** Todos los valores propios de una matriz real (algoritmo hqr). null si no converge. */
export function eigenvalues(A0: Mat): Complex[] | null {
  const n = A0.length
  if (n === 0) return []
  if (n === 1) return [{ re: A0[0][0], im: 0 }]
  // matriz 1-indexada
  const a: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i && j ? A0[i - 1][j - 1] : 0)))
  // Reducción a Hessenberg por eliminación con pivoteo (elmhes)
  for (let m = 2; m < n; m++) {
    let x = 0
    let i = m
    for (let j = m; j <= n; j++) {
      if (Math.abs(a[j][m - 1]) > Math.abs(x)) {
        x = a[j][m - 1]
        i = j
      }
    }
    if (i !== m) {
      for (let j = m - 1; j <= n; j++) [a[i][j], a[m][j]] = [a[m][j], a[i][j]]
      for (let j = 1; j <= n; j++) [a[j][i], a[j][m]] = [a[j][m], a[j][i]]
    }
    if (x) {
      for (let i2 = m + 1; i2 <= n; i2++) {
        let y = a[i2][m - 1]
        if (y !== 0) {
          y /= x
          a[i2][m - 1] = y
          for (let j = m; j <= n; j++) a[i2][j] -= y * a[m][j]
          for (let j = 1; j <= n; j++) a[j][m] += y * a[j][i2]
        }
      }
    }
  }
  for (let i = 1; i <= n; i++) for (let j = 1; j < i - 1; j++) a[i][j] = 0
  // hqr
  const wr = new Array(n + 1).fill(0)
  const wi = new Array(n + 1).fill(0)
  const SIGN = (x: number, y: number) => (y >= 0 ? Math.abs(x) : -Math.abs(x))
  let anorm = 0
  for (let i = 1; i <= n; i++) for (let j = Math.max(i - 1, 1); j <= n; j++) anorm += Math.abs(a[i][j])
  let nn = n
  let t = 0
  let p = 0, q = 0, r = 0, s = 0, w = 0, x = 0, y = 0, z = 0
  while (nn >= 1) {
    let its = 0
    let l: number
    do {
      for (l = nn; l >= 2; l--) {
        s = Math.abs(a[l - 1][l - 1]) + Math.abs(a[l][l])
        if (s === 0) s = anorm
        if (Math.abs(a[l][l - 1]) + s === s) {
          a[l][l - 1] = 0
          break
        }
      }
      x = a[nn][nn]
      if (l === nn) {
        wr[nn] = x + t
        wi[nn--] = 0
      } else {
        y = a[nn - 1][nn - 1]
        w = a[nn][nn - 1] * a[nn - 1][nn]
        if (l === nn - 1) {
          p = 0.5 * (y - x)
          q = p * p + w
          z = Math.sqrt(Math.abs(q))
          x += t
          if (q >= 0) {
            z = p + SIGN(z, p)
            wr[nn - 1] = wr[nn] = x + z
            if (z) wr[nn] = x - w / z
            wi[nn - 1] = wi[nn] = 0
          } else {
            wr[nn - 1] = wr[nn] = x + p
            wi[nn - 1] = -(wi[nn] = z)
          }
          nn -= 2
        } else {
          if (its === 60) return null
          if (its === 10 || its === 20 || its === 40) {
            t += x
            for (let i = 1; i <= nn; i++) a[i][i] -= x
            s = Math.abs(a[nn][nn - 1]) + Math.abs(a[nn - 1][nn - 2])
            y = x = 0.75 * s
            w = -0.4375 * s * s
          }
          ++its
          let m: number
          for (m = nn - 2; m >= l; m--) {
            z = a[m][m]
            r = x - z
            s = y - z
            p = (r * s - w) / a[m + 1][m] + a[m][m + 1]
            q = a[m + 1][m + 1] - z - r - s
            r = a[m + 2][m + 1]
            s = Math.abs(p) + Math.abs(q) + Math.abs(r)
            p /= s
            q /= s
            r /= s
            if (m === l) break
            const u = Math.abs(a[m][m - 1]) * (Math.abs(q) + Math.abs(r))
            const v = Math.abs(p) * (Math.abs(a[m - 1][m - 1]) + Math.abs(z) + Math.abs(a[m + 1][m + 1]))
            if (u + v === v) break
          }
          for (let i = m + 2; i <= nn; i++) {
            a[i][i - 2] = 0
            if (i !== m + 2) a[i][i - 3] = 0
          }
          for (let k = m; k <= nn - 1; k++) {
            if (k !== m) {
              p = a[k][k - 1]
              q = a[k + 1][k - 1]
              r = 0
              if (k !== nn - 1) r = a[k + 2][k - 1]
              if ((x = Math.abs(p) + Math.abs(q) + Math.abs(r)) !== 0) {
                p /= x
                q /= x
                r /= x
              }
            }
            if ((s = SIGN(Math.sqrt(p * p + q * q + r * r), p)) !== 0) {
              if (k === m) {
                if (l !== m) a[k][k - 1] = -a[k][k - 1]
              } else a[k][k - 1] = -s * x
              p += s
              x = p / s
              y = q / s
              z = r / s
              q /= p
              r /= p
              for (let j = k; j <= nn; j++) {
                p = a[k][j] + q * a[k + 1][j]
                if (k !== nn - 1) {
                  p += r * a[k + 2][j]
                  a[k + 2][j] -= p * z
                }
                a[k + 1][j] -= p * y
                a[k][j] -= p * x
              }
              const mmin = nn < k + 3 ? nn : k + 3
              for (let i = l; i <= mmin; i++) {
                p = x * a[i][k] + y * a[i][k + 1]
                if (k !== nn - 1) {
                  p += z * a[i][k + 2]
                  a[i][k + 2] -= p * r
                }
                a[i][k + 1] -= p * q
                a[i][k] -= p
              }
            }
          }
        }
      }
    } while (l < nn - 1)
  }
  const out: Complex[] = []
  for (let i = 1; i <= n; i++) out.push({ re: wr[i], im: wi[i] })
  if (out.some((c) => !Number.isFinite(c.re) || !Number.isFinite(c.im))) return null
  return out.sort((u, v) => Math.hypot(v.re, v.im) - Math.hypot(u.re, u.im))
}

/** Radio espectral ρ(T) = max |λ|. Si QR falla, usa la fórmula de Gelfand ‖T^k‖^{1/k}. */
export function spectralRadius(T: Mat): number {
  const ev = eigenvalues(T)
  if (ev) return ev.reduce((m, c) => Math.max(m, Math.hypot(c.re, c.im)), 0)
  let P = clone(T)
  let logScale = 0
  const K = 256
  for (let k = 1; k < K; k++) {
    P = matMul(P, T)
    const nm = normInfM(P)
    if (nm === 0) return 0
    P = P.map((r) => r.map((v) => v / nm))
    logScale += Math.log(nm)
  }
  return Math.exp((logScale + Math.log(normInfM(P))) / K)
}

/** Norma 2 de matriz = σ_max = √λ_max(AᵀA). */
export function norm2M(A: Mat): number {
  const ev = eigenvalues(matMul(transpose(A), A))
  if (!ev) return NaN
  return Math.sqrt(Math.max(...ev.map((c) => c.re)))
}

/** Valores singulares extremos. */
export function singularExtremes(A: Mat): { max: number; min: number } | null {
  const ev = eigenvalues(matMul(transpose(A), A))
  if (!ev) return null
  const re = ev.map((c) => Math.max(0, c.re))
  return { max: Math.sqrt(Math.max(...re)), min: Math.sqrt(Math.min(...re)) }
}
