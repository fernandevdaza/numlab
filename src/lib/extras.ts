// Funciones extra de mathjs que comparten el CAS, la hoja de cálculo y las gráficas.
//   linreg(x, y)             → [m, b, r²] de la recta de mínimos cuadrados y = m x + b
//   polyfit(x, y, n)         → coeficientes [a0, a1, …, an] del polinomio de grado n
//   seq(expr, k, a, b, paso) → lista expr(k) para k = a, a + paso, …, b (como en TI-Nspire)
import type { MathJsInstance } from 'mathjs'

const toList = (math: MathJsInstance, v: any): number[] => {
  const arr = math.isMatrix(v) ? (v as any).toArray() : v
  if (!Array.isArray(arr)) throw new Error('Se esperaba una lista')
  return arr.flat(Infinity).map(Number)
}

export function linreg(x: number[], y: number[]): [number, number, number] {
  const n = Math.min(x.length, y.length)
  if (n < 2) throw new Error('linreg: se necesitan al menos 2 puntos')
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) (sx += x[i]), (sy += y[i])
  const mx = sx / n, my = sy / n
  let sxx = 0, sxy = 0, syy = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  if (sxx === 0) throw new Error('linreg: todos los x son iguales')
  const m = sxy / sxx
  const b = my - m * mx
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy)
  return [m, b, r2]
}

/** Mínimos cuadrados con polinomio de grado n (ecuaciones normales resueltas con eliminación con pivoteo). */
export function polyfit(x: number[], y: number[], deg: number): number[] {
  const n = Math.min(x.length, y.length)
  const d = Math.round(deg)
  if (d < 0 || n < d + 1) throw new Error(`polyfit: se necesitan al menos ${d + 1} puntos`)
  const m = d + 1
  const A: number[][] = Array.from({ length: m }, () => Array(m + 1).fill(0))
  for (let i = 0; i < n; i++) {
    const p: number[] = [1]
    for (let k = 1; k <= 2 * d; k++) p.push(p[k - 1] * x[i])
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) A[r][c] += p[r + c]
      A[r][m] += p[r] * y[i]
    }
  }
  for (let k = 0; k < m; k++) {
    let piv = k
    for (let r = k + 1; r < m; r++) if (Math.abs(A[r][k]) > Math.abs(A[piv][k])) piv = r
    ;[A[k], A[piv]] = [A[piv], A[k]]
    if (Math.abs(A[k][k]) < 1e-300) throw new Error('polyfit: sistema singular')
    for (let r = k + 1; r < m; r++) {
      const f = A[r][k] / A[k][k]
      for (let c = k; c <= m; c++) A[r][c] -= f * A[k][c]
    }
  }
  const a = Array(m).fill(0)
  for (let k = m - 1; k >= 0; k--) {
    let s = A[k][m]
    for (let c = k + 1; c < m; c++) s -= A[k][c] * a[c]
    a[k] = s / A[k][k]
  }
  return a
}

/** Instala las funciones en una instancia de mathjs. */
export function installExtras(math: MathJsInstance) {
  const seq: any = (args: any[], m: any, scope: any) => {
    if (args.length < 4) throw new Error('Uso: seq(expr, k, a, b, paso)')
    const name = args[1].name ?? String(args[1])
    const ev = (node: any) => node.compile().evaluate(scopeObj(scope))
    const a = Number(ev(args[2])), b = Number(ev(args[3])), step = args[4] ? Number(ev(args[4])) : 1
    if (!(step > 0 || step < 0) || Math.abs((b - a) / step) > 100000) throw new Error('seq: paso inválido')
    const body = args[0].compile()
    const local = scopeObj(scope)
    const out: any[] = []
    for (let k = a; step > 0 ? k <= b + 1e-12 : k >= b - 1e-12; k += step) {
      Object.defineProperty(local, name, { value: k, writable: true, enumerable: true, configurable: true })
      out.push(body.evaluate(local))
    }
    return out
  }
  seq.rawArgs = true
  math.import(
    {
      linreg: (x: any, y: any) => linreg(toList(math, x), toList(math, y)),
      polyfit: (x: any, y: any, n: any) => polyfit(toList(math, x), toList(math, y), Number(n)),
      seq,
    },
    { override: true },
  )
}

/** Vista del scope de mathjs (objeto o Map) como objeto plano, sin leer valores que no se usan. */
function scopeObj(scope: any): Record<string, any> {
  const o: Record<string, any> = {}
  if (!scope) return o
  const mapLike = typeof scope.keys === 'function' && typeof scope.get === 'function'
  const keys: Iterable<string> = mapLike ? scope.keys() : Object.keys(scope)
  for (const k of keys) Object.defineProperty(o, k, { get: () => (mapLike ? scope.get(k) : scope[k]), enumerable: true, configurable: true })
  return o
}
