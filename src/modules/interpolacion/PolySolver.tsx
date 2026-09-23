// Lagrange, diferencias divididas de Newton y diferencias finitas (avance / retroceso), como en el Cap. 4 del texto.
import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { evalNumber, toScilab } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, FieldRow, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs, type Column } from '../../components/ui'
import * as A from './algorithms'
import { DataInput, DATA_DEFAULTS, parseData, type DataState, type ParsedData } from './DataInput'
import { polyTex, sci, sciVec, sub, texDiff, texFactor, tn, tp } from './texutil'
import { THEORY, TITLES, TOPIC } from './theory'
import { L } from '../../i18n'

export type PolyKind = 'lagrange' | 'diferencias-divididas' | 'diferencias-finitas'

interface State extends DataState {
  dir: A.Direction
  /** grado m del polinomio ('' = n, todos los datos) */
  grado: string
  /** índice k del nodo de apoyo ('' = x_0 en avance, x_n en retroceso) */
  apoyo: string
}

type Ex = { label: string; value: Partial<State> }

/** Nombre de la dirección para textos: «avance» / «retroceso». */
const dirName = (d: A.Direction) => (d === 'avance' ? L('avance', 'forward') : L('retroceso', 'backward'))

// Datos del texto: log10(x) redondeado a 6 decimales (Ej. 4.2, 4.4, 4.6) y con paso h = 0.4 (Ej. 4.8, 4.10)
const LOG: Partial<State> = { mode: 'puntos', xs: '1.2 1.6 2.1 2.5 2.7', ys: '0.079181 0.204120 0.322219 0.397940 0.431364', f: 'log10(x)', xbar: '2.3', grado: '', apoyo: '' }
const LOGH: Partial<State> = { mode: 'puntos', xs: '1.2 1.6 2.0 2.4 2.8', ys: '0.079181 0.204120 0.301030 0.380211 0.447158', f: 'log10(x)', xbar: '2.3', grado: '', apoyo: '' }
const BESSEL: Partial<State> = { mode: 'puntos', xs: '1 1.3 1.6 1.9 2.2', ys: '0.7651977 0.6200860 0.4554022 0.2818186 0.1103623', f: '', grado: '', apoyo: '' }
const RESET: Partial<State> = { grado: '', apoyo: '' }

const DEFAULTS: Record<PolyKind, Partial<State>> = {
  lagrange: { ...LOG },
  'diferencias-divididas': { ...LOG, dir: 'avance' },
  'diferencias-finitas': { ...LOGH, dir: 'avance' },
}

const EXAMPLES: Record<PolyKind, Ex[]> = {
  lagrange: [
    { label: L('Ej. 4.2 · P₄(2.3), log x', 'Ex. 4.2 · P₄(2.3), log x'), value: { ...LOG } },
    { label: L('Ej. 4.2 · P₂ con x₂, x₃, x₄', 'Ex. 4.2 · P₂ with x₂, x₃, x₄'), value: { ...LOG, grado: '2', apoyo: '2' } },
    { label: L('1/x en 2, 2.75, 4 → P(3)', '1/x at 2, 2.75, 4 → P(3)'), value: { ...RESET, mode: 'funcion', xs: '2 2.75 4', f: '1/x', xbar: '3' } },
    { label: L('cos x en 0, 0.6, 0.9 → P(0.45)', 'cos x at 0, 0.6, 0.9 → P(0.45)'), value: { ...RESET, mode: 'funcion', xs: '0 0.6 0.9', f: 'cos(x)', xbar: '0.45' } },
    { label: L('Tabla (1,2), (2,3), (3,5), (5,4)', 'Table (1,2), (2,3), (3,5), (5,4)'), value: { ...RESET, mode: 'puntos', xs: '1 2 3 5', ys: '2 3 5 4', f: '', xbar: '4' } },
  ],
  'diferencias-divididas': [
    { label: L('Ej. 4.4 · avance, P₄(2.3)', 'Ex. 4.4 · forward, P₄(2.3)'), value: { ...LOG, dir: 'avance' } },
    { label: L('Ej. 4.4 · P₃ apoyado en x₁', 'Ex. 4.4 · P₃ based at x₁'), value: { ...LOG, dir: 'avance', grado: '3', apoyo: '1' } },
    { label: L('Ej. 4.4 · P₂ apoyado en x₂', 'Ex. 4.4 · P₂ based at x₂'), value: { ...LOG, dir: 'avance', grado: '2', apoyo: '2' } },
    { label: L('Ej. 4.6 · retroceso, P₄(2.3)', 'Ex. 4.6 · backward, P₄(2.3)'), value: { ...LOG, dir: 'retroceso' } },
    { label: L('Ej. 4.6 · P₁ de retroceso apoyado en x₃', 'Ex. 4.6 · backward P₁ based at x₃'), value: { ...LOG, dir: 'retroceso', grado: '1', apoyo: '3' } },
    { label: L('Ej. 4.11 · P₃ apoyado en x₀ y su error', 'Ex. 4.11 · P₃ based at x₀ and its error'), value: { ...LOG, dir: 'avance', grado: '3', apoyo: '0' } },
    {
      label: L('Práctica 3 · ln x, P₃ apoyado en x₁', 'Practice 3 · ln x, P₃ based at x₁'),
      value: { mode: 'puntos', xs: '1 1.35 1.7 1.9 3', ys: '0 0.30010 0.53063 0.64185 1.09861', f: 'log(x)', xbar: '1.5', dir: 'avance', grado: '3', apoyo: '1' },
    },
    { label: L('Tabla J₀(x) de Burden → P(1.5)', 'Burden J₀(x) table → P(1.5)'), value: { ...BESSEL, xbar: '1.5', dir: 'avance' } },
  ],
  'diferencias-finitas': [
    { label: L('Ej. 4.8 · avance, P₄(2.3)', 'Ex. 4.8 · forward, P₄(2.3)'), value: { ...LOGH, dir: 'avance' } },
    { label: L('Ej. 4.8 · P₂ apoyado en x₁', 'Ex. 4.8 · P₂ based at x₁'), value: { ...LOGH, dir: 'avance', grado: '2', apoyo: '1' } },
    { label: L('Ej. 4.10 · retroceso, P₄(2.3)', 'Ex. 4.10 · backward, P₄(2.3)'), value: { ...LOGH, dir: 'retroceso' } },
    { label: L('Ej. 4.10 · P₁ de retroceso apoyado en x₃', 'Ex. 4.10 · backward P₁ based at x₃'), value: { ...LOGH, dir: 'retroceso', grado: '1', apoyo: '3' } },
    {
      label: L('Práctica 4 · butadieno, P₃(64)', 'Practice 4 · butadiene, P₃(64)'),
      value: { mode: 'puntos', xs: '50 60 70 80 90 100', ys: '24.94 30.11 36.05 42.84 50.57 59.30', f: '', xbar: '64', dir: 'avance', grado: '3', apoyo: '0' },
    },
    { label: L('J₀(x) de Burden: retroceso → P(2.0)', 'Burden J₀(x): backward → P(2.0)'), value: { ...BESSEL, xbar: '2', dir: 'retroceso' } },
    { label: L('sen x, h = 0.1 → P(0.05)', 'sin x, h = 0.1 → P(0.05)'), value: { ...RESET, mode: 'funcion', xs: '0 0.1 0.2 0.3 0.4', f: 'sin(x)', xbar: '0.05', dir: 'avance' } },
  ],
}

