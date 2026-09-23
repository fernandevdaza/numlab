import { useMemo } from 'react'
import { L } from '../../i18n'
import { compile, evalNumber, toScilab } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, Stats, Tabs } from '../../components/ui'
import * as A from './algorithms'
import { limTex, Muted, RefNote, sci } from './common'
import { referencia1D } from './exact'
import { THEORY, TITLES, TOPIC } from './theory'

interface S {
  f: string
  a: string
  b: string
  n: number
}

const DEF: S = { f: 'ln(x)', a: '1', b: '2', n: 6 }

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: L('Ej. 5.1–5.5 · ∫₁² ln x dx', 'Ex. 5.1–5.5 · ∫₁² ln x dx'), value: { f: 'ln(x)', a: '1', b: '2', n: 6 } },
  { label: L('Práctica 1 · I₁ (normal estándar)', 'Practice 1 · I₁ (standard normal)'), value: { f: 'exp(-x^2/2)/sqrt(2pi)', a: '-1', b: '1', n: 8 } },
  { label: '∫₀² e^(−x²) dx', value: { f: 'exp(-x^2)', a: '0', b: '2' } },
  { label: L('∫₀^π sen x dx = 2', '∫₀^π sin x dx = 2'), value: { f: 'sin(x)', a: '0', b: 'pi' } },
  { label: '∫₀¹ 4/(1+x²) = π', value: { f: '4/(1+x^2)', a: '0', b: '1' } },
  { label: L('∫₀¹ √x dx (no suave en 0)', '∫₀¹ √x dx (not smooth at 0)'), value: { f: 'sqrt(x)', a: '0', b: '1' } },
  { label: L('∫₀^(2π) e^(cos x) (periódica)', '∫₀^(2π) e^(cos x) (periodic)'), value: { f: 'exp(cos(x))', a: '0', b: '2pi' } },
  { label: L('Runge: 1/(1+25x²) en [−1,1]', 'Runge: 1/(1+25x²) on [−1,1]'), value: { f: '1/(1+25x^2)', a: '-1', b: '1' } },
]

interface Row {
  name: string
  evals: number | null
  v: number
  err: number
  rel: number
  order: string
  note: string
}

