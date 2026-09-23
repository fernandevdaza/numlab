// Algoritmos para ecuaciones no lineales f(x) = 0 (Tema 2).
// Todas las funciones son puras y devuelven la tabla completa de iteraciones.

/**
 * Criterio de parada (relación 2.3 del texto). 'o' es el del texto: se detiene cuando se cumple
 * |f(xₙ)| ≤ EPS **o** |xₙ − xₙ₋₁| ≤ EPS. 'abs', 'rel' y 'f' usan una sola de las condiciones.
 */
export type Criterion = 'o' | 'abs' | 'rel' | 'f'
export type Fn = (x: number) => number

export interface Row {
  n: number
  [k: string]: number
}

export interface RootResult {
  rows: Row[]
  /** aproximación final */
  root: number
  converged: boolean
  message: string
  /** sucesión de aproximaciones x_0, x_1, ... */
  iterates: number[]
}

export interface Opts {
  tol: number
  maxIter: number
  criterion: Criterion
}

/** Mínimo de los valores finitos (NaN si no hay ninguno). */
function minFinite(...v: number[]): number {
  const ok = v.filter(Number.isFinite)
  return ok.length ? Math.min(...ok) : NaN
}

/**
 * Valor que se compara con EPS según el criterio elegido (se detiene si valor ≤ EPS).
 * Con 'o' (criterio del texto) es min(|Δx|, |f|): que el mínimo sea ≤ EPS equivale a que se cumpla
 * al menos una de las dos condiciones de (2.3).
 */
export function stopValue(crit: Criterion, xNew: number, xOld: number, fNew: number): number {
  const d = Math.abs(xNew - xOld)
  if (crit === 'f') return Math.abs(fNew)
  if (crit === 'o') return minFinite(d, Math.abs(fNew))
  return crit === 'rel' ? d / Math.max(Math.abs(xNew), 1e-300) : d
}

function bad(x: number) {
  return !Number.isFinite(x)
}

/**
 * Estancamiento por redondeo: el paso |x_{n+1} − x_n| dejó de disminuir aunque |f| ya es del orden
 * del ruido de redondeo. Es típico cerca de una raíz múltiple, donde la precisión alcanzable es ≈ ε^{1/m}.
 */
function estancado(err: number, errPrev: number, fx: number, f0: number) {
  return Number.isFinite(errPrev) && err >= errPrev && Math.abs(fx) <= 1e-10 * Math.max(Math.abs(f0), 1e-300)
}
const MSG_ESTANCADO =
  'Se alcanzó el límite de precisión de la máquina: |xₙ₊₁ − xₙ| dejó de disminuir por errores de redondeo (es normal cerca de una raíz de multiplicidad m: sólo se obtiene ≈ 1/m de las cifras significativas de la máquina). Se devuelve la mejor aproximación.'

/* ─────────────── Bisección ─────────────── */
export function biseccion(f: Fn, a0: number, b0: number, o: Opts): RootResult {
  let a = Math.min(a0, b0)
  let b = Math.max(a0, b0)
  let fa = f(a)
  const fb0 = f(b)
  const rows: Row[] = []
  const iterates: number[] = []
  if (fa === 0) return { rows, root: a, converged: true, message: 'a ya es raíz exacta', iterates: [a] }
  if (fb0 === 0) return { rows, root: b, converged: true, message: 'b ya es raíz exacta', iterates: [b] }
  if (fa * fb0 > 0)
    return { rows, root: NaN, converged: false, message: 'f(a) y f(b) tienen el mismo signo: el teorema de Bolzano no garantiza una raíz en [a, b].', iterates }
  let c = a
  for (let n = 1; n <= o.maxIter; n++) {
    const cOld = c
    c = (a + b) / 2
    const fc = f(c)
    const fb = f(b)
    // (b − a)/2 es el ancho del nuevo intervalo [x_I, x_D] y acota |α − x_M| (relación 2.6)
    const half = (b - a) / 2
    const err =
      o.criterion === 'f' ? Math.abs(fc) : o.criterion === 'o' ? Math.min(Math.abs(fc), half) : o.criterion === 'rel' ? half / Math.max(Math.abs(c), 1e-300) : half
    rows.push({ n, a, b, c, fa, fb, fc, err, dx: n > 1 ? Math.abs(c - cOld) : NaN })
    iterates.push(c)
    if (fc === 0 || err <= o.tol) return { rows, root: c, converged: true, message: `Convergió en ${n} iteraciones`, iterates }
    if (fa * fc < 0) {
      b = c
    } else {
      a = c
      fa = fc
    }
  }
  return { rows, root: c, converged: false, message: `No alcanzó la tolerancia en ${o.maxIter} iteraciones`, iterates }
}

