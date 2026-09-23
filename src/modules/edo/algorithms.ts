// Algoritmos para ecuaciones diferenciales ordinarias (Tema 6).
// Problema de valor inicial  Y' = F(t, Y),  Y(t0) = Y0  (escalar o vectorial).
// Todas las funciones son puras: devuelven la malla completa y los valores intermedios.

export type Vec = number[]
export type OdeFn = (t: number, y: Vec) => Vec
export type ScalarFn = (t: number, y: number) => number

/** Tope de pasos para mantener la interfaz fluida. */
export const MAX_STEPS = 100000
/** Umbral a partir del cual consideramos que la solución numérica "explotó". */
const BLOW = 1e150

/* ───────────────────────── Tablas de Butcher ───────────────────────── */

export interface Tableau {
  id: TableauId
  name: string
  /** orden global del método */
  order: number
  c: number[]
  a: number[][]
  b: number[]
}

export type TableauId = 'euler' | 'punto-medio' | 'heun' | 'ralston' | 'rk3' | 'rk4' | 'rk38'

export const TABLEAUS: Record<TableauId, Tableau> = {
  euler: { id: 'euler', name: 'Euler', order: 1, c: [0], a: [[]], b: [1] },
  'punto-medio': { id: 'punto-medio', name: 'RK2 del punto medio', order: 2, c: [0, 1 / 2], a: [[], [1 / 2]], b: [0, 1] },
  heun: { id: 'heun', name: 'Trapecio o Euler modificado (predictor-corrector)', order: 2, c: [0, 1], a: [[], [1]], b: [1 / 2, 1 / 2] },
  ralston: { id: 'ralston', name: 'RK2 del texto (γ₂ = 3/4, Ralston)', order: 2, c: [0, 2 / 3], a: [[], [2 / 3]], b: [1 / 4, 3 / 4] },
  rk3: { id: 'rk3', name: 'RK3 (Kutta)', order: 3, c: [0, 1 / 2, 1], a: [[], [1 / 2], [-1, 2]], b: [1 / 6, 4 / 6, 1 / 6] },
  rk4: { id: 'rk4', name: 'RK4 clásico', order: 4, c: [0, 1 / 2, 1 / 2, 1], a: [[], [1 / 2], [0, 1 / 2], [0, 0, 1]], b: [1 / 6, 1 / 3, 1 / 3, 1 / 6] },
  rk38: { id: 'rk38', name: 'RK4 regla 3/8', order: 4, c: [0, 1 / 3, 2 / 3, 1], a: [[], [1 / 3], [-1 / 3, 1], [1, -1, 1]], b: [1 / 8, 3 / 8, 3 / 8, 1 / 8] },
}

/* ───────────────────────── Resultado común ───────────────────────── */

export interface OdeResult {
  t: number[]
  /** w[i] ≈ Y(t_i) */
  w: Vec[]
  /** etapas k_1..k_s usadas para obtener w_i (null en la fila 0) */
  k: (Vec[] | null)[]
  /** valores extra por fila (predictor, iteraciones, derivadas de Taylor, h, R…) */
  extra?: (Record<string, number> | null)[]
  ok: boolean
  message: string
  /** número de evaluaciones de F */
  nevals: number
  /** trazas de iteración del método implícito (sólo primeros pasos) */
  trace?: number[][]
  /** registro de intentos de RKF45 (sólo primeros) */
  log?: RkfAttempt[]
}

const isBad = (v: Vec) => v.some((x) => !Number.isFinite(x) || Math.abs(x) > BLOW)

function blowMsg(t: number) {
  return `La solución numérica explotó (valor no finito o |w| > 10¹⁵⁰) cerca de t = ${+t.toPrecision(6)}. Posibles causas: paso h demasiado grande (inestabilidad del método) o la solución exacta tiene una asíntota vertical.`
}

function safe(F: OdeFn): OdeFn {
  return (t, y) => {
    try {
      return F(t, y)
    } catch {
      return y.map(() => NaN)
    }
  }
}

