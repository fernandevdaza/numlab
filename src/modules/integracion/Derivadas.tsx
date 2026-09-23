import { useMemo } from 'react'
import { L } from '../../i18n'
import { compile, compileDerivative, evalNumber, toScilab, type Compiled } from '../../lib/expr'
import { fmt, fmtErr, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs } from '../../components/ui'
import * as A from './algorithms'
import { Muted, N, P, sci } from './common'
import { THEORY, TITLES, TOPIC } from './theory'

interface S {
  f: string
  x0: string
  h: string
  scheme: A.DiffScheme
  levels: number
}

const DEF: S = { f: '-cos(x)', x0: '0.1', h: '0.2', scheme: 'progresiva2', levels: 3 }

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: L('Ej. 5.8 · avance', 'Ex. 5.8 · forward'), value: { f: '-cos(x)', x0: '0.1', h: '0.2', scheme: 'progresiva2' } },
  { label: L('Ej. 5.8 · retroceso', 'Ex. 5.8 · backward'), value: { f: '-cos(x)', x0: '0.1', h: '0.2', scheme: 'regresiva2' } },
  { label: L('Ej. 5.8 · central', 'Ex. 5.8 · central'), value: { f: '-cos(x)', x0: '0.1', h: '0.2', scheme: 'centralMedio' } },
  { label: L('Ej. 5.8 · extrapolada', 'Ex. 5.8 · extrapolated'), value: { f: '-cos(x)', x0: '0.1', h: '0.2', scheme: 'extrapolada' } },
  { label: L('Ej. 5.9 · interpolación, h = 0.5', 'Ex. 5.9 · interpolation, h = 0.5'), value: { f: '-cos(x)', x0: '0.1', h: '0.5', scheme: 'centralMedio' } },
  { label: L('Ej. 5.10 · f″ de −cos x, h = 0.5', 'Ex. 5.10 · f″ of −cos x, h = 0.5'), value: { f: '-cos(x)', x0: '0', h: '0.5', scheme: 'segunda3' } },
  { label: L('Práctica 1 · sen x / x en 0.01', 'Practice 1 · sin x / x at 0.01'), value: { f: 'sin(x)/x', x0: '0.01', h: '0.2', scheme: 'extrapolada' } },
  { label: L('Práctica 2 · x cos x en π', 'Practice 2 · x cos x at π'), value: { f: 'x*cos(x)', x0: 'pi', h: '0.2', scheme: 'centralMedio' } },
  { label: L('Práctica 3 · f″ de √x en 0.5', 'Practice 3 · f″ of √x at 0.5'), value: { f: 'sqrt(x)', x0: '0.5', h: '0.2', scheme: 'segunda3' } },
  { label: L('x·eˣ en 2 (Burden)', 'x·eˣ at 2 (Burden)'), value: { f: 'x*exp(x)', x0: '2', h: '0.1', scheme: 'centrada3' } },
  { label: L('eˣ en 1 con h = 1e-6 (redondeo)', 'eˣ at 1 with h = 1e-6 (round-off)'), value: { f: 'exp(x)', x0: '1', h: '1e-6', scheme: 'progresiva2' } },
]

const ORD = (p: number) => (p === 1 ? 'O(h)' : p === 2 ? 'O(h²)' : 'O(h⁴)')

const SCHEME_OPTIONS = (Object.keys(A.SCHEMES) as A.DiffScheme[]).map((k) => {
  const d = A.SCHEMES[k]
  return { value: k, label: `${d.libro ? `${d.label} ${d.eq}` : `${L('Otra', 'Other')}: ${d.label}`} — ${ORD(d.p)}` }
})

