import { useMemo } from 'react'
import { evalNumber } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { useTheme } from '../../components/theme'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, FieldRow, IntField, MatrixField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs, VectorField, type Column } from '../../components/ui'
import * as A from './algorithms'
import { N, Note, readSystem, readVec, sciMat, sciVec, texM, TOPIC, vecText } from './shared'
import { THEORY, TITLES } from './theory'
import { L } from '../../i18n'

interface S {
  A: string
  x0: string
  variant: A.PowerVariant
  shift: string
  tol: string
  maxIter: number
}

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: 'Burden 9.2 (λ = 6)', value: { A: '-4 14 0\n-5 13 0\n-1 0 2', x0: '1 1 1', variant: 'directa' } },
  { label: L('Simétrica 3×3', 'Symmetric 3×3'), value: { A: '4 -1 1\n-1 3 -2\n1 -2 3', x0: '1 0 0', variant: 'directa' } },
  { label: L('Menor |λ| (inversa, q = 0)', 'Smallest |λ| (inverse, q = 0)'), value: { A: '-4 14 0\n-5 13 0\n-1 0 2', x0: '1 1 1', variant: 'inversa', shift: '0' } },
  { label: L('λ cercano a 19/3 (inversa)', 'λ closest to 19/3 (inverse)'), value: { A: '-4 14 0\n-5 13 0\n-1 0 2', x0: '1 1 1', variant: 'inversa', shift: '19/3' } },
  { label: L('Convergencia lenta (λ₂/λ₁ ≈ 0.95)', 'Slow convergence (λ₂/λ₁ ≈ 0.95)'), value: { A: '2 0.5\n0 1.9', x0: '0 1', variant: 'directa' } },
  { label: L('λ y −λ (no converge)', 'λ and −λ (does not converge)'), value: { A: '0 1\n1 0', x0: '1 0', variant: 'directa' } },
]

export function Potencia() {
  const [s, setS] = useLocalState<S>('sistemas:potencia', { A: '-4 14 0\n-5 13 0\n-1 0 2', x0: '1 1 1', variant: 'directa', shift: '0', tol: '1e-6', maxIter: 100 })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)
  const { digits } = useTheme()

  const calc = useMemo(() => {
    const sys = readSystem(d.A)
    if ('error' in sys) return { error: sys.error }
    const x0 = readVec(d.x0, sys.n, 'x⁽⁰⁾', 1)
    if (typeof x0 === 'string') return { error: x0 }
    const tol = evalNumber(d.tol)
    if (!(tol > 0)) return { error: L('La tolerancia debe ser un número positivo.', 'The tolerance must be a positive number.') }
    const shift = d.variant === 'inversa' ? evalNumber(d.shift) : 0
    if (!Number.isFinite(shift)) return { error: L('Desplazamiento q inválido.', 'Invalid shift q.') }
    const res = A.potencia(sys.A, x0, { variant: d.variant, shift, tol, maxIter: d.maxIter })
    if (!res.ok) return { error: res.error! }
    const eig = A.eigenvalues(sys.A)
    return { A: sys.A, n: sys.n, x0, shift, res, eig }
  }, [d])

  const inputs = (
    <>
      <MatrixField label={L('Matriz A (n×n)', 'Matrix A (n×n)')} value={s.A} onChange={(A) => set({ A })} rows={4} />
      <VectorField label={L(<>Vector inicial <Tex>{'x^{(0)}'}</Tex></>, <>Initial vector <Tex>{'x^{(0)}'}</Tex></>)}
        value={s.x0}
        onChange={(x0) => set({ x0 })}
        hint={L('Vacío = (1, 1, …, 1). Debe tener componente no nula en la dirección del vector propio buscado.', 'Empty = (1, 1, …, 1). It must have a nonzero component in the direction of the sought eigenvector.')} />
      <SelectField
        label={L('Variante', 'Variant')}
        value={s.variant}
        onChange={(variant) => set({ variant })}
        options={[
          { value: 'directa', label: L('Potencia: λ dominante (mayor |λ|)', 'Power: dominant λ (largest |λ|)') },
          { value: 'inversa', label: L('Potencia inversa con desplazamiento q', 'Inverse power with shift q') },
        ]}
      />
      {s.variant === 'inversa' && <NumField label={L(<>Desplazamiento <Tex>q</Tex></>, <>Shift <Tex>q</Tex></>)}
          value={s.shift}
          onChange={(shift) => set({ shift })}
          hint={L('Converge al valor propio más cercano a q (q = 0 ⇒ el de menor módulo)', 'Converges to the eigenvalue closest to q (q = 0 ⇒ the one of smallest modulus)')} />}
      <FieldRow>
        <NumField label={L('Tolerancia', 'Tolerance')} value={s.tol} onChange={(tol) => set({ tol })} />
        <IntField label={L('Máx. iteraciones', 'Max. iterations')} value={s.maxIter} onChange={(maxIter) => set({ maxIter })} min={1} max={5000} />
      </FieldRow>
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.potencia} topic={TOPIC} theory={THEORY.potencia} description={L(
        'Complemento (Burden, cap. 9): el cap. 3 del texto no lo desarrolla. Valor propio dominante y, con la potencia inversa, el más cercano a q.',
        'Supplement (Burden, ch. 9): chapter 3 of the textbook does not develop it. Dominant eigenvalue and, with inverse iteration, the one closest to q.',
      )} inputs={inputs}>
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <PowerResults c={calc} s={d} digits={digits} />}
    </MethodPage>
  )
}