interface Calc {
  error?: string
  data?: ParsedData
  n?: number
  /** grado del polinomio */
  m?: number
  /** índice del nodo de apoyo */
  k?: number
  dir?: A.Direction
  /** índices de los nodos usados, en el orden de la fórmula */
  idx?: number[]
  /** forma de Newton del polinomio: P(x) = a_0 + a_1(x − z_0) + … */
  nw?: { z: number[]; a: number[] }
  coeffs?: A.Poly
  lag?: A.LagrangeResult
  /** tabla completa de diferencias divididas F[i][j] = f[x_i,…,x_{i+j}] */
  F?: number[][]
  /** tabla completa de diferencias finitas D[j][i] = Δ^j f(x_i) */
  D?: number[][]
  h?: number
  /** Δ^j f(x_k) o ∇^j f(x_k), j = 0..m */
  deltas?: number[]
  fin?: A.FiniteResult
  /** P(x̄) */
  px?: number
  /** estimación del error con el dato siguiente, (4.31)/(4.32) */
  est?: { value: number; next: number; coef: number; factor: number }
}

function parseIndex(src: string, name: string): number | string {
  const v = evalNumber(src)
  if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) return L(`${name} debe ser un entero ≥ 0.`, `${name} must be an integer ≥ 0.`)
  return v
}

export function compute(kind: PolyKind, s: State): Calc {
  const data = parseData(s, { max: 20 })
  if (data.error) return { error: data.error }
  const { xs, ys, xbar } = data
  const n = xs.length - 1
  const dir: A.Direction = kind === 'lagrange' ? 'avance' : s.dir
  const mi = s.grado.trim() ? parseIndex(s.grado, L('El grado m', 'The degree m')) : n
  if (typeof mi === 'string') return { error: mi }
  if (mi > n) return { error: L(`Con ${n + 1} datos el grado máximo es ${n}.`, `With ${n + 1} data points the maximum degree is ${n}.`) }
  const ki = s.apoyo.trim() ? parseIndex(s.apoyo, L('El índice k del nodo de apoyo', 'The index k of the base node')) : dir === 'avance' ? 0 : n
  if (typeof ki === 'string') return { error: ki }
  if (ki > n) return { error: L(`El nodo de apoyo debe ser x₀ … x${sub(n)}.`, `The base node must be one of x₀ … x${sub(n)}.`) }
  const m = mi, k = ki
  const idx = A.supportIndices(n, k, m, dir)
  if (!idx) {
    const need = dir === 'avance' ? `x${sub(k)}, …, x${sub(k + m)}` : `x${sub(k)}, x${sub(k - 1)}, …, x${sub(k - m)}`
    return {
      error: L(
        `No hay datos suficientes: un polinomio de grado ${m} de ${dir} apoyado en x${sub(k)} necesita ${need}, pero los datos van de x₀ a x${sub(n)}.`,
        `Not enough data: a ${dirName(dir)} polynomial of degree ${m} based at x${sub(k)} needs ${need}, but the data run from x₀ to x${sub(n)}.`,
      ),
    }
  }
  const F = A.dividedDifferences(xs, ys)
  const z = idx.map((i) => xs[i])
  const a = A.newtonCoefs(F, k, m, dir)
  const out: Calc = { data, n, m, k, dir, idx, F, nw: { z, a }, coeffs: A.newtonToPoly(z, a) }
  const has = Number.isFinite(xbar)
  const nextI = dir === 'avance' ? k + m + 1 : k - m - 1
  const hasNext = nextI >= 0 && nextI <= n
  if (kind === 'lagrange') {
    out.lag = A.lagrange(z, idx.map((i) => ys[i]))
    out.coeffs = out.lag.coeffs
    if (has) out.px = A.lagrangeBasisAt(z, xbar).reduce((acc, L, j) => acc + ys[idx[j]] * L, 0)
  } else if (kind === 'diferencias-divididas') {
    if (has) {
      out.px = A.newtonEval(z, a, xbar)
      if (hasNext) {
        const coef = A.newtonCoefs(F, k, m + 1, dir)[m + 1]
        const factor = A.nodeProduct(z, xbar)
        out.est = { value: coef * factor, next: nextI, coef, factor }
      }
    }
  } else {
    const h = A.equiStep(xs)
    if (h === null) {
      const gaps = xs.slice(1).map((x, i) => fmt(x - xs[i], 6))
      return {
        error: L(
          `Los nodos no están equiespaciados (diferencias xᵢ₊₁ − xᵢ: ${gaps.join(', ')}). Las fórmulas de diferencias finitas requieren paso h constante y nodos en orden; usa diferencias divididas de Newton.`,
          `The nodes are not equally spaced (differences xᵢ₊₁ − xᵢ: ${gaps.join(', ')}). Finite-difference formulas require a constant step h and ordered nodes; use Newton divided differences instead.`,
        ),
      }
    }
    out.h = h
    out.D = A.forwardDifferences(ys)
    out.deltas = A.finiteCoefs(out.D, k, m, dir)
    if (has) {
      out.fin = dir === 'avance' ? A.newtonForward(out.deltas, xs[k], h, xbar) : A.newtonBackward(out.deltas, xs[k], h, xbar)
      out.px = out.fin.value
      if (hasNext) {
        const coef = A.finiteCoefs(out.D, k, m + 1, dir)[m + 1]
        const factor = dir === 'avance' ? A.binomGen(out.fin.s, m + 1) : A.binomRising(out.fin.s, m + 1)
        out.est = { value: coef * factor, next: nextI, coef, factor }
      }
    }
  }
  return out
}

