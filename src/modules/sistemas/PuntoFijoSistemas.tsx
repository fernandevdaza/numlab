import { useMemo } from 'react'
import { compile, derivative, evalNumber, math, toScilab, type Compiled } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { useTheme } from '../../components/theme'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs, VectorField, type Column } from '../../components/ui'
import * as A from './algorithms'
import { N, Note, readVec, sciVec, texM, TOPIC, vecText } from './shared'
import { THEORY, TITLES } from './theory'
import { L } from '../../i18n'

const VARS = ['x', 'y', 'z', 'w']

interface S {
  n: number
  /** despejes xᵢ = gᵢ(x) */
  gs: string[]
  /** sistema original fᵢ(x) = 0 (opcional: residuo y gráfica) */
  fs: string[]
  x0: string
  tol: string
  maxIter: number
  seidel: boolean
}

const EJ37 = { n: 2, fs: ['x^2 - 2x - y + 0.5', 'x^2 + 4y^2 - 4', '', ''] }
const P62 = { n: 2, fs: ['x^2 - y - 0.2', 'y^2 - x - 0.3', '', ''] }

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: L('Ej. 3.7 raíz cerca de (1.9, 0.3)', 'Ex. 3.7 root near (1.9, 0.3)'), value: { ...EJ37, gs: ['sqrt(2x + y - 0.5)', 'sqrt(4 - x^2)/2', '', ''], x0: '1.6 0.1', tol: '1e-7', maxIter: 100, seidel: false } },
  { label: L('Ej. 3.7 con Seidel', 'Ex. 3.7 with Seidel'), value: { ...EJ37, gs: ['sqrt(2x + y - 0.5)', 'sqrt(4 - x^2)/2', '', ''], x0: '1.6 0.1', tol: '1e-7', maxIter: 100, seidel: true } },
  { label: L('Ej. 3.7 raíz cerca de (−0.2, 1)', 'Ex. 3.7 root near (−0.2, 1)'), value: { ...EJ37, gs: ['(x^2 - y + 0.5)/2', 'sqrt(4 - x^2)/2', '', ''], x0: '-0.2 1', tol: '1e-9', maxIter: 100, seidel: false } },
  { label: L('Práct. 6.2 cerca de (1.2, 1.2)', 'Practice 6.2 near (1.2, 1.2)'), value: { ...P62, gs: ['sqrt(y + 0.2)', 'sqrt(x + 0.3)', '', ''], x0: '1.2 1.2', tol: '1e-6', maxIter: 100, seidel: false } },
  { label: L('Práct. 6.2 cerca de (−0.3, −0.2)', 'Practice 6.2 near (−0.3, −0.2)'), value: { ...P62, gs: ['y^2 - 0.3', 'x^2 - 0.2', '', ''], x0: '-0.3 -0.2', tol: '1e-6', maxIter: 100, seidel: false } },
  { label: L('Ej. 3.7: 2.º despeje desde (1.6, 0.1)', 'Ex. 3.7: 2nd rearrangement from (1.6, 0.1)'), value: { ...EJ37, gs: ['(x^2 - y + 0.5)/2', 'sqrt(4 - x^2)/2', '', ''], x0: '1.6 0.1', tol: '1e-7', maxIter: 60, seidel: false } },
]

