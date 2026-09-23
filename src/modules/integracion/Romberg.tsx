import { useMemo } from 'react'
import { compile, evalNumber, toScilab, type Compiled } from '../../lib/expr'
import { fmt, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, SERIES, type Trace } from '../../components/Plot'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs, parseVector } from '../../components/ui'
import * as A from './algorithms'
import { limTex, Muted, N, P, RefNote, refStats, sci } from './common'
import { referencia1D, type Reference } from './exact'
import { THEORY, TITLES, TOPIC } from './theory'

type Mode = 'funcion' | 'datos'

interface S {
  mode: Mode
  f: string
  a: string
  b: string
  /** k_max del texto: se calculan los trapecios con n = 1, 2, …, 2^k_max */
  kmax: number
  /** tolerancia opcional (vacía = sin criterio de parada, como en el texto) */
  tol: string
  xs: string
  ys: string
}

const DEF: S = { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', kmax: 3, tol: '', xs: '0 0.09 0.18 0.27 0.36', ys: '0 10 22 37 52' }

const P1 = 'exp(-x^2/2)/sqrt(2pi)'

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: 'Ej. 5.3 · ∫₁² ln x, k_max = 3', value: { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', kmax: 3, tol: '' } },
  { label: 'Práctica 3 · I₁', value: { mode: 'funcion', f: P1, a: '-1', b: '1', kmax: 3, tol: '' } },
  { label: 'Práctica 3 · I₂', value: { mode: 'funcion', f: 'x^3*exp(x)', a: '0', b: '1', kmax: 3, tol: '' } },
  { label: 'Práctica 3 · I₃', value: { mode: 'funcion', f: 'cos(x)/sqrt(x)', a: '1', b: '2', kmax: 3, tol: '' } },
  { label: 'Práctica 7 · trabajo con datos', value: { mode: 'datos', xs: '0 0.09 0.18 0.27 0.36', ys: '0 10 22 37 52' } },
  { label: '∫₀^π sen x, tol = 1e-10', value: { mode: 'funcion', f: 'sin(x)', a: '0', b: 'pi', kmax: 12, tol: '1e-10' } },
  { label: '∫₀¹ √x (converge lento)', value: { mode: 'funcion', f: 'sqrt(x)', a: '0', b: '1', kmax: 8, tol: '' } },
]

export function Romberg() {
  const [raw, setS] = useLocalState<S>('integracion:romberg:v2', DEF)
  const s: S = { ...DEF, ...raw }
  const set = (p: Partial<S>) => setS((v) => ({ ...DEF, ...v, ...p }))
  const d = useDebounced(s, 250)
  const c = useMemo(() => compute(d), [d])

  const inputs = (
    <>
      <SelectField
        label="Entrada"
        value={s.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'funcion', label: 'Función f(x) en [a, b]' },
          { value: 'datos', label: 'Datos tabulados (2ᵏ + 1 puntos)' },
        ]}
      />
      {s.mode === 'funcion' ? (
        <>
          <ExprField label="Integrando f(x)" value={s.f} onChange={(f) => set({ f })} texPrefix="f(x) =" />
          <FieldRow>
            <NumField label="a" value={s.a} onChange={(a) => set({ a })} />
            <NumField label="b" value={s.b} onChange={(b) => set({ b })} />
          </FieldRow>
          <FieldRow>
            <IntField label="k_max" value={s.kmax} onChange={(kmax) => set({ kmax })} min={1} max={15} hint={`Trapecios con n = 1, 2, …, ${2 ** s.kmax}`} />
            <NumField label="Tolerancia (opcional)" value={s.tol} onChange={(tol) => set({ tol })} placeholder="sin tolerancia" hint="Vacía: se usa k_max fijo, como en el texto" />
          </FieldRow>
        </>
      ) : (
        <>
          <label className="field">
            <span className="field-label">Valores xᵢ (equiespaciados)</span>
            <textarea className="input mono" rows={2} value={s.xs} spellCheck={false} onChange={(e) => set({ xs: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Valores yᵢ = f(xᵢ)</span>
            <textarea className="input mono" rows={2} value={s.ys} spellCheck={false} onChange={(e) => set({ ys: e.target.value })} />
            <span className="field-hint">Se necesitan 2ᵏ + 1 puntos (3, 5, 9, 17…): k_max = k.</span>
          </label>
        </>
      )}
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.romberg} topic={TOPIC} theory={THEORY.romberg} inputs={inputs}>
      {'error' in c ? <Alert kind="error">{c.error}</Alert> : <Results s={d} c={c} />}
    </MethodPage>
  )
}

interface Calc {
  f: Compiled | null
  a: number
  b: number
  res: A.RombergResult
  /** tabla del texto I[k][m] = I_k^{(m)} */
  I: number[][]
  ref: Reference | null
  xs: number[] | null
  ys: number[] | null
}

function compute(s: S): Calc | { error: string } {
  if (s.mode === 'datos') {
    const xs = parseVector(s.xs)
    const ys = parseVector(s.ys)
    if (!xs) return { error: 'Lista de xᵢ inválida.' }
    if (!ys) return { error: 'Lista de yᵢ inválida.' }
    if (xs.length !== ys.length) return { error: `Hay ${xs.length} valores de x y ${ys.length} de y: deben tener la misma cantidad.` }
    if (xs.some((x, i) => i > 0 && x <= xs[i - 1])) return { error: 'Los xᵢ deben estar en orden estrictamente creciente.' }
    if (!A.isEquispaced(xs)) return { error: 'Los xᵢ deben estar equiespaciados (los trapecios con n = 2ᵏ usan puntos alternos).' }
    const res = A.rombergDatos(xs, ys)
    if ('error' in res) return res
    return { f: null, a: xs[0], b: xs[xs.length - 1], res, I: A.rombergLibro(res.R), ref: null, xs, ys }
  }
  const f = compile(s.f)
  if (!f.ok) return { error: 'f(x): ' + f.error }
  const a = evalNumber(s.a)
  const b = evalNumber(s.b)
  const tol = s.tol.trim() ? evalNumber(s.tol) : 0
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: 'Límites de integración inválidos.' }
  if (a === b) return { error: 'a y b deben ser distintos.' }
  if (s.tol.trim() && !(tol > 0)) return { error: 'La tolerancia debe ser un número positivo (o déjala vacía).' }
  for (const x of [a, b]) if (!Number.isFinite(f.f(x))) return { error: `f no está definida en el extremo x = ${fmt(x)}. Romberg usa el trapecio (fórmula cerrada); para singularidades en los extremos usa Gauss-Legendre.` }
  const res = A.romberg(f.f, a, b, s.kmax + 1, tol)
  return { f, a, b, res, I: A.rombergLibro(res.R), ref: referencia1D(s.f, f.f, a, b, s.a, s.b), xs: null, ys: null }
}

