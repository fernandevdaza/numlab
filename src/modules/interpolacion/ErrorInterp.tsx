// Estimación del error de interpolación (Cap. 4.3 del texto): punto adicional (4.31), cota con la derivada (4.35) y error real.
import { useMemo, type ReactNode } from 'react'
import { evalNumber, math, toScilab, toTex, type Compiled } from '../../lib/expr'
import { fmt, fmtErr, linspace } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, MethodPage, NumField, ScilabCode, Stats, Steps, Tabs } from '../../components/ui'
import * as A from './algorithms'
import { DataInput, DATA_DEFAULTS, parseData, type DataState, type ParsedData } from './DataInput'
import { taylorDerivative } from './taylor'
import { sci, sciVec, sub, texDiff, tn, tp } from './texutil'
import { THEORY, TITLES, TOPIC } from './theory'
import { L } from '../../i18n'

interface ErrState extends DataState {
  /** punto adicional x_{n+1} para la estimación (4.31) ('' = no usar) */
  xext: string
}

const EXAMPLES: { label: string; value: Partial<ErrState> }[] = [
  { label: L('Ej. 4.11 · log x, P₃(2.3), punto extra 2.7', 'Ex. 4.11 · log x, P₃(2.3), extra point 2.7'), value: { xs: '1.2 1.6 2.1 2.5', f: 'log10(x)', xbar: '2.3', xext: '2.7' } },
  { label: L('Práctica 5 · sen²x, P₃(2.15), extra 2.5', 'Practice 5 · sin²x, P₃(2.15), extra 2.5'), value: { xs: '2 2.1 2.2 2.3', f: 'sin(x)^2', xbar: '2.15', xext: '2.5' } },
  { label: L('1/x en 2, 2.75, 4 → x̄ = 3', '1/x at 2, 2.75, 4 → x̄ = 3'), value: { xs: '2 2.75 4', f: '1/x', xbar: '3', xext: '' } },
  { label: L('eˣ en 0, 0.5, 1 → x̄ = 0.25', 'eˣ at 0, 0.5, 1 → x̄ = 0.25'), value: { xs: '0 0.5 1', f: 'exp(x)', xbar: '0.25', xext: '0.75' } },
  { label: L('sen x en 0, π/4, π/2 → x̄ = π/6', 'sin x at 0, π/4, π/2 → x̄ = π/6'), value: { xs: '0 pi/4 pi/2', f: 'sin(x)', xbar: 'pi/6', xext: '' } },
  { label: L('Runge, 5 nodos → x̄ = 0.9', 'Runge, 5 nodes → x̄ = 0.9'), value: { xs: '-1 -0.5 0 0.5 1', f: '1/(1+25x^2)', xbar: '0.9', xext: '' } },
]

const DEFAULTS: ErrState = { ...DATA_DEFAULTS, mode: 'funcion', frac: false, xs: '1.2 1.6 2.1 2.5', f: 'log10(x)', xbar: '2.3', xext: '2.7' }

interface Calc {
  error?: string
  data?: ParsedData
  f?: Compiled
  a?: number[]
  n?: number
  dn?: (x: number) => number
  dSym?: { tex: string; sci: string } | null
  I?: [number, number]
  M?: { max: number; at: number; min: number; minAt: number }
  fact?: number
  W?: number
  realMax?: number
  at?: { w: number; px: number; fx: number; real: number; bound: number; lower: number; xi: number[] }
  /** estimación (4.31) con un punto adicional */
  ext?: { xe: number; ye: number; dd: number; w: number; value: number }
}

/** Intenta derivar simbólicamente con un presupuesto de tiempo (solo para mostrar la fórmula). */
function symbolicDeriv(c: Compiled, order: number, budgetMs = 400): { tex: string; sci: string } | null {
  if (order > 4 || c.src.length > 60) return null
  const t0 = performance.now()
  try {
    let node = c.node
    for (let k = 0; k < order; k++) {
      node = math.derivative(node, 'x')
      if (node.toString().length > 400) return null
      node = math.simplify(node)
      if (performance.now() - t0 > budgetMs && k < order - 1) return null
    }
    const tex = toTex(node)
    return tex.length > 700 ? null : { tex, sci: toScilab(node, true) }
  } catch {
    return null
  }
}