/** Número mínimo de iteraciones de bisección para error absoluto < tol. */
export function biseccionIterMin(a: number, b: number, tol: number) {
  return Math.ceil(Math.log2(Math.abs(b - a) / tol))
}

/* ─────────────── Posición falsa (regula falsi) ─────────────── */
/**
 * Como la bisección, pero el nuevo punto es la raíz de la secante entre (a, f(a)) y (b, f(b)).
 * Variante `modificada` (la del texto): si un extremo queda fijo dos iteraciones seguidas,
 * en la siguiente se usa la mitad de su valor de f (evita que la convergencia se vuelva lenta).
 * Criterio 'abs': |αₛ⁽ⁿ⁾ − αₛ⁽ⁿ⁻¹⁾| (en posición falsa el ancho x_D − x_I no tiende a 0 en general,
 * porque uno de los extremos puede quedar fijo).
 */
export function posicionFalsa(f: Fn, a0: number, b0: number, o: Opts, modificada = false): RootResult {
  let a = Math.min(a0, b0)
  let b = Math.max(a0, b0)
  let fa = f(a)
  let fb = f(b)
  const rows: Row[] = []
  const iterates: number[] = []
  if (fa === 0) return { rows, root: a, converged: true, message: 'a ya es raíz exacta', iterates: [a] }
  if (fb === 0) return { rows, root: b, converged: true, message: 'b ya es raíz exacta', iterates: [b] }
  if (fa * fb > 0)
    return { rows, root: NaN, converged: false, message: 'f(a) y f(b) tienen el mismo signo: el teorema de Bolzano no garantiza una raíz en [a, b].', iterates }
  // valores de f usados en la fórmula (pueden estar divididos entre 2 en la variante modificada)
  let Fa = fa, Fb = fb
  let fijoA = 0, fijoB = 0
  let c = NaN
  for (let n = 1; n <= o.maxIter; n++) {
    const cOld = c
    c = b - (Fb * (b - a)) / (Fb - Fa)
    if (bad(c)) return { rows, root: cOld, converged: false, message: 'La iteración produjo un valor no finito.', iterates }
    const fc = f(c)
    const err = o.criterion === 'f' || (o.criterion === 'o' && n === 1) ? Math.abs(fc) : n === 1 ? NaN : stopValue(o.criterion, c, cOld, fc)
    rows.push({ n, a, b, fa: Fa, fb: Fb, c, fc, err, mod: Fa !== fa || Fb !== fb ? 1 : 0 })
    iterates.push(c)
    if (fc === 0 || err <= o.tol) return { rows, root: c, converged: true, message: `Convergió en ${n} iteraciones`, iterates }
    if (fa * fc < 0) {
      b = c
      fb = fc
      Fb = fc
      fijoB = 0
      fijoA++
    } else {
      a = c
      fa = fc
      Fa = fc
      fijoA = 0
      fijoB++
    }
    if (modificada) {
      if (fijoA >= 2) Fa /= 2
      if (fijoB >= 2) Fb /= 2
    }
  }
  return { rows, root: c, converged: false, message: `No alcanzó la tolerancia en ${o.maxIter} iteraciones`, iterates }
}

/* ─────────────── Punto fijo ─────────────── */
export function puntoFijo(g: Fn, x0: number, o: Opts, f?: Fn): RootResult {
  const rows: Row[] = []
  const iterates = [x0]
  let x = x0
  for (let n = 0; n < o.maxIter; n++) {
    const gx = g(x)
    if (bad(gx))
      return { rows, root: x, converged: false, message: `g(x${n}) no es un número real finito (p. ej. raíz de un número negativo ⇒ número complejo): la iteración no puede continuar.`, iterates }
    const fx = f ? f(gx) : gx - g(gx)
    const err = stopValue(o.criterion, gx, x, fx)
    rows.push({ n, x, gx, err })
    iterates.push(gx)
    x = gx
    if (err <= o.tol) return { rows, root: x, converged: true, message: `Convergió en ${n + 1} iteraciones`, iterates }
    if (Math.abs(x) > 1e12) return { rows, root: x, converged: false, message: 'La sucesión diverge (|x| > 10¹²). Revisa que |g′(x)| < 1 cerca de la raíz.', iterates }
  }
  return { rows, root: x, converged: false, message: `No alcanzó la tolerancia en ${o.maxIter} iteraciones`, iterates }
}