function Results({ s, c }: { s: S; c: Calc }) {
  const { res, I } = c
  const K = res.R.length - 1
  const rows = I.map((row, k) => {
    const o: Record<string, number> = { k, n: 2 ** k, h: res.hs[k] }
    row.forEach((v, m) => (o['I' + m] = v))
    return o
  })
  const alertKind = s.mode === 'datos' || !s.tol.trim() ? 'info' : res.converged ? 'ok' : 'warn'
  return (
    <>
      <Stats
        items={[
          { label: `I₀⁽${A.sup(K)}⁾ (mejor estimación)`, value: fmt(res.value, 15), accent: true, hint: `${res.evals} evaluaciones de f` },
          ...(c.ref ? refStats(res.value, c.ref) : [{ label: 'Trapecio con todos los datos', value: fmt(I[K][0], 12), hint: `I_${K}^(0), n = ${2 ** K}` }]),
        ]}
      />
      <Alert kind={alertKind}>{res.message}</Alert>
      {c.ref && c.f && <RefNote ref={c.ref} integral={`\\int_{${limTex(s.a)}}^{${limTex(s.b)}} ${c.f.tex}\\,dx`} />}
      <Tabs
        tabs={[
          {
            label: 'Tabla de Romberg',
            content: (
              <Card>
                <DataTable
                  filename="romberg"
                  columns={[
                    { key: 'k', tex: 'k', fmt: 'int', align: 'center' },
                    { key: 'n', tex: 'n=2^k', fmt: 'int', align: 'center' },
                    { key: 'h', tex: 'h_k' },
                    ...I.map((_, m) => ({ key: 'I' + m, tex: `I_k^{(${m})}${m === 0 ? '\\;\\text{(trapecio)}' : m === 1 ? '\\;\\text{(Simpson)}' : ''}`, get: (r: any) => (r['I' + m] === undefined ? '' : fmt(r['I' + m], 12)) })),
                  ]}
                  rows={rows}
                  highlight={(_, i) => i === 0}
                />
                <Muted>
                  Notación del texto (5.29): cada columna m se calcula con dos valores consecutivos de la columna anterior, I_k^(m) = (4ᵐ I_(k+1)^(m−1) − I_k^(m−1))/(4ᵐ − 1). La mejor estimación es la
                  última de la primera fila, I₀⁽{A.sup(K)}⁾. Burden escribe la misma tabla como R(k, j) = I_(k−j)^(j).
                </Muted>
              </Card>
            ),
          },
          { label: 'Paso a paso', content: <Card><Steps steps={steps(c)} /></Card> },
          ...(c.ref && Number.isFinite(c.ref.value) ? [{ label: 'Convergencia', content: <Card><ConvPlot c={c} /></Card> }] : []),
          { label: 'Gráfica', content: <Card><FPlot c={c} /></Card> },
        ]}
      />
      <ScilabCode code={scilab(s, c)} filename="romberg" />
    </>
  )
}

