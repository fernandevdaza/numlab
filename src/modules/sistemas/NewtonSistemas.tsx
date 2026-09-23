import { useMemo } from 'react'
import { compile, derivative, evalNumber, math, toScilab, type Compiled } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { useTheme } from '../../components/theme'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, Stats, Steps, Tabs, VectorField, type Column } from '../../components/ui'
import * as A from './algorithms'
import { N, Note, readVec, sciVec, texM, TOPIC, vecText } from './shared'
import { THEORY, TITLES } from './theory'

const VARS = ['x', 'y', 'z', 'w']

interface S {
  n: number
  eqs: string[]
  x0: string
  tol: string
  maxIter: number
  xmin: string
  xmax: string
  ymin: string
  ymax: string
}

const EJ36 = { n: 2, eqs: ['x^2 - y - 0.2', 'y^2 - x - 0.3', '', ''], tol: '1e-6' }
const P61 = { n: 2, eqs: ['4x^2 - y^2 - 1', 'x^2 - 2x + y^2 - 4y - 3', '', ''], tol: '1e-6' }

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: 'Ej. 3.6 desde (−0.3, −0.1)', value: { ...EJ36, x0: '-0.3 -0.1' } },
  { label: 'Ej. 3.6 desde (1.2, 1.2)', value: { ...EJ36, x0: '1.2 1.2' } },
  { label: 'Ej. 3.5: x² + y² = 2, xy = 1 (tangentes)', value: { n: 2, eqs: ['x^2 + y^2 - 2', 'x*y - 1', '', ''], x0: '1.5 0.8', tol: '1e-8' } },
  { label: 'Práct. 6.1 desde (0.5, −0.8)', value: { ...P61, x0: '0.5 -0.8' } },
  { label: 'Práct. 6.1 desde (−1.7, 3)', value: { ...P61, x0: '-1.7 3' } },
  { label: 'Burden 10.2 (1,1)', value: { n: 2, eqs: ['x^2 - 10x + y^2 + 8', 'x*y^2 + x - 10y + 8', '', ''], x0: '0 0', tol: '1e-10' } },
  { label: 'Burden 3×3', value: { n: 3, eqs: ['3x - cos(y*z) - 1/2', 'x^2 - 81(y + 0.1)^2 + sin(z) + 1.06', 'exp(-x*y) + 20z + (10pi - 3)/3', ''], x0: '0.1 0.1 -0.1', tol: '1e-10' } },
  { label: 'J singular en x⁽⁰⁾', value: { n: 2, eqs: ['x^2 + y^2 - 4', 'x*y - 1', '', ''], x0: '0 0', tol: '1e-10' } },
]

export function NewtonSistemas() {
  const [s, setS] = useLocalState<S>('sistemas:newton-sistemas:v2', { ...EJ36, x0: '-0.3 -0.1', maxIter: 30, xmin: '', xmax: '', ymin: '', ymax: '' })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const setEq = (i: number, e: string) => setS((v) => ({ ...v, eqs: v.eqs.map((q, k) => (k === i ? e : q)) }))
  const d = useDebounced(s, 300)
  const { digits } = useTheme()
  const vars = VARS.slice(0, s.n)

  const calc = useMemo(() => {
    const n = d.n
    const vs = VARS.slice(0, n)
    const F: Compiled[] = []
    for (let i = 0; i < n; i++) {
      const c = compile(d.eqs[i] ?? '', vs)
      if (!c.ok) return { error: `f${i + 1}: ${c.error}` }
      F.push(c)
    }
    const J: Compiled[][] = []
    for (let i = 0; i < n; i++) {
      const row: Compiled[] = []
      for (let j = 0; j < n; j++) {
        let node
        try {
          node = derivative(F[i].node, vs[j])
        } catch (e: any) {
          return { error: `No se pudo derivar f${i + 1} respecto de ${vs[j]}: ${e?.message ?? e}` }
        }
        const c = compile(node.toString(), vs)
        if (!c.ok) return { error: `∂f${i + 1}/∂${vs[j]}: ${c.error}` }
        row.push(c)
      }
      J.push(row)
    }
    const x0 = readVec(d.x0, n, 'x⁽⁰⁾')
    if (typeof x0 === 'string') return { error: x0 }
    const tol = evalNumber(d.tol)
    if (!(tol > 0)) return { error: 'La tolerancia debe ser un número positivo.' }
    const res = A.newtonSistema(
      F.map((f) => f.f),
      J.map((r) => r.map((f) => f.f)),
      x0,
      { tol, maxIter: d.maxIter },
    )
    return { n, vs, F, J, x0, tol, res }
  }, [d])

  const inputs = (
    <>
      <IntField label="Número de ecuaciones n" value={s.n} onChange={(n) => set({ n })} min={2} max={4} hint={`Variables: ${vars.join(', ')}`} />
      {vars.map((_, i) => (
        <ExprField key={i} label={`f${i + 1}(${vars.join(', ')}) = 0`} value={s.eqs[i] ?? ''} onChange={(e) => setEq(i, e)} vars={vars} texPrefix={`f_{${i + 1}} =`} />
      ))}
      <VectorField label={<>Valor inicial <Tex>{'\\mathbf{x}^{(0)}'}</Tex> ({vars.join(', ')})</>} value={s.x0} onChange={(x0) => set({ x0 })} />
      <FieldRow>
        <NumField label="Precisión eps" value={s.tol} onChange={(tol) => set({ tol })} />
        <IntField label="Máx. iteraciones" value={s.maxIter} onChange={(maxIter) => set({ maxIter })} min={1} max={500} />
      </FieldRow>
      {s.n === 2 && (
        <>
          <FieldRow>
            <NumField label="Gráfica: x mín" value={s.xmin} onChange={(xmin) => set({ xmin })} placeholder="auto" />
            <NumField label="x máx" value={s.xmax} onChange={(xmax) => set({ xmax })} placeholder="auto" />
          </FieldRow>
          <FieldRow>
            <NumField label="y mín" value={s.ymin} onChange={(ymin) => set({ ymin })} placeholder="auto" />
            <NumField label="y máx" value={s.ymax} onChange={(ymax) => set({ ymax })} placeholder="auto" />
          </FieldRow>
        </>
      )}
      <Examples items={EXAMPLES} onPick={(v) => set({ ...v, xmin: '', xmax: '', ymin: '', ymax: '' })} />
    </>
  )

  return (
    <MethodPage title={TITLES['newton-sistemas']} topic={TOPIC} theory={THEORY['newton-sistemas']} inputs={inputs}>
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <NewtonResults c={calc} s={d} digits={digits} />}
    </MethodPage>
  )
}