/** Desplazamiento en TeX: 0.5 → h/2, 0.25 → h/4, 2 → 2h. */
function offTex(o: number): string {
  if (o === 0) return 'x'
  const a = Math.abs(o)
  const t = a === 1 ? 'h' : a === 0.5 ? '\\tfrac{h}{2}' : a === 0.25 ? '\\tfrac{h}{4}' : `${a}h`
  return `x ${o > 0 ? '+' : '-'} ${t}`
}
function offSci(o: number): string {
  if (o === 0) return 'x0'
  const a = Math.abs(o)
  const t = a === 1 ? 'h' : a === 0.5 ? 'h/2' : a === 0.25 ? 'h/4' : `${a}*h`
  return `x0${o > 0 ? '+' : '-'}${t}`
}
const offTxt = (o: number) => offTex(o).replace('\\tfrac{h}{2}', 'h/2').replace('\\tfrac{h}{4}', 'h/4')

export function Derivadas() {
  const [raw, setS] = useLocalState<S>('integracion:derivadas:v2', DEF)
  const s: S = { ...DEF, ...raw, scheme: raw.scheme in A.SCHEMES ? raw.scheme : DEF.scheme }
  const set = (p: Partial<S>) => setS((v) => ({ ...DEF, ...v, ...p }))
  const d = useDebounced(s, 250)
  const c = useMemo(() => compute(d), [d])
  const sc = A.SCHEMES[s.scheme]

  const inputs = (
    <>
      <ExprField label={L('Función f(x)', 'Function f(x)')} value={s.f} onChange={(f) => set({ f })} texPrefix="f(x) =" />
      <SelectField
        label={L('Fórmula', 'Formula')}
        value={s.scheme}
        onChange={(scheme) => set({ scheme })}
        options={SCHEME_OPTIONS}
        hint={
          sc.libro
            ? L(`Fórmula ${sc.eq} del texto.`, `Formula ${sc.eq} of the textbook.`)
            : L('Fórmula adicional (Burden/Chapra), no aparece en el texto.', 'Additional formula (Burden/Chapra), not in the textbook.')
        }
      />
      <div className="field">
        <span className="field-preview">
          <Tex>{sc.tex}</Tex>
        </span>
      </div>
      <FieldRow>
        <NumField label={L('Punto x', 'Point x')} value={s.x0} onChange={(x0) => set({ x0 })} />
        <NumField label={L('Paso h', 'Step size h')} value={s.h} onChange={(h) => set({ h })} />
      </FieldRow>
      <IntField label={L('Niveles de Richardson', 'Richardson levels')} value={s.levels} onChange={(levels) => set({ levels })} min={2} max={8} />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.derivadas} topic={TOPIC} theory={THEORY.derivadas} inputs={inputs}>
      {'error' in c ? <Alert kind="error">{c.error}</Alert> : <Results s={d} c={c} />}
    </MethodPage>
  )
}

interface Calc {
  f: Compiled
  exact: Compiled | null
  d1: Compiled | null
  high: Compiled | null
  x0: number
  h: number
  D: number
  ex: number
}

function compute(s: S): Calc | { error: string } {
  const f = compile(s.f)
  if (!f.ok) return { error: 'f(x): ' + f.error }
  const x0 = evalNumber(s.x0)
  const h = evalNumber(s.h)
  if (!Number.isFinite(x0)) return { error: L('El punto x no es válido.', 'The point x is not valid.') }
  if (!(h > 0)) return { error: L('El paso h debe ser un número positivo.', 'The step size h must be a positive number.') }
  const sc = A.SCHEMES[s.scheme]
  const fx0 = f.f(x0)
  if (!Number.isFinite(fx0)) return { error: L(`f(x) no está definida en x = ${fmt(x0)} (f = ${fmt(fx0)}).`, `f(x) is not defined at x = ${fmt(x0)} (f = ${fmt(fx0)}).`) }
  for (const o of sc.offsets) {
    const v = f.f(x0 + o * h)
    if (!Number.isFinite(v)) return {
        error: L(
          `f no está definida en el nodo ${offTxt(o)} = ${fmt(x0 + o * h)}. Reduce h o elige otra fórmula.`,
          `f is not defined at the node ${offTxt(o)} = ${fmt(x0 + o * h)}. Reduce h or choose another formula.`,
        ),
      }
  }
  const ok = (r: ReturnType<typeof compileDerivative>) => (r.ok ? r : null)
  const exact = ok(compileDerivative(f, 'x', sc.k))
  const d1 = sc.k === 1 ? exact : ok(compileDerivative(f, 'x', 1))
  const high = exact ? ok(compileDerivative(exact, 'x', sc.p)) : null
  const D = A.diffApprox(f.f, x0, h, s.scheme)
  const ex = exact ? exact.f(x0) : NaN
  return { f, exact, d1, high, x0, h, D, ex }
}