export function PuntoFijoSistemas() {
  const [s, setS] = useLocalState<S>('sistemas:punto-fijo-sistemas', EXAMPLES[0].value as S)
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const setArr = (key: 'gs' | 'fs', i: number, e: string) => setS((v) => ({ ...v, [key]: v[key].map((q, k) => (k === i ? e : q)) }))
  const d = useDebounced(s, 300)
  const { digits } = useTheme()
  const vars = VARS.slice(0, s.n)

  const calc = useMemo(() => {
    const n = d.n
    const vs = VARS.slice(0, n)
    const G: Compiled[] = []
    for (let i = 0; i < n; i++) {
      const c = compile(d.gs[i] ?? '', vs)
      if (!c.ok) return { error: `g${i + 1}: ${c.error}` }
      G.push(c)
    }
    const hasF = d.fs.slice(0, n).every((f) => f?.trim())
    const F: Compiled[] = []
    if (hasF)
      for (let i = 0; i < n; i++) {
        const c = compile(d.fs[i], vs)
        if (!c.ok) return { error: `f${i + 1}: ${c.error}` }
        F.push(c)
      }
    const DG: Compiled[][] = []
    for (let i = 0; i < n; i++) {
      const row: Compiled[] = []
      for (let j = 0; j < n; j++) {
        let node
        try {
          node = derivative(G[i].node, vs[j])
        } catch (e: any) {
          return { error: L(`No se pudo derivar g${i + 1} respecto de ${vs[j]}: ${e?.message ?? e}`, `Could not differentiate g${i + 1} with respect to ${vs[j]}: ${e?.message ?? e}`) }
        }
        const c = compile(node.toString(), vs)
        if (!c.ok) return { error: `∂g${i + 1}/∂${vs[j]}: ${c.error}` }
        row.push(c)
      }
      DG.push(row)
    }
    const x0 = readVec(d.x0, n, 'x⁽⁰⁾')
    if (typeof x0 === 'string') return { error: x0 }
    const tol = evalNumber(d.tol)
    if (!(tol > 0)) return { error: L('La precisión eps debe ser un número positivo.', 'The tolerance eps must be a positive number.') }
    const res = A.puntoFijoSistema(
      G.map((g) => g.f),
      x0,
      { tol, maxIter: d.maxIter, seidel: d.seidel },
    )
    const suf = (p: A.Vec) => DG.map((r) => r.reduce((acc, g) => acc + Math.abs(g.f(...p)), 0))
    return { n, vs, G, F, DG, x0, tol, res, suf0: suf(x0), sufX: res.x.every(Number.isFinite) ? suf(res.x) : null }
  }, [d])

  const inputs = (
    <>
      <IntField label={L('Número de ecuaciones n', 'Number of equations n')} value={s.n} onChange={(n) => set({ n })} min={2} max={4} hint={`Variables: ${vars.join(', ')}`} />
      {vars.map((v, i) => (
        <ExprField key={'g' + i} label={`${v} = g${i + 1}(${vars.join(', ')})`} value={s.gs[i] ?? ''} onChange={(e) => setArr('gs', i, e)} vars={vars} texPrefix={`g_{${i + 1}} =`} />
      ))}
      <details>
        <summary className="muted" style={{ cursor: 'pointer', fontSize: 13 }}>
          {L('Sistema original fᵢ = 0 (opcional: residuo y gráfica)', 'Original system fᵢ = 0 (optional: residual and plot)')}
        </summary>
        {vars.map((_, i) => (
          <ExprField key={'f' + i} label={`f${i + 1}(${vars.join(', ')}) = 0`} value={s.fs[i] ?? ''} onChange={(e) => setArr('fs', i, e)} vars={vars} texPrefix={`f_{${i + 1}} =`} />
        ))}
      </details>
      <VectorField label={L(<>Valor inicial <Tex>{'\\mathbf{x}^{(0)}'}</Tex> ({vars.join(', ')})</>, <>Initial value <Tex>{'\\mathbf{x}^{(0)}'}</Tex> ({vars.join(', ')})</>)} value={s.x0} onChange={(x0) => set({ x0 })} />
      <SelectField
        label={L('Variante', 'Variant')}
        value={s.seidel ? 'seidel' : 'simple'}
        onChange={(v) => set({ seidel: v === 'seidel' })}
        options={[
          { value: 'simple', label: L('Punto fijo: todas las gᵢ con x⁽ᵏ⁾', 'Fixed point: all gᵢ with x⁽ᵏ⁾') },
          { value: 'seidel', label: L('Seidel: usa de inmediato las componentes ya calculadas', 'Seidel: uses the already computed components immediately') },
        ]}
      />
      <FieldRow>
        <NumField label={L('Precisión eps', 'Tolerance eps')} value={s.tol} onChange={(tol) => set({ tol })} />
        <IntField label={L('Máx. iteraciones', 'Max. iterations')} value={s.maxIter} onChange={(maxIter) => set({ maxIter })} min={1} max={1000} />
      </FieldRow>
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES['punto-fijo-sistemas']} topic={TOPIC} theory={THEORY['punto-fijo-sistemas']} inputs={inputs}>
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <PFResults c={calc} s={d} digits={digits} />}
    </MethodPage>
  )
}

interface Calc {
  n: number
  vs: string[]
  G: Compiled[]
  F: Compiled[]
  DG: Compiled[][]
  x0: A.Vec
  tol: number
  res: A.PFSResult
  suf0: A.Vec
  sufX: A.Vec | null
}

