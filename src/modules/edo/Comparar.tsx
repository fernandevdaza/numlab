import { useMemo } from 'react'
import { compile, compileDerivative, evalNumber, toScilab, type Compiled } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, Stats, type Column } from '../../components/ui'
import * as A from './algorithms'
import { compileOde, sciOf, totalDerivatives, xToT } from './sym'
import { OdeField, sampleT } from './shared'
import { ODE_EXAMPLES } from './Solver1D'
import { DESCRIPTIONS, THEORY, TITLES, TOPIC } from './theory'
import { L } from '../../i18n'

interface State {
  f: string
  y0: string
  t0: string
  tf: string
  exact: string
  N0: number
  K: number
}

interface Method {
  id: string
  name: string
  p: number
  /** evaluaciones de f por paso (aprox. para el implícito) */
  cost: string
  run: (N: number) => A.OdeResult
}

export function Comparar() {
  const [s, setS] = useLocalState<State>('edo:comparar-edo', { f: 'y - t^2 + 1', y0: '0.5', t0: '0', tf: '2', exact: '(t + 1)^2 - 0.5*exp(t)', N0: 10, K: 5 })
  const set = (p: Partial<State>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 300)
  const out = useMemo(() => compute(d), [d])

  const inputs = (
    <>
      <OdeField
        label={L('Ecuación y′ = f(t, y)', 'Equation y′ = f(t, y)')}
        value={s.f}
        onChange={(f) => set({ f })}
        vars={['t', 'x', 'y']}
        texPrefix="y' ="
        hint={L('Puedes escribir x en lugar de t, como en el texto.', 'You may type x instead of t, as in the textbook.')}
      />
      <NumField label={<>{L('Condición inicial', 'Initial condition')} <Tex>{'y(t_0)'}</Tex></>} value={s.y0} onChange={(y0) => set({ y0 })} />
      <FieldRow>
        <NumField label={<Tex>t_0</Tex>} value={s.t0} onChange={(t0) => set({ t0 })} />
        <NumField label={<Tex>t_f</Tex>} value={s.tf} onChange={(tf) => set({ tf })} />
      </FieldRow>
      <FieldRow>
        <IntField label={L('N inicial', 'Initial N')} value={s.N0} onChange={(N0) => set({ N0 })} min={1} max={2000} />
        <IntField label={L('Refinamientos (h/2)', 'Refinements (h/2)')} value={s.K} onChange={(K) => set({ K })} min={1} max={8} />
      </FieldRow>
      <ExprField
        label={L('Solución exacta y(t) (opcional)', 'Exact solution y(t) (optional)')}
        value={s.exact}
        onChange={(exact) => set({ exact })}
        vars={['t', 'x']}
        texPrefix="y(t) ="
        hint={L('Si se deja vacía se usa como referencia RK4 con un paso mucho menor', 'If left empty, RK4 with a much smaller step is used as the reference')}
      />
      <Examples items={[{ label: L('Ej. 6.1–6.7: y′ = x − y', 'Ex. 6.1–6.7: y′ = x − y'), value: { f: 't - y', y0: '2', t0: '0', tf: '1', exact: '3exp(-t) + t - 1' } }, ...ODE_EXAMPLES.map((e) => ({ label: e.label, value: { f: e.value.f!, y0: e.value.y0!, t0: e.value.t0!, tf: e.value.tf!, exact: e.value.exact ?? '' } }))]} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES['comparar-edo']} topic={TOPIC} description={DESCRIPTIONS['comparar-edo']} theory={THEORY['comparar-edo']} inputs={inputs}>
      {'error' in out ? <Alert kind="error">{out.error}</Alert> : <Results s={d} o={out} />}
    </MethodPage>
  )
}

interface Out {
  methods: Method[]
  Ns: number[]
  hs: number[]
  /** errors[m][j] */
  errors: number[][]
  base: A.OdeResult[]
  yf: number
  refNote: string
  exact: Compiled | null
  f: Compiled
  t0: number
  tf: number
  y0: number
  warn: string[]
}

