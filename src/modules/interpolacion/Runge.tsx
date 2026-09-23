// Fenómeno de Runge (Fig. 4.1 y 4.2 del texto): polinomio con nodos equiespaciados vs. spline natural; nodos de Chebyshev como complemento.
import { useMemo } from 'react'
import { compile, evalNumber, toScilab, type Compiled } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, sampleRange, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, CheckField, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, Stats, Steps, Tabs } from '../../components/ui'
import * as A from './algorithms'
import { sci, sub } from './texutil'
import { THEORY, TITLES, TOPIC } from './theory'

interface State {
  f: string
  a: string
  b: string
  n: number
  equi: boolean
  cheb: boolean
  spline: boolean
  clip: boolean
}

const DEFAULTS: State = { f: '1/(1+x^2)', a: '-5', b: '5', n: 10, equi: true, cheb: false, spline: true, clip: true }

const EXAMPLES: { label: string; value: Partial<State> }[] = [
  { label: 'Fig. 4.1 y 4.2 · 1/(1+x²), grado 10', value: { f: '1/(1+x^2)', a: '-5', b: '5', n: 10, equi: true, spline: true } },
  { label: '1/(1+x²) en [−5, 5], grado 20', value: { f: '1/(1+x^2)', a: '-5', b: '5', n: 20, equi: true, spline: true } },
  { label: 'Runge 1/(1+25x²) en [−1, 1], n = 10', value: { f: '1/(1+25x^2)', a: '-1', b: '1', n: 10 } },
  { label: '|x| en [−1, 1]', value: { f: 'abs(x)', a: '-1', b: '1', n: 14 } },
  { label: 'eˣ (converge)', value: { f: 'exp(x)', a: '-1', b: '1', n: 12 } },
  { label: 'sen(πx) (converge)', value: { f: 'sin(pi x)', a: '-1', b: '1', n: 16 } },
]

interface Run {
  nodes: number[]
  ys: number[]
  P: (x: number) => number
  maxErr: number
  at: number
}

function run(f: Compiled, nodes: number[], a: number, b: number): Run {
  const ys = nodes.map((x) => f.f(x))
  const w = A.baryWeights(nodes)
  const P = (x: number) => A.baryEval(nodes, ys, w, x)
  const m = A.maxAbsSample((x) => f.f(x) - P(x), a, b, 3000)
  return { nodes, ys, P, maxErr: m.max, at: m.at }
}
function runSpline(f: Compiled, nodes: number[], a: number, b: number): Run {
  const ys = nodes.map((x) => f.f(x))
  const sp = A.cubicSplineM(nodes, ys, 'natural')
  const P = (x: number) => A.splineMEval(sp, x)
  const m = A.maxAbsSample((x) => f.f(x) - P(x), a, b, 3000)
  return { nodes, ys, P, maxErr: m.max, at: m.at }
}

interface Calc {
  error?: string
  f?: Compiled
  a?: number
  b?: number
  eq?: Run
  ch?: Run
  sp?: Run
  sweep?: { n: number; eq: number; ch: number; sp: number }[]
}

export function compute(s: State): Calc {
  const f = compile(s.f)
  if (!f.ok) return { error: 'f(x): ' + f.error }
  const a = evalNumber(s.a), b = evalNumber(s.b)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: 'Intervalo [a, b] inválido.' }
  if (a >= b) return { error: 'Debe cumplirse a < b.' }
  const n = s.n
  const eqN = A.equiNodes(a, b, n), chN = A.chebyshevNodes(a, b, n)
  if ([...eqN, ...chN].some((x) => !Number.isFinite(f.f(x)))) return { error: 'f(x) no está definida en algún nodo del intervalo.' }
  const sweep: Calc['sweep'] = []
  for (let k = 2; k <= Math.max(24, n); k += 2) {
    sweep.push({ n: k, eq: run(f, A.equiNodes(a, b, k), a, b).maxErr, ch: run(f, A.chebyshevNodes(a, b, k), a, b).maxErr, sp: runSpline(f, A.equiNodes(a, b, k), a, b).maxErr })
  }
  return { f, a, b, eq: run(f, eqN, a, b), ch: run(f, chN, a, b), sp: n >= 1 ? runSpline(f, eqN, a, b) : undefined, sweep }
}