/** Malla uniforme: a partir de h o de N. */
export function mesh(t0: number, tf: number, mode: 'h' | 'N', h: number, N: number): { h: number; N: number; error?: string; warn?: string } {
  if (!Number.isFinite(t0) || !Number.isFinite(tf)) return { h: NaN, N: 0, error: 'Intervalo [t₀, t_f] inválido.' }
  if (tf === t0) return { h: NaN, N: 0, error: 't_f debe ser distinto de t₀.' }
  const L = tf - t0
  if (mode === 'N') {
    if (!(N >= 1)) return { h: NaN, N: 0, error: 'N debe ser un entero ≥ 1.' }
    if (N > MAX_STEPS) return { h: NaN, N: 0, error: `N es demasiado grande (máximo ${MAX_STEPS} pasos).` }
    return { h: L / N, N }
  }
  if (!Number.isFinite(h) || h === 0) return { h: NaN, N: 0, error: 'El paso h debe ser un número distinto de cero.' }
  if (Math.sign(h) !== Math.sign(L)) return { h: NaN, N: 0, error: 'El signo de h debe coincidir con el sentido de t₀ → t_f.' }
  const raw = L / h
  const n = Math.max(1, Math.round(raw))
  if (n > MAX_STEPS) return { h: NaN, N: 0, error: `h es demasiado pequeño: se necesitarían ${Math.round(raw)} pasos (máximo ${MAX_STEPS}).` }
  if (Math.abs(raw - n) > 1e-9 * Math.max(1, Math.abs(raw))) return { h: L / n, N: n, warn: `h = ${h} no divide exactamente a t_f − t₀; se usa N = ${n} y h = ${+(L / n).toPrecision(10)}.` }
  return { h: L / n, N: n }
}

/* ───────────────────────── Runge-Kutta explícito (general) ───────────────────────── */

/** Un paso de un método de Runge-Kutta explícito dado por su tabla de Butcher. */
export function rkStep(F: OdeFn, tab: Tableau, t: number, y: Vec, h: number): { y: Vec; k: Vec[] } {
  const s = tab.b.length
  const k: Vec[] = []
  for (let j = 0; j < s; j++) {
    const yj = y.slice()
    for (let l = 0; l < j; l++) {
      const a = tab.a[j][l]
      if (a) for (let m = 0; m < y.length; m++) yj[m] += h * a * k[l][m]
    }
    k.push(F(t + tab.c[j] * h, yj))
  }
  const yn = y.slice()
  for (let j = 0; j < s; j++) if (tab.b[j]) for (let m = 0; m < y.length; m++) yn[m] += h * tab.b[j] * k[j][m]
  return { y: yn, k }
}

export function rkSolve(F0: OdeFn, tab: Tableau, t0: number, y0: Vec, h: number, N: number): OdeResult {
  const F = safe(F0)
  const t = [t0]
  const w = [y0.slice()]
  const k: (Vec[] | null)[] = [null]
  if (isBad(y0)) return { t, w, k, ok: false, message: 'La condición inicial no es un número finito.', nevals: 0 }
  let nevals = 0
  for (let i = 0; i < N; i++) {
    const st = rkStep(F, tab, t[i], w[i], h)
    nevals += tab.b.length
    const ti = i + 1 === N ? t0 + N * h : t0 + (i + 1) * h
    t.push(ti)
    w.push(st.y)
    k.push(st.k)
    if (isBad(st.y) || st.k.some(isBad)) return { t, w, k, ok: false, message: blowMsg(ti), nevals }
  }
  return { t, w, k, ok: true, message: `${tab.name}: ${N} pasos con h = ${+h.toPrecision(8)}.`, nevals }
}

/* ───────────────────────── Trapecio (implícito) ───────────────────────── */

export type ImplicitSolver = 'newton' | 'punto-fijo'

/**
 * Regla del trapecio: w_{i+1} = w_i + h/2 [f(t_i, w_i) + f(t_{i+1}, w_{i+1})].
 * La ecuación (no lineal) en w_{i+1} se resuelve con Newton (usa f_y) o con punto fijo,
 * partiendo del predictor de Euler.
 */