export function PolySolver({ kind }: { kind: PolyKind }) {
  const [s0, setS] = useLocalState<State>('interpolacion:' + kind, { ...DATA_DEFAULTS, dir: 'avance', grado: '', apoyo: '', ...DEFAULTS[kind] } as State)
  // estados guardados por versiones anteriores pueden no tener los campos nuevos
  const s: State = useMemo(() => ({ ...s0, dir: s0.dir ?? 'avance', grado: s0.grado ?? '', apoyo: s0.apoyo ?? '' }), [s0])
  const set = (p: Partial<State>) => setS((prev) => ({ ...prev, ...p }))
  const d = useDebounced(s, 200)
  const calc = useMemo(() => compute(kind, d), [kind, d])
  const lag = kind === 'lagrange'

  const inputs = (
    <>
      <DataInput s={s} set={set} />
      {!lag && (
        <SelectField
          label={L('Polinomio', 'Polynomial')}
          value={s.dir}
          onChange={(dir) => set({ dir })}
          options={
            kind === 'diferencias-divididas'
              ? [
                  { value: 'avance', label: L('De avance (apoyado en x₀ por defecto)', 'Forward (based at x₀ by default)') },
                  { value: 'retroceso', label: L('De retroceso (apoyado en xₙ por defecto)', 'Backward (based at xₙ by default)') },
                ]
              : [
                  { value: 'avance', label: L('De avance: Δ, s = (x − xₖ)/h', 'Forward: Δ, s = (x − xₖ)/h') },
                  { value: 'retroceso', label: L('De retroceso: ∇, s = (x − xₖ)/h', 'Backward: ∇, s = (x − xₖ)/h') },
                ]
          }
        />
      )}
      <FieldRow>
        <NumField label={L('Grado m', 'Degree m')} value={s.grado} onChange={(grado) => set({ grado })} placeholder={L('n (todos)', 'n (all)')} />
        <NumField label={lag ? L('Desde xₖ: k =', 'From xₖ: k =') : L('Apoyado en xₖ: k =', 'Based at xₖ: k =')} value={s.apoyo} onChange={(apoyo) => set({ apoyo })} placeholder={lag || s.dir === 'avance' ? '0' : 'n'} />
      </FieldRow>
      <Examples items={EXAMPLES[kind]} onPick={(v) => set({ ...RESET, ...v })} />
    </>
  )

  return (
    <MethodPage title={TITLES[kind]} topic={TOPIC} theory={THEORY[kind]} inputs={inputs}>
      {calc.error ? <Alert kind="error">{calc.error}</Alert> : calc.data && <Results kind={kind} s={d} c={calc as Required<Calc>} />}
    </MethodPage>
  )
}

/* ───────────────────────── Resultados ───────────────────────── */

const isPartial = (c: Required<Calc>) => c.m < c.n

/** Descripción del polinomio: «P₃ de avance apoyado en x₁». */
function polyName(kind: PolyKind, c: Required<Calc>): string {
  if (kind === 'lagrange') return isPartial(c) ? L(`P${sub(c.m)} con x${sub(c.k)} … x${sub(c.k + c.m)}`, `P${sub(c.m)} with x${sub(c.k)} … x${sub(c.k + c.m)}`) : `P${sub(c.m)}`
  return L(`P${sub(c.m)} de ${c.dir} apoyado en x${sub(c.k)}`, `${dirName(c.dir)} P${sub(c.m)} based at x${sub(c.k)}`)
}

function Results({ kind, s, c }: { kind: PolyKind; s: State; c: Required<Calc> }) {
  const { xs, f, xbar } = c.data
  const has = Number.isFinite(xbar)
  const fx = has && f ? f.f(xbar) : NaN
  const lo = Math.min(...c.nw.z), hi = Math.max(...c.nw.z)
  const extrap = has && (xbar < lo || xbar > hi)

  const stats = [
    { label: has ? `P${sub(c.m)}(${fmt(xbar, 6)})` : 'P(x̄)', value: has ? fmt(c.px, 12) : '—', accent: true, hint: has ? polyName(kind, c) : L('indica x̄ para evaluar', 'enter x̄ to evaluate') },
    { label: L('Grado', 'Degree'), value: c.m, hint: L(`usa ${c.m + 1} de ${c.n + 1} datos`, `uses ${c.m + 1} of ${c.n + 1} data points`) },
  ] as { label: ReactNode; value: ReactNode; hint?: ReactNode; accent?: boolean }[]
  if (kind === 'diferencias-finitas') stats.push({ label: L('Paso h / s', 'Step h / s'), value: fmt(c.h, 8), hint: c.fin ? `s = (x̄ − x${sub(c.k)})/h = ${fmt(c.fin.s, 8)}` : undefined })
  if (c.est) stats.push({
      label: L('Error estimado (dato siguiente)', 'Estimated error (next data point)'),
      value: fmtErr(c.est.value),
      hint: L(`con x${sub(c.est.next)}, fórmula `, `with x${sub(c.est.next)}, formula `) + (kind === 'diferencias-finitas' ? '(4.32)' : '(4.31)'),
    })
  if (f && has) {
    stats.push({ label: `f(${fmt(xbar, 6)})`, value: fmt(fx, 12) })
    stats.push({ label: L('Error real f − P', 'Actual error f − P'), value: fmtErr(fx - c.px), hint: L('relativo: ', 'relative: ') + fmtErr(Math.abs((fx - c.px) / fx)) })
  }

  const tabs = [
    { label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={stepsFor(kind, s, c)} /></Card> },
    { label: L('Gráfica', 'Plot'), content: <Card><MainPlot c={c} /></Card> },
  ]
  if (kind === 'lagrange') tabs.push({ label: L('Polinomios base', 'Basis polynomials'), content: <Card><BasisPlot c={c} /></Card> })
  else tabs.push({ label: L('Construcción', 'Construction'), content: <Card><BuildPlot c={c} /></Card> })
  if (f) tabs.push({ label: L('Error real', 'Actual error'), content: <Card><ErrPlot c={c} /></Card> })

  const tableTitle =
    kind === 'lagrange'
      ? L('Polinomios de Lagrange en x̄', 'Lagrange polynomials at x̄')
      : kind === 'diferencias-divididas'
        ? L('Tabla de diferencias divididas', 'Divided-difference table') + (c.dir === 'retroceso' ? L(' (de retroceso: es la misma tabla)', ' (backward: it is the same table)') : '')
        : L(`Tabla de diferencias finitas de ${c.dir}`, `${c.dir === 'avance' ? 'Forward' : 'Backward'} finite-difference table`)
  return (
    <>
      <Stats items={stats} />
      {extrap && (
        <Alert kind="warn">
          {L(
            <>
              {L(
            <>
              x̄ = {fmt(xbar)} está fuera de [{fmt(lo)}, {fmt(hi)}], el rango de los nodos usados: es <b>extrapolación</b> y el error puede ser grande.
            </>,
            <>
              x̄ = {fmt(xbar)} lies outside [{fmt(lo)}, {fmt(hi)}], the range of the nodes used: this is <b>extrapolation</b> and the error may be large.
            </>,
          )}
            </>,
            <>
              x̄ = {fmt(xbar)} lies outside [{fmt(lo)}, {fmt(hi)}], the range of the nodes used: this is <b>extrapolation</b> and the error may be large.
            </>,
          )}
        </Alert>
      )}
      <Card title={L('Polinomio de interpolación', 'Interpolating polynomial')}>
        <PolyForms kind={kind} s={s} c={c} />
      </Card>
      <Card title={tableTitle}>
        <TableFor kind={kind} c={c} />
      </Card>
      <Tabs tabs={tabs} />
      <ScilabCode code={scilabFor(kind, s, c)} filename={kind.replace(/-/g, '_')} />
    </>
  )
}

function PolyForms({ kind, s, c }: { kind: PolyKind; s: State; c: Required<Calc> }) {
  const { ys } = c.data
  const lines: string[] = []
  const P = `P_{${c.m}}`
  if (kind === 'lagrange') {
    if (c.m <= 6) lines.push(`${P}(x) = ` + c.idx.map((i, j) => `${j ? (ys[i] < 0 ? '-' : '+') : ys[i] < 0 ? '-' : ''} ${tn(Math.abs(ys[i]), s.frac)}\\,L_{${i}}(x)`).join(' '))
  } else if (kind === 'diferencias-divididas') {
    lines.push(`${P}(x) = ` + newtonFormTex(c.nw.z, c.nw.a, s.frac))
  } else {
    lines.push(finiteSFormTex(c.deltas, c.dir, c.k, s.frac))
  }
  lines.push(`${P}(x) = ` + polyTex(c.coeffs, s.frac))
  return (
    <>
      {lines.map((l, i) => (
        <Tex key={i} block>
          {l}
        </Tex>
      ))}
    </>
  )
}

