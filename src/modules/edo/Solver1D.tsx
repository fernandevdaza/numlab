import { useMemo } from 'react'
import type { MathNode } from 'mathjs'
import { compile, compileDerivative, derivative, evalNumber, toScilab, type Compiled } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, CheckField, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs, type Column } from '../../components/ui'
import * as A from './algorithms'
import { compileOde, derivTex, sciOf, substTex, texOf, tn, tp, totalDerivatives, xToT } from './sym'
import { butcherTex, MeshFields, multiSteps, OdeField, range, rkSteps, sampleT, sciRkBody, sciSysBody, slopeField, type MeshState, type Step } from './shared'
import { DESCRIPTIONS, THEORY, TITLES, TOPIC, type OdeKind } from './theory'

export type RkVariant = 'heun' | 'punto-medio' | 'ralston' | 'rk3' | 'rk4' | 'rk38' | 'rkf45'
/** Punto medio: 'dos-pasos' = método del texto (6.1.1.2); 'rk2' = RK2 del punto medio (Burden). */
export type PmVariant = 'dos-pasos' | 'rk2'

export interface State extends MeshState {
  f: string
  y0: string
  exact: string
  rk: RkVariant
  order: number
  solver: A.ImplicitSolver
  pm: PmVariant
  amStart: A.AmStart
  tol: string
  hmin: string
  hmax: string
  field: boolean
}

const BASE: State = {
  f: 'y - t^2 + 1', y0: '0.5', t0: '0', tf: '2', mode: 'h', h: '0.2', N: 10, exact: '(t + 1)^2 - 0.5*exp(t)',
  rk: 'rk4', order: 2, solver: 'newton', pm: 'dos-pasos', amStart: 'rk4', tol: '1e-5', hmin: '0.01', hmax: '0.25', field: true,
}

/** Problema de los Ej. 6.1–6.7 del texto: y' = x − y, y(0) = 2, h = 0.1 (aquí x → t). */
const LIBRO: Partial<State> = { f: 't - y', y0: '2', t0: '0', tf: '0.3', mode: 'h', h: '0.1', exact: '3exp(-t) + t - 1' }
/** Práctica del cap. 6. */
const P1: Partial<State> = { f: 'ln(t) + t^2', y0: '3', t0: '1', tf: '1.3', mode: 'h', h: '0.1', exact: 't*ln(t) - t + t^3/3 + 11/3' }
const P2: Partial<State> = { f: '-2t*y + 2t', y0: '0', t0: '0', tf: '0.3', mode: 'h', h: '0.1', exact: '1 - exp(-t^2)' }
const P3: Partial<State> = { f: 'y + 2cos(t)', y0: '1', t0: '0', tf: '0.5', mode: 'h', h: '0.1', exact: '2exp(t) + sin(t) - cos(t)' }

/** Ejemplos resueltos del texto, por página. */
const BOOK_EXAMPLES: Record<OdeKind, { label: string; value: Partial<State> }[]> = {
  euler: [
    { label: 'Ej. 6.1', value: LIBRO },
    { label: 'Práctica 1', value: P1 },
  ],
  'punto-medio': [
    { label: 'Ej. 6.2', value: { ...LIBRO, pm: 'dos-pasos' } },
    { label: 'Práctica 1', value: { ...P1, pm: 'dos-pasos' } },
  ],
  heun: [
    { label: 'Ej. 6.3', value: LIBRO },
    { label: 'Práctica 2', value: P2 },
  ],
  trapecio: [{ label: 'Datos del Ej. 6.3', value: LIBRO }],
  'adams-moulton': [
    { label: 'Ej. 6.4 (arranque: trapecio)', value: { ...LIBRO, tf: '0.4', amStart: 'heun' } },
    { label: 'Práctica 3 (arranque: RK4)', value: { ...P3, amStart: 'rk4' } },
  ],
  taylor: [
    { label: 'Ej. 6.5', value: { ...LIBRO, order: 2 } },
    { label: 'Práctica 2', value: { ...P2, order: 2 } },
  ],
  'runge-kutta': [
    { label: 'Ej. 6.6 (RK2)', value: { ...LIBRO, tf: '0.2', rk: 'ralston' } },
    { label: 'Ej. 6.7 (RK4)', value: { ...LIBRO, tf: '0.2', rk: 'rk4' } },
    { label: 'Práctica 3 (RK4)', value: { ...P3, rk: 'rk4' } },
    { label: 'Práctica 6 · circuito RC (RK2)', value: { f: '(12cos(100t) - y/5e-4)/200', y0: '0', t0: '0', tf: '0.1', mode: 'h', h: '0.05', rk: 'ralston', exact: '' } },
  ],
}

export const ODE_EXAMPLES: { label: string; value: Partial<State> }[] = [
  { label: 'Burden: y′ = y − t² + 1', value: { f: 'y - t^2 + 1', y0: '0.5', t0: '0', tf: '2', mode: 'h', h: '0.2', exact: '(t + 1)^2 - 0.5*exp(t)' } },
  { label: 'y′ = t·e³ᵗ − 2y', value: { f: 't*exp(3t) - 2y', y0: '0', t0: '0', tf: '1', mode: 'h', h: '0.1', exact: 't*exp(3t)/5 - exp(3t)/25 + exp(-2t)/25' } },
  { label: 'Gilat: y′ = −1.2y + 7e^(−0.3t)', value: { f: '-1.2y + 7exp(-0.3t)', y0: '3', t0: '0', tf: '2.5', mode: 'h', h: '0.5', exact: '70/9*exp(-0.3t) - 43/9*exp(-1.2t)' } },
  { label: 'Chapra: polinomio', value: { f: '-2t^3 + 12t^2 - 20t + 8.5', y0: '1', t0: '0', tf: '4', mode: 'h', h: '0.5', exact: '-0.5t^4 + 4t^3 - 10t^2 + 8.5t + 1' } },
  { label: 'Logística', value: { f: '0.8y*(1 - y/10)', y0: '1', t0: '0', tf: '10', mode: 'h', h: '0.5', exact: '10/(1 + 9exp(-0.8t))' } },
  { label: 'Enfriamiento de Newton', value: { f: '-0.1*(y - 20)', y0: '90', t0: '0', tf: '30', mode: 'h', h: '2', exact: '20 + 70exp(-0.1t)' } },
  { label: 'Rígida: y′ = −20y, h = 0.12', value: { f: '-20y', y0: '1', t0: '0', tf: '1.2', mode: 'h', h: '0.12', exact: 'exp(-20t)' } },
  { label: 'Explota: y′ = y² (t → 1)', value: { f: 'y^2', y0: '1', t0: '0', tf: '1.5', mode: 'h', h: '0.05', exact: '1/(1 - t)' } },
]

