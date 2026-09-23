import { useMemo } from 'react'
import { compile, compileDerivative, evalNumber, math, normalize, toScilab, toTex, type Compiled } from '../../lib/expr'
import { fmt, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, Stats, Steps, Tabs } from '../../components/ui'
import * as A from './algorithms'
import { limTex, Muted, N, P, RefNote, refStats, sci } from './common'
import { referencia1D, type Reference } from './exact'
import { THEORY, TITLES, TOPIC } from './theory'

interface S {
  f: string
  a: string
  b: string
  n: number
}

const DEF: S = { f: 'ln(x)', a: '1', b: '2', n: 2 }

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: 'Ej. 5.4 · ∫₁² ln x, orden 1 (punto medio)', value: { f: 'ln(x)', a: '1', b: '2', n: 1 } },
  { label: 'Ej. 5.5 / 5.6 · orden 2', value: { f: 'ln(x)', a: '1', b: '2', n: 2 } },
  { label: 'Ej. 5.5 · orden 5 (6 decimales)', value: { f: 'ln(x)', a: '1', b: '2', n: 5 } },
  { label: 'Práctica 4 · I₁, orden 3', value: { f: 'exp(-x^2/2)/sqrt(2pi)', a: '-1', b: '1', n: 3 } },
  { label: 'Práctica 4 · I₂, orden 4', value: { f: 'x^3*exp(x)', a: '0', b: '1', n: 4 } },
  { label: 'Práctica 4 · I₃, orden 3', value: { f: 'cos(x)/sqrt(x)', a: '1', b: '2', n: 3 } },
  { label: '∫₁^1.5 x² ln x dx (Burden)', value: { f: 'x^2*ln(x)', a: '1', b: '1.5', n: 2 } },
  { label: 'Polinomio grado 5 (exacto con n=3)', value: { f: 'x^5 - 2x^3 + x + 1', a: '-1', b: '2', n: 3 } },
  { label: '∫₀¹ 1/√x dx (singular en 0)', value: { f: '1/sqrt(x)', a: '0', b: '1', n: 6 } },
]

/** Formas cerradas de nodos z_{n,i} y pesos w_{n,i} (orden creciente de z). */
const CLOSED: Record<number, { t: string[]; w: string[] }> = {
  1: { t: ['0'], w: ['2'] },
  2: { t: ['-\\frac{1}{\\sqrt3}', '\\frac{1}{\\sqrt3}'], w: ['1', '1'] },
  3: { t: ['-\\sqrt{\\frac35}', '0', '\\sqrt{\\frac35}'], w: ['\\frac59', '\\frac89', '\\frac59'] },
  4: {
    t: ['-\\sqrt{\\frac37+\\frac27\\sqrt{\\frac65}}', '-\\sqrt{\\frac37-\\frac27\\sqrt{\\frac65}}', '\\sqrt{\\frac37-\\frac27\\sqrt{\\frac65}}', '\\sqrt{\\frac37+\\frac27\\sqrt{\\frac65}}'],
    w: ['\\frac{18-\\sqrt{30}}{36}', '\\frac{18+\\sqrt{30}}{36}', '\\frac{18+\\sqrt{30}}{36}', '\\frac{18-\\sqrt{30}}{36}'],
  },
  5: {
    t: ['-\\frac13\\sqrt{5+2\\sqrt{\\frac{10}{7}}}', '-\\frac13\\sqrt{5-2\\sqrt{\\frac{10}{7}}}', '0', '\\frac13\\sqrt{5-2\\sqrt{\\frac{10}{7}}}', '\\frac13\\sqrt{5+2\\sqrt{\\frac{10}{7}}}'],
    w: ['\\frac{322-13\\sqrt{70}}{900}', '\\frac{322+13\\sqrt{70}}{900}', '\\frac{128}{225}', '\\frac{322+13\\sqrt{70}}{900}', '\\frac{322-13\\sqrt{70}}{900}'],
  },
}

