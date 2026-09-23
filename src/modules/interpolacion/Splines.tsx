// Splines cúbicas (Cap. 4.4 del texto): incógnitas M_i = S''(x_i), condición natural o forzada.
// Opción: formulación a, b, c, d de Burden & Faires (misma spline, M_i = 2c_i).
import { useMemo, type ReactNode } from 'react'
import { compileDerivative, evalNumber, toScilab } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, CheckField, DataTable, Examples, FieldRow, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs, texMatrix } from '../../components/ui'
import * as A from './algorithms'
import { DataInput, DATA_DEFAULTS, parseData, type DataState, type ParsedData } from './DataInput'
import { polyTex, sci, sciVec, sub, texFactor, tn, tp } from './texutil'
import { THEORY, TITLES, TOPIC } from './theory'
import { L } from '../../i18n'

interface State extends DataState {
  bc: A.SplineBC
  fpa: string
  fpb: string
  cmpPoly: boolean
  /** 'M': formulación del texto con segundas derivadas; 'abcd': Burden & Faires */
  form: 'M' | 'abcd'
}

// Ej. 4.12 del texto: log10(x) redondeado; el texto usa f(2.5) = 0.397994 en este ejemplo (en los demás, 0.397940)
const EJ412: Partial<State> = { mode: 'puntos', xs: '1.2 1.6 2.1 2.5 2.7', ys: '0.079181 0.204120 0.322219 0.397994 0.431364', f: 'log10(x)', xbar: '2.3', cmpPoly: false }

const DEFAULTS: State = { ...DATA_DEFAULTS, ...EJ412, frac: false, bc: 'natural', fpa: '', fpb: '', form: 'M' } as State

const EXAMPLES: { label: string; value: Partial<State> }[] = [
  { label: L('Ej. 4.12 (1) · natural, S(2.3)', 'Ex. 4.12 (1) · natural, S(2.3)'), value: { ...EJ412, bc: 'natural' } },
  { label: L('Ej. 4.12 (2) · forzada, S(2.3)', 'Ex. 4.12 (2) · clamped, S(2.3)'), value: { ...EJ412, bc: 'sujeto', fpa: '0.361912', fpb: '0.160850' } },
  { label: L('Práctica 6 · sen²x, natural', 'Practice 6 · sin²x, natural'), value: { mode: 'funcion', xs: '2 2.1 2.2 2.3 2.5', f: 'sin(x)^2', xbar: '2.15', bc: 'natural', cmpPoly: false } },
  { label: L('Práctica 6 · sen²x, forzada', 'Practice 6 · sin²x, clamped'), value: { mode: 'funcion', xs: '2 2.1 2.2 2.3 2.5', f: 'sin(x)^2', xbar: '2.15', bc: 'sujeto', fpa: '', fpb: '', cmpPoly: false } },
  { label: L('Fig. 4.2 · 1/(1+x²), 10 tramos', 'Fig. 4.2 · 1/(1+x²), 10 pieces'), value: { mode: 'funcion', xs: '-5 -4 -3 -2 -1 0 1 2 3 4 5', f: '1/(1+x^2)', xbar: '4.5', bc: 'natural', cmpPoly: true } },
  { label: L('eˣ en 0,1,2,3 · natural (Burden)', 'eˣ at 0,1,2,3 · natural (Burden)'), value: { mode: 'funcion', xs: '0 1 2 3', f: 'exp(x)', xbar: '1.5', bc: 'natural', cmpPoly: false } },
  { label: L('Datos no equiespaciados', 'Unequally spaced data'), value: { mode: 'puntos', xs: '0 1 2.5 3 4.5 6', ys: '1.2 2.1 1.7 2.4 3.6 3.0', f: '', xbar: '3.7', bc: 'natural', cmpPoly: false } },
]

interface Calc {
  error?: string
  data?: ParsedData
  sp?: A.Spline
  spM?: A.SplineM
  fpa?: number
  fpb?: number
  fpAuto?: boolean
  px?: number
  iv?: number
}

export function compute(s: State): Calc {
  const data = parseData(s, { sort: true, max: 60 })
  if (data.error) return { error: data.error }
  const { xs, ys, f, xbar } = data
  let fpa = 0, fpb = 0, fpAuto = false
  if (s.bc === 'sujeto') {
    fpa = evalNumber(s.fpa)
    fpb = evalNumber(s.fpb)
    if ((!s.fpa.trim() || !s.fpb.trim()) && f) {
      const df = compileDerivative(f)
      if (df.ok) {
        if (!s.fpa.trim()) fpa = df.f(xs[0])
        if (!s.fpb.trim()) fpb = df.f(xs[xs.length - 1])
        fpAuto = true
      }
    }
    if (!Number.isFinite(fpa) || !Number.isFinite(fpb))
      return {
        error: L(
          "Para la spline forzada indica y'₀ = f'(x₀) e y'ₙ = f'(xₙ) (o escribe f(x) para calcularlas automáticamente).",
          "For the clamped spline enter y'₀ = f'(x₀) and y'ₙ = f'(xₙ) (or enter f(x) to compute them automatically).",
        ),
      }
  }
  const sp = A.cubicSpline(xs, ys, s.bc, fpa, fpb)
  const spM = A.cubicSplineM(xs, ys, s.bc, fpa, fpb)
  if ([...sp.b, ...sp.c, ...sp.d, ...spM.M].some((v) => !Number.isFinite(v))) return { error: L('El sistema no tiene solución numérica estable (revisa los datos).', 'The system has no numerically stable solution (check the data).') }
  const out: Calc = { data, sp, spM, fpa, fpb, fpAuto }
  if (Number.isFinite(xbar)) {
    out.iv = A.splineInterval(sp, xbar)
    out.px = s.form === 'abcd' ? A.splineEval(sp, xbar) : A.splineMEval(spM, xbar)
  }
  return out
}