interface Calc {
  n: number
  vs: string[]
  F: Compiled[]
  J: Compiled[][]
  x0: A.Vec
  tol: number
  res: A.NewtonResult
}

function NewtonResults({ c, s, digits }: { c: Calc; s: S; digits: number }) {
  const { res, n, vs } = c
  const Fx = c.F.map((f) => f.f(...res.x))
  const Jx = c.J.map((r) => r.map((f) => f.f(...res.x)))
  const detJ = Jx.every((r) => r.every(Number.isFinite)) ? A.det(Jx) : NaN
  const cols: Column<any>[] = [
    { key: 'k', tex: 'k', fmt: 'int', align: 'center' },
    ...vs.map((v, i) => ({ key: 'x' + i, tex: `${v}^{(k)}` })),
    ...vs.map((_, i) => ({ key: 'f' + i, tex: `f_{${i + 1}}(\\mathbf{x}^{(k)})`, fmt: 'err' as const })),
    { key: 'err', tex: '\\|\\Delta\\mathbf{x}^{(k)}\\|_\\infty', get: (r: any) => (Number.isFinite(r.err) ? fmtErr(r.err) : '—') },
  ]
  const rows = res.rows.map((r) => ({ k: r.k, err: r.err, ...Object.fromEntries(r.x.map((v, i) => ['x' + i, v])), ...Object.fromEntries(r.F.map((v, i) => ['f' + i, v])) }))
  rows.push({ k: res.rows.length, err: NaN, ...Object.fromEntries(res.x.map((v, i) => ['x' + i, v])), ...Object.fromEntries(Fx.map((v, i) => ['f' + i, v])) } as any)
  const tabs = [
    ...(n === 2 ? [{ label: 'Gráfica', content: <Card><ContourPlot c={c} s={s} /></Card> }] : []),
    { label: 'Paso a paso', content: <Card><Steps steps={newtonSteps(c)} /></Card> },
    { label: 'Convergencia', content: <Card><ConvPlot res={res} /></Card> },
  ]
  return (
    <>
      <Stats
        items={[
          { label: `Solución (${vs.join(', ')})`, value: vecText(res.x, Math.min(digits, 10)), accent: true },
          { label: 'Iteraciones', value: res.rows.length, hint: res.converged ? 'convergió' : 'no convergió' },
          { label: '‖F(x*)‖∞', value: fmtErr(A.normInf(Fx)) },
          { label: 'det J(x*)', value: fmt(detJ, 6), hint: Math.abs(detJ) < 1e-8 ? 'J casi singular: convergencia lenta' : 'J no singular ⇒ convergencia cuadrática' },
        ]}
      />
      <Alert kind={res.converged ? 'ok' : 'warn'}>{res.message}</Alert>
      <Card title="Jacobiano simbólico">
        <Tex block>{`J(${vs.join(',')}) = \\begin{bmatrix}${c.J.map((r) => r.map((f) => f.tex).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`}</Tex>
      </Card>
      <Tabs tabs={tabs} />
      <Card title="Tabla de iteraciones">
        <DataTable columns={cols} rows={rows} highlightLast={res.converged} filename="newton_sistemas" />
      </Card>
      <ScilabCode code={scilabNewton(c, s)} filename="newton_sistemas" />
    </>
  )
}

