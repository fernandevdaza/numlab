import { useMemo } from 'react'
import { compile, derivative, evalNumber, toScilab, type Compiled } from '../../lib/expr'
import { fmt, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, CheckField, DataTable, ExprField, FieldRow, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs } from '../../components/ui'
import { LostDigits, Seg } from './components'
import { roundP, type Prec } from './float'
import { bigStr, evalBig, evalRounded, relErrBig, type TraceOp } from './numeric'
import { THEORY, TITLES, TOPIC } from './theory'

interface Demo {
  label: string
  naive: string
  stable: string
  a: string
  b: string
  log: boolean
  x0: string
  /** variable mostrada (x o b) */
  note: string
  derivation?: string[]
}

const DEMOS: Record<string, Demo> = {
  cos: {
    label: '(1 − cos x)/x²  vs  2 sin²(x/2)/x²',
    naive: '(1 - cos(x))/x^2',
    stable: '2*sin(x/2)^2/x^2',
    a: '1e-9', b: '1', log: true, x0: '1e-6',
    note: 'Para x pequeño cos x ≈ 1 y la resta 1 − cos x cancela casi todas las cifras. El valor exacto tiende a 1/2.',
    derivation: ['1-\\cos x = 1 - \\left(1 - 2\\sin^2\\tfrac{x}{2}\\right) = 2\\sin^2\\tfrac{x}{2}', '\\Rightarrow\\ \\frac{1-\\cos x}{x^2} = \\frac{2\\sin^2(x/2)}{x^2}\\quad\\text{(sin restas)}'],
  },
  sqrt: {
    label: '√(x+1) − √x  vs  1/(√(x+1) + √x)',
    naive: 'sqrt(x + 1) - sqrt(x)',
    stable: '1/(sqrt(x + 1) + sqrt(x))',
    a: '1', b: '1e15', log: true, x0: '1e12',
    note: 'Para x grande √(x+1) ≈ √x: se restan dos números casi iguales.',
    derivation: ['\\sqrt{x+1}-\\sqrt{x} = \\left(\\sqrt{x+1}-\\sqrt{x}\\right)\\frac{\\sqrt{x+1}+\\sqrt{x}}{\\sqrt{x+1}+\\sqrt{x}} = \\frac{(x+1) - x}{\\sqrt{x+1}+\\sqrt{x}} = \\frac{1}{\\sqrt{x+1}+\\sqrt{x}}'],
  },
  cuadratica: {
    label: 'Raíz pequeña de x² + b·x + 1 = 0 (b ≫ 1)',
    naive: '(-x + sqrt(x^2 - 4))/2',
    stable: '-2/(x + sqrt(x^2 - 4))',
    a: '3', b: '1e8', log: true, x0: '1e5',
    note: 'Aquí la variable x hace de b en z² + b z + 1 = 0 (a = c = 1). Si b² ≫ 4ac, √(b²−4ac) ≈ |b| y −b + √(b²−4ac) cancela.',
    derivation: [
      'z_2 = \\frac{-b+\\sqrt{b^2-4ac}}{2a}\\cdot\\frac{-b-\\sqrt{b^2-4ac}}{-b-\\sqrt{b^2-4ac}} = \\frac{b^2-(b^2-4ac)}{2a(-b-\\sqrt{b^2-4ac})} = \\frac{-2c}{b+\\sqrt{b^2-4ac}}',
      '\\text{Con } a=c=1:\\quad z_2 = \\frac{-2}{b+\\sqrt{b^2-4}}\\quad\\text{(o bien } z_2 = c/(a z_1)\\text{ con la raíz grande } z_1)',
    ],
  },
  expm1: {
    label: '(eˣ − 1)/x  vs  expm1(x)/x',
    naive: '(exp(x) - 1)/x',
    stable: 'expm1(x)/x',
    a: '1e-12', b: '1', log: true, x0: '1e-8',
    note: 'eˣ ≈ 1 para x pequeño. expm1 es una función de biblioteca (también en Scilab no existe directamente; se usa la serie x + x²/2 + … o el truco (eˣ−1)/ln(eˣ)).',
    derivation: ['e^x - 1 = x + \\frac{x^2}{2} + \\frac{x^3}{6} + \\cdots\\quad\\text{se evalúa sin restar (función expm1)}'],
  },
  log1p: {
    label: 'ln(1 + x)/x  vs  log1p(x)/x',
    naive: 'log(1 + x)/x',
    stable: 'log1p(x)/x',
    a: '1e-12', b: '1', log: true, x0: '1e-10',
    note: 'Al formar 1 + x se pierden las cifras de x que no caben junto al 1 (error de redondeo en el dato); ln amplifica ese error relativo porque está mal condicionado cerca de 1.',
    derivation: ['\\ln(1+x) = x - \\frac{x^2}{2} + \\frac{x^3}{3} - \\cdots\\quad\\text{(función log1p)}'],
  },
  racional: {
    label: '1/(1+2x) − (1−x)/(1+x)',
    naive: '1/(1 + 2*x) - (1 - x)/(1 + x)',
    stable: '2*x^2/((1 + 2*x)*(1 + x))',
    a: '1e-8', b: '1', log: true, x0: '1e-5',
    note: 'Para x pequeño ambas fracciones valen ≈ 1 y su diferencia ≈ 2x².',
    derivation: ['\\frac{1}{1+2x} - \\frac{1-x}{1+x} = \\frac{(1+x) - (1-x)(1+2x)}{(1+2x)(1+x)} = \\frac{2x^2}{(1+2x)(1+x)}'],
  },
  poly: {
    label: '(x − 1)⁷ expandido cerca de 1',
    naive: 'x^7 - 7*x^6 + 21*x^5 - 35*x^4 + 35*x^3 - 21*x^2 + 7*x - 1',
    stable: '(x - 1)^7',
    a: '0.988', b: '1.012', log: false, x0: '1.005',
    note: 'El polinomio expandido suma términos de tamaño ~35 para obtener algo de tamaño 10⁻¹⁴: la gráfica del valor calculado es puro ruido de redondeo.',
    derivation: ['x^7 - 7x^6 + 21x^5 - 35x^4 + 35x^3 - 21x^2 + 7x - 1 = (x-1)^7'],
  },
  custom: { label: 'Personalizado', naive: 'x - sin(x)', stable: 'x^3/6 - x^5/120 + x^7/5040', a: '1e-6', b: '0.1', log: true, x0: '1e-3', note: 'Escribe dos expresiones matemáticamente equivalentes.' },
}