export function trapecio(f0: ScalarFn, fy: ScalarFn | null, t0: number, y0: number, h: number, N: number, solver: ImplicitSolver, tol = 1e-12, maxIt = 50): OdeResult {
  const f: ScalarFn = (t, y) => {
    try {
      return f0(t, y)
    } catch {
      return NaN
    }
  }
  const t = [t0]
  const w: Vec[] = [[y0]]
  const k: (Vec[] | null)[] = [null]
  const extra: (Record<string, number> | null)[] = [null]
  const trace: number[][] = []
  let nevals = 0
  let fails = 0
  for (let i = 0; i < N; i++) {
    const ti = t[i], wi = w[i][0]
    const t1 = t0 + (i + 1) * h
    const fi = f(ti, wi)
    nevals++
    const pred = wi + h * fi
    let x = pred
    const hist = [x]
    let it = 0
    let conv = false
    for (; it < maxIt; it++) {
      let xn: number
      if (solver === 'newton' && fy) {
        const g = x - wi - (h / 2) * (fi + f(t1, x))
        const dg = 1 - (h / 2) * fy(t1, x)
        nevals++
        if (dg === 0 || !Number.isFinite(dg)) break
        xn = x - g / dg
      } else {
        xn = wi + (h / 2) * (fi + f(t1, x))
        nevals++
      }
      hist.push(xn)
      const d = Math.abs(xn - x)
      x = xn
      if (!Number.isFinite(x)) break
      if (d <= tol * Math.max(1, Math.abs(x))) {
        conv = true
        it++
        break
      }
    }
    if (!conv) fails++
    const fn = f(t1, x)
    nevals++
    t.push(t1)
    w.push([x])
    k.push([[fi], [fn]])
    extra.push({ pred, iters: it, conv: conv ? 1 : 0 })
    if (i < 3) trace.push(hist)
    if (!Number.isFinite(x) || Math.abs(x) > BLOW) return { t, w, k, extra, trace, ok: false, message: blowMsg(t1), nevals }
  }
  const how = solver === 'newton' ? 'Newton' : 'punto fijo'
  return {
    t, w, k, extra, trace, nevals,
    ok: fails === 0,
    message: fails === 0 ? `Trapecio: ${N} pasos; cada paso resuelto con ${how} (tolerancia ${tol}).` : `En ${fails} paso(s) la iteración de ${how} no convergió en ${maxIt} iteraciones${solver === 'punto-fijo' ? ' (se requiere (h/2)|f_y| < 1; prueba con Newton o un h menor)' : ''}.`,
  }
}

/* ───────────────────────── Taylor ───────────────────────── */

/**
 * Método de Taylor de orden p (escalar o vectorial): ds[j] es la derivada Y^{(j+1)} expresada
 * como función de (t, Y). Para un sistema, ds[1] = ∂F/∂t + J·F (jacobiano), como en el Ej. 6.9.
 *   w_{i+1} = w_i + h y'_i + h²/2 y''_i + … + h^p/p! y^{(p)}_i
 */
export function taylorSolveVec(ds0: OdeFn[], t0: number, y0: Vec, h: number, N: number): OdeResult {
  const ds = ds0.map(safe)
  const t = [t0]
  const w: Vec[] = [y0.slice()]
  const k: (Vec[] | null)[] = [null]
  let nevals = 0
  if (isBad(y0)) return { t, w, k, ok: false, message: 'La condición inicial no es un número finito.', nevals: 0 }
  for (let i = 0; i < N; i++) {
    const ti = t[i], wi = w[i]
    const vals = ds.map((d) => d(ti, wi))
    nevals += ds.length
    const wn = wi.slice()
    let fac = 1
    let hp = 1
    vals.forEach((v, j) => {
      fac *= j + 1
      hp *= h
      for (let m = 0; m < wn.length; m++) wn[m] += (hp / fac) * v[m]
    })
    const t1 = t0 + (i + 1) * h
    t.push(t1)
    w.push(wn)
    k.push(vals)
    if (isBad(wn)) return { t, w, k, ok: false, message: blowMsg(t1), nevals }
  }
  return { t, w, k, ok: true, message: `Taylor de orden ${ds.length}: ${N} pasos con h = ${+h.toPrecision(8)}.`, nevals }
}