const DEFAULTS: Record<OdeKind, Partial<State>> = {
  euler: {},
  'punto-medio': {},
  heun: {},
  trapecio: {},
  'adams-moulton': { amStart: 'rk4' },
  taylor: { order: 2 },
  'runge-kutta': { rk: 'rk4' },
}

const RK_OPTS: { value: RkVariant; label: string }[] = [
  { value: 'ralston', label: 'RK2 del texto (γ₂ = ¾, Ralston)' },
  { value: 'rk4', label: 'RK4 clásico (texto)' },
  { value: 'heun', label: 'RK2 · trapecio / Euler modificado (γ₂ = ½)' },
  { value: 'punto-medio', label: 'RK2 · punto medio (γ₂ = 1)' },
  { value: 'rk3', label: 'RK3 · Kutta' },
  { value: 'rk38', label: 'RK4 · regla 3/8' },
  { value: 'rkf45', label: 'RKF45 · adaptativo (Fehlberg)' },
]

const ORDER: Record<OdeKind, string> = {
  euler: 'orden 1: error local O(h²), global O(h)',
  'punto-medio': 'orden 2: error local O(h³), global O(h²)',
  heun: 'orden 2: error local O(h³), global O(h²)',
  trapecio: 'orden 2, A-estable',
  'adams-moulton': 'orden 4: error local O(h⁵), global O(h⁴)',
  taylor: '',
  'runge-kutta': '',
}

export function Solver1D({ kind }: { kind: OdeKind }) {
  const [raw, setS] = useLocalState<State>('edo:' + kind, { ...BASE, ...DEFAULTS[kind] })
  // estados guardados por versiones anteriores pueden no tener los campos nuevos
  const s: State = useMemo(() => ({ ...BASE, ...DEFAULTS[kind], ...raw }), [raw, kind])
  const set = (p: Partial<State>) => setS((prev) => ({ ...BASE, ...DEFAULTS[kind], ...prev, ...p }))
  const d = useDebounced(s, 250)
  const calc = useMemo(() => compute(kind, d), [kind, d])
  const adaptive = kind === 'runge-kutta' && s.rk === 'rkf45'

  const inputs = (
    <>
      <OdeField label="Ecuación y′ = f(t, y)" value={s.f} onChange={(f) => set({ f })} vars={['t', 'x', 'y']} texPrefix="y' =" hint="Variables t e y (puedes escribir x en lugar de t, como en el texto). Usa ^, sqrt, exp, ln, sin…" />
      <NumField label={<>Condición inicial <Tex>{'y(t_0) = y_0'}</Tex></>} value={s.y0} onChange={(y0) => set({ y0 })} />
      {adaptive ? (
        <>
          <FieldRow>
            <NumField label={<Tex>t_0</Tex>} value={s.t0} onChange={(t0) => set({ t0 })} />
            <NumField label={<Tex>t_f</Tex>} value={s.tf} onChange={(tf) => set({ tf })} />
          </FieldRow>
          <FieldRow>
            <NumField label="TOL" value={s.tol} onChange={(tol) => set({ tol })} />
            <NumField label={<Tex>{'h_{min}'}</Tex>} value={s.hmin} onChange={(hmin) => set({ hmin })} />
            <NumField label={<Tex>{'h_{max}'}</Tex>} value={s.hmax} onChange={(hmax) => set({ hmax })} />
          </FieldRow>
        </>
      ) : (
        <MeshFields s={s} set={set} />
      )}
      {kind === 'punto-medio' && (
        <SelectField
          label="Variante"
          value={s.pm}
          onChange={(pm) => set({ pm })}
          options={[
            { value: 'dos-pasos', label: 'Texto: 2 pasos, y₍ₙ₊₁₎ = y₍ₙ₋₁₎ + 2h f(xₙ, yₙ)' },
            { value: 'rk2', label: 'Burden: RK2 del punto medio (1 paso)' },
          ]}
        />
      )}
      {kind === 'adams-moulton' && (
        <SelectField
          label="Arranque (y₁, y₂, y₃)"
          value={s.amStart}
          onChange={(amStart) => set({ amStart })}
          options={[
            { value: 'rk4', label: 'Runge-Kutta de orden 4 (recomendado)' },
            { value: 'heun', label: 'Trapecio o Euler modificado (Ej. 6.4)' },
          ]}
        />
      )}
      {kind === 'runge-kutta' && <SelectField label="Variante" value={s.rk} onChange={(rk) => set({ rk })} options={RK_OPTS} />}
      {kind === 'taylor' && <IntField label="Orden del método de Taylor (1–4)" value={s.order} onChange={(order) => set({ order })} min={1} max={4} hint="Orden 1 = Euler. Las derivadas se calculan simbólicamente." />}
      {kind === 'trapecio' && (
        <SelectField
          label="Resolver la ecuación implícita con"
          value={s.solver}
          onChange={(solver) => set({ solver })}
          options={[
            { value: 'newton', label: 'Newton (usa f_y simbólica)' },
            { value: 'punto-fijo', label: 'Iteración de punto fijo' },
          ]}
        />
      )}
      <ExprField label="Solución exacta y(t) (opcional)" value={s.exact} onChange={(exact) => set({ exact })} vars={['t', 'x']} texPrefix="y(t) =" hint="Para calcular el error global en cada paso" />
      <CheckField label="Mostrar campo de direcciones" value={s.field} onChange={(field) => set({ field })} />
      <Examples items={[...BOOK_EXAMPLES[kind], ...ODE_EXAMPLES]} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES[kind]} topic={TOPIC} description={DESCRIPTIONS[kind]} theory={THEORY[kind]} inputs={inputs}>
      {calc.error ? <Alert kind="error">{calc.error}</Alert> : calc.res && <Results kind={kind} s={d} c={calc as Required<Calc>} />}
    </MethodPage>
  )
}