interface S {
  demo: string
  naive: string
  stable: string
  a: string
  b: string
  log: boolean
  x0: string
  prec: Prec
}

const fromDemo = (id: string): Partial<S> => {
  const D = DEMOS[id]
  return { demo: id, naive: D.naive, stable: D.stable, a: D.a, b: D.b, log: D.log, x0: D.x0 }
}

export function Cancelacion() {
  const [s, setS] = useLocalState<S>('errores:cancelacion', { ...(fromDemo('cos') as S), prec: 64 })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 300)
  const calc = useMemo(() => compute(d), [d])

  const inputs = (
    <>
      <SelectField label="Demostración" value={s.demo} onChange={(demo) => set(fromDemo(demo))} options={Object.entries(DEMOS).map(([value, D]) => ({ value, label: D.label }))} />
      <ExprField label="Fórmula ingenua (inestable)" value={s.naive} onChange={(naive) => set({ naive, demo: 'custom' })} texPrefix="f_1(x) =" />
      <ExprField label="Fórmula reformulada (estable)" value={s.stable} onChange={(stable) => set({ stable, demo: 'custom' })} texPrefix="f_2(x) =" />
      <div className="field">
        <span className="field-label">Aritmética simulada</span>
        <Seg
          value={s.prec}
          onChange={(prec) => set({ prec })}
          options={[
            { value: 16, label: 'Media (float16)' },
            { value: 32, label: 'Simple (float32)' },
            { value: 64, label: 'Doble (float64)' },
          ]}
        />
      </div>
      <FieldRow>
        <NumField label="x mín" value={s.a} onChange={(a) => set({ a })} />
        <NumField label="x máx" value={s.b} onChange={(b) => set({ b })} />
      </FieldRow>
      <CheckField label="Eje x logarítmico" value={s.log} onChange={(log) => set({ log })} />
      <NumField label="Punto de análisis x₀" value={s.x0} onChange={(x0) => set({ x0 })} hint="Traza operación por operación y análisis de error progresivo/regresivo" />
    </>
  )

  return (
    <MethodPage title={TITLES.cancelacion} topic={TOPIC} theory={THEORY.cancelacion} inputs={inputs} description="Restar números casi iguales destruye cifras significativas. Compara una fórmula ingenua con su reformulación estable, operación por operación, frente a un valor de referencia con 100 dígitos.">
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <Results c={calc} s={d} />}
    </MethodPage>
  )
}