export function Runge() {
  const [s, setS] = useLocalState<State>('interpolacion:runge', DEFAULTS)
  const set = (p: Partial<State>) => setS((prev) => ({ ...prev, ...p }))
  const d = useDebounced(s, 120)
  const c = useMemo(() => compute(d), [d])

  const inputs = (
    <>
      <ExprField label="Función f(x)" value={s.f} onChange={(f) => set({ f })} texPrefix="f(x) =" />
      <FieldRow>
        <NumField label="a" value={s.a} onChange={(a) => set({ a })} />
        <NumField label="b" value={s.b} onChange={(b) => set({ b })} />
      </FieldRow>
      <label className="field">
        <span className="field-label">
          Grado n = {s.n} ({s.n + 1} nodos)
        </span>
        <input type="range" min={1} max={40} value={s.n} onChange={(e) => set({ n: Number(e.target.value) })} style={{ width: '100%', accentColor: SERIES[0] }} />
      </label>
      <IntField label="Grado n (exacto)" value={s.n} onChange={(n) => set({ n })} min={1} max={40} />
      <CheckField label="Nodos equiespaciados" value={s.equi} onChange={(equi) => set({ equi })} />
      <CheckField label="Nodos de Chebyshev" value={s.cheb} onChange={(cheb) => set({ cheb })} />
      <CheckField label="Spline cúbica natural (nodos equiespaciados)" value={s.spline} onChange={(spline) => set({ spline })} />
      <CheckField label="Limitar eje y al rango de f" value={s.clip} onChange={(clip) => set({ clip })} />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage
      title={TITLES.runge}
      topic={TOPIC}
      theory={THEORY.runge}
      description="Mueve el grado n: el polinomio con nodos equiespaciados oscila cerca de los extremos, mientras que la spline (y el polinomio con nodos de Chebyshev) sigue a f."
      inputs={inputs}
    >
      {c.error ? <Alert kind="error">{c.error}</Alert> : c.eq && <Results s={d} c={c as Required<Calc>} />}
    </MethodPage>
  )
}

function Results({ s, c }: { s: State; c: Required<Calc> }) {
  const n = s.n
  const grows = c.sweep.length > 2 && c.sweep[c.sweep.length - 1].eq > c.sweep[0].eq
  return (
    <>
      <Stats
        items={[
          { label: 'máx |f − P| equiespaciados', value: fmtErr(c.eq.maxErr), hint: `en x ≈ ${fmt(c.eq.at, 5)}`, accent: true },
          { label: 'máx |f − P| Chebyshev', value: fmtErr(c.ch.maxErr), hint: `en x ≈ ${fmt(c.ch.at, 5)}` },
          { label: 'máx |f − S| spline natural', value: c.sp ? fmtErr(c.sp.maxErr) : '—' },
          { label: 'Grado n', value: n, hint: `${n + 1} nodos` },
        ]}
      />
      <Alert kind={grows ? 'warn' : 'info'}>
        {grows ? (
          <>Con nodos equiespaciados el error máximo <b>crece</b> con n (fenómeno de Runge); con nodos de Chebyshev {c.sweep[c.sweep.length - 1].ch < c.sweep[0].ch ? 'disminuye' : 'se mantiene acotado'}.</>
        ) : (
          <>Para esta función el error con nodos equiespaciados no crece en el rango estudiado: f es suficientemente “suave” (analítica en una región grande alrededor de [a, b]).</>
        )}
      </Alert>
      <Tabs
        tabs={[
          { label: 'Gráfica', content: <Card><MainPlot s={s} c={c} /></Card> },
          { label: 'Error |f − P|', content: <Card><ErrPlot s={s} c={c} /></Card> },
          { label: 'Error máx. vs n', content: <Card><SweepPlot c={c} /></Card> },
          { label: 'Factor nodal', content: <Card><NodalPlot c={c} /></Card> },
          { label: 'Nodos', content: <Card><Steps steps={nodeSteps(c)} /></Card> },
        ]}
      />
      <Card title="Tabla de nodos">
        <DataTable
          filename="nodos_runge"
          columns={[
            { key: 'k', tex: 'k', fmt: 'int', align: 'center' },
            { key: 'xe', tex: 'x_k\\;\\text{equiesp.}' },
            { key: 'fe', tex: 'f(x_k)' },
            { key: 'xc', tex: 'x_k\\;\\text{Chebyshev}' },
            { key: 'fc', tex: 'f(x_k)' },
          ]}
          rows={c.eq.nodes.map((xe, k) => ({ k, xe, fe: c.eq.ys[k], xc: c.ch.nodes[k], fc: c.ch.ys[k] }))}
        />
      </Card>
      <Card title="Error máximo según el grado">
        <DataTable
          filename="runge_error_vs_n"
          columns={[
            { key: 'n', tex: 'n', fmt: 'int', align: 'center' },
            { key: 'eq', tex: '\\max|f-P_n|\\;\\text{equiesp.}', fmt: 'err' },
            { key: 'ch', tex: '\\max|f-P_n|\\;\\text{Chebyshev}', fmt: 'err' },
            { key: 'sp', tex: '\\max|f-S|\\;\\text{spline}', fmt: 'err' },
          ]}
          rows={c.sweep}
          highlight={(r) => r.n === n}
        />
      </Card>
      <ScilabCode code={scilab(s, c)} filename="runge" />
    </>
  )
}

