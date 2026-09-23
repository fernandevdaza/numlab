import { useMemo } from 'react'
import type { MathNode } from 'mathjs'
import { compile, derivative, evalNumber, toScilab, toTex, type Compiled } from '../../lib/expr'
import { fmt, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, sampleRange, SERIES, type Trace } from '../../components/Plot'
import { Alert, Card, CheckField, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, Stats, Steps, Tabs } from '../../components/ui'
import { evalTaylor, factorial, taylorCoeffs } from './numeric'
import { exactTaylor, factorialTex, generalTex, simplifiedTex, type ExactTaylor } from './taylorExact'
import { THEORY, TITLES, TOPIC } from './theory'
import './errores.css'

interface S {
  f: string
  x0: string
  n: number
  x: string
  a: string
  b: string
  all: boolean
  tol: string
}

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: 'Ej. 1.22 · eˣ en x₀ = 0, x = 1', value: { f: 'exp(x)', x0: '0', n: 4, x: '1', a: '-3', b: '3' } },
  { label: 'Ej. 1.22 · cos x en x₀ = 0', value: { f: 'cos(x)', x0: '0', n: 4, x: 'pi/4', a: '-6.5', b: '6.5' } },
  { label: 'Ej. 1.22 · sen x en x₀ = 0', value: { f: 'sin(x)', x0: '0', n: 5, x: 'pi/4', a: '-6.5', b: '6.5' } },
  { label: 'cos x en π/3', value: { f: 'cos(x)', x0: 'pi/3', n: 3, x: '1.2', a: '-2', b: '4' } },
  { label: 'ln x en 1', value: { f: 'ln(x)', x0: '1', n: 4, x: '1.5', a: '0.05', b: '3' } },
  { label: '√x en 4', value: { f: 'sqrt(x)', x0: '4', n: 3, x: '4.4', a: '0', b: '10' } },
  { label: '1/(1−x) en 0', value: { f: '1/(1 - x)', x0: '0', n: 6, x: '0.5', a: '-1', b: '0.95' } },
  { label: 'atan x en 0', value: { f: 'atan(x)', x0: '0', n: 7, x: '0.8', a: '-2', b: '2' } },
]

export function Taylor() {
  const [s, setS] = useLocalState<S>('errores:taylor', { f: 'exp(x)', x0: '0', n: 4, x: '1', a: '-3', b: '3', all: true, tol: '1e-6' })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)
  const calc = useMemo(() => compute(d), [d])

  const inputs = (
    <>
      <ExprField label="Función f(x)" value={s.f} onChange={(f) => set({ f })} texPrefix="f(x) =" />
      <FieldRow>
        <NumField label="Centro x₀" value={s.x0} onChange={(x0) => set({ x0 })} />
        <IntField label="Orden n" value={s.n} onChange={(n) => set({ n })} min={0} max={30} />
      </FieldRow>
      <NumField label="Evaluar en x" value={s.x} onChange={(x) => set({ x })} />
      <NumField label="Tolerancia (buscar n mínimo)" value={s.tol} onChange={(tol) => set({ tol })} />
      <FieldRow>
        <NumField label="Gráfica: a" value={s.a} onChange={(a) => set({ a })} />
        <NumField label="b" value={s.b} onChange={(b) => set({ b })} />
      </FieldRow>
      <CheckField label="Mostrar todos los órdenes P₀…Pₙ" value={s.all} onChange={(all) => set({ all })} />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.taylor} topic={TOPIC} theory={THEORY.taylor} inputs={inputs} description="Polinomio de Taylor de orden n, cota del resto de Lagrange y error de truncamiento real. Los coeficientes se calculan por diferenciación automática (exactos salvo redondeo).">
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <Results c={calc} s={d} />}
    </MethodPage>
  )
}

const NMAX = 31