export function compute(s: ErrState): Calc {
  const data = parseData({ ...s, mode: 'funcion' }, { max: 16 })
  if (data.error) return { error: data.error }
  const f = data.f!
  const { xs, ys, xbar } = data
  const n = xs.length - 1
  const a = A.dividedDifferences(xs, ys)[0]
  let dn: (x: number) => number
  try {
    dn = taylorDerivative(f.node, n + 1)
  } catch (e: any) {
    return { error: (e?.message ?? String(e)) + L('. No se puede calcular f^(n+1).', '. f^(n+1) cannot be computed.') }
  }
  const pts = Number.isFinite(xbar) ? [...xs, xbar] : xs
  const I: [number, number] = [Math.min(...pts), Math.max(...pts)]
  const M = A.maxAbsSample(dn, I[0], I[1], 4000)
  if (!Number.isFinite(M.max)) return {
      error: L(
        `f^(${n + 1}) no es finita en [${fmt(I[0])}, ${fmt(I[1])}]: f no es suficientemente suave en el intervalo.`,
        `f^(${n + 1}) is not finite on [${fmt(I[0])}, ${fmt(I[1])}]: f is not smooth enough on the interval.`,
      ),
    }
  const fact = A.factorial(n + 1)
  const W = A.maxAbsSample((x) => A.nodeProduct(xs, x), I[0], I[1], 4000).max
  const P = (x: number) => A.newtonEval(xs, a, x)
  const realMax = A.maxAbsSample((x) => f.f(x) - P(x), I[0], I[1], 4000).max
  const out: Calc = { data, f, a, n, dn, I, M, fact, W, realMax, dSym: symbolicDeriv(f, n + 1) }
  if (Number.isFinite(xbar)) {
    const w = A.nodeProduct(xs, xbar)
    const px = P(xbar)
    const fx = f.f(xbar)
    const real = Math.abs(fx - px)
    // ξ tal que f^{(n+1)}(ξ) = (n+1)!(f − P)(x̄)/w(x̄)
    const xi: number[] = []
    if (w !== 0) {
      const target = (fact * (fx - px)) / w
      const N = 2000
      let prev = dn(I[0]) - target
      for (let k = 1; k <= N && xi.length < 4; k++) {
        const x = I[0] + ((I[1] - I[0]) * k) / N
        const cur = dn(x) - target
        if (Number.isFinite(prev) && Number.isFinite(cur) && prev * cur <= 0) {
          const x1 = x - (I[1] - I[0]) / N
          xi.push(prev === cur ? x : x1 + ((x - x1) * prev) / (prev - cur))
        }
        prev = cur
      }
    }
    out.at = { w, px, fx, real, bound: (M.max / fact) * Math.abs(w), lower: (M.min / fact) * Math.abs(w), xi }
    if ((s.xext ?? '').trim()) {
      const xe = evalNumber(s.xext)
      if (!Number.isFinite(xe)) return { error: L('El punto adicional x₍ₙ₊₁₎ es inválido.', 'The extra point x₍ₙ₊₁₎ is invalid.') }
      if (A.duplicateNodes([...xs, xe])) return { error: L('El punto adicional debe ser distinto de los nodos.', 'The extra point must be different from the nodes.') }
      const ye = f.f(xe)
      if (!Number.isFinite(ye)) return { error: L(`f no está definida en el punto adicional x = ${fmt(xe)}.`, `f is not defined at the extra point x = ${fmt(xe)}.`) }
      out.ext = { xe, ye, ...A.extraPointEstimate(xs, ys, xe, ye, xbar) }
    }
  }
  return out
}