function Results({ s, c }: { s: S; c: Calc }) {
  const sc = A.SCHEMES[s.scheme]
  const dName = sc.k === 1 ? "f'" : "f''"
  const err = Math.abs(c.D - c.ex)
  const fHigh = c.high ? c.high.f(c.x0) : NaN
  const may = c.high ? A.cotaDerivada(s.scheme, c.x0, c.h, c.high.f) : { bound: NaN, M: NaN }
  const bound = may.bound
  const hopt = c.high ? A.hOptimo(s.scheme, c.f.f(c.x0), fHigh) : NaN
  const sweep = useMemo(() => (Number.isFinite(c.ex) ? A.errorVsH(c.f.f, c.x0, s.scheme, c.ex, 0, 15, 0.125).filter((r) => Number.isFinite(r.D)) : []), [c, s.scheme])
  const best = sweep.reduce<{ h: number; err: number } | null>((b, r) => (r.err > 0 && Number.isFinite(r.err) && (!b || r.err < b.err) ? r : b), null)
  const highName = sc.k + sc.p <= 3 ? "'".repeat(sc.k + sc.p) : `^{(${sc.k + sc.p})}`
  const [lo, hi] = A.stencilInterval(s.scheme, c.x0, c.h)
  const roundoff = Number.isFinite(bound) && err > 10 * bound && err > 1e-13

  return (
    <>
      <Stats
        items={[
          { label: L(`Aproximación ${dName}(x)`, `Approximation ${dName}(x)`), value: fmt(c.D, 14), accent: true, hint: `${sc.short}${sc.eq ? ' ' + sc.eq : ''}` },
          { label: L(`Exacta ${dName}(x)`, `Exact ${dName}(x)`), value: Number.isFinite(c.ex) ? fmt(c.ex, 14) : '—', hint: L('derivada simbólica', 'symbolic derivative') },
          { label: L('Error exacto', 'Exact error'), value: fmtErr(err), hint: Number.isFinite(bound) ? `${L('cota', 'bound')} ${fmtErr(bound)}` : undefined },
          { label: L('Error relativo', 'Relative error'), value: c.ex !== 0 && Number.isFinite(c.ex) ? `${fmt((100 * err) / Math.abs(c.ex), 4)} %` : '—' },
        ]}
      />
      <Alert kind={roundoff ? 'warn' : 'info'}>
        {L('Término de error', 'Error term')} <Tex>{`E = ${sc.errTex}`}</Tex>, {L('con', 'with')} <Tex>{`\\xi\\in[${N(lo, 6)},\\,${N(hi, 6)}]`}</Tex>.{' '}
        {L('Mayoración', 'Error bound')}:{' '}
        <Tex>{`|E| \\le \\frac{h^{${sc.p}}}{${Math.round(1 / sc.errCoef)}}\\max|f${highName}| = ${N(bound, 4)}`}</Tex>
        {Number.isFinite(may.M) && (
          <>
            {' '}
            ({L('máx', 'max')} |f{highName.replace(/[{}^]/g, '')}| ≈ {fmt(may.M, 6)} {L('en ese intervalo', 'on that interval')})
          </>
        )}
        .{' '}
        {Number.isFinite(hopt) && (
          <>
            {L('h óptimo teórico (truncamiento = redondeo)', 'Theoretical optimal h (truncation = round-off)')} <Tex>{`h^* \\approx ${N(hopt, 3)}`}</Tex>
            {best && (
              <>
                {L('; en la práctica el menor error', '; in practice the smallest error')} ({fmtErr(best.err)}) {L('se obtiene con', 'is obtained with')} h ≈ {fmtErr(best.h)}
              </>
            )}
            .
          </>
        )}
        {roundoff &&
          L(
            ' El error real supera la mayoración: domina el error de redondeo (h demasiado pequeño).',
            ' The actual error exceeds the bound: round-off error dominates (h too small).',
          )}
      </Alert>
      <Tabs
        tabs={[
          { label: L('Tabla h, h/2, h/4', 'Table h, h/2, h/4'), content: <Card><HTable s={s} c={c} /></Card> },
          { label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={steps(s, c, may, highName)} /></Card> },
          { label: L('Gráfica', 'Plot'), content: <Card><MainPlot s={s} c={c} /></Card> },
          { label: 'Error vs h', content: <Card><ErrPlot s={s} c={c} hopt={hopt} /></Card> },
          { label: L('Todas las fórmulas', 'All formulas'), content: <Card><AllSchemes s={s} c={c} /></Card> },
          { label: 'Richardson', content: <Card><Richardson s={s} c={c} /></Card> },
        ]}
      />
      <Card title={L('Error en función de h (h = 10⁻ᵏ)', 'Error as a function of h (h = 10⁻ᵏ)')}>
        <DataTable
          filename="derivada_error_h"
          columns={[
            { key: 'h', tex: 'h', fmt: 'err' },
            { key: 'D', tex: `D(h) \\approx ${dName}(x)` },
            { key: 'err', tex: `|D(h) - ${dName}(x)|`, fmt: 'err' },
            { key: 'ratio', tex: '\\frac{E(10h)}{E(h)}', get: (r) => (Number.isFinite(r.ratio) ? fmt(r.ratio, 4) : '—') },
          ]}
          rows={sweep.filter((_, i) => i % 8 === 0).map((r, i, arr) => ({ ...r, ratio: i > 0 && r.err > 0 ? arr[i - 1].err / r.err : NaN }))}
          highlight={(r) => !!best && Math.abs(Math.log10(r.h) - Math.log10(best.h)) < 0.5}
        />
        <Muted>
          {L(
            <>
              Mientras domina el truncamiento, el cociente E(10h)/E(h) ≈ 10ᵖ = {10 ** sc.p} (orden p = {sc.p}). Cuando h es muy pequeño la cancelación en el numerador hace crecer el error
              como ε/hᵏ.
            </>,
            <>
              While truncation dominates, the ratio E(10h)/E(h) ≈ 10ᵖ = {10 ** sc.p} (order p = {sc.p}). When h is very small, cancellation in the numerator makes the error grow like
              ε/hᵏ.
            </>,
          )}
        </Muted>
      </Card>
      <ScilabCode code={scilab(s)} filename="derivada_numerica" />
    </>
  )
}