export function compute(s: State): { error: string } | Out {
  const f = compileOde(xToT(s.f), ['t', 'y'])
  if (!f.ok) return { error: 'f(t, y): ' + f.error }
  const t0 = evalNumber(s.t0), tf = evalNumber(s.tf), y0 = evalNumber(s.y0)
  if (!Number.isFinite(t0) || !Number.isFinite(tf) || t0 === tf) return { error: L('Intervalo [t₀, t_f] inválido.', 'Invalid interval [t₀, t_f].') }
  if (!Number.isFinite(y0)) return { error: L('y₀ inválido.', 'Invalid y₀.') }
  const N0 = Math.max(1, s.N0), K = Math.max(1, Math.min(8, s.K))
  const Ns = Array.from({ length: K + 1 }, (_, j) => N0 * 2 ** j)
  if (Ns[K] > A.MAX_STEPS) return {
      error: L(
        `El refinamiento más fino tendría ${Ns[K]} pasos (máximo ${A.MAX_STEPS}). Reduce N inicial o el número de refinamientos.`,
        `The finest refinement would have ${Ns[K]} steps (maximum ${A.MAX_STEPS}). Reduce the initial N or the number of refinements.`,
      ),
    }
  const warn: string[] = []
  const F: A.OdeFn = (t, y) => [f.f(t, y[0])]
  const fy = compileDerivative(f, 'y')
  let d2: Compiled | null = null
  try {
    const D = totalDerivatives(f.node, 2)
    const c = compile(D[1].toString(), ['t', 'y'])
    if (c.ok) d2 = c
  } catch {
    /* sin Taylor 2 */
  }
  const len = tf - t0
  const rk = (id: A.TableauId) => (N: number) => A.rkSolve(F, A.TABLEAUS[id], t0, [y0], len / N, N)
  const methods: Method[] = [
    { id: 'euler', name: 'Euler', p: 1, cost: '1', run: rk('euler') },
    { id: 'pm2', name: L('Punto medio (2 pasos)', 'Midpoint (two-step)'), p: 2, cost: '1', run: (N) => A.puntoMedio2(F, t0, [y0], len / N, N) },
    { id: 'heun', name: L('Euler modificado', 'Modified Euler'), p: 2, cost: '2', run: rk('heun') },
    { id: 'trapecio', name: L('Trapecio implícito', 'Implicit trapezoidal'), p: 2, cost: '≈ 2 + 2·iter', run: (N) => A.trapecio(f.f, fy.ok ? fy.f : null, t0, y0, len / N, N, fy.ok ? 'newton' : 'punto-fijo') },
    ...(d2 ? [{ id: 'taylor2', name: 'Taylor 2', p: 2, cost: L('2 (f y y″)', '2 (f and y″)'), run: (N: number) => A.taylorSolve([f.f, d2!.f], t0, y0, len / N, N) }] : []),
    { id: 'ralston', name: 'RK2 (γ₂ = ¾)', p: 2, cost: '2', run: rk('ralston') },
    { id: 'rk3', name: 'RK3', p: 3, cost: '3', run: rk('rk3') },
    { id: 'rk4', name: 'RK4', p: 4, cost: '4', run: rk('rk4') },
    { id: 'am', name: 'Adams-Moulton', p: 4, cost: L('2 (+ arranque RK4)', '2 (+ RK4 start)'), run: (N) => A.adamsMoulton(F, t0, [y0], len / N, N, 'rk4') },
  ]
  let exact: Compiled | null = null
  let yf: number
  let refNote: string
  if (s.exact.trim()) {
    const e = compile(xToT(s.exact), ['t'])
    if (!e.ok) return { error: L('Solución exacta: ', 'Exact solution: ') + e.error }
    exact = e
    yf = e.f(tf)
    refNote = L('solución exacta', 'exact solution')
  } else {
    const Nref = Math.min(A.MAX_STEPS, Math.max(Ns[K] * 8, 2000))
    const ref = A.rkSolve(F, A.TABLEAUS.rk4, t0, [y0], len / Nref, Nref)
    yf = ref.w[ref.w.length - 1][0]
    refNote = L(`referencia RK4 con N = ${Nref}`, `RK4 reference with N = ${Nref}`)
    if (!ref.ok) warn.push(L('La solución de referencia no pudo calcularse: ', 'The reference solution could not be computed: ') + ref.message)
    warn.push(L('Sin solución exacta, el error de los métodos de orden alto con h pequeño queda limitado por la precisión de la referencia.', 'Without an exact solution, the error of high-order methods with small h is limited by the accuracy of the reference.'))
  }
  if (!Number.isFinite(yf)) return { error: L('El valor de referencia y(t_f) no es finito.', 'The reference value y(t_f) is not finite.') }
  const base: A.OdeResult[] = []
  const errors = methods.map((m) =>
    Ns.map((N, j) => {
      const r = m.run(N)
      if (j === 0) base.push(r)
      const w = r.w[r.w.length - 1][0]
      return r.t.length - 1 === N && Number.isFinite(w) ? Math.abs(w - yf) : NaN
    }),
  )
  return { methods, Ns, hs: Ns.map((N) => len / N), errors, base, yf, refNote, exact, f, t0, tf, y0, warn }
}