export function ErrorInterp() {
  const [s0, setS] = useLocalState<ErrState>('interpolacion:error-interpolacion', DEFAULTS)
  const s: ErrState = useMemo(() => ({ ...s0, xext: s0.xext ?? '' }), [s0])
  const set = (p: Partial<ErrState>) => setS((prev) => ({ ...prev, ...p }))
  const d = useDebounced(s, 250)
  const c = useMemo(() => compute(d), [d])
  return (
    <MethodPage
      title={TITLES['error-interpolacion']}
      topic={TOPIC}
      theory={THEORY['error-interpolacion']}
      description={L(
        'Estima el error del polinomio de interpolación con un punto adicional (4.31) y lo mayora con el máximo de la derivada (4.35); lo compara con el error real.',
        'Estimates the error of the interpolating polynomial with an extra point (4.31), bounds it with the maximum of the derivative (4.35), and compares it with the actual error.',
      )}
      inputs={
        <>
          <DataInput s={s} set={set} requireF showFrac={false} xbarLabel={L('Punto de análisis x̄ =', 'Evaluation point x̄ =')} />
          <NumField
            label={L(<>Punto adicional <Tex>{'x_{n+1}'}</Tex> (opcional)</>, <>Extra point <Tex>{'x_{n+1}'}</Tex> (optional)</>)}
            value={s.xext}
            onChange={(xext) => set({ xext })}
            hint={L('Para la estimación (4.31); su valor se toma de f.', 'For the estimate (4.31); its value is taken from f.')}
          />
          <Examples items={EXAMPLES} onPick={(v) => set({ ...v, mode: 'funcion' })} />
        </>
      }
    >
      {c.error ? <Alert kind="error">{c.error}</Alert> : c.data && <Results c={c as Required<Calc>} s={d} />}
    </MethodPage>
  )
}

function Results({ c, s }: { c: Required<Calc>; s: ErrState }) {
  const { xs, xbar } = c.data
  const n = c.n
  const stats: { label: ReactNode; value: ReactNode; hint?: ReactNode; accent?: boolean }[] = []
  if (c.at) {
    stats.push({ label: `P${sub(n)}(x̄)`, value: fmt(c.at.px, 10), hint: `f(x̄) = ${fmt(c.at.fx, 10)}` })
    stats.push({ label: L('Error real f(x̄) − P(x̄)', 'Actual error f(x̄) − P(x̄)'), value: fmtErr(c.at.fx - c.at.px), accent: true })
    if (c.ext) stats.push({ label: L('Estimación con punto adicional', 'Estimate with extra point'), value: fmtErr(c.ext.value), hint: `(4.31) ${L('con', 'with')} x${sub(n + 1)} = ${fmt(c.ext.xe, 6)}` })
    stats.push({
      label: L('Cota (4.35) en x̄', 'Bound (4.35) at x̄'),
      value: fmtErr(c.at.bound),
      hint: c.at.real <= c.at.bound * (1 + 1e-9) + 1e-15 ? L('✓ el error real la respeta', '✓ the actual error satisfies it') : L('⚠ revisar', '⚠ check'),
    })
  }
  stats.push({ label: `M${sub(n + 1)} = ${L('máx', 'max')} |f⁽${n + 1}⁾|`, value: fmt(c.M.max, 8), hint: `${L('en', 'at')} x ≈ ${fmt(c.M.at, 6)}` })
  stats.push({ label: L('Cota global en el intervalo', 'Global bound on the interval'), value: fmtErr((c.M.max / c.fact) * c.W), hint: L('error real máx: ', 'max actual error: ') + fmtErr(c.realMax) })

  return (
    <>
      <Stats items={stats} />
      {c.at && c.at.xi.length > 0 && (
        <Alert kind="info">
          {L(
            <>
              Valor(es) de <Tex>\xi</Tex> que hacen exacta la fórmula del error en x̄: <b>{c.at.xi.map((v) => fmt(v, 8)).join(', ')}</b> (dentro de [{fmt(c.I[0])}, {fmt(c.I[1])}], como
              garantiza el teorema).
            </>,
            <>
              Value(s) of <Tex>\xi</Tex> that make the error formula exact at x̄: <b>{c.at.xi.map((v) => fmt(v, 8)).join(', ')}</b> (inside [{fmt(c.I[0])}, {fmt(c.I[1])}], as the theorem
              guarantees).
            </>,
          )}
        </Alert>
      )}
      <Tabs
        tabs={[
          { label: L('Error vs. cota', 'Error vs. bound'), content: <Card><ErrPlot c={c} /></Card> },
          { label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={steps(c)} /></Card> },
          { label: L('f y P(x)', 'f and P(x)'), content: <Card><FPPlot c={c} /></Card> },
          { label: `f⁽${n + 1}⁾(x)`, content: <Card><DerivPlot c={c} /></Card> },
        ]}
      />
      <Card title={L('Tabla: error real y cota en puntos del intervalo', 'Table: actual error and bound at points of the interval')}>
        <DataTable
          filename="error_interpolacion"
          columns={[
            { key: 'x', tex: 'x' },
            { key: 'fx', tex: 'f(x)' },
            { key: 'px', tex: 'P_n(x)' },
            { key: 'w', tex: '\\prod(x-x_i)', fmt: 'err' },
            { key: 'real', tex: '|f(x)-P_n(x)|', fmt: 'err' },
            { key: 'bound', tex: '\\frac{M_{n+1}}{(n+1)!}|\\prod(x-x_i)|', fmt: 'err' },
          ]}
          rows={[...linspace(c.I[0], c.I[1], 21), ...(Number.isFinite(xbar) ? [xbar] : [])]
            .sort((p, q) => p - q)
            .map((x) => {
              const px = A.newtonEval(xs, c.a, x)
              const fx = c.f.f(x)
              const w = A.nodeProduct(xs, x)
              return { x, fx, px, w, real: Math.abs(fx - px), bound: (c.M.max / c.fact) * Math.abs(w) }
            })}
          highlight={(r) => r.x === xbar}
        />
      </Card>
      <ScilabCode code={scilab(c, s)} filename="error_interpolacion" />
    </>
  )
}