/** Tabla como la de los Ej. 5.8–5.10: aproximación, error exacto, relativo y mayorado para h, h/2, h/4. */
function HTable({ s, c }: { s: S; c: Calc }) {
  const sc = A.SCHEMES[s.scheme]
  const dName = sc.k === 1 ? "f'" : "f''"
  const rows = [c.h, c.h / 2, c.h / 4].map((h) => {
    const D = A.diffApprox(c.f.f, c.x0, h, s.scheme)
    const e = c.ex - D
    return { h, D, e, rel: c.ex !== 0 ? (100 * Math.abs(e)) / Math.abs(c.ex) : NaN, may: c.high ? A.cotaDerivada(s.scheme, c.x0, h, c.high.f).bound : NaN }
  })
  return (
    <>
      <DataTable
        filename="derivada_tabla_h"
        columns={[
          { key: 'h', tex: 'h', fmt: 'num' },
          { key: 'D', tex: `${dName}(${N(c.x0, 6)}) \\approx`, get: (r) => fmt(r.D, 14) },
          { key: 'e', tex: L('\\text{Error exacto}', '\\text{Exact error}'), get: (r) => (Number.isFinite(r.e) ? fmtErr(Math.abs(r.e)) : '—') },
          { key: 'rel', tex: L('\\text{Error relativo (\\%)}', '\\text{Relative error (\\%)}'), get: (r) => (Number.isFinite(r.rel) ? fmt(r.rel, 4) : '—') },
          { key: 'may', tex: L('\\text{Error mayorado}', '\\text{Error bound}'), get: (r) => (Number.isFinite(r.may) ? fmtErr(r.may) : '—') },
        ]}
        rows={rows}
        highlight={(_, i) => i === 0}
      />
      <Muted>
        {L(
          <>
            Al dividir h entre 2 el error se divide aproximadamente entre 2ᵖ = {2 ** sc.p}. La mayoración usa el máximo de |f{sc.k + sc.p <= 3 ? "'".repeat(sc.k + sc.p) : `⁽${sc.k + sc.p}⁾`}| en el
            intervalo que cubren los nodos, como en el Ej. 5.10.
          </>,
          <>
            Halving h divides the error by roughly 2ᵖ = {2 ** sc.p}. The bound uses the maximum of |f{sc.k + sc.p <= 3 ? "'".repeat(sc.k + sc.p) : `⁽${sc.k + sc.p}⁾`}| over the
            interval spanned by the nodes, as in Ex. 5.10.
          </>,
        )}
      </Muted>
    </>
  )
}