function newtonSteps(c: Calc): { text?: string; tex?: string }[] {
  const { vs, res } = c
  const out: { text?: string; tex?: string }[] = []
  out.push({ text: 'Sistema F(x) = 0:', tex: '\\begin{cases}' + c.F.map((f, i) => `f_{${i + 1}} = ${f.tex} = 0`).join(' \\\\ ') + '\\end{cases}' })
  out.push({ text: 'Derivadas parciales (matriz Jacobiana Jᵢⱼ = ∂fᵢ/∂xⱼ):', tex: '\\begin{aligned}' + c.J.flatMap((r, i) => r.map((f, j) => `\\frac{\\partial f_{${i + 1}}}{\\partial ${vs[j]}} &= ${f.tex}`)).join(' \\\\ ') + '\\end{aligned}' })
  res.rows.slice(0, 3).forEach((r) => {
    const k = r.k
    out.push({
      text: `Iteración ${k + 1}: evaluamos en x⁽${k}⁾ = (${r.x.map((v) => fmt(v, 8)).join(', ')})`,
      tex: `F(\\mathbf{x}^{(${k})}) = ${texM(r.F)},\\qquad J(\\mathbf{x}^{(${k})}) = ${texM(r.J)}`,
    })
    out.push({
      text: 'Resolvemos el sistema lineal J Δx = −F (Gauss con pivoteo; no se calcula J⁻¹):',
      tex: `${texM(r.J)}\\,\\Delta\\mathbf{x} = ${texM(r.F.map((v) => -v))}\\;\\Rightarrow\\;\\Delta\\mathbf{x}^{(${k})} = ${texM(r.dx)}`,
    })
    out.push({
      tex: `\\mathbf{x}^{(${k + 1})} = \\mathbf{x}^{(${k})} + \\Delta\\mathbf{x}^{(${k})} = ${texM(r.x)} + ${texM(r.dx)} = ${texM(r.xn)},\\qquad \\|\\Delta\\mathbf{x}\\|_\\infty = ${N(r.err)}`,
    })
  })
  if (res.rows.length > 3) out.push({ text: `… hasta la iteración ${res.rows.length} (ver tabla).` })
  if (!res.converged) out.push({ text: '⚠ ' + res.message })
  return out
}

function ConvPlot({ res }: { res: A.NewtonResult }) {
  const data: Trace[] = [
    { x: res.rows.map((r) => r.k + 1), y: res.rows.map((r) => (r.err > 0 ? r.err : null)), type: 'scatter', mode: 'lines+markers', name: '‖Δx⁽ᵏ⁾‖∞', line: { color: SERIES[0], width: 2.5 } },
    { x: res.rows.map((r) => r.k), y: res.rows.map((r) => (r.normF > 0 ? r.normF : null)), type: 'scatter', mode: 'lines+markers', name: '‖F(x⁽ᵏ⁾)‖∞', line: { color: SERIES[1], dash: 'dot' } },
  ]
  return (
    <>
      <Plot data={data} layout={{ yaxis: { type: 'log', title: { text: 'escala log' }, exponentformat: 'power' }, xaxis: { title: { text: 'k' }, dtick: 1 } }} />
      <Note>Convergencia cuadrática: cerca de la solución, el número de cifras correctas se duplica en cada paso (la curva cae cada vez más rápido). Si J es singular en la solución (curvas tangentes, Ej. 3.5) la convergencia es sólo lineal.</Note>
    </>
  )
}