function ErrPlot({ c }: { c: Required<Calc> }) {
  const data = useMemo(() => {
    const { xs, xbar } = c.data
    const [a, b] = c.I
    const K = c.M.max / c.fact
    const e = sample((x) => Math.abs(c.f.f(x) - A.newtonEval(xs, c.a, x)), a, b, 800)
    const bd = sample((x) => K * Math.abs(A.nodeProduct(xs, x)), a, b, 800)
    const pos = (v: (number | null)[]) => v.map((t) => (t !== null && t > 0 ? t : null))
    const t: Trace[] = [
      { x: bd.x, y: pos(bd.y), type: 'scatter', mode: 'lines', name: L('cota  M·|∏(x − xᵢ)|/(n+1)!', 'bound  M·|∏(x − xᵢ)|/(n+1)!'), line: { color: SERIES[1], width: 2, dash: 'dash' } },
      { x: e.x, y: pos(e.y), type: 'scatter', mode: 'lines', name: L('error real |f − P|', 'actual error |f − P|'), line: { color: SERIES[0], width: 2.5 } },
    ]
    if (c.M.min > 1e-10 * c.M.max) {
      const lw = sample((x) => (c.M.min / c.fact) * Math.abs(A.nodeProduct(xs, x)), a, b, 800)
      t.push({ x: lw.x, y: pos(lw.y), type: 'scatter', mode: 'lines', name: L('cota inferior m·|∏|/(n+1)!', 'lower bound m·|∏|/(n+1)!'), line: { color: SERIES[2], width: 1.3, dash: 'dot' } })
    }
    if (c.at && c.at.real > 0) t.push({ x: [xbar], y: [c.at.real], type: 'scatter', mode: 'markers', name: 'x̄', marker: { color: SERIES[5], size: 12, symbol: 'star' } })
    return t
  }, [c])
  return (
    <>
      <Plot data={data} layout={{ yaxis: { type: 'log', title: { text: L('error (escala log)', 'error (log scale)') }, exponentformat: 'power' }, xaxis: { title: { text: 'x' } } }} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        {L(
          <>
            El error real siempre queda por debajo de la cota. Ambos se anulan en los nodos. Si <Tex>{'f^{(n+1)}'}</Tex> no cambia de signo en el intervalo, el error también queda
            por encima de la cota inferior.
          </>,
          <>
            The actual error always stays below the bound. Both vanish at the nodes. If <Tex>{'f^{(n+1)}'}</Tex> does not change sign on the interval, the error also stays above the
            lower bound.
          </>,
        )}
      </p>
    </>
  )
}