function MainPlot({ s, c }: { s: State; c: Required<Calc> }) {
  const { data, yr } = useMemo(() => {
    const fs = sample(c.f.f, c.a, c.b, 800)
    const t: Trace[] = [{ ...fs, type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: '#94a3b8', width: 3 } }]
    if (s.equi) {
      t.push({ ...sample(c.eq.P, c.a, c.b, 1200), type: 'scatter', mode: 'lines', name: `P${sub(s.n)} equiespaciado`, line: { color: SERIES[6], width: 2 } })
      t.push({ x: c.eq.nodes, y: c.eq.ys, type: 'scatter', mode: 'markers', name: 'nodos equiesp.', marker: { color: SERIES[6], size: 7 } })
    }
    if (s.cheb) {
      t.push({ ...sample(c.ch.P, c.a, c.b, 1200), type: 'scatter', mode: 'lines', name: `P${sub(s.n)} Chebyshev`, line: { color: SERIES[0], width: 2 } })
      t.push({ x: c.ch.nodes, y: c.ch.ys, type: 'scatter', mode: 'markers', name: 'nodos Chebyshev', marker: { color: SERIES[0], size: 7, symbol: 'square' } })
    }
    if (s.spline && c.sp) t.push({ ...sample(c.sp.P, c.a, c.b, 1200), type: 'scatter', mode: 'lines', name: 'spline natural', line: { color: SERIES[2], width: 2, dash: 'dot' } })
    const [lo, hi] = sampleRange(fs)
    const span = hi - lo || 1
    return { data: t, yr: [lo - 0.6 * span, hi + 0.6 * span] }
  }, [s, c])
  return <Plot data={data} height={420} layout={{ xaxis: { title: { text: 'x' } }, yaxis: s.clip ? { range: yr } : {} }} />
}

function ErrPlot({ s, c }: { s: State; c: Required<Calc> }) {
  const data = useMemo(() => {
    const pos = (r: { x: number[]; y: (number | null)[] }) => ({ x: r.x, y: r.y.map((v) => (v !== null && v > 0 ? v : null)) })
    const t: Trace[] = []
    if (s.equi) t.push({ ...pos(sample((x) => Math.abs(c.f.f(x) - c.eq.P(x)), c.a, c.b, 1200)), type: 'scatter', mode: 'lines', name: 'equiespaciados', line: { color: SERIES[6], width: 2 } })
    if (s.cheb) t.push({ ...pos(sample((x) => Math.abs(c.f.f(x) - c.ch.P(x)), c.a, c.b, 1200)), type: 'scatter', mode: 'lines', name: 'Chebyshev', line: { color: SERIES[0], width: 2 } })
    if (s.spline && c.sp) t.push({ ...pos(sample((x) => Math.abs(c.f.f(x) - c.sp.P(x)), c.a, c.b, 1200)), type: 'scatter', mode: 'lines', name: 'spline natural', line: { color: SERIES[2], width: 2, dash: 'dot' } })
    return t
  }, [s, c])
  return <Plot data={data} layout={{ yaxis: { type: 'log', title: { text: '|f(x) − P(x)|' }, exponentformat: 'power' }, xaxis: { title: { text: 'x' } } }} />
}

function SweepPlot({ c }: { c: Required<Calc> }) {
  const data = useMemo(
    () =>
      [
        { x: c.sweep.map((r) => r.n), y: c.sweep.map((r) => r.eq), type: 'scatter', mode: 'lines+markers', name: 'equiespaciados', line: { color: SERIES[6] } },
        { x: c.sweep.map((r) => r.n), y: c.sweep.map((r) => r.ch), type: 'scatter', mode: 'lines+markers', name: 'Chebyshev', line: { color: SERIES[0] } },
        { x: c.sweep.map((r) => r.n), y: c.sweep.map((r) => r.sp), type: 'scatter', mode: 'lines+markers', name: 'spline natural', line: { color: SERIES[2], dash: 'dot' } },
      ] as Trace[],
    [c],
  )
  return <Plot data={data} layout={{ yaxis: { type: 'log', title: { text: 'error máximo en [a, b]' }, exponentformat: 'power' }, xaxis: { title: { text: 'n (grado)' } } }} />
}