function ContourPlot({ c, s }: { c: Calc; s: S }) {
  const data = useMemo(() => {
    const pts = c.res.iterates.filter((p) => p.every(Number.isFinite) && Math.abs(p[0]) < 1e4 && Math.abs(p[1]) < 1e4)
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    let [x0, x1] = [Math.min(...xs), Math.max(...xs)]
    let [y0, y1] = [Math.min(...ys), Math.max(...ys)]
    const span = Math.max(x1 - x0, y1 - y0, 2)
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    x0 = cx - span * 0.8; x1 = cx + span * 0.8
    y0 = cy - span * 0.8; y1 = cy + span * 0.8
    const ux = (v: string, def: number) => (Number.isFinite(evalNumber(v)) && v.trim() ? evalNumber(v) : def)
    x0 = ux(s.xmin, x0); x1 = ux(s.xmax, x1); y0 = ux(s.ymin, y0); y1 = ux(s.ymax, y1)
    const K = 160
    const gx = Array.from({ length: K }, (_, i) => x0 + ((x1 - x0) * i) / (K - 1))
    const gy = Array.from({ length: K }, (_, i) => y0 + ((y1 - y0) * i) / (K - 1))
    const traces: Trace[] = c.F.map((f, i) => {
      const z = gy.map((y) => gx.map((x) => {
        const v = f.f(x, y)
        return Number.isFinite(v) ? v : null
      }))
      const col = SERIES[i]
      return { type: 'contour', x: gx, y: gy, z, contours: { start: 0, end: 0, size: 1, coloring: 'lines' }, colorscale: [[0, col], [1, col]], line: { width: 2.5 }, showscale: false, name: `f${i + 1} = 0`, showlegend: true, hoverinfo: 'skip' }
    })
    const it = c.res.iterates.slice(0, 15)
    traces.push({ x: it.map((p) => p[0]), y: it.map((p) => p[1]), type: 'scatter', mode: 'lines+markers+text', text: it.map((_, k) => `x${k}`), textposition: 'top right', name: 'iteraciones', line: { color: SERIES[2], width: 1.3, dash: 'dot' }, marker: { color: SERIES[3], size: 7 } })
    if (c.res.converged) traces.push({ x: [c.res.x[0]], y: [c.res.x[1]], type: 'scatter', mode: 'markers', name: 'solución', marker: { color: SERIES[5], size: 13, symbol: 'star' } })
    return { traces, range: [x0, x1, y0, y1] }
  }, [c, s.xmin, s.xmax, s.ymin, s.ymax])
  return (
    <>
      <Plot data={data.traces} height={440} layout={{ xaxis: { title: { text: 'x' }, range: data.range.slice(0, 2) }, yaxis: { title: { text: 'y' }, range: data.range.slice(2) } }} />
      <Note>Las curvas de nivel cero de f₁ y f₂; cada intersección es una solución del sistema. Cambia x⁽⁰⁾ para converger a otra intersección.</Note>
    </>
  )
}

/** Convierte una expresión a Scilab reemplazando las variables por x(1), x(2), … */
function sciExpr(node: any, vs: string[]): string {
  const t = node.transform((m: any) => {
    if (m.isSymbolNode && vs.includes(m.name)) return new math.SymbolNode(`x(${vs.indexOf(m.name) + 1})`)
    return m
  })
  return toScilab(t, false)
}

function scilabNewton(c: Calc, s: S): string {
  const n = c.n
  const Fl = c.F.map((f, i) => `  F(${i + 1}) = ${sciExpr(f.node, c.vs)};`).join('\n')
  const Jl = c.J.flatMap((r, i) => r.map((f, j) => `  J(${i + 1}, ${j + 1}) = ${sciExpr(f.node, c.vs)};`)).join('\n')
  return `// Newton para sistemas no lineales — generado por NumLab
// Variables: ${c.vs.map((v, i) => `${v} = x(${i + 1})`).join(', ')}
clear; clc;
function F = fun(x)
  F = zeros(${n}, 1);
${Fl}
endfunction
function J = jac(x)
  J = zeros(${n}, ${n});
${Jl}
endfunction

x = ${sciVec(c.x0)};
tol = ${s.tol}; maxit = ${s.maxIter};
mprintf('%4s', 'k'); mprintf('%16s', 'x' + string((1:${n})')); mprintf('%14s\\n', '||dx||');
for k = 0:maxit-1
  dx = -jac(x) \\ fun(x);      // resolver J*dx = -F
  x = x + dx;
  mprintf('%4d', k+1); mprintf('%16.10f', x); mprintf('%14.3e\\n', norm(dx, %inf));
  if norm(dx, %inf) < tol then break; end
end
disp('Solución:'); disp(x);
mprintf('||F(x)||inf = %e\\n', norm(fun(x), %inf));
// Verificación con fsolve de Scilab
[xs, v, info] = fsolve(${sciVec(c.x0)}, fun, jac);
disp('fsolve:'); disp(xs);
${
  n === 2
    ? `
// Curvas f1 = 0 y f2 = 0
xx = linspace(${fmt(c.res.x[0] - 3, 4)}, ${fmt(c.res.x[0] + 3, 4)}, 150);
yy = linspace(${fmt(c.res.x[1] - 3, 4)}, ${fmt(c.res.x[1] + 3, 4)}, 150);
Z1 = zeros(150, 150); Z2 = Z1;
for i = 1:150
  for j = 1:150
    Fv = fun([xx(i); yy(j)]); Z1(i, j) = Fv(1); Z2(i, j) = Fv(2);
  end
end
contour2d(xx, yy, Z1, [0 0], style=[2 2]);
contour2d(xx, yy, Z2, [0 0], style=[5 5]);
plot(x(1), x(2), 'k*');
xtitle('f1 = 0 (azul), f2 = 0 (rojo)', 'x', 'y');
`
    : ''
}`
}