function MainPlot({ s, c }: { s: S; c: Calc }) {
  const sc = A.SCHEMES[s.scheme]
  const data = useMemo(() => {
    const R = Math.max(1, 3 * c.h * Math.max(...sc.offsets.map(Math.abs)))
    const a = c.x0 - R
    const b = c.x0 + R
    const f0 = c.f.f(c.x0)
    const tr: Trace[] = [{ ...sample(c.f.f, a, b), type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: SERIES[0], width: 2.5 } }]
    if (sc.k === 1) {
      if (Number.isFinite(c.ex)) tr.push({ x: [a, b], y: [f0 + c.ex * (a - c.x0), f0 + c.ex * (b - c.x0)], type: 'scatter', mode: 'lines', name: L('tangente exacta (pendiente f′(x))', 'exact tangent (slope f′(x))'), line: { color: SERIES[5], width: 1.5 } })
      tr.push({ x: [a, b], y: [f0 + c.D * (a - c.x0), f0 + c.D * (b - c.x0)], type: 'scatter', mode: 'lines', name: L('recta con pendiente D(h)', 'line with slope D(h)'), line: { color: SERIES[1], width: 1.5, dash: 'dash' } })
    } else if (c.d1) {
      const d1 = c.d1.f(c.x0)
      const par = (k: number) => (x: number) => f0 + d1 * (x - c.x0) + (k / 2) * (x - c.x0) ** 2
      if (Number.isFinite(c.ex)) tr.push({ ...sample(par(c.ex), a, b, 100), type: 'scatter', mode: 'lines', name: L('parábola osculatriz (f″ exacta)', 'osculating parabola (exact f″)'), line: { color: SERIES[5], width: 1.5 } })
      tr.push({ ...sample(par(c.D), a, b, 100), type: 'scatter', mode: 'lines', name: L('parábola con D(h)', 'parabola with D(h)'), line: { color: SERIES[1], width: 1.5, dash: 'dash' } })
    }
    const nodes = [...new Set([...sc.offsets, 0])].sort((p, q) => p - q)
    tr.push({ x: nodes.map((o) => c.x0 + o * c.h), y: nodes.map((o) => c.f.f(c.x0 + o * c.h)), type: 'scatter', mode: 'markers', name: L('nodos usados', 'nodes used'), marker: { color: SERIES[3], size: 9 } })
    return tr
  }, [s, c, sc])
  return <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
}