function ConvPlot({ c }: { c: Calc }) {
  const data = useMemo(() => {
    const Iref = c.ref?.value ?? NaN
    if (!Number.isFinite(Iref)) return []
    const I = c.I
    const K = I.length - 1
    const tr: Trace[] = []
    for (let m = 0; m <= Math.min(K, 4); m++) {
      const ks = I.map((_, k) => k).filter((k) => k <= K - m)
      tr.push({ x: ks.map((k) => k + m), y: ks.map((k) => Math.abs(I[k][m] - Iref) || null), type: 'scatter', mode: 'lines+markers', name: `columna m = ${m}`, line: { color: SERIES[m] } })
    }
    tr.push({ x: I.map((_, m) => m), y: I.map((_, m) => Math.abs(I[0][m] - Iref) || null), type: 'scatter', mode: 'lines+markers', name: 'primera fila I₀⁽ᵐ⁾', line: { color: SERIES[6], width: 3, dash: 'dot' } })
    return tr
  }, [c])
  return (
    <>
      <Plot data={data} layout={{ xaxis: { title: { text: 'nivel k + m (trapecio más fino usado: n = 2^(k+m))' }, dtick: 1 }, yaxis: { type: 'log', title: { text: '|I_k^(m) − I|' }, exponentformat: 'power' } }} />
      <Muted>Con el mismo número de evaluaciones de f, cada columna de extrapolación gana dos órdenes: O(h²), O(h⁴), O(h⁶)…</Muted>
    </>
  )
}

function FPlot({ c }: { c: Calc }) {
  const data = useMemo(() => {
    const K = Math.min(c.res.R.length - 1, 6)
    const n = 2 ** K
    let xs: number[]
    let ys: number[]
    if (c.xs && c.ys) {
      const step = (c.xs.length - 1) / n
      xs = c.xs.filter((_, i) => i % step === 0)
      ys = c.ys.filter((_, i) => i % step === 0)
    } else {
      xs = Array.from({ length: n + 1 }, (_, i) => c.a + ((c.b - c.a) * i) / n)
      ys = xs.map((x) => c.f!.f(x))
    }
    const lo = Math.min(c.a, c.b), hi = Math.max(c.a, c.b)
    const tr: Trace[] = [{ x: [...xs, c.b, c.a], y: [...ys, 0, 0], type: 'scatter', mode: 'lines', fill: 'toself', fillcolor: 'rgba(45,212,191,0.18)', line: { color: SERIES[0], width: 1 }, name: `trapecios con n = ${n}` }]
    if (c.f) tr.push({ ...sample(c.f.f, lo, hi, 400), type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: SERIES[2], width: 2.5 } })
    tr.push({ x: xs, y: ys, type: 'scatter', mode: 'markers', name: c.f ? 'nodos' : 'datos', marker: { color: SERIES[3], size: 6 } })
    return tr
  }, [c])
  return <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
}