interface Calc {
  A: A.Mat
  n: number
  x0: A.Vec
  shift: number
  res: A.PowerResult
  eig: A.Complex[] | null
}

function PowerResults({ c, s, digits }: { c: Calc; s: S; digits: number }) {
  const { res, n } = c
  const inv = s.variant === 'inversa'
  // razón de convergencia teórica
  let ratio = NaN
  if (c.eig && c.eig.length > 1) {
    const d = c.eig.map((e) => (inv ? 1 / Math.hypot(e.re - c.shift, e.im) : Math.hypot(e.re, e.im))).sort((a, b) => b - a)
    ratio = d[1] / d[0]
  }
  const Av = A.matVec(c.A, res.v)
  const resid = A.normInf(A.vsub(Av, res.v.map((v) => v * res.lambda)))
  const xs = res.rows.map((_, i) => (i + 1 < res.rows.length ? res.rows[i + 1].x : res.v))
  const cols: Column<any>[] = [
    { key: 'k', tex: 'k', fmt: 'int', align: 'center' },
    ...Array.from({ length: n }, (_, i) => ({ key: 'x' + i, tex: `x_{${i + 1}}^{(k)}` })),
    { key: 'mu', tex: '\\mu^{(k)}' },
    ...(inv ? [{ key: 'lambda', tex: '\\lambda^{(k)} = q + 1/\\mu^{(k)}' }] : []),
    { key: 'err', tex: '\\|x^{(k)}-x^{(k-1)}\\|_\\infty', fmt: 'err' },
  ]
  const rows = res.rows.map((r, i) => ({ k: r.k, mu: r.mu, lambda: r.lambda, err: r.err, ...Object.fromEntries(xs[i].map((v, j) => ['x' + j, v])) }))
  return (
    <>
      <Stats
        items={[
          { label: inv ? L('λ más cercano a q', 'λ closest to q') : L('λ dominante', 'dominant λ'), value: fmt(res.lambda, Math.min(digits + 2, 15)), accent: true },
          { label: L('Vector propio v', 'Eigenvector v'), value: vecText(res.v, Math.min(digits, 7)), hint: L('normalizado con ‖v‖∞ = 1', 'normalized with ‖v‖∞ = 1') },
          { label: L('Iteraciones', 'Iterations'), value: res.rows.length, hint: res.converged ? L('convergió', 'converged') : L('no convergió', 'did not converge') },
          { label: inv ? L('Razón |λ−q|/|λ₂−q|', 'Ratio |λ−q|/|λ₂−q|') : L('Razón |λ₂/λ₁|', 'Ratio |λ₂/λ₁|'), value: Number.isFinite(ratio) ? fmt(ratio, 4) : '—', hint: `‖Av − λv‖∞ = ${fmtErr(resid)}` },
        ]}
      />
      <Alert kind={res.converged ? 'ok' : 'warn'}>
        {res.message}
        {Number.isFinite(ratio) &&
          ratio > 0.999 &&
          L(' La razón de convergencia es ≈ 1: hay dos valores propios de igual (o casi igual) módulo.', ' The convergence ratio is ≈ 1: there are two eigenvalues of equal (or nearly equal) modulus.')}
      </Alert>
      <Tabs
        tabs={[
          { label: L('Convergencia', 'Convergence'), content: <Card><PowerPlot res={res} /></Card> },
          { label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={powerSteps(c, inv)} /></Card> },
          { label: L('Todos los valores propios', 'All eigenvalues'), content: <Card><AllEigs c={c} /></Card> },
        ]}
      />
      <Card title={L('Tabla de iteraciones', 'Iteration table')}>
        <DataTable columns={cols} rows={rows} highlightLast={res.converged} filename="potencia" />
      </Card>
      <ScilabCode code={scilabPower(c, s)} filename={inv ? 'potencia_inversa' : 'potencia'} />
    </>
  )
}

