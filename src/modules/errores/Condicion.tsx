import { useMemo } from 'react'
import { compile, compileDerivative, evalNumber, math, toScilab, toTex } from '../../lib/expr'
import { fmt, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, SERIES } from '../../components/Plot'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, MethodPage, NumField, ScilabCode, Stats, Steps, Tabs } from '../../components/ui'
import { THEORY, TITLES, TOPIC } from './theory'
import './errores.css'

interface S {
  f: string
  x0: string
  a: string
  b: string
}

const EXAMPLES: { label: string; value: S }[] = [
  { label: 'Ej. 1.21 · aˣ con a = 2: K = |x ln a|', value: { f: '2^x', x0: '100', a: '-150', b: '150' } },
  { label: '√x (κ = ½)', value: { f: 'sqrt(x)', x0: '2', a: '0.01', b: '10' } },
  { label: 'eˣ (κ = |x|)', value: { f: 'exp(x)', x0: '20', a: '-30', b: '30' } },
  { label: 'ln x cerca de 1', value: { f: 'ln(x)', x0: '1.001', a: '0.2', b: '3' } },
  { label: 'x − 1 cerca de 1', value: { f: 'x - 1', x0: '1.0001', a: '0', b: '2' } },
  { label: 'tan x cerca de π/2', value: { f: 'tan(x)', x0: '1.5707', a: '0', b: '3' } },
  { label: 'sin x cerca de π', value: { f: 'sin(x)', x0: '3.14159', a: '0.1', b: '6' } },
  { label: '(1 − cos x)/x² (bien cond.)', value: { f: '(1 - cos(x))/x^2', x0: '1e-4', a: '0.001', b: '3' } },
  { label: 'x¹⁰', value: { f: 'x^10', x0: '1.5', a: '0.1', b: '3' } },
]

export function Condicion() {
  const [s, setS] = useLocalState<S>('errores:condicion', EXAMPLES[3].value)
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)

  const calc = useMemo(() => {
    const f = compile(d.f)
    if (!f.ok) return { error: 'f(x): ' + f.error }
    const df = compileDerivative(f)
    if (!df.ok) return { error: df.error }
    const x0 = evalNumber(d.x0), a = evalNumber(d.a), b = evalNumber(d.b)
    if (![x0, a, b].every(Number.isFinite) || a >= b) return { error: 'Revisa x₀ y el intervalo [a, b] (a < b).' }
    const kappa = (x: number) => Math.abs((x * df.f(x)) / f.f(x))
    let kTex = ''
    try {
      kTex = toTex(math.simplify(math.parse(`x * (${df.node.toString()}) / (${f.node.toString()})`)))
    } catch {
      kTex = `\\frac{x\\,(${df.tex})}{${f.tex}}`
    }
    const k0 = kappa(x0)
    const f0 = f.f(x0)
    const exper = [1e-2, 1e-4, 1e-6, 1e-8, 1e-10].map((delta) => {
      const xt = x0 * (1 + delta)
      const ft = f.f(xt)
      const relOut = Math.abs((ft - f0) / f0)
      const relIn = Math.abs((xt - x0) / x0)
      return { delta, xt, ft, relIn, relOut, ratio: relOut / relIn }
    })
    return { f, df, x0, a, b, kappa, k0, f0, kTex, exper }
  }, [d])

  const inputs = (
    <>
      <ExprField label="Función f(x)" value={s.f} onChange={(f) => set({ f })} texPrefix="f(x) =" />
      <NumField label="Punto x₀" value={s.x0} onChange={(x0) => set({ x0 })} />
      <FieldRow>
        <NumField label="Gráfica: a" value={s.a} onChange={(a) => set({ a })} />
        <NumField label="b" value={s.b} onChange={(b) => set({ b })} />
      </FieldRow>
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.condicion} topic={TOPIC} theory={THEORY.condicion} inputs={inputs} description="El número de condición K = κ(x) = |x f′(x)/f(x)| mide cuánto se amplifica un error relativo en x al evaluar f. Es propiedad del problema (estabilidad matemática), no del algoritmo.">
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <Results c={calc} s={d} />}
    </MethodPage>
  )
}