function FPPlot({ c }: { c: Required<Calc> }) {
  const data = useMemo(() => {
    const { xs, ys, xbar } = c.data
    const [a0, b0] = c.I
    const pad = (b0 - a0) * 0.08 || 1
    const t: Trace[] = [
      { ...sample(c.f.f, a0 - pad, b0 + pad), type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: SERIES[1], width: 2, dash: 'dash' } },
      { ...sample((x) => A.newtonEval(xs, c.a, x), a0 - pad, b0 + pad), type: 'scatter', mode: 'lines', name: `P${sub(c.n)}(x)`, line: { color: SERIES[0], width: 2.5 } },
      { x: xs, y: ys, type: 'scatter', mode: 'markers', name: L('nodos', 'nodes'), marker: { color: SERIES[3], size: 9 } },
    ]
    if (c.at) t.push({ x: [xbar], y: [c.at.px], type: 'scatter', mode: 'markers', name: 'P(x̄)', marker: { color: SERIES[5], size: 12, symbol: 'star' } })
    return t
  }, [c])
  return <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
}

function DerivPlot({ c }: { c: Required<Calc> }) {
  const data = useMemo(() => {
    const [a, b] = c.I
    const ds = sample(c.dn, a, b, 600)
    return [
      { ...ds, type: 'scatter', mode: 'lines', name: `f⁽${c.n + 1}⁾(x)`, line: { color: SERIES[2], width: 2.5 } },
      { x: [a, b], y: [c.M.max, c.M.max], type: 'scatter', mode: 'lines', name: `+M${sub(c.n + 1)}`, line: { color: SERIES[6], dash: 'dash', width: 1.3 } },
      { x: [a, b], y: [-c.M.max, -c.M.max], type: 'scatter', mode: 'lines', name: `−M${sub(c.n + 1)}`, line: { color: SERIES[6], dash: 'dash', width: 1.3 } },
      { x: [c.M.at], y: [c.dn(c.M.at)], type: 'scatter', mode: 'markers', name: L('máximo de |f⁽ⁿ⁺¹⁾|', 'maximum of |f⁽ⁿ⁺¹⁾|'), marker: { color: SERIES[5], size: 11, symbol: 'diamond' } },
    ] as Trace[]
  }, [c])
  return (
    <>
      <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        {L(
          `La derivada de orden ${c.n + 1} se calcula exactamente (diferenciación automática por series de Taylor) y su máximo en valor absoluto se estima muestreando 4001 puntos del intervalo.`,
          `The derivative of order ${c.n + 1} is computed exactly (automatic differentiation with Taylor series) and its maximum absolute value is estimated by sampling 4001 points of the interval.`,
        )}
      </p>
    </>
  )
}