function PFResults({ c, s, digits }: { c: Calc; s: S; digits: number }) {
  const { res, vs } = c
  const hasF = c.F.length > 0
  const Fx = hasF ? c.F.map((f) => f.f(...res.x)) : []
  const ok0 = c.suf0.every((v) => v < 1)
  const cols: Column<any>[] = [
    { key: 'k', tex: 'k', fmt: 'int', align: 'center' },
    ...vs.map((v, i) => ({ key: 'x' + i, tex: `${v}_k = g_{${i + 1}}` })),
    ...(hasF ? vs.map((_, i) => ({ key: 'f' + i, tex: `f_{${i + 1}}(\\mathbf{x}_k)`, fmt: 'err' as const })) : []),
    { key: 'err', tex: '\\|\\mathbf{x}_k-\\mathbf{x}_{k-1}\\|_\\infty', get: (r: any) => (Number.isFinite(r.err) ? fmtErr(r.err) : '—') },
  ]
  const rows = res.rows.map((r) => ({
    k: r.k,
    err: r.err,
    ...Object.fromEntries(r.x.map((v, i) => ['x' + i, v])),
    ...(hasF ? Object.fromEntries(c.F.map((f, i) => ['f' + i, f.f(...r.x)])) : {}),
  }))
  return (
    <>
      <Stats
        items={[
          { label: L(`Solución (${vs.join(', ')})`, `Solution (${vs.join(', ')})`), value: vecText(res.x, Math.min(digits, 10)), accent: true },
          { label: L('Iteraciones', 'Iterations'), value: res.rows.length - 1, hint: res.converged ? L('convergió', 'converged') : L('no convergió', 'did not converge') },
          { label: L('Condición en x⁽⁰⁾', 'Condition at x⁽⁰⁾'), value: ok0 ? L('se cumple', 'holds') : L('no se cumple', 'does not hold'), hint: L(`máx Σⱼ|∂gᵢ/∂xⱼ| = ${fmt(Math.max(...c.suf0), 4)}`, `max Σⱼ|∂gᵢ/∂xⱼ| = ${fmt(Math.max(...c.suf0), 4)}`) },
          hasF ? { label: '‖F(x)‖∞', value: fmtErr(A.normInf(Fx)) } : { label: '‖g(x) − x‖∞', value: fmtErr(A.normInf(A.vsub(c.G.map((g) => g.f(...res.x)), res.x))) },
        ]}
      />
      <Alert kind={res.converged ? 'ok' : 'warn'}>{res.message}</Alert>
      <Card title={L('Condición de suficiencia (en el valor inicial, como sugiere el texto)', 'Sufficient condition (at the initial value, as the textbook suggests)')}>
        <DataTable
          filename="suficiencia_punto_fijo"
          columns={[
            { key: 'g', label: L('Función', 'Function'), align: 'left' },
            ...vs.map((v, j) => ({ key: 'd' + j, tex: `|\\partial g_i/\\partial ${v}|` })),
            { key: 's0', tex: L('\\sum_j \\text{ en } \\mathbf{x}^{(0)}', '\\sum_j \\text{ at } \\mathbf{x}^{(0)}') },
            ...(c.sufX ? [{ key: 'sx', tex: L('\\sum_j \\text{ en la solución}', '\\sum_j \\text{ at the solution}') }] : []),
          ]}
          rows={c.DG.map((r, i) => ({ g: `g${i + 1}`, ...Object.fromEntries(r.map((g, j) => ['d' + j, Math.abs(g.f(...c.x0))])), s0: c.suf0[i], sx: c.sufX?.[i] }))}
        />
        <Note>
          {ok0
            ? L('Todas las sumas son < 1 en x⁽⁰⁾: se puede esperar que el proceso converja.', 'All sums are < 1 at x⁽⁰⁾: the process can be expected to converge.')
            : L(
                'Alguna suma es ≥ 1 en x⁽⁰⁾: probablemente no converja; prueba otro despeje o un valor inicial más cercano.',
                'Some sum is ≥ 1 at x⁽⁰⁾: it will probably not converge; try another rearrangement or a closer initial value.',
              )}{' '}
          {L('Derivadas simbólicas', 'Symbolic derivatives')}: {c.DG.map((r, i) => r.map((g, j) => `∂g${i + 1}/∂${vs[j]} = ${g.node.toString()}`).join('; ')).join('; ')}.
        </Note>
      </Card>
      <Tabs
        tabs={[
          ...(c.n === 2 ? [{ label: L('Gráfica', 'Plot'), content: <Card><PFPlot c={c} /></Card> }] : []),
          { label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={pfSteps(c, s.seidel)} /></Card> },
          {
            label: L('Convergencia', 'Convergence'),
            content: (
              <Card>
                <Plot
                  data={[{ x: res.rows.slice(1).map((r) => r.k), y: res.rows.slice(1).map((r) => (r.err > 0 ? r.err : null)), type: 'scatter', mode: 'lines+markers', name: '‖xₖ − xₖ₋₁‖∞', line: { color: SERIES[0], width: 2.5 } }]}
                  layout={{ yaxis: { type: 'log', title: { text: L('escala log', 'log scale') }, exponentformat: 'power' }, xaxis: { title: { text: 'k' } } }}
                />
                <Note>
                  {L(
                    'Convergencia lineal: el error baja aproximadamente un factor constante por iteración (una recta en escala logarítmica). Seidel suele reducir ese factor.',
                    'Linear convergence: the error decreases by roughly a constant factor per iteration (a straight line on a logarithmic scale). Seidel usually reduces that factor.',
                  )}
                </Note>
              </Card>
            ),
          },
        ]}
      />
      <Card title={L('Tabla de iteraciones', 'Iteration table')}>
        <DataTable columns={cols} rows={rows} highlightLast={res.converged} filename="punto_fijo_sistemas" />
      </Card>
      <ScilabCode code={scilabPF(c, s)} filename="punto_fijo_sistemas" />
    </>
  )
}