function compute(s: S) {
  const f1 = compile(s.naive)
  if (!f1.ok) return { error: 'Fórmula ingenua: ' + f1.error }
  const f2 = compile(s.stable)
  if (!f2.ok) return { error: 'Fórmula estable: ' + f2.error }
  const a = evalNumber(s.a), b = evalNumber(s.b), x0 = evalNumber(s.x0)
  if (![a, b, x0].every(Number.isFinite) || a >= b) return { error: 'Revisa el intervalo (a < b) y x₀.' }
  if (s.log && a <= 0) return { error: 'Con eje logarítmico el intervalo debe ser positivo.' }
  const p = s.prec
  const R = (v: number) => roundP(v, p)
  const n = 110
  const xs: number[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    xs.push(R(s.log ? a * (b / a) ** t : a + (b - a) * t))
  }
  const ev = (c: Compiled, x: number) => {
    try {
      return evalRounded(c.node, { x }, p)
    } catch {
      return NaN
    }
  }
  const pts = xs.map((x) => {
    const y1 = ev(f1, x), y2 = ev(f2, x)
    const ref = evalBig(s.naive, { x })
    const refN = ref ? ref.toNumber() : NaN
    const zero = ref ? ref.isZero() : false
    const e1 = zero ? Math.abs(y1) : relErrBig(y1, ref)
    const e2 = zero ? Math.abs(y2) : relErrBig(y2, ref)
    return { x, y1, y2, ref: refN, refStr: bigStr(ref, 17), e1, e2 }
  })
  // análisis en x0
  const X0 = R(x0)
  const tr1: TraceOp[] = [], tr2: TraceOp[] = []
  let y1 = NaN, y2 = NaN, traceErr = ''
  try {
    y1 = evalRounded(f1.node, { x: X0 }, p, tr1)
    y2 = evalRounded(f2.node, { x: X0 }, p, tr2)
  } catch (e: any) {
    traceErr = e?.message ?? String(e)
  }
  const ref0 = evalBig(s.naive, { x: X0 })
  const withExact = (tr: TraceOp[]) =>
    tr.map((t) => {
      const ex = evalBig(t.src, { x: X0 })
      const rel = relErrBig(t.value, ex)
      const lost = t.a !== undefined && t.b !== undefined && t.value !== 0 ? Math.log10(Math.max(Math.abs(t.a), Math.abs(t.b)) / Math.abs(t.value)) : NaN
      return { ...t, exact: bigStr(ex, 17), rel, lost }
    })
  // error progresivo / regresivo en x0 para la fórmula ingenua
  let kappa = NaN, fwd1 = NaN, bwd1 = NaN, fwd2 = NaN, bwd2 = NaN
  try {
    const dn = compile(derivative(f1.node, 'x').toString())
    if (dn.ok && ref0) {
      const fx = ref0.toNumber()
      const dfx = dn.f(X0)
      kappa = Math.abs((X0 * dfx) / fx)
      fwd1 = relErrBig(y1, ref0)
      fwd2 = relErrBig(y2, ref0)
      // x̂ con f(x̂) = ŷ  ⇒  Δx ≈ (ŷ − y)/f'(x)
      bwd1 = Math.abs((y1 - fx) / dfx / X0)
      bwd2 = Math.abs((y2 - fx) / dfx / X0)
    }
  } catch {
    /* sin derivada */
  }
  return { f1, f2, pts, X0, y1, y2, ref0: ref0 ? bigStr(ref0, 20) : '—', tr1: withExact(tr1), tr2: withExact(tr2), traceErr, kappa, fwd1, bwd1, fwd2, bwd2, p }
}