/** Taylor escalar: ds[j](t, y) = y^{(j+1)}. */
export function taylorSolve(ds: ScalarFn[], t0: number, y0: number, h: number, N: number): OdeResult {
  return taylorSolveVec(
    ds.map((d) => (t: number, y: Vec) => [d(t, y[0])]),
    t0,
    [y0],
    h,
    N,
  )
}

/* ───────────────────────── Punto medio del texto (2 pasos) ───────────────────────── */

/**
 * Método del punto medio tal como lo presenta el texto (6.1.1.2): la integral sobre [x_{n−1}, x_{n+1}]
 * se aproxima con un rectángulo de altura f(x_n, y_n):
 *   y_1 = y_0 + h f(x_0, y_0)   (Euler),     y_{n+1} = y_{n−1} + 2h f(x_n, y_n),  n ≥ 1.
 * Es un método explícito de 2 pasos (en Burden: "leapfrog" o punto medio de dos pasos).
 * k[i+1] = [f(t_i, w_i)].
 */
export function puntoMedio2(F0: OdeFn, t0: number, y0: Vec, h: number, N: number): OdeResult {
  const F = safe(F0)
  const t = [t0]
  const w: Vec[] = [y0.slice()]
  const k: (Vec[] | null)[] = [null]
  if (isBad(y0)) return { t, w, k, ok: false, message: 'La condición inicial no es un número finito.', nevals: 0 }
  let nevals = 0
  for (let i = 0; i < N; i++) {
    const fi = F(t[i], w[i])
    nevals++
    const base = i === 0 ? w[0] : w[i - 1]
    const c = i === 0 ? h : 2 * h
    const wn = base.map((x, m) => x + c * fi[m])
    const t1 = t0 + (i + 1) * h
    t.push(t1)
    w.push(wn)
    k.push([fi])
    if (isBad(wn) || isBad(fi)) return { t, w, k, ok: false, message: blowMsg(t1), nevals }
  }
  return { t, w, k, ok: true, message: `Punto medio (2 pasos): y₁ con Euler y ${Math.max(0, N - 1)} pasos de y_{n+1} = y_{n−1} + 2h f(x_n, y_n), h = ${+h.toPrecision(8)}.`, nevals }
}

/* ───────────────────────── Adams-Moulton (predictor-corrector de 4 pasos) ───────────────────────── */

export type AmStart = 'rk4' | 'heun'

/**
 * Adams-Moulton del texto (6.1.1.4, relaciones 6.9): predictor de Adams-Bashforth de 4 pasos y
 * UNA corrección con la fórmula de Adams-Moulton:
 *   ỹ_{n+1} = y_n + h/24 [55 f_n − 59 f_{n−1} + 37 f_{n−2} − 9 f_{n−3}]
 *   y_{n+1} = y_n + h/24 [9 f(x_{n+1}, ỹ_{n+1}) + 19 f_n − 5 f_{n−1} + f_{n−2}],   n ≥ 3.
 * y_1, y_2, y_3 se calculan con otro método (RK4 o trapecio/Euler modificado, como en el Ej. 6.4).
 * k[i+1] = [f_i, f_{i−1}, f_{i−2}, f_{i−3}, f(t_{i+1}, ỹ_{i+1})] en los pasos de Adams; la tabla del
 * arranque en los primeros; extra[i+1] = { pred: ỹ_{i+1} (1.ª componente), am: 1 si es paso de Adams }.
 */