export function steps(c: Required<Calc>) {
  const { xs, ys, xbar } = c.data
  const n = c.n
  const N = (x: number) => tn(x, false, 10)
  const out: { text?: ReactNode; tex?: string }[] = []
  out.push({ text: L('Valores en los nodos:', 'Values at the nodes:'), tex: xs.map((x, i) => `f(${N(x)}) = ${N(ys[i])}`).join(',\\quad ') })
  const terms = c.a
    .slice(0, 8)
    .map((ak, k) => `${k === 0 ? '' : ak < 0 ? ' - ' : ' + '}${tn(k === 0 ? ak : Math.abs(ak), false, 8)}${xs.slice(0, k).map((x) => (x === 0 ? 'x' : x > 0 ? `(x-${N(x)})` : `(x+${N(-x)})`)).join('')}`)
    .join('')
  out.push({ text: L(`Polinomio interpolante de grado ${n} (forma de Newton):`, `Interpolating polynomial of degree ${n} (Newton form):`), tex: `P_{${n}}(x) = ${terms}${c.a.length > 8 ? '+\\cdots' : ''}` })
  if (c.at) out.push({ text: L(`Se evalúa en x̄ = ${fmt(xbar)}:`, `Evaluate at x̄ = ${fmt(xbar)}:`), tex: `P_{${n}}(${N(xbar)}) = ${N(c.at.px)}` })
  if (c.at && c.ext) {
    const xe = c.ext.xe
    out.push({
      text: L(
        `Estimación (4.31): se añade el dato (x${sub(n + 1)}, f(x${sub(n + 1)})) = (${fmt(xe)}, ${fmt(c.ext.ye, 8)}) y se calcula la diferencia dividida de orden ${n + 1}:`,
        `Estimate (4.31): add the data point (x${sub(n + 1)}, f(x${sub(n + 1)})) = (${fmt(xe)}, ${fmt(c.ext.ye, 8)}) and compute the divided difference of order ${n + 1}:`,
      ),
      tex: `f[x_0,\\dots,x_{${n + 1}}] = ${N(c.ext.dd)}`,
    })
    out.push({
      tex: `R_{${n}}(\\bar x) \\approx \\prod_{i=0}^{${n}}(\\bar x - x_i)\\,f[x_0,\\dots,x_{${n + 1}}] = ${xs.slice(0, 8).map((x) => texDiff(xbar, x)).join('')}${xs.length > 8 ? '\\cdots' : ''}\\cdot${tp(c.ext.dd, false, 10)} = ${tn(c.ext.value, false, 6)}`,
    })
  }
  out.push({
    text: L(`Estimación (4.35) con la derivada de orden n + 1 = ${n + 1}:`, `Estimate (4.35) with the derivative of order n + 1 = ${n + 1}:`),
    tex: c.dSym
      ? `f^{(${n + 1})}(x) = ${c.dSym.tex}`
      : `f^{(${n + 1})}(x)\\;\\text{${L('(expresión extensa; se evalúa numéricamente de forma exacta)', '(lengthy expression; evaluated numerically, exactly)')}}`,
  })
  out.push({
    text: L(`Máximo de |f⁽${n + 1}⁾| en [${fmt(c.I[0])}, ${fmt(c.I[1])}] (muestreo denso):`, `Maximum of |f⁽${n + 1}⁾| on [${fmt(c.I[0])}, ${fmt(c.I[1])}] (dense sampling):`),
    tex: `M_{${n + 1}} = \\max_{t\\in[${N(c.I[0])},\\,${N(c.I[1])}]} |f^{(${n + 1})}(t)| \\approx |f^{(${n + 1})}(${N(c.M.at)})| = ${N(c.M.max)},\\qquad m_{${n + 1}} = \\min|f^{(${n + 1})}| \\approx ${N(c.M.min)}`,
  })
  out.push({ tex: `(n+1)! = ${n + 1}! = ${c.fact}` })
  if (c.at) {
    const fac = xs.slice(0, 10).map((x) => texDiff(xbar, x)).join('')
    out.push({ text: L(`Producto de los factores nodales en x̄ = ${fmt(xbar)}:`, `Product of the nodal factors at x̄ = ${fmt(xbar)}:`), tex: `\\prod_{i=0}^{${n}}(\\bar x - x_i) = ${fac}${xs.length > 10 ? '\\cdots' : ''} = ${N(c.at.w)}` })
    out.push({
      text: L('Cota del error (4.35):', 'Error bound (4.35):'),
      tex: `|f(\\bar x) - P_{${n}}(\\bar x)| \\le \\frac{M_{${n + 1}}}{(${n + 1})!}\\left|\\prod(\\bar x - x_i)\\right| = \\frac{${N(c.M.max)}}{${c.fact}}\\cdot ${N(Math.abs(c.at.w))} = ${tn(c.at.bound, false, 6)}`,
    })
    if (c.M.min > 1e-10 * c.M.max) out.push({ text: L('Cota inferior (la derivada no se anula en el intervalo):', 'Lower bound (the derivative does not vanish on the interval):'), tex: `|f(\\bar x) - P_{${n}}(\\bar x)| \\ge \\frac{${N(c.M.min)}}{${c.fact}}\\cdot ${N(Math.abs(c.at.w))} = ${tn(c.at.lower, false, 6)}` })
    out.push({
      text: L('Error real (f es conocida):', 'Actual error (f is known):'),
      tex: `f(\\bar x) - P_{${n}}(\\bar x) = ${N(c.at.fx)} - ${tp(c.at.px, false, 10)} = ${tn(c.at.fx - c.at.px, false, 6)},\\qquad |R_{${n}}| = ${tn(c.at.real, false, 6)} ${c.at.real <= c.at.bound * (1 + 1e-9) + 1e-15 ? '\\le' : '>'} ${tn(c.at.bound, false, 6)}\\;${c.at.real <= c.at.bound * (1 + 1e-9) + 1e-15 ? '\\checkmark' : ''}`,
    })
  }
  out.push({
    text: L('Cota global en todo el intervalo:', 'Global bound over the whole interval:'),
    tex: `\\max|f - P_{${n}}| \\le \\frac{M_{${n + 1}}}{(${n + 1})!}\\max_x\\left|\\prod(x - x_i)\\right| = \\frac{${N(c.M.max)}}{${c.fact}}\\cdot ${N(c.W)} = ${tn((c.M.max / c.fact) * c.W, false, 6)}`,
  })
  return out
}