/* ─────────────── Aitken Δ² ─────────────── */
/** Genera la sucesión de punto fijo y le aplica la aceleración de Aitken. */
export function aitken(g: Fn, x0: number, o: Opts): RootResult {
  const xs = [x0]
  const rows: Row[] = []
  const iterates: number[] = []
  let prevHat = NaN
  for (let n = 0; n < o.maxIter; n++) {
    while (xs.length < n + 3) {
      const v = g(xs[xs.length - 1])
      if (bad(v)) return { rows, root: prevHat, converged: false, message: 'g(x) no es un número real finito: la sucesión de punto fijo no puede continuar.', iterates }
      xs.push(v)
    }
    const [x0n, x1n, x2n] = [xs[n], xs[n + 1], xs[n + 2]]
    const d2 = x2n - 2 * x1n + x0n
    const hat = d2 === 0 ? x2n : x0n - (x1n - x0n) ** 2 / d2
    const err = n === 0 ? Math.abs(hat - x0n) : stopValue(o.criterion, hat, prevHat, hat - g(hat))
    rows.push({ n, x: x0n, x1: x1n, x2: x2n, hat, err })
    iterates.push(hat)
    if (d2 === 0 || (n > 0 && err <= o.tol)) return { rows, root: hat, converged: true, message: `Convergió en ${n + 1} términos acelerados`, iterates }
    prevHat = hat
  }
  return { rows, root: prevHat, converged: false, message: `No alcanzó la tolerancia en ${o.maxIter} iteraciones`, iterates }
}

/* ─────────────── Steffensen ─────────────── */
export function steffensen(g: Fn, x0: number, o: Opts): RootResult {
  const rows: Row[] = []
  const iterates = [x0]
  let x = x0
  for (let n = 0; n < o.maxIter; n++) {
    const g1 = g(x)
    const g2 = g(g1)
    const den = g2 - 2 * g1 + x
    if (den === 0 || bad(den)) {
      const ok = Math.abs(g1 - x) < o.tol
      return { rows, root: ok ? g1 : x, converged: ok, message: ok ? `Convergió en ${n} iteraciones (Δ² = 0)` : 'Denominador nulo o no finito', iterates }
    }
    const xn = x - (g1 - x) ** 2 / den
    const err = stopValue(o.criterion, xn, x, xn - g(xn))
    rows.push({ n, x, g1, g2, xn, err })
    iterates.push(xn)
    x = xn
    if (err <= o.tol) return { rows, root: x, converged: true, message: `Convergió en ${n + 1} iteraciones`, iterates }
  }
  return { rows, root: x, converged: false, message: `No alcanzó la tolerancia en ${o.maxIter} iteraciones`, iterates }
}

/* ─────────────── Newton-Raphson ─────────────── */
export function newton(f: Fn, df: Fn, x0: number, o: Opts): RootResult {
  const rows: Row[] = []
  const iterates = [x0]
  let x = x0
  const f0 = f(x0)
  let dPrev = NaN
  for (let n = 0; n < o.maxIter; n++) {
    const fx = f(x)
    if (fx === 0) return { rows, root: x, converged: true, message: `f(x${n}) = 0: raíz exacta.`, iterates }
    const dfx = df(x)
    if (dfx === 0 || bad(dfx)) return { rows, root: x, converged: false, message: `f′(x${n}) = 0: la tangente es horizontal, Newton no puede continuar.`, iterates }
    const xn = x - fx / dfx
    if (bad(xn)) return { rows, root: x, converged: false, message: 'La iteración produjo un valor no finito.', iterates }
    const d = Math.abs(xn - x)
    if (n >= 1 && estancado(d, dPrev, fx, f0)) return { rows, root: x, converged: true, message: MSG_ESTANCADO, iterates }
    dPrev = d
    const err = stopValue(o.criterion, xn, x, f(xn))
    rows.push({ n, x, fx, dfx, xn, err })
    iterates.push(xn)
    x = xn
    if (err <= o.tol) return { rows, root: x, converged: true, message: `Convergió en ${n + 1} iteraciones`, iterates }
  }
  return { rows, root: x, converged: false, message: `No alcanzó la tolerancia en ${o.maxIter} iteraciones`, iterates }
}

/* ─────────────── Secante ─────────────── */
export function secante(f: Fn, x0: number, x1: number, o: Opts): RootResult {
  const rows: Row[] = []
  const iterates = [x0, x1]
  let a = x0
  let b = x1
  const f0 = Math.max(Math.abs(f(x0)), Math.abs(f(x1)))
  let dPrev = NaN
  for (let n = 1; n <= o.maxIter; n++) {
    const fa = f(a)
    const fb = f(b)
    if (fb === 0) return { rows, root: b, converged: true, message: 'f(xₙ) = 0: raíz exacta.', iterates }
    if (fb === fa) return { rows, root: b, converged: false, message: 'f(xₙ) = f(xₙ₋₁): la secante es horizontal.', iterates }
    const xn = b - (fb * (b - a)) / (fb - fa)
    if (bad(xn)) return { rows, root: b, converged: false, message: 'La iteración produjo un valor no finito.', iterates }
    const d = Math.abs(xn - b)
    if (n >= 3 && estancado(d, dPrev, fb, f0)) return { rows, root: b, converged: true, message: MSG_ESTANCADO, iterates }
    dPrev = d
    const err = stopValue(o.criterion, xn, b, f(xn))
    rows.push({ n, xp: a, x: b, fxp: fa, fx: fb, xn, err })
    iterates.push(xn)
    a = b
    b = xn
    if (err <= o.tol) return { rows, root: b, converged: true, message: `Convergió en ${n} iteraciones`, iterates }
  }
  return { rows, root: b, converged: false, message: `No alcanzó la tolerancia en ${o.maxIter} iteraciones`, iterates }
}