export function Splines() {
  const [s0, setS] = useLocalState<State>('interpolacion:splines', DEFAULTS)
  const s: State = useMemo(() => ({ ...s0, form: s0.form ?? 'M' }), [s0])
  const set = (p: Partial<State>) => setS((prev) => ({ ...prev, ...p }))
  const d = useDebounced(s, 200)
  const c = useMemo(() => compute(d), [d])
  const inputs = (
    <>
      <DataInput s={s} set={set} showFrac={false} />
      <SelectField
        label={L('Condición en los extremos', 'Endpoint condition')}
        value={s.bc}
        onChange={(bc) => set({ bc })}
        options={[
          { value: 'natural', label: L('Natural (segunda derivada): M₀ = Mₙ = 0', 'Natural (second derivative): M₀ = Mₙ = 0') },
          { value: 'sujeto', label: L("Forzada (primera derivada): S'(x₀) = y'₀, S'(xₙ) = y'ₙ", "Clamped (first derivative): S'(x₀) = y'₀, S'(xₙ) = y'ₙ") },
        ]}
      />
      <SelectField
        label={L('Formulación', 'Formulation')}
        value={s.form}
        onChange={(form) => set({ form })}
        options={[
          { value: 'M', label: L("Texto: incógnitas Mᵢ = S''(xᵢ)", "Textbook: unknowns Mᵢ = S''(xᵢ)") },
          { value: 'abcd', label: L('Burden: coeficientes aᵢ, bᵢ, cᵢ, dᵢ', 'Burden: coefficients aᵢ, bᵢ, cᵢ, dᵢ') },
        ]}
      />
      {s.bc === 'sujeto' && (
        <FieldRow>
          <NumField label={<Tex>{"y'_0 = f'(x_0)"}</Tex>} value={s.fpa} onChange={(fpa) => set({ fpa })} placeholder={s.f.trim() ? L('auto (de f)', 'auto (from f)') : ''} />
          <NumField label={<Tex>{"y'_n = f'(x_n)"}</Tex>} value={s.fpb} onChange={(fpb) => set({ fpb })} placeholder={s.f.trim() ? L('auto (de f)', 'auto (from f)') : ''} />
        </FieldRow>
      )}
      <CheckField label={L('Comparar con el polinomio interpolante global', 'Compare with the global interpolating polynomial')} value={s.cmpPoly} onChange={(cmpPoly) => set({ cmpPoly })} />
      <Examples items={EXAMPLES} onPick={(v) => set(v.bc === 'sujeto' ? v : { ...v, fpa: '', fpb: '' })} />
    </>
  )
  return (
    <MethodPage title={TITLES.splines} topic={TOPIC} theory={THEORY.splines} inputs={inputs}>
      {c.error ? <Alert kind="error">{c.error}</Alert> : c.sp && <Results s={d} c={c as Required<Calc>} />}
    </MethodPage>
  )
}

/* ───────────────────────── Resultados ───────────────────────── */

const N = (x: number) => tn(x, false, 8)
const Pn = (x: number) => tp(x, false, 8)

/** Término a_i + b_i(x − x_i) + c_i(x − x_i)² + d_i(x − x_i)³ en TeX. */
export function pieceTex(sp: A.Spline, i: number): string {
  const f = texFactor(sp.xs[i])
  const fp = (k: number) => (k === 1 ? f : f === 'x' ? `x^{${k}}` : `${f}^{${k}}`)
  const parts: string[] = []
  const coefs = [sp.a[i], sp.b[i], sp.c[i], sp.d[i]]
  coefs.forEach((v, k) => {
    if (Math.abs(v) < 1e-14 * Math.max(1, ...coefs.map(Math.abs))) return
    const abs = N(Math.abs(v))
    const body = k === 0 ? abs : (abs === '1' ? '' : abs + '\\,') + fp(k)
    parts.push(parts.length ? (v < 0 ? ' - ' : ' + ') + body : (v < 0 ? '-' : '') + body)
  })
  return parts.join('') || '0'
}

