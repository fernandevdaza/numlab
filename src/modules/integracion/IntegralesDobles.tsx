import { useMemo } from 'react'
import { L } from '../../i18n'
import { compile, evalNumber, toScilab, type Compiled } from '../../lib/expr'
import { fmt, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs } from '../../components/ui'
import * as A from './algorithms'
import { Muted, N, P, refStats, sci } from './common'
import { referencia2D, type Reference } from './exact'
import { THEORY, TITLES, TOPIC } from './theory'

interface S {
  f: string
  a: string
  b: string
  c: string
  d: string
  rule: A.Rule2D
  n: number
  m: number
}

const DEF: S = { f: 'cos(x + y)', a: '0', b: 'pi', c: '0', d: 'x', rule: 'gauss', n: 2, m: 2 }

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: L('Ej. 5.7 · cos(x+y) en el triángulo, Gauss 2 × 2', 'Ex. 5.7 · cos(x+y) over the triangle, Gauss 2 × 2'), value: { f: 'cos(x + y)', a: '0', b: 'pi', c: '0', d: 'x', rule: 'gauss', n: 2, m: 2 } },
  { label: L('Práctica 6.1 · sen(x+y), n = 2, m = 3', 'Practice 6.1 · sin(x+y), n = 2, m = 3'), value: { f: 'sin(x + y)', a: '0', b: 'pi', c: '-3', d: '3', rule: 'gauss', n: 2, m: 3 } },
  { label: L('Práctica 6.2 · x³ + 4y entre y = x² e y = 2x', 'Practice 6.2 · x³ + 4y between y = x² and y = 2x'), value: { f: 'x^3 + 4y', a: '0', b: '2', c: 'x^2', d: '2x', rule: 'gauss', n: 2, m: 3 } },
  { label: L('Práctica 8 · momento de inercia del semicírculo', 'Practice 8 · moment of inertia of the semicircle'), value: { f: 'x^2 + y^2', a: '-1', b: '1', c: '0', d: 'sqrt(1 - x^2)', rule: 'gauss', n: 2, m: 1 } },
  { label: 'Burden: e^(y/x), x³ ≤ y ≤ x² (Simpson 10 × 10)', value: { f: 'exp(y/x)', a: '0.1', b: '0.5', c: 'x^3', d: 'x^2', rule: 'simpson13', n: 10, m: 10 } },
  { label: L('Burden: mismo con Gauss 5 × 5', 'Burden: same with Gauss 5 × 5'), value: { f: 'exp(y/x)', a: '0.1', b: '0.5', c: 'x^3', d: 'x^2', rule: 'gauss', n: 5, m: 5 } },
  { label: L('Área de ¼ de círculo = π/4 (trapecio)', 'Area of ¼ circle = π/4 (trapezoidal)'), value: { f: '1', a: '0', b: '1', c: '0', d: 'sqrt(1 - x^2)', rule: 'trapecio', n: 8, m: 2 } },
]

const RULES: { value: A.Rule2D; label: string }[] = [
  { value: 'gauss', label: L('Gauss-Legendre (método del texto)', 'Gauss–Legendre (textbook method)') },
  { value: 'trapecio', label: L('Trapecio compuesto en x y en y', 'Composite trapezoidal in x and in y') },
  { value: 'simpson13', label: L('Simpson 1/3 compuesto (subintervalos pares)', 'Composite Simpson 1/3 (even subintervals)') },
  { value: 'simpson38', label: L('Simpson 3/8 compuesto (múltiplos de 3)', 'Composite Simpson 3/8 (multiples of 3)') },
]