function compute(s: S) {
  const f = compile(s.f)
  if (!f.ok) return { error: 'f(x): ' + f.error }
  const x0 = evalNumber(s.x0), x = evalNumber(s.x), a = evalNumber(s.a), b = evalNumber(s.b), tol = evalNumber(s.tol)
  if (![x0, x, a, b].every(Number.isFinite) || a >= b) return { error: 'Revisa x₀, x y el intervalo de la gráfica.' }
  const n = s.n
  let c: number[]
  try {
    c = taylorCoeffs(f.node, x0, NMAX)
  } catch (e: any) {
    return { error: 'No se pudo desarrollar f en x₀: ' + (e?.message ?? e) }
  }
  if (c.some((v) => !Number.isFinite(v))) return { error: 'f no es analítica en x₀ (alguna derivada no es finita).' }
  // máximo de |f^(k)(ξ)| en [x0, x] para k = 1..NMAX (muestreo)
  const lo = Math.min(x0, x), hi = Math.max(x0, x)
  const M: number[] = new Array(NMAX + 1).fill(0)
  const K = 60
  let bad = false
  for (let i = 0; i <= K; i++) {
    const xi = lo + ((hi - lo) * i) / K
    try {
      const ci = taylorCoeffs(f.node, xi, NMAX)
      for (let k = 0; k <= NMAX; k++) M[k] = Math.max(M[k], Math.abs(ci[k] * factorial(k)))
    } catch {
      bad = true
    }
  }
  const fx = f.f(x)
  const h = Math.abs(x - x0)
  const rows = Array.from({ length: Math.min(NMAX, Math.max(n, 10)) + 1 }, (_, k) => {
    const Pk = evalTaylor(c, x0, x, k)
    const bound = k + 1 <= NMAX ? (M[k + 1] / factorial(k + 1)) * h ** (k + 1) : NaN
    return { k, deriv: c[k] * factorial(k), coef: c[k], Pk, err: Math.abs(fx - Pk), bound }
  })
  const nTol = Number.isFinite(tol) && tol > 0 ? rows.find((r) => r.bound <= tol)?.k ?? null : null
  // derivadas simbólicas (sólo mientras no crezcan demasiado)
  const sym: string[] = []
  let node: MathNode = f.node
  sym.push(f.tex)
  for (let k = 1; k <= Math.min(n + 1, 8); k++) {
    try {
      node = derivative(node, 'x')
      const str = node.toString()
      if (str.length > 260) break
      sym.push(toTex(node))
    } catch {
      break
    }
  }
  let exact: ExactTaylor | null = null
  try {
    exact = exactTaylor(s.f, s.x0, n, c)
  } catch {
    exact = null
  }
  return { f, x0, x, a, b, n, c, M, fx, rows, nTol, bad, sym, tol, exact }
}

/** TeX del polinomio Σ c_k (x − x0)^k. */
function polyTex(c: number[], x0: number, n: number): string {
  const base = x0 === 0 ? 'x' : `(x ${x0 > 0 ? '-' : '+'} ${texNum(Math.abs(x0), 6)})`
  const terms: string[] = []
  for (let k = 0; k <= n; k++) {
    const v = c[k]
    if (Math.abs(v) < 1e-15) continue
    const mag = texNum(Math.abs(v), 7)
    const pw = k === 0 ? '' : k === 1 ? base : `${base}^{${k}}`
    const coefStr = k > 0 && Math.abs(Math.abs(v) - 1) < 1e-15 ? '' : mag
    terms.push(`${v < 0 ? '-' : '+'} ${coefStr}${coefStr && pw ? '\\,' : ''}${pw}`)
  }
  if (!terms.length) return '0'
  let s = terms.join(' ')
  if (s.startsWith('+ ')) s = s.slice(2)
  return s
}