function Results({ c, s }: { c: any; s: S }) {
  const pts: any[] = c.pts
  const p: Prec = c.p
  const u = p === 64 ? 2 ** -53 : p === 32 ? 2 ** -24 : 2 ** -11
  const demo = DEMOS[s.demo] ?? DEMOS.custom
  const worst = pts.reduce((m, r) => (r.e1 > m.e1 ? r : m), pts[0])
  const med = (arr: number[]) => {
    const v = arr.filter(Number.isFinite).sort((x, y) => x - y)
    return v.length ? v[Math.floor(v.length / 2)] : NaN
  }

  const errPlot = useMemo(() => {
    const clip = (v: number) => (v > 0 && Number.isFinite(v) ? Math.max(v, 1e-18) : v === 0 ? 1e-18 : null)
    return [
      { x: pts.map((r) => r.x), y: pts.map((r) => clip(r.e1)), type: 'scatter', mode: 'lines+markers', marker: { size: 3 }, name: 'f₁ ingenua', line: { color: SERIES[6], width: 1.8 } },
      { x: pts.map((r) => r.x), y: pts.map((r) => clip(r.e2)), type: 'scatter', mode: 'lines+markers', marker: { size: 3 }, name: 'f₂ estable', line: { color: SERIES[0], width: 1.8 } },
      { x: [pts[0].x, pts[pts.length - 1].x], y: [u, u], type: 'scatter', mode: 'lines', name: 'u (unidad de redondeo)', line: { color: SERIES[1], dash: 'dot', width: 1.2 } },
    ] as Trace[]
  }, [pts, u])

  const valPlot = useMemo(
    () =>
      [
        { x: pts.map((r) => r.x), y: pts.map((r) => (Number.isFinite(r.y1) ? r.y1 : null)), type: 'scatter', mode: 'lines+markers', marker: { size: 3 }, name: 'f₁ ingenua', line: { color: SERIES[6], width: 1.5 } },
        { x: pts.map((r) => r.x), y: pts.map((r) => (Number.isFinite(r.y2) ? r.y2 : null)), type: 'scatter', mode: 'lines', name: 'f₂ estable', line: { color: SERIES[0], width: 2.5 } },
        { x: pts.map((r) => r.x), y: pts.map((r) => (Number.isFinite(r.ref) ? r.ref : null)), type: 'scatter', mode: 'lines', name: 'exacto (100 díg.)', line: { color: SERIES[2], width: 1.2, dash: 'dash' } },
      ] as Trace[],
    [pts],
  )

  const tableRows = pts.filter((_, i) => i % 10 === 0 || i === pts.length - 1)

  const traceCols = [
    { key: 'tex', label: 'Subexpresión', align: 'left' as const, get: (r: any) => <Tex>{r.tex}</Tex> },
    { key: 'value', label: 'Calculado', get: (r: any) => (r.value.toPrecision(p === 64 ? 17 : p === 32 ? 9 : 5)) },
    { key: 'exact', label: 'Exacto', get: (r: any) => r.exact },
    { key: 'rel', label: 'Error relativo', fmt: 'err' as const },
    { key: 'lost', label: 'Cifras canceladas', get: (r: any) => (Number.isFinite(r.lost) ? <LostDigits d={r.lost} /> : '—'), align: 'center' as const },
  ]

  return (
    <>
      <Stats
        items={[
          { label: 'Peor error relativo f₁', value: Number.isFinite(worst?.e1) ? worst.e1.toExponential(2) : '—', hint: `en x = ${fmt(worst?.x, 4)}` },
          { label: 'Error mediano f₁', value: fmt(med(pts.map((r) => r.e1)), 3) },
          { label: 'Error mediano f₂', value: fmt(med(pts.map((r) => r.e2)), 3), accent: true },
          { label: 'Cifras perdidas (peor)', value: Number.isFinite(worst?.e1) && worst.e1 > u ? '≈ ' + Math.log10(worst.e1 / u).toFixed(1) : '0', hint: `u = ${u.toExponential(2)}` },
        ]}
      />
      <Alert kind="info">{demo.note}</Alert>
      <Tabs
        tabs={[
          {
            label: 'Error relativo',
            content: (
              <Card>
                <Plot data={errPlot} layout={{ xaxis: { type: s.log ? 'log' : 'linear', title: { text: 'x' }, exponentformat: 'power' }, yaxis: { type: 'log', title: { text: 'error relativo' }, exponentformat: 'power' } }} />
                <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                  La fórmula estable se mantiene cerca de u; la ingenua pierde cifras a medida que la cancelación es más severa (en algunos puntos el error es 1: ¡no queda ninguna cifra correcta!). Errores
                  exactamente 0 se dibujan en 10⁻¹⁸.
                </p>
              </Card>
            ),
          },
          {
            label: 'Valores',
            content: (
              <Card>
                <Plot data={valPlot} layout={{ xaxis: { type: s.log ? 'log' : 'linear', title: { text: 'x' }, exponentformat: 'power' } }} />
              </Card>
            ),
          },
          {
            label: 'Tabla',
            content: (
              <Card>
                <DataTable
                  filename="cancelacion"
                  columns={[
                    { key: 'x', tex: 'x', get: (r) => fmt(r.x, 6) },
                    { key: 'y1', tex: 'f_1\\ \\text{(ingenua)}', get: (r) => (r.y1.toPrecision(p === 64 ? 17 : p === 32 ? 9 : 5)) },
                    { key: 'y2', tex: 'f_2\\ \\text{(estable)}', get: (r) => (r.y2.toPrecision(p === 64 ? 17 : p === 32 ? 9 : 5)) },
                    { key: 'refStr', tex: '\\text{exacto}', get: (r) => r.refStr },
                    { key: 'e1', tex: 'E_r(f_1)', fmt: 'err' },
                    { key: 'e2', tex: 'E_r(f_2)', fmt: 'err' },
                  ]}
                  rows={tableRows}
                />
              </Card>
            ),
          },
          {
            label: 'Operación por operación',
            content: (
              <Card>
                {c.traceErr && <Alert kind="error">{c.traceErr}</Alert>}
                <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
                  Evaluación en x₀ = {fmt(c.X0, 10)} redondeando cada resultado a {p === 64 ? 'doble' : p === 32 ? 'simple' : 'media'} precisión. Valor exacto: <span className="mono">{c.ref0}</span>. La columna "cifras
                  canceladas" ≈ log₁₀(max|operando| / |resultado|) en sumas y restas.
                </p>
                <div className="field-label" style={{ margin: '10px 0 6px' }}>
                  f₁ (ingenua) = {c.y1.toPrecision(p === 64 ? 17 : p === 32 ? 9 : 5)}
                </div>
                <DataTable filename="traza_ingenua" columns={traceCols} rows={c.tr1} highlightLast />
                <div className="field-label" style={{ margin: '14px 0 6px' }}>
                  f₂ (estable) = {c.y2.toPrecision(p === 64 ? 17 : p === 32 ? 9 : 5)}
                </div>
                <DataTable filename="traza_estable" columns={traceCols} rows={c.tr2} highlightLast />
              </Card>
            ),
          },
          {
            label: 'Progresivo vs. regresivo',
            content: (
              <Card>
                <Steps
                  steps={[
                    { text: 'Número de condición del problema en x₀ (propio de f, no del algoritmo):', tex: `\\kappa(x_0) = \\left|\\frac{x_0 f'(x_0)}{f(x_0)}\\right| = ${texNum(c.kappa, 5)}` },
                    { text: 'Error progresivo (forward) relativo de cada fórmula:', tex: `\\frac{|\\hat y_1 - y|}{|y|} = ${texNum(c.fwd1, 4)},\\qquad \\frac{|\\hat y_2 - y|}{|y|} = ${texNum(c.fwd2, 4)}` },
                    { text: 'Error regresivo (backward): ¿para qué x̂ el resultado calculado sería exacto? ŷ = f(x̂) ⇒ Δx ≈ (ŷ − y)/f′(x):', tex: `\\frac{|\\hat x_1 - x_0|}{|x_0|} \\approx ${texNum(c.bwd1, 4)},\\qquad \\frac{|\\hat x_2 - x_0|}{|x_0|} \\approx ${texNum(c.bwd2, 4)}\\qquad (u = ${texNum(u, 3)})` },
                    { text: 'Relación:', tex: '\\text{error progresivo} \\approx \\kappa \\times \\text{error regresivo}' },
                  ]}
                />
                <Alert kind={c.bwd1 > 100 * u ? 'warn' : 'ok'}>
                  {Number.isFinite(c.kappa) && c.kappa < 10 ? 'El problema está bien condicionado (κ pequeño), así que un error grande de f₁ es culpa del algoritmo: ' : 'El problema tiene κ grande: parte del error se debe al propio problema. '}
                  {c.bwd1 > 100 * u ? 'la fórmula ingenua tiene error regresivo ≫ u ⇒ NO es estable hacia atrás.' : 'el error regresivo de f₁ es del orden de u en este punto.'}
                </Alert>
              </Card>
            ),
          },
          ...(demo.derivation
            ? [
                {
                  label: 'Reformulación',
                  content: (
                    <Card>
                      <Steps steps={demo.derivation.map((t) => ({ tex: t }))} />
                    </Card>
                  ),
                },
              ]
            : []),
        ]}
      />
      <ScilabCode
        filename="cancelacion"
        code={`// Cancelación catastrófica — generado por NumLab
clear; clc;
x = ${s.log ? `logspace(log10(${s.a}), log10(${s.b}), 200)` : `linspace(${s.a}, ${s.b}, 200)`};
f1 = ${toScilab(s.naive)};      // fórmula ingenua
f2 = ${toScilab(s.stable)};     // fórmula estable (referencia)
err = abs(f1 - f2) ./ abs(f2);
err(err == 0) = %eps/100;
plot2d("${s.log ? 'll' : 'nl'}", x', [err; %eps/2*ones(x)]');
xtitle('Error relativo de la formula ingenua', 'x', 'error relativo');
legend('ingenua', 'u = eps/2');
mprintf('x0 = %g:  f1 = %.17g   f2 = %.17g\\n', ${s.x0}, ${toScilab(s.naive, false).replace(/\bx\b/g, `(${s.x0})`)}, ${toScilab(s.stable, false).replace(/\bx\b/g, `(${s.x0})`)});
`}
      />
    </>
  )
}