export function IntegralesDobles() {
  const [raw, setS] = useLocalState<S>('integracion:integrales-dobles:v2', DEF)
  const s: S = { ...DEF, ...raw }
  const set = (p: Partial<S>) => setS((v) => ({ ...DEF, ...v, ...p }))
  const d = useDebounced(s, 300)
  const c = useMemo(() => compute(d), [d])
  const g = s.rule === 'gauss'

  const inputs = (
    <>
      <ExprField label={L('Integrando f(x, y)', 'Integrand f(x, y)')} value={s.f} onChange={(f) => set({ f })} vars={['x', 'y']} texPrefix="f(x,y) =" />
      <FieldRow>
        <NumField label={L('a (x mín)', 'a (x min)')} value={s.a} onChange={(a) => set({ a })} />
        <NumField label={L('b (x máx)', 'b (x max)')} value={s.b} onChange={(b) => set({ b })} />
      </FieldRow>
      <FieldRow>
        <ExprField label={L('φ₁(x) (y inferior)', 'φ₁(x) (lower y)')} value={s.c} onChange={(c) => set({ c })} texPrefix={'\\phi_1(x) ='} />
        <ExprField label={L('φ₂(x) (y superior)', 'φ₂(x) (upper y)')} value={s.d} onChange={(d) => set({ d })} texPrefix={'\\phi_2(x) ='} />
      </FieldRow>
      <span className="field-hint">{L('Para un rectángulo escribe constantes en φ₁(x) y φ₂(x).', 'For a rectangle, enter constants for φ₁(x) and φ₂(x).')}</span>
      <SelectField label={L('Método', 'Method')} value={s.rule} onChange={(rule) => set({ rule })} options={RULES} />
      <FieldRow>
        <IntField label={g ? L('Orden n (exterior, en x)', 'Order n (outer, in x)') : L('Subintervalos en x', 'Subintervals in x')} value={s.n} onChange={(n) => set({ n })} min={1} max={g ? 10 : 200} />
        <IntField label={g ? L('Orden m (interior, en y)', 'Order m (inner, in y)') : L('Subintervalos en y', 'Subintervals in y')} value={s.m} onChange={(m) => set({ m })} min={1} max={g ? 10 : 200} />
      </FieldRow>
      {g && <span className="field-hint">{L('El texto recomienda un orden mayor para la integral interior.', 'The textbook recommends a higher order for the inner integral.')}</span>}
      <div className="field">
        <span className="field-preview">
          <Tex>{'\\iint_D f\\,dx\\,dy = \\int_a^b\\Big[\\int_{\\phi_1(x)}^{\\phi_2(x)} f(x,y)\\,dy\\Big]dx'}</Tex>
        </span>
      </div>
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES['integrales-dobles']} topic={TOPIC} theory={THEORY['integrales-dobles']} inputs={inputs}>
      {'error' in c ? <Alert kind="error">{c.error}</Alert> : <Results s={d} c={c} />}
    </MethodPage>
  )
}

interface Calc {
  f: Compiled
  cf: Compiled
  df: Compiled
  a: number
  b: number
  res: A.DoubleResult
  ref: Reference
}

function compute(s: S): Calc | { error: string } {
  const f = compile(s.f, ['x', 'y'])
  if (!f.ok) return { error: 'f(x, y): ' + f.error }
  const cf = compile(s.c, ['x'])
  if (!cf.ok) return { error: 'φ₁(x): ' + cf.error }
  const df = compile(s.d, ['x'])
  if (!df.ok) return { error: 'φ₂(x): ' + df.error }
  const a = evalNumber(s.a)
  const b = evalNumber(s.b)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: L('Límites a, b inválidos.', 'Invalid limits a, b.') }
  if (a === b) return { error: L('a y b deben ser distintos.', 'a and b must be different.') }
  if (s.rule !== 'gauss') {
    const e1 = A.ncValidN(s.n, s.rule)
    if (e1) return { error: L('Dirección x: ', 'Direction x: ') + e1 }
    const e2 = A.ncValidN(s.m, s.rule)
    if (e2) return { error: L('Dirección y: ', 'Direction y: ') + e2.replace(/\bn\b/g, 'm') }
  }
  const res = A.integralDoble(f.f, a, b, cf.f, df.f, s.rule, s.n, s.m)
  for (const r of res.rows) {
    if (!Number.isFinite(r.c) || !Number.isFinite(r.d)) return { error: L(`Los límites φ₁(x), φ₂(x) no están definidos en x = ${fmt(r.x)}.`, `The limits φ₁(x), φ₂(x) are not defined at x = ${fmt(r.x)}.`) }
    const j = r.fs.findIndex((v) => !Number.isFinite(v))
    if (j >= 0) return {
        error: L(
          `f no está definida en (x, y) = (${fmt(r.x)}, ${fmt(r.ys[j])}): hay una singularidad en la región.`,
          `f is not defined at (x, y) = (${fmt(r.x)}, ${fmt(r.ys[j])}): there is a singularity in the region.`,
        ),
      }
  }
  return { f, cf, df, a, b, res, ref: referencia2D(s.f, s.c, s.d, f.f, a, b, cf.f, df.f) }
}

