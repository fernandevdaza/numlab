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
  { label: 'Simétrica 3×3', value: { A: '4 -1 1\n-1 3 -2\n1 -2 3', x0: '1 0 0', variant: 'directa' } },
  { label: 'Menor |λ| (inversa, q = 0)', value: { A: '-4 14 0\n-5 13 0\n-1 0 2', x0: '1 1 1', variant: 'inversa', shift: '0' } },
  { label: 'λ cercano a 19/3 (inversa)', value: { A: '-4 14 0\n-5 13 0\n-1 0 2', x0: '1 1 1', variant: 'inversa', shift: '19/3' } },
  { label: 'Convergencia lenta (λ₂/λ₁ ≈ 0.95)', value: { A: '2 0.5\n0 1.9', x0: '0 1', variant: 'directa' } },
  { label: 'λ y −λ (no converge)', value: { A: '0 1\n1 0', x0: '1 0', variant: 'directa' } },
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
    if (!(tol > 0)) return { error: 'La tolerancia debe ser un número positivo.' }
    const shift = d.variant === 'inversa' ? evalNumber(d.shift) : 0
    if (!Number.isFinite(shift)) return { error: 'Desplazamiento q inválido.' }
    const res = A.potencia(sys.A, x0, { variant: d.variant, shift, tol, maxIter: d.maxIter })
    if (!res.ok) return { error: res.error! }
    const eig = A.eigenvalues(sys.A)
    return { A: sys.A, n: sys.n, x0, shift, res, eig }
  }, [d])

  const inputs = (
    <>
      <MatrixField label="Matriz A (n×n)" value={s.A} onChange={(A) => set({ A })} rows={4} />
      <VectorField label={<>Vector inicial <Tex>{'x^{(0)}'}</Tex></>} value={s.x0} onChange={(x0) => set({ x0 })} hint="Vacío = (1, 1, …, 1). Debe tener componente no nula en la dirección del vector propio buscado." />
      <SelectField
        label="Variante"
        value={s.variant}
        onChange={(variant) => set({ variant })}
        options={[
          { value: 'directa', label: 'Potencia: λ dominante (mayor |λ|)' },
          { value: 'inversa', label: 'Potencia inversa con desplazamiento q' },
        ]}
      />
      {s.variant === 'inversa' && <NumField label={<>Desplazamiento <Tex>q</Tex></>} value={s.shift} onChange={(shift) => set({ shift })} hint="Converge al valor propio más cercano a q (q = 0 ⇒ el de menor módulo)" />}
      <FieldRow>
        <NumField label="Tolerancia" value={s.tol} onChange={(tol) => set({ tol })} />
        <IntField label="Máx. iteraciones" value={s.maxIter} onChange={(maxIter) => set({ maxIter })} min={1} max={5000} />
      </FieldRow>
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.potencia} topic={TOPIC} theory={THEORY.potencia} description="Complemento (Burden, cap. 9): el cap. 3 del texto no lo desarrolla. Valor propio dominante y, con la potencia inversa, el más cercano a q." inputs={inputs}>
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
          { label: inv ? 'λ más cercano a q' : 'λ dominante', value: fmt(res.lambda, Math.min(digits + 2, 15)), accent: true },
          { label: 'Vector propio v', value: vecText(res.v, Math.min(digits, 7)), hint: 'normalizado con ‖v‖∞ = 1' },
          { label: 'Iteraciones', value: res.rows.length, hint: res.converged ? 'convergió' : 'no convergió' },
          { label: inv ? 'Razón |λ−q|/|λ₂−q|' : 'Razón |λ₂/λ₁|', value: Number.isFinite(ratio) ? fmt(ratio, 4) : '—', hint: `‖Av − λv‖∞ = ${fmtErr(resid)}` },
        ]}
      />
      <Alert kind={res.converged ? 'ok' : 'warn'}>
        {res.message}
        {Number.isFinite(ratio) && ratio > 0.999 && ' La razón de convergencia es ≈ 1: hay dos valores propios de igual (o casi igual) módulo.'}
      </Alert>
      <Tabs
        tabs={[
          { label: 'Convergencia', content: <Card><PowerPlot res={res} /></Card> },
          { label: 'Paso a paso', content: <Card><Steps steps={powerSteps(c, inv)} /></Card> },
          { label: 'Todos los valores propios', content: <Card><AllEigs c={c} /></Card> },
        ]}
      />
      <Card title="Tabla de iteraciones">
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
        <Note>Convergencia lineal: pendiente ≈ log₁₀ de la razón de convergencia.</Note>
      </div>
    </div>
  )
}

