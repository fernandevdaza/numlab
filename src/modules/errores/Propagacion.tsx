import { useMemo } from 'react'
import { compile, derivative, evalNumber, toScilab, toTex, type Compiled } from '../../lib/expr'
import { fmt, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, sampleRange, SERIES, type Trace } from '../../components/Plot'
import { Alert, Card, DataTable, Examples, ExprField, MethodPage, ScilabCode, Stats, Steps, Tabs } from '../../components/ui'
import { THEORY, TITLES, TOPIC } from './theory'
import { L } from '../../i18n'
import './errores.css'

interface S {
  f: string
  vars: string
}

interface Var {
  name: string
  value: number
  delta: number
  src: string
}

const EXAMPLES: { label: string; value: S }[] = [
  { label: L('Área de un círculo', 'Area of a circle'), value: { f: 'pi * r^2', vars: 'r = 2.5 ± 0.01' } },
  { label: L('Volumen caja x·y·z', 'Box volume x·y·z'), value: { f: 'x * y * z', vars: 'x = 3 ± 0.05\ny = 4 ± 0.05\nz = 5 ± 0.1' } },
  { label: L('Resta x − y (cancelación)', 'Difference x − y (cancellation)'), value: { f: 'x - y', vars: 'x = 1.0001 ± 0.00005\ny = 1.0000 ± 0.00005' } },
  { label: L('Cociente x/y', 'Quotient x/y'), value: { f: 'x / y', vars: 'x = 10 ± 0.1\ny = 2 ± 1%' } },
  { label: L('Péndulo g = 4π²L/T²', 'Pendulum g = 4π²L/T²'), value: { f: '4 * pi^2 * L / T^2', vars: 'L = 1.2 ± 0.005\nT = 2.2 ± 0.02' } },
  { label: 'f(x) = eˣ sin x', value: { f: 'exp(x) * sin(x)', vars: 'x = 1.5 ± 0.02' } },
]

/** Parsea líneas "x = 2.5 ± 0.01" (también +-, +/-, o Δ en %). */
function parseVars(src: string): { vars: Var[]; error?: string } {
  const vars: Var[] = []
  for (const raw of src.split(/\n|;/)) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+?)\s*(?:±|\+-|\+\/-)\s*(.+?)\s*(%)?$/)
    if (!m) return { vars, error: L(`Línea inválida: "${line}". Formato: x = 2.5 ± 0.01 (o ± 1%)`, `Invalid line: "${line}". Format: x = 2.5 ± 0.01 (or ± 1%)`) }
    const value = evalNumber(m[2])
    let delta = evalNumber(m[3])
    if (!Number.isFinite(value) || !Number.isFinite(delta)) return { vars, error: L(`Valores inválidos en "${line}"`, `Invalid values in "${line}"`) }
    if (m[4]) delta = (Math.abs(value) * delta) / 100
    vars.push({ name: m[1], value, delta: Math.abs(delta), src: line })
  }
  if (!vars.length) return { vars, error: L('Define al menos una variable: x = 2 ± 0.1', 'Define at least one variable: x = 2 ± 0.1') }
  return { vars }
}

