// Muestreo de funciones para graficar con fidelidad: refinamiento adaptativo (para no perder
// picos estrechos ni oscilaciones) y detección de discontinuidades (para no dibujar la recta
// vertical de una asíntota). No depende de Plotly: es matemática pura y se puede testear.

export interface SamplePoint {
  x: number[]
  y: (number | null)[]
  /** sólo si se detectaron asíntotas: rango vertical sugerido (Plotly acepta `meta` en las trazas) */
  meta?: { yrange: [number, number] }
}

export interface SampleOpts {
  /** puntos de la malla inicial */
  n?: number
  /** tope de puntos tras el refinamiento */
  maxPoints?: number
  /** pasadas de refinamiento adaptativo */
  passes?: number
}

const evalAt = (f: (x: number) => number, x: number): number | null => {
  let y: number
  try {
    y = f(x)
  } catch {
    return null
  }
  return typeof y === 'number' && Number.isFinite(y) ? y : null
}

/** Cuantil de un arreglo ya ordenado. */
function quantileSorted(sorted: number[], q: number): number {
  if (!sorted.length) return NaN
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

/** Escala vertical robusta: alto "típico" de la curva, ignorando los picos de las asíntotas. */
export function robustScale(ys: (number | null)[]): number {
  const v = ys.filter((t): t is number => t !== null).sort((p, q) => p - q)
  if (!v.length) return 1
  const lo = quantileSorted(v, 0.05)
  const hi = quantileSorted(v, 0.95)
  const s = hi - lo
  if (s > 0) return s
  const m = Math.max(Math.abs(v[0]), Math.abs(v[v.length - 1]))
  return m > 0 ? m : 1
}

/**
 * Muestrea f en [a, b].
 *
 * 1. Malla uniforme de `n` puntos.
 * 2. Refinamiento adaptativo: parte los tramos donde la curva se aleja de la recta que une sus
 *    extremos (picos, oscilaciones) o donde un extremo no está definido (bordes del dominio).
 * 3. Corta la línea (null) sólo donde hay una discontinuidad real: salto enorme frente al resto
 *    de la curva, con cambio de signo o con valores que explotan (asíntotas).
 */
export function sampleFn(f: (x: number) => number, a: number, b: number, opts: SampleOpts = {}): SamplePoint {
  const n = Math.max(8, opts.n ?? 600)
  const maxPoints = opts.maxPoints ?? 4 * n
  const passes = opts.passes ?? 5
  if (!(b > a)) return { x: [a], y: [evalAt(f, a)] }

  // 1) malla uniforme
  let xs: number[] = new Array(n)
  let ys: (number | null)[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const x = a + ((b - a) * i) / (n - 1)
    xs[i] = x
    ys[i] = evalAt(f, x)
  }

  // rango "visible" a partir de la malla uniforme (cada punto pesa lo mismo en x)
  const uniform = ys.filter((t): t is number => t !== null).sort((p, q) => p - q)

  // 2) refinamiento adaptativo
  const scale0 = robustScale(ys)
  for (let p = 0; p < passes && xs.length < maxPoints; p++) {
    const nx: number[] = []
    const ny: (number | null)[] = []
    const tol = 0.004 * robustScale(ys)
    let added = 0
    for (let i = 0; i < xs.length - 1; i++) {
      nx.push(xs[i])
      ny.push(ys[i])
      if (xs.length + added >= maxPoints) continue
      const x0 = xs[i], x1 = xs[i + 1]
      if (x1 - x0 < 1e-12 * Math.max(1, Math.abs(x0))) continue
      const y0 = ys[i], y1 = ys[i + 1]
      const xm = (x0 + x1) / 2
      const ym = evalAt(f, xm)
      const undefinedEdge = (y0 === null) !== (y1 === null) || (ym === null) !== (y0 === null)
      let refine = undefinedEdge
      if (!refine && y0 !== null && y1 !== null && ym !== null) {
        // distancia del punto medio a la cuerda + variación fuerte ⇒ hace falta más resolución
        const chord = (y0 + y1) / 2
        const dev = Math.abs(ym - chord)
        refine = dev > tol || Math.abs(y1 - y0) > 0.25 * scale0
      }
      if (refine) {
        nx.push(xm)
        ny.push(ym)
        added++
      }
    }
    nx.push(xs[xs.length - 1])
    ny.push(ys[ys.length - 1])
    xs = nx
    ys = ny
    if (!added) break
  }

  // 3) discontinuidades: un tramo con salto grande se biseca muchas veces; si el salto NO se
  //    achica (salto finito) o crece (asíntota), es una discontinuidad y se corta la línea.
  //    En una curva continua (aunque sea muy empinada) el salto tiende a 0 al bisecar.
  const scale = robustScale(ys)
  const jumps: number[] = []
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i], y1 = ys[i + 1]
    if (y0 !== null && y1 !== null) jumps.push(Math.abs(y1 - y0))
  }
  const typicalJump = quantileSorted([...jumps].sort((p, q) => p - q), 0.5) || 0
  const threshold = Math.max(8 * typicalJump, 0.02 * scale)
  const ox: number[] = []
  const oy: (number | null)[] = []
  let checks = 0
  let pole = false
  for (let i = 0; i < xs.length - 1; i++) {
    ox.push(xs[i])
    oy.push(ys[i])
    const y0 = ys[i], y1 = ys[i + 1]
    if (y0 === null || y1 === null || checks > 300) continue
    if (Math.abs(y1 - y0) <= threshold) continue
    checks++
    const br = locateBreak(f, xs[i], y0, xs[i + 1], y1)
    if (br) {
      ox.push(br.xl, (br.xl + br.xr) / 2, br.xr)
      oy.push(br.yl, null, br.yr)
      if (Math.max(Math.abs(br.yl), Math.abs(br.yr)) > 10 * scale0) pole = true
    }
  }
  ox.push(xs[xs.length - 1])
  oy.push(ys[ys.length - 1])
  // un punto no definido (p. ej. 1/x en x = 0 exacto) con vecinos que explotan también es asíntota
  for (let i = 1; i < oy.length - 1 && !pole; i++) {
    if (oy[i] !== null) continue
    const l = oy[i - 1], r = oy[i + 1]
    if ((l !== null && Math.abs(l) > 10 * scale0) || (r !== null && Math.abs(r) > 10 * scale0)) pole = true
  }
  if (pole && uniform.length > 8) {
    // asíntota: mostrar el cuerpo de la curva (cuantiles 4–96 % en x), no los valores que explotan
    const lo = quantileSorted(uniform, 0.04)
    const hi = quantileSorted(uniform, 0.96)
    const pad = 0.15 * (hi - lo || 1)
    return { x: ox, y: oy, meta: { yrange: [lo - pad, hi + pad] } }
  }
  return { x: ox, y: oy }
}