function powerSteps(c: Calc, inv: boolean): { text?: string; tex?: string }[] {
  const { res } = c
  const out: { text?: string; tex?: string }[] = []
  const p0 = c.x0.reduce((p, v, i) => (Math.abs(v) > Math.abs(c.x0[p]) ? i : p), 0)
  out.push({
    text: `Normalizamos x⁽⁰⁾ dividiendo entre su componente de mayor módulo (p = ${p0 + 1}):`,
    tex: `x^{(0)} = \\frac{1}{${N(c.x0[p0])}}${texM(c.x0)} = ${texM(res.rows[0]?.x ?? c.x0)}`,
  })
  if (inv) {
    const B = c.A.map((r, i) => r.map((v, j) => (i === j ? v - c.shift : v)))
    out.push({ text: `Matriz desplazada (se factoriza LU una sola vez):`, tex: `A - qI = A - ${N(c.shift)}\\,I = ${texM(B)}` })
  }
  res.rows.slice(0, 3).forEach((r, i) => {
    const k = r.k
    const xn = i + 1 < res.rows.length ? res.rows[i + 1].x : res.v
    const pn = xn.findIndex((v) => v === 1)
    out.push({
      text: `Iteración ${k}:`,
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
  if (res.rows.length > 3) out.push({ text: `… hasta la iteración ${res.rows.length} (ver tabla).` })
  out.push({ text: 'Verificación del par propio:', tex: `A v = ${texM(A.matVec(c.A, res.v))} \\approx \\lambda v = ${N(res.lambda)}\\,${texM(res.v)}` })
  return out
}

function AllEigs({ c }: { c: Calc }) {
  if (!c.eig) return <p className="muted">No se pudieron calcular los valores propios de referencia.</p>
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
      <Note>Todos los valores propios (ordenados por módulo) calculados con el algoritmo QR, equivalente a spec(A) en Scilab. Resaltado: el que encontró el método.</Note>
    </>
  )
}

function scilabPower(c: Calc, s: S): string {
  const inv = s.variant === 'inversa'
  return `// ${inv ? 'Método de la potencia inversa con desplazamiento' : 'Método de la potencia'} — generado por NumLab
clear; clc;
A = ${sciMat(c.A)};
x = ${sciVec(c.x0)};
tol = ${s.tol}; maxit = ${s.maxIter};
n = size(A, 1);${inv ? `\nq = ${c.shift};                        // desplazamiento\n[L, U, E] = lu(A - q*eye(n, n));   // E*(A - qI) = L*U, se factoriza una vez` : ''}
[mx, p] = max(abs(x));
x = x / x(p);                        // normalizar: ||x||inf = 1
lambda = %nan;
mprintf('%4s %18s %14s\\n', 'k', 'lambda', 'error');
for k = 1:maxit
  ${inv ? 'y = U \\ (L \\ (E * x));            // resolver (A - qI) y = x' : 'y = A * x;'}
  mu = y(p);
  ${inv ? 'lambda = q + 1/mu;' : 'lambda = mu;'}
  [mx, p] = max(abs(y));
  if y(p) == 0 then
    disp('A tiene el valor propio 0; elija otro x0'); break;
  end
  err = norm(x - y / y(p), %inf);
  x = y / y(p);
  mprintf('%4d %18.12f %14.3e\\n', k, lambda, err);
  if err < tol then break; end
end
mprintf('Valor propio: %.12f\\n', lambda);
disp('Vector propio (||v||inf = 1):'); disp(x);
disp('Todos los valores propios, spec(A):'); disp(spec(A));
`
}