function ErrPlot({ s, c, hopt }: { s: S; c: Calc; hopt: number }) {
  const sc = A.SCHEMES[s.scheme]
  const data = useMemo(() => {
    if (!Number.isFinite(c.ex)) return []
    const same = (Object.keys(A.SCHEMES) as A.DiffScheme[]).filter((k) => A.SCHEMES[k].k === sc.k)
    const tr: Trace[] = same.map((k, i) => {
      const sw = A.errorVsH(c.f.f, c.x0, k, c.ex, 0, 15, 0.125)
      return {
        x: sw.map((r) => r.h),
        y: sw.map((r) => (r.err > 0 && Number.isFinite(r.err) ? r.err : null)),
        type: 'scatter',
        mode: 'lines',
        name: `${A.SCHEMES[k].short} ${ORD(A.SCHEMES[k].p)}`,
        line: { color: SERIES[i % SERIES.length], width: k === s.scheme ? 3 : 1.3, dash: A.SCHEMES[k].libro ? 'solid' : 'dot' },
        opacity: k === s.scheme ? 1 : 0.6,
      } as Trace
    })
    tr.push({ x: [c.h], y: [Math.abs(c.D - c.ex) || null], type: 'scatter', mode: 'markers', name: L('h elegido', 'chosen h'), marker: { size: 11, symbol: 'star', color: SERIES[6] } })
    if (Number.isFinite(hopt)) tr.push({ x: [hopt, hopt], y: [1e-16, 1], type: 'scatter', mode: 'lines', name: L('h* teórico', 'theoretical h*'), line: { color: SERIES[7], dash: 'dot', width: 1.2 } })
    return tr
  }, [s, c, sc, hopt])
  return (
    <>
      <Plot
        data={data}
        height={420}
        layout={{ xaxis: { type: 'log', title: { text: 'h' }, exponentformat: 'power', autorange: 'reversed' }, yaxis: { type: 'log', title: { text: L('error absoluto', 'absolute error') }, exponentformat: 'power' } }}
      />
      <Muted>
        {L(
          'A la derecha (h pequeño) cada curva baja con pendiente p (truncamiento O(hᵖ)); a partir de h* el redondeo domina y el error vuelve a crecer como ε/hᵏ. Las fórmulas de mayor orden alcanzan su mínimo con h más grande y con menor error. Línea continua: fórmulas del texto; punteada: otras.',
          'Toward the right (small h) each curve falls with slope p (truncation O(hᵖ)); beyond h* round-off dominates and the error grows again like ε/hᵏ. Higher-order formulas reach their minimum at a larger h and with a smaller error. Solid line: textbook formulas; dotted: others.',
        )}
      </Muted>
    </>
  )
}

function AllSchemes({ s, c }: { s: S; c: Calc }) {
  const k = A.SCHEMES[s.scheme].k
  const rows = (Object.keys(A.SCHEMES) as A.DiffScheme[])
    .filter((id) => A.SCHEMES[id].k === k)
    .map((id) => {
      const sc = A.SCHEMES[id]
      const D = A.diffApprox(c.f.f, c.x0, c.h, id)
      return { id, name: sc.label, src: sc.libro ? `${L('texto', 'textbook')} ${sc.eq}` : 'Burden/Chapra', ord: sc.p === 1 ? 'O(h)' : `O(h^${sc.p})`, D, err: Math.abs(D - c.ex), rel: c.ex !== 0 ? (100 * Math.abs(D - c.ex)) / Math.abs(c.ex) : NaN }
    })
  return (
    <DataTable
      filename="formulas_diferencias"
      columns={[
        { key: 'name', label: L('Fórmula', 'Formula'), align: 'left' },
        { key: 'src', label: L('Fuente', 'Source'), align: 'left' },
        { key: 'ord', label: L('Orden', 'Order'), get: (r) => <Tex>{r.ord}</Tex>, align: 'center' },
        { key: 'D', label: L('Aproximación', 'Approximation'), get: (r) => fmt(r.D, 14) },
        { key: 'err', label: L('Error absoluto', 'Absolute error'), fmt: 'err' },
        { key: 'rel', label: L('Error relativo (%)', 'Relative error (%)'), get: (r) => (Number.isFinite(r.rel) ? fmt(r.rel, 4) : '—') },
      ]}
      rows={rows}
      highlight={(r) => r.id === s.scheme}
    />
  )
}