function PowerPlot({ res }: { res: A.PowerResult }) {
  const data = useMemo(() => {
    const k = res.rows.map((r) => r.k)
    return {
      lam: [{ x: k, y: res.rows.map((r) => r.lambda), type: 'scatter', mode: 'lines+markers', name: 'λ⁽ᵏ⁾', line: { color: SERIES[0], width: 2.5 } }] as Trace[],
      err: [
        { x: k, y: res.rows.map((r) => (r.err > 0 ? r.err : null)), type: 'scatter', mode: 'lines+markers', name: '‖x⁽ᵏ⁾ − x⁽ᵏ⁻¹⁾‖∞', line: { color: SERIES[1] } },
        { x: k, y: res.rows.map((r) => (r.errL > 0 ? r.errL : null)), type: 'scatter', mode: 'lines+markers', name: '|λ⁽ᵏ⁾ − λ⁽ᵏ⁻¹⁾|', line: { color: SERIES[2], dash: 'dot' } },
      ] as Trace[],
    }
  }, [res])
  return (
    <div className="grid-2">
      <Plot data={data.lam} height={320} layout={{ xaxis: { title: { text: 'k' } }, yaxis: { title: { text: 'λ⁽ᵏ⁾' } } }} />
      <div>
        <Plot data={data.err} height={320} layout={{ xaxis: { title: { text: 'k' } }, yaxis: { type: 'log', exponentformat: 'power', title: { text: 'error' } } }} />
        <Note>{L('Convergencia lineal: pendiente ≈ log₁₀ de la razón de convergencia.', 'Linear convergence: slope ≈ log₁₀ of the convergence ratio.')}</Note>
      </div>
    </div>
  )
}

function powerSteps(c: Calc, inv: boolean): { text?: string; tex?: string }[] {
  const { res } = c
  const out: { text?: string; tex?: string }[] = []
  const p0 = c.x0.reduce((p, v, i) => (Math.abs(v) > Math.abs(c.x0[p]) ? i : p), 0)
  out.push({
    text: L(`Normalizamos x⁽⁰⁾ dividiendo entre su componente de mayor módulo (p = ${p0 + 1}):`, `Normalize x⁽⁰⁾ by dividing by its component of largest modulus (p = ${p0 + 1}):`),
    tex: `x^{(0)} = \\frac{1}{${N(c.x0[p0])}}${texM(c.x0)} = ${texM(res.rows[0]?.x ?? c.x0)}`,
  })
  if (inv) {
    const B = c.A.map((r, i) => r.map((v, j) => (i === j ? v - c.shift : v)))
    out.push({ text: L('Matriz desplazada (se factoriza LU una sola vez):', 'Shifted matrix (LU-factored only once):'), tex: `A - qI = A - ${N(c.shift)}\\,I = ${texM(B)}` })
  }
  res.rows.slice(0, 3).forEach((r, i) => {
    const k = r.k
    const xn = i + 1 < res.rows.length ? res.rows[i + 1].x : res.v
    const pn = xn.findIndex((v) => v === 1)
    out.push({
      text: L(`Iteración ${k}:`, `Iteration ${k}:`),
      tex: inv
        ? `(A-qI)\\,y^{(${k})} = x^{(${k - 1})}\\;\\Rightarrow\\; y^{(${k})} = ${texM(r.y)}`
        : `y^{(${k})} = A\\,x^{(${k - 1})} = ${texM(c.A)}${texM(r.x)} = ${texM(r.y)}`,
    })
    out.push({
      tex:
        `\\mu^{(${k})} = y^{(${k})}_{${r.p + 1}} = ${N(r.mu)}` +
        (inv ? `,\\qquad \\lambda^{(${k})} = q + \\frac{1}{\\mu^{(${k})}} = ${N(c.shift)} + \\frac{1}{${N(r.mu)}} = ${N(r.lambda)}` : '') +
        `,\\qquad x^{(${k})} = \\frac{y^{(${k})}}{${N(r.y[pn >= 0 ? pn : r.p])}} = ${texM(xn)}`,
    })
    out.push({ tex: `\\|x^{(${k})} - x^{(${k - 1})}\\|_\\infty = ${N(r.err)}` })
  })
  if (res.rows.length > 3) out.push({ text: L(`… hasta la iteración ${res.rows.length} (ver tabla).`, `… up to iteration ${res.rows.length} (see table).`) })
  out.push({ text: L('Verificación del par propio:', 'Check of the eigenpair:'), tex: `A v = ${texM(A.matVec(c.A, res.v))} \\approx \\lambda v = ${N(res.lambda)}\\,${texM(res.v)}` })
  return out
}