function Results({ s, c }: { s: State; c: Required<Calc> }) {
  const { sp, spM } = c
  const { xs, ys, f, xbar } = c.data
  const n = xs.length - 1
  const isM = s.form !== 'abcd'
  const has = Number.isFinite(xbar)
  const fx = has && f ? f.f(xbar) : NaN
  const extrap = has && (xbar < xs[0] || xbar > xs[n])
  const bcName = s.bc === 'natural' ? 'natural' : L('forzada', 'clamped')
  const stats: { label: ReactNode; value: ReactNode; hint?: ReactNode; accent?: boolean }[] = [
    { label: has ? `S(${fmt(xbar, 6)})` : 'S(x̄)', value: has ? fmt(c.px, 12) : '—', accent: true, hint: has ? `spline S${sub(c.iv)} ${L('de', 'on')} [${fmt(xs[c.iv], 5)}, ${fmt(xs[c.iv + 1], 5)}]` : L('indica x̄ para evaluar', 'enter x̄ to evaluate') },
    { label: L('Condición', 'Condition'), value: bcName, hint: s.bc === 'natural' ? 'M₀ = Mₙ = 0' : `y'₀ = ${fmt(c.fpa, 6)}, y'ₙ = ${fmt(c.fpb, 6)}` },
    { label: L('Sistema', 'System'), value: `${isM ? spM.A.length : n + 1}×${isM ? spM.A.length : n + 1}`, hint: L(`${n} tramos · tridiagonal (Thomas)`, `${n} pieces · tridiagonal (Thomas)`) },
  ]
  if (f && has) {
    stats.push({ label: `f(${fmt(xbar, 6)})`, value: fmt(fx, 12) })
    stats.push({ label: L('Error real f − S', 'Actual error f − S'), value: fmtErr(fx - c.px), hint: L('relativo: ', 'relative: ') + fmtErr(Math.abs((fx - c.px) / fx)) })
  }

  const shown = Math.min(n, 14)
  const cases = sp.b
    .slice(0, shown)
    .map((_, i) => `${isM ? polyTex(A.splineMPiece(spM, i), false, 7) : pieceTex(sp, i)} & ${N(xs[i])} \\le x ${i === n - 1 ? '\\le' : '<'} ${N(xs[i + 1])}`)
  if (shown < n) cases.push('\\vdots & \\vdots')

  return (
    <>
      <Stats items={stats} />
      {extrap && (
        <Alert kind="warn">
          {L(
            <>x̄ = {fmt(xbar)} está fuera de [{fmt(xs[0])}, {fmt(xs[n])}]: se extrapola con el tramo extremo.</>,
            <>x̄ = {fmt(xbar)} lies outside [{fmt(xs[0])}, {fmt(xs[n])}]: it is extrapolated with the end piece.</>,
          )}
        </Alert>
      )}
      {s.bc === 'sujeto' && c.fpAuto && (
        <Alert kind="info">
          {L('Derivadas en los extremos calculadas a partir de f:', 'Endpoint derivatives computed from f:')} <Tex>{`y'_0 = f'(x_0) = ${N(c.fpa)},\\; y'_n = f'(x_n) = ${N(c.fpb)}`}</Tex>
        </Alert>
      )}
      <Card title={isM ? L('Splines Sᵢ(x) = aᵢ + bᵢx + cᵢx² + dᵢx³ (desarrolladas)', 'Splines Sᵢ(x) = aᵢ + bᵢx + cᵢx² + dᵢx³ (expanded)') : L('Spline cúbica S(x) (forma de Burden)', 'Cubic spline S(x) (Burden form)')}>
        <Tex block>{`S(x) = \\begin{cases} ${cases.join(' \\\\ ')} \\end{cases}`}</Tex>
      </Card>
      {isM ? (
        <Card title={L('Segundas derivadas en los nodos', 'Second derivatives at the nodes')}>
          <DataTable
            filename="spline_M"
            columns={[
              { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
              { key: 'x', tex: 'x_i' },
              { key: 'y', tex: 'y_i' },
              { key: 'h', tex: 'h_i = x_{i+1}-x_i' },
              { key: 'M', tex: "M_i = S''(x_i)" },
            ]}
            rows={xs.map((x, i) => ({ i, x, y: ys[i], h: i < n ? spM.h[i] : '', M: spM.M[i] }))}
            highlight={(_, i) => has && (i === c.iv || i === c.iv + 1)}
          />
          <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
            {s.bc === 'natural'
              ? L('M₀ y Mₙ son 0 por la condición natural; los demás salen del sistema.', 'M₀ and Mₙ are 0 by the natural condition; the others come from the system.')
              : L('Los n + 1 valores Mᵢ salen del sistema.', 'The n + 1 values Mᵢ come from the system.')}{' '}
            {L('Resaltados: los Mᵢ que usa el tramo de x̄.', 'Highlighted: the Mᵢ used by the piece containing x̄.')}
          </p>
        </Card>
      ) : (
        <Card title={L('Coeficientes por tramo', 'Coefficients per piece')}>
          <DataTable
            filename="spline_coeficientes"
            columns={[
              { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
              { key: 'iv', tex: '[x_i,\\,x_{i+1}]', align: 'center' },
              { key: 'h', tex: 'h_i' },
              { key: 'a', tex: 'a_i' },
              { key: 'b', tex: 'b_i' },
              { key: 'c', tex: 'c_i' },
              { key: 'd', tex: 'd_i' },
            ]}
            rows={sp.h.map((h, i) => ({ i, iv: `[${fmt(xs[i], 6)}, ${fmt(xs[i + 1], 6)}]`, h, a: sp.a[i], b: sp.b[i], c: sp.c[i], d: sp.d[i] }))}
            highlight={(_, i) => has && i === c.iv}
          />
          <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
            <Tex>{`c_{${n}} = ${N(sp.c[n])}`}</Tex> {L('(valor en el último nodo). Relación con el texto:', '(value at the last node). Relation to the textbook:')} <Tex>{"M_i = S''(x_i) = 2c_i"}</Tex>.
          </p>
        </Card>
      )}
      <Tabs
        tabs={[
          { label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={isM ? stepsM(s, c) : steps(s, c)} /></Card> },
          { label: L('Sistema tridiagonal', 'Tridiagonal system'), content: <Card>{isM ? <SystemViewM c={c} /> : <SystemView c={c} />}</Card> },
          { label: L('Gráfica', 'Plot'), content: <Card><MainPlot s={s} c={c} /></Card> },
          { label: "S', S''", content: <Card><DerivPlot c={c} /></Card> },
        ]}
      />
      <ScilabCode code={isM ? scilabM(s, c) : scilab(s, c)} filename={s.bc === 'natural' ? 'spline_natural' : 'spline_forzada'} />
    </>
  )
}

function SystemViewM({ c }: { c: Required<Calc> }) {
  const { spM } = c
  const N_ = spM.A.length
  if (N_ === 0)
    return (
      <Alert kind="info">
        {L(
          'Con dos nodos y condición natural no hay incógnitas: M₀ = M₁ = 0 y la spline es la recta que une los puntos.',
          'With two nodes and the natural condition there are no unknowns: M₀ = M₁ = 0 and the spline is the straight line through the points.',
        )}
      </Alert>
    )
  if (N_ > 14)
    return (
      <Alert kind="info">
        {L(
          <>
            El sistema es de {N_}×{N_}; se muestra sólo hasta 14 incógnitas. Los valores <Tex>M_i</Tex> están en la tabla.
          </>,
          <>
            The system is {N_}×{N_}; it is shown only up to 14 unknowns. The values <Tex>M_i</Tex> are in the table.
          </>,
        )}
      </Alert>
    )
  const mv = `\\begin{bmatrix}${spM.idx.map((i) => `M_{${i}}`).join('\\\\')}\\end{bmatrix}`
  return (
    <>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        {L(
          <>
            Sistema <Tex>{'H\\,M = Y'}</Tex> del texto ({spM.bc === 'natural' ? <>condición natural: <Tex>{'M_0 = M_n = 0'}</Tex> y quedan n − 1 ecuaciones, (4.44)</> : <>condición forzada: n + 1 ecuaciones, (4.43)</>}).
            Es tridiagonal y diagonalmente dominante; se resuelve con el método de Thomas.
          </>,
          <>
            Textbook system <Tex>{'H\\,M = Y'}</Tex> ({spM.bc === 'natural' ? <>natural condition: <Tex>{'M_0 = M_n = 0'}</Tex>, leaving n − 1 equations, (4.44)</> : <>clamped condition: n + 1 equations, (4.43)</>}).
            It is tridiagonal and diagonally dominant; it is solved with the Thomas algorithm.
          </>,
        )}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <Tex block>{`${texMatrix(spM.A, 6)}${mv} = ${texMatrix(spM.r, 8)}`}</Tex>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>{L('Solución:', 'Solution:')}</p>
      <div style={{ overflowX: 'auto' }}>
        <Tex block>{`${mv} = ${texMatrix(spM.idx.map((i) => spM.M[i]), 10)}`}</Tex>
      </div>
    </>
  )
}

/** Paso a paso con la construcción del texto (4.38)–(4.42). */
export function stepsM(s: State, c: Required<Calc>) {
  const { spM } = c
  const { xs, ys, f, xbar } = c.data
  const n = xs.length - 1
  const h = spM.h
  const out: { text?: ReactNode; tex?: string }[] = []
  const sl = (i: number) => `\\frac{${N(ys[i + 1])} - ${Pn(ys[i])}}{${N(h[i])}}`
  out.push({ text: L(`${n + 1} nodos ⇒ ${n} splines. Tamaño de los subintervalos, (4.38):`, `${n + 1} nodes ⇒ ${n} splines. Subinterval lengths, (4.38):`), tex: h.slice(0, 10).map((hi, i) => `h_{${i}} = ${N(hi)}`).join(',\\quad ') + (n > 10 ? ',\\;\\dots' : '') })
  if (s.bc === 'natural') out.push({ text: L('Condición sobre la segunda derivada (spline natural), (4.42):', 'Condition on the second derivative (natural spline), (4.42):'), tex: `M_0 = M_{${n}} = 0` })
  else
    out.push({
      text: L('Condición sobre la primera derivada (spline forzada), primera ecuación de (4.41):', 'Condition on the first derivative (clamped spline), first equation of (4.41):'),
      tex: `\\frac{h_0}{3}M_0 + \\frac{h_0}{6}M_1 = \\frac{y_1-y_0}{h_0} - y'_0 \\;\\Rightarrow\\; ${N(h[0] / 3)}M_0 + ${N(h[0] / 6)}M_1 = ${sl(0)} - ${Pn(c.fpa)} = ${N(spM.r[0])}`,
    })
  const row = (i: number) => spM.idx.indexOf(i)
  for (let i = 1; i < Math.min(n, 6); i++) {
    out.push({
      text: i === 1 ? L('Continuidad de S′ en los nodos interiores, i = 1, …, n − 1:', 'Continuity of S′ at the interior nodes, i = 1, …, n − 1:') : undefined,
      tex: `i=${i}:\\; ${N(h[i - 1] / 6)}M_{${i - 1}} + ${N((h[i - 1] + h[i]) / 3)}M_{${i}} + ${N(h[i] / 6)}M_{${i + 1}} = ${sl(i)} - ${sl(i - 1)} = ${N(spM.r[row(i)])}`,
    })
  }
  if (n > 6) out.push({ text: L('… (análogas para el resto de i; ver «Sistema tridiagonal»).', '… (similarly for the remaining i; see “Tridiagonal system”).') })
  if (s.bc === 'sujeto')
    out.push({
      text: L('Última ecuación de (4.41):', 'Last equation of (4.41):'),
      tex: `\\frac{h_{${n - 1}}}{6}M_{${n - 1}} + \\frac{h_{${n - 1}}}{3}M_{${n}} = y'_{${n}} - \\frac{y_{${n}}-y_{${n - 1}}}{h_{${n - 1}}} \\;\\Rightarrow\\; ${N(h[n - 1] / 6)}M_{${n - 1}} + ${N(h[n - 1] / 3)}M_{${n}} = ${N(c.fpb)} - ${sl(n - 1)} = ${N(spM.r[row(n)])}`,
    })
  out.push({
    text: L(`Resolviendo el sistema tridiagonal (${spM.A.length} ecuaciones) con el método de Thomas:`, `Solving the tridiagonal system (${spM.A.length} equations) with the Thomas algorithm:`),
    tex: spM.M.slice(0, 10).map((v, i) => `M_{${i}} = ${N(v)}`).join(',\\quad ') + (n > 9 ? ',\\;\\dots' : ''),
  })
  if (Number.isFinite(xbar)) {
    const i = c.iv
    const u = xs[i + 1] - xbar
    const v = xbar - xs[i]
    out.push({
      text: L(
        `x̄ = ${fmt(xbar)} está en [x${sub(i)}, x${sub(i + 1)}] = [${fmt(xs[i])}, ${fmt(xs[i + 1])}]: vale la spline S${sub(i)}, (4.40):`,
        `x̄ = ${fmt(xbar)} lies in [x${sub(i)}, x${sub(i + 1)}] = [${fmt(xs[i])}, ${fmt(xs[i + 1])}]: the spline S${sub(i)} applies, (4.40):`,
      ),
      tex: `S_{${i}}(x) = \\frac{(x_{${i + 1}}-x)^3M_{${i}} + (x-x_{${i}})^3M_{${i + 1}}}{6h_{${i}}} + \\frac{(x_{${i + 1}}-x)y_{${i}} + (x-x_{${i}})y_{${i + 1}}}{h_{${i}}} - \\frac{h_{${i}}}{6}\\big[(x_{${i + 1}}-x)M_{${i}} + (x-x_{${i}})M_{${i + 1}}\\big]`,
    })
    out.push({
      tex: `\\begin{aligned} S_{${i}}(${N(xbar)}) &= \\frac{(${N(u)})^3${Pn(spM.M[i])} + (${N(v)})^3${Pn(spM.M[i + 1])}}{6\\cdot ${N(h[i])}} + \\frac{(${N(u)})(${N(ys[i])}) + (${N(v)})(${N(ys[i + 1])})}{${N(h[i])}} \\\\ &\\quad - \\frac{${N(h[i])}}{6}\\big[(${N(u)})${Pn(spM.M[i])} + (${N(v)})${Pn(spM.M[i + 1])}\\big] = ${N(c.px)} \\end{aligned}`,
    })
    if (f) out.push({ tex: `f(${N(xbar)}) = ${N(f.f(xbar))},\\qquad f(\\bar x) - S(\\bar x) = ${tn(f.f(xbar) - c.px, false, 4)}` })
  }
  const p0 = A.splineMPiece(spM, 0)
  out.push({
    text: L(
      'Desarrollando en potencias de x (definición Sᵢ(x) = aᵢ + bᵢx + cᵢx² + dᵢx³), por ejemplo el primer tramo:',
      'Expanding in powers of x (definition Sᵢ(x) = aᵢ + bᵢx + cᵢx² + dᵢx³), for example the first piece:',
    ), tex: `S_0(x) = ${polyTex(p0, false, 8)}` })
  if (s.bc === 'sujeto') out.push({ text: L('Verificación:', 'Check:'), tex: `S'(x_0) = ${N(A.splineDeriv(c.sp, xs[0], 1))},\\qquad S'(x_{${n}}) = ${N(A.splineDeriv(c.sp, xs[n], 1))}` })
  return out
}

function SystemView({ c }: { c: Required<Calc> }) {
  const { sp } = c
  const n = sp.xs.length - 1
  if (n + 1 > 14)
    return (
      <Alert kind="info">
        {L(
          <>
            El sistema es de {n + 1}×{n + 1}; se muestra sólo para hasta 14 incógnitas. La solución <Tex>c_i</Tex> está en la tabla de coeficientes.
          </>,
          <>
            The system is {n + 1}×{n + 1}; it is shown only for up to 14 unknowns. The solution <Tex>c_i</Tex> is in the coefficient table.
          </>,
        )}
      </Alert>
    )
  const cvec = `\\begin{bmatrix}${sp.c.map((_, i) => `c_{${i}}`).join('\\\\')}\\end{bmatrix}`
  return (
    <>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        {L(
          <>
            Sistema <Tex>{'A\\,\\mathbf{c} = \\mathbf{r}'}</Tex> ({c.sp.bc === 'natural' ? 'condición natural: primera y última filas imponen c₀ = cₙ = 0' : "condición forzada: primera y última filas imponen S'(x₀) y S'(xₙ)"}). Es
            tridiagonal y diagonalmente dominante, por lo que se resuelve con el algoritmo de Thomas.
          </>,
          <>
            System <Tex>{'A\\,\\mathbf{c} = \\mathbf{r}'}</Tex> ({c.sp.bc === 'natural' ? 'natural condition: the first and last rows impose c₀ = cₙ = 0' : "clamped condition: the first and last rows impose S'(x₀) and S'(xₙ)"}). It is
            tridiagonal and diagonally dominant, so it is solved with the Thomas algorithm.
          </>,
        )}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <Tex block>{`${texMatrix(sp.A, 6)}${cvec} = ${texMatrix(sp.r, 8)}`}</Tex>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>{L('Solución:', 'Solution:')}</p>
      <div style={{ overflowX: 'auto' }}>
        <Tex block>{`${cvec} = ${texMatrix(sp.c, 10)}`}</Tex>
      </div>
    </>
  )
}

function range(c: Required<Calc>): [number, number] {
  const { xs, xbar } = c.data
  const pts = Number.isFinite(xbar) ? [...xs, xbar] : xs
  const lo = Math.min(...pts), hi = Math.max(...pts)
  const pad = (hi - lo) * 0.04 || 1
  return [lo - pad, hi + pad]
}

function MainPlot({ s, c }: { s: State; c: Required<Calc> }) {
  const data = useMemo(() => {
    const { xs, ys, f, xbar } = c.data
    const [a, b] = range(c)
    const t: Trace[] = []
    if (f) t.push({ ...sample(f.f, a, b, 600), type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: SERIES[1], width: 2, dash: 'dash' } })
    if (s.cmpPoly) {
      const F = A.dividedDifferences(xs, ys)[0]
      t.push({ ...sample((x) => A.newtonEval(xs, F, x), a, b, 800), type: 'scatter', mode: 'lines', name: `${L('polinomio', 'polynomial')} P${sub(xs.length - 1)}`, line: { color: SERIES[6], width: 1.6 } })
    }
    // cada tramo con su color alterno
    c.sp.h.forEach((_, i) => {
      const lo = i === 0 ? Math.min(a, xs[0]) : xs[i]
      const hi = i === xs.length - 2 ? Math.max(b, xs[i + 1]) : xs[i + 1]
      const pts = sample((x) => A.splineEval(c.sp, x), lo, hi, Math.max(40, Math.round(600 / (xs.length - 1))))
      t.push({ ...pts, type: 'scatter', mode: 'lines', name: i === 0 ? L('S(x) (tramos)', 'S(x) (pieces)') : `S${sub(i)}`, showlegend: i === 0, legendgroup: 'S', line: { color: i % 2 ? SERIES[4] : SERIES[0], width: 2.6 } })
    })
    t.push({ x: xs, y: ys, type: 'scatter', mode: 'markers', name: L('nodos', 'nodes'), marker: { color: SERIES[3], size: 9 } })
    if (Number.isFinite(xbar)) t.push({ x: [xbar], y: [c.px], type: 'scatter', mode: 'markers', name: 'S(x̄)', marker: { color: SERIES[5], size: 13, symbol: 'star' } })
    return t
  }, [s, c])
  return <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
}

function DerivPlot({ c }: { c: Required<Calc> }) {
  const data = useMemo(() => {
    const [a, b] = [c.data.xs[0], c.data.xs[c.data.xs.length - 1]]
    return [
      { ...sample((x) => A.splineDeriv(c.sp, x, 1), a, b, 800), type: 'scatter', mode: 'lines', name: "S'(x)", line: { color: SERIES[0], width: 2 } },
      { ...sample((x) => A.splineDeriv(c.sp, x, 2), a, b, 800), type: 'scatter', mode: 'lines', name: "S''(x)", line: { color: SERIES[2], width: 2 } },
      { x: c.data.xs, y: c.spM.M, type: 'scatter', mode: 'markers', name: "Mᵢ = S''(xᵢ)", marker: { color: SERIES[2], size: 7 } },
    ] as Trace[]
  }, [c])
  return (
    <>
      <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        {L(
          <>
            <Tex>{"S'"}</Tex> y <Tex>{"S''"}</Tex> son continuas en los nodos (<Tex>{"S''"}</Tex> es lineal a trozos). Con la condición natural <Tex>{"S''"}</Tex> vale 0 en los extremos.
          </>,
          <>
            <Tex>{"S'"}</Tex> and <Tex>{"S''"}</Tex> are continuous at the nodes (<Tex>{"S''"}</Tex> is piecewise linear). With the natural condition <Tex>{"S''"}</Tex> is 0 at the
            endpoints.
          </>,
        )}
      </p>
    </>
  )
}

/* ───────────────────────── Paso a paso ───────────────────────── */

export function steps(s: State, c: Required<Calc>) {
  const { sp } = c
  const { xs, f, xbar } = c.data
  const n = xs.length - 1
  const out: { text?: ReactNode; tex?: string }[] = []
  out.push({ text: L(`${n + 1} nodos (ordenados) ⇒ ${n} tramos. Amplitudes de los subintervalos:`, `${n + 1} nodes (sorted) ⇒ ${n} pieces. Subinterval lengths:`), tex: sp.h.slice(0, 10).map((h, i) => `h_{${i}} = ${N(xs[i + 1])} - ${Pn(xs[i])} = ${N(h)}`).join(',\\quad ') + (n > 10 ? ',\\;\\dots' : '') })
  out.push({ text: L('Los coeficientes aᵢ son los valores de la función:', 'The coefficients aᵢ are the function values:'), tex: sp.a.slice(0, 10).map((a, i) => `a_{${i}} = ${N(a)}`).join(',\\quad ') + (n > 9 ? ',\\;\\dots' : '') })
  if (s.bc === 'natural') out.push({ text: L('Condición natural:', 'Natural condition:'), tex: "S''(x_0) = 2c_0 = 0,\\quad S''(x_n) = 2c_n = 0 \\;\\Rightarrow\\; c_0 = c_{" + n + '} = 0' })
  else {
    out.push({
      text: L("Condición forzada, primera ecuación (S'(x₀) = y'₀):", "Clamped condition, first equation (S'(x₀) = y'₀):"),
      tex: `2h_0c_0 + h_0c_1 = \\frac{3}{h_0}(a_1 - a_0) - 3f'(x_0) \\;\\Rightarrow\\; ${N(sp.A[0][0])}c_0 + ${N(sp.A[0][1])}c_1 = \\frac{3}{${N(sp.h[0])}}(${N(sp.a[1])} - ${Pn(sp.a[0])}) - 3(${N(c.fpa)}) = ${N(sp.r[0])}`,
    })
    out.push({
      text: L("Última ecuación (S'(xₙ) = f'(xₙ)):", "Last equation (S'(xₙ) = f'(xₙ)):"),
      tex: `h_{${n - 1}}c_{${n - 1}} + 2h_{${n - 1}}c_{${n}} = 3f'(x_{${n}}) - \\frac{3}{h_{${n - 1}}}(a_{${n}} - a_{${n - 1}}) \\;\\Rightarrow\\; ${N(sp.A[n][n - 1])}c_{${n - 1}} + ${N(sp.A[n][n])}c_{${n}} = ${N(sp.r[n])}`,
    })
  }
  for (let i = 1; i < Math.min(n, 5); i++) {
    out.push({
      text: i === 1 ? L('Ecuaciones interiores (continuidad de S′ y S″):', 'Interior equations (continuity of S′ and S″):') : undefined,
      tex: `i=${i}:\\; ${N(sp.h[i - 1])}c_{${i - 1}} + 2(${N(sp.h[i - 1])} + ${N(sp.h[i])})c_{${i}} + ${N(sp.h[i])}c_{${i + 1}} = \\frac{3}{${N(sp.h[i])}}(${N(sp.a[i + 1])} - ${Pn(sp.a[i])}) - \\frac{3}{${N(sp.h[i - 1])}}(${N(sp.a[i])} - ${Pn(sp.a[i - 1])}) = ${N(sp.r[i])}`,
    })
  }
  if (n > 5) out.push({ text: L('… (análogas para el resto de i; ver pestaña “Sistema tridiagonal”).', '… (similarly for the remaining i; see the “Tridiagonal system” tab).') })
  out.push({ text: L('Resolviendo el sistema tridiagonal:', 'Solving the tridiagonal system:'), tex: sp.c.slice(0, 10).map((v, i) => `c_{${i}} = ${N(v)}`).join(',\\quad ') + (n > 9 ? ',\\;\\dots' : '') })
  for (let i = 0; i < Math.min(n, 3); i++) {
    out.push({
      text: i === 0 ? L('Coeficientes bᵢ y dᵢ:', 'Coefficients bᵢ and dᵢ:') : undefined,
      tex: `\\begin{aligned} b_{${i}} &= \\frac{a_{${i + 1}} - a_{${i}}}{h_{${i}}} - \\frac{h_{${i}}}{3}(2c_{${i}} + c_{${i + 1}}) = \\frac{${N(sp.a[i + 1])} - ${Pn(sp.a[i])}}{${N(sp.h[i])}} - \\frac{${N(sp.h[i])}}{3}(2\\cdot${Pn(sp.c[i])} + ${Pn(sp.c[i + 1])}) = ${N(sp.b[i])} \\\\ d_{${i}} &= \\frac{c_{${i + 1}} - c_{${i}}}{3h_{${i}}} = \\frac{${N(sp.c[i + 1])} - ${Pn(sp.c[i])}}{3\\cdot ${N(sp.h[i])}} = ${N(sp.d[i])} \\end{aligned}`,
    })
  }
  if (n > 3) out.push({ text: L('… (resto en la tabla de coeficientes).', '… (the rest are in the coefficient table).') })
  if (Number.isFinite(xbar)) {
    const i = c.iv
    const t = xbar - xs[i]
    out.push({
      text: L(
        `x̄ = ${fmt(xbar)} pertenece al tramo [x${sub(i)}, x${sub(i + 1)}] = [${fmt(xs[i])}, ${fmt(xs[i + 1])}]:`,
        `x̄ = ${fmt(xbar)} belongs to the piece [x${sub(i)}, x${sub(i + 1)}] = [${fmt(xs[i])}, ${fmt(xs[i + 1])}]:`,
      ),
      tex: `S_{${i}}(${N(xbar)}) = ${N(sp.a[i])} + ${Pn(sp.b[i])}(${N(t)}) + ${Pn(sp.c[i])}(${N(t)})^2 + ${Pn(sp.d[i])}(${N(t)})^3 = ${N(c.px)}`,
    })
    if (f) out.push({ tex: `f(${N(xbar)}) = ${N(f.f(xbar))},\\qquad |f(\\bar x) - S(\\bar x)| = ${tn(Math.abs(f.f(xbar) - c.px), false, 4)}` })
  }
  if (s.bc === 'sujeto') out.push({ text: L('Verificación:', 'Check:'), tex: `S'(x_0) = b_0 = ${N(sp.b[0])},\\qquad S'(x_n) = b_{${n - 1}} + 2c_{${n - 1}}h_{${n - 1}} + 3d_{${n - 1}}h_{${n - 1}}^2 = ${N(A.splineDeriv(sp, xs[n], 1))}` })
  else out.push({ text: L('Verificación:', 'Check:'), tex: `S''(x_0) = 2c_0 = ${N(2 * sp.c[0])},\\qquad S''(x_n) = 2c_{${n - 1}} + 6d_{${n - 1}}h_{${n - 1}} = ${N(A.splineDeriv(sp, xs[n], 2))}` })
  return out
}

/* ───────────────────────── Scilab ───────────────────────── */

export function scilab(s: State, c: Required<Calc>): string {
  const { xs, ys, f, xbar } = c.data
  const xb = Number.isFinite(xbar) ? sci(xbar) : sci((xs[0] + xs[1]) / 2)
  const clamped = s.bc === 'sujeto'
  return `// ${L(`Spline cubica ${clamped ? 'forzada (clamped)' : 'natural'} (forma de Burden) — generado por NumLab`, `${clamped ? 'Clamped' : 'Natural'} cubic spline (Burden form) — generated by NumLab`)}
// S_i(x) = a_i + b_i (x - x_i) + c_i (x - x_i)^2 + d_i (x - x_i)^3
clear; clc;
${f ? `function y = f(x)\n  y = ${toScilab(f.src, true)};\nendfunction\n` : ''}
x = ${sciVec(xs)};
y = ${s.mode === 'funcion' && f ? 'f(x)' : sciVec(ys)};
xb = ${xb};
${clamped ? `fpa = ${sci(c.fpa)}; fpb = ${sci(c.fpb)};   // f'(x0), f'(xn)\n` : ''}n = length(x) - 1;          // ${L('numero de tramos', 'number of pieces')}
h = diff(x);
a = y;

// ${L('Sistema tridiagonal para', 'Tridiagonal system for')} c_0 ... c_n
A = zeros(n+1, n+1); r = zeros(n+1, 1);
${
  clamped
    ? `A(1, 1) = 2*h(1); A(1, 2) = h(1);
r(1) = 3*(a(2) - a(1))/h(1) - 3*fpa;
A(n+1, n) = h(n); A(n+1, n+1) = 2*h(n);
r(n+1) = 3*fpb - 3*(a(n+1) - a(n))/h(n);`
    : `A(1, 1) = 1; A(n+1, n+1) = 1;    // c_0 = c_n = 0 (${L('frontera natural', 'natural boundary')})`
}
for i = 2:n
  A(i, i-1) = h(i-1); A(i, i) = 2*(h(i-1) + h(i)); A(i, i+1) = h(i);
  r(i) = 3*(a(i+1) - a(i))/h(i) - 3*(a(i) - a(i-1))/h(i-1);
end
disp('${L('Matriz A:', 'Matrix A:')}'); disp(A);
disp('Vector r:'); disp(r);
c = A \\ r;

b = zeros(n, 1); d = zeros(n, 1);
for i = 1:n
  b(i) = (a(i+1) - a(i))/h(i) - h(i)*(2*c(i) + c(i+1))/3;
  d(i) = (c(i+1) - c(i))/(3*h(i));
end
mprintf('%4s %12s %14s %14s %14s %14s\\n', 'i', 'x_i', 'a_i', 'b_i', 'c_i', 'd_i');
for i = 1:n
  mprintf('%4d %12.6f %14.8f %14.8f %14.8f %14.8f\\n', i-1, x(i), a(i), b(i), c(i), d(i));
end

// ${L('Evaluacion en xb', 'Evaluation at xb')}
i = 1;
for k = 1:n
  if xb >= x(k) then i = k; end
end
t = xb - x(i);
S = a(i) + b(i)*t + c(i)*t^2 + d(i)*t^3;
mprintf('S(%g) = %.12f  (${L('tramo', 'piece')} %d)\\n', xb, S, i-1);
${f ? `mprintf('f(%g) = %.12f  error = %.3e\\n', xb, f(xb), abs(f(xb) - S));\n` : ''}
// ${L('Verificacion con las funciones de Scilab', 'Check with the Scilab built-in functions')}
${clamped ? `dd = splin(x, y, "clamped", [fpa, fpb]);` : `dd = splin(x, y, "natural");`}
mprintf('interp(): S(%g) = %.12f\\n', xb, interp(xb, x, y, dd));

// ${L('Grafica', 'Plot')}
xx = linspace(x(1), x($), 500);
clf();
plot(xx, interp(xx, x, y, dd), 'b-');
${f ? "plot(xx, f(xx), 'g--');\n" : ''}plot(x, y, 'ro');
xgrid();
legend(${f ? `['S(x)', 'f(x)', '${L('nodos', 'nodes')}']` : `['S(x)', '${L('nodos', 'nodes')}']`});
title('${L(`Spline cubica ${clamped ? 'forzada' : 'natural'}`, `${clamped ? 'Clamped' : 'Natural'} cubic spline`)}');
`
}

/** Código Scilab con la formulación del texto: sistema para M_i, método de Thomas y evaluación con (4.40). */
export function scilabM(s: State, c: Required<Calc>): string {
  const { xs, ys, f, xbar } = c.data
  const xb = Number.isFinite(xbar) ? sci(xbar) : sci((xs[0] + xs[1]) / 2)
  const forz = s.bc === 'sujeto'
  return `// ${L(
    `Spline cubica ${forz ? 'forzada (condicion sobre la primera derivada)' : 'natural (M_0 = M_n = 0)'} — generado por NumLab`,
    `${forz ? 'Clamped cubic spline (condition on the first derivative)' : 'Natural cubic spline (M_0 = M_n = 0)'} — generated by NumLab`,
  )}
