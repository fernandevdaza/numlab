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

interface ErrState extends DataState {
  /** punto adicional x_{n+1} para la estimación (4.31) ('' = no usar) */
  xext: string
}

const EXAMPLES: { label: string; value: Partial<ErrState> }[] = [
  { label: 'Ej. 4.11 · log x, P₃(2.3), punto extra 2.7', value: { xs: '1.2 1.6 2.1 2.5', f: 'log10(x)', xbar: '2.3', xext: '2.7' } },
  { label: 'Práctica 5 · sen²x, P₃(2.15), extra 2.5', value: { xs: '2 2.1 2.2 2.3', f: 'sin(x)^2', xbar: '2.15', xext: '2.5' } },
  { label: '1/x en 2, 2.75, 4 → x̄ = 3', value: { xs: '2 2.75 4', f: '1/x', xbar: '3', xext: '' } },
  { label: 'eˣ en 0, 0.5, 1 → x̄ = 0.25', value: { xs: '0 0.5 1', f: 'exp(x)', xbar: '0.25', xext: '0.75' } },
  { label: 'sen x en 0, π/4, π/2 → x̄ = π/6', value: { xs: '0 pi/4 pi/2', f: 'sin(x)', xbar: 'pi/6', xext: '' } },
  { label: 'Runge, 5 nodos → x̄ = 0.9', value: { xs: '-1 -0.5 0 0.5 1', f: '1/(1+25x^2)', xbar: '0.9', xext: '' } },
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
    return { error: (e?.message ?? String(e)) + '. No se puede calcular f^(n+1).' }
  }
  const pts = Number.isFinite(xbar) ? [...xs, xbar] : xs
  const I: [number, number] = [Math.min(...pts), Math.max(...pts)]
  const M = A.maxAbsSample(dn, I[0], I[1], 4000)
  if (!Number.isFinite(M.max)) return { error: `f^(${n + 1}) no es finita en [${fmt(I[0])}, ${fmt(I[1])}]: f no es suficientemente suave en el intervalo.` }
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
      if (!Number.isFinite(xe)) return { error: 'El punto adicional x₍ₙ₊₁₎ es inválido.' }
      if (A.duplicateNodes([...xs, xe])) return { error: 'El punto adicional debe ser distinto de los nodos.' }
      const ye = f.f(xe)
      if (!Number.isFinite(ye)) return { error: `f no está definida en el punto adicional x = ${fmt(xe)}.` }
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
      description="Estima el error del polinomio de interpolación con un punto adicional (4.31) y lo mayora con el máximo de la derivada (4.35); lo compara con el error real."
      inputs={
        <>
          <DataInput s={s} set={set} requireF showFrac={false} xbarLabel="Punto de análisis x̄ =" />
          <NumField label={<>Punto adicional <Tex>{'x_{n+1}'}</Tex> (opcional)</>} value={s.xext} onChange={(xext) => set({ xext })} hint="Para la estimación (4.31); su valor se toma de f." />
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
    stats.push({ label: 'Error real f(x̄) − P(x̄)', value: fmtErr(c.at.fx - c.at.px), accent: true })
    if (c.ext) stats.push({ label: 'Estimación con punto adicional', value: fmtErr(c.ext.value), hint: `(4.31) con x${sub(n + 1)} = ${fmt(c.ext.xe, 6)}` })
    stats.push({ label: 'Cota (4.35) en x̄', value: fmtErr(c.at.bound), hint: c.at.real <= c.at.bound * (1 + 1e-9) + 1e-15 ? '✓ el error real la respeta' : '⚠ revisar' })
  }
  stats.push({ label: `M${sub(n + 1)} = máx |f⁽${n + 1}⁾|`, value: fmt(c.M.max, 8), hint: `en x ≈ ${fmt(c.M.at, 6)}` })
  stats.push({ label: 'Cota global en el intervalo', value: fmtErr((c.M.max / c.fact) * c.W), hint: `error real máx: ${fmtErr(c.realMax)}` })

  return (
    <>
      <Stats items={stats} />
      {c.at && c.at.xi.length > 0 && (
        <Alert kind="info">
          Valor(es) de <Tex>\xi</Tex> que hacen exacta la fórmula del error en x̄: <b>{c.at.xi.map((v) => fmt(v, 8)).join(', ')}</b> (dentro de [{fmt(c.I[0])}, {fmt(c.I[1])}], como garantiza el
          teorema).
        </Alert>
      )}
      <Tabs
        tabs={[
          { label: 'Error vs. cota', content: <Card><ErrPlot c={c} /></Card> },
          { label: 'Paso a paso', content: <Card><Steps steps={steps(c)} /></Card> },
          { label: 'f y P(x)', content: <Card><FPPlot c={c} /></Card> },
          { label: `f⁽${n + 1}⁾(x)`, content: <Card><DerivPlot c={c} /></Card> },
        ]}
      />
      <Card title="Tabla: error real y cota en puntos del intervalo">
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
      { x: bd.x, y: pos(bd.y), type: 'scatter', mode: 'lines', name: 'cota  M·|∏(x − xᵢ)|/(n+1)!', line: { color: SERIES[1], width: 2, dash: 'dash' } },
      { x: e.x, y: pos(e.y), type: 'scatter', mode: 'lines', name: 'error real |f − P|', line: { color: SERIES[0], width: 2.5 } },
    ]
    if (c.M.min > 1e-10 * c.M.max) {
      const lw = sample((x) => (c.M.min / c.fact) * Math.abs(A.nodeProduct(xs, x)), a, b, 800)
      t.push({ x: lw.x, y: pos(lw.y), type: 'scatter', mode: 'lines', name: 'cota inferior m·|∏|/(n+1)!', line: { color: SERIES[2], width: 1.3, dash: 'dot' } })
    }
    if (c.at && c.at.real > 0) t.push({ x: [xbar], y: [c.at.real], type: 'scatter', mode: 'markers', name: 'x̄', marker: { color: SERIES[5], size: 12, symbol: 'star' } })
    return t
  }, [c])
  return (
    <>
      <Plot data={data} layout={{ yaxis: { type: 'log', title: { text: 'error (escala log)' }, exponentformat: 'power' }, xaxis: { title: { text: 'x' } } }} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        El error real siempre queda por debajo de la cota. Ambos se anulan en los nodos. Si <Tex>{'f^{(n+1)}'}</Tex> no cambia de signo en el intervalo, el error también queda por
        encima de la cota inferior.
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
      { x: xs, y: ys, type: 'scatter', mode: 'markers', name: 'nodos', marker: { color: SERIES[3], size: 9 } },
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
      { x: [c.M.at], y: [c.dn(c.M.at)], type: 'scatter', mode: 'markers', name: 'máximo de |f⁽ⁿ⁺¹⁾|', marker: { color: SERIES[5], size: 11, symbol: 'diamond' } },
    ] as Trace[]
  }, [c])
  return (
    <>
      <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        La derivada de orden {c.n + 1} se calcula exactamente (diferenciación automática por series de Taylor) y su máximo en valor absoluto se estima muestreando 4001 puntos del intervalo.
      </p>
    </>
  )
}