/* ───────────────────────── Cálculo ───────────────────────── */

export interface Calc {
  error?: string
  warn: string[]
  res?: A.OdeResult
  f?: Compiled
  exact: Compiled | null
  tab?: A.Tableau | null
  h?: number
  N?: number
  derivs?: MathNode[] | null
  fy?: Compiled | null
  solver?: A.ImplicitSolver
  adaptive?: boolean
  tol?: number
  /** punto medio de 2 pasos del texto */
  pm2?: boolean
  /** Adams-Moulton */
  am?: boolean
}

function tableauFor(kind: OdeKind, rk: RkVariant, pm: PmVariant): A.Tableau | null {
  if (kind === 'euler') return A.TABLEAUS.euler
  if (kind === 'punto-medio') return pm === 'rk2' ? A.TABLEAUS['punto-medio'] : null
  if (kind === 'heun') return A.TABLEAUS.heun
  if (kind === 'runge-kutta' && rk !== 'rkf45') return A.TABLEAUS[rk]
  return null
}

export function compute(kind: OdeKind, s: State): Calc {
  const f = compileOde(xToT(s.f), ['t', 'y'])
  if (!f.ok) return { error: 'f(t, y): ' + f.error, warn: [], exact: null }
  const t0 = evalNumber(s.t0), tf = evalNumber(s.tf), y0 = evalNumber(s.y0)
  if (!Number.isFinite(y0)) return { error: 'La condición inicial y₀ no es un número válido.', warn: [], exact: null }
  const warn: string[] = []
  let exact: Compiled | null = null
  if (s.exact.trim()) {
    const e = compile(xToT(s.exact), ['t'])
    if (e.ok) exact = e
    else warn.push('Solución exacta ignorada: ' + e.error)
  }
  if (exact) {
    const e0 = exact.f(t0)
    if (Number.isFinite(e0) && Math.abs(e0 - y0) > 1e-6 * Math.max(1, Math.abs(y0))) warn.push(`La solución exacta no cumple la condición inicial: y(t₀) = ${fmt(e0)} ≠ y₀ = ${fmt(y0)}.`)
  }
  const F: A.OdeFn = (t, y) => [f.f(t, y[0])]
  if (kind === 'runge-kutta' && s.rk === 'rkf45') {
    const tol = evalNumber(s.tol), hmin = evalNumber(s.hmin), hmax = evalNumber(s.hmax)
    if (!Number.isFinite(t0) || !Number.isFinite(tf) || t0 === tf) return { error: 'Intervalo [t₀, t_f] inválido.', warn, exact }
    if (!(tol > 0)) return { error: 'TOL debe ser positiva.', warn, exact }
    if (!(hmin > 0) || !(hmax > 0) || hmin > hmax) return { error: 'Se requiere 0 < h_min ≤ h_max.', warn, exact }
    const res = A.rkf45(F, t0, [y0], tf, tol, hmin, hmax)
    return { res, f, exact, warn, adaptive: true, h: hmax, N: res.t.length - 1, tab: null, tol }
  }
  const m = A.mesh(t0, tf, s.mode, evalNumber(s.h), s.N)
  if (m.error) return { error: m.error, warn, exact }
  if (m.warn) warn.push(m.warn)
  const { h, N } = m
  if (kind === 'trapecio') {
    const fy = compileDerivative(f, 'y')
    let solver = s.solver
    if (!fy.ok && solver === 'newton') {
      warn.push('No se pudo derivar f respecto de y; se usa iteración de punto fijo.')
      solver = 'punto-fijo'
    }
    const res = A.trapecio(f.f, fy.ok ? fy.f : null, t0, y0, h, N, solver)
    return { res, f, exact, warn, h, N, fy: fy.ok ? fy : null, solver, tab: null }
  }
  if (kind === 'taylor') {
    const p = Math.max(1, Math.min(4, Math.round(s.order)))
    let derivs: MathNode[]
    try {
      derivs = totalDerivatives(f.node, p)
    } catch (e: any) {
      return { error: 'No se pudieron calcular las derivadas de f: ' + (e?.message ?? e), warn, exact }
    }
    const cs = derivs.map((n) => compile(n.toString(), ['t', 'y']))
    const bad = cs.find((c) => !c.ok)
    if (bad && !bad.ok) return { error: 'Derivada no compilable: ' + bad.error, warn, exact }
    const res = A.taylorSolve(cs.map((c) => (c as Compiled).f), t0, y0, h, N)
    return { res, f, exact, warn, h, N, derivs, tab: null }
  }
  if (kind === 'punto-medio' && s.pm !== 'rk2') {
    const res = A.puntoMedio2(F, t0, [y0], h, N)
    return { res, f, exact, warn, h, N, tab: null, pm2: true }
  }
  if (kind === 'adams-moulton') {
    const res = A.adamsMoulton(F, t0, [y0], h, N, s.amStart === 'heun' ? 'heun' : 'rk4')
    return { res, f, exact, warn, h, N, tab: null, am: true }
  }
  const tab = tableauFor(kind, s.rk, s.pm)!
  const res = A.rkSolve(F, tab, t0, [y0], h, N)
  return { res, f, exact, warn, h, N, tab }
}

/* ───────────────────────── Resultados ───────────────────────── */

function methodOrder(kind: OdeKind, s: State, c: Calc): string {
  if (kind === 'taylor') return `orden ${s.order}: error global O(h${['', '', '²', '³', '⁴'][s.order] ?? ''})`
  if (kind === 'runge-kutta') return c.adaptive ? 'paso adaptativo, orden 4(5)' : `orden ${c.tab?.order}: error global O(h${['', '', '²', '³', '⁴'][c.tab?.order ?? 0]})`
  if (kind === 'adams-moulton' && s.amStart === 'heun') return 'orden 4, pero el arranque de orden 2 limita el error global'
  return ORDER[kind]
}