export function adamsMoulton(F0: OdeFn, t0: number, y0: Vec, h: number, N: number, start: AmStart = 'rk4'): OdeResult {
  const F = safe(F0)
  const tab = TABLEAUS[start]
  const t = [t0]
  const w: Vec[] = [y0.slice()]
  const k: (Vec[] | null)[] = [null]
  const extra: (Record<string, number> | null)[] = [null]
  if (isBad(y0)) return { t, w, k, extra, ok: false, message: 'La condición inicial no es un número finito.', nevals: 0 }
  let nevals = 0
  const fs: Vec[] = []
  const n = y0.length
  for (let i = 0; i < N; i++) {
    const t1 = t0 + (i + 1) * h
    if (i < 3) {
      const st = rkStep(F, tab, t[i], w[i], h)
      nevals += tab.b.length
      fs.push(st.k[0])
      t.push(t1)
      w.push(st.y)
      k.push(st.k)
      extra.push({ am: 0 })
      if (isBad(st.y)) return { t, w, k, extra, ok: false, message: blowMsg(t1), nevals }
      continue
    }
    const fi = F(t[i], w[i])
    nevals++
    fs.push(fi)
    const [f0, f1, f2, f3] = [fs[i], fs[i - 1], fs[i - 2], fs[i - 3]]
    const pred = Array.from({ length: n }, (_, m) => w[i][m] + (h / 24) * (55 * f0[m] - 59 * f1[m] + 37 * f2[m] - 9 * f3[m]))
    const fp = F(t1, pred)
    nevals++
    const wn = Array.from({ length: n }, (_, m) => w[i][m] + (h / 24) * (9 * fp[m] + 19 * f0[m] - 5 * f1[m] + f2[m]))
    t.push(t1)
    w.push(wn)
    k.push([f0, f1, f2, f3, fp])
    extra.push({ am: 1, pred: pred[0] })
    if (isBad(wn) || isBad(pred)) return { t, w, k, extra, ok: false, message: blowMsg(t1), nevals }
  }
  const name = start === 'rk4' ? 'RK4' : 'trapecio (Euler modificado)'
  return {
    t, w, k, extra, nevals, ok: true,
    message: N < 4 ? `Con N = ${N} sólo se calculan los valores de arranque (${name}); Adams-Moulton empieza en y₄.` : `Adams-Moulton: y₁, y₂, y₃ con ${name} y ${N - 3} pasos predictor (Adams-Bashforth) – corrector (Adams-Moulton).`,
  }
}

/* ───────────────────────── Runge-Kutta-Fehlberg 4(5) ───────────────────────── */

export interface RkfAttempt {
  t: number
  h: number
  k: Vec[]
  R: number
  accepted: boolean
  delta: number
  w4: Vec
  w5: Vec
}

/**
 * RKF45 con control adaptativo del paso (Burden & Faires, algoritmo 5.3).
 * R = |w̃_{i+1} − w_{i+1}| / h ; se acepta si R ≤ TOL ; δ = 0.84 (TOL/R)^{1/4}.
 */
