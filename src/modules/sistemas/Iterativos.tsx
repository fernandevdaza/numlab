import { useMemo } from 'react'
import { evalNumber } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { useTheme } from '../../components/theme'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import {
  Alert, Card, DataTable, Examples, FieldRow, IntField, MatrixField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs, VectorField, matrixToText, type Column,
} from '../../components/ui'
import * as A from './algorithms'
import { N, Note, P, readSystem, readVec, sciMat, sciVec, texM, TOPIC, vecText } from './shared'
import { THEORY, TITLES } from './theory'

export type IterKind = 'jacobi' | 'gauss-seidel'

interface S {
  A: string
  b: string
  x0: string
  tol: string
  maxIter: number
  crit: 'abs' | 'rel'
  /** norma del criterio de parada (el texto usa la euclidiana en el Ej. 3.3) */
  norm: A.VecNorm
  omega: string
}

const EJ33 = { A: '1.431 1.21 1.1\n0.331 1.3 0.7\n0.729 0.81 1.6', b: '1.000 0.8484 0.6867', x0: '0 0 0' }
const EJ33B = { ...EJ33, A: '2.431 1.21 1.1\n0.331 1.3 0.7\n0.729 0.81 1.6' }
const S3 = { b: '-3 15 10 2', x0: '0 0 0 0' }

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: 'Ej. 3.3 (reordenado)', value: { ...EJ33, tol: '1e-4', maxIter: 100, norm: '2', crit: 'abs', omega: '1' } },
  { label: 'Ej. 3.3 con a₂₁ = 2.431 (eps = 10⁻⁴)', value: { ...EJ33B, tol: '1e-4', maxIter: 200, norm: '2', crit: 'abs', omega: '1' } },
  { label: 'Práct. 03 (S₃ reordenado, 4 iteraciones)', value: { ...S3, A: '4 1 1 -1\n1 9 3 4\n-1 3 7 2\n0 1 0 6', tol: '1e-12', maxIter: 4, norm: '2', crit: 'abs', omega: '1' } },
  { label: 'Práct. 03 (S₃ sin reordenar)', value: { A: '-1 3 7 2\n1 9 3 4\n0 1 0 6\n4 1 1 -1', b: '10 15 2 -3', x0: '0 0 0 0', tol: '1e-6', maxIter: 100, norm: '2', crit: 'abs', omega: '1' } },
  { label: 'Burden 4×4', value: { A: '10 -1 2 0\n-1 11 -1 3\n2 -1 10 -1\n0 3 -1 8', b: '6 25 -11 15', x0: '0 0 0 0', tol: '1e-3', maxIter: 100, norm: 'inf', crit: 'rel', omega: '1' } },
  { label: 'SOR ω = 1.25 (Burden)', value: { A: '4 3 0\n3 4 -1\n0 -1 4', b: '24 30 -24', x0: '1 1 1', tol: '1e-7', maxIter: 100, norm: 'inf', crit: 'abs', omega: '1.25' } },
  { label: 'Diverge (ρ > 1)', value: { A: '1 2\n3 1', b: '3 4', x0: '0 0', tol: '1e-6', maxIter: 50, norm: '2', crit: 'abs', omega: '1' } },
  { label: 'Poisson 1D (lento)', value: { A: '2 -1 0 0 0\n-1 2 -1 0 0\n0 -1 2 -1 0\n0 0 -1 2 -1\n0 0 0 -1 2', b: '1 1 1 1 1', x0: '0 0 0 0 0', tol: '1e-6', maxIter: 500, norm: '2', crit: 'abs', omega: '1' } },
]

const NORM_TEX: Record<A.VecNorm, string> = { '2': '\\|\\cdot\\|_2', inf: '\\|\\cdot\\|_\\infty', '1': '\\|\\cdot\\|_1' }
const NORM_SUB: Record<A.VecNorm, string> = { '2': '2', inf: '\\infty', '1': '1' }
const NORM_TXT: Record<A.VecNorm, string> = { '2': '₂', inf: '∞', '1': '₁' }

