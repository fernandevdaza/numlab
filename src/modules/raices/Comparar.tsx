import { useMemo } from 'react'
import { compile, compileDerivative, evalNumber } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, MethodPage, NumField } from '../../components/ui'
import * as A from './algorithms'
import { TOPIC } from './theory'
import { L } from '../../i18n'

interface S { f: string; g: string; a: string; b: string; x0: string; x1: string; tol: string }

export function Comparar() {
  const [s, setS] = useLocalState<S>('raices:comparar', { f: 'x^3 - x - 2', g: '(x + 2)^(1/3)', a: '1', b: '2', x0: '1.5', x1: '2', tol: '1e-12' })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)

  const out = useMemo(() => {
    const f = compile(d.f)
    if (!f.ok) return { error: 'f(x): ' + f.error }
    const df = compileDerivative(f)
    const d2f = df.ok ? compileDerivative(df) : df
    if (!df.ok || !d2f.ok) return { error: L('No se pudo derivar f', 'Could not differentiate f') }
    const o: A.Opts = { tol: evalNumber(d.tol), maxIter: 100, criterion: 'abs' }
    const x0 = evalNumber(d.x0)
    const runs: { name: string; res: A.RootResult }[] = [
      { name: L('Bisección', 'Bisection'), res: A.biseccion(f.f, evalNumber(d.a), evalNumber(d.b), o) },
      { name: L('Posición falsa (modificada)', 'False position (modified)'), res: A.posicionFalsa(f.f, evalNumber(d.a), evalNumber(d.b), o, true) },
      { name: 'Newton', res: A.newton(f.f, df.f, x0, o) },
      { name: L('Secante', 'Secant'), res: A.secante(f.f, x0, evalNumber(d.x1), o) },
      { name: L('Newton mod. (μ = f/f′)', 'Modified Newton (μ = f/f′)'), res: A.newtonModificado(f.f, df.f, d2f.f, x0, o, 'mu') },
    ]
    const g = d.g.trim() ? compile(d.g) : null
    if (g && g.ok) {
      runs.push({ name: L('Punto fijo', 'Fixed point'), res: A.puntoFijo(g.f, x0, o) })
      runs.push({ name: 'Aitken', res: A.aitken(g.f, x0, o) })
      runs.push({ name: 'Steffensen', res: A.steffensen(g.f, x0, o) })
    }
    return { runs, f, gErr: g && !g.ok ? g.error : null }
  }, [d])

  const plot = useMemo(() => {
    if (!('runs' in out) || !out.runs) return []
    return out.runs.map((r, i) => {
      const it = r.res.iterates
      const e = it.slice(1).map((x, k) => Math.abs(x - it[k]))
      return { x: e.map((_, k) => k + 1), y: e.map((v) => (v > 0 ? v : null)), type: 'scatter', mode: 'lines+markers', name: r.name, line: { color: SERIES[i % SERIES.length] } } as Trace
    })
  }, [out])

  return (
    <MethodPage
      title={L('Comparar métodos para f(x) = 0', 'Compare methods for f(x) = 0')}
      topic={TOPIC}
      description={L(
        'Resuelve la misma ecuación con todos los métodos a la vez y compara iteraciones, orden de convergencia y precisión.',
        'Solves the same equation with every method at once and compares iterations, order of convergence and accuracy.',
      )}
      inputs={
        <>
          <ExprField label="f(x)" value={s.f} onChange={(f) => set({ f })} texPrefix="f(x) =" />
          <ExprField label={L('g(x) para punto fijo (opcional)', 'g(x) for fixed point (optional)')} value={s.g} onChange={(g) => set({ g })} texPrefix="g(x) =" hint={L('Debe cumplir g(x*) = x* donde f(x*) = 0', 'Must satisfy g(x*) = x* where f(x*) = 0')} />
          <FieldRow>
            <NumField label={<><Tex>x_I</Tex> {L('(bisección, posición falsa)', '(bisection, false position)')}</>} value={s.a} onChange={(a) => set({ a })} />
            <NumField label={<Tex>x_D</Tex>} value={s.b} onChange={(b) => set({ b })} />
          </FieldRow>
          <FieldRow>
            <NumField label={<Tex>x_0</Tex>} value={s.x0} onChange={(x0) => set({ x0 })} />
            <NumField label={<>x₁ {L('(secante)', '(secant)')}</>} value={s.x1} onChange={(x1) => set({ x1 })} />
          </FieldRow>
          <NumField label={L('Tolerancia EPS (criterio |xₙ − xₙ₋₁| ≤ EPS)', 'Tolerance EPS (criterion |xₙ − xₙ₋₁| ≤ EPS)')} value={s.tol} onChange={(tol) => set({ tol })} />
          <Examples
            items={[
              { label: L('Texto · x³ + 4x² − 10', 'Textbook · x³ + 4x² − 10'), value: { f: 'x^3 + 4x^2 - 10', g: '0.5*sqrt(10 - x^3)', a: '1', b: '1.5', x0: '1.5', x1: '1.4' } },
              { label: 'x³ − x − 2', value: { f: 'x^3 - x - 2', g: '(x + 2)^(1/3)', a: '1', b: '2', x0: '1.5', x1: '2' } },
              { label: 'cos x − x', value: { f: 'cos(x) - x', g: 'cos(x)', a: '0', b: '1', x0: '0.5', x1: '1' } },
              { label: L('Raíz doble (Ej. 2.9): x³ − 6.4x² + 11.04x − 5.76', 'Double root (Ex. 2.9): x³ − 6.4x² + 11.04x − 5.76'), value: { f: 'x^3 - 6.4x^2 + 11.04x - 5.76', g: '', a: '0', b: '2', x0: '1', x1: '0.9' } },
            ]}
            onPick={(v) => set(v)}
          />
        </>
      }
    >
      {'error' in out && out.error ? (
        <Alert kind="error">{out.error}</Alert>
      ) : (
        'runs' in out &&
        out.runs && (
          <>
            {out.gErr && <Alert kind="warn">g(x): {out.gErr}</Alert>}
            <Card title={L('Resumen', 'Summary')}>
              <DataTable
                filename="comparacion"
                columns={[
                  { key: 'name', label: L('Método', 'Method'), align: 'left' },
                  { key: 'root', label: L('Aproximación', 'Approximation') },
                  { key: 'n', label: L('Iteraciones', 'Iterations'), fmt: 'int' },
                  { key: 'p', label: L('Orden estimado', 'Estimated order'), get: (r) => (r.p === null ? '—' : r.p.toFixed(3)) },
                  { key: 'res', label: '|f(x*)|', fmt: 'err' },
                  { key: 'ok', label: L('Estado', 'Status'), get: (r) => (r.ok ? L('✓ convergió', '✓ converged') : '✗ ' + r.msg), align: 'left' },
                ]}
                rows={out.runs.map((r) => ({ name: r.name, root: r.res.root, n: r.res.rows.length, p: A.ordenFinal(r.res.iterates), res: Math.abs(out.f.f(r.res.root)), ok: r.res.converged, msg: r.res.message }))}
              />
            </Card>
            <Card title={L('Error vs. iteración', 'Error vs. iteration')}>
              <Plot data={plot} height={420} layout={{ yaxis: { type: 'log', title: { text: '|xₙ − xₙ₋₁|' }, exponentformat: 'power' }, xaxis: { title: { text: 'n' } } }} />
            </Card>
            <Alert kind="info">
              {L(
                'Observa: bisección baja como una recta (lineal); la posición falsa depende de si un extremo queda fijo; Newton y Steffensen caen en picada (cuadrático); secante está en medio (φ ≈ 1.618). Con una raíz doble, Newton se vuelve lineal y el Newton modificado recupera la convergencia cuadrática. Mejor aproximación:',
                'Note: bisection goes down like a straight line (linear); false position depends on whether an endpoint stays fixed; Newton and Steffensen plunge (quadratic); the secant method lies in between (φ ≈ 1.618). With a double root, Newton becomes linear and modified Newton restores quadratic convergence. Best approximation:',
              )}{' '}
              {fmt(out.runs.reduce((b, r) => (Math.abs(out.f.f(r.res.root)) < Math.abs(out.f.f(b.res.root)) ? r : b)).res.root, 15)} ({fmtErr(Math.min(...out.runs.map((r) => Math.abs(out.f.f(r.res.root)))))} {L('de residuo', 'residual')}).
            </Alert>
          </>
        )
      )}
    </MethodPage>
  )
}