export function Propagacion() {
  const [s, setS] = useLocalState<S>('errores:propagacion', EXAMPLES[1].value)
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)
  const names = useMemo(() => parseVars(s.vars).vars.map((v) => v.name), [s.vars])

  const calc = useMemo(() => {
    const pv = parseVars(d.vars)
    if (pv.error) return { error: pv.error }
    const vars = pv.vars
    const names = vars.map((v) => v.name)
    const f = compile(d.f, names)
    if (!f.ok) return { error: 'f: ' + f.error }
    const x0 = vars.map((v) => v.value)
    const f0 = f.f(...x0)
    if (!Number.isFinite(f0)) return { error: L('f no está definida en el punto dado.', 'f is not defined at the given point.') }
    const parts: { v: Var; dTex: string; d: Compiled; dv: number; contrib: number; kappa: number }[] = []
    for (const v of vars) {
      try {
        const dn = derivative(f.node, v.name)
        const dc = compile(dn.toString(), names)
        if (!dc.ok) return { error: L('No se pudo derivar respecto a ', 'Could not differentiate with respect to ') + v.name }
        const dv = dc.f(...x0)
        parts.push({ v, dTex: toTex(dn), d: dc, dv, contrib: Math.abs(dv) * v.delta, kappa: Math.abs((v.value * dv) / f0) })
      } catch (e: any) {
        return { error: L('No se pudo derivar: ', 'Could not differentiate: ') + (e?.message ?? e) }
      }
    }
    const df = parts.reduce((a, p) => a + p.contrib, 0)
    const dfStat = Math.sqrt(parts.reduce((a, p) => a + p.contrib ** 2, 0))
    // comprobación: evaluar en las 2^n esquinas del paralelepípedo de datos
    let lo = Infinity, hi = -Infinity
    const n = vars.length
    if (n <= 12) {
      for (let mask = 0; mask < 1 << n; mask++) {
        const args = vars.map((v, i) => v.value + ((mask >> i) & 1 ? v.delta : -v.delta))
        const y = f.f(...args)
        if (Number.isFinite(y)) {
          lo = Math.min(lo, y)
          hi = Math.max(hi, y)
        }
      }
    }
    const real = Math.max(Math.abs(hi - f0), Math.abs(f0 - lo))
    return { f, vars, f0, parts, df, dfStat, lo, hi, real }
  }, [d])

  const inputs = (
    <>
      <ExprField label={L('Función f', 'Function f')} value={s.f} onChange={(f) => set({ f })} vars={names.length ? names : ['x']} texPrefix="f =" hint={L('Usa las variables definidas abajo', 'Use the variables defined below')} />
      <label className="field">
        <span className="field-label">{L('Datos con su error (uno por línea)', 'Data with their error (one per line)')}</span>
        <textarea className="input mono" rows={4} value={s.vars} spellCheck={false} onChange={(e) => set({ vars: e.target.value })} />
        <span className="field-hint">{L('Formato: x = 2.5 ± 0.01 (también "+-"). Error relativo: y = 4 ± 2%', 'Format: x = 2.5 ± 0.01 ("+-" also works). Relative error: y = 4 ± 2%')}</span>
      </label>
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.propagacion} topic={TOPIC} theory={THEORY.propagacion} inputs={inputs} description={L('Cómo se transmite el error de los datos al resultado: fórmula lineal con derivadas parciales simbólicas, contribución de cada variable y comprobación numérica.', 'How the error in the data carries over to the result: linear formula with symbolic partial derivatives, contribution of each variable and a numerical check.')}>
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <Results c={calc} s={d} />}
    </MethodPage>
  )
}