function NodalPlot({ c }: { c: Required<Calc> }) {
  const data = useMemo(
    () =>
      [
        { ...sample((x) => Math.abs(A.nodeProduct(c.eq.nodes, x)), c.a, c.b, 1200), type: 'scatter', mode: 'lines', name: '|∏(x − xᵢ)| equiesp.', line: { color: SERIES[6], width: 2 } },
        { ...sample((x) => Math.abs(A.nodeProduct(c.ch.nodes, x)), c.a, c.b, 1200), type: 'scatter', mode: 'lines', name: '|∏(x − xᵢ)| Chebyshev', line: { color: SERIES[0], width: 2 } },
      ] as Trace[],
    [c],
  )
  return (
    <>
      <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        El factor <Tex>{'\\prod(x-x_i)'}</Tex> de la fórmula del error: con nodos equiespaciados es enorme cerca de los extremos; con Chebyshev oscila con amplitud uniforme (mínima posible).
      </p>
    </>
  )
}

export function nodeSteps(c: Required<Calc>) {
  const n = c.eq.nodes.length - 1
  const N = (x: number) => fmt(x, 8)
  const ch = c.ch.nodes.slice().reverse() // k = 0 es el mayor
  return [
    { text: 'Nodos equiespaciados:', tex: `x_k = a + k\\,\\frac{b-a}{n} = ${N(c.a)} + k\\cdot ${N((c.b - c.a) / n)},\\quad k = 0,\\dots,${n}` },
    { text: 'Nodos de Chebyshev (raíces de T_{n+1} trasladadas a [a, b]):', tex: `x_k = \\frac{a+b}{2} + \\frac{b-a}{2}\\cos\\left(\\frac{(2k+1)\\pi}{2(${n}+1)}\\right),\\quad k=0,\\dots,${n}` },
    ...ch.slice(0, 4).map((x, k) => ({ tex: `x_{${k}} = ${N((c.a + c.b) / 2)} + ${N((c.b - c.a) / 2)}\\cos\\left(\\frac{${2 * k + 1}\\pi}{${2 * (n + 1)}}\\right) = ${N(x)}` })),
    ...(n > 3 ? [{ text: '… (se agrupan cerca de los extremos del intervalo).' }] : []),
    {
      text: 'Comparación del factor nodal máximo:',
      tex: `\\max|\\textstyle\\prod(x-x_i)|_{\\text{equi}} \\approx ${N(A.maxAbsSample((x) => A.nodeProduct(c.eq.nodes, x), c.a, c.b, 4000).max)},\\qquad \\max|\\textstyle\\prod(x-x_i)|_{\\text{Cheb}} \\approx ${N(A.maxAbsSample((x) => A.nodeProduct(c.ch.nodes, x), c.a, c.b, 4000).max)} = 2\\left(\\tfrac{b-a}{4}\\right)^{${n + 1}}`,
    },
  ]
}

export function scilab(s: State, c: Required<Calc>): string {
  return `// Fenomeno de Runge — generado por NumLab
clear; clc;
function y = f(x)
  y = ${toScilab(c.f.src, true)};
endfunction

// Evalua el polinomio de Lagrange que pasa por (xn, yn) en los puntos t
function p = lagrange_eval(xn, yn, t)
  p = zeros(t);
  for i = 1:length(xn)
    L = ones(t);
    for j = 1:length(xn)
      if j <> i then
        L = L .* (t - xn(j)) / (xn(i) - xn(j));
      end
    end
    p = p + yn(i) * L;
  end
endfunction

a = ${sci(c.a)}; b = ${sci(c.b)}; n = ${s.n};
xe = linspace(a, b, n+1);                                   // equiespaciados
k = 0:n;
xc = (a+b)/2 + (b-a)/2 * cos((2*k + 1) * %pi / (2*(n+1)));  // Chebyshev
t = linspace(a, b, 2000);
pe = lagrange_eval(xe, f(xe), t);
pc = lagrange_eval(xc, f(xc), t);
ds = splin(xe, f(xe), "natural");
ps = interp(t, xe, f(xe), ds);
mprintf('n = %d\\n', n);
mprintf('Error max equiespaciados: %.4e\\n', max(abs(f(t) - pe)));
mprintf('Error max Chebyshev:      %.4e\\n', max(abs(f(t) - pc)));
mprintf('Error max spline natural: %.4e\\n', max(abs(f(t) - ps)));

clf();
subplot(2, 1, 1);
plot(t, f(t), 'k-', t, pe, 'r-', t, pc, 'b-');
plot(xe, f(xe), 'ro'); plot(xc, f(xc), 'bs');
xgrid(); legend(['f(x)', 'equiespaciados', 'Chebyshev']);
title('Fenomeno de Runge, n = ' + string(n));
subplot(2, 1, 2);
plot(t, abs(f(t) - pe), 'r-', t, abs(f(t) - pc), 'b-');
xgrid(); legend(['|f - P| equi', '|f - P| Chebyshev']);
`
}