function pfSteps(c: Calc, seidel: boolean): { text?: string; tex?: string }[] {
  const { vs, res } = c
  const out: { text?: string; tex?: string }[] = []
  if (c.F.length) out.push({ text: L('Sistema original:', 'Original system:'), tex: '\\begin{cases}' + c.F.map((f) => `${f.tex} = 0`).join(' \\\\ ') + '\\end{cases}' })
  out.push({
    text: L(
      `Despejes e iteración${seidel ? ' de Seidel (cada gᵢ usa las componentes ya actualizadas)' : ''}:`,
      `Rearrangements and ${seidel ? 'Seidel iteration (each gᵢ uses the already updated components)' : 'iteration'}:`,
    ),
    tex:
      '\\begin{aligned}' +
      c.G.map((g, i) => {
        const args = vs.map((v, j) => `${v}_{${seidel && j < i ? 'k+1' : 'k'}}`).join(',')
        return `${vs[i]}_{k+1} &= g_{${i + 1}}(${args}) = ${g.tex}`
      }).join(' \\\\ ') +
      '\\end{aligned}',
  })
  out.push({
    text: L('Condición de suficiencia evaluada en x⁽⁰⁾:', 'Sufficient condition evaluated at x⁽⁰⁾:'),
    tex: '\\begin{aligned}' + c.DG.map((r, i) => `\\textstyle\\sum_j \\left|\\frac{\\partial g_{${i + 1}}}{\\partial x_j}\\right| &= ${r.map((g) => N(Math.abs(g.f(...c.x0)), 4)).join(' + ')} = ${N(c.suf0[i], 4)} ${c.suf0[i] < 1 ? '< 1' : '\\ge 1'}`).join(' \\\\ ') + '\\end{aligned}',
  })
  res.rows.slice(1, 4).forEach((r) => {
    const prev = res.rows[r.k - 1].x
    out.push({
      text: L(`Iteración ${r.k}: partiendo de (${prev.map((v) => fmt(v, 8)).join(', ')})`, `Iteration ${r.k}: starting from (${prev.map((v) => fmt(v, 8)).join(', ')})`),
      tex: '\\begin{aligned}' + c.G.map((_, i) => `${vs[i]}_{${r.k}} &= g_{${i + 1}}(\\dots) = ${N(r.x[i])}`).join(' \\\\ ') + `\\end{aligned}\\qquad \\|\\mathbf{x}_{${r.k}} - \\mathbf{x}_{${r.k - 1}}\\|_\\infty = ${N(r.err)}`,
    })
  })
  if (res.rows.length > 4) out.push({ text: L(`… hasta la iteración ${res.rows.length - 1} (ver tabla).`, `… up to iteration ${res.rows.length - 1} (see table).`), tex: `\\mathbf{x} \\approx ${texM(res.x)}` })
  if (!res.converged) out.push({ text: '⚠ ' + res.message })
  return out
}