function Results({ c, s }: { c: any; s: S }) {
  const parts: any[] = c.parts
  const vars: Var[] = c.vars
  const one = vars.length === 1
  const f: Compiled = c.f
  const N = (x: number) => texNum(x, 8)
  const rel = c.df / Math.abs(c.f0)

  const plot1 = useMemo(() => {
    if (!one) return null
    const v = vars[0]
    const h = Math.max(v.delta * 8, Math.abs(v.value) * 1e-3, 1e-6)
    const a = v.value - h, b = v.value + h
    const g = sample((x) => f.f(x), a, b, 300)
    const dv = parts[0].dv
    const t: Trace[] = [
      { ...g, type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: SERIES[0], width: 2.5 } },
      { x: [a, b], y: [c.f0 + dv * (a - v.value), c.f0 + dv * (b - v.value)], type: 'scatter', mode: 'lines', name: L('recta tangente', 'tangent line'), line: { color: SERIES[1], dash: 'dash' } },
      { x: [v.value - v.delta, v.value + v.delta], y: [c.f0 - c.df, c.f0 - c.df], type: 'scatter', mode: 'lines', showlegend: false, line: { width: 0 }, hoverinfo: 'skip' },
      { x: [v.value - v.delta, v.value + v.delta], y: [c.f0 + c.df, c.f0 + c.df], type: 'scatter', mode: 'lines', name: 'f(x₀) ± Δf', fill: 'tonexty', fillcolor: 'rgba(45,212,191,0.15)', line: { width: 0 } },
      { x: [v.value - v.delta, v.value - v.delta, NaN, v.value + v.delta, v.value + v.delta], y: [sampleRange(g)[0], c.f0 + c.df, NaN, sampleRange(g)[0], c.f0 + c.df], type: 'scatter', mode: 'lines', name: 'x₀ ± Δx', line: { color: SERIES[2], dash: 'dot', width: 1 } },
      { x: [v.value], y: [c.f0], type: 'scatter', mode: 'markers', name: '(x₀, f(x₀))', marker: { color: SERIES[3], size: 9 } },
    ]
    return t
  }, [c])

  const stepList = [
    ...parts.map((p) => ({ text: L(`Derivada parcial respecto a ${p.v.name}:`, `Partial derivative with respect to ${p.v.name}:`), tex: `\\frac{\\partial f}{\\partial ${p.v.name}} = ${p.dTex}\\;\\Big|_{\\text{${L('datos', 'data')}}} = ${N(p.dv)}` })),
    { text: L('Valor de la función en los datos:', 'Value of the function at the data:'), tex: `f(${vars.map((v) => fmt(v.value)).join(', ')}) = ${N(c.f0)}` },
    {
      text: L('Fórmula de propagación (primer orden, peor caso):', 'Propagation formula (first order, worst case):'),
      tex: `\\Delta f \\approx ${parts.map((p) => `\\left|\\frac{\\partial f}{\\partial ${p.v.name}}\\right|\\Delta ${p.v.name}`).join(' + ')} = ${parts.map((p) => `|${N(p.dv)}|(${N(p.v.delta)})`).join(' + ')} = ${N(c.df)}`,
    },
    { text: L('Error relativo del resultado:', 'Relative error of the result:'), tex: `\\delta f = \\frac{\\Delta f}{|f|} = \\frac{${N(c.df)}}{${N(Math.abs(c.f0))}} = ${texNum(rel, 5)}\\ (${texNum(rel * 100, 4)}\\,\\%)` },
    { text: L('Resultado:', 'Result:'), tex: `f = ${N(c.f0)} \\pm ${texNum(c.df, 3)}` },
  ]

  return (
    <>
      <Stats
        items={[
          { label: L('f(datos)', 'f(data)'), value: fmt(c.f0, 12), accent: true },
          { label: L('Δf (peor caso)', 'Δf (worst case)'), value: c.df.toExponential(4), hint: 'Σ |∂f/∂xᵢ| Δxᵢ' },
          { label: L('Error relativo δf', 'Relative error δf'), value: rel.toExponential(3), hint: `${fmt(rel * 100, 4)} %` },
          { label: L('Δf estadístico', 'Statistical Δf'), value: c.dfStat.toExponential(4), hint: '√Σ(∂f/∂xᵢ · Δxᵢ)²' },
        ]}
      />
      <Alert kind="ok">
        {L(
          <>
            Resultado: <b className="mono">f = {fmt(c.f0, 10)} ± {c.df.toPrecision(2)}</b>. Comprobación evaluando f en los extremos de los datos: f ∈ [{fmt(c.lo, 10)}, {fmt(c.hi, 10)}], desviación máxima real{' '}
            {c.real.toExponential(3)} ({c.df > 0 ? fmt((c.real / c.df) * 100, 4) : '—'} % de la estimación lineal).
          </>,
          <>
            Result: <b className="mono">f = {fmt(c.f0, 10)} ± {c.df.toPrecision(2)}</b>. Check by evaluating f at the extremes of the data: f ∈ [{fmt(c.lo, 10)}, {fmt(c.hi, 10)}], actual maximum deviation{' '}
            {c.real.toExponential(3)} ({c.df > 0 ? fmt((c.real / c.df) * 100, 4) : '—'} % of the linear estimate).
          </>,
        )}
      </Alert>
      <Tabs
        tabs={[
          {
            label: L('Paso a paso', 'Step by step'),
            content: (
              <Card>
                <Steps steps={stepList} />
              </Card>
            ),
          },
          {
            label: L('Contribuciones', 'Contributions'),
            content: (
              <Card>
                <DataTable
                  filename="propagacion"
                  columns={[
                    { key: 'name', label: L('Variable', 'Variable'), align: 'left', get: (r) => r.v.name },
                    { key: 'val', tex: 'x_i', get: (r) => fmt(r.v.value, 10) },
                    { key: 'del', tex: '\\Delta x_i', get: (r) => fmt(r.v.delta, 6) },
                    { key: 'dv', tex: '\\partial f/\\partial x_i' },
                    { key: 'contrib', tex: '|\\partial_i f|\\,\\Delta x_i', fmt: 'err' },
                    { key: 'pct', label: L('% del total', '% of total'), get: (r) => (c.df > 0 ? fmt((100 * r.contrib) / c.df, 4) + ' %' : '—') },
                    { key: 'kappa', tex: '\\kappa_i = \\left|\\frac{x_i\\,\\partial_i f}{f}\\right|', get: (r) => fmt(r.kappa, 5) },
                  ]}
                  rows={parts}
                />
                <Plot
                  height={260}
                  data={[{ x: parts.map((p) => p.v.name), y: parts.map((p) => p.contrib), type: 'bar', marker: { color: parts.map((_, i) => SERIES[i % SERIES.length]) }, name: L('contribución', 'contribution') }]}
                  layout={{ yaxis: { title: { text: '|∂f/∂xᵢ| Δxᵢ' }, exponentformat: 'power' }, showlegend: false }}
                />
                <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                  {L(
                    'κᵢ es el número de condición respecto a cada dato: δf ≈ Σ κᵢ δxᵢ. Para mejorar el resultado conviene medir con más precisión la variable que más aporta.',
                    'κᵢ is the condition number with respect to each datum: δf ≈ Σ κᵢ δxᵢ. To improve the result, measure the variable that contributes most more precisely.',
                  )}
                </p>
              </Card>
            ),
          },
          ...(plot1
            ? [
                {
                  label: L('Gráfica', 'Plot'),
                  content: (
                    <Card>
                      <Plot data={plot1} layout={{ xaxis: { title: { text: vars[0].name } } }} />
                      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                        {L(
                          'La fórmula lineal usa la recta tangente: Δf ≈ |f′(x₀)| Δx. Si la curvatura es grande respecto a Δx, la estimación de primer orden deja de ser buena.',
                          'The linear formula uses the tangent line: Δf ≈ |f′(x₀)| Δx. If the curvature is large relative to Δx, the first-order estimate is no longer good.',
                        )}
                      </p>
                    </Card>
                  ),
                },
              ]
            : []),
        ]}
      />
      <ScilabCode
        filename="propagacion"
        code={`// ${L('Propagación de errores (primer orden) — generado por NumLab', 'Error propagation (first order) — generated by NumLab')}
clear; clc;
${vars.map((v) => `${v.name} = ${v.value}; d${v.name} = ${v.delta};`).join('\n')}
f = ${toScilab(s.f, false)};
${parts.map((p) => `df_d${p.v.name} = ${toScilab(p.d.node, false)};`).join('\n')}
Df = ${parts.map((p) => `abs(df_d${p.v.name})*d${p.v.name}`).join(' + ')};
mprintf('f = %.10f +/- %.3e  (${L('error relativo', 'relative error')} %.3e)\\n', f, Df, Df/abs(f));
`}
      />
    </>
  )
}