export function CompararIntegracion() {
  const [raw, setS] = useLocalState<S>('integracion:comparar:v2', DEF)
  const s: S = { ...DEF, ...raw }
  const set = (p: Partial<S>) => setS((v) => ({ ...DEF, ...v, ...p }))
  const d = useDebounced(s, 300)

  const out = useMemo(() => {
    const f = compile(d.f)
    if (!f.ok) return { error: 'f(x): ' + f.error }
    const a = evalNumber(d.a), b = evalNumber(d.b)
    if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: L('Límites inválidos.', 'Invalid limits.') }
    if (a === b) return { error: L('a y b deben ser distintos.', 'a and b must be different.') }
    const ref = referencia1D(d.f, f.f, a, b, d.a, d.b)
    const I = ref.value
    const mk = (name: string, evals: number | null, v: number, order: string, note = ''): Row => ({ name, evals, v, err: Math.abs(v - I), rel: Math.abs(v - I) / Math.abs(I), order, note })
    const rows: Row[] = []
    const endsOk = Number.isFinite(f.f(a)) && Number.isFinite(f.f(b))
    for (const r of Object.keys(A.NC) as A.NCRule[]) {
      const def = A.NC[r]
      const ord = `O(h^${def.p})`
      if (!endsOk) {
        rows.push({ ...mk(def.label, null, NaN, ord), note: L('f no definida en un extremo', 'f undefined at an endpoint') })
        continue
      }
      const n = Math.max(def.m, Math.round(d.n / def.m) * def.m)
      rows.push(mk(`${def.label} (n = ${n})`, n + 1, A.newtonCotes(f.f, a, b, n, r).value, ord, n !== d.n ? L(`n ajustado a múltiplo de ${def.m}`, `n adjusted to a multiple of ${def.m}`) : ''))
    }
    if (endsOk) {
      const ro = A.romberg(f.f, a, b, 12, 1e-10)
      const K = ro.R.length - 1
      rows.push(mk(`Romberg-Richardson I₀⁽${A.sup(K)}⁾`, ro.evals, ro.value, `O(h^{${2 * K + 2}})`, ro.converged ? '|I₀⁽ᵏ⁾ − I₀⁽ᵏ⁻¹⁾| < 1e-10' : L('no alcanzó 1e-10 con k_max = 11', 'did not reach 1e-10 with k_max = 11')))
    }
    for (const n of [1, 2, 3, 4, 6, 8]) rows.push(
        mk(
          L(`Gauss-Legendre (orden ${n})`, `Gauss–Legendre (order ${n})`),
          n,
          A.gaussQuad(f.f, a, b, n).value,
          `${L('\\text{grado }', '\\text{degree }')} ${2 * n - 1}`,
          n === 1 ? L('punto medio', 'midpoint') : '',
        ),
      )
    const gc = A.gaussCompuesta(f.f, a, b, 4, Math.max(1, Math.round(d.n / 4)))
    rows.push(mk(L(`Gauss orden 4 compuesta (${Math.max(1, Math.round(d.n / 4))} subint.)`, `Composite Gauss order 4 (${Math.max(1, Math.round(d.n / 4))} subint.)`), 4 * Math.max(1, Math.round(d.n / 4)), gc, 'O(h^8)'))
    return { f, a, b, ref, rows, endsOk }
  }, [d])

  const conv = useMemo(() => {
    if ('error' in out || !out.rows || !Number.isFinite(out.ref.value)) return []
    const { f, a, b, ref, endsOk } = out
    const I = ref.value
    const tr: Trace[] = []
    const err = (v: number) => Math.abs(v - I) || null
    if (endsOk)
      (Object.keys(A.NC) as A.NCRule[]).forEach((r, i) => {
        const m = A.NC[r].m
        const ns = Array.from({ length: 10 }, (_, k) => m * 2 ** k).filter((n) => n <= 2048)
        tr.push({ x: ns.map((n) => n + 1), y: ns.map((n) => err(A.newtonCotes(f.f, a, b, n, r).value)), type: 'scatter', mode: 'lines+markers', name: A.NC[r].label, line: { color: SERIES[i] } })
      })
    const gn = Array.from({ length: 20 }, (_, k) => k + 1)
    tr.push({ x: gn, y: gn.map((n) => err(A.gaussQuad(f.f, a, b, n).value)), type: 'scatter', mode: 'lines+markers', name: 'Gauss-Legendre', line: { color: SERIES[4], width: 3 } })
    if (endsOk) {
      const ro = A.romberg(f.f, a, b, 11, 0)
      tr.push({ x: ro.R.map((_, k) => 2 ** k + 1), y: ro.R.map((row, k) => err(row[k])), type: 'scatter', mode: 'lines+markers', name: 'Romberg I₀⁽ᵏ⁾', line: { color: SERIES[5], dash: 'dot' } })
    }
    return tr
  }, [out])

  const inputs = (
    <>
      <ExprField label={L('Integrando f(x)', 'Integrand f(x)')} value={s.f} onChange={(f) => set({ f })} texPrefix="f(x) =" />
      <FieldRow>
        <NumField label="a" value={s.a} onChange={(a) => set({ a })} />
        <NumField label="b" value={s.b} onChange={(b) => set({ b })} />
      </FieldRow>
      <IntField
        label={L('Subintervalos n (Newton-Cotes)', 'Subintervals n (Newton–Cotes)')}
        value={s.n}
        onChange={(n) => set({ n })}
        min={1}
        max={2000}
        hint={L('Se ajusta al múltiplo válido más cercano para cada regla', 'Adjusted to the nearest valid multiple for each rule')}
      />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES['comparar-integracion']} topic={TOPIC} theory={THEORY['comparar-integracion']} description={L(
        'Calcula la misma integral con todos los métodos del tema y compara precisión contra costo (número de evaluaciones de f).',
        'Computes the same integral with every method of this topic and compares accuracy against cost (number of evaluations of f).',
      )}
      inputs={inputs}
    >
      {'error' in out ? (
        <Alert kind="error">{out.error}</Alert>
      ) : (
        <>
          <Stats
            items={[
              {
                label: out.ref.kind === 'simbolico' ? L('Valor exacto', 'Exact value') : L('Referencia', 'Reference'),
                value: fmt(out.ref.value, 15),
                accent: true,
                hint: out.ref.kind === 'simbolico' ? L('antiderivada simbólica', 'symbolic antiderivative') : L('Gauss-Kronrod adaptativo', 'adaptive Gauss–Kronrod'),
              },
              (() => {
                const best = out.rows.filter((r) => Number.isFinite(r.err)).sort((p, q) => p.err - q.err)[0]
                return { label: L('Más preciso', 'Most accurate'), value: best ? best.name.split(' (')[0] : '—', hint: best ? `error ${fmtErr(best.err)}` : undefined }
              })(),
              (() => {
                const ok = out.rows.filter((r) => r.evals !== null && r.err < 1e-6).sort((p, q) => (p.evals ?? 0) - (q.evals ?? 0))[0]
                return {
                  label: L('Error < 10⁻⁶ con menos evaluaciones', 'Error < 10⁻⁶ with fewest evaluations'),
                  value: ok ? ok.name.split(' (')[0] : '—',
                  hint: ok ? `${ok.evals} ${L('evaluaciones', 'evaluations')}` : L('ninguno', 'none'),
                }
              })(),
            ]}
          />
          {!out.endsOk && (
            <Alert kind="warn">
              {L(
                'f no está definida en un extremo: sólo se aplican las fórmulas abiertas (Gauss-Legendre).',
                'f is not defined at an endpoint: only the open formulas (Gauss–Legendre) are applied.',
              )}
            </Alert>
          )}
          <RefNote ref={out.ref} integral={`\\int_{${limTex(d.a)}}^{${limTex(d.b)}} ${out.f.tex}\\,dx`} />
          <Card title={L('Resultados', 'Results')}>
            <DataTable
              filename="comparacion_integracion"
              columns={[
                { key: 'name', label: L('Método', 'Method'), align: 'left' },
                { key: 'evals', label: L('Evaluaciones', 'Evaluations'), get: (r) => (r.evals === null ? '—' : String(r.evals)) },
                { key: 'v', label: L('Aproximación', 'Approximation'), get: (r) => (Number.isFinite(r.v) ? fmt(r.v, 14) : '—') },
                { key: 'err', label: L('Error absoluto', 'Absolute error'), get: (r) => (Number.isFinite(r.err) ? fmtErr(r.err) : '—') },
                { key: 'rel', label: L('Error relativo', 'Relative error'), get: (r) => (Number.isFinite(r.rel) ? fmtErr(r.rel) : '—') },
                { key: 'order', label: L('Orden', 'Order'), get: (r) => <Tex>{r.order}</Tex>, align: 'center' },
                { key: 'note', label: L('Nota', 'Note'), align: 'left' },
              ]}
              rows={out.rows}
            />
          </Card>
          <Tabs
            tabs={[
              {
                label: L('Error vs evaluaciones', 'Error vs evaluations'),
                content: (
                  <Card>
                    <Plot data={conv} height={440} layout={{ xaxis: { type: 'log', title: { text: L('evaluaciones de f', 'evaluations of f') } }, yaxis: { type: 'log', title: { text: L('error absoluto', 'absolute error') }, exponentformat: 'power' } }} />
                    <Muted>
                      {L(
                        'Newton-Cotes: rectas de pendiente −2 (trapecio), −4 (Simpson), −6 (Boole). Gauss-Legendre y Romberg caen mucho más rápido para integrandos suaves; con singularidades (√x) todos se degradan.',
                        'Newton–Cotes: straight lines of slope −2 (trapezoidal), −4 (Simpson), −6 (Boole). Gauss–Legendre and Romberg fall much faster for smooth integrands; with singularities (√x) all of them degrade.',
                      )}
                    </Muted>
                  </Card>
                ),
              },
              {
                label: L('Barras de error', 'Error bars'),
                content: (
                  <Card>
                    <Plot
                      height={400}
                      data={[
                        {
                          type: 'bar',
                          orientation: 'h',
                          y: out.rows.map((r) => r.name),
                          x: out.rows.map((r) => (Number.isFinite(r.err) && r.err > 0 ? r.err : r.err === 0 ? 1e-17 : null)),
                          marker: { color: out.rows.map((_, i) => SERIES[i % SERIES.length]) },
                          name: 'error',
                        },
                      ]}
                      layout={{ xaxis: { type: 'log', title: { text: L('error absoluto', 'absolute error') }, exponentformat: 'power' }, yaxis: { automargin: true, autorange: 'reversed' }, margin: { l: 230 } }}
                    />
                  </Card>
                ),
              },
            ]}
          />
          <ScilabCode code={scilab(d)} filename="comparar_integracion" />
        </>
      )}
    </MethodPage>
  )
}