export function newtonFormTex(z: number[], a: number[], frac: boolean, maxTerms = 12): string {
  const parts: string[] = []
  let prod = ''
  a.slice(0, maxTerms).forEach((ak, k) => {
    if (k > 0) prod += texFactor(z[k - 1])
    const sign = parts.length ? (ak < 0 ? ' - ' : ' + ') : ak < 0 ? '-' : ''
    parts.push(sign + tn(Math.abs(ak), frac) + (prod ? '\\,' + prod : ''))
  })
  if (a.length > maxTerms) parts.push(' + \\cdots')
  return parts.join('')
}

/** Símbolo Δ^j f(x_k) / ∇^j f(x_k) en TeX. */
const dsym = (dir: A.Direction, j: number, k: number) => (j === 0 ? `f(x_{${k}})` : `${dir === 'avance' ? '\\Delta' : '\\nabla'}^{${j}} f(x_{${k}})`)

/** Forma del texto: avance Σ C(s,j) Δ^j f(x_k); retroceso Σ (−1)^j C(|s|,j) ∇^j f(x_k). */
export function finiteSFormTex(deltas: number[], dir: A.Direction, k: number, frac: boolean): string {
  const fw = dir === 'avance'
  const v = fw ? 's' : '|s|'
  const parts: string[] = []
  deltas.slice(0, 8).forEach((delta, j) => {
    let fac = ''
    for (let t = 0; t < j; t++) fac += t === 0 ? v : `(${v}-${t})`
    const coef = j === 0 ? '' : j === 1 ? fac : `\\frac{${fac}}{${j}!}`
    const neg = (delta < 0) !== (!fw && j % 2 === 1)
    const sign = parts.length ? (neg ? ' - ' : ' + ') : neg ? '-' : ''
    parts.push(sign + tn(Math.abs(delta), frac) + (coef ? '\\,' + coef : ''))
  })
  if (deltas.length > 8) parts.push(' + \\cdots')
  return `P_{${deltas.length - 1}}(s) = ` + parts.join('') + `,\\qquad s = \\frac{x - x_{${k}}}{h}`
}

/** v_0 op c_1[v_1 op c_2[ … v_m ]]  (forma anidada del texto). */
function nestedTex(v: string[], c: string[], op: '+' | '-'): string {
  const inner = (j: number): string => (j === v.length - 1 ? v[j] : `${v[j]} ${op} ${c[j + 1]}\\left[${inner(j + 1)}\\right]`)
  return inner(0)
}

/* ───────────────────────── Tablas ───────────────────────── */

const HL: CSSProperties = { background: 'var(--hl)', color: 'var(--accent)', fontWeight: 700, padding: '1px 5px', borderRadius: 4 }
const cellV = (v: number | undefined, on: boolean): ReactNode => (v === undefined ? '' : on ? <span style={HL}>{fmt(v)}</span> : fmt(v))

function TableFor({ kind, c }: { kind: PolyKind; c: Required<Calc> }) {
  const { xs, ys, xbar } = c.data
  const n = c.n
  const idxCol: Column<any> = { key: 'i', tex: 'i', fmt: 'int', align: 'center' }
  if (kind === 'lagrange') {
    const has = Number.isFinite(xbar)
    const Lv = has ? A.lagrangeBasisAt(c.nw.z, xbar) : []
    const rows = c.idx.map((i, j) => ({ i, x: xs[i], y: ys[i], den: c.lag.denoms[j], L: has ? Lv[j] : NaN, yL: has ? ys[i] * Lv[j] : NaN }))
    const cols: Column<any>[] = [idxCol, { key: 'x', tex: 'x_i' }, { key: 'y', tex: 'f(x_i)' }, { key: 'den', tex: '\\prod_{k\\ne i}(x_i-x_k)' }]
    if (has) cols.push({ key: 'L', tex: 'L_i(\\bar x)' }, { key: 'yL', tex: 'f(x_i)\\,L_i(\\bar x)' })
    return (
      <>
        <DataTable columns={cols} rows={rows} filename="lagrange" />
        {has && (
          <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
            Σ L_i(x̄) = {fmt(Lv.reduce((a, b) => a + b, 0), 12)} {L('(siempre 1)', '(always 1)')} · Σ f(x_i) L_i(x̄) = P(x̄) = {fmt(c.px, 12)}
          </p>
        )}
      </>
    )
  }
  const fw = c.dir === 'avance'
  // celda (fila i, orden j) usada por el polinomio
  const used = (i: number, j: number) => j <= c.m && (fw ? i === c.k : i === c.k - j)
  if (kind === 'diferencias-divididas') {
    const rows = xs.map((x, i) => {
      const r: Record<string, number> = { i, x }
      for (let j = 0; j + i <= n; j++) r['o' + j] = c.F[i][j]
      return r
    })
    const cols: Column<any>[] = [idxCol, { key: 'x', tex: 'x_i' }]
    for (let j = 0; j <= n; j++)
      cols.push({ key: 'o' + j, tex: j === 0 ? 'f(x_i)' : j === 1 ? 'f[x_i,x_{i+1}]' : j === 2 ? 'f[x_i,x_{i+1},x_{i+2}]' : `f[x_i,\\dots,x_{i+${j}}]`, get: (r: any) => cellV(r['o' + j], used(r.i, j)) })
    return (
      <>
        <DataTable columns={cols} rows={rows} filename="diferencias_divididas" />
        <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
          {L('Resaltados: los coeficientes de ', 'Highlighted: the coefficients of ')}
          {polyName(kind, c)}.{' '}
          {fw ? (
            <>
              {L('De avance: fila', 'Forward: row')} <Tex>{`i = ${c.k}`}</Tex>, <Tex>{`a_j = f[x_{${c.k}},\\dots,x_{${c.k}+j}]`}</Tex>.
            </>
          ) : (
            <>
              {L('De retroceso: el valor que termina en', 'Backward: the value ending at')} <Tex>{`x_{${c.k}}`}</Tex> {L('en cada columna', 'in each column')},{' '}
              <Tex>{`a_j = f[x_{${c.k}-j},\\dots,x_{${c.k}}]`}</Tex>.
            </>
          )}
        </p>
      </>
    )
  }
  const rows = xs.map((x, i) => {
    const r: Record<string, number> = { i, x }
    for (let j = 0; j + i <= n; j++) r['d' + j] = c.D[j][i]
    return r
  })
  const cols: Column<any>[] = [idxCol, { key: 'x', tex: 'x_i' }]
  for (let j = 0; j <= n; j++)
    cols.push({
      key: 'd' + j,
      tex: j === 0 ? 'f(x_i)' : fw ? `\\Delta^{${j}} f(x_i)` : `\\nabla^{${j}} f(x_{i+${j}})`,
      get: (r: any) => cellV(r['d' + j], used(r.i, j)),
    })
  return (
    <>
      <DataTable columns={cols} rows={rows} filename={fw ? 'diferencias_finitas_avance' : 'diferencias_finitas_retroceso'} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        {L('Resaltados:', 'Highlighted:')} {fw ? <Tex>{`\\Delta^j f(x_{${c.k}})`}</Tex> : <Tex>{`\\nabla^j f(x_{${c.k}})`}</Tex>}, <Tex>{`j = 0,\\dots,${c.m}`}</Tex>.{' '}
        {fw
          ? L('Cada columna se obtiene restando dos términos seguidos de la anterior.', 'Each column is obtained by subtracting consecutive entries of the previous one.')
          : L(
              <>Es la misma tabla de avance, porque <Tex>{'\\nabla^j f(x_{i+j}) = \\Delta^j f(x_i)'}</Tex>.</>,
              <>It is the same as the forward table, because <Tex>{'\\nabla^j f(x_{i+j}) = \\Delta^j f(x_i)'}</Tex>.</>,
            )}
      </p>
    </>
  )
}