export function GaussLegendre() {
  const [raw, setS] = useLocalState<S>('integracion:gauss-legendre:v2', DEF)
  const s: S = { ...DEF, ...raw }
  const set = (p: Partial<S>) => setS((v) => ({ ...DEF, ...v, ...p }))
  const d = useDebounced(s, 250)
  const c = useMemo(() => compute(d), [d])

  const inputs = (
    <>
      <ExprField label="Integrando f(x)" value={s.f} onChange={(f) => set({ f })} texPrefix="f(x) =" />
      <FieldRow>
        <NumField label="a" value={s.a} onChange={(a) => set({ a })} />
        <NumField label="b" value={s.b} onChange={(b) => set({ b })} />
      </FieldRow>
      <IntField label="Orden n (número de nodos)" value={s.n} onChange={(n) => set({ n })} min={1} max={10} hint={`Orden de precisión m = 2n − 1 = ${2 * s.n - 1}: exacta para polinomios de grado ≤ ${2 * s.n - 1}`} />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES['gauss-legendre']} topic={TOPIC} theory={THEORY['gauss-legendre']} inputs={inputs}>
      {'error' in c ? <Alert kind="error">{c.error}</Alert> : <Results s={d} c={c} />}
    </MethodPage>
  )
}

interface Calc {
  f: Compiled
  a: number
  b: number
  q: ReturnType<typeof A.gaussQuad>
  ref: Reference
  gTex: string
  bound: number
  M: number
}

function compute(s: S): Calc | { error: string } {
  const f = compile(s.f)
  if (!f.ok) return { error: 'f(x): ' + f.error }
  const a = evalNumber(s.a)
  const b = evalNumber(s.b)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: 'Límites de integración inválidos.' }
  if (a === b) return { error: 'a y b deben ser distintos.' }
  const q = A.gaussQuad(f.f, a, b, s.n)
  const iBad = q.fx.findIndex((v) => !Number.isFinite(v))
  if (iBad >= 0) return { error: `f no está definida en el nodo x = ${fmt(q.xs[iBad])}: el integrando tiene una singularidad dentro del intervalo.` }
  // F(z) = (b−a)/2 · f((b−a)/2 z + (b+a)/2)   (5.30)
  let gTex = ''
  try {
    const sub = math.parse(`${fmtPlain(q.half)} * z + ${fmtPlain(q.mid)}`)
    const node = math.parse(normalize(s.f)).transform((nd: any) => (nd.isSymbolNode && nd.name === 'x' ? new math.ParenthesisNode(sub) : nd))
    gTex = toTex(node)
  } catch {
    gTex = ''
  }
  let bound = NaN
  let M = NaN
  if (2 * s.n <= 8) {
    const dk = compileDerivative(f, 'x', 2 * s.n)
    if (dk.ok) {
      M = A.maxAbs(dk.f, Math.min(a, b), Math.max(a, b)).M
      bound = A.gaussErrConst(s.n) * Math.abs(b - a) ** (2 * s.n + 1) * M
    }
  }
  return { f, a, b, q, ref: referencia1D(s.f, f.f, a, b, s.a, s.b), gTex, bound, M }
}

const fmtPlain = (x: number) => {
  const v = Number(x.toPrecision(12))
  return v < 0 ? `(${v})` : String(v)
}