function scilab(s: S): string {
  return `// ${L('Comparacion de metodos de integracion — generado por NumLab', 'Comparison of integration methods — generated by NumLab')}
clear; clc;
function y = f(x)
  y = ${toScilab(s.f, true)};
endfunction
function I = newton_cotes(a, b, n, p, W, FAC)
  h = (b - a)/n; x = linspace(a, b, n + 1);
  c = zeros(1, n + 1);
  for q = 1:p:n
    c(q:q+p) = c(q:q+p) + W;
  end
  I = FAC*h*sum(c .* f(x));
endfunction
function I = gauss(a, b, n)   // ${L('nodos: autovalores de la matriz de Jacobi (equivale a las raices de P_n)', 'nodes: eigenvalues of the Jacobi matrix (equivalent to the roots of P_n)')}
  k = 1:n-1; beta = k ./ sqrt(4*k.^2 - 1);
  [V, D] = spec(diag(beta, 1) + diag(beta, -1));
  z = diag(D)'; w = 2*(V(1,:)).^2;
  I = sum(w .* (b - a)/2 .* f((b - a)/2*z + (b + a)/2));
endfunction

a = ${sci(s.a)}; b = ${sci(s.b)}; n = ${s.n};
Iref = intg(a, b, f);
nt = n; ns = 2*max(1, round(n/2)); n38 = 3*max(1, round(n/3)); nb = 4*max(1, round(n/4));
M = [newton_cotes(a, b, nt, 1, [1 1], 1/2);
     newton_cotes(a, b, ns, 2, [1 4 1], 1/3);
     newton_cotes(a, b, n38, 3, [1 3 3 1], 3/8);
     newton_cotes(a, b, nb, 4, [7 32 12 32 7], 2/45);
     gauss(a, b, 2); gauss(a, b, 3); gauss(a, b, 4); gauss(a, b, 6)];
nombres = ['${L('Trapecio', 'Trapezoidal')}'; 'Simpson 1/3'; 'Simpson 3/8'; 'Boole'; 'Gauss 2'; 'Gauss 3'; 'Gauss 4'; 'Gauss 6'];
mprintf('%-14s %22s %12s\\n', '${L('Metodo', 'Method')}', '${L('Aproximacion', 'Approximation')}', 'Error');
for i = 1:size(M, 1)
  mprintf('%-14s %22.15f %12.3e\\n', nombres(i), M(i), abs(M(i) - Iref));
end
mprintf('%-14s %22.15f\\n', 'intg (ref.)', Iref);
`
}
