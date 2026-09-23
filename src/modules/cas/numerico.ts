// Rutinas numéricas puras de las Herramientas (sin dependencias de la interfaz): integración y raíces.

/* ───────────────────────── Integración numérica ───────────────────────── */

function adaptiveSimpson(f: (x: number) => number, a: number, b: number, tol0 = 1e-11): number {
  let budget = 400000 // evaluaciones máximas
  const simpson = (fa: number, fm: number, fb: number, a: number, b: number) => ((b - a) / 6) * (fa + 4 * fm + fb)
  const rec = (a: number, b: number, fa: number, fm: number, fb: number, whole: number, tol: number, depth: number): number => {
    const m = (a + b) / 2
    const lm = (a + m) / 2, rm = (m + b) / 2
    const flm = f(lm), frm = f(rm)
    budget -= 2
    const left = simpson(fa, flm, fm, a, m)
    const right = simpson(fm, frm, fb, m, b)
    const diff = left + right - whole
    if (depth <= 0 || budget <= 0 || Math.abs(diff) <= 15 * tol) return left + right + diff / 15
    return rec(a, m, fa, flm, fm, left, tol / 2, depth - 1) + rec(m, b, fm, frm, fb, right, tol / 2, depth - 1)
  }
  const fa = f(a), fb = f(b), fm = f((a + b) / 2)
  const whole = simpson(fa, fm, fb, a, b)
  return rec(a, b, fa, fm, fb, whole, tol0 * Math.max(1, Math.abs(whole)), 50)
}

/** Cuadratura tanh-sinh (doble exponencial) en [a, b] finito: muy precisa y tolera singularidades en los extremos. */
function tanhSinh(f: (x: number) => number, a: number, b: number): { value: number; converged: boolean } {
  const c = (a + b) / 2, d = (b - a) / 2
  const term = (t: number) => {
    const u = (Math.PI / 2) * Math.sinh(t)
    const ch = Math.cosh(u)
    const w = (d * (Math.PI / 2) * Math.cosh(t)) / (ch * ch)
    const dist = (2 * d) / (Math.exp(2 * Math.abs(u)) + 1) // distancia al extremo, sin cancelación
    const x = t >= 0 ? b - dist : a + dist
    if (dist === 0 || w === 0) return 0
    const v = f(x)
    return Number.isFinite(v) ? v * w : 0
  }
  let h = 1
  let sum = term(0)
  for (let k = 1; k <= 40; k++) {
    const t = k * h
    const s1 = term(t) + term(-t)
    sum += s1
    if (Math.abs(s1) < 1e-18 * Math.abs(sum) && t > 3) break
    if (t > 6.5) break
  }
  let prev = sum * h
  for (let level = 1; level <= 9; level++) {
    h /= 2
    for (let k = 1; ; k += 2) {
      const t = k * h
      if (t > 6.5) break
      sum += term(t) + term(-t)
    }
    const cur = sum * h
    if (Math.abs(cur - prev) <= 1e-13 * Math.max(1, Math.abs(cur))) return { value: cur, converged: true }
    prev = cur
  }
  return { value: prev, converged: false }
}

/** ∫_a^b f: tanh-sinh (con cambio de variable para límites infinitos) y Simpson adaptativo de respaldo. */
export function integrateNumeric(f: (x: number) => number, a: number, b: number): number {
  if (a === b) return 0
  if (a > b) return -integrateNumeric(f, b, a)
  if (!Number.isFinite(a) && !Number.isFinite(b)) return integrateNumeric(f, -Infinity, 0) + integrateNumeric(f, 0, Infinity)
  if (!Number.isFinite(b)) return tanhSinh((t) => f(a + t / (1 - t)) / (1 - t) ** 2, 0, 1).value
  if (!Number.isFinite(a)) return tanhSinh((t) => f(b - (1 - t) / t) / t ** 2, 0, 1).value
  const ts = tanhSinh(f, a, b)
  if (ts.converged) return ts.value
  const safe = (x: number) => {
    const v = f(x)
    return Number.isFinite(v) ? v : 0
  }
  return adaptiveSimpson(safe, a, b)
}

/** Raíces reales de f en [a, b] por muestreo + bisección. */
export function numericRoots(f: (x: number) => number, a: number, b: number, n = 2000): number[] {
  const roots: number[] = []
  // muestreo previo para distinguir ceros aislados de mesetas (f ≡ 0 en un tramo, p. ej. la
  // derivada de floor o una exponencial que da 0 por underflow): una meseta no son raíces aisladas
  const X: number[] = new Array(n + 1)
  const Y: number[] = new Array(n + 1)
  for (let i = 0; i <= n; i++) {
    X[i] = a + ((b - a) * i) / n
    Y[i] = f(X[i])
  }
  const isolatedZero = (i: number) => Y[i] === 0 && (i === 0 || Y[i - 1] !== 0) && (i === n || Y[i + 1] !== 0)
  let xp = a, fp = Y[0]
  for (let i = 1; i <= n; i++) {
    const x = X[i]
    const fx = Y[i]
    if (fp === 0) {
      if (isolatedZero(i - 1)) roots.push(xp)
    } else if (Number.isFinite(fp) && Number.isFinite(fx) && fp * fx < 0) {
      let lo = xp, hi = x, flo = fp
      for (let k = 0; k < 100; k++) {
        const m = (lo + hi) / 2
        const fm = f(m)
        if (fm === 0) {
          lo = hi = m
          break
        }
        if (flo * fm < 0) hi = m
        else {
          lo = m
          flo = fm
        }
      }
      const r = (lo + hi) / 2
      // descartar asíntotas (salto de signo con |f| grande)
      if (Math.abs(f(r)) < 1e-6 * (1 + Math.abs(fp) + Math.abs(fx))) roots.push(r)
    }
    xp = x
    fp = fx
  }
  if (isolatedZero(n)) roots.push(b)
  return roots.filter((r, i) => i === 0 || Math.abs(r - roots[i - 1]) > 1e-9 * (1 + Math.abs(r)))
}