function PFPlot({ c }: { c: Calc }) {
  const data = useMemo(() => {
    const pts = c.res.rows.map((r) => r.x).filter((p) => p.every(Number.isFinite) && Math.abs(p[0]) < 1e4 && Math.abs(p[1]) < 1e4)
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 2)
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2
    const [x0, x1, y0, y1] = [cx - span, cx + span, cy - span, cy + span]
    const K = 160
    const gx = Array.from({ length: K }, (_, i) => x0 + ((x1 - x0) * i) / (K - 1))
    const gy = Array.from({ length: K }, (_, i) => y0 + ((y1 - y0) * i) / (K - 1))
    // curvas fᵢ = 0 si se dieron; si no, xᵢ − gᵢ = 0 (tienen las mismas intersecciones)
    const fun = c.F.length ? c.F.map((f) => f.f) : c.G.map((g, i) => (x: number, y: number) => (i === 0 ? x : y) - g.f(x, y))
    const traces: Trace[] = fun.map((f, i) => {
      const z = gy.map((y) => gx.map((x) => {
        const v = f(x, y)
        return Number.isFinite(v) ? v : null
      }))
      const col = SERIES[i]
      return { type: 'contour', x: gx, y: gy, z, contours: { start: 0, end: 0, size: 1, coloring: 'lines' }, colorscale: [[0, col], [1, col]], line: { width: 2.5 }, showscale: false, name: c.F.length ? `f${i + 1} = 0` : `${c.vs[i]} = g${i + 1}`, showlegend: true, hoverinfo: 'skip' }
    })
    const it = c.res.rows.slice(0, 25).map((r) => r.x)
    traces.push({ x: it.map((p) => p[0]), y: it.map((p) => p[1]), type: 'scatter', mode: 'lines+markers', name: L('iteraciones', 'iterations'), line: { color: SERIES[2], width: 1.3, dash: 'dot' }, marker: { color: SERIES[3], size: 6 } })
    if (c.res.converged) traces.push({ x: [c.res.x[0]], y: [c.res.x[1]], type: 'scatter', mode: 'markers', name: L('punto fijo', 'fixed point'), marker: { color: SERIES[5], size: 13, symbol: 'star' } })
    return { traces, range: [x0, x1, y0, y1] }
  }, [c])
  return (
    <>
      <Plot data={data.traces} height={440} layout={{ xaxis: { title: { text: 'x' }, range: data.range.slice(0, 2) }, yaxis: { title: { text: 'y' }, range: data.range.slice(2) } }} />
      <Note>
        {L(
          'Cada intersección de las curvas es una solución. Un despeje gᵢ sólo sirve cerca de la raíz donde se cumple la condición de suficiencia.',
          'Each intersection of the curves is a solution. A rearrangement gᵢ only works near the root where the sufficient condition holds.',
        )}
      </Note>
    </>
  )
}

function sciExpr(node: any, vs: string[]): string {
  const t = node.transform((m: any) => {
    if (m.isSymbolNode && vs.includes(m.name)) return new math.SymbolNode(`x(${vs.indexOf(m.name) + 1})`)
    return m
  })
  return toScilab(t, false)
}

function scilabPF(c: Calc, s: S): string {
  const n = c.n
  const upd = c.G.map((g, i) => `  xn(${i + 1}) = ${sciExpr(g.node, c.vs).replace(/(?<![A-Za-z_])x\((\d)\)/g, s.seidel ? 'xn($1)' : 'x($1)')};`).join('\n')
  return `// ${L(`Punto fijo para sistemas no lineales${s.seidel ? ' (variante de Seidel)' : ''} — generado por NumLab`, `Fixed point for nonlinear systems${s.seidel ? ' (Seidel variant)' : ''} — generated by NumLab`)}
// Variables: ${c.vs.map((v, i) => `${v} = x(${i + 1})`).join(', ')}
clear; clc;
x = ${sciVec(c.x0)};
eps_ = ${s.tol}; maxit = ${s.maxIter};
mprintf('%4s', 'k'); mprintf('%20s', 'x' + string((1:${n})')); mprintf('%14s\\n', 'error');
for k = 1:maxit
  xn = x;
${upd}
  err = norm(xn - x, %inf);
  x = xn;
  mprintf('%4d', k); mprintf('%20.15f', x); mprintf('%14.3e\\n', err);
  if err < eps_ then break; end
end
disp('${L('Solución aproximada:', 'Approximate solution:')}'); disp(x);
`
}