// ${L('Incognitas', 'Unknowns')}: M_i = S''(x_i). ${L('Tramo', 'Piece')} i (4.40):
// S_i(x) = [(x_(i+1)-x)^3 M_i + (x-x_i)^3 M_(i+1)]/(6h_i) + [(x_(i+1)-x) y_i + (x-x_i) y_(i+1)]/h_i
//          - h_i/6 [(x_(i+1)-x) M_i + (x-x_i) M_(i+1)]
clear; clc;
${f ? `function y = f(x)\n  y = ${toScilab(f.src, true)};\nendfunction\n` : ''}
// ${L('Metodo de Thomas: a = subdiagonal, b = diagonal, c = superdiagonal, d = lado derecho', 'Thomas algorithm: a = subdiagonal, b = diagonal, c = superdiagonal, d = right-hand side')}
function u = thomas(a, b, c, d)
  N = length(b);
  for i = 2:N
    coef = a(i) / b(i-1);
    b(i) = b(i) - coef * c(i-1);
    d(i) = d(i) - coef * d(i-1);
  end
  u = zeros(N, 1);
  u(N) = d(N) / b(N);
  for i = N-1:-1:1
    u(i) = (d(i) - c(i) * u(i+1)) / b(i);
  end
endfunction

// ${L('Evalua la spline del tramo i (indices de Scilab: nodos i e i+1)', 'Evaluates the spline of piece i (Scilab indices: nodes i and i+1)')}
function S = spline_tramo(i, M, h, x, y, t)
  u = x(i+1) - t; v = t - x(i);
  S = (u.^3 * M(i) + v.^3 * M(i+1)) / (6*h(i)) + (u * y(i) + v * y(i+1)) / h(i) - h(i)/6 * (u * M(i) + v * M(i+1));