export function rkf45(F0: OdeFn, t0: number, y0: Vec, tf: number, tol: number, hmin: number, hmax: number): OdeResult {
  const F = safe(F0)
  const dir = Math.sign(tf - t0) || 1
  const t = [t0]
  const w = [y0.slice()]
  const k: (Vec[] | null)[] = [null]
  const extra: (Record<string, number> | null)[] = [null]
  const log: RkfAttempt[] = []
  let nevals = 0
  let ti = t0
  let wi = y0.slice()
  let h = Math.abs(hmax)
  let rejected = 0
  const n = y0.length
  const comb = (base: Vec, h: number, ks: Vec[], cs: number[]) => {
    const out = base.slice()
    for (let j = 0; j < cs.length; j++) if (cs[j]) for (let m = 0; m < n; m++) out[m] += h * cs[j] * ks[j][m]
    return out
  }
  let guard = 0
  while (dir * (tf - ti) > 1e-14 * Math.max(1, Math.abs(tf))) {
    if (++guard > MAX_STEPS * 4) return { t, w, k, extra, log, ok: false, message: `Se superó el máximo de ${MAX_STEPS} pasos.`, nevals }
    if (h > Math.abs(tf - ti)) h = Math.abs(tf - ti)
    const hs = dir * h
    const k1 = F(ti, wi)
    const k2 = F(ti + hs / 4, comb(wi, hs, [k1], [1 / 4]))
    const k3 = F(ti + (3 * hs) / 8, comb(wi, hs, [k1, k2], [3 / 32, 9 / 32]))
    const k4 = F(ti + (12 * hs) / 13, comb(wi, hs, [k1, k2, k3], [1932 / 2197, -7200 / 2197, 7296 / 2197]))
    const k5 = F(ti + hs, comb(wi, hs, [k1, k2, k3, k4], [439 / 216, -8, 3680 / 513, -845 / 4104]))
    const k6 = F(ti + hs / 2, comb(wi, hs, [k1, k2, k3, k4, k5], [-8 / 27, 2, -3544 / 2565, 1859 / 4104, -11 / 40]))
    nevals += 6
    const ks = [k1, k2, k3, k4, k5, k6]
    const w4 = comb(wi, hs, ks, [25 / 216, 0, 1408 / 2565, 2197 / 4104, -1 / 5, 0])
    const w5 = comb(wi, hs, ks, [16 / 135, 0, 6656 / 12825, 28561 / 56430, -9 / 50, 2 / 55])
    if (ks.some(isBad) || isBad(w4)) return { t, w, k, extra, log, ok: false, message: blowMsg(ti), nevals }
    let R = 0
    for (let m = 0; m < n; m++) R = Math.max(R, Math.abs(w5[m] - w4[m]) / h)
    const delta = R === 0 ? 4 : 0.84 * Math.pow(tol / R, 1 / 4)
    const accepted = R <= tol
    if (log.length < 6) log.push({ t: ti, h: hs, k: ks, R, accepted, delta, w4, w5 })
    if (accepted) {
      ti = ti + hs
      wi = w4
      t.push(ti)
      w.push(w4)
      k.push(ks)
      extra.push({ h: hs, R, w5: w5[0] })
    } else rejected++
    if (delta <= 0.1) h *= 0.1
    else if (delta >= 4) h *= 4
    else h *= delta
    if (h > Math.abs(hmax)) h = Math.abs(hmax)
    if (dir * (tf - ti) <= 1e-14 * Math.max(1, Math.abs(tf))) break
    if (h < Math.abs(hmin) && Math.abs(tf - ti) > Math.abs(hmin)) {
      return { t, w, k, extra, log, ok: false, message: `El paso requerido cayó por debajo de h_min = ${hmin} en t = ${+ti.toPrecision(6)}: no se puede alcanzar la tolerancia (¿problema rígido o singularidad?).`, nevals }
    }
  }
  return { t, w, k, extra, log, ok: true, message: `RKF45: ${t.length - 1} pasos aceptados y ${rejected} rechazados (TOL = ${tol}).`, nevals }
}

/* ───────────────────────── Persecución (misil) ───────────────────────── */

export interface PursuitResult {
  t: number[]
  M: Vec[]
  T: Vec[]
  dist: number[]
  captured: boolean
  tCapture: number
  pCapture: Vec
  minDist: number
  tMin: number
  message: string
  ok: boolean
  /** k1..k4 de los primeros pasos (para el paso a paso) */
  k: Vec[][]
}

const norm = (v: Vec) => Math.sqrt(v.reduce((s, x) => s + x * x, 0))
const sub = (a: Vec, b: Vec) => a.map((x, i) => x - b[i])

/**
 * Curva de persecución pura en R³:  r_M' = v_M (r_T(t) − r_M) / |r_T(t) − r_M|.
 * Se integra con RK4 hasta que |r_T − r_M| < ε (captura) o t = tMax.
 */