/* ─────────────── Newton modificado (raíces múltiples) ─────────────── */
/** Variante 'm': x − m f/f′ (multiplicidad conocida). Variante 'mu': Newton sobre μ = f/f′. */
export function newtonModificado(f: Fn, df: Fn, d2f: Fn, x0: number, o: Opts, variant: 'm' | 'mu', m = 2): RootResult {
  const rows: Row[] = []
  const iterates = [x0]
  let x = x0
  const f0 = f(x0)
  let dPrev = NaN
  for (let n = 0; n < o.maxIter; n++) {
    const fx = f(x)
    const dfx = df(x)
    const d2fx = d2f(x)
    if (fx === 0) return { rows, root: x, converged: true, message: `Raíz exacta en la iteración ${n}`, iterates }
    let xn: number
    if (variant === 'm') {
      if (dfx === 0) return { rows, root: x, converged: false, message: 'f′(x) = 0', iterates }
      xn = x - (m * fx) / dfx
    } else {
      const den = dfx * dfx - fx * d2fx
      if (den === 0) return { rows, root: x, converged: false, message: "f′² − f·f″ = 0", iterates }
      xn = x - (fx * dfx) / den
    }
    if (bad(xn)) return { rows, root: x, converged: false, message: 'La iteración produjo un valor no finito.', iterates }
    const d = Math.abs(xn - x)
    if (n >= 1 && estancado(d, dPrev, fx, f0)) return { rows, root: x, converged: true, message: MSG_ESTANCADO, iterates }
    dPrev = d
    const err = stopValue(o.criterion, xn, x, f(xn))
    rows.push({ n, x, fx, dfx, d2fx, xn, err })
    iterates.push(xn)
    x = xn
    if (err <= o.tol) return { rows, root: x, converged: true, message: `Convergió en ${n + 1} iteraciones`, iterates }
  }
  return { rows, root: x, converged: false, message: `No alcanzó la tolerancia en ${o.maxIter} iteraciones`, iterates }
}

/**
 * Estimación de la multiplicidad m a partir de iteraciones de Newton-Raphson (texto, relación 2.23):
 * como g′(α) = 1 − 1/m ≈ (x_{n+2} − x_{n+1})/(x_{n+1} − x_n),   m ≈ [1 − (x_{n+2} − x_{n+1})/(x_{n+1} − x_n)]⁻¹.
 */
export function estimarMultiplicidad(xs: number[]): number[] {
  const out: number[] = []
  for (let n = 0; n + 2 < xs.length; n++) {
    const d1 = xs[n + 1] - xs[n]
    const d2 = xs[n + 2] - xs[n + 1]
    out.push(d1 === 0 ? NaN : 1 / (1 - d2 / d1))
  }
  return out
}

/* ─────────────── Análisis de convergencia ─────────────── */
/**
 * Orden de convergencia estimado a partir de diferencias sucesivas d_n = |x_{n+1} − x_n|:
 *   p ≈ ln(d_{n+1}/d_n) / ln(d_n/d_{n−1})
 */
export function ordenEstimado(iterates: number[]): (number | null)[] {
  const d = iterates.slice(1).map((x, i) => Math.abs(x - iterates[i]))
  return d.map((_, i) => {
    if (i < 2) return null
    const a = d[i], b = d[i - 1], c = d[i - 2]
    if (!(a > 0 && b > 0 && c > 0)) return null
    const p = Math.log(a / b) / Math.log(b / c)
    return Number.isFinite(p) ? p : null
  })
}

/** Último orden estimado "fiable" (antes de que el redondeo lo arruine). */
export function ordenFinal(iterates: number[]): number | null {
  const ps = ordenEstimado(iterates)
  const d = iterates.slice(1).map((x, i) => Math.abs(x - iterates[i]))
  let best: number | null = null
  for (let i = 0; i < ps.length; i++) {
    if (ps[i] !== null && d[i] > 1e-14 * Math.max(1, Math.abs(iterates[i]))) best = ps[i]
  }
  return best
}