export function Iterativos({ kind }: { kind: IterKind }) {
  const method: A.IterMethod = kind === 'jacobi' ? 'jacobi' : 'gs'
  const [s, setS] = useLocalState<S>('sistemas:' + kind + ':v2', { ...EJ33B, tol: '1e-4', maxIter: 200, crit: 'abs', norm: '2', omega: '1' })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)
  const { digits } = useTheme()

  const calc = useMemo(() => {
    const sys = readSystem(d.A, d.b)
    if ('error' in sys) return { error: sys.error }
    const x0 = readVec(d.x0, sys.n, 'x⁽⁰⁾')
    if (typeof x0 === 'string') return { error: x0 }
    const tol = evalNumber(d.tol)
    if (!(tol > 0)) return { error: 'La tolerancia eps debe ser un número positivo.' }
    const omega = method === 'gs' ? evalNumber(d.omega) : 1
    if (!Number.isFinite(omega) || omega === 0) return { error: 'ω inválido (debe ser un número distinto de 0).' }
    const res = A.iterativo(sys.A, sys.b, x0, { method, omega, tol, maxIter: d.maxIter, crit: d.crit, norm: d.norm })
    if (!res.ok) return { error: res.error!, sys, order: A.dominantOrder(sys.A) }
    const it = A.iterationMatrix(sys.A, sys.b, method, omega)
    const eig = it ? A.eigenvalues(it.T) : null
    const rho = it ? A.spectralRadius(it.T) : NaN
    const dom = A.diagDominance(sys.A)
    const col = A.colDominance(sys.A)
    const cs = A.cSums(sys.A)
    const order = dom.strict ? null : A.dominantOrder(sys.A)
    return { sys, x0, tol, omega, res, it, eig, rho, dom, col, cs, order }
  }, [d, method])

  const inputs = (
    <>
      <MatrixField label="Matriz A (reordenada: diagonal dominante si es posible)" value={s.A} onChange={(A) => set({ A })} rows={5} />
      <VectorField label="Vector b" value={s.b} onChange={(b) => set({ b })} />
      <VectorField label={<>Vector inicial <Tex>{'x^{(0)}'}</Tex></>} value={s.x0} onChange={(x0) => set({ x0 })} hint="Vacío = vector cero (lo habitual según el texto)" />
      {method === 'gs' && (
        <NumField label={<>Factor de relajación <Tex>\omega</Tex></>} value={s.omega} onChange={(omega) => set({ omega })} hint="ω = 1: Gauss-Seidel (texto) · 1 < ω < 2: SOR (sobrerrelajación) · 0 < ω < 1: subrelajación" />
      )}
      <FieldRow>
        <NumField label="Precisión eps" value={s.tol} onChange={(tol) => set({ tol })} />
        <IntField label="Máx. iteraciones" value={s.maxIter} onChange={(maxIter) => set({ maxIter })} min={1} max={5000} />
      </FieldRow>
      <FieldRow>
        <SelectField
          label="Norma"
          value={s.norm}
          onChange={(norm) => set({ norm })}
          options={[
            { value: '2', label: 'Euclidiana ‖·‖₂ (texto)' },
            { value: 'inf', label: 'Maximal ‖·‖∞' },
            { value: '1', label: 'Suma ‖·‖₁' },
          ]}
        />
        <SelectField
          label="Criterio de parada"
          value={s.crit}
          onChange={(crit) => set({ crit })}
          options={[
            { value: 'abs', label: '‖x⁽ᵏ⁾ − x⁽ᵏ⁻¹⁾‖ < eps (texto)' },
            { value: 'rel', label: '‖x⁽ᵏ⁾ − x⁽ᵏ⁻¹⁾‖ / ‖x⁽ᵏ⁾‖ < eps' },
          ]}
        />
      </FieldRow>
      <Examples items={kind === 'jacobi' ? EXAMPLES.filter((e) => !e.label.startsWith('SOR')) : EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  const title = method === 'gs' && Number.isFinite(evalNumber(s.omega)) && evalNumber(s.omega) !== 1 ? `Método SOR (ω = ${s.omega})` : TITLES[kind]

  return (
    <MethodPage title={title} topic={TOPIC} theory={THEORY[kind]} inputs={inputs}>
      {'error' in calc ? (
        <Alert kind="error">
          {calc.error}{' '}
          {'order' in calc && calc.order && (
            <button className="btn ghost sm" onClick={() => set({ A: matrixToText(calc.order!.map((i) => calc.sys.A[i])), b: calc.order!.map((i) => calc.sys.b[i]).join(' ') })}>
              ↻ Reordenar ecuaciones (diagonal dominante)
            </button>
          )}
        </Alert>
      ) : (
        <IterResults
          kind={kind}
          c={calc}
          s={d}
          digits={digits}
          onReorder={(order) => set({ A: matrixToText(order.map((i) => calc.sys.A[i])), b: order.map((i) => calc.sys.b[i]).join(' ') })}
        />
      )}
    </MethodPage>
  )
}

interface Calc {
  sys: { A: A.Mat; b: A.Vec; n: number }
  x0: A.Vec
  tol: number
  omega: number
  res: A.IterResult
  it: { T: A.Mat; c: A.Vec } | null
  eig: A.Complex[] | null
  rho: number
  dom: A.Dominance
  col: A.Dominance
  cs: ReturnType<typeof A.cSums>
  order: number[] | null
}

function IterResults({ kind, c, s, digits, onReorder }: { kind: IterKind; c: Calc; s: S; digits: number; onReorder: (o: number[]) => void }) {
  const { res, sys, rho, dom, col } = c
  const n = sys.n
  const method: A.IterMethod = kind === 'jacobi' ? 'jacobi' : 'gs'
  const iters = res.rows.length - 1
  const Tname = method === 'jacobi' ? 'C' : c.omega === 1 ? 'T_{GS}' : 'T_\\omega'
  const nm = NORM_SUB[s.norm]
  const name = method === 'jacobi' ? 'Gauss-Jacobi' : c.omega === 1 ? 'Gauss-Seidel' : 'SOR'
  const cols: Column<any>[] = [
    { key: 'k', tex: 'k', fmt: 'int', align: 'center' },
    ...Array.from({ length: n }, (_, i) => ({ key: 'x' + i, tex: `x_{${i + 1}}^{(k)}` })),
    { key: 'err', tex: `\\|x^{(k)}-x^{(k-1)}\\|_{${nm}}`, get: (r: any) => (Number.isFinite(r.err) ? fmtErr(r.err) : '—') },
    { key: 'errRel', tex: '\\text{error rel.}', get: (r: any) => (Number.isFinite(r.errRel) ? fmtErr(r.errRel) : '—') },
  ]
  const rows = res.rows.map((r) => ({ k: r.k, err: r.err, errRel: r.errRel, ...Object.fromEntries(r.x.map((v, i) => ['x' + i, v])) }))
  const suff = dom.strict || col.strict
  return (
    <>
      <Stats
        items={[
          { label: 'Solución x', value: vecText(res.x, Math.min(digits, 8)), accent: true },
          { label: 'Iteraciones', value: iters, hint: res.converged ? `convergió: ‖x⁽ᵏ⁾ − x⁽ᵏ⁻¹⁾‖${NORM_TXT[s.norm]} < eps` : 'no convergió' },
          {
            label: 'Criterio de suficiencia',
            value: dom.strict ? 'Sí (filas)' : col.strict ? 'Sí (columnas)' : 'No',
            hint: suff ? '⇒ converge para todo x⁽⁰⁾' : 'no se puede afirmar si converge',
          },
          { label: <>Radio espectral ρ(T)</>, value: Number.isFinite(rho) ? fmt(rho, 6) : '—', hint: rho < 1 ? '< 1 ⇒ converge ∀ x⁽⁰⁾ (complemento)' : '≥ 1 ⇒ no converge en general' },
        ]}
      />
      <Alert kind={res.converged ? 'ok' : 'warn'}>
        {name}: {res.message}. Residuo ‖b − Ax‖∞ = {fmtErr(A.normInf(A.vsub(sys.b, A.matVec(sys.A, res.x))))}.
      </Alert>
      {suff ? (
        <Alert kind="ok">
          A es estrictamente diagonalmente dominante por {dom.strict ? 'filas' : 'columnas'}: se cumple la condición suficiente del texto ⇒ {name} converge para cualquier vector inicial.
        </Alert>
      ) : c.order ? (
        <Alert kind="warn">
          No se cumple la condición suficiente, pero reordenando las ecuaciones en el orden ({c.order.map((i) => 'E' + (i + 1)).join(', ')}) la matriz es estrictamente diagonalmente
          dominante.{' '}
          <button className="btn ghost sm" onClick={() => onReorder(c.order!)}>
            ↻ Reordenar ecuaciones
          </button>
        </Alert>
      ) : (
        <Alert kind="info">
          No se cumple la condición suficiente (ni por filas ni por columnas): el método puede o no converger.{' '}
          {rho < 1 ? 'Aquí ρ(T) < 1, así que sí converge.' : 'Aquí ρ(T) ≥ 1: no converge en general.'}
        </Alert>
      )}
      {method === 'gs' && !(c.omega > 0 && c.omega < 2) && <Alert kind="warn">Para SOR se necesita 0 &lt; ω &lt; 2 (teorema de Kahan); fuera de ese rango diverge.</Alert>}
      <Tabs
        tabs={[
          { label: 'Paso a paso', content: <Card><Steps steps={iterSteps(c, method, s.norm)} /></Card> },
          { label: 'Convergencia', content: <Card><ConvPlot res={res} rho={rho} norm={s.norm} /></Card> },
          { label: 'Matriz de iteración', content: <Card><IterMatrix c={c} Tname={Tname} /></Card> },
          { label: 'Comparar métodos', content: <Card><Compare c={c} s={s} /></Card> },
        ]}
      />
      <Card title="Tabla de iteraciones">
        <DataTable columns={cols} rows={rows} highlightLast={res.converged} filename={kind} />
      </Card>
      <ScilabCode code={scilabIter(c, s, method)} filename={method === 'jacobi' ? 'gauss_jacobi' : c.omega === 1 ? 'gauss_seidel' : 'sor'} />
    </>
  )
}

function ConvPlot({ res, rho, norm }: { res: A.IterResult; rho: number; norm: A.VecNorm }) {
  const data = useMemo(() => {
    const r = res.rows.slice(1)
    const tr: Trace[] = [{ x: r.map((q) => q.k), y: r.map((q) => (q.err > 0 ? q.err : null)), type: 'scatter', mode: 'lines+markers', name: `‖x⁽ᵏ⁾ − x⁽ᵏ⁻¹⁾‖${NORM_TXT[norm]}`, line: { color: SERIES[0], width: 2.5 } }]
    if (r.length > 1 && rho > 0 && Number.isFinite(rho) && r[0].err > 0)
      tr.push({ x: r.map((q) => q.k), y: r.map((q) => r[0].err * Math.pow(rho, q.k - 1)), type: 'scatter', mode: 'lines', name: `teórico ∝ ρ(T)ᵏ, ρ = ${fmt(rho, 4)}`, line: { color: SERIES[1], dash: 'dash', width: 1.5 } })
    return tr
  }, [res, rho, norm])
  const comps = useMemo(
    () =>
      res.x.map((_, i) => ({ x: res.rows.map((q) => q.k), y: res.rows.map((q) => q.x[i]), type: 'scatter', mode: 'lines+markers', name: `x${i + 1}`, line: { color: SERIES[i % SERIES.length] }, marker: { size: 5 } }) as Trace),
    [res],
  )
  return (
    <>
      <Plot data={data} layout={{ yaxis: { type: 'log', title: { text: 'error (escala log)' }, exponentformat: 'power' }, xaxis: { title: { text: 'iteración k' } } }} />
      <Note>
        En escala logarítmica el error de un método iterativo estacionario baja como una recta de pendiente log₁₀ ρ(T): cada iteración multiplica el error por ≈ ρ(T). Se necesitan ≈ −1/log₁₀ ρ
        iteraciones por cifra decimal.
      </Note>
      <div style={{ marginTop: 14 }}>
        <Plot data={comps} height={300} layout={{ xaxis: { title: { text: 'k' } }, yaxis: { title: { text: 'xᵢ⁽ᵏ⁾' } } }} />
      </div>
    </>
  )
}

/** Expresión de la fórmula de iteración de x_i con coeficientes numéricos. */
function formulaTex(Am: A.Mat, b: A.Vec, i: number, method: A.IterMethod, omega: number): string {
  const n = Am.length
  let num = N(b[i])
  for (let j = 0; j < n; j++) {
    if (j === i || Am[i][j] === 0) continue
    const coef = -Am[i][j]
    const sup = method === 'gs' && j < i ? '(k+1)' : '(k)'
    const mag = Math.abs(coef) === 1 ? '' : N(Math.abs(coef))
    num += ` ${coef < 0 ? '-' : '+'} ${mag}x_{${j + 1}}^{${sup}}`
  }
  const frac = `\\frac{${num}}{${N(Am[i][i])}}`
  if (method === 'gs' && omega !== 1) return `x_{${i + 1}}^{(k+1)} = ${P(1 - omega)}\\,x_{${i + 1}}^{(k)} + ${N(omega)}\\cdot${frac}`
  return `x_{${i + 1}}^{(k+1)} = ${frac}`
}

/** Sustitución numérica de una iteración concreta k → k+1. */
function iterNumTex(Am: A.Mat, b: A.Vec, i: number, method: A.IterMethod, omega: number, xOld: A.Vec, xNew: A.Vec, k: number): string {
  const n = Am.length
  let num = N(b[i])
  for (let j = 0; j < n; j++) {
    if (j === i || Am[i][j] === 0) continue
    const val = method === 'gs' && j < i ? xNew[j] : xOld[j]
    num += ` - ${P(Am[i][j])}\\cdot ${P(val)}`
  }
  const frac = `\\frac{${num}}{${N(Am[i][i])}}`
  if (method === 'gs' && omega !== 1) {
    let s = b[i]
    for (let j = 0; j < n; j++) if (j !== i) s -= Am[i][j] * (j < i ? xNew[j] : xOld[j])
    return `x_{${i + 1}}^{(${k + 1})} = ${P(1 - omega)}\\cdot ${P(xOld[i])} + ${N(omega)}\\cdot${frac} = ${P(1 - omega)}\\cdot ${P(xOld[i])} + ${N(omega)}\\cdot ${P(s / Am[i][i])} = ${N(xNew[i])}`
  }
  return `x_{${i + 1}}^{(${k + 1})} = ${frac} = ${N(xNew[i])}`
}

function iterSteps(c: Calc, method: A.IterMethod, norm: A.VecNorm): { text?: string; tex?: string }[] {
  const { A: Am, b, n } = c.sys
  const out: { text?: string; tex?: string }[] = []
  const nm = NORM_SUB[norm]
  const domTex = (d: A.Dominance, byCol: boolean) =>
    '\\begin{aligned}' +
    d.rows
      .map((r) => {
        const others = (byCol ? Am.map((row) => row[r.i]) : Am[r.i]).filter((_, j) => j !== r.i).map((v) => N(Math.abs(v))).join(' + ')
        return `${byCol ? 'j' : 'i'} = ${r.i + 1}:\\; |a_{${r.i + 1}${r.i + 1}}| = ${N(r.diag)} &\\;${r.strict ? '>' : r.weak ? '=' : '<'}\\; ${others} = ${N(r.off)} & ${r.strict ? '\\text{sí}' : '\\text{no}'}`
      })
      .join(' \\\\ ') +
    '\\end{aligned}'
  out.push({ text: 'Condición suficiente por filas (ecuaciones): |aᵢᵢ| > Σⱼ≠ᵢ |aᵢⱼ| para todo i', tex: domTex(c.dom, false) })
  out.push({ text: 'Condición suficiente por columnas: |aⱼⱼ| > Σᵢ≠ⱼ |aᵢⱼ| para todo j', tex: domTex(c.col, true) })
  out.push({
    text:
      c.dom.strict || c.col.strict
        ? `Se cumple por ${c.dom.strict ? 'filas' : 'columnas'} ⇒ el método converge para cualquier x⁽⁰⁾.`
        : 'No se cumple ninguna de las dos: no se puede afirmar si el proceso iterativo convergerá o no (es sólo una condición suficiente).',
  })
  out.push({
    text:
      method === 'jacobi'
        ? 'Despejamos la incógnita de la diagonal de cada ecuación, x = Cx + D (Gauss-Jacobi usa sólo valores de la iteración anterior):'
        : c.omega === 1
          ? 'Despejamos la incógnita de la diagonal de cada ecuación (Gauss-Seidel usa los valores ya actualizados, superíndice k+1):'
          : `Fórmulas de SOR con ω = ${fmt(c.omega)}:`,
    tex: '\\begin{aligned}' + Array.from({ length: n }, (_, i) => formulaTex(Am, b, i, method, c.omega).replace('=', '&=')).join(' \\\\ ') + '\\end{aligned}',
  })
  const rows = c.res.rows
  for (let k = 0; k < Math.min(2, rows.length - 1); k++) {
    const xo = rows[k].x
    const xn = rows[k + 1].x
    out.push({
      text: `Iteración ${k + 1}: partiendo de x⁽${k}⁾ = (${xo.map((v) => fmt(v, 6)).join(', ')})`,
      tex: '\\begin{aligned}' + Array.from({ length: n }, (_, i) => iterNumTex(Am, b, i, method, c.omega, xo, xn, k).replace('=', '&=')).join(' \\\\ ') + '\\end{aligned}',
    })
    out.push({ tex: `\\|x^{(${k + 1})} - x^{(${k})}\\|_{${nm}} = ${N(rows[k + 1].err)}` })
  }
  if (rows.length > 3) out.push({ text: `… se repite hasta la iteración ${rows.length - 1} (ver tabla). Resultado: x ≈ (${c.res.x.map((v) => fmt(v, 8)).join(', ')}).` })
  if (c.it && n <= 8)
    out.push({
      text: method === 'jacobi' ? 'Forma matricial x⁽ᵏ⁺¹⁾ = C x⁽ᵏ⁾ + D y radio espectral de C (complemento):' : 'Forma matricial equivalente x⁽ᵏ⁺¹⁾ = T x⁽ᵏ⁾ + c (complemento):',
      tex: `${method === 'jacobi' ? 'C' : 'T'} = ${texM(c.it.T, 5)},\\quad ${method === 'jacobi' ? 'D' : 'c'} = ${texM(c.it.c, 5)},\\qquad \\rho = ${N(c.rho, 6)} ${c.rho < 1 ? '< 1 \\Rightarrow \\text{converge}' : '\\ge 1 \\Rightarrow \\text{no converge}'}`,
    })
  return out
}

function IterMatrix({ c, Tname }: { c: Calc; Tname: string }) {
  if (!c.it) return <p className="muted">No se pudo construir la matriz de iteración (algún aᵢᵢ = 0).</p>
  const nT = A.normInfM(c.it.T)
  const e1 = c.res.rows.length > 1 ? A.normInf(A.vsub(c.res.rows[1].x, c.res.rows[0].x)) : NaN
  const kMin = nT < 1 && e1 > 0 ? Math.ceil(Math.log((c.tol * (1 - nT)) / e1) / Math.log(nT)) : NaN
  return (
    <>
      <Tex block>{`${Tname} = ${texM(c.it.T, 6)},\\qquad c = ${texM(c.it.c, 6)}`}</Tex>
      <Stats
        items={[
          { label: 'ρ(T) = máx |λᵢ|', value: fmt(c.rho, 6), accent: true },
          { label: '‖T‖∞', value: fmt(nT, 6), hint: nT < 1 ? '< 1 ⇒ contracción' : '≥ 1 (no concluyente)' },
          { label: 'Cota a priori', value: Number.isFinite(kMin) ? `k ≥ ${Math.max(kMin, 1)}` : '—', hint: '‖T‖ᵏ/(1−‖T‖)·‖x⁽¹⁾−x⁽⁰⁾‖∞ < eps' },
        ]}
      />
      {c.cs && (
        <Note>
          Condición del texto con la matriz C de Gauss-Jacobi: sumas por filas Σⱼ|cᵢⱼ| = ({c.cs.row.map((v) => fmt(v, 4)).join(', ')}) {c.cs.rowOk ? '< 1 ✓' : '— no todas < 1'}; sumas por
          columnas Σᵢ|cᵢⱼ| = ({c.cs.col.map((v) => fmt(v, 4)).join(', ')}) {c.cs.colOk ? '< 1 ✓' : '— no todas < 1'}.
        </Note>
      )}
      {c.eig && (
        <div style={{ marginTop: 12 }}>
          <DataTable
            filename="valores_propios_T"
            columns={[
              { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
              { key: 're', tex: '\\operatorname{Re}\\lambda_i' },
              { key: 'im', tex: '\\operatorname{Im}\\lambda_i' },
              { key: 'mod', tex: '|\\lambda_i|' },
            ]}
            rows={c.eig.map((e, i) => ({ i: i + 1, re: e.re, im: e.im, mod: Math.hypot(e.re, e.im) }))}
            highlight={(_, i) => i === 0}
          />
        </div>
      )}
      <Note>Complemento (Burden): valores propios calculados con el algoritmo QR (equivalente a spec(T) en Scilab). El método converge para todo x⁽⁰⁾ si y sólo si ρ(T) &lt; 1.</Note>
    </>
  )
}

function Compare({ c, s }: { c: Calc; s: S }) {
  const out = useMemo(() => {
    const { A: Am, b } = c.sys
    const rhoJ = A.rhoOf(Am, b, 'jacobi')
    const rhoGS = A.rhoOf(Am, b, 'gs', 1)
    const wopt = A.omegaOptimo(rhoJ)
    const maxIter = Math.min(Math.max(s.maxIter, 50), 2000)
    const o = { tol: c.tol, maxIter, crit: s.crit, norm: s.norm }
    const runs = [
      { name: 'Gauss-Jacobi', rho: rhoJ, res: A.iterativo(Am, b, c.x0, { ...o, method: 'jacobi', omega: 1 }) },
      { name: 'Gauss-Seidel', rho: rhoGS, res: A.iterativo(Am, b, c.x0, { ...o, method: 'gs', omega: 1 }) },
    ]
    if (Number.isFinite(wopt) && wopt > 1.0001) runs.push({ name: `SOR ω_opt = ${fmt(wopt, 5)}`, rho: A.rhoOf(Am, b, 'gs', wopt), res: A.iterativo(Am, b, c.x0, { ...o, method: 'gs', omega: wopt }) })
    if (c.omega !== 1 && Math.abs(c.omega - wopt) > 1e-6) runs.push({ name: `SOR ω = ${fmt(c.omega, 5)}`, rho: A.rhoOf(Am, b, 'gs', c.omega), res: A.iterativo(Am, b, c.x0, { ...o, method: 'gs', omega: c.omega }) })
    const ws = Array.from({ length: 79 }, (_, i) => 0.025 * (i + 1))
    const rw = ws.map((w) => A.rhoOf(Am, b, 'gs', w))
    return { runs, wopt, ws, rw, rhoJ, rhoGS }
  }, [c, s.maxIter, s.crit, s.norm])
  const errData = out.runs.map(
    (r, i) => ({ x: r.res.rows.slice(1).map((q) => q.k), y: r.res.rows.slice(1).map((q) => (q.err > 0 ? q.err : null)), type: 'scatter', mode: 'lines+markers', name: r.name, line: { color: SERIES[i] }, marker: { size: 4 } }) as Trace,
  )
  const best = out.rw.reduce((p, v, i) => (v < out.rw[p] ? i : p), 0)
  const rhoData: Trace[] = [
    { x: out.ws, y: out.rw, type: 'scatter', mode: 'lines', name: 'ρ(T_ω)', line: { color: SERIES[0], width: 2.5 } },
    { x: [0, 2], y: [1, 1], type: 'scatter', mode: 'lines', name: 'ρ = 1', line: { color: SERIES[6], dash: 'dot', width: 1 } },
    { x: [out.ws[best]], y: [out.rw[best]], type: 'scatter', mode: 'markers+text', text: [`mín: ω ≈ ${fmt(out.ws[best], 3)}`], textposition: 'top center', name: 'ω con menor ρ', marker: { color: SERIES[3], size: 10 } },
  ]
  return (
    <>
      <DataTable
        filename="comparacion_iterativos"
        columns={[
          { key: 'name', label: 'Método', align: 'left' },
          { key: 'rho', tex: '\\rho(T)' },
          { key: 'n', label: 'Iteraciones', fmt: 'int' },
          { key: 'st', label: 'Estado', align: 'left' },
        ]}
        rows={out.runs.map((r) => ({ name: r.name, rho: r.rho, n: r.res.rows.length - 1, st: r.res.converged ? '✓ convergió' : '✗ no convergió' }))}
      />
      <div style={{ marginTop: 14 }}>
        <Plot data={errData} layout={{ yaxis: { type: 'log', title: { text: `‖x⁽ᵏ⁾ − x⁽ᵏ⁻¹⁾‖${NORM_TXT[s.norm]}` }, exponentformat: 'power' }, xaxis: { title: { text: 'k' } } }} />
      </div>
      <div style={{ marginTop: 14 }}>
        <Plot data={rhoData} height={300} layout={{ xaxis: { title: { text: 'ω' }, range: [0, 2] }, yaxis: { title: { text: 'ρ(T_ω)' } } }} />
      </div>
      <Note>
        {Number.isFinite(out.rhoJ) && Number.isFinite(out.rhoGS) && (
          <>
            ρ(T_J) = {fmt(out.rhoJ, 5)}, ρ(T_GS) = {fmt(out.rhoGS, 5)}
            {Math.abs(out.rhoGS - out.rhoJ ** 2) < 1e-6 * Math.max(1, out.rhoGS) ? ' = ρ(T_J)² (matriz consistentemente ordenada, p. ej. tridiagonal).' : '.'}{' '}
          </>
        )}
        {Number.isFinite(out.wopt) && <>Fórmula ω_opt = 2/(1+√(1−ρ(T_J)²)) = {fmt(out.wopt, 6)} (exacta para matrices tridiagonales definidas positivas). </>}
        La curva muestra ρ(T_ω) calculado numéricamente para cada ω.
      </Note>
    </>
  )
}

function scilabIter(c: Calc, s: S, method: A.IterMethod): string {
  const w = c.omega
  const title = method === 'jacobi' ? 'Método de Gauss-Jacobi' : w === 1 ? 'Método de Gauss-Seidel' : `Método SOR (omega = ${w})`
  const nrm = s.norm === '2' ? 'norm(xn - x)' : s.norm === 'inf' ? 'norm(xn - x, %inf)' : 'norm(xn - x, 1)'
  const nrmX = s.norm === '2' ? 'norm(xn)' : s.norm === 'inf' ? 'norm(xn, %inf)' : 'norm(xn, 1)'
  const errExpr = s.crit === 'rel' ? `${nrm} / ${nrmX}` : nrm
  // sumas con bucle explícito: en Scilab 6, b(i) - A(i,1:0)*x(1:0) daría [] en lugar de b(i)
  const upd =
    method === 'jacobi'
      ? `    s = b(i);
    for j = [1:i-1, i+1:n]
      s = s - A(i, j) * x(j);       // sólo valores de la iteración anterior
    end
    xn(i) = s / A(i, i);`
      : `    s = b(i);
    for j = 1:i-1
      s = s - A(i, j) * xn(j);      // componentes ya actualizadas (k+1)
    end
    for j = i+1:n
      s = s - A(i, j) * x(j);       // componentes de la iteración k
    end
    xn(i) = (1 - w) * x(i) + w * s / A(i, i);`
  const T = method === 'jacobi' ? 'C = -inv(D) * (L + U);          // x = C*x + D0 (matriz C del texto)' : 'C = inv(D + w*L) * ((1 - w)*D - w*U);   // matriz de iteración de GS/SOR'
  return `// ${title} — generado por NumLab
clear; clc;
A = ${sciMat(c.sys.A)};
b = ${sciVec(c.sys.b)};
x = ${sciVec(c.x0)};     // vector inicial x(0)
eps_ = ${s.tol}; maxit = ${s.maxIter};${method === 'gs' ? `\nw = ${w};            // factor de relajación (1 = Gauss-Seidel)` : ''}
n = size(A, 1);

// Condición suficiente: diagonal estrictamente dominante por filas o por columnas
d = abs(diag(A));
filas = and(d > sum(abs(A), "c") - d);
columnas = and(d > sum(abs(A), "r")' - d);
if filas | columnas then
  disp('Se cumple la condición suficiente: el método converge');
else
  disp('No se cumple la condición suficiente: puede o no converger');
end
// Complemento: matriz de iteración y radio espectral
D = diag(diag(A)); L = tril(A, -1); U = triu(A, 1);
${T}
mprintf('Radio espectral rho = %.8f\\n', max(abs(spec(C))));

errs = [];
mprintf('%4s', 'k'); mprintf('%14s', 'x' + string((1:n)')); mprintf('%14s\\n', 'error');
for k = 1:maxit
  xn = x;
  for i = 1:n
${upd}
  end
  err = ${errExpr};
  errs = [errs err];
  mprintf('%4d', k); mprintf('%14.8f', xn); mprintf('%14.3e\\n', err);
  x = xn;
  if err < eps_ then break; end
end
disp('Solución aproximada x ='); disp(x);
disp('Verificación A\\b ='); disp(A \\ b);
// Gráfica del error (escala logarítmica)
plot2d(1:length(errs), errs, logflag="nl", style=2);
xtitle('Error vs iteración', 'k', '||x(k) - x(k-1)||');
`
}