/* ───────────────────────── Gráficas ───────────────────────── */

function range(c: Required<Calc>): [number, number] {
  const { xs, xbar } = c.data
  const pts = Number.isFinite(xbar) ? [...xs, xbar] : xs
  const lo = Math.min(...pts), hi = Math.max(...pts)
  const pad = (hi - lo) * 0.08 || 1
  return [lo - pad, hi + pad]
}

function MainPlot({ c }: { c: Required<Calc> }) {
  const data = useMemo(() => {
    const { xs, ys, f, xbar } = c.data
    const [a, b] = range(c)
    const P = (x: number) => A.newtonEval(c.nw.z, c.nw.a, x)
    const t: Trace[] = []
    if (f) t.push({ ...sample(f.f, a, b), type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: SERIES[1], width: 2, dash: 'dash' } })
    t.push({ ...sample(P, a, b, 500), type: 'scatter', mode: 'lines', name: `P${sub(c.m)}(x)`, line: { color: SERIES[0], width: 2.5 } })
    t.push({ x: c.idx.map((i) => xs[i]), y: c.idx.map((i) => ys[i]), type: 'scatter', mode: 'markers', name: L('nodos usados', 'nodes used'), marker: { color: SERIES[3], size: 9 } })
    const rest = xs.map((_, i) => i).filter((i) => !c.idx.includes(i))
    if (rest.length) t.push({ x: rest.map((i) => xs[i]), y: rest.map((i) => ys[i]), type: 'scatter', mode: 'markers', name: L('datos no usados', 'unused data'), marker: { color: '#94a3b8', size: 8, symbol: 'circle-open' } })
    if (Number.isFinite(xbar)) t.push({ x: [xbar], y: [P(xbar)], type: 'scatter', mode: 'markers', name: 'P(x̄)', marker: { color: SERIES[5], size: 13, symbol: 'star' } })
    return t
  }, [c])
  return <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
}

function BasisPlot({ c }: { c: Required<Calc> }) {
  const data = useMemo(() => {
    const z = c.nw.z
    const [a, b] = range(c)
    const t: Trace[] = c.lag.basis.map((L, j) => ({ ...sample((x) => A.polyEval(L, x), a, b, 400), type: 'scatter', mode: 'lines', name: `L${sub(c.idx[j])}(x)`, line: { color: SERIES[j % SERIES.length], width: 2 } }))
    t.push({ x: z, y: z.map(() => 1), type: 'scatter', mode: 'markers', name: L('valor 1', 'value 1'), marker: { color: '#94a3b8', size: 6, symbol: 'circle-open' } })
    t.push({ x: z, y: z.map(() => 0), type: 'scatter', mode: 'markers', name: L('valor 0', 'value 0'), marker: { color: '#94a3b8', size: 6 } })
    return t
  }, [c])
  return (
    <>
      <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        {L(
          <>
            {L(
          <>
            Cada <Tex>L_i</Tex> vale 1 en su nodo <Tex>x_i</Tex> y 0 en los demás nodos (<Tex>{'L_i(x_k)=\\delta_{ik}'}</Tex>).
          </>,
          <>
            Each <Tex>L_i</Tex> equals 1 at its own node <Tex>x_i</Tex> and 0 at the other nodes (<Tex>{'L_i(x_k)=\\delta_{ik}'}</Tex>).
          </>,
        )}
          </>,
          <>
            Each <Tex>L_i</Tex> equals 1 at its own node <Tex>x_i</Tex> and 0 at the other nodes (<Tex>{'L_i(x_k)=\\delta_{ik}'}</Tex>).
          </>,
        )}
      </p>
    </>
  )
}

function BuildPlot({ c }: { c: Required<Calc> }) {
  const data = useMemo(() => {
    const { xs, ys } = c.data
    const [a, b] = range(c)
    const t: Trace[] = c.nw.a.map((_, j) => {
      const aj = c.nw.a.slice(0, j + 1)
      return { ...sample((x) => A.newtonEval(c.nw.z, aj, x), a, b, 300), type: 'scatter', mode: 'lines', name: `P${sub(j)}(x)`, line: { color: SERIES[j % SERIES.length], width: j === c.m ? 2.8 : 1.4 } }
    })
    t.push({ x: xs, y: ys, type: 'scatter', mode: 'markers', name: L('datos', 'data'), marker: { color: '#94a3b8', size: 9 } })
    return t
  }, [c])
  return (
    <>
      <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        <Tex>{'P_j(x) = P_{j-1}(x) + a_j\\prod_{i<j}(x-z_i)'}</Tex>
        {L(
          <>
            : cada término nuevo corrige al anterior sin modificar los ya calculados; <Tex>P_j</Tex> interpola los primeros <Tex>j+1</Tex> nodos usados.
          </>,
          <>
            : each new term corrects the previous polynomial without changing the terms already computed; <Tex>P_j</Tex> interpolates the first <Tex>j+1</Tex> nodes used.
          </>,
        )}
      </p>
    </>
  )
}

function ErrPlot({ c }: { c: Required<Calc> }) {
  const data = useMemo(() => {
    const { f } = c.data
    const [a, b] = range(c)
    const e = sample((x) => Math.abs(f!.f(x) - A.newtonEval(c.nw.z, c.nw.a, x)), a, b, 600)
    return [{ x: e.x, y: e.y.map((v) => (v !== null && v > 0 ? v : null)), type: 'scatter', mode: 'lines', name: '|f(x) − P(x)|', line: { color: SERIES[6], width: 2 } }] as Trace[]
  }, [c])
  return (
    <>
      <Plot data={data} layout={{ yaxis: { type: 'log', title: { text: L('|f − P| (escala log)', '|f − P| (log scale)') }, exponentformat: 'power' }, xaxis: { title: { text: 'x' } } }} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        {L(
          'El error se anula en los nodos usados y crece hacia los bordes y fuera de ellos. Para la cota con la derivada ver «Estimación del error».',
          'The error vanishes at the nodes used and grows toward the ends and beyond them. For the bound based on the derivative see “Error estimate”.',
        )}
      </p>
    </>
  )
}