function Results({ s, o }: { s: State; o: Out }) {
  const orders = o.methods.map((_, m) => A.slopeLogLog(o.hs, o.errors[m]))
  const lastRatio = o.methods.map((_, m) => {
    const e = o.errors[m]
    // última razón fiable (antes de llegar al redondeo)
    let p: number | null = null
    for (let j = 1; j < e.length; j++) if (e[j] > 1e-13 && e[j - 1] > 0) p = Math.log2(e[j - 1] / e[j])
    return p
  })
  const bestIdx = o.errors.reduce((b, e, m) => (e[0] < o.errors[b][0] ? m : b), 0)

  const solPlot = useMemo(() => {
    const tr: Trace[] = []
    if (o.exact) tr.push({ ...sampleT((t) => o.exact!.f(t), o.t0, o.tf), type: 'scatter', mode: 'lines', name: L('exacta', 'exact'), line: { color: 'rgba(148,163,184,0.9)', width: 3, dash: 'dash' } })
    o.base.forEach((r, m) =>
      tr.push({ x: r.t, y: r.w.map((w) => w[0]), type: 'scatter', mode: r.t.length <= 60 ? 'lines+markers' : 'lines', name: o.methods[m].name, line: { color: SERIES[m % SERIES.length], width: 1.8, dash: m >= SERIES.length ? 'dot' : 'solid' }, marker: { size: 5 } }),
    )
    return tr
  }, [o])

  const loglog = useMemo(
    () =>
      o.methods.map((m, k) => ({
        x: o.hs,
        y: o.errors[k].map((e) => (e > 0 ? e : null)),
        type: 'scatter',
        mode: 'lines+markers',
        name: `${m.name} (p ≈ ${orders[k] === null ? '—' : orders[k]!.toFixed(2)})`,
        line: { color: SERIES[k % SERIES.length], dash: k >= SERIES.length ? 'dot' : 'solid' },
      })) as Trace[],
    [o],
  )

  const effPlot = useMemo(
    () =>
      o.methods.map((m, k) => ({
        x: o.Ns.map((N) => (N * o.base[k].nevals) / o.Ns[0]),
        y: o.errors[k].map((e) => (e > 0 ? e : null)),
        type: 'scatter',
        mode: 'lines+markers',
        name: m.name,
        line: { color: SERIES[k % SERIES.length], dash: k >= SERIES.length ? 'dot' : 'solid' },
      })) as Trace[],
    [o],
  )

  const summary = o.methods.map((m, k) => ({ name: m.name, p: m.p, cost: m.cost, w: o.base[k].w[o.base[k].w.length - 1][0], e0: o.errors[k][0], eK: o.errors[k][o.errors[k].length - 1], obs: orders[k], last: lastRatio[k] }))
  const errRows = o.Ns.map((N, j) => {
    const r: Record<string, number> = { N, h: o.hs[j] }
    o.methods.forEach((_, k) => (r['e' + k] = o.errors[k][j]))
    return r
  })
  const errCols: Column<any>[] = [{ key: 'N', tex: 'N', fmt: 'int' }, { key: 'h', tex: 'h' }, ...o.methods.map((m, k) => ({ key: 'e' + k, label: m.name, fmt: 'err' as const }))]

  return (
    <>
      <Stats
        items={[
          { label: L('y(t_f) de referencia', 'reference y(t_f)'), value: fmt(o.yf, 12), hint: o.refNote, accent: true },
          { label: L('Más preciso con N = ', 'Most accurate with N = ') + o.Ns[0], value: o.methods[bestIdx].name, hint: 'error ' + fmtErr(o.errors[bestIdx][0]) },
          { label: L('Mallas', 'Meshes'), value: `${o.Ns[0]} … ${o.Ns[o.Ns.length - 1]}`, hint: `h = ${fmt(o.hs[0], 4)} … ${fmt(o.hs[o.hs.length - 1], 4)}` },
        ]}
      />
      {o.warn.map((w, i) => (
        <Alert key={i} kind="warn">
          {w}
        </Alert>
      ))}
      <Card title={L('Resumen y orden observado', 'Summary and observed order')}>
        <DataTable
          filename="comparacion_edo"
          columns={[
            { key: 'name', label: L('Método', 'Method'), align: 'left' },
            { key: 'p', label: L('Orden teórico', 'Theoretical order'), fmt: 'int', align: 'center' },
            { key: 'cost', label: L('Eval. f / paso', 'Evals. f / step'), align: 'center' },
            { key: 'w', tex: `w_N\\;(N=${o.Ns[0]})` },
            { key: 'e0', tex: `|E|\\;(N=${o.Ns[0]})`, fmt: 'err' },
            { key: 'eK', tex: `|E|\\;(N=${o.Ns[o.Ns.length - 1]})`, fmt: 'err' },
            { key: 'obs', label: L('Pendiente log-log', 'Log-log slope'), get: (r) => (r.obs === null ? '—' : r.obs.toFixed(3)) },
            { key: 'last', tex: '\\log_2\\frac{E(h)}{E(h/2)}', get: (r) => (r.last === null ? '—' : r.last.toFixed(3)) },
          ]}
          rows={summary}
        />
      </Card>
      <Card title={L('Error global en t_f vs h (escala log-log)', 'Global error at t_f vs h (log-log scale)')}>
        <Plot data={loglog} height={440} layout={{ xaxis: { type: 'log', exponentformat: 'power', title: { text: 'h' } }, yaxis: { type: 'log', exponentformat: 'power', title: { text: '|y(t_f) − w_N|' } } }} />
        <p className="muted edo-note">
          {L(
            'La pendiente de cada recta es el orden del método: Euler ≈ 1; punto medio, Euler modificado, trapecio, Taylor 2 y RK2 ≈ 2; RK3 ≈ 3; RK4 y Adams-Moulton ≈ 4. Cuando el error llega a ~10⁻¹³ domina el redondeo.',
            'The slope of each line is the order of the method: Euler ≈ 1; midpoint, modified Euler, trapezoidal, Taylor 2 and RK2 ≈ 2; RK3 ≈ 3; RK4 and Adams-Moulton ≈ 4. Once the error reaches ~10⁻¹³, round-off dominates.',
          )}
        </p>
      </Card>
      <div className="grid-2">
        <Card title={L(`Soluciones con N = ${o.Ns[0]}`, `Solutions with N = ${o.Ns[0]}`)}>
          <Plot data={solPlot} height={380} layout={{ xaxis: { title: { text: 't' } } }} />
        </Card>
        <Card title={L('Eficiencia: error vs evaluaciones de f', 'Efficiency: error vs evaluations of f')}>
          <Plot data={effPlot} height={380} layout={{ xaxis: { type: 'log', exponentformat: 'power', title: { text: L('evaluaciones de f', 'evaluations of f') } }, yaxis: { type: 'log', exponentformat: 'power', title: { text: 'error' } } }} />
        </Card>
      </div>
      <Card title={L('Tabla de errores por malla', 'Error table by mesh')}>
        <DataTable columns={errCols} rows={errRows} filename="errores_vs_h" />
      </Card>
      <ScilabCode code={scilabCmp(s, o)} filename="comparar_edo" />
    </>
  )
}