endfunction

x = ${sciVec(xs)};
y = ${s.mode === 'funcion' && f ? 'f(x)' : sciVec(ys)};
xb = ${xb};
${forz ? `dy0 = ${sci(c.fpa)}; dyn = ${sci(c.fpb)};   // y'_0, y'_n\n` : ''}n = length(x) - 1;       // ${L('numero de splines', 'number of splines')}
h = diff(x);
sl = diff(y) ./ h;       // (y_(i+1) - y_i)/h_i
${
  forz
    ? `// ${L('Sistema de n+1 ecuaciones (4.43) para', 'System of n+1 equations (4.43) for')} M_0 ... M_n
N = n + 1;
a = zeros(N, 1); b = zeros(N, 1); c = zeros(N, 1); d = zeros(N, 1);
b(1) = h(1)/3; c(1) = h(1)/6; d(1) = sl(1) - dy0;
for i = 2:n
  a(i) = h(i-1)/6; b(i) = (h(i-1) + h(i))/3; c(i) = h(i)/6;
  d(i) = sl(i) - sl(i-1);
end
a(N) = h(n)/6; b(N) = h(n)/3; d(N) = dyn - sl(n);
M = thomas(a, b, c, d);`
    : `// ${L('Sistema de n-1 ecuaciones (4.44) para', 'System of n-1 equations (4.44) for')} M_1 ... M_(n-1); M_0 = M_n = 0
M = zeros(n+1, 1);
if n > 1 then
  N = n - 1;
  a = zeros(N, 1); b = zeros(N, 1); c = zeros(N, 1); d = zeros(N, 1);
  for r = 1:N
    i = r + 1;   // ${L('nodo interior x_(i-1) en notacion del texto', 'interior node x_(i-1) in textbook notation')}
    if r > 1 then a(r) = h(i-1)/6; end
    b(r) = (h(i-1) + h(i))/3;
    if r < N then c(r) = h(i)/6; end
    d(r) = sl(i) - sl(i-1);
  end
  M(2:n) = thomas(a, b, c, d);
end`
}
mprintf('%4s %12s %14s %16s\\n', 'i', 'x_i', 'y_i', 'M_i');
for i = 1:n+1
  mprintf('%4d %12.6f %14.8f %16.10f\\n', i-1, x(i), y(i), M(i));