function Results({ s, c }: { s: S; c: Calc }) {
  const { q } = c
  const n = s.n
  const rows = q.t.map((t, i) => ({ i: i + 1, t, w: q.w[i], x: q.xs[i], fx: q.fx[i], F: q.half * q.fx[i], wF: q.w[i] * q.half * q.fx[i] }))
  const conv = useMemo(
    () =>
      Array.from({ length: 10 }, (_, k) => {
        const v = A.gaussQuad(c.f.f, c.a, c.b, k + 1).value
        return { n: k + 1, v, err: Math.abs(v - c.ref.value), deg: 2 * k + 1 }
      }),
    [c],
  )
  return (
    <>
      <Stats items={[{ label: `Integral (orden n = ${n})`, value: fmt(q.value, 15), accent: true, hint: `${n} ${n === 1 ? 'evaluación' : 'evaluaciones'} de f` }, ...refStats(q.value, c.ref)]} />
      {Number.isFinite(c.bound) && (
        <Alert kind="info">
          Cota del error (fórmula de Burden, no aparece en el texto): <Tex>{`|E_{${n}}| \\le \\frac{(b-a)^{${2 * n + 1}}(${n}!)^4}{${2 * n + 1}[(${2 * n})!]^3}\\max|f^{(${2 * n})}| = ${texNum(A.gaussErrConst(n), 4)}\\cdot${N(Math.abs(c.b - c.a), 6)}^{${2 * n + 1}}\\cdot${N(c.M, 5)} = ${texNum(c.bound, 4)}`}</Tex>
        </Alert>
      )}
      <RefNote ref={c.ref} integral={`\\int_{${limTex(s.a)}}^{${limTex(s.b)}} ${c.f.tex}\\,dx`} />
      <Tabs
        tabs={[
          { label: 'Gráfica', content: <Card><GLPlot c={c} /></Card> },
          { label: 'Cambio de variable', content: <Card><Steps steps={changeSteps(c)} /></Card> },
          { label: 'Paso a paso', content: <Card><Steps steps={steps(s, c)} /></Card> },
          {
            label: 'Convergencia en n',
            content: (
              <Card>
                <Plot
                  height={320}
                  data={[{ x: conv.map((r) => r.n), y: conv.map((r) => r.err || null), type: 'scatter', mode: 'lines+markers', name: 'error de orden n', line: { color: SERIES[0] } }]}
                  layout={{ xaxis: { title: { text: 'orden n' }, dtick: 1 }, yaxis: { type: 'log', title: { text: 'error absoluto' }, exponentformat: 'power' } }}
                />
                <DataTable
                  filename="gauss_convergencia"
                  columns={[
                    { key: 'n', tex: 'n', fmt: 'int', align: 'center' },
                    { key: 'deg', tex: '\\text{precisión } m = 2n-1', fmt: 'int', align: 'center' },
                    { key: 'v', tex: '\\textstyle\\sum_i w_{n,i}F(z_{n,i})' },
                    { key: 'err', tex: '\\text{error}', fmt: 'err' },
                  ]}
                  rows={conv}
                  highlight={(r) => r.n === n}
                />
              </Card>
            ),
          },
        ]}
      />
      <Card title={`Nodos y pesos de Gauss-Legendre de orden n = ${n}`}>
        <DataTable
          filename="gauss_legendre_nodos"
          columns={[
            { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
            ...(CLOSED[n] ? [{ key: 'tc', tex: 'z_{n,i}\\text{ (exacto)}', get: (_: any, i: number) => <Tex>{CLOSED[n].t[i]}</Tex>, align: 'center' as const }] : []),
            { key: 't', tex: 'z_{n,i}', get: (r) => fmt(r.t, 15) },
            ...(CLOSED[n] ? [{ key: 'wc', tex: 'w_{n,i}\\text{ (exacto)}', get: (_: any, i: number) => <Tex>{CLOSED[n].w[i]}</Tex>, align: 'center' as const }] : []),
            { key: 'w', tex: 'w_{n,i}', get: (r) => fmt(r.w, 15) },
            { key: 'x', tex: 'x_i = \\frac{b-a}{2}z_{n,i} + \\frac{b+a}{2}' },
            { key: 'F', tex: 'F(z_{n,i}) = \\frac{b-a}{2}f(x_i)' },
            { key: 'wF', tex: 'w_{n,i}F(z_{n,i})' },
          ]}
          rows={rows}
        />
        <Muted>
          Σ w = {fmt(q.w.reduce((t, w) => t + w, 0), 15)} (= 2, la longitud de [−1, 1]). Los nodos son las raíces de Pₙ(z), calculadas con el método de Newton sobre la recurrencia (5.38); los
          pesos coinciden con (5.39).
        </Muted>
      </Card>
      <ScilabCode code={scilab(s)} filename="gauss_legendre" />
    </>
  )
}

function GLPlot({ c }: { c: Calc }) {
  const data = useMemo(() => {
    const { q } = c
    const lo = Math.min(c.a, c.b), hi = Math.max(c.a, c.b)
    const pad = (hi - lo) * 0.05
    const tr: Trace[] = []
    const px = sample((x) => A.lagrange(q.xs, q.fx, x), lo, hi, 200)
    tr.push({ x: [lo, ...px.x, hi], y: [0, ...px.y, 0], type: 'scatter', mode: 'lines', fill: 'toself', fillcolor: 'rgba(45,212,191,0.18)', line: { color: SERIES[0], width: 1.2, dash: 'dash' }, name: `interpolante de grado ${q.xs.length - 1} por los nodos` })
    tr.push({ ...sample(c.f.f, lo - pad, hi + pad, 500), type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: SERIES[2], width: 2.5 } })
    q.xs.forEach((x, i) => tr.push({ x: [x, x], y: [0, q.fx[i]], type: 'scatter', mode: 'lines', line: { color: SERIES[3], width: 1 }, showlegend: false, hoverinfo: 'skip' }))
    const wmax = Math.max(...q.w)
    tr.push({ x: q.xs, y: q.fx, type: 'scatter', mode: 'markers', name: 'nodos (tamaño ∝ peso)', text: q.w.map((w) => 'w = ' + fmt(w, 8)), marker: { color: SERIES[3], size: q.w.map((w) => 7 + 10 * (w / wmax)) } })
    return tr
  }, [c])
  return (
    <>
      <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
      <Muted>Los nodos nunca incluyen a ni b (fórmula abierta) y se concentran hacia los extremos. La regla integra exactamente el polinomio interpolante que pasa por ellos.</Muted>
    </>
  )
}