export function pursuit(target: (t: number) => Vec, rM0: Vec, vM: number, t0: number, tMax: number, h: number, eps: number): PursuitResult {
  const F: OdeFn = (t, r) => {
    const d = sub(target(t), r)
    const n = norm(d)
    return n < 1e-300 ? [0, 0, 0] : d.map((x) => (vM * x) / n)
  }
  const tab = TABLEAUS.rk4
  const t = [t0]
  const M = [rM0.slice()]
  const T0 = target(t0)
  const T = [T0]
  const dist = [norm(sub(T0, rM0))]
  const ks: Vec[][] = []
  let minDist = dist[0], tMin = t0
  const base = { k: ks }
  if (isBad(T0) || isBad(rM0)) return { ...base, t, M, T, dist, captured: false, tCapture: NaN, pCapture: [NaN, NaN, NaN], minDist, tMin, ok: false, message: 'La posición inicial del blanco o del misil no es finita.' }
  if (dist[0] <= eps) return { ...base, t, M, T, dist, captured: true, tCapture: t0, pCapture: rM0, minDist, tMin, ok: true, message: 'El misil ya está dentro de la distancia de captura en t₀.' }
  const N = Math.min(MAX_STEPS, Math.ceil((tMax - t0) / h))
  for (let i = 0; i < N; i++) {
    const st = rkStep(F, tab, t[i], M[i], h)
    if (i < 3) ks.push(st.k)
    const t1 = t0 + (i + 1) * h
    const T1 = target(t1)
    if (isBad(st.y) || isBad(T1)) return { ...base, t, M, T, dist, captured: false, tCapture: NaN, pCapture: [NaN, NaN, NaN], minDist, tMin, ok: false, message: blowMsg(t1) }
    const d1 = norm(sub(T1, st.y))
    t.push(t1)
    M.push(st.y)
    T.push(T1)
    dist.push(d1)
    if (d1 < minDist) {
      minDist = d1
      tMin = t1
    }
    if (d1 <= eps) {
      // interpolación lineal de la distancia para estimar el instante de captura
      const d0 = dist[i]
      const s = d0 === d1 ? 1 : Math.min(1, Math.max(0, (d0 - eps) / (d0 - d1)))
      const tc = t[i] + s * h
      const pc = M[i].map((x, m) => x + s * (st.y[m] - x))
      return { ...base, t, M, T, dist, captured: true, tCapture: tc, pCapture: pc, minDist, tMin, ok: true, message: `¡Blanco interceptado! |r_T − r_M| < ε en t ≈ ${+tc.toPrecision(8)}.` }
    }
  }
  return {
    ...base, t, M, T, dist, captured: false, tCapture: NaN, pCapture: [NaN, NaN, NaN], minDist, tMin, ok: true,
    message: `No hubo captura hasta t = ${+t[t.length - 1].toPrecision(6)}. Distancia mínima ${+minDist.toPrecision(5)} en t ≈ ${+tMin.toPrecision(5)}.`,
  }
}

/* ───────────────────────── Utilidades ───────────────────────── */

/** Pendiente por mínimos cuadrados de log(err) vs log(h) = orden observado. */
export function slopeLogLog(hs: number[], errs: number[]): number | null {
  const pts = hs.map((h, i) => [Math.log(Math.abs(h)), Math.log(errs[i])]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  // descartar puntos dominados por el redondeo
  const good = pts.filter(([, y]) => y > Math.log(1e-13))
  const P = good.length >= 2 ? good : pts
  if (P.length < 2) return null
  const mx = P.reduce((s, p) => s + p[0], 0) / P.length
  const my = P.reduce((s, p) => s + p[1], 0) / P.length
  let num = 0, den = 0
  for (const [x, y] of P) {
    num += (x - mx) * (y - my)
    den += (x - mx) ** 2
  }
  return den === 0 ? null : num / den
}

/** Índices para mostrar a lo sumo `max` filas (conservando primera y última). */
export function thinIdx(n: number, max = 1001): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i)
  const stride = Math.ceil((n - 1) / (max - 1))
  const out: number[] = []
  for (let i = 0; i < n; i += stride) out.push(i)
  if (out[out.length - 1] !== n - 1) out.push(n - 1)
  return out
}

/** Aproximación racional sencilla (para mostrar coeficientes como fracciones). */
export function toFrac(x: number, maxDen = 60): [number, number] | null {
  for (let q = 1; q <= maxDen; q++) {
    const p = Math.round(x * q)
    if (Math.abs(p / q - x) < 1e-12) return [p, q]
  }
  return null
}
