// Interpretación de las entradas de la vista algebraica (estilo GeoGebra/Desmos) y cálculo de trazas.
import { L } from '../../i18n'
import { M, prep, splitArgs, type Session } from '../cas/engine'
import { sampleFn } from '../../lib/plotmath'
import { numericRoots } from '../cas/numerico'

export type Item =
  | { kind: 'fn'; label: string; f: (x: number) => number }
  | { kind: 'vline'; label: string; x: number }
  | { kind: 'implicit'; label: string; F: (x: number, y: number) => number }
  | { kind: 'point'; label: string; x: number; y: number }
  | { kind: 'points'; label: string; xs: number[]; ys: number[] }
  | { kind: 'param'; label: string; fx: (t: number) => number; fy: (t: number) => number; t0: number; t1: number }
  | { kind: 'slider'; name: string; value: number }
  | { kind: 'def' }
  | { kind: 'empty' }
  | { kind: 'error'; msg: string }

const CONSTS = new Set(['pi', 'e', 'E', 'PI', 'i', 'Infinity', 'NaN', 'phi', 'tau'])

/** Símbolos libres de una expresión (sin funciones ni constantes). */
function freeSymbols(src: string): Set<string> {
  const out = new Set<string>()
  try {
    M.parse(src).traverse((n: any, _p: string, parent: any) => {
      if (n.isSymbolNode && !(parent?.isFunctionNode && parent.fn === n) && !CONSTS.has(n.name)) out.add(n.name)
    })
  } catch {
    /* expresión inválida: la compilación lo dirá */
  }
  return out
}

/** Separa «lhs = rhs» en el «=» de primer nivel (no <=, >=, ==, !=). */
function splitEq(s: string): [string, string] | null {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth--
    else if (c === '=' && depth === 0 && !'<>!='.includes(s[i - 1] ?? '') && s[i + 1] !== '=') return [s.slice(0, i).trim(), s.slice(i + 1).trim()]
  }
  return null
}

/** «(a, b)» → ["a", "b"] si es un par de primer nivel. */
function asPair(s: string): [string, string] | null {
  const t = s.trim()
  if (!t.startsWith('(') || !t.endsWith(')')) return null
  // el paréntesis inicial debe cerrar al final
  let depth = 0
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '(') depth++
    else if (t[i] === ')' && --depth === 0 && i < t.length - 1) return null
  }
  const parts = splitArgs(t.slice(1, -1))
  return parts.length === 2 ? [parts[0].trim(), parts[1].trim()] : null
}

const toList = (v: any): number[] | null => {
  const arr = M.isMatrix(v) ? (v as any).toArray() : v
  return Array.isArray(arr) ? arr.flat(Infinity).map(Number) : null
}

/** Interpreta una entrada con las definiciones del documento (session ya evaluó todo). */
export function classify(src0: string, session: Session): Item {
  const raw = src0.trim()
  if (!raw) return { kind: 'empty' }
  try {
    let s = prep(raw)
    // rango de una curva paramétrica: «(cos(t), sin(t)), 0 <= t <= 2pi»
    let range: [string, string] | null = null
    const rm = s.match(/^(.*\)),\s*(.+?)\s*<=?\s*t\s*<=?\s*(.+)$/)
    if (rm && asPair(rm[1])) {
      s = rm[1]
      range = [rm[2], rm[3]]
    }
    const scope = session.scope()
    const num = (e: string) => {
      const v = M.evaluate(session.expand(e), scope)
      return typeof v === 'number' ? v : Number(v)
    }
    const eq = splitEq(s)
    let label = raw
    let body = s
    if (eq) {
      const [lhs, rhs] = eq
      const fdef = lhs.match(/^([A-Za-z_]\w*)\s*\(\s*x\s*\)$/)
      if (fdef) return { kind: 'fn', label: raw, f: session.compileFn(rhs, 'x') }
      if (lhs === 'y' && !freeSymbols(session.expand(rhs, ['x'])).has('y')) return { kind: 'fn', label: raw, f: session.compileFn(rhs, 'x') }
      if (lhs === 'x' && ![...freeSymbols(session.expand(rhs))].some((v) => v === 'x' || v === 'y')) return { kind: 'vline', label: raw, x: num(rhs) }
      const name = lhs.match(/^[A-Za-z_]\w*$/)?.[0]
      if (name && name !== 'x' && name !== 'y') {
        // «a = 2» → deslizador; «P = (1, 2)» → punto; «g = x^2» → función
        const pair = asPair(rhs)
        if (pair) {
          label = name
          body = rhs
        } else {
          const free = freeSymbols(session.expand(rhs, ['x']))
          if (free.has('x')) return { kind: 'fn', label: raw, f: session.compileFn(rhs, 'x') }
          const v = M.evaluate(session.expand(rhs), scope)
          if (typeof v === 'number') return { kind: 'slider', name, value: v }
          return { kind: 'def' }
        }
      } else {
        // ecuación en x e y: curva implícita F(x, y) = 0
        const code = M.parse(session.expand(`(${lhs}) - (${rhs})`, ['x', 'y'])).compile()
        const F = (x: number, y: number) => {
          try {
            const r = code.evaluate({ ...scope, x, y })
            return typeof r === 'number' ? r : NaN
          } catch {
            return NaN
          }
        }
        return { kind: 'implicit', label: raw, F }
      }
    }
    const pair = asPair(body)
    if (pair) {
      const [ex, ey] = pair
      const usesT = [ex, ey].some((e) => freeSymbols(session.expand(e, ['t'])).has('t')) && !('t' in session.vars)
      if (usesT) {
        const t0 = range ? num(range[0]) : 0, t1 = range ? num(range[1]) : 2 * Math.PI
        return { kind: 'param', label, fx: session.compileFn(ex, 't'), fy: session.compileFn(ey, 't'), t0, t1 }
      }
      const vx = M.evaluate(session.expand(ex), scope), vy = M.evaluate(session.expand(ey), scope)
      const lx = toList(vx), ly = toList(vy)
      if (lx || ly) {
        const xs = lx ?? [], ys = ly ?? []
        const n = Math.min(xs.length || ys.length, ys.length || xs.length)
        return { kind: 'points', label, xs: lx ? xs.slice(0, n) : Array(n).fill(Number(vx)), ys: ly ? ys.slice(0, n) : Array(n).fill(Number(vy)) }
      }
      return { kind: 'point', label, x: Number(vx), y: Number(vy) }
    }
    // expresión suelta: función de x (una constante es una recta horizontal)
    if (/[<>]/.test(body)) return { kind: 'error', msg: L('Las desigualdades todavía no se grafican.', 'Inequalities are not plotted yet.') }
    return { kind: 'fn', label: raw, f: session.compileFn(body, 'x') }
  } catch (e: any) {
    return { kind: 'error', msg: String(e?.message ?? e) }
  }
}