/**
 * Biseca [x0, x1] siguiendo la mitad con el salto más grande. Devuelve los extremos del salto
 * si persiste al llegar a la resolución de la máquina (discontinuidad), o null si desaparece.
 */
function locateBreak(f: (x: number) => number, x0: number, y0: number, x1: number, y1: number): { xl: number; yl: number; xr: number; yr: number } | null {
  const jump0 = Math.abs(y1 - y0)
  for (let it = 0; it < 60; it++) {
    const xm = (x0 + x1) / 2
    if (xm <= x0 || xm >= x1) break
    const ym = evalAt(f, xm)
    if (ym === null) return { xl: x0, yl: y0, xr: x1, yr: y1 } // punto no definido: se corta ahí
    if (Math.abs(ym - y0) >= Math.abs(y1 - ym)) {
      x1 = xm
      y1 = ym
    } else {
      x0 = xm
      y0 = ym
    }
  }
  return Math.abs(y1 - y0) > 0.3 * jump0 ? { xl: x0, yl: y0, xr: x1, yr: y1 } : null
}

/**
 * Rango vertical razonable: si hay valores extremos (asíntotas) que aplastarían la curva,
 * devuelve el rango de los cuantiles; si no, null (que Plotly ajuste solo).
 */
export function autoYRange(ys: (number | null)[][]): [number, number] | null {
  const v: number[] = []
  for (const arr of ys) for (const t of arr) if (t !== null && Number.isFinite(t)) v.push(t)
  if (v.length < 8) return null
  v.sort((p, q) => p - q)
  const min = v[0], max = v[v.length - 1]
  const lo = quantileSorted(v, 0.02)
  const hi = quantileSorted(v, 0.98)
  const core = hi - lo
  const full = max - min
  if (!(full > 0) || !(core > 0)) return null
  // sólo intervenir si los extremos son mucho mayores que el cuerpo de la curva
  if (full <= 8 * core) return null
  const pad = 0.12 * core
  return [lo - pad, hi + pad]
}
