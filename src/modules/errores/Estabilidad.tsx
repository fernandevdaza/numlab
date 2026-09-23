import { useMemo } from 'react'
import { compile, evalNumber, toScilab } from '../../lib/expr'
import { fmt, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Alert, Card, DataTable, ExprField, IntField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs } from '../../components/ui'
import { Seg } from './components'
import { roundP, type Prec } from './float'
import { absErrBig, bigOf, bigStr, mb, relErrBig, type Big } from './numeric'
import { THEORY, TITLES, TOPIC } from './theory'
import { L } from '../../i18n'

type Mode = 'recurrencia' | 'exp' | 'suma'

interface S {
  mode: Mode
  prec: Prec
  N: number
  M: number
  x: string
  term: string
  sumN: number
}

export function Estabilidad() {
  const [s, setS] = useLocalState<S>('errores:estabilidad', { mode: 'recurrencia', prec: 64, N: 25, M: 40, x: '-20', term: '1/k^2', sumN: 1000000 })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)

  const inputs = (
    <>
      <SelectField
        label={L('Experimento', 'Experiment')}
        value={s.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'recurrencia', label: L('Recurrencia Iₙ = 1 − n·Iₙ₋₁', 'Recurrence Iₙ = 1 − n·Iₙ₋₁') },
          { value: 'exp', label: L('Serie de Taylor de eˣ con x < 0', 'Taylor series of eˣ with x < 0') },
          { value: 'suma', label: L('Orden de la suma (simple precisión)', 'Summation order (single precision)') },
        ]}
      />
      {s.mode !== 'suma' && (
        <div className="field">
          <span className="field-label">{L('Aritmética', 'Arithmetic')}</span>
          <Seg
            value={s.prec}
            onChange={(prec) => set({ prec })}
            options={[
              { value: 16, label: L('Media', 'Half') },
              { value: 32, label: L('Simple', 'Single') },
              { value: 64, label: L('Doble', 'Double') },
            ]}
          />
        </div>
      )}
      {s.mode === 'recurrencia' && (
        <>
          <IntField label={L('Calcular hasta n = N', 'Compute up to n = N')} value={s.N} onChange={(N) => set({ N })} min={1} max={50} />
          <IntField
            label={L('Inicio de la recurrencia hacia atrás M (I_M = 0)', 'Start of the backward recurrence M (I_M = 0)')}
            value={s.M}
            onChange={(M) => set({ M })}
            min={1}
            max={200}
            hint={L('Debe ser M > N; cuanto mayor, más exacto', 'M > N is required; the larger, the more accurate')}
          />
        </>
      )}
      {s.mode === 'exp' && <NumField label={L('x (negativo para ver el problema)', 'x (negative to see the problem)')} value={s.x} onChange={(x) => set({ x })} />}
      {s.mode === 'suma' && (
        <>
          <ExprField label={L('Término a_k', 'Term a_k')} value={s.term} onChange={(term) => set({ term })} vars={['k']} texPrefix="a_k =" hint={L('Se suma Σ a_k, k = 1…N', 'Computes Σ a_k, k = 1…N')} />
          <IntField label={L('N (número de términos)', 'N (number of terms)')} value={s.sumN} onChange={(sumN) => set({ sumN })} min={10} max={5000000} />
          <div className="examples">
            <span className="field-label">{L('Ejemplos', 'Examples')}</span>
            <div className="chips">
              {[
                ['Σ 1/k² → π²/6', '1/k^2'],
                [L('Σ 1/k (armónica)', 'Σ 1/k (harmonic)'), '1/k'],
                ['Σ (−1)^(k+1)/k → ln 2', '(-1)^(k+1)/k'],
                ['Σ 1/k³', '1/k^3'],
              ].map(([l, t]) => (
                <button key={t} className="chip" onClick={() => set({ term: t })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )

  return (
    <MethodPage title={TITLES.estabilidad} topic={TOPIC} theory={THEORY.estabilidad} inputs={inputs} description={L('Un algoritmo es estable si no amplifica los errores de redondeo. Tres experimentos clásicos donde dos algoritmos matemáticamente equivalentes dan resultados muy distintos.', 'An algorithm is stable if it does not amplify round-off errors. Three classic experiments where two mathematically equivalent algorithms give very different results.')}>
      {d.mode === 'recurrencia' && <Recurrencia s={d} />}
      {d.mode === 'exp' && <ExpSerie s={d} />}
      {d.mode === 'suma' && <Suma s={d} />}
    </MethodPage>
  )
}

/* ───────────────────────── Recurrencia ───────────────────────── */

function Recurrencia({ s }: { s: S }) {
  const data = useMemo(() => {
    const R = (v: number) => roundP(v, s.prec)
    const N = s.N
    const M = Math.max(s.M, N + 1)
    // exacta con 100 dígitos
    const exact: Big[] = []
    let I: Big = mb().bignumber(1).minus(mb().exp(mb().bignumber(-1)))
    exact.push(I)
    for (let n = 1; n <= N; n++) {
      I = mb().bignumber(1).minus(mb().bignumber(n).times(I))
      exact.push(I)
    }
    const fwd: number[] = [R(1 - R(Math.exp(-1)))]
    for (let n = 1; n <= N; n++) fwd.push(R(1 - R(n * fwd[n - 1])))
    const bwdAll: number[] = new Array(M + 1).fill(0)
    bwdAll[M] = 0
    for (let n = M; n >= 1; n--) bwdAll[n - 1] = R(R(1 - bwdAll[n]) / n)
    const E0 = bigOf(fwd[0]).minus(exact[0]).toNumber()
    let fact = 1
    const rows = Array.from({ length: N + 1 }, (_, n) => {
      if (n > 0) fact *= n
      return { n, fwd: fwd[n], bwd: bwdAll[n], exact: exact[n].toNumber(), exactStr: bigStr(exact[n], 16), ef: absErrBig(fwd[n], exact[n]), eb: absErrBig(bwdAll[n], exact[n]), pred: fact * Math.abs(E0) }
    })
    return { rows, E0, M }
  }, [s])
  const rows = data.rows
  const last = rows[rows.length - 1]
  const firstBad = rows.find((r) => r.fwd < 0 || r.fwd > 1)
  const plot: Trace[] = [
    { x: rows.map((r) => r.n), y: rows.map((r) => (r.ef > 0 ? r.ef : null)), type: 'scatter', mode: 'lines+markers', name: L('error hacia adelante', 'forward error'), line: { color: SERIES[6] } },
    { x: rows.map((r) => r.n), y: rows.map((r) => (r.eb > 0 ? r.eb : null)), type: 'scatter', mode: 'lines+markers', name: L('error hacia atrás', 'backward error'), line: { color: SERIES[0] } },
    { x: rows.map((r) => r.n), y: rows.map((r) => (r.pred > 0 ? r.pred : null)), type: 'scatter', mode: 'lines', name: L('n!·|E₀| (predicción)', 'n!·|E₀| (prediction)'), line: { color: SERIES[1], dash: 'dot' } },
  ]
  const N = (x: number) => texNum(x, 10)
  return (
    <>
      <Stats
        items={[
          { label: L(`I_${last.n} exacto`, `exact I_${last.n}`), value: fmt(last.exact, 12), accent: true },
          { label: L('Hacia adelante', 'Forward'), value: fmt(last.fwd, 8), hint: `error ${last.ef.toExponential(2)}` },
          { label: L('Hacia atrás', 'Backward'), value: fmt(last.bwd, 12), hint: `error ${last.eb.toExponential(2)}` },
          { label: L('Error inicial E₀', 'Initial error E₀'), value: Math.abs(data.E0).toExponential(3), hint: L('redondeo de I₀ = 1 − 1/e', 'round-off of I₀ = 1 − 1/e') },
        ]}
      />
      <Alert kind="warn">
        {L(
          <>
            Como <b>0 &lt; Iₙ &lt; 1/(n+1)</b> para todo n (el integrando es positivo y ≤ xⁿ), los valores deben ser positivos y decrecientes.{' '}
            {firstBad ? `Hacia adelante, en n = ${firstBad.n} ya se obtiene ${fmt(firstBad.fwd, 6)}: ¡absurdo!` : 'Aumenta N para ver cómo la recurrencia hacia adelante produce valores absurdos.'} Hacia atrás, aunque se parte de I_{data.M} = 0 (un error enorme), el
            resultado es correcto.
          </>,
          <>
            Since <b>0 &lt; Iₙ &lt; 1/(n+1)</b> for every n (the integrand is positive and ≤ xⁿ), the values must be positive and decreasing.{' '}
            {firstBad ? `Going forward, at n = ${firstBad.n} one already gets ${fmt(firstBad.fwd, 6)}: absurd!` : 'Increase N to see how the forward recurrence produces absurd values.'} Going backward, even though it starts from I_{data.M} = 0 (a huge
            error), the result is correct.
          </>,
        )}
      </Alert>
      <Tabs
        tabs={[
          {
            label: L('Tabla', 'Table'),
            content: (
              <Card>
                <DataTable
                  filename="recurrencia"
                  columns={[
                    { key: 'n', tex: 'n', fmt: 'int', align: 'center' },
                    { key: 'fwd', tex: L('I_n\\ \\text{adelante}', 'I_n\\ \\text{forward}') },
                    { key: 'bwd', tex: L('I_n\\ \\text{atrás}', 'I_n\\ \\text{backward}') },
                    { key: 'exactStr', tex: L('I_n\\ \\text{exacto}', 'I_n\\ \\text{exact}') },
                    { key: 'ef', tex: L('|E_n|\\ \\text{adelante}', '|E_n|\\ \\text{forward}'), fmt: 'err' },
                    { key: 'eb', tex: L('|E_n|\\ \\text{atrás}', '|E_n|\\ \\text{backward}'), fmt: 'err' },
                    { key: 'pred', tex: 'n!\\,|E_0|', fmt: 'err' },
                  ]}
                  rows={rows}
                  highlight={(r) => r.fwd < 0 || r.fwd > 1}
                />
              </Card>
            ),
          },
          {
            label: L('Errores', 'Errors'),
            content: (
              <Card>
                <Plot data={plot} layout={{ yaxis: { type: 'log', title: { text: L('error absoluto', 'absolute error') }, exponentformat: 'power' }, xaxis: { title: { text: 'n' } } }} />
              </Card>
            ),
          },
          {
            label: L('Paso a paso', 'Step by step'),
            content: (
              <Card>
                <Steps
                  steps={[
                    { text: L('Integración por partes (u = xⁿ, dv = e^{x−1}dx):', 'Integration by parts (u = xⁿ, dv = e^{x−1}dx):'), tex: 'I_n = \\left[x^n e^{x-1}\\right]_0^1 - n\\int_0^1 x^{n-1}e^{x-1}dx = 1 - n\\,I_{n-1},\\qquad I_0 = 1 - e^{-1}' },
                    ...rows.slice(1, 4).map((r) => ({ tex: `I_{${r.n}} = 1 - ${r.n}\\cdot I_{${r.n - 1}} = 1 - ${r.n}(${N(rows[r.n - 1].fwd)}) = ${N(r.fwd)}` })),
                    {
                      text: L('Propagación del error: si Ĩ₀ = I₀ + E₀, restando las dos recurrencias:', 'Error propagation: if Ĩ₀ = I₀ + E₀, subtracting the two recurrences:'),
                      tex: L('E_n = -n\\,E_{n-1} \\;\\Rightarrow\\; |E_n| = n!\\,|E_0|\\quad\\text{(crecimiento factorial: INESTABLE)}', 'E_n = -n\\,E_{n-1} \\;\\Rightarrow\\; |E_n| = n!\\,|E_0|\\quad\\text{(factorial growth: UNSTABLE)}'),
                    },
                    {
                      text: L('Hacia atrás el error se divide por n en cada paso:', 'Going backward, the error is divided by n at each step:'),
                      tex: L('I_{n-1} = \\frac{1-I_n}{n} \\;\\Rightarrow\\; E_{n-1} = -\\frac{E_n}{n} \\;\\Rightarrow\\; |E_n| = \\frac{n!}{M!}|E_M|\\quad\\text{(ESTABLE)}', 'I_{n-1} = \\frac{1-I_n}{n} \\;\\Rightarrow\\; E_{n-1} = -\\frac{E_n}{n} \\;\\Rightarrow\\; |E_n| = \\frac{n!}{M!}|E_M|\\quad\\text{(STABLE)}'),
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
      <ScilabCode
        filename="recurrencia"
        code={`// ${L('Recurrencia I_n = 1 - n I_(n-1): inestable hacia adelante, estable hacia atrás — NumLab', 'Recurrence I_n = 1 - n I_(n-1): unstable forward, stable backward — NumLab')}
clear; clc;
N = ${s.N}; M = ${data.M};
If = zeros(1, N+1); If(1) = 1 - exp(-1);        // If(n+1) = I_n
for n = 1:N
  If(n+1) = 1 - n*If(n);
end
Ib = zeros(1, M+1);                             // Ib(M+1) = I_M = 0
for n = M:-1:1
  Ib(n) = (1 - Ib(n+1))/n;
end
mprintf('%4s %22s %22s\\n', 'n', '${L('adelante', 'forward')}', '${L('atras', 'backward')}');
for n = 0:N
  mprintf('%4d %22.15e %22.15e\\n', n, If(n+1), Ib(n+1));
end
`}
      />
    </>
  )
}

/* ───────────────────────── Serie de e^x ───────────────────────── */

function expSeries(x: number, p: Prec) {
  const R = (v: number) => roundP(v, p)
  const terms: { k: number; term: number; sum: number }[] = []
  let term = R(1), sum = R(1)
  terms.push({ k: 0, term, sum })
  for (let k = 1; k < 400; k++) {
    term = R(R(term * x) / k)
    const ns = R(sum + term)
    terms.push({ k, term, sum: ns })
    if (ns === sum && Math.abs(term) < Math.abs(sum) * 1e-20) break
    if (ns === sum && k > Math.abs(x) + 5) break
    sum = ns
  }
  return { terms, sum: terms[terms.length - 1].sum }
}

function ExpSerie({ s }: { s: S }) {
  const x = evalNumber(s.x)
  const data = useMemo(() => {
    if (!Number.isFinite(x) || Math.abs(x) > 700) return null
    const R = (v: number) => roundP(v, s.prec)
    const X = R(x)
    const naive = expSeries(X, s.prec)
    const pos = expSeries(Math.abs(X), s.prec)
    const stable = X < 0 ? R(1 / pos.sum) : pos.sum
    const exact = mb().exp(mb().bignumber(X))
    const en = relErrBig(naive.sum, exact)
    const es = relErrBig(stable, exact)
    const maxTerm = Math.max(...naive.terms.map((t) => Math.abs(t.term)))
    // curva de error vs x
    const xs: number[] = []
    for (let i = 0; i <= 80; i++) xs.push(R(-40 + (i * 40) / 80))
    const curve = xs.map((xx) => {
      const n = expSeries(xx, s.prec).sum
      const pp = expSeries(-xx, s.prec).sum
      const ex = mb().exp(mb().bignumber(xx))
      return { x: xx, en: relErrBig(n, ex), es: relErrBig(R(1 / pp), ex) }
    })
    return { X, naive, stable, exact, en, es, maxTerm, curve }
  }, [x, s.prec])
  if (!data) return <Alert kind="error">{L('x inválido (usa |x| ≤ 700).', 'Invalid x (use |x| ≤ 700).')}</Alert>
  const u = s.prec === 64 ? 2 ** -53 : s.prec === 32 ? 2 ** -24 : 2 ** -11
  return (
    <>
      <Stats
        items={[
          { label: L('eˣ exacto', 'exact eˣ'), value: bigStr(data.exact, 12), accent: true },
          { label: L('Suma directa Σ xᵏ/k!', 'Direct sum Σ xᵏ/k!'), value: fmt(data.naive.sum, 10), hint: L(`error relativo ${fmt(data.en, 3)}`, `relative error ${fmt(data.en, 3)}`) },
          { label: data.X < 0 ? '1 / Σ |x|ᵏ/k!' : 'Σ xᵏ/k!', value: fmt(data.stable, 12), hint: L(`error relativo ${fmt(data.es, 3)}`, `relative error ${fmt(data.es, 3)}`) },
          { label: L('Mayor término', 'Largest term'), value: fmt(data.maxTerm, 6), hint: `≈ ${data.X < 0 && data.maxTerm > 0 ? '10^' + Math.log10(data.maxTerm / Math.abs(data.exact.toNumber())).toFixed(0) : '—'} ${L('veces el resultado', 'times the result')}` },
        ]}
      />
      {data.X < 0 ? (
        <Alert kind="warn">
          {L(
            <>
              Los términos alternan de signo y llegan a {fmt(data.maxTerm, 4)}, mientras el resultado es {bigStr(data.exact, 4)}. El error de redondeo de cada suma (≈ u·{fmt(data.maxTerm, 3)}) es enorme
              comparado con el resultado: error relativo esperado ≈ u·e^(2|x|) = {fmt(u * Math.exp(2 * Math.abs(data.X)), 3)}.
            </>,
            <>
              The terms alternate in sign and reach {fmt(data.maxTerm, 4)}, while the result is {bigStr(data.exact, 4)}. The round-off error of each addition (≈ u·{fmt(data.maxTerm, 3)}) is huge
              compared with the result: expected relative error ≈ u·e^(2|x|) = {fmt(u * Math.exp(2 * Math.abs(data.X)), 3)}.
            </>,
          )}
        </Alert>
      ) : (
        <Alert kind="info">{L('Con x ≥ 0 todos los términos son positivos y la serie es estable. Prueba con x = −20.', 'With x ≥ 0 all terms are positive and the series is stable. Try x = −20.')}</Alert>
      )}
      <Tabs
        tabs={[
          {
            label: L('Error vs x', 'Error vs x'),
            content: (
              <Card>
                <Plot
                  data={[
                    { x: data.curve.map((r) => r.x), y: data.curve.map((r) => (r.en > 0 ? r.en : 1e-18)), type: 'scatter', mode: 'lines+markers', marker: { size: 4 }, name: L('suma directa', 'direct sum'), line: { color: SERIES[6] } },
                    { x: data.curve.map((r) => r.x), y: data.curve.map((r) => (r.es > 0 ? r.es : 1e-18)), type: 'scatter', mode: 'lines+markers', marker: { size: 4 }, name: '1/e^{|x|}', line: { color: SERIES[0] } },
                    { x: [-40, 0], y: [u, u], type: 'scatter', mode: 'lines', name: 'u', line: { color: SERIES[1], dash: 'dot' } },
                  ]}
                  layout={{ yaxis: { type: 'log', title: { text: L('error relativo', 'relative error') }, exponentformat: 'power' }, xaxis: { title: { text: 'x' } } }}
                />
              </Card>
            ),
          },
          {
            label: L('Términos', 'Terms'),
            content: (
              <Card>
                <Plot
                  data={[
                    { x: data.naive.terms.map((t) => t.k), y: data.naive.terms.map((t) => Math.abs(t.term) || null), type: 'bar', name: '|xᵏ/k!|', marker: { color: data.naive.terms.map((t) => (t.term < 0 ? SERIES[6] : SERIES[0])) } },
                    { x: [0, data.naive.terms.length], y: [Math.abs(data.exact.toNumber()), Math.abs(data.exact.toNumber())], type: 'scatter', mode: 'lines', name: L('resultado eˣ', 'result eˣ'), line: { color: SERIES[1], dash: 'dot' } },
                  ]}
                  layout={{ yaxis: { type: 'log', exponentformat: 'power' }, xaxis: { title: { text: 'k' } } }}
                  height={320}
                />
                <DataTable
                  filename="serie_exp"
                  maxHeight={300}
                  columns={[
                    { key: 'k', tex: 'k', fmt: 'int', align: 'center' },
                    { key: 'term', tex: '\\frac{x^k}{k!}' },
                    { key: 'sum', tex: 'S_k = \\sum_{j\\le k}\\frac{x^j}{j!}' },
                  ]}
                  rows={data.naive.terms}
                />
              </Card>
            ),
          },
        ]}
      />
      <ScilabCode
        filename="serie_exp"
        code={`// ${L('e^x por serie de Taylor: suma directa vs 1/e^|x| — NumLab', 'e^x by Taylor series: direct sum vs 1/e^|x| — NumLab')}
clear; clc;
function S = serie_exp(x)
  S = 1; t = 1; k = 0;
  while %t
    k = k + 1; t = t*x/k;
    if S + t == S then break; end
    S = S + t;
  end
endfunction
x = ${s.x};
directa = serie_exp(x);
estable = 1/serie_exp(abs(x));
mprintf('exp(x)   = %.16e\\n', exp(x));
mprintf('${L('directa ', 'direct  ')} = %.16e   (${L('err rel', 'rel err')} %.2e)\\n', directa, abs(directa-exp(x))/exp(x));
mprintf('1/e^|x|  = %.16e   (${L('err rel', 'rel err')} %.2e)\\n', estable, abs(estable-exp(x))/exp(x));
`}
      />
    </>
  )
}

/* ───────────────────────── Orden de la suma ───────────────────────── */

function Suma({ s }: { s: S }) {
  const data = useMemo(() => {
    const t = compile(s.term, ['k'])
    if (!t.ok) return { error: t.error }
    const N = Math.min(s.sumN, 5_000_000)
    const f = Math.fround
    const a = new Float64Array(N + 1)
    for (let k = 1; k <= N; k++) a[k] = t.f(k)
    if (a.some((v) => !Number.isFinite(v))) return { error: L('El término no es finito para algún k.', 'The term is not finite for some k.') }
    const checkpoints: number[] = []
    for (let p = 10; p <= N; p *= 10) checkpoints.push(p)
    if (checkpoints[checkpoints.length - 1] !== N) checkpoints.push(N)
    const rows: { n: number; fwd: number; bwd: number; kahan: number; ref: number; ef: number; eb: number; ek: number }[] = []
    let fwd = 0, ks = 0, kc = 0, ref = 0, rc = 0, ci = 0
    for (let k = 1; k <= N; k++) {
      const ak = f(a[k])
      fwd = f(fwd + ak)
      // Kahan en simple
      const y = f(ak - kc)
      const tt = f(ks + y)
      kc = f(f(tt - ks) - y)
      ks = tt
      // referencia: Kahan en doble
      const y2 = a[k] - rc
      const t2 = ref + y2
      rc = t2 - ref - y2
      ref = t2
      if (k === checkpoints[ci]) {
        let bwd = 0
        for (let j = k; j >= 1; j--) bwd = f(bwd + f(a[j]))
        const re = (v: number) => Math.abs(v - ref) / Math.abs(ref)
        rows.push({ n: k, fwd, bwd, kahan: ks, ref, ef: re(fwd), eb: re(bwd), ek: re(ks) })
        ci++
      }
    }
    return { rows }
  }, [s.term, s.sumN])
  if ('error' in data) return <Alert kind="error">{data.error}</Alert>
  const rows = data.rows
  const last = rows[rows.length - 1]
  return (
    <>
      <Stats
        items={[
          { label: L('Referencia (doble)', 'Reference (double)'), value: fmt(last.ref, 12), accent: true },
          { label: L('k = 1 → N (simple)', 'k = 1 → N (single)'), value: fmt(last.fwd, 9), hint: `error ${last.ef.toExponential(2)}` },
          { label: L('k = N → 1 (simple)', 'k = N → 1 (single)'), value: fmt(last.bwd, 9), hint: `error ${last.eb.toExponential(2)}` },
          { label: L('Kahan (simple)', 'Kahan (single)'), value: fmt(last.kahan, 9), hint: `error ${last.ek.toExponential(2)}` },
        ]}
      />
      <Alert kind="info">
        {L(
          <>
            Sumando de mayor a menor, cuando la suma parcial es grande los términos pequeños ya no la alteran (a + b = a si |b| &lt; u|a|): se pierden por completo. Sumar de menor a mayor acumula primero los
            pequeños. La <b>suma compensada de Kahan</b> guarda en una variable aparte el error de cada suma y lo reinyecta.
          </>,
          <>
            Adding from largest to smallest, once the partial sum is large the small terms no longer change it (a + b = a if |b| &lt; u|a|): they are lost completely. Adding from smallest to largest
            accumulates the small ones first. <b>Kahan compensated summation</b> keeps the error of each addition in a separate variable and feeds it back in.
          </>,
        )}
      </Alert>
      <Card title={L('Error relativo vs número de términos', 'Relative error vs number of terms')}>
        <Plot
          data={[
            { x: rows.map((r) => r.n), y: rows.map((r) => r.ef || 1e-12), type: 'scatter', mode: 'lines+markers', name: 'k = 1 → N', line: { color: SERIES[6] } },
            { x: rows.map((r) => r.n), y: rows.map((r) => r.eb || 1e-12), type: 'scatter', mode: 'lines+markers', name: 'k = N → 1', line: { color: SERIES[0] } },
            { x: rows.map((r) => r.n), y: rows.map((r) => r.ek || 1e-12), type: 'scatter', mode: 'lines+markers', name: 'Kahan', line: { color: SERIES[2] } },
            { x: [rows[0].n, last.n], y: [2 ** -24, 2 ** -24], type: 'scatter', mode: 'lines', name: L('u simple', 'u single'), line: { color: SERIES[1], dash: 'dot' } },
          ]}
          layout={{ xaxis: { type: 'log', title: { text: 'N' }, exponentformat: 'power' }, yaxis: { type: 'log', title: { text: L('error relativo', 'relative error') }, exponentformat: 'power' } }}
        />
        <DataTable
          filename="orden_suma"
          columns={[
            { key: 'n', tex: 'N', fmt: 'int' },
            { key: 'fwd', tex: '\\text{1}\\to N' },
            { key: 'bwd', tex: 'N \\to 1' },
            { key: 'kahan', tex: '\\text{Kahan}' },
            { key: 'ref', tex: L('\\text{referencia}', '\\text{reference}') },
            { key: 'ef', tex: 'E_r\\ (1\\to N)', fmt: 'err' },
            { key: 'eb', tex: 'E_r\\ (N\\to 1)', fmt: 'err' },
            { key: 'ek', tex: 'E_r\\ \\text{Kahan}', fmt: 'err' },
          ]}
          rows={rows}
        />
      </Card>
      <ScilabCode
        filename="orden_suma"
        code={`// ${L('Orden de la suma — NumLab (Scilab usa doble; el efecto es igual pero con N mayores)', 'Summation order — NumLab (Scilab uses double; the effect is the same but with larger N)')}
clear; clc;
N = ${s.sumN};
k = 1:N;
a = ${toScilab(s.term).replace(/\bk\b/g, 'k')};
S1 = 0; for j = 1:N, S1 = S1 + a(j); end      // ${L('de mayor a menor', 'largest to smallest')}
S2 = 0; for j = N:-1:1, S2 = S2 + a(j); end   // ${L('de menor a mayor', 'smallest to largest')}
S = 0; c = 0;                                  // Kahan
for j = 1:N
  y = a(j) - c; t = S + y; c = (t - S) - y; S = t;
end
mprintf('1->N: %.17g\\nN->1: %.17g\\nKahan: %.17g\\n', S1, S2, S);
`}
      />
    </>
  )
}