function steps(c: Calc) {
  const { res, a, b, I } = c
  const K = I.length - 1
  const out: { text?: string; tex?: string }[] = []
  const fa = c.f ? c.f.f(a) : c.ys![0]
  const fb = c.f ? c.f.f(b) : c.ys![c.ys!.length - 1]
  out.push({ text: 'Columna m = 0: trapecio compuesto con n = 2ᵏ subintervalos, h_k = (b − a)/2ᵏ.' })
  out.push({ text: 'k = 0 (trapecio simple):', tex: `I_0^{(0)} = \\frac{b-a}{2}[f(a)+f(b)] = \\frac{${N(b)} - ${P(a)}}{2}[${N(fa)} + ${P(fb)}] = ${N(I[0][0], 12)}` })
  for (let k = 1; k <= Math.min(K, 4); k++) {
    const h = res.hs[k]
    const cnt = 2 ** (k - 1)
    const pts = Array.from({ length: cnt }, (_, i) => a + (2 * i + 1) * h)
    const vals = c.f ? pts.map((x) => c.f!.f(x)) : []
    const list = c.f && cnt >= 2 && cnt <= 4 ? vals.map((v) => P(v, 8)).join(' + ') + ' = ' : ''
    out.push({
      text: `k = ${k}: h_${k} = ${fmt(h)}; puntos nuevos x = ${pts.slice(0, 4).map((x) => fmt(x, 6)).join(', ')}${cnt > 4 ? ', …' : ''}`,
      tex: `I_${k}^{(0)} = \\tfrac12 I_${k - 1}^{(0)} + h_${k}\\sum f(x_{\\text{nuevos}}) = \\tfrac12(${N(I[k - 1][0], 12)}) + ${N(h)}\\,[${list}${N(res.sums[k], 12)}] = ${N(I[k][0], 12)}`,
    })
  }
  if (K > 4) out.push({ text: `… igual hasta k = ${K} (ver tabla).` })
  for (let m = 1; m <= K; m++) {
    const shown = Math.min(K - m, m <= 2 ? 3 : 1)
    out.push({ text: `Columna m = ${m} (factor 4^${m} = ${4 ** m}):` })
    for (let k = 0; k <= shown; k++) {
      out.push({
        tex: `I_${k}^{(${m})} = \\frac{${4 ** m}\\,I_${k + 1}^{(${m - 1})} - I_${k}^{(${m - 1})}}{${4 ** m - 1}} = \\frac{${4 ** m}(${N(I[k + 1][m - 1], 12)}) - ${P(I[k][m - 1], 12)}}{${4 ** m - 1}} = ${N(I[k][m], 12)}`,
      })
    }
    if (shown < K - m) out.push({ text: `… y así hasta I_${K - m}^(${m}).` })
    if (m >= 4 && m < K) {
      out.push({ text: `… se continúa igual hasta la columna m = ${K} (ver tabla).` })
      break
    }
  }
  if (res.converged && K >= 1) out.push({ text: 'Criterio de parada (opcional):', tex: `|I_0^{(${K})} - I_0^{(${K - 1})}| = ${texNum(Math.abs(I[0][K] - I[0][K - 1]), 3)} < \\text{tol}` })
  out.push({ text: 'Resultado:', tex: `\\int_a^b f(x)\\,dx \\approx I_0^{(${K})} = ${N(res.value, 15)}` })
  return out
}

function scilab(s: S, c: Calc): string {
  const table = `// Tabla del texto: I(k+1, m+1) = I_k^(m)
I = zeros(kmax + 1, kmax + 1);
I(:, 1) = T(:);
for m = 1:kmax
  for k = 0:kmax - m
    I(k+1, m+1) = (4^m*I(k+2, m) - I(k+1, m))/(4^m - 1);   // (5.29)
  end
end
disp('Tabla de Romberg I_k^(m) (filas k, columnas m):');
disp(I);
mprintf('Mejor estimacion I_0^(%d) = %.15f\\n', kmax, I(1, kmax + 1));
`
  if (s.mode === 'datos' && c.xs && c.ys)
    return `// Romberg-Richardson con datos tabulados — generado por NumLab
clear; clc;
x = [${c.xs.join(' ')}];
y = [${c.ys.join(' ')}];
n = length(x) - 1; kmax = round(log2(n));
T = zeros(1, kmax + 1);          // trapecios I_k^(0) con 2^k subintervalos
for k = 0:kmax
  p = n / 2^k;                    // se usan los datos 1, 1+p, 1+2p, ...
  idx = 1:p:n+1;
  h = x(idx(2)) - x(idx(1));
  T(k+1) = h/2*(y(idx(1)) + 2*sum(y(idx(2:$-1))) + y(idx($)));
end
${table}`
  const tol = s.tol.trim()
  return `// Metodo de Romberg-Richardson — generado por NumLab
clear; clc;
function y = f(x)
  y = ${toScilab(s.f, true)};
endfunction

a = ${sci(s.a)}; b = ${sci(s.b)};
kmax = ${s.kmax};${tol ? `\ntol = ${tol};   // criterio de parada opcional` : ''}
T = zeros(1, kmax + 1);          // trapecios I_k^(0) con n = 2^k
h = b - a;
T(1) = h/2*(f(a) + f(b));
for k = 1:kmax
  h = h/2;
  xn = a + (1:2:2^k - 1)*h;       // puntos nuevos
  T(k+1) = T(k)/2 + h*sum(f(xn));
end
${table}${
    tol
      ? `
// Con tolerancia: primera k tal que |I_0^(k) - I_0^(k-1)| < tol (I_0^(k) solo usa T(1:k+1))
for k = 1:kmax
  if abs(I(1, k+1) - I(1, k)) < tol then
    mprintf('Tolerancia alcanzada con k = %d: I_0^(%d) = %.15f\\n', k, k, I(1, k+1));
    break;
  end
end
`
      : ''
  }mprintf('intg de Scilab = %.15f\\n', intg(a, b, f));
`
}