function Richardson({ s, c }: { s: S; c: Calc }) {
  const sc = A.SCHEMES[s.scheme]
  const r = A.richardsonDeriv(c.f.f, c.x0, c.h, s.levels, s.scheme)
  const nL = r.N.length
  const best = r.N[nL - 1][nL - 1]
  const rows = r.N.map((row, i) => {
    const o: Record<string, number> = { h: r.hs[i] }
    row.forEach((v, j) => (o['N' + j] = v))
    return o
  })
  const n10 = r.N[1]
  const F = r.factors[1]
  return (
    <>
      <p style={{ marginTop: 0 }}>
        {L('Base', 'Base formula')}: <b>{sc.label}</b>, error {ORD(sc.p)}{' '}
        {sc.even ? L('con sólo potencias pares de h', 'with only even powers of h') : L('con todas las potencias de h', 'with all powers of h')} ⇒ {L('factores', 'factors')}{' '}
        {r.factors.slice(1).join(', ')}.
        {s.scheme === 'centralMedio' && L(' La columna N₂ coincide con la fórmula extrapolada (5.47).', ' Column N₂ coincides with the extrapolated formula (5.47).')}
      </p>
      <DataTable
        filename="richardson_derivada"
        columns={[{ key: 'h', tex: 'h_i', fmt: 'num' }, ...r.N.map((_, j) => ({ key: 'N' + j, tex: `N_{${j + 1}}` }))]}
        rows={rows}
        highlight={(_, i) => i === nL - 1}
      />
      {n10 && (
        <Steps
          steps={[
            {
              text: L('Primera extrapolación:', 'First extrapolation:'),
              tex: `N_2(h) = N_1(h/2) + \\frac{N_1(h/2) - N_1(h)}{${F}-1} = ${N(n10[0])} + \\frac{${N(n10[0])} - ${P(r.N[0][0])}}{${F - 1}} = ${N(n10[1])}`,
            },
            { text: L('Mejor valor (esquina inferior derecha):', 'Best value (bottom-right corner):'), tex: `${sc.k === 1 ? "f'" : "f''"}(x) \\approx ${N(best, 14)},\\qquad |\\text{error}| = ${texNum(Math.abs(best - c.ex), 3)}` },
          ]}
        />
      )}
    </>
  )
}

function steps(s: S, c: Calc, may: { bound: number; M: number }, highName: string) {
  const sc = A.SCHEMES[s.scheme]
  const dName = sc.k === 1 ? "f'" : "f''"
  const vals = sc.offsets.map((o) => c.f.f(c.x0 + o * c.h))
  const out: { text?: string; tex?: string }[] = []
  out.push({ text: `${L('Fórmula elegida', 'Chosen formula')}${sc.eq ? ' ' + sc.eq : ''}:`, tex: sc.tex })
  out.push({
    text: L(`Evaluamos f en los nodos (x = ${fmt(c.x0)}, h = ${fmt(c.h)}):`, `Evaluate f at the nodes (x = ${fmt(c.x0)}, h = ${fmt(c.h)}):`),
    tex: '\\begin{aligned}' + sc.offsets.map((o, i) => `f(${offTex(o)}) &= f(${N(c.x0 + o * c.h)}) = ${N(vals[i], 12)}`).join('\\\\') + '\\end{aligned}',
  })
  const num = sc.offsets.map((_, i) => `${i === 0 ? (sc.coefs[i] < 0 ? '-' : '') : sc.coefs[i] < 0 ? ' - ' : ' + '}${Math.abs(sc.coefs[i]) === 1 ? '' : Math.abs(sc.coefs[i])}(${N(vals[i], 12)})`).join('')
  const den = `${sc.den === 1 ? '' : sc.den + '\\cdot '}${sc.k === 1 ? P(c.h) : `(${N(c.h)})^2`}`
  out.push({ text: L('Sustituimos:', 'Substitute:'), tex: `${dName}(x) \\approx \\frac{${num}}{${den}} = ${N(c.D, 14)}` })
  if (c.exact) out.push({ text: L('Derivada exacta (simbólica) para comparar:', 'Exact (symbolic) derivative for comparison:'), tex: `${dName}(x) = ${c.exact.tex}\\;\\Rightarrow\\; ${dName}(${N(c.x0)}) = ${N(c.ex, 14)}` })
  out.push({ text: L('Error exacto y relativo:', 'Exact and relative error:'), tex: `|${N(c.ex, 14)} - ${P(c.D, 14)}| = ${texNum(Math.abs(c.D - c.ex), 4)}${c.ex !== 0 ? `\\;\\;(${texNum((100 * Math.abs(c.D - c.ex)) / Math.abs(c.ex), 4)}\\,\\%)` : ''}` })
  if (c.high && Number.isFinite(may.M)) {
    const [lo, hi] = A.stencilInterval(s.scheme, c.x0, c.h)
    out.push({
      text: L(
        'Mayoración del error de truncamiento (máximo de la derivada en el intervalo que cubren los nodos, estimado por muestreo):',
        'Truncation error bound (maximum of the derivative over the interval spanned by the nodes, estimated by sampling):',
      ),
      tex: `|E| \\le \\frac{h^{${sc.p}}}{${Math.round(1 / sc.errCoef)}}\\max_{${N(lo, 6)}\\le z\\le ${N(hi, 6)}}|f${highName}(z)| = \\frac{(${N(c.h)})^{${sc.p}}}{${Math.round(1 / sc.errCoef)}}\\cdot ${N(may.M, 8)} = ${texNum(may.bound, 4)}`,
    })
  }
  return out
}