function Results({ c, s }: { c: any; s: S }) {
  const f: Compiled = c.f
  const n: number = c.n
  const row = c.rows[n]
  const plots = useMemo(() => {
    const fs = sample(f.f, c.a, c.b, 500)
    const [ymin, ymax] = sampleRange(fs)
    const pad = (ymax - ymin) * 0.35 + 1e-9
    const traces: Trace[] = [{ ...fs, type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: SERIES[0], width: 3 } }]
    const orders = s.all ? Array.from({ length: n + 1 }, (_, k) => k) : [n]
    orders.forEach((k, i) => {
      const ps = sample((x) => evalTaylor(c.c, c.x0, x, k), c.a, c.b, 400)
      const last = k === n
      traces.push({ ...ps, type: 'scatter', mode: 'lines', name: `P${k}(x)`, line: { color: last ? SERIES[1] : SERIES[(i % 5) + 2], width: last ? 2.5 : 1.2, dash: last ? 'solid' : 'dot' }, opacity: last ? 1 : 0.7 })
    })
    traces.push({ x: [c.x0], y: [f.f(c.x0)], type: 'scatter', mode: 'markers', name: 'x₀', marker: { color: SERIES[5], size: 10 } })
    traces.push({ x: [c.x], y: [c.fx], type: 'scatter', mode: 'markers', name: 'x', marker: { color: SERIES[3], size: 9, symbol: 'diamond' } })
    const es = sample((x) => Math.abs(f.f(x) - evalTaylor(c.c, c.x0, x, n)), c.a, c.b, 500)
    const err: Trace[] = [{ x: es.x, y: es.y.map((v) => (v !== null && v > 0 ? v : null)), type: 'scatter', mode: 'lines', name: `|f − P${n}|`, line: { color: SERIES[6] } }]
    return { main: traces, range: [ymin - pad, ymax + pad], err }
  }, [c, s.all])

  const N = (v: number) => texNum(v, 8)
  const ex: ExactTaylor | null = c.exact
  const x0t = texNum(c.x0, 8)
  const steps = [
    { text: 'Derivadas de f:', tex: c.sym.map((t: string, k: number) => `f^{(${k})}(x) = ${t}`).join('\\\\ ') + (c.sym.length < n + 2 ? '\\\\ \\vdots' : '') },
    ex
      ? {
          text: `Evaluadas en x₀ = ${fmt(c.x0)} (valor exacto) y divididas entre k!:`,
          tex:
            '\\begin{array}{llll}' +
            ex.terms
              .slice(0, n + 1)
              .map((t, k) => {
                const sg = t.neg ? '-' : ''
                const approx = t.exact && !t.zero && !/^\d+$/.test(t.coefTex) ? `\\approx ${N(c.rows[k].coef)}` : ''
                return `f^{(${k})}(${ex.x0Tex}) = ${t.zero ? '0' : sg + t.derivTex} & \\Rightarrow & c_{${k}} = \\dfrac{${t.zero ? '0' : sg + t.derivTex}}{${k}!} = ${t.zero ? '0' : sg + t.coefTex} & ${approx}`
              })
              .join('\\\\[4pt] ') +
            '\\end{array}',
        }
      : { text: `Evaluadas en x₀ = ${fmt(c.x0)} y divididas entre k!:`, tex: '\\begin{array}{lll}' + c.rows.slice(0, n + 1).map((r: any) => `f^{(${r.k})}(${x0t}) = ${N(r.deriv)} & \\Rightarrow & c_{${r.k}} = \\frac{${N(r.deriv)}}{${r.k}!} = ${N(r.coef)}`).join('\\\\ ') + '\\end{array}' },
    ...(ex
      ? [
          { text: 'Fórmula de Taylor:', tex: generalTex(ex, n) },
          { text: 'Sustituyendo las derivadas (con factoriales):', tex: factorialTex(ex, n) },
          { text: 'Simplificando:', tex: simplifiedTex(ex, n) },
          { text: 'En decimales:', tex: `P_{${n}}(x) = ${polyTex(c.c, c.x0, n)}` },
        ]
      : [{ text: 'Polinomio de Taylor:', tex: `P_{${n}}(x) = ${polyTex(c.c, c.x0, n)}` }]),
    { text: `Evaluando en x = ${fmt(c.x)}:`, tex: `P_{${n}}(${texNum(c.x, 8)}) = ${N(row.Pk)},\\qquad f(${texNum(c.x, 8)}) = ${N(c.fx)}` },
    { text: 'Error real (de truncamiento):', tex: `|f(x) - P_{${n}}(x)| = ${texNum(row.err, 4)}` },
    {
      text: `Cota de Lagrange con M = máx |f^(${n + 1})(ξ)| en [${fmt(Math.min(c.x0, c.x))}, ${fmt(Math.max(c.x0, c.x))}]:`,
      tex: `|R_{${n}}(x)| \\le \\frac{M}{(${n + 1})!}|x - x_0|^{${n + 1}} = \\frac{${N(c.M[n + 1])}}{${factorial(n + 1)}}\\cdot ${N(Math.abs(c.x - c.x0))}^{${n + 1}} = ${texNum(row.bound, 4)}`,
    },
  ]

  return (
    <>
      <Stats
        items={[
          { label: `P${n}(x)`, value: fmt(row.Pk, 12), accent: true },
          { label: 'f(x)', value: fmt(c.fx, 12) },
          { label: 'Error real', value: row.err.toExponential(3) },
          { label: 'Cota del resto', value: Number.isFinite(row.bound) ? row.bound.toExponential(3) : '—', hint: c.nTol !== null ? `n mínimo para tol ${fmt(c.tol)}: ${c.nTol}` : `ninguno ≤ 30 cumple tol` },
        ]}
      />
      {row.err > row.bound * (1 + 1e-6) && row.bound > 0 && <Alert kind="warn">El error real supera la cota: el muestreo del máximo de f^(n+1) puede ser insuficiente o domina el error de redondeo.</Alert>}
      <Card title="Polinomio">
        {ex ? (
          <Steps
            steps={[
              { text: 'Forma general', tex: generalTex(ex, n) },
              { text: 'Con las derivadas evaluadas y los factoriales', tex: factorialTex(ex, n) },
              { text: 'Simplificada (fracciones exactas)', tex: simplifiedTex(ex, n) },
              { text: 'Decimal', tex: `P_{${n}}(x) = ${polyTex(c.c, c.x0, n)}` },
            ]}
          />
        ) : (
          <Steps steps={[{ tex: `P_{${n}}(x) = ${polyTex(c.c, c.x0, n)}` }]} />
        )}
        {ex && ex.terms.some((t) => !t.exact && !t.zero) && (
          <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>Algunos coeficientes no tienen forma cerrada sencilla y se muestran en decimal.</p>
        )}
      </Card>
      <Tabs
        tabs={[
          {
            label: 'Gráfica',
            content: (
              <Card>
                <Plot data={plots.main} layout={{ yaxis: { range: plots.range }, xaxis: { title: { text: 'x' } } }} />
              </Card>
            ),
          },
          {
            label: 'Error',
            content: (
              <Card>
                <Plot data={plots.err} layout={{ yaxis: { type: 'log', title: { text: `|f(x) − P${n}(x)|` }, exponentformat: 'power' }, xaxis: { title: { text: 'x' } } }} />
                <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                  El error se anula en x₀ y crece como |x − x₀|^(n+1). Cerca de x₀ aparece el piso del error de redondeo (~10⁻¹⁶).
                </p>
              </Card>
            ),
          },
          {
            label: 'Tabla por orden',
            content: (
              <Card>
                <DataTable
                  filename="taylor"
                  columns={[
                    { key: 'k', tex: 'k', fmt: 'int', align: 'center' },
                    { key: 'deriv', tex: 'f^{(k)}(x_0)' },
                    { key: 'coef', tex: 'c_k = f^{(k)}(x_0)/k!' },
                    { key: 'Pk', tex: 'P_k(x)' },
                    { key: 'err', tex: '|f(x)-P_k(x)|', fmt: 'err' },
                    { key: 'bound', tex: '\\text{cota } \\frac{M_{k+1}}{(k+1)!}|x-x_0|^{k+1}', fmt: 'err' },
                  ]}
                  rows={c.rows}
                  highlight={(r) => r.k === n}
                />
              </Card>
            ),
          },
          {
            label: 'Paso a paso',
            content: (
              <Card>
                <Steps steps={steps} />
              </Card>
            ),
          },
        ]}
      />
      <ScilabCode
        filename="taylor"
        code={`// Polinomio de Taylor de orden ${n} — generado por NumLab
clear; clc;
deff('y = f(x)', 'y = ${toScilab(s.f)}');
x0 = ${s.x0.replace(/\bpi\b/g, '%pi')}; n = ${n};
c = [${c.c.slice(0, n + 1).map((v: number) => v.toPrecision(17)).join(', ')}];   // c_k = f^(k)(x0)/k!
function y = P(x)
  y = zeros(x);
  for k = n:-1:0
    y = y .* (x - x0) + c(k+1);    // Horner
  end
endfunction
x = ${s.x.replace(/\bpi\b/g, '%pi')};
mprintf('P(x) = %.15f, f(x) = %.15f, error = %.3e\\n', P(x), f(x), abs(f(x) - P(x)));
t = linspace(${s.a.replace(/\bpi\b/g, '%pi')}, ${s.b.replace(/\bpi\b/g, '%pi')}, 400);
plot(t, f(t), 'b-', t, P(t), 'r--'); xgrid(); legend('f(x)', 'P_${n}(x)');
`}
      />
    </>
  )
}