function changeSteps(c: Calc) {
  const { q } = c
  const out: { text?: string; tex?: string }[] = []
  out.push({ text: 'Cambio de variable (5.30) de [a, b] a [−1, 1]:', tex: `x = \\frac{b-a}{2}z + \\frac{b+a}{2} = \\frac{${N(c.b)} - ${P(c.a)}}{2}z + \\frac{${N(c.b)} + ${P(c.a)}}{2} = ${N(q.half)}\\,z ${q.mid < 0 ? '-' : '+'} ${N(Math.abs(q.mid))}` })
  out.push({ text: 'Diferencial:', tex: `dx = \\frac{b-a}{2}dz = ${N(q.half)}\\,dz` })
  out.push({
    text: 'La integral queda sobre [−1, 1]:',
    tex: `\\int_{${N(c.a, 6)}}^{${N(c.b, 6)}} ${c.f.tex}\\,dx = \\int_{-1}^{1} \\underbrace{${N(q.half)}\\,${c.gTex ? `\\left[${c.gTex}\\right]` : 'f(x(z))'}}_{F(z)}\\,dz`,
  })
  out.push({ text: 'Y se aplica la fórmula de Gauss de orden n (5.31):', tex: `\\int_{-1}^{1} F(z)\\,dz \\approx \\sum_{i=1}^{${q.t.length}} w_{${q.t.length},i}\\,F(z_{${q.t.length},i})` })
  return out
}

/** Pₙ(z) en TeX (n ≤ 5) para mostrar la recurrencia (5.38). */
const LEG_TEX: Record<number, string> = {
  1: 'z',
  2: '\\tfrac32 z^2 - \\tfrac12',
  3: '\\tfrac52 z^3 - \\tfrac32 z',
  4: '\\tfrac{35}{8} z^4 - \\tfrac{15}{4} z^2 + \\tfrac38',
  5: '\\tfrac{63}{8} z^5 - \\tfrac{35}{4} z^3 + \\tfrac{15}{8} z',
  6: '\\tfrac{231}{16} z^6 - \\tfrac{315}{16} z^4 + \\tfrac{105}{16} z^2 - \\tfrac{5}{16}',
}