function Results({ c, s }: { c: any; s: S }) {
  const k0: number = c.k0
  const lost = k0 > 1 ? Math.log10(k0) : 0
  const cls = !Number.isFinite(k0) ? 'error' : k0 < 10 ? 'ok' : k0 < 1e4 ? 'warn' : 'error'
  const plots = useMemo(() => {
    const fs = sample(c.f.f, c.a, c.b, 600)
    const ks = sample(c.kappa, c.a, c.b, 600)
    const ky = ks.y.map((v) => (v !== null && v > 0 ? v : null))
    return {
      f: [
        { ...fs, type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: SERIES[0], width: 2.5 } },
        { x: [c.x0], y: [c.f0], type: 'scatter', mode: 'markers', name: 'x₀', marker: { color: SERIES[3], size: 10 } },
      ],
      k: [
        { x: ks.x, y: ky, type: 'scatter', mode: 'lines', name: 'κ(x)', line: { color: SERIES[1], width: 2.2 } },
        { x: [c.a, c.b], y: [1, 1], type: 'scatter', mode: 'lines', name: 'κ = 1', line: { color: SERIES[5], dash: 'dot', width: 1 } },
        { x: [c.x0], y: [k0 > 0 ? k0 : null], type: 'scatter', mode: 'markers', name: 'κ(x₀)', marker: { color: SERIES[3], size: 10 } },
      ],
    }
  }, [c])
  const N = (x: number) => texNum(x, 8)
  return (
    <>
      <Stats
        items={[
          { label: 'κ(x₀)', value: Number.isFinite(k0) ? fmt(k0, 6) : '∞', accent: true },
          { label: 'Cifras que se pierden', value: Number.isFinite(lost) ? '≈ ' + lost.toFixed(1) : '∞', hint: 'log₁₀ κ' },
          { label: 'f(x₀)', value: fmt(c.f0, 12) },
          { label: 'Diagnóstico', value: cls === 'ok' ? 'bien condicionado' : cls === 'warn' ? 'moderado' : 'mal condicionado' },
        ]}
      />
      <Alert kind={cls === 'error' ? 'error' : cls === 'warn' ? 'warn' : 'ok'}>
        Un error relativo δ en x₀ produce en f(x₀) un error relativo ≈ {Number.isFinite(k0) ? fmt(k0, 4) : '∞'}·δ. Con datos en doble precisión (δ ≈ 1.1·10⁻¹⁶) se pueden esperar a lo sumo ≈{' '}
        {Math.max(0, 16 - lost).toFixed(0)} cifras correctas, <b>cualquiera sea el algoritmo</b>.
      </Alert>
      <Tabs
        tabs={[
          {
            label: 'κ(x)',
            content: (
              <Card>
                <Plot data={plots.k as any} layout={{ yaxis: { type: 'log', title: { text: 'κ(x)' }, exponentformat: 'power' }, xaxis: { title: { text: 'x' } } }} />
              </Card>
            ),
          },
          {
            label: 'f(x)',
            content: (
              <Card>
                <Plot data={plots.f as any} layout={{ xaxis: { title: { text: 'x' } } }} />
              </Card>
            ),
          },
          {
            label: 'Paso a paso',
            content: (
              <Card>
                <Steps
                  steps={[
                    { text: 'Derivada:', tex: `f'(x) = ${c.df.tex}` },
                    { text: 'Número de condición (simplificado):', tex: `\\kappa(x) = \\left|\\frac{x f'(x)}{f(x)}\\right| = \\left|${c.kTex}\\right|` },
                    { text: 'Evaluando en x₀:', tex: `\\kappa(${fmt(c.x0)}) = \\left|\\frac{(${N(c.x0)})(${N(c.df.f(c.x0))})}{${N(c.f0)}}\\right| = ${N(k0)}` },
                    { text: 'Interpretación:', tex: `\\frac{|\\Delta f|}{|f|} \\approx ${N(k0)}\\cdot\\frac{|\\Delta x|}{|x|}\\;\\Rightarrow\\; \\text{se pierden} \\approx \\log_{10}\\kappa = ${lost.toFixed(2)}\\ \\text{cifras}` },
                  ]}
                />
              </Card>
            ),
          },
          {
            label: 'Experimento',
            content: (
              <Card>
                <DataTable
                  filename="condicion_experimento"
                  columns={[
                    { key: 'delta', tex: '\\delta', fmt: 'err' },
                    { key: 'xt', tex: '\\tilde x = x_0(1+\\delta)' },
                    { key: 'ft', tex: 'f(\\tilde x)' },
                    { key: 'relOut', tex: '\\frac{|f(\\tilde x)-f(x_0)|}{|f(x_0)|}', fmt: 'err' },
                    { key: 'ratio', tex: '\\text{amplificación}', get: (r) => fmt(r.ratio, 6) },
                  ]}
                  rows={c.exper}
                />
                <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
                  Al perturbar x₀ un poco, el cociente (error relativo de salida)/(error relativo de entrada) tiende a κ(x₀) = {fmt(k0, 6)}. Para δ muy pequeño el propio redondeo contamina el experimento.
                </p>
              </Card>
            ),
          },
        ]}
      />
      <ScilabCode
        filename="condicion"
        code={`// Número de condición κ(x) = |x f'(x) / f(x)| — generado por NumLab
clear; clc;
deff('y = f(x)', 'y = ${toScilab(s.f)}');
deff('y = df(x)', 'y = ${toScilab(c.df.node)}');
x0 = ${s.x0.replace(/\bpi\b/g, '%pi')};
k0 = abs(x0 * df(x0) / f(x0));
mprintf('kappa(x0) = %g  ->  se pierden ~%.1f cifras\\n', k0, log10(max(k0, 1)));
x = linspace(${s.a.replace(/\bpi\b/g, '%pi')}, ${s.b.replace(/\bpi\b/g, '%pi')}, 500);
k = abs(x .* df(x) ./ f(x));
plot(x, log10(k)); xgrid(); xlabel('x'); ylabel('log10(kappa)');
`}
      />
    </>
  )
}