end

// ${L('Evaluacion en xb: se busca el tramo [x_i, x_(i+1)] que contiene xb', 'Evaluation at xb: find the piece [x_i, x_(i+1)] containing xb')}
i = 1;
for k = 1:n
  if xb >= x(k) then i = k; end
end
S = spline_tramo(i, M, h, x, y, xb);
mprintf('S_%d(%g) = %.12f\\n', i-1, xb, S);
${f ? `mprintf('f(%g) = %.12f  error = %.3e\\n', xb, f(xb), f(xb) - S);\n` : ''}
// ${L('Verificacion con las funciones de Scilab', 'Check with the Scilab built-in functions')}
${forz ? `dd = splin(x, y, "clamped", [dy0, dyn]);` : `dd = splin(x, y, "natural");`}
mprintf('interp(): S(%g) = %.12f\\n', xb, interp(xb, x, y, dd));

// ${L('Grafica tramo por tramo', 'Plot piece by piece')}
clf();
for k = 1:n
  t = linspace(x(k), x(k+1), 60);
  plot(t, spline_tramo(k, M, h, x, y, t), 'b-');
end
${f ? "t = linspace(x(1), x($), 400); plot(t, f(t), 'g--');\n" : ''}plot(x, y, 'ro');
xgrid();
title('${L(`Spline cubica ${forz ? 'forzada' : 'natural'}`, `${forz ? 'Clamped' : 'Natural'} cubic spline`)}');
`
}