function steps(s: S, c: Calc) {
  const { q } = c
  const n = s.n
  const out: { text?: string; tex?: string }[] = []
  if (LEG_TEX[n]) out.push({ text: `Polinomio de Legendre de grado ${n} (recurrencia 5.38); sus raíces son los nodos:`, tex: `P_{${n}}(z) = ${LEG_TEX[n]} = 0` })
  out.push({
    text: `Nodos y pesos de orden n = ${n}${CLOSED[n] ? ' (valores exactos)' : ''}:`,
    tex: '\\begin{aligned}' + q.t.map((t, i) => `z_{${n},${i + 1}} &= ${CLOSED[n] ? CLOSED[n].t[i] + ' \\approx ' : ''}${N(t, 12)}, & w_{${n},${i + 1}} &= ${CLOSED[n] ? CLOSED[n].w[i] + ' \\approx ' : ''}${N(q.w[i], 12)}`).join('\\\\') + '\\end{aligned}',
  })
  const z0 = q.t[q.t.length - 1]
  const L = A.legendre(n, z0)
  const L1 = A.legendre(n + 1, z0)
  out.push({
    text: `Comprobación de un peso con (5.39), en z = ${fmt(z0, 10)}:`,
    tex: `w_{${n},${n}} = \\frac{-2}{(n+1)P_{${n}}'(z)P_{${n + 1}}(z)} = \\frac{-2}{${n + 1}\\cdot(${N(L.dp, 10)})\\cdot(${N(L1.p, 10)})} = ${N(A.pesoGaussLibro(n, z0), 12)}`,
  })
  out.push({
    text: 'Transformamos cada nodo y evaluamos F(z) = (b − a)/2 · f(x):',
    tex: '\\begin{aligned}' + q.t.map((t, i) => `x_{${i + 1}} &= ${N(q.half)}(${N(t, 10)}) ${q.mid < 0 ? '-' : '+'} ${N(Math.abs(q.mid))} = ${N(q.xs[i], 12)}, & F(z_{${n},${i + 1}}) &= ${N(q.half)}\\cdot f(${N(q.xs[i], 8)}) = ${N(q.half * q.fx[i], 12)}`).join('\\\\') + '\\end{aligned}',
  })
  out.push({
    text: 'Suma ponderada:',
    tex: `I \\approx \\sum_{i=1}^{${n}} w_{${n},i}F(z_{${n},i}) = ${q.w.map((w, i) => `(${N(w, 10)})(${N(q.half * q.fx[i], 10)})`).join(' + ')} = ${N(q.value, 15)}`,
  })
  if (Number.isFinite(c.ref.value)) {
    const e = Math.abs(c.ref.value - q.value)
    out.push({ text: 'Error exacto y relativo:', tex: `|${N(c.ref.value, 14)} - ${P(q.value, 14)}| = ${texNum(e, 4)}${c.ref.value !== 0 ? `\;\;(${texNum((100 * e) / Math.abs(c.ref.value), 3)}\\,\\%)` : ''}` })
  }
  return out
}

function scilab(s: S): string {
  return `// Cuadratura de Gauss-Legendre de orden n = ${s.n} — generado por NumLab
clear; clc;
function y = f(x)
  y = ${toScilab(s.f, true)};
endfunction
function [p, dp] = legendre(n, z)   // P_n(z) y P_n'(z) con la recurrencia (5.38)
  p0 = ones(z); p = z;
  for k = 2:n
    p2 = ((2*k - 1)*z.*p - (k - 1)*p0)/k;
    p0 = p; p = p2;
  end
  dp = n*(z.*p - p0)./(z.^2 - 1);
endfunction

a = ${sci(s.a)}; b = ${sci(s.b)}; n = ${s.n};
// Nodos: raices de P_n (metodo de Newton desde una aproximacion inicial)
z = cos(%pi*((n:-1:1) - 0.25)/(n + 0.5));
for it = 1:50
  [p, dp] = legendre(n, z);
  z = z - p./dp;
end
// Pesos con la formula (5.39)
[p, dp] = legendre(n, z);
[p1, dp1] = legendre(n + 1, z);
w = -2 ./ ((n + 1)*dp.*p1);

// Cambio de variable (5.30): x = (b-a)/2*z + (b+a)/2,  F(z) = (b-a)/2*f(x)
x = (b - a)/2*z + (b + a)/2;
F = (b - a)/2*f(x);
I = sum(w .* F);                     // (5.31)
mprintf('%3s %20s %20s %20s %18s\\n', 'i', 'z_n,i', 'w_n,i', 'x_i', 'F(z_n,i)');
for i = 1:n
  mprintf('%3d %20.15f %20.15f %20.15f %18.12f\\n', i, z(i), w(i), x(i), F(i));
end
mprintf('\\nIntegral (Gauss-Legendre, orden %d) = %.15f\\n', n, I);
mprintf('intg de Scilab                     = %.15f\\n', intg(a, b, f));
`
}