function scilab(s: S): string {
  const sc = A.SCHEMES[s.scheme]
  const f = compile(s.f)
  const ex = f.ok ? compileDerivative(f, 'x', sc.k) : null
  const EX = ex && ex.ok ? toScilab(ex.node, false) : L('0  // escribe la derivada exacta', '0  // write the exact derivative')
  const terms = sc.offsets
    .map((o, i) => {
      const c = sc.coefs[i]
      const sign = i === 0 ? (c < 0 ? '-' : '') : c < 0 ? ' - ' : ' + '
      return `${sign}${Math.abs(c) === 1 ? '' : Math.abs(c) + '*'}f(${offSci(o)})`
    })
    .join('')
  const den = `${sc.den === 1 ? '' : sc.den + '*'}h${sc.k === 2 ? '^2' : ''}`
  return `// ${sc.label}${sc.eq ? ' ' + sc.eq : ''} — ${L('generado por NumLab', 'generated by NumLab')}
clear; clc;
function y = f(x)
  y = ${toScilab(s.f, false)};
endfunction
function y = dexacta(x)   // ${sc.k === 1 ? "f'(x)" : "f''(x)"} ${L('simbolica', 'symbolic')}
  y = ${EX};
endfunction
function D = formula(x0, h)
  D = (${terms}) / (${den});
endfunction

x0 = ${sci(s.x0)}; h0 = ${sci(s.h)};
ex = dexacta(x0);
// ${L('Tabla como en los ejemplos del texto', 'Table as in the textbook examples')}: h, h/2, h/4
mprintf('%10s %22s %12s %12s\\n', 'h', '${L('aproximacion', 'approximation')}', 'error', '${L('error rel(%)', 'rel error(%)')}');
for h = h0 ./ [1 2 4]
  D = formula(x0, h);
  mprintf('%10.5f %22.15f %12.3e %12.4f\\n', h, D, abs(ex - D), 100*abs(ex - D)/abs(ex));
end
${sc.k === 1 ? `mprintf('${L('numderivative de Scilab', 'Scilab numderivative')}: %.15f\\n', numderivative(f, x0));\n` : ''}
// ${L('Error en funcion de h: truncamiento vs redondeo', 'Error as a function of h: truncation vs round-off')}
hs = 10 .^ (-(1:14));
E = zeros(hs);
for k = 1:size(hs, '*')
  E(k) = abs(formula(x0, hs(k)) - ex);
end
[emin, kmin] = min(E);
mprintf('${L('h optimo observado', 'observed optimal h')}: %.1e (error %.3e)\\n', hs(kmin), emin);
scf(0); clf();
ok = find(E > 0);
plot2d(hs(ok), E(ok), style=2, logflag='ll');
xtitle('Error vs h', 'h', '${L('error absoluto', 'absolute error')}');
`
}