function Results({ kind, s, c }: { kind: OdeKind; s: State; c: Required<Calc> }) {
  const { res, f, exact } = c
  const N = res.t.length - 1
  const tN = res.t[N], wN = res.w[N][0]
  const ex = useMemo(() => (exact ? res.t.map((t) => exact.f(t)) : null), [res, exact])
  const errs = useMemo(() => (ex ? ex.map((e, i) => Math.abs(e - res.w[i][0])) : null), [ex, res])
  const maxErr = errs ? Math.max(...errs.filter(Number.isFinite)) : NaN

  const mainPlot = useMemo(() => {
    const idx = A.thinIdx(res.t.length, 4000)
    const ts = idx.map((i) => res.t[i]), ws = idx.map((i) => res.w[i][0])
    const traces: Trace[] = []
    const t0 = res.t[0], t1 = res.t[N] === t0 ? t0 + 1 : res.t[N]
    const [lo, hi] = range([...ws, ...(ex ? idx.map((i) => ex[i]) : [])])
    if (s.field) traces.push(slopeField((t, y) => f.f(t, y), Math.min(t0, t1), Math.max(t0, t1), lo, hi))
    if (exact) traces.push({ ...sampleT((t) => exact.f(t), t0, t1), type: 'scatter', mode: 'lines', name: 'y(t) exacta', line: { color: SERIES[1], width: 2, dash: 'dash' } })
    traces.push({ x: ts, y: ws, type: 'scatter', mode: ts.length <= 120 ? 'lines+markers' : 'lines', name: 'wᵢ (aprox.)', line: { color: SERIES[0], width: 2.5 }, marker: { size: 6 } })
    return { traces, yr: [lo, hi] }
  }, [res, ex, s.field])

  const stepsTab = stepsFor(kind, s, c)
  const tabs = [
    { label: 'Gráfica', content: <Card><Plot data={mainPlot.traces} layout={{ xaxis: { title: { text: 't' } }, yaxis: { title: { text: 'y' }, range: mainPlot.yr } }} height={410} /></Card> },
  ]
  if (errs)
    tabs.push({
      label: 'Error',
      content: (
        <Card>
          <Plot
            data={[{ x: res.t, y: errs.map((e) => (e > 0 ? e : null)), type: 'scatter', mode: N <= 200 ? 'lines+markers' : 'lines', name: '|y(tᵢ) − wᵢ|', line: { color: SERIES[6] }, marker: { size: 5 } }]}
            layout={{ xaxis: { title: { text: 't' } }, yaxis: { type: 'log', exponentformat: 'power', title: { text: 'error global (escala log)' } } }}
          />
          <p className="muted edo-note">El error global se acumula paso a paso. Reduce h a la mitad y observa cuánto baja: ≈ ½ para orden 1, ≈ ¼ para orden 2, ≈ 1/16 para orden 4.</p>
        </Card>
      ),
    })
  if (c.adaptive)
    tabs.push({
      label: 'Tamaño de paso',
      content: (
        <Card>
          <Plot data={[{ x: res.t.slice(1), y: res.extra!.slice(1).map((e) => Math.abs(e!.h)), type: 'scatter', mode: 'lines+markers', line: { shape: 'hv', color: SERIES[2] }, name: 'hᵢ' }]} layout={{ xaxis: { title: { text: 't' } }, yaxis: { title: { text: 'h aceptado' } } }} />
          <p className="muted edo-note">RKF45 agranda el paso donde la solución es suave y lo reduce donde cambia rápido, manteniendo el error local por unidad de paso por debajo de TOL.</p>
        </Card>
      ),
    })
  tabs.push({ label: 'Paso a paso', content: <Card><Steps steps={stepsTab} /></Card> })

  const rows = useMemo(
    () =>
      A.thinIdx(res.t.length, 1001).map((i) => {
        const r: Record<string, number> = { i, t: res.t[i], w: res.w[i][0] }
        if (c.adaptive) {
          const e = res.extra?.[i]
          if (e) {
            r.h = e.h
            r.R = e.R
          }
        } else {
          const ks = res.k[i + 1]
          if (ks) ks.forEach((k, j) => (r['k' + j] = k[0]))
          const e = res.extra?.[i + 1]
          if (e && kind === 'trapecio') {
            r.pred = e.pred
            r.iters = e.iters
          }
          if (ks && c.tab?.id === 'heun') r.pred = res.w[i][0] + c.h * ks[0][0]
          if (e && c.am && e.am) {
            r.pred = e.pred
            r.fp = ks![4][0]
          }
        }
        if (ex) {
          r.ex = ex[i]
          r.err = errs![i]
        }
        return r
      }),
    [res, ex, errs],
  )

  return (
    <>
      <Stats
        items={[
          { label: <>w_N ≈ y(t_f)</>, value: fmt(wN, 12), hint: `t_N = ${fmt(tN, 8)}`, accent: true },
          { label: c.adaptive ? 'Pasos aceptados' : 'Pasos N', value: N, hint: c.adaptive ? `h ∈ [${fmt(Math.min(...res.extra!.slice(1).map((e) => Math.abs(e!.h))), 4)}, ${fmt(Math.max(...res.extra!.slice(1).map((e) => Math.abs(e!.h))), 4)}]` : `h = ${fmt(c.h, 10)}` },
          ...(errs ? [{ label: 'Error global final', value: fmtErr(errs[N]), hint: `máximo en la malla: ${fmtErr(maxErr)}` }] : []),
          { label: 'Evaluaciones de f', value: res.nevals, hint: methodOrder(kind, s, c) },
        ]}
      />
      {c.warn.map((w, i) => (
        <Alert key={i} kind="warn">
          {w}
        </Alert>
      ))}
      <Alert kind={res.ok ? 'ok' : res.t.length > 1 && res.w.every((w) => Number.isFinite(w[0])) ? 'warn' : 'error'}>{res.message}</Alert>
      <Tabs tabs={tabs} />
      <Card title="Tabla de resultados">
        {res.t.length > 1001 && <p className="muted edo-note">Se muestran 1001 de {res.t.length} filas (muestreo uniforme).</p>}
        <DataTable columns={columnsFor(kind, s, c)} rows={rows} filename={'edo_' + kind} />
        {!c.adaptive && <p className="muted edo-note">En la fila i se muestran los valores calculados en (tᵢ, wᵢ) para avanzar a wᵢ₊₁.</p>}
      </Card>
      <ScilabCode code={scilabFor(kind, s, c)} filename={'edo_' + kind.replace('-', '_')} />
    </>
  )
}