/* ───────────────────────── Paso a paso ───────────────────────── */

type Step = { text?: ReactNode; tex?: string }
const N = (x: number) => tn(x, false, 10)
const P_ = (x: number) => tp(x, false, 10)

export function stepsFor(kind: PolyKind, s: State, c: Required<Calc>): Step[] {
  const { xs, ys, f, xbar } = c.data
  const n = c.n, m = c.m, k = c.k
  const has = Number.isFinite(xbar)
  const fw = c.dir === 'avance'
  const out: Step[] = []
  if (f && s.mode === 'funcion') out.push({ text: L('Valores de la función en los nodos:', 'Function values at the nodes:'), tex: xs.map((x, i) => `f(${N(x)}) = ${N(ys[i])}`).join(',\\quad ') })
  out.push({
    text:
      m === n
        ? L(`Con ${n + 1} datos el polinomio de interpolación es de grado ${n} (y es único).`, `With ${n + 1} data points the interpolating polynomial has degree ${n} (and is unique).`)
        : L(
            `Polinomio de grado ${m} ${kind === 'lagrange' ? '' : `de ${c.dir} apoyado en x${sub(k)}`}: usa los nodos ${c.idx.map((i) => `x${sub(i)}`).join(', ')}.`,
            `${kind === 'lagrange' ? 'Polynomial' : `${c.dir === 'avance' ? 'Forward' : 'Backward'} polynomial`} of degree ${m}${kind === 'lagrange' ? '' : ` based at x${sub(k)}`}: it uses the nodes ${c.idx.map((i) => `x${sub(i)}`).join(', ')}.`,
          ),
  })

  if (kind === 'lagrange') {
    const z = c.nw.z
    const show = Math.min(m + 1, 8)
    if (has) {
      const Lv = A.lagrangeBasisAt(z, xbar)
      for (let j = 0; j < show; j++) {
        const numF = z.map((xj, t) => (t === j ? '' : texDiff(xbar, xj))).join('')
        const denF = z.map((xj, t) => (t === j ? '' : texDiff(z[j], xj))).join('')
        out.push({ text: j === 0 ? L(`Polinomios de Lagrange (4.11) evaluados en x̄ = ${fmt(xbar)}:`, `Lagrange polynomials (4.11) evaluated at x̄ = ${fmt(xbar)}:`) : undefined, tex: m === 0 ? `L_{${c.idx[0]}}(\\bar x) = 1` : `L_{${c.idx[j]}}(${N(xbar)}) = \\frac{${numF}}{${denF}} = ${N(Lv[j])}` })
      }
      if (show < m + 1) out.push({ text: L(`… (${m + 1 - show} bases más, análogas).`, `… (${m + 1 - show} more basis polynomials, computed likewise).`) })
      const sum = c.idx.slice(0, show).map((i, j) => `${P_(ys[i])}(${N(Lv[j])})`).join(' + ') + (show < m + 1 ? ' + \\cdots' : '')
      out.push({ text: L('Se aplica (4.12), P(x̄) = Σ f(xᵢ) Lᵢ(x̄):', 'Apply (4.12), P(x̄) = Σ f(xᵢ) Lᵢ(x̄):'), tex: `P_{${m}}(${N(xbar)}) = ${sum} = ${N(c.px)}` })
    }
    for (let j = 0; j < show; j++) {
      const numF = z.map((xj, t) => (t === j ? '' : texFactor(xj))).join('')
      const denF = z.map((xj, t) => (t === j ? '' : texDiff(z[j], xj))).join('')
      const numPoly = A.polyScale(c.lag.basis[j], c.lag.denoms[j])
      out.push({
        text: j === 0 ? L('Polinomios base como funciones de x:', 'Basis polynomials as functions of x:') : undefined,
        tex: m === 0 ? `L_{${c.idx[0]}}(x) = 1` : `L_{${c.idx[j]}}(x) = \\frac{${numF}}{${denF}} = \\frac{${polyTex(numPoly)}}{${N(c.lag.denoms[j])}} = ${polyTex(c.lag.basis[j], s.frac)}`,
      })
    }
    out.push({ text: L('Polinomio de interpolación, agrupando términos:', 'Interpolating polynomial, collecting terms:'), tex: `P_{${m}}(x) = ${polyTex(c.coeffs, s.frac)}` })
  } else if (kind === 'diferencias-divididas') {
    out.push({ text: L('Tabla de diferencias divididas (4.18). Orden 0:', 'Divided-difference table (4.18). Order 0:'), tex: xs.map((_, i) => `f[x_{${i}}] = ${N(ys[i])}`).join(',\\quad ') })
    let shown = 0
    for (let j = 1; j <= n && shown < 14; j++) {
      for (let i = 0; i + j <= n && shown < 14; i++, shown++) {
        const lab = (a: number, b: number) => (b - a >= 3 ? `f[x_{${a}},\\dots,x_{${b}}]` : `f[${Array.from({ length: b - a + 1 }, (_, t) => `x_{${a + t}}`).join(',')}]`)
        out.push({
          text: i === 0 ? L(`Orden ${j}:`, `Order ${j}:`) : undefined,
          tex: `${lab(i, i + j)} = \\frac{${lab(i + 1, i + j)} - ${lab(i, i + j - 1)}}{x_{${i + j}} - x_{${i}}} = \\frac{${N(c.F[i + 1][j - 1])} - ${P_(c.F[i][j - 1])}}{${N(xs[i + j])} - ${P_(xs[i])}} = ${N(c.F[i][j])}`,
        })
      }
    }
    if (shown >= 14) out.push({ text: L('… el resto de la tabla se calcula igual (ver la tabla).', '… the rest of the table is computed the same way (see the table).') })
    const lab = (j: number) => (fw ? (j === 0 ? `f(x_{${k}})` : `f[x_{${k}},\\dots,x_{${k + j}}]`) : j === 0 ? `f(x_{${k}})` : `f[x_{${k - j}},\\dots,x_{${k}}]`)
    out.push({
      text: fw
        ? L(`Coeficientes de avance (fila de x${sub(k)} de la tabla):`, `Forward coefficients (row of x${sub(k)} in the table):`)
        : L(`Coeficientes de retroceso (último valor de cada columna que termina en x${sub(k)}):`, `Backward coefficients (last value of each column ending at x${sub(k)}):`),
      tex: c.nw.a.slice(0, 9).map((a, j) => `${lab(j)} = ${N(a)}`).join(',\\quad ') + (m > 8 ? ',\\;\\dots' : ''),
    })
    out.push({ text: L('Forma de Newton ', 'Newton form ') + (fw ? '(4.17):' : '(4.19):'), tex: `P_{${m}}(x) = ${newtonFormTex(c.nw.z, c.nw.a, false)}` })
    if (has) {
      const v = c.nw.a.map((a) => N(a))
      const cs = ['', ...c.nw.z.map((zi) => texDiff(xbar, zi))]
      if (m <= 10) out.push({ text: L('Se evalúa en forma anidada:', 'Evaluate in nested form:'), tex: `P_{${m}}(${N(xbar)}) = ${nestedTex(v, cs, '+')} = ${N(c.px)}` })
      else out.push({ text: L('Evaluación en forma anidada:', 'Nested-form evaluation:'), tex: `P_{${m}}(${N(xbar)}) = ${N(c.px)}` })
      if (c.est) {
        const nx = c.est.next
        out.push({
          text: L(`Estimación del error (4.31) con el dato siguiente x${sub(nx)} = ${fmt(xs[nx])}:`, `Error estimate (4.31) with the next data point x${sub(nx)} = ${fmt(xs[nx])}:`),
          tex: `R_{${m}}(${N(xbar)}) \\approx ${fw ? `f[x_{${k}},\\dots,x_{${nx}}]` : `f[x_{${nx}},\\dots,x_{${k}}]`}\\prod(\\bar x - x_i) = ${P_(c.est.coef)}\\cdot(${N(c.est.factor)}) = ${tn(c.est.value, false, 6)}`,
        })
      }
    }
    out.push({ text: L('Desarrollando los productos:', 'Expanding the products:'), tex: `P_{${m}}(x) = ${polyTex(c.coeffs, s.frac)}` })
  } else {
    const h = c.h
    const D = c.D
    out.push({ text: L('Los nodos están equiespaciados:', 'The nodes are equally spaced:'), tex: `h = x_1 - x_0 = ${N(xs[1])} - ${P_(xs[0])} = ${N(h)}` })
    const lines: string[] = []
    for (let j = 1; j <= Math.min(m, 8); j++) {
      if (fw) lines.push(`${dsym('avance', j, k)} &= ${dsym('avance', j - 1, k + 1)} - ${dsym('avance', j - 1, k)} = ${N(D[j - 1][k + 1])} - ${P_(D[j - 1][k])} = ${N(D[j][k])}`)
      else lines.push(`${dsym('retroceso', j, k)} &= ${dsym('retroceso', j - 1, k)} - ${dsym('retroceso', j - 1, k - 1)} = ${N(D[j - 1][k - j + 1])} - ${P_(D[j - 1][k - j])} = ${N(D[j][k - j])}`)
    }
    if (m >= 1)
      out.push({
        text: fw
          ? L(`Diferencias finitas de avance (4.21) en x${sub(k)} (fila de x${sub(k)} de la tabla):`, `Forward finite differences (4.21) at x${sub(k)} (row of x${sub(k)} in the table):`)
          : L(`Diferencias finitas de retroceso (4.26) en x${sub(k)} (se leen en la misma tabla):`, `Backward finite differences (4.26) at x${sub(k)} (read from the same table):`),
        tex: '\\begin{aligned}' + lines.join('\\\\') + '\\end{aligned}',
      })
    if (has && c.fin) {
      const sv = c.fin.s
      out.push({ text: L('Se calcula s:', 'Compute s:'), tex: `s = \\frac{\\bar x - x_{${k}}}{h} = \\frac{${N(xbar)} - ${P_(xs[k])}}{${N(h)}} = ${N(sv)}` })
      const v = c.deltas.map((d) => N(d))
      if (fw || sv > 0) {
        // avance (4.23); retroceso con s > 0 (extrapolación): s(s+1)…(s+j−1)/j!
        const cs = ['', ...c.deltas.slice(1).map((_, t) => (t === 0 ? P_(sv) : `\\frac{${N(sv)} ${fw ? '-' : '+'} ${t}}{${t + 1}}`))]
        out.push({ text: fw ? L('Forma anidada (4.23):', 'Nested form (4.23):') : L('Forma anidada con s(s+1)…(s+j−1)/j!:', 'Nested form with s(s+1)…(s+j−1)/j!:'), tex: `P_{${m}}(${N(sv)}) = ${m <= 8 ? nestedTex(v, cs, '+') : '\\cdots'} = ${N(c.fin.value)}` })
      } else {
        const sa = Math.abs(sv)
        const cs = ['', ...c.deltas.slice(1).map((_, t) => (t === 0 ? N(sa) : `\\frac{${N(sa)} - ${t}}{${t + 1}}`))]
        out.push({ text: L('Forma anidada del texto (4.28), con |s|:', 'Textbook nested form (4.28), with |s|:'), tex: `P_{${m}}(s = ${N(sv)}) = ${m <= 8 ? nestedTex(v, cs, '-') : '\\cdots'} = ${N(c.fin.value)}` })
      }
      const tl = c.fin.terms.slice(0, 9).map((t) => {
        let fac = ''
        for (let q = 0; q < t.k; q++) fac += `(${N(fw ? sv - q : sv + q)})`
        const coef = t.k === 0 ? '' : t.k === 1 ? fac : `\\frac{${fac}}{${t.k}!}`
        return `j=${t.k}:&\\quad ${coef ? coef + '\\,' : ''}${dsym(c.dir, t.k, k)} = ${t.k ? `${N(t.coef)}\\cdot ` : ''}${P_(t.delta)} = ${N(t.value)}`
      })
      out.push({ text: L('Término a término:', 'Term by term:'), tex: '\\begin{aligned}' + tl.join('\\\\') + '\\end{aligned}' })
      if (c.est) {
        const nx = c.est.next
        let fac = ''
        for (let q = 0; q <= m; q++) fac += `(${N(fw ? sv - q : sv + q)})`
        out.push({
          text: L(`Estimación del error (4.32) con el dato siguiente x${sub(nx)} = ${fmt(xs[nx])}:`, `Error estimate (4.32) with the next data point x${sub(nx)} = ${fmt(xs[nx])}:`),
          tex: `R_{${m}} \\approx \\frac{${fac}}{${m + 1}!}\\,${dsym(c.dir, m + 1, k)} = ${N(c.est.factor)}\\cdot ${P_(c.est.coef)} = ${tn(c.est.value, false, 6)}`,
        })
      }
    }
    out.push({ text: L('En potencias de x (sustituyendo s):', 'In powers of x (substituting s):'), tex: `P_{${m}}(x) = ${polyTex(c.coeffs, s.frac)}` })
  }
  if (has && f) {
    const fx = f.f(xbar)
    out.push({
      text: L('Comparación con el valor exacto:', 'Comparison with the exact value:'),
      tex: `f(${N(xbar)}) = ${N(fx)},\\qquad f(\\bar x) - P(\\bar x) = ${N(fx)} - ${P_(c.px)} = ${tn(fx - c.px, false, 4)},\\qquad \\text{${L('error relativo', 'relative error')}} = ${tn(Math.abs((fx - c.px) / fx), false, 3)}`,
    })
  }
  return out
}