export function scilabCmp(s: State, o: Out): string {
  let c = `// ${L('Comparación de métodos y orden observado', 'Comparison of methods and observed order')} — ${L('generado por NumLab', 'generated by NumLab')}\nclear; clc;\n\nfunction dy = f(t, y)\n  dy = ${sciOf(o.f.node)};\nendfunction\n\nfunction w = euler(t0, tf, y0, N)\n  h = (tf - t0)/N; t = t0; w = y0;\n  for i = 1:N\n    w = w + h*f(t, w); t = t + h;\n  end\nendfunction\n\nfunction w = heun(t0, tf, y0, N)\n  h = (tf - t0)/N; t = t0; w = y0;\n  for i = 1:N\n    k1 = f(t, w); k2 = f(t + h, w + h*k1);\n    w = w + h/2*(k1 + k2); t = t + h;\n  end\nendfunction\n\nfunction w = rk4(t0, tf, y0, N)\n  h = (tf - t0)/N; t = t0; w = y0;\n  for i = 1:N\n    k1 = f(t, w);\n    k2 = f(t + h/2, w + h/2*k1);\n    k3 = f(t + h/2, w + h/2*k2);\n    k4 = f(t + h, w + h*k3);\n    w = w + h/6*(k1 + 2*k2 + 2*k3 + k4); t = t + h;\n  end\nendfunction\n\nt0 = ${toScilab(s.t0, false)}; tf = ${toScilab(s.tf, false)}; y0 = ${toScilab(s.y0, false)};\n`
  c += o.exact ? `yf = ${toScilab(o.exact.node, false).replace(/\bt\b/g, 'tf')};   // ${L('solución exacta en tf', 'exact solution at tf')}\n` : `yf = ode(y0, t0, tf, 1e-13, 1e-13, f);   // ${L('referencia de alta precisión', 'high-accuracy reference')}\n`
  c += `\nNs = ${o.Ns[0]} * 2.^(0:${o.Ns.length - 1});\nhs = (tf - t0) ./ Ns;\nE = zeros(3, length(Ns));\nfor j = 1:length(Ns)\n  E(1,j) = abs(euler(t0, tf, y0, Ns(j)) - yf);\n  E(2,j) = abs(heun(t0, tf, y0, Ns(j)) - yf);\n  E(3,j) = abs(rk4(t0, tf, y0, Ns(j)) - yf);\nend\n\nmprintf('%8s %12s %14s %14s %14s\\n', 'N', 'h', 'Euler', 'Euler mod.', 'RK4');\nfor j = 1:length(Ns)\n  mprintf('%8d %12.6f %14.4e %14.4e %14.4e\\n', Ns(j), hs(j), E(1,j), E(2,j), E(3,j));\nend\n\n// ${L('Orden observado', 'Observed order')}: p = log2(E(h)/E(h/2))\np = log2(E(:,1:$-1) ./ E(:,2:$));\ndisp('${L('Orden observado (filas: Euler, Euler modificado, RK4):', 'Observed order (rows: Euler, modified Euler, RK4):')}'); disp(p);\n\nscf(0); clf();\nplot2d('ll', hs', E');\nlegend('Euler', 'Euler mod.', 'RK4');\nxlabel('h'); ylabel('${L('error en tf', 'error at tf')}'); title('${L('Error global vs h (log-log)', 'Global error vs h (log-log)')}');\n`
  return c
}