function Results({ s, c }: { s: S; c: Calc }) {
  const { res } = c
  const g = s.rule === 'gauss'
  const label = RULES.find((r) => r.value === s.rule)!.label
  return (
    <>
      <Stats
        items={[
          {
            label: L('Integral doble aproximada', 'Approximate double integral'),
            value: fmt(res.value, 14),
            accent: true,
            hint: `${label.split(' (')[0]} · ${res.evals} ${L('evaluaciones de f', 'evaluations of f')}`,
          },
          ...refStats(res.value, c.ref),
        ]}
      />
      <Alert kind={c.ref.kind === 'ninguno' ? 'warn' : 'info'}>
        <b>{c.ref.label}.</b>
        {g
          ? L(
              ` Gauss-Legendre de orden n = ${s.n} en x y m = ${s.m} en y: ${s.n * s.m} evaluaciones de f.`,
              ` Gauss–Legendre of order n = ${s.n} in x and m = ${s.m} in y: ${s.n * s.m} evaluations of f.`,
            )
          : L(
              ` Malla de (${s.n}+1) × (${s.m}+1) = ${(s.n + 1) * (s.m + 1)} nodos; paso en x H = ${fmt(res.h)}.`,
              ` Grid of (${s.n}+1) × (${s.m}+1) = ${(s.n + 1) * (s.m + 1)} nodes; step size in x H = ${fmt(res.h)}.`,
            )}
      </Alert>
      <Tabs
        tabs={[
          { label: L('Superficie 3D', '3D surface'), content: <Card><Surface c={c} /></Card> },
          { label: L('Región y nodos', 'Region and nodes'), content: <Card><Region c={c} /></Card> },
          { label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={g ? stepsGauss(s, c) : stepsNC(s, c)} /></Card> },
        ]}
      />
      <Card title={L('Integrales interiores h(xᵢ) = ∫ f(xᵢ, y) dy', 'Inner integrals h(xᵢ) = ∫ f(xᵢ, y) dy')}>
        <DataTable
          filename="integral_doble"
          columns={[
            { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
            { key: 'x', tex: 'x_i' },
            { key: 'c', tex: '\\phi_1(x_i)' },
            { key: 'd', tex: '\\phi_2(x_i)' },
            { key: 'k', tex: g ? '\\frac{\\phi_2-\\phi_1}{2}' : 'K_i = \\frac{\\phi_2-\\phi_1}{m}' },
            { key: 'g', tex: 'h(x_i)' },
            { key: 'w', tex: g ? 'w_{n,i}' : 'c_i', get: (r) => (g ? fmt(r.w, 10) : String(r.w)) },
          ]}
          rows={res.rows.map((r) => ({ ...r, i: g ? r.i + 1 : r.i }))}
        />
      </Card>
      <ScilabCode code={scilab(s)} filename="integral_doble" />
    </>
  )
}

function Surface({ c }: { c: Calc }) {
  const data = useMemo(() => {
    const K = 40
    const X: number[][] = [], Y: number[][] = [], Z: (number | null)[][] = []
    for (let i = 0; i < K; i++) {
      const rx: number[] = [], ry: number[] = [], rz: (number | null)[] = []
      for (let j = 0; j < K; j++) {
        const x = c.a + ((c.b - c.a) * j) / (K - 1)
        const lo = c.cf.f(x), hi = c.df.f(x)
        const y = lo + ((hi - lo) * i) / (K - 1)
        let z: number | null = c.f.f(x, y)
        if (!Number.isFinite(z)) z = null
        rx.push(x)
        ry.push(y)
        rz.push(z)
      }
      X.push(rx)
      Y.push(ry)
      Z.push(rz)
    }
    const nx: number[] = [], ny: number[] = [], nz: number[] = []
    c.res.rows.forEach((r) => r.ys.forEach((y, j) => (nx.push(r.x), ny.push(y), nz.push(r.fs[j]))))
    return [
      { type: 'surface', x: X, y: Y, z: Z, colorscale: 'Viridis', opacity: 0.9, showscale: false, name: 'f(x,y)', contours: { z: { show: true, usecolormap: true, project: { z: true } } } },
      { type: 'scatter3d', mode: 'markers', x: nx, y: ny, z: nz, name: L('nodos', 'nodes'), marker: { size: 3.5, color: SERIES[3] } },
    ] as Trace[]
  }, [c])
  return (
    <>
      <Plot data={data} height={460} layout={{ scene: { aspectmode: 'cube', camera: { eye: { x: 1.6, y: -1.6, z: 1.1 } } }, margin: { l: 0, r: 0, t: 10, b: 10 } }} />
      <Muted>
        {L(
          'La integral doble es el volumen (con signo) bajo la superficie z = f(x, y) sobre la región. Los puntos son los nodos donde se evalúa f.',
          'The double integral is the (signed) volume under the surface z = f(x, y) over the region. The points are the nodes where f is evaluated.',
        )}
      </Muted>
    </>
  )
}

function Region({ c }: { c: Calc }) {
  const data = useMemo(() => {
    const K = 200
    const xs = Array.from({ length: K }, (_, i) => c.a + ((c.b - c.a) * i) / (K - 1))
    const lo = xs.map((x) => c.cf.f(x))
    const hi = xs.map((x) => c.df.f(x))
    const nx: number[] = [], ny: number[] = []
    c.res.rows.forEach((r) => r.ys.forEach((y) => (nx.push(r.x), ny.push(y))))
    const tr: Trace[] = [
      { x: [...xs, ...xs.slice().reverse()], y: [...lo, ...hi.slice().reverse()], type: 'scatter', mode: 'lines', fill: 'toself', fillcolor: 'rgba(45,212,191,0.15)', line: { color: SERIES[0], width: 1.5 }, name: L('región R', 'region R') },
      { x: xs, y: lo, type: 'scatter', mode: 'lines', name: 'y = φ₁(x)', line: { color: SERIES[1], width: 2 } },
      { x: xs, y: hi, type: 'scatter', mode: 'lines', name: 'y = φ₂(x)', line: { color: SERIES[2], width: 2 } },
    ]
    c.res.rows.forEach((r, i) => tr.push({ x: [r.x, r.x], y: [r.c, r.d], type: 'scatter', mode: 'lines', line: { color: SERIES[4], width: 1, dash: 'dot' }, showlegend: i === 0, name: L('rectas x = xᵢ', 'lines x = xᵢ'), legendgroup: 'v' }))
    tr.push({ x: nx, y: ny, type: 'scatter', mode: 'markers', name: L('nodos (xᵢ, yᵢⱼ)', 'nodes (xᵢ, yᵢⱼ)'), marker: { color: SERIES[3], size: 6 } })
    return tr
  }, [c])
  return <Plot data={data} layout={{ xaxis: { title: { text: 'x' } }, yaxis: { title: { text: 'y' } } }} />
}

function stepsNC(s: S, c: Calc) {
  const def = A.NC[s.rule as A.NCRule]
  const { res } = c
  const out: { text?: string; tex?: string }[] = []
  const fac = (h: string) => (def.num === 1 ? `\\frac{${h}}{${def.den}}` : `\\frac{${def.num}\\,${h}}{${def.den}}`)
  out.push({
    text: L(
      `Método general (5.41): primero las integrales interiores h(xᵢ) con ${def.label} y luego la exterior. Paso en x:`,
      `General method (5.41): first the inner integrals h(xᵢ) with ${def.label}, then the outer one. Step size in x:`,
    ), tex: `H = \\frac{b-a}{${s.n}} = \\frac{${N(c.b)} - ${P(c.a)}}{${s.n}} = ${N(res.h)}`,
  })
  const show = res.rows.length <= 3 ? res.rows : [res.rows[0], res.rows[1], res.rows[res.rows.length - 1]]
  show.forEach((r) => {
    const vals = r.fs.map((v, j) => `${r.wy[j] === 1 ? '' : r.wy[j]}(${N(v, 7)})`)
    const sh = vals.length > 7 ? [...vals.slice(0, 3), '\\cdots', ...vals.slice(-2)] : vals
    out.push({
      text: `${L('Nodo', 'Node')} i = ${r.i}, x = ${fmt(r.x)}: y ∈ [φ₁, φ₂] = [${fmt(r.c, 6)}, ${fmt(r.d, 6)}]`,
      tex: `K_{${r.i}} = \\frac{${N(r.d)} - ${P(r.c)}}{${s.m}} = ${N(r.k)},\\qquad h(x_{${r.i}}) \\approx ${fac('K_{' + r.i + '}')}\\Big[${sh.join(' + ')}\\Big] = ${N(r.g, 12)}`,
    })
  })
  if (res.rows.length > 3) out.push({ text: L(`… se repite para los ${res.rows.length} nodos xᵢ (ver tabla).`, `… repeated for all ${res.rows.length} nodes xᵢ (see table).`) })
  const outer = res.rows.map((r) => `${r.w === 1 ? '' : r.w}(${N(r.g, 8)})`)
  const osh = outer.length > 7 ? [...outer.slice(0, 3), '\\cdots', ...outer.slice(-2)] : outer
  out.push({ text: L('Regla exterior en x con los valores h(xᵢ):', 'Outer rule in x with the values h(xᵢ):'), tex: `I \\approx ${fac(N(res.h))}\\Big[${osh.join(' + ')}\\Big] = ${N(res.value, 14)}` })
  if (Number.isFinite(c.ref.value)) out.push({ text: L('Error respecto al valor de referencia:', 'Error with respect to the reference value:'), tex: `|I - I_{\\text{${L('aprox', 'approx')}}}| = ${texNum(Math.abs(c.ref.value - res.value), 4)}` })
  return out
}

function stepsGauss(s: S, c: Calc) {
  const { res } = c
  const gx = A.gaussLegendre(s.n)
  const gy = A.gaussLegendre(s.m)
  const half = (c.b - c.a) / 2
  const mid = (c.a + c.b) / 2
  const out: { text?: string; tex?: string }[] = []
  const list = (v: number[]) => v.map((t) => N(t, 8)).join(',\\,')
  out.push({ text: L(`Nodos y pesos de orden n = ${s.n} (integral exterior):`, `Nodes and weights of order n = ${s.n} (outer integral):`), tex: `z_{${s.n},i} = (${list(gx.t)}),\\quad w_{${s.n},i} = (${list(gx.w)})` })
  if (s.m === s.n) out.push({ text: L('En la integral interior se usan los mismos nodos y pesos (m = n).', 'The inner integral uses the same nodes and weights (m = n).') })
  else out.push({ text: L(`Nodos y pesos de orden m = ${s.m} (integral interior):`, `Nodes and weights of order m = ${s.m} (inner integral):`), tex: `z_{${s.m},j} = (${list(gy.t)}),\\quad w_{${s.m},j} = (${list(gy.w)})` })
  out.push({
    text: L('Integral exterior (5.42): cambio de variable en x', 'Outer integral (5.42): change of variable in x'),
    tex: `\\int_a^b h(x)\\,dx \\approx \\sum_i w_{${s.n},i}H(z_{${s.n},i}),\\quad H(z) = \\frac{b-a}{2}h\\Big(\\frac{b-a}{2}z + \\frac{b+a}{2}\\Big) = ${N(half)}\\,h(${N(half)}\\,z ${mid < 0 ? '-' : '+'} ${N(Math.abs(mid))})`,
  })
  out.push({ text: L('Nodos en x:', 'Nodes in x:'), tex: res.rows.map((r) => `x_{${r.i + 1}} = ${N(half)}(${N(gx.t[r.i], 8)}) ${mid < 0 ? '-' : '+'} ${N(Math.abs(mid))} = ${N(r.x, 8)}`).join(',\\quad ') })
  res.rows.slice(0, 3).forEach((r) => {
    const cy = (r.c + r.d) / 2
    const terms = r.fs.map((v, j) => `(${N(r.wy[j], 7)})(${N(r.k, 7)}\\cdot ${N(v, 7)})`)
    out.push({
      text: `${L('Integral interior en', 'Inner integral at')} x = ${fmt(r.x)}: y ∈ [φ₁, φ₂] = [${fmt(r.c, 6)}, ${fmt(r.d, 6)}], F_x(z) = ${fmt(r.k, 8)}·f(x, ${fmt(r.k, 8)} z ${cy < 0 ? '−' : '+'} ${fmt(Math.abs(cy), 8)})`,
      tex: `h(x_{${r.i + 1}}) \\approx \\sum_j w_{${s.m},j}F_x(z_{${s.m},j}) = ${terms.join(' + ')} = ${N(r.g, 12)}`,
    })
  })
  if (res.rows.length > 3) out.push({ text: L(`… igual para los ${res.rows.length} nodos xᵢ (ver tabla).`, `… likewise for all ${res.rows.length} nodes xᵢ (see table).`) })
  out.push({
    text: L('Integral exterior:', 'Outer integral:'),
    tex: `I \\approx \\sum_i w_{${s.n},i}H(z_{${s.n},i}) = ${res.rows.map((r) => `(${N(r.w, 7)})(${N(half, 7)}\\cdot ${N(r.g, 8)})`).join(' + ')} = ${N(res.value, 14)}`,
  })
  if (Number.isFinite(c.ref.value)) {
    const e = Math.abs(c.ref.value - res.value)
    out.push({ text: L('Error exacto y relativo:', 'Exact and relative error:'), tex: `|${N(c.ref.value, 12)} - ${P(res.value, 12)}| = ${texNum(e, 4)}${c.ref.value !== 0 ? `\\;\\;(${texNum((100 * e) / Math.abs(c.ref.value), 3)}\\,\\%)` : ''}` })
  }
  return out
}

function scilab(s: S): string {
  const head = `// ${L('Integral doble', 'Double integral')}: int_a^b [ int_phi1(x)^phi2(x) f(x,y) dy ] dx — ${L('generado por NumLab', 'generated by NumLab')}
clear; clc;
function z = f(x, y)
  z = (${toScilab(s.f, true)}) + 0*x + 0*y;
endfunction
function y = phi1(x)   // ${L('limite inferior en y', 'lower limit in y')}
  y = (${toScilab(s.c, true)}) + 0*x;
endfunction
function y = phi2(x)   // ${L('limite superior en y', 'upper limit in y')}
  y = (${toScilab(s.d, true)}) + 0*x;
endfunction

a = ${sci(s.a)}; b = ${sci(s.b)};
`
  if (s.rule === 'gauss')
    return `${head}n = ${s.n}; m = ${s.m};      // ${L('orden exterior (x) e interior (y)', 'outer (x) and inner (y) order')}
function [p, dp] = legendre(n, z)   // ${L("P_n(z) y P_n'(z) con la recurrencia (5.38)", "P_n(z) and P_n'(z) from the recurrence (5.38)")}
  p0 = ones(z); p = z;
  for k = 2:n
    p2 = ((2*k - 1)*z.*p - (k - 1)*p0)/k;
    p0 = p; p = p2;
  end
  dp = n*(z.*p - p0)./(z.^2 - 1);
endfunction
function [z, w] = gauss_legendre(n)   // ${L('nodos (Newton) y pesos (5.39)', 'nodes (Newton) and weights (5.39)')}
  z = cos(%pi*((n:-1:1) - 0.25)/(n + 0.5));
  for it = 1:50
    [p, dp] = legendre(n, z);
    z = z - p./dp;
  end
  [p, dp] = legendre(n, z);
  [p1, dp1] = legendre(n + 1, z);
  w = -2 ./ ((n + 1)*dp.*p1);
endfunction

[zx, wx] = gauss_legendre(n);
[zy, wy] = gauss_legendre(m);
x = (b - a)/2*zx + (b + a)/2;
h = zeros(1, n);
for i = 1:n                                   // ${L('integrales interiores h(x_i)', 'inner integrals h(x_i)')}
  c = phi1(x(i)); d = phi2(x(i));
  y = (d - c)/2*zy + (d + c)/2;
  Fx = (d - c)/2*f(x(i)*ones(y), y);          // F_x(z) ${L('de', 'from')} (5.42)
  h(i) = sum(wy .* Fx);
  mprintf('x = %12.8f   h(x) = %.12f\\n', x(i), h(i));
end
I = sum(wx .* ((b - a)/2*h));                  // sum w H(z)
mprintf('\\n${L('Integral doble (Gauss %d x %d)', 'Double integral (Gauss %d x %d)')} = %.15f\\n', n, m, I);
`
  const def = A.NC[s.rule]
  return `${head}n = ${s.n}; m = ${s.m};      // ${L('subintervalos en x y en y', 'subintervals in x and in y')}
W = [${def.w.join(' ')}]; p = ${def.m}; FAC = ${def.num}/${def.den};   // ${def.label}
function cc = coefs(N, p, W)
  cc = zeros(1, N + 1);
  for q = 1:p:N
    cc(q:q+p) = cc(q:q+p) + W;
  end
endfunction

cx = coefs(n, p, W);
cy = coefs(m, p, W);
H = (b - a)/n;
x = linspace(a, b, n + 1);
h = zeros(1, n + 1);
for i = 1:n+1                                 // ${L('integrales interiores h(x_i)', 'inner integrals h(x_i)')}
  K = (phi2(x(i)) - phi1(x(i)))/m;
  y = linspace(phi1(x(i)), phi2(x(i)), m + 1);
  h(i) = FAC*K*sum(cy .* f(x(i)*ones(y), y));
  mprintf('x = %12.8f   K = %10.6f   h(x) = %.12f\\n', x(i), K, h(i));
end
I = FAC*H*sum(cx .* h);
mprintf('\\n${L('Integral doble', 'Double integral')} = %.15f\\n', I);

// ${L('Superficie', 'Surface')}
xx = linspace(a, b, 30); ss = linspace(0, 1, 30);
[S, X] = meshgrid(ss, xx);
Y = phi1(X) + (phi2(X) - phi1(X)).*S;
scf(0); clf(); surf(X, Y, f(X, Y)); xtitle('${L('f(x,y) sobre la region', 'f(x,y) over the region')}', 'x', 'y', 'z');
`
}