/* ───────────────────────── Scilab ───────────────────────── */

export function scilabFor(kind: PolyKind, s: State, c: Required<Calc>): string {
  const { xs, ys, f, xbar } = c.data
  const xb = Number.isFinite(xbar) ? sci(xbar) : sci((xs[0] + xs[1]) / 2)
  const fw = c.dir === 'avance'
  let code = `// ${TITLES[kind]} — ${L('generado por NumLab', 'generated by NumLab')}\nclear; clc;\n`
  if (f) code += `function y = f(x)\n  y = ${toScilab(f.src, true)};\nendfunction\n\n`
  code += `x = ${sciVec(xs)};\n`
  code += s.mode === 'funcion' && f ? `y = f(x);\n` : `y = ${sciVec(ys)};\n`
  code += `xb = ${xb};${Number.isFinite(xbar) ? '' : L('  // (no se indico x barra: se usa un punto de ejemplo)', '  // (no x bar given: a sample point is used)')}\n`
  code += L(
    `n = length(x) - 1;   // datos x_0 ... x_n (en Scilab los indices empiezan en 1)\nm = ${c.m};            // grado del polinomio\nk = ${c.k};            // ${kind === 'lagrange' ? 'se usan x_k ... x_(k+m)' : `apoyado en x_k (${c.dir})`}\npx = poly(0, 'x');\n\n`,
    `n = length(x) - 1;   // data x_0 ... x_n (Scilab indices start at 1)\nm = ${c.m};            // polynomial degree\nk = ${c.k};            // ${kind === 'lagrange' ? 'uses x_k ... x_(k+m)' : `based at x_k (${dirName(c.dir)})`}\npx = poly(0, 'x');\n\n`,
  )
  if (kind === 'lagrange') {
    code += `z = x(k+1:k+m+1); fz = y(k+1:k+m+1);   // ${L('nodos usados', 'nodes used')}\nP = 0; pb = 0;\nfor i = 1:m+1\n  L = 1;   // ${L('polinomio de Lagrange L_i(x)', 'Lagrange polynomial L_i(x)')}\n  Lb = 1;  // ${L('su valor en xb', 'its value at xb')}\n  for j = 1:m+1\n    if j <> i then\n      L = L * (px - z(j)) / (z(i) - z(j));\n      Lb = Lb * (xb - z(j)) / (z(i) - z(j));\n    end\n  end\n  mprintf('L_%d(%g) = %.10f\\n', k+i-1, xb, Lb);\n  P = P + fz(i) * L;\n  pb = pb + fz(i) * Lb;\nend\nmprintf('P(%g) = %.12f\\n', xb, pb);\nmprintf('P(x) =\\n'); disp(P);\n`
  } else if (kind === 'diferencias-divididas') {
    code += `// ${L('Tabla de diferencias divididas', 'Divided-difference table')}: D(i+1, j+1) = f[x_i, ..., x_(i+j)]\nD = zeros(n+1, n+1);\nD(:, 1) = y(:);\nfor j = 1:n\n  for i = 0:n-j\n    D(i+1, j+1) = (D(i+2, j) - D(i+1, j)) / (x(i+j+1) - x(i+1));\n  end\nend\nmprintf('${L('Tabla de diferencias divididas', 'Divided-difference table')}:\\n'); disp(D);\n\n`
    code += fw
      ? `// ${L('Avance: a_j = f[x_k, ..., x_(k+j)], nodos', 'Forward: a_j = f[x_k, ..., x_(k+j)], nodes')} z = x_k, x_(k+1), ...\na = zeros(1, m+1); z = zeros(1, m+1);\nfor j = 0:m\n  a(j+1) = D(k+1, j+1);\n  z(j+1) = x(k+j+1);\nend\n`
      : `// ${L('Retroceso: a_j = f[x_(k-j), ..., x_k], nodos', 'Backward: a_j = f[x_(k-j), ..., x_k], nodes')} z = x_k, x_(k-1), ...\na = zeros(1, m+1); z = zeros(1, m+1);\nfor j = 0:m\n  a(j+1) = D(k-j+1, j+1);\n  z(j+1) = x(k-j+1);\nend\n`
    code += `mprintf('${L('Coeficientes', 'Coefficients')}:\\n'); disp(a);\n\n// ${L('Forma anidada', 'Nested form')}: a_0 + (x - z_0)[a_1 + (x - z_1)[ ... ]]\np = a(m+1); P = a(m+1);\nfor j = m:-1:1\n  p = a(j) + (xb - z(j)) * p;\n  P = a(j) + (px - z(j)) * P;\nend\nmprintf('P_%d(%g) = %.12f\\n', m, xb, p);\nmprintf('P(x) =\\n'); disp(P);\n`
  } else {
    code += `h = x(2) - x(1);\n// ${L('Tabla de diferencias finitas', 'Finite-difference table')}: D(i+1, j+1) = Delta^j f(x_i)\nD = zeros(n+1, n+1);\nD(:, 1) = y(:);\nfor j = 1:n\n  for i = 0:n-j\n    D(i+1, j+1) = D(i+2, j) - D(i+1, j);\n  end\nend\nmprintf('${L('Tabla de diferencias finitas', 'Finite-difference table')}:\\n'); disp(D);\n\n`
    code += fw
      ? `// ${L('Avance', 'Forward')}: P(s) = sum C(s, j) Delta^j f(x_k), C(s, j) = s(s-1)...(s-j+1)/j!\ns = (xb - x(k+1)) / h;\nsp = (px - x(k+1)) / h;   // ${L('s como polinomio en x', 's as a polynomial in x')}\np = D(k+1, 1); P = D(k+1, 1); c = 1; cp = 1;\nfor j = 1:m\n  c = c * (s - j + 1) / j;\n  cp = cp * (sp - j + 1) / j;\n  p = p + c * D(k+1, j+1);\n  P = P + cp * D(k+1, j+1);\nend\n`
      : `// ${L('Retroceso', 'Backward')}: P(s) = sum s(s+1)...(s+j-1)/j! nabla^j f(x_k), ${L('con', 'with')} nabla^j f(x_k) = Delta^j f(x_(k-j))\ns = (xb - x(k+1)) / h;\nsp = (px - x(k+1)) / h;   // ${L('s como polinomio en x', 's as a polynomial in x')}\np = D(k+1, 1); P = D(k+1, 1); c = 1; cp = 1;\nfor j = 1:m\n  c = c * (s + j - 1) / j;\n  cp = cp * (sp + j - 1) / j;\n  p = p + c * D(k-j+1, j+1);\n  P = P + cp * D(k-j+1, j+1);\nend\n`
    code += `mprintf('s = %.10f\\n', s);\nmprintf('P_%d(%g) = %.12f\\n', m, xb, p);\nmprintf('P(x) =\\n'); disp(P);\n`
  }
  if (f) code += `mprintf('f(%g) = %.12f   error = %.3e\\n', xb, f(xb), f(xb) - horner(P, xb));\n`
  code += `\n// ${L('Grafica', 'Plot')}\nxx = linspace(min([x, xb]), max([x, xb]), 400);\nclf();\nplot(xx, horner(P, xx), 'b-');\n`
  if (f) code += `plot(xx, f(xx), 'g--');\n`
  code += `plot(x, y, 'ro');\nplot(xb, horner(P, xb), 'k*');\nxgrid();\nlegend(${f ? `['P(x)', 'f(x)', '${L('datos', 'data')}', 'P(xb)']` : `['P(x)', '${L('datos', 'data')}', 'P(xb)']`});\ntitle('${TITLES[kind].replace(/[():]/g, '')}');\n`
  return code
}