function AllEigs({ c }: { c: Calc }) {
  if (!c.eig) return <p className="muted">{L('No se pudieron calcular los valores propios de referencia.', 'The reference eigenvalues could not be computed.')}</p>
  const target = c.res.lambda
  const closest = c.eig.reduce((p, e, i) => (Math.hypot(e.re - target, e.im) < Math.hypot(c.eig![p].re - target, c.eig![p].im) ? i : p), 0)
  return (
    <>
      <DataTable
        filename="valores_propios"
        columns={[
          { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
          { key: 're', tex: '\\operatorname{Re}\\lambda_i' },
          { key: 'im', tex: '\\operatorname{Im}\\lambda_i' },
          { key: 'mod', tex: '|\\lambda_i|' },
        ]}
        rows={c.eig.map((e, i) => ({ i: i + 1, re: e.re, im: e.im, mod: Math.hypot(e.re, e.im) }))}
        highlight={(_, i) => i === closest}
      />
      <Note>
        {L(
          'Todos los valores propios (ordenados por módulo) calculados con el algoritmo QR, equivalente a spec(A) en Scilab. Resaltado: el que encontró el método.',
          'All eigenvalues (sorted by modulus) computed with the QR algorithm, equivalent to spec(A) in Scilab. Highlighted: the one found by the method.',
        )}
      </Note>
    </>
  )
}

function scilabPower(c: Calc, s: S): string {
  const inv = s.variant === 'inversa'
  return `// ${inv ? L('Método de la potencia inversa con desplazamiento', 'Inverse power method with shift') : L('Método de la potencia', 'Power method')} — ${L('generado por NumLab', 'generated by NumLab')}
clear; clc;
A = ${sciMat(c.A)};
x = ${sciVec(c.x0)};
tol = ${s.tol}; maxit = ${s.maxIter};
n = size(A, 1);${inv ? `\nq = ${c.shift};                        // ${L('desplazamiento', 'shift')}\n[L, U, E] = lu(A - q*eye(n, n));   // E*(A - qI) = L*U, ${L('se factoriza una vez', 'factored once')}` : ''}
[mx, p] = max(abs(x));
x = x / x(p);                        // ${L('normalizar', 'normalize')}: ||x||inf = 1
lambda = %nan;
mprintf('%4s %18s %14s\\n', 'k', 'lambda', 'error');
for k = 1:maxit
  ${inv ? `y = U \\ (L \\ (E * x));            // ${L('resolver', 'solve')} (A - qI) y = x` : 'y = A * x;'}
  mu = y(p);
  ${inv ? 'lambda = q + 1/mu;' : 'lambda = mu;'}
  [mx, p] = max(abs(y));
  if y(p) == 0 then
    disp('${L('A tiene el valor propio 0; elija otro x0', 'A has the eigenvalue 0; choose another x0')}'); break;
  end
  err = norm(x - y / y(p), %inf);
  x = y / y(p);
  mprintf('%4d %18.12f %14.3e\\n', k, lambda, err);
  if err < tol then break; end
end
mprintf('${L('Valor propio', 'Eigenvalue')}: %.12f\\n', lambda);
disp('${L('Vector propio', 'Eigenvector')} (||v||inf = 1):'); disp(x);
disp('${L('Todos los valores propios', 'All eigenvalues')}, spec(A):'); disp(spec(A));
`
}