function columnsFor(kind: OdeKind, s: State, c: Calc): Column<any>[] {
  const cols: Column<any>[] = [
    { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
    { key: 't', tex: 't_i' },
    { key: 'w', tex: 'w_i' },
  ]
  if (c.adaptive) cols.push({ key: 'h', tex: 'h_i' }, { key: 'R', tex: 'R_i', fmt: 'err' })
  else if (kind === 'euler' || c.pm2) cols.push({ key: 'k0', tex: 'f(t_i, w_i)' })
  else if (c.tab?.id === 'heun') cols.push({ key: 'k0', tex: 'f(t_i, w_i)' }, { key: 'pred', tex: '\\tilde w_{i+1}\\;\\text{(predictor)}' }, { key: 'k1', tex: 'f(t_{i+1}, \\tilde w_{i+1})' })
  else if (c.am) cols.push({ key: 'k0', tex: 'f_i = f(t_i, w_i)' }, { key: 'pred', tex: '\\tilde w_{i+1}\\;\\text{(A-B)}' }, { key: 'fp', tex: 'f(t_{i+1}, \\tilde w_{i+1})' })
  else if (kind === 'trapecio') cols.push({ key: 'k0', tex: 'f(t_i, w_i)' }, { key: 'pred', tex: 'w^{(0)}_{i+1}' }, { key: 'iters', tex: '\\text{iter.}', fmt: 'int', align: 'center' })
  else if (kind === 'taylor') for (let j = 0; j < s.order; j++) cols.push({ key: 'k' + j, tex: derivTex('y', j + 1) + '_i' })
  else if (c.tab) c.tab.b.forEach((_, j) => cols.push({ key: 'k' + j, tex: `k_{${j + 1}}` }))
  if (c.exact) cols.push({ key: 'ex', tex: 'y(t_i)' }, { key: 'err', tex: '|y(t_i) - w_i|', fmt: 'err' })
  return cols
}

/* ───────────────────────── Paso a paso ───────────────────────── */

export function stepsFor(kind: OdeKind, s: State, c: Required<Calc>): Step[] {
  const { res, f } = c
  const N = res.t.length - 1
  const fTex = texOf(f.node, { t: 't', y: 'y' })
  const out: Step[] = []
  const ex = c.exact ? [(t: number) => c.exact!.f(t)] : null
  out.push({ text: 'Problema de valor inicial:', tex: `y' = ${fTex},\\qquad y(${tn(res.t[0])}) = ${tn(res.w[0][0])}` + (c.adaptive ? '' : `,\\qquad h = ${tn(c.h)},\\; N = ${N}`) })
  const exLine = (i: number): Step[] => {
    if (!c.exact) return []
    const e = c.exact.f(res.t[i])
    return [{ tex: `y(t_{${i}}) = ${tn(e)},\\qquad |y(t_{${i}}) - w_{${i}}| = ${tn(Math.abs(e - res.w[i][0]), 4)}` }]
  }
  const nShow = Math.min(2, N)

  if (c.tab) {
    const formulas: Record<string, string> = {
      euler: 'w_{i+1} = w_i + h\\,f(t_i, w_i)',
      'punto-medio': 'k_1 = f(t_i, w_i),\\quad k_2 = f(t_i + \\tfrac h2, w_i + \\tfrac h2 k_1),\\quad w_{i+1} = w_i + h\\,k_2',
      heun: '\\text{Predictor: } \\tilde w_{i+1} = w_i + h\\,f(t_i, w_i),\\qquad \\text{Corrector: } w_{i+1} = w_i + \\tfrac h2\\left[f(t_i, w_i) + f(t_{i+1}, \\tilde w_{i+1})\\right]',
      ralston: 'k_1 = f(t_i, w_i),\\quad k_2 = f(t_i + \\tfrac23 h, w_i + \\tfrac23 h k_1),\\quad w_{i+1} = w_i + \\tfrac h4(k_1 + 3k_2)\\qquad (k_j = V_j)',
      rk4: 'w_{i+1} = w_i + \\tfrac h6(k_1 + 2k_2 + 2k_3 + k_4),\\quad k_1 = f(t_i, w_i),\\; k_2 = f(t_i + \\tfrac h2, w_i + \\tfrac h2 k_1),\\; k_3 = f(t_i + \\tfrac h2, w_i + \\tfrac h2 k_2),\\; k_4 = f(t_i + h, w_i + h k_3)',
    }
    out.push({ text: `Fórmula (${c.tab.name}):`, tex: formulas[c.tab.id] ?? 'k_j = f\\big(t_i + c_j h,\\; w_i + h\\textstyle\\sum_{l<j} a_{jl}k_l\\big),\\qquad w_{i+1} = w_i + h\\sum_j b_j k_j' })
    if (!formulas[c.tab.id]) out.push({ text: 'Coeficientes (tabla de Butcher):', tex: butcherTex(c.tab) })
    for (let i = 0; i < nShow; i++) out.push(...rkSteps({ tab: c.tab, res, i, h: c.h, nodes: [f.node], vars: ['y'], exact: ex }))
  } else if (c.pm2) {
    out.push({ text: 'Punto medio del texto (método explícito de 2 pasos):', tex: 'w_1 = w_0 + h\\,f(t_0, w_0)\\;\\text{(Euler)},\\qquad w_{i+1} = w_{i-1} + 2h\\,f(t_i, w_i),\\; i \\ge 1' })
    for (let i = 0; i < Math.min(3, N); i++) out.push(...multiSteps({ method: 'pm2', res, i, h: c.h, nodes: [f.node], vars: ['y'], d2: null, exact: ex }))
  } else if (c.am) {
    const start = s.amStart === 'heun' ? 'el trapecio o Euler modificado' : 'Runge-Kutta de orden 4'
    out.push({ text: 'Adams-Moulton (predictor-corrector de 4 pasos), con f_i = f(t_i, w_i):', tex: '\\tilde w_{i+1} = w_i + \\tfrac{h}{24}\\left[55f_i - 59f_{i-1} + 37f_{i-2} - 9f_{i-3}\\right],\\qquad w_{i+1} = w_i + \\tfrac{h}{24}\\left[9f(t_{i+1}, \\tilde w_{i+1}) + 19f_i - 5f_{i-1} + f_{i-2}\\right]' })
    const nStart = Math.min(3, N)
    out.push({ text: `Arranque con ${start}: los valores iniciales necesarios son`, tex: Array.from({ length: nStart + 1 }, (_, i) => `w_{${i}} = ${tn(res.w[i][0], 10)},\\; f_{${i}} = ${tn(i < N ? res.k[i + 1]![0][0] : c.f.f(res.t[i], res.w[i][0]), 10)}`).join('\\\\') })
    for (let i = 3; i < Math.min(5, N); i++) {
      const ks = res.k[i + 1]!.map((k) => k[0])
      const [f0, f1, f2, f3, fp] = ks
      const pred = res.extra![i + 1]!.pred
      const h = c.h
      out.push({ text: <>Paso {i + 1}: <Tex>{`t_{${i}} = ${tn(res.t[i])} \\to t_{${i + 1}} = ${tn(res.t[i + 1])}`}</Tex></> })
      out.push({ text: 'Predicción (Adams-Bashforth):', tex: `\\tilde w_{${i + 1}} = ${tn(res.w[i][0], 10)} + \\frac{${tn(h)}}{24}\\left[55${tp(f0, 9)} - 59${tp(f1, 9)} + 37${tp(f2, 9)} - 9${tp(f3, 9)}\\right] = ${tn(pred, 10)}` })
      out.push({ tex: `f(t_{${i + 1}}, \\tilde w_{${i + 1}}) = ${substTex(f.node, { t: res.t[i + 1], y: pred })} = ${tn(fp, 10)}` })
      out.push({ text: 'Corrección (Adams-Moulton):', tex: `w_{${i + 1}} = ${tn(res.w[i][0], 10)} + \\frac{${tn(h)}}{24}\\left[9${tp(fp, 9)} + 19${tp(f0, 9)} - 5${tp(f1, 9)} + ${tp(f2, 9)}\\right] = ${tn(res.w[i + 1][0], 10)}` })
      out.push(...exLine(i + 1))
    }
  } else if (kind === 'trapecio') {
    const fyTex = c.fy ? texOf(c.fy.node, { t: 't', y: 'y' }) : ''
    out.push({ text: 'Fórmula implícita:', tex: 'w_{i+1} = w_i + \\frac h2\\left[f(t_i, w_i) + f(t_{i+1}, w_{i+1})\\right]' })
    if (c.solver === 'newton') out.push({ text: 'Se resuelve g(w) = 0 con Newton; derivada parcial calculada simbólicamente:', tex: `g(w) = w - w_i - \\tfrac h2\\left[f(t_i,w_i) + f(t_{i+1}, w)\\right],\\quad g'(w) = 1 - \\tfrac h2 f_y(t_{i+1}, w),\\quad f_y = ${fyTex}` })
    else out.push({ text: 'Se resuelve con iteración de punto fijo:', tex: 'w^{(m+1)} = w_i + \\tfrac h2\\left[f(t_i, w_i) + f(t_{i+1}, w^{(m)})\\right]' })
    for (let i = 0; i < nShow; i++) {
      const ti = res.t[i], wi = res.w[i][0], t1 = res.t[i + 1], h = c.h
      const fi = res.k[i + 1]![0][0]
      const hist = res.trace?.[i] ?? []
      out.push({ text: <>Paso {i + 1}: <Tex>{`t_{${i}} = ${tn(ti)},\\; w_{${i}} = ${tn(wi)},\\; t_{${i + 1}} = ${tn(t1)}`}</Tex></> })
      out.push({ tex: `f(t_{${i}}, w_{${i}}) = ${substTex(f.node, { t: ti, y: wi })} = ${tn(fi)}` })
      out.push({ text: 'Predictor de Euler (valor inicial de la iteración):', tex: `w^{(0)} = w_{${i}} + h f(t_{${i}}, w_{${i}}) = ${tn(wi)} + ${tn(h)}\\cdot${tp(fi)} = ${tn(hist[0] ?? NaN)}` })
      hist.slice(0, 4).forEach((x, m) => {
        const xn = hist[m + 1]
        if (xn === undefined) return
        const fx = f.f(t1, x)
        if (c.solver === 'newton' && c.fy) {
          const g = x - wi - (h / 2) * (fi + fx)
          const dg = 1 - (h / 2) * c.fy.f(t1, x)
          out.push({ tex: `w^{(${m + 1})} = w^{(${m})} - \\frac{g(w^{(${m})})}{g'(w^{(${m})})} = ${tn(x, 10)} - \\frac{${tn(g, 6)}}{${tn(dg, 8)}} = ${tn(xn, 10)}` })
        } else out.push({ tex: `w^{(${m + 1})} = ${tn(wi)} + \\frac{${tn(h)}}{2}\\left[${tn(fi)} + ${tp(fx, 10)}\\right] = ${tn(xn, 10)}` })
      })
      const it = res.extra?.[i + 1]?.iters ?? 0
      if (hist.length > 5) out.push({ text: `… ${it} iteraciones en total hasta |w^(m+1) − w^(m)| < 10⁻¹².` })
      out.push({ text: 'Valor aceptado:', tex: `w_{${i + 1}} = ${tn(res.w[i + 1][0], 10)}` })
      out.push(...exLine(i + 1))
    }
  } else if (kind === 'taylor' && c.derivs) {
    const p = c.derivs.length
    const ft = texOf(derivative(f.node, 't'), { t: 't', y: 'y' })
    const fy = texOf(derivative(f.node, 'y'), { t: 't', y: 'y' })
    out.push({ text: 'Derivadas totales a lo largo de la solución (calculadas simbólicamente):' })
    out.push({ tex: `y' = f(t,y) = ${fTex}` })
    if (p >= 2) out.push({ tex: `f_t = ${ft},\\qquad f_y = ${fy}` })
    c.derivs.slice(1).forEach((d, j) => out.push({ tex: `${derivTex('y', j + 2)} = ${j === 0 ? 'f_t + f_y\\,f = ' : `\\frac{\\partial ${derivTex('y', j + 1)}}{\\partial t} + \\frac{\\partial ${derivTex('y', j + 1)}}{\\partial y}f = `}${texOf(d, { t: 't', y: 'y' })}` }))
    const terms = Array.from({ length: p }, (_, j) => (j === 0 ? `h\\,y'_i` : `\\frac{h^{${j + 1}}}{${[1, 1, 2, 6, 24][j + 1]}}\\,${derivTex('y', j + 1)}_i`))
    out.push({ text: `Fórmula de Taylor de orden ${p}:`, tex: `w_{i+1} = w_i + ${terms.join(' + ')}` })
    for (let i = 0; i < nShow; i++) {
      const ti = res.t[i], wi = res.w[i][0], h = c.h
      const vals = res.k[i + 1]!.map((k) => k[0])
      out.push({ text: <>Paso {i + 1}: <Tex>{`t_{${i}} = ${tn(ti)},\\; w_{${i}} = ${tn(wi)}`}</Tex></> })
      c.derivs.forEach((d, j) => out.push({ tex: `${derivTex('y', j + 1)}_{${i}} = ${substTex(d, { t: ti, y: wi })} = ${tn(vals[j])}` }))
      const num = vals.map((v, j) => (j === 0 ? `${tn(h)}${tp(v) === tn(v) ? '\\cdot ' + tn(v) : tp(v)}` : `\\frac{${tn(h)}^{${j + 1}}}{${[1, 1, 2, 6, 24][j + 1]}}${v < 0 ? tp(v) : '\\cdot ' + tn(v)}`)).join(' + ')
      out.push({ tex: `w_{${i + 1}} = ${tn(wi)} + ${num} = ${tn(res.w[i + 1][0], 10)}` })
      out.push(...exLine(i + 1))
    }
  } else if (c.adaptive) {
    out.push({ text: 'Fehlberg: seis evaluaciones por intento (kⱼ = f(·) sin multiplicar por h).', tex: 'w_{i+1} = w_i + h\\left(\\tfrac{25}{216}k_1 + \\tfrac{1408}{2565}k_3 + \\tfrac{2197}{4104}k_4 - \\tfrac15 k_5\\right),\\quad \\tilde w_{i+1} = w_i + h\\left(\\tfrac{16}{135}k_1 + \\tfrac{6656}{12825}k_3 + \\tfrac{28561}{56430}k_4 - \\tfrac{9}{50}k_5 + \\tfrac{2}{55}k_6\\right)' })
    ;(res.log ?? []).slice(0, 3).forEach((a, n) => {
      out.push({ text: <>Intento {n + 1}: <Tex>{`t = ${tn(a.t)},\\; h = ${tn(a.h)}`}</Tex></> })
      out.push({ tex: a.k.map((k, j) => `k_{${j + 1}} = ${tn(k[0])}`).join(',\\; ') })
      out.push({ tex: `w = ${tn(a.w4[0], 10)},\\qquad \\tilde w = ${tn(a.w5[0], 10)}` })
      out.push({
        tex: `R = \\frac{|\\tilde w - w|}{h} = ${tn(a.R, 4)} ${a.accepted ? '\\le' : '>'} \\text{TOL} = ${tn(+c.tol.toPrecision(6), 6)} \\;\\Rightarrow\\; \\text{${a.accepted ? 'se acepta' : 'se rechaza'}},\\qquad \\delta = 0.84\\left(\\tfrac{\\text{TOL}}{R}\\right)^{1/4} = ${tn(a.delta, 4)}`,
      })
    })
    out.push({ text: 'El nuevo paso es h·δ, limitado a [0.1h, 4h] y a h_max.' })
  }
  const shown = c.am ? 5 : c.pm2 ? 3 : 2
  if (N > shown) out.push({ text: `… y así sucesivamente hasta t_${N} = ${fmt(res.t[N])} (ver tabla).` })
  return out
}

/* ───────────────────────── Scilab ───────────────────────── */

const sciNum = (src: string) => toScilab(src, false)

export function scilabFor(kind: OdeKind, s: State, c: Required<Calc>): string {
  const F = sciOf(c.f.node)
  const title = kind === 'runge-kutta' ? RK_OPTS.find((o) => o.value === s.rk)?.label ?? TITLES[kind] : TITLES[kind]
  let code = `// ${title} — generado por NumLab\n// PVI: y' = f(t, y),  y(t0) = y0\nclear; clc;\n\nfunction dy = f(t, y)\n  dy = ${F};\nendfunction\n`
  if (c.exact) code += `function y = yex(t)\n  y = ${toScilab(c.exact.node, true)};\nendfunction\n`
  const exCols = c.exact
  if (c.adaptive) {
    code += `\nt0 = ${sciNum(s.t0)}; tf = ${sciNum(s.tf)}; y0 = ${sciNum(s.y0)};\nTOL = ${s.tol}; hmin = ${s.hmin}; hmax = ${s.hmax};\n\nt = t0; w = y0; h = hmax;\nT = t; W = w; H = 0;\nmprintf('%12s %16s %12s %12s\\n', 't', 'w', 'h', 'R');\nwhile tf - t > 1e-12\n  h = min(h, tf - t);\n  k1 = h*f(t, w);\n  k2 = h*f(t + h/4, w + k1/4);\n  k3 = h*f(t + 3*h/8, w + 3*k1/32 + 9*k2/32);\n  k4 = h*f(t + 12*h/13, w + 1932*k1/2197 - 7200*k2/2197 + 7296*k3/2197);\n  k5 = h*f(t + h, w + 439*k1/216 - 8*k2 + 3680*k3/513 - 845*k4/4104);\n  k6 = h*f(t + h/2, w - 8*k1/27 + 2*k2 - 3544*k3/2565 + 1859*k4/4104 - 11*k5/40);\n  R = abs(k1/360 - 128*k3/4275 - 2197*k4/75240 + k5/50 + 2*k6/55)/h;\n  if R <= TOL then\n    t = t + h;\n    w = w + 25*k1/216 + 1408*k3/2565 + 2197*k4/4104 - k5/5;\n    T($+1) = t; W($+1) = w; H($+1) = h;\n    mprintf('%12.7f %16.10f %12.7f %12.3e\\n', t, w, h, R);\n  end\n  if R == 0 then\n    delta = 4;\n  else\n    delta = 0.84*(TOL/R)^(1/4);\n  end\n  if delta <= 0.1 then\n    h = 0.1*h;\n  elseif delta >= 4 then\n    h = 4*h;\n  else\n    h = delta*h;\n  end\n  h = min(h, hmax);\n  if h < hmin & tf - t > hmin then\n    error('h < hmin: no se alcanza la tolerancia');\n  end\nend\n`
    code += `\nscf(0); clf();\nplot(T, W, 'o-');\n`
    if (exCols) code += `tt = linspace(t0, tf, 400);\nplot(tt, yex(tt), 'r--');\nlegend('RKF45', 'exacta');\nmprintf('Error final: %e\\n', abs(yex(T($)) - W($)));\n`
    code += `xlabel('t'); ylabel('y');\n\n// Comparación con ode() de Scilab (método 'rkf' = Fehlberg 4(5)):\ny_ode = ode('rkf', y0, t0, T', f);\nmprintf('Max |w - ode| = %e\\n', max(abs(W' - y_ode)));\n`
    return code
  }
  if (kind === 'trapecio' && c.fy && c.solver === 'newton') code += `function v = fy(t, y)   // derivada parcial df/dy\n  v = ${sciOf(c.fy.node)};\nendfunction\n`
  if (kind === 'taylor' && c.derivs)
    c.derivs.slice(1).forEach((d, j) => (code += `function v = d${j + 2}(t, y)   // y^(${j + 2}) en función de (t, y)\n  v = ${sciOf(d)};\nendfunction\n`))
  code += `\nt0 = ${sciNum(s.t0)}; tf = ${sciNum(s.tf)}; y0 = ${sciNum(s.y0)};\nN = ${c.N}; h = (tf - t0)/N;\nt = t0 + (0:N)*h;\nw = zeros(1, N+1); w(1) = y0;\n\nfor i = 1:N\n`
  if (c.tab) code += (c.tab.id === 'heun' ? sciSysBody('heun', c.tab, false, 'f') : sciRkBody(c.tab, false)) + '\n'
  else if (c.pm2) code += sciSysBody('pm2', null, false, 'f') + '\n'
  else if (c.am) {
    const startBody =
      s.amStart === 'heun'
        ? `    fi = f(t(i), w(i));\n    p = w(i) + h*fi;                          // predictor (Euler)\n    w(i+1) = w(i) + h/2*(fi + f(t(i+1), p));  // corrector (trapecio)\n`
        : sciRkBody(A.TABLEAUS.rk4, false, 'f', '    ') + '\n'
    code += `  if i <= 3 then   // arranque: ${s.amStart === 'heun' ? 'trapecio o Euler modificado' : 'RK4'}\n${startBody}  else\n    f0 = f(t(i), w(i)); f1 = f(t(i-1), w(i-1)); f2 = f(t(i-2), w(i-2)); f3 = f(t(i-3), w(i-3));\n    p = w(i) + h/24*(55*f0 - 59*f1 + 37*f2 - 9*f3);            // predictor (Adams-Bashforth)\n    w(i+1) = w(i) + h/24*(9*f(t(i+1), p) + 19*f0 - 5*f1 + f2);  // corrector (Adams-Moulton)\n  end\n`
  } else if (kind === 'trapecio') {
    code += `  fi = f(t(i), w(i));\n  x = w(i) + h*fi;          // predictor de Euler\n  for m = 1:50\n`
    code +=
      c.solver === 'newton' && c.fy
        ? `    g  = x - w(i) - h/2*(fi + f(t(i+1), x));\n    dg = 1 - h/2*fy(t(i+1), x);\n    xn = x - g/dg;            // Newton\n`
        : `    xn = w(i) + h/2*(fi + f(t(i+1), x));   // punto fijo\n`
    code += `    if abs(xn - x) < 1e-12 then\n      x = xn; break;\n    end\n    x = xn;\n  end\n  w(i+1) = x;\n`
  } else if (kind === 'taylor' && c.derivs) {
    const fac = [1, 1, 2, 6, 24]
    const terms = c.derivs.map((_, j) => (j === 0 ? 'h*f(t(i), w(i))' : `h^${j + 1}/${fac[j + 1]}*d${j + 1}(t(i), w(i))`))
    code += `  w(i+1) = w(i) + ${terms.join(' + ')};\n`
  }
  code += `end\n\n`
  if (exCols) code += `err = abs(yex(t) - w);\nmprintf('%4s %12s %18s %18s %12s\\n', 'i', 't_i', 'w_i', 'y(t_i)', 'error');\nfor i = 1:N+1\n  mprintf('%4d %12.6f %18.10f %18.10f %12.3e\\n', i-1, t(i), w(i), yex(t(i)), err(i));\nend\n`
  else code += `mprintf('%4s %12s %18s\\n', 'i', 't_i', 'w_i');\nfor i = 1:N+1\n  mprintf('%4d %12.6f %18.10f\\n', i-1, t(i), w(i));\nend\n`
  code += `\nscf(0); clf();\nplot(t, w, 'o-');\n`
  if (exCols) code += `tt = linspace(t0, tf, 400);\nplot(tt, yex(tt), 'r--');\nlegend('aproximación', 'exacta');\n`
  code += `xlabel('t'); ylabel('y'); title('${title}');\n\n// Comparación con el integrador de Scilab:\ny_ode = ode(y0, t0, t, f);\nmprintf('Max |w - ode| = %e\\n', max(abs(w - y_ode)));\n`
  return code
}