export function steps(c: Required<Calc>) {
  const { xs, ys, xbar } = c.data
  const n = c.n
  const N = (x: number) => tn(x, false, 10)
  const out: { text?: ReactNode; tex?: string }[] = []
  out.push({ text: 'Valores en los nodos:', tex: xs.map((x, i) => `f(${N(x)}) = ${N(ys[i])}`).join(',\\quad ') })
  const terms = c.a
    .slice(0, 8)
    .map((ak, k) => `${k === 0 ? '' : ak < 0 ? ' - ' : ' + '}${tn(k === 0 ? ak : Math.abs(ak), false, 8)}${xs.slice(0, k).map((x) => (x === 0 ? 'x' : x > 0 ? `(x-${N(x)})` : `(x+${N(-x)})`)).join('')}`)
    .join('')
  out.push({ text: `Polinomio interpolante de grado ${n} (forma de Newton):`, tex: `P_{${n}}(x) = ${terms}${c.a.length > 8 ? '+\\cdots' : ''}` })
  if (c.at) out.push({ text: `Se evalúa en x̄ = ${fmt(xbar)}:`, tex: `P_{${n}}(${N(xbar)}) = ${N(c.at.px)}` })
  if (c.at && c.ext) {
    const xe = c.ext.xe
    out.push({
      text: `Estimación (4.31): se añade el dato (x${sub(n + 1)}, f(x${sub(n + 1)})) = (${fmt(xe)}, ${fmt(c.ext.ye, 8)}) y se calcula la diferencia dividida de orden ${n + 1}:`,
      tex: `f[x_0,\\dots,x_{${n + 1}}] = ${N(c.ext.dd)}`,
    })
    out.push({
      tex: `R_{${n}}(\\bar x) \\approx \\prod_{i=0}^{${n}}(\\bar x - x_i)\\,f[x_0,\\dots,x_{${n + 1}}] = ${xs.slice(0, 8).map((x) => texDiff(xbar, x)).join('')}${xs.length > 8 ? '\\cdots' : ''}\\cdot${tp(c.ext.dd, false, 10)} = ${tn(c.ext.value, false, 6)}`,
    })
  }
  out.push({
    text: `Estimación (4.35) con la derivada de orden n + 1 = ${n + 1}:`,
    tex: c.dSym ? `f^{(${n + 1})}(x) = ${c.dSym.tex}` : `f^{(${n + 1})}(x)\\;\\text{(expresión extensa; se evalúa numéricamente de forma exacta)}`,
  })
  out.push({
    text: `Máximo de |f⁽${n + 1}⁾| en [${fmt(c.I[0])}, ${fmt(c.I[1])}] (muestreo denso):`,
    tex: `M_{${n + 1}} = \\max_{t\\in[${N(c.I[0])},\\,${N(c.I[1])}]} |f^{(${n + 1})}(t)| \\approx |f^{(${n + 1})}(${N(c.M.at)})| = ${N(c.M.max)},\\qquad m_{${n + 1}} = \\min|f^{(${n + 1})}| \\approx ${N(c.M.min)}`,
  })
  out.push({ tex: `(n+1)! = ${n + 1}! = ${c.fact}` })
  if (c.at) {
    const fac = xs.slice(0, 10).map((x) => texDiff(xbar, x)).join('')
    out.push({ text: `Producto de los factores nodales en x̄ = ${fmt(xbar)}:`, tex: `\\prod_{i=0}^{${n}}(\\bar x - x_i) = ${fac}${xs.length > 10 ? '\\cdots' : ''} = ${N(c.at.w)}` })
    out.push({
      text: 'Cota del error (4.35):',
      tex: `|f(\\bar x) - P_{${n}}(\\bar x)| \\le \\frac{M_{${n + 1}}}{(${n + 1})!}\\left|\\prod(\\bar x - x_i)\\right| = \\frac{${N(c.M.max)}}{${c.fact}}\\cdot ${N(Math.abs(c.at.w))} = ${tn(c.at.bound, false, 6)}`,
    })
    if (c.M.min > 1e-10 * c.M.max) out.push({ text: 'Cota inferior (la derivada no se anula en el intervalo):', tex: `|f(\\bar x) - P_{${n}}(\\bar x)| \\ge \\frac{${N(c.M.min)}}{${c.fact}}\\cdot ${N(Math.abs(c.at.w))} = ${tn(c.at.lower, false, 6)}` })
    out.push({
      text: 'Error real (f es conocida):',
      tex: `f(\\bar x) - P_{${n}}(\\bar x) = ${N(c.at.fx)} - ${tp(c.at.px, false, 10)} = ${tn(c.at.fx - c.at.px, false, 6)},\\qquad |R_{${n}}| = ${tn(c.at.real, false, 6)} ${c.at.real <= c.at.bound * (1 + 1e-9) + 1e-15 ? '\\le' : '>'} ${tn(c.at.bound, false, 6)}\\;${c.at.real <= c.at.bound * (1 + 1e-9) + 1e-15 ? '\\checkmark' : ''}`,
    })
  }
  out.push({
    text: 'Cota global en todo el intervalo:',
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
  return `// Error de interpolacion — generado por NumLab
clear; clc;
function y = f(x)
  y = ${toScilab(c.f.src, true)};
endfunction
${
  dnode
    ? `function y = dnf(x)   // derivada de orden n+1 = ${n + 1}
  y = ${dnode};
endfunction`
    : `// Derivada de orden n+1 = ${n + 1}: expresion extensa; se aproxima con diferencias
// finitas centradas de orden ${n + 1} (puede perder precision para ordenes altos)
function y = dnf(x)
  k = ${n + 1}; hh = %eps^(1/(k+2));   // paso que equilibra truncamiento y redondeo
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

// Polinomio interpolante (diferencias divididas)
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

// Cota del error
a = min([x, xb]); b = max([x, xb]);
t = linspace(a, b, 4001);
M = max(abs(dnf(t)));
w = prod(xb - x);
cota = M / factorial(n+1) * abs(w);
err_real = abs(f(xb) - horner(P, xb));
mprintf('M_%d = %.10f\\n', n+1, M);
mprintf('prod(xb - xi) = %.10f\\n', w);
mprintf('Cota: %.6e    Error real: %.6e\\n', cota, err_real);
${
  c.ext
    ? `
// Estimacion (4.31) con un punto adicional x_(n+1)
xe = ${sci(c.ext.xe)};
xa = [x, xe]; ya = f(xa);
E = zeros(n+2, n+2); E(:, 1) = ya(:);
for j = 2:n+2
  for i = 1:n+3-j
    E(i, j) = (E(i+1, j-1) - E(i, j-1)) / (xa(i+j-1) - xa(i));
  end
end
R = prod(xb - x) * E(1, n+2);
mprintf('Estimacion con punto adicional: f[x0..x%d] = %.10f,  R ~ %.6e\\n', n+1, E(1, n+2), R);
`
    : ''
}
// Grafica: error real vs cota
W = ones(t);
for i = 1:n+1
  W = W .* (t - x(i));
end
clf();
plot(t, abs(f(t) - horner(P, t)), 'b-');
plot(t, M / factorial(n+1) * abs(W), 'r--');
xgrid();
legend(['|f - P|', 'cota']);
title('Error de interpolacion');
`
}