/* ─────────────── trazas ─────────────── */

export interface View {
  x: [number, number]
  y: [number, number]
}

export interface Special {
  kind: 'raíz' | 'máximo' | 'mínimo' | 'intersección'
  x: number
  y: number
  of: string
}

/** Muestra una función en la vista (con margen para desplazar sin huecos). */
export function sampleView(f: (x: number) => number, v: View) {
  const w = v.x[1] - v.x[0]
  return sampleFn(f, v.x[0] - 0.25 * w, v.x[1] + 0.25 * w, { n: 500 })
}

/** Malla para curvas implícitas (Plotly dibuja la curva de nivel 0). */
export function implicitGrid(F: (x: number, y: number) => number, v: View, n = 180) {
  const wx = v.x[1] - v.x[0], wy = v.y[1] - v.y[0]
  const x0 = v.x[0] - 0.15 * wx, x1 = v.x[1] + 0.15 * wx, y0 = v.y[0] - 0.15 * wy, y1 = v.y[1] + 0.15 * wy
  const xs = Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1))
  const ys = Array.from({ length: n }, (_, j) => y0 + ((y1 - y0) * j) / (n - 1))
  const z = ys.map((y) => xs.map((x) => {
    const r = F(x, y)
    return Number.isFinite(r) ? r : null
  }))
  return { xs, ys, z }
}

export function sampleParam(fx: (t: number) => number, fy: (t: number) => number, t0: number, t1: number, n = 800) {
  const x: (number | null)[] = [], y: (number | null)[] = []
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n
    const a = fx(t), b = fy(t)
    const ok = Number.isFinite(a) && Number.isFinite(b)
    x.push(ok ? a : null)
    y.push(ok ? b : null)
  }
  return { x, y }
}

/** Raíces, extremos e intersecciones de las funciones visibles. */
export function specialPoints(fns: { label: string; f: (x: number) => number }[], v: View): Special[] {
  const out: Special[] = []
  const [a, b] = v.x
  const h = (b - a) * 1e-6
  const inView = (y: number) => Number.isFinite(y) && y >= v.y[0] - (v.y[1] - v.y[0]) && y <= v.y[1] + (v.y[1] - v.y[0])
  for (const { label, f } of fns.slice(0, 6)) {
    try {
      for (const r of numericRoots(f, a, b)) out.push({ kind: 'raíz', x: r, y: 0, of: label })
      const df = (x: number) => (f(x + h) - f(x - h)) / (2 * h)
      for (const r of numericRoots(df, a, b)) {
        const y = f(r)
        if (!inView(y)) continue
        const d2 = f(r + 100 * h) + f(r - 100 * h) - 2 * y
        if (Math.abs(d2) < 1e-14) continue
        out.push({ kind: d2 < 0 ? 'máximo' : 'mínimo', x: r, y, of: label })
      }
    } catch {
      /* función sin análisis */
    }
  }
  for (let i = 0; i < Math.min(fns.length, 5); i++)
    for (let j = i + 1; j < Math.min(fns.length, 5); j++) {
      try {
        const F = fns[i].f, G = fns[j].f
        for (const r of numericRoots((x) => F(x) - G(x), a, b)) {
          const y = F(r)
          if (inView(y)) out.push({ kind: 'intersección', x: r, y, of: `${fns[i].label} ∩ ${fns[j].label}` })
        }
      } catch {
        /* sin intersecciones */
      }
    }
  return out
}