export function scilab(c: Required<Calc>, s: ErrState): string {
  const { xs, xbar } = c.data
  const n = c.n
  const xb = Number.isFinite(xbar) ? sci(xbar) : sci((xs[0] + xs[1]) / 2)
  // derivada (n+1): simbólica si está disponible; si no, se aproxima numéricamente
  const dnode = c.dSym ? c.dSym.sci : null
  return `// ${L('Error de interpolacion — generado por NumLab', 'Interpolation error — generated by NumLab')}
clear; clc;
function y = f(x)
  y = ${toScilab(c.f.src, true)};
endfunction
${
  dnode
    ? `function y = dnf(x)   // ${L('derivada de orden', 'derivative of order')} n+1 = ${n + 1}
  y = ${dnode};
endfunction`
    : `${L(
        `// Derivada de orden n+1 = ${n + 1}: expresion extensa; se aproxima con diferencias
// finitas centradas de orden ${n + 1} (puede perder precision para ordenes altos)`,
        `// Derivative of order n+1 = ${n + 1}: lengthy expression; approximated with centered
// finite differences of order ${n + 1} (may lose accuracy for high orders)`,
      )}
function y = dnf(x)
  k = ${n + 1}; hh = %eps^(1/(k+2));   // ${L('paso que equilibra truncamiento y redondeo', 'step that balances truncation and round-off')}
  y = zeros(x);
  for j = 0:k
    y = y + (-1)^j * factorial(k)/(factorial(j)*factorial(k-j)) * f(x + (k/2 - j)*hh);
  end
  y = y / hh^k;
endfunction`
}

x = ${sciVec(xs)};
y = f(x);
xb = ${xb};
n = length(x) - 1;

// ${L('Polinomio interpolante (diferencias divididas)', 'Interpolating polynomial (divided differences)')}
D = zeros(n+1, n+1); D(:, 1) = y(:);
for j = 2:n+1
  for i = 1:n+2-j
    D(i, j) = (D(i+1, j-1) - D(i, j-1)) / (x(i+j-1) - x(i));
  end
end
px = poly(0, 'x'); P = D(1, n+1);
for k = n:-1:1
  P = P * (px - x(k)) + D(1, k);
end
disp(P);

// ${L('Cota del error', 'Error bound')}
a = min([x, xb]); b = max([x, xb]);
t = linspace(a, b, 4001);
M = max(abs(dnf(t)));
w = prod(xb - x);
cota = M / factorial(n+1) * abs(w);
err_real = abs(f(xb) - horner(P, xb));
mprintf('M_%d = %.10f\\n', n+1, M);
mprintf('prod(xb - xi) = %.10f\\n', w);
mprintf('${L('Cota: %.6e    Error real: %.6e', 'Bound: %.6e    Actual error: %.6e')}\\n', cota, err_real);
${
  c.ext
    ? `
// ${L('Estimacion (4.31) con un punto adicional', 'Estimate (4.31) with an extra point')} x_(n+1)
xe = ${sci(c.ext.xe)};
xa = [x, xe]; ya = f(xa);
E = zeros(n+2, n+2); E(:, 1) = ya(:);
for j = 2:n+2
  for i = 1:n+3-j
    E(i, j) = (E(i+1, j-1) - E(i, j-1)) / (xa(i+j-1) - xa(i));
  end
end
R = prod(xb - x) * E(1, n+2);
mprintf('${L('Estimacion con punto adicional', 'Estimate with extra point')}: f[x0..x%d] = %.10f,  R ~ %.6e\\n', n+1, E(1, n+2), R);
`
    : ''
}
// ${L('Grafica: error real vs cota', 'Plot: actual error vs bound')}
W = ones(t);
for i = 1:n+1
  W = W .* (t - x(i));
end
clf();
plot(t, abs(f(t) - horner(P, t)), 'b-');
plot(t, M / factorial(n+1) * abs(W), 'r--');
xgrid();
legend(['|f - P|', '${L('cota', 'bound')}']);
title('${L('Error de interpolacion', 'Interpolation error')}');
`
}
