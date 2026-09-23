import { useMemo } from 'react'
import { compile, compileDerivative, evalNumber, toScilab, type Compiled } from '../../lib/expr'
import { fmt, fmtErr, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs, parseVector } from '../../components/ui'
import * as A from './algorithms'
import { limTex, N, P, RefNote, refStats, sci, texSymbolicSum } from './common'
import { referencia1D, type Reference } from './exact'
import { THEORY, TITLES, TOPIC } from './theory'

type Mode = 'funcion' | 'datos'

/** Página: trapecio y Simpson siguen al texto (N y H); 'general' compara todas las reglas con n subintervalos. */
export type NCVariant = 'trapecio' | 'simpson' | 'general'

interface S {
  mode: Mode
  f: string
  a: string
  b: string
  /** número total de subintervalos (en Simpson es 2N) */
  n: number
  rule: A.NCRule
  xs: string
  ys: string
}

type Ex = { label: string; value: Partial<S> }

const DATA_V = { xs: '0 1 2 3 4 5 6', ys: '0 2.5 6.1 9.4 11.2 12.1 12.5' }
const DATA_CHAPRA = { xs: '0 0.12 0.22 0.32 0.36 0.40 0.44 0.54 0.64 0.70 0.80', ys: '0.2 1.309729 1.305241 1.743393 2.074903 2.456 2.842985 3.507297 3.181929 2.363 0.232' }
const P1 = 'exp(-x^2/2)/sqrt(2pi)'
const P2 = 'x^3*exp(x)'
const P3 = 'cos(x)/sqrt(x)'

const CFG: Record<NCVariant, { key: string; id: 'trapecio' | 'simpson' | 'newton-cotes'; rules: A.NCRule[]; def: S; examples: Ex[] }> = {
  trapecio: {
    key: 'integracion:trapecio',
    id: 'trapecio',
    rules: ['trapecio'],
    def: { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', n: 6, rule: 'trapecio', ...DATA_V },
    examples: [
      { label: 'Ej. 5.1 · ∫₁² ln x, N = 6', value: { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', n: 6 } },
      { label: 'Ej. 5.1 · N = 220', value: { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', n: 220 } },
      { label: 'Trapecio simple (N = 1)', value: { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', n: 1 } },
      { label: 'Práctica 1 · I₁, N = 8', value: { mode: 'funcion', f: P1, a: '-1', b: '1', n: 8 } },
      { label: 'Práctica 1 · I₂, N = 8', value: { mode: 'funcion', f: P2, a: '0', b: '1', n: 8 } },
      { label: 'Práctica 1 · I₃, N = 8', value: { mode: 'funcion', f: P3, a: '1', b: '2', n: 8 } },
      { label: 'Datos: trabajo de un resorte', value: { mode: 'datos', xs: '0 0.09 0.18 0.27 0.36', ys: '0 10 22 37 52' } },
      { label: 'Datos no equiespaciados (5.14)', value: { mode: 'datos', ...DATA_CHAPRA } },
    ],
  },
  simpson: {
    key: 'integracion:simpson',
    id: 'simpson',
    rules: ['simpson13'],
    def: { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', n: 6, rule: 'simpson13', ...DATA_V },
    examples: [
      { label: 'Ej. 5.2 · ∫₁² ln x, N = 3', value: { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', n: 6 } },
      { label: 'Ej. 5.2 · N = 6', value: { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', n: 12 } },
      { label: 'Simpson simple (N = 1)', value: { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', n: 2 } },
      { label: 'Práctica 2 · I₁, N = 4', value: { mode: 'funcion', f: P1, a: '-1', b: '1', n: 8 } },
      { label: 'Práctica 2 · I₂, N = 4', value: { mode: 'funcion', f: P2, a: '0', b: '1', n: 8 } },
      { label: 'Práctica 2 · I₃, N = 4', value: { mode: 'funcion', f: P3, a: '1', b: '2', n: 8 } },
      { label: 'Exacta en cúbicas: ∫₀² x³ dx', value: { mode: 'funcion', f: 'x^3', a: '0', b: '2', n: 2 } },
      { label: 'Datos: velocidad → distancia', value: { mode: 'datos', ...DATA_V } },
    ],
  },
  general: {
    key: 'integracion:newton-cotes:v2',
    id: 'newton-cotes',
    rules: ['trapecio', 'simpson13', 'simpson38', 'boole'],
    def: { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', n: 12, rule: 'boole', ...DATA_V },
    examples: [
      { label: '∫₁² ln x (texto), n = 12', value: { mode: 'funcion', f: 'ln(x)', a: '1', b: '2', n: 12 } },
      { label: '∫₀^π sen x dx = 2', value: { mode: 'funcion', f: 'sin(x)', a: '0', b: 'pi', n: 12 } },
      { label: 'Polinomio de Chapra en [0, 0.8]', value: { mode: 'funcion', f: '0.2 + 25x - 200x^2 + 675x^3 - 900x^4 + 400x^5', a: '0', b: '0.8', n: 12 } },
      { label: '∫₀¹ e^(x²) dx', value: { mode: 'funcion', f: 'exp(x^2)', a: '0', b: '1', n: 12 } },
      { label: '∫₀¹ 4/(1+x²) = π', value: { mode: 'funcion', f: '4/(1+x^2)', a: '0', b: '1', n: 12 } },
      { label: 'Boole exacta en x⁵', value: { mode: 'funcion', f: 'x^5', a: '0', b: '2', n: 4, rule: 'boole' } },
      { label: 'Datos: velocidad → distancia', value: { mode: 'datos', ...DATA_V, rule: 'simpson13' } },
      { label: 'Datos no equiespaciados (Chapra)', value: { mode: 'datos', rule: 'trapecio', ...DATA_CHAPRA } },
    ],
  },
}

const RULES: { value: A.NCRule; label: string }[] = [
  { value: 'trapecio', label: 'Trapecio — O(h²)' },
  { value: 'simpson13', label: 'Simpson 1/3 — O(h⁴), n par' },
  { value: 'simpson38', label: 'Simpson 3/8 — O(h⁴), n múltiplo de 3' },
  { value: 'boole', label: 'Boole — O(h⁶), n múltiplo de 4' },
]

export const Trapecio = () => <NewtonCotesPage variant="trapecio" />
export const Simpson = () => <NewtonCotesPage variant="simpson" />
export const NewtonCotes = () => <NewtonCotesPage variant="general" />

function NewtonCotesPage({ variant }: { variant: NCVariant }) {
  const cfg = CFG[variant]
  const [raw, setS] = useLocalState<S>(cfg.key, cfg.def)
  // la regla está fija en las páginas de trapecio y Simpson
  const s: S = { ...cfg.def, ...raw, ...(variant === 'general' ? {} : { rule: cfg.rules[0] }) }
  const set = (p: Partial<S>) => setS((v) => ({ ...cfg.def, ...v, ...p }))
  const d = useDebounced(s, 250)
  const c = useMemo(() => compute(d), [d])
  const def = A.NC[s.rule]
  const isSimpson = variant === 'simpson'

  const nField =
    variant === 'trapecio' ? (
      <IntField label="N (número de subintervalos)" value={s.n} onChange={(n) => set({ n })} min={1} max={2000} hint={s.n === 1 ? 'N = 1: fórmula simple (5.8)' : `Compuesta (5.11): H = (b − a)/${s.n}`} />
    ) : isSimpson ? (
      <IntField
        label="N (se usan 2N subintervalos)"
        value={Math.max(1, Math.floor(s.n / 2))}
        onChange={(N) => set({ n: 2 * N })}
        min={1}
        max={1000}
        hint={s.n === 2 ? 'N = 1: fórmula simple (5.18)' : `Compuesta (5.21): 2N = ${2 * Math.floor(s.n / 2)} subintervalos, H = (b − a)/${2 * Math.floor(s.n / 2)}`}
      />
    ) : (
      <IntField
        label="Subintervalos n"
        value={s.n}
        onChange={(n) => set({ n })}
        min={1}
        max={2000}
        hint={s.n === def.m ? 'n = ' + def.m + ': fórmula simple' : `Compuesta: ${s.n / def.m >= 1 && s.n % def.m === 0 ? s.n / def.m + ' bloques de ' + def.m : 'n debe ser múltiplo de ' + def.m}`}
      />
    )

  const inputs = (
    <>
      <SelectField
        label="Entrada"
        value={s.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'funcion', label: 'Función f(x) en [a, b]' },
          { value: 'datos', label: 'Datos tabulados (xᵢ, yᵢ)' },
        ]}
      />
      {s.mode === 'funcion' ? (
        <>
          <ExprField label="Integrando f(x)" value={s.f} onChange={(f) => set({ f })} texPrefix="f(x) =" />
          <FieldRow>
            <NumField label="a" value={s.a} onChange={(a) => set({ a })} />
            <NumField label="b" value={s.b} onChange={(b) => set({ b })} />
          </FieldRow>
        </>
      ) : (
        <>
          <label className="field">
            <span className="field-label">Valores xᵢ</span>
            <textarea className="input mono" rows={2} value={s.xs} spellCheck={false} onChange={(e) => set({ xs: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Valores yᵢ = f(xᵢ)</span>
            <textarea className="input mono" rows={2} value={s.ys} spellCheck={false} onChange={(e) => set({ ys: e.target.value })} />
            <span className="field-hint">
              Separados por espacios o comas. Admite expresiones (pi/4, sqrt(2)).{isSimpson && ' Simpson necesita un número impar de puntos equiespaciados.'}
            </span>
          </label>
        </>
      )}
      {variant === 'general' && <SelectField label="Regla" value={s.rule} onChange={(rule) => set({ rule })} options={RULES} />}
      {s.mode === 'funcion' && nField}
      <div className="field">
        <span className="field-preview">
          <Tex>{s.mode === 'funcion' && s.n === def.m ? def.simpleTex : def.compTex}</Tex>
        </span>
      </div>
      <Examples items={cfg.examples} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES[cfg.id]} topic={TOPIC} theory={THEORY[cfg.id]} inputs={inputs}>
      {'error' in c ? <Alert kind="error">{c.error}</Alert> : <Results s={d} c={c} variant={variant} />}
    </MethodPage>
  )
}

interface Calc {
  f: Compiled | null
  a: number
  b: number
  xs: number[]
  ys: number[]
  /** pesos finales wᵢ (incluyen factor y h) */
  w: number[]
  /** coeficientes enteros cᵢ (si la malla es uniforme) */
  coefs: number[] | null
  h: number
  n: number
  value: number
  ref: Reference | null
  M: { M: number; at: number } | null
  bound: number
  dTex: string | null
}

function compute(s: S): Calc | { error: string } {
  const def = A.NC[s.rule]
  if (s.mode === 'datos') {
    const xs = parseVector(s.xs)
    const ys = parseVector(s.ys)
    if (!xs) return { error: 'Lista de xᵢ inválida.' }
    if (!ys) return { error: 'Lista de yᵢ inválida.' }
    if (xs.length !== ys.length) return { error: `Hay ${xs.length} valores de x y ${ys.length} de y: deben tener la misma cantidad.` }
    if (xs.length < 2) return { error: 'Se necesitan al menos 2 puntos.' }
    if (xs.some((x, i) => i > 0 && x <= xs[i - 1])) return { error: 'Los xᵢ deben estar en orden estrictamente creciente.' }
    const n = xs.length - 1
    const uniform = A.isEquispaced(xs)
    if (!uniform) {
      if (s.rule !== 'trapecio') return { error: `Los datos no están equiespaciados: ${def.label} requiere h constante. Usa la regla del trapecio (admite h variable).` }
      const w = xs.map((_, i) => ((i < n ? xs[i + 1] - xs[i] : 0) + (i > 0 ? xs[i] - xs[i - 1] : 0)) / 2)
      return { f: null, a: xs[0], b: xs[n], xs, ys, w, coefs: null, h: NaN, n, value: A.trapecioNoUniforme(xs, ys), ref: null, M: null, bound: NaN, dTex: null }
    }
    const bad = A.ncValidN(n, s.rule)
    if (bad) return { error: bad + ` (hay ${n + 1} puntos ⇒ n = ${n} subintervalos).` }
    const r = A.newtonCotesData(xs, ys, s.rule)
    const fac = (def.num / def.den) * r.h
    return { f: null, a: xs[0], b: xs[n], xs, ys, w: r.coefs.map((c) => c * fac), coefs: r.coefs, h: r.h, n, value: r.value, ref: null, M: null, bound: NaN, dTex: null }
  }
  const f = compile(s.f)
  if (!f.ok) return { error: 'f(x): ' + f.error }
  const a = evalNumber(s.a)
  const b = evalNumber(s.b)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: 'Límites de integración inválidos.' }
  if (a === b) return { error: 'a y b deben ser distintos.' }
  const bad = A.ncValidN(s.n, s.rule)
  if (bad) return { error: bad }
  const r = A.newtonCotes(f.f, a, b, s.n, s.rule)
  const iBad = r.ys.findIndex((y) => !Number.isFinite(y))
  if (iBad >= 0)
    return {
      error: `f no está definida (o es infinita) en el nodo x${sub(iBad)} = ${fmt(r.xs[iBad])}: las fórmulas cerradas de Newton-Cotes evalúan los extremos. Si es una singularidad integrable, usa Gauss-Legendre (fórmula abierta).`,
    }
  const dk = compileDerivative(f, 'x', def.deriv)
  const lo = Math.min(a, b), hi = Math.max(a, b)
  const M = dk.ok ? A.maxAbs(dk.f, lo, hi) : null
  const bound = M ? def.C * Math.abs(b - a) * Math.abs(r.h) ** def.p * M.M : NaN
  const fac = (def.num / def.den) * r.h
  return { f, a, b, xs: r.xs, ys: r.ys, w: r.coefs.map((c) => c * fac), coefs: r.coefs, h: r.h, n: s.n, value: r.value, ref: referencia1D(s.f, f.f, a, b, s.a, s.b), M, bound, dTex: dk.ok ? dk.tex : null }
}

const SUBS = '₀₁₂₃₄₅₆₇₈₉'
const sub = (i: number) => String(i).replace(/\d/g, (d) => SUBS[+d])

/** Símbolo del paso: el texto usa h en las fórmulas simples y H en las compuestas de trapecio y Simpson. */
const stepSym = (def: A.NCDef, n: number) => (n === def.m ? 'h' : def.hSym)

/** Coeficiente de la mayoración en la forma del texto, p. ej. \frac{H^2}{12}(b-a). */
function boundCoefTex(def: A.NCDef, hs: string): string {
  const two = Math.abs(def.C - 2 / 945) < 1e-15
  return `\\frac{${two ? '2' : ''}${hs}^{${def.p}}}{${two ? 945 : Math.round(1 / def.C)}}(b-a)`
}

/** Etiqueta del número de subintervalos según la página. */
function nLabel(variant: NCVariant, n: number): string {
  if (variant === 'trapecio') return `N = ${n}`
  if (variant === 'simpson') return `N = ${n / 2} (2N = ${n} subintervalos)`
  return `n = ${n}`
}

function Results({ s, c, variant }: { s: S; c: Calc; variant: NCVariant }) {
  const def = A.NC[s.rule]
  const err = c.ref ? Math.abs(c.value - c.ref.value) : NaN
  const kName = def.deriv <= 3 ? "f" + "'".repeat(def.deriv) : `f^{(${def.deriv})}`
  const hs = stepSym(def, c.n)
  const rows = c.xs.map((x, i) => ({ i, x, y: c.ys[i], c: c.coefs ? c.coefs[i] : NaN, w: c.w[i], wy: c.w[i] * c.ys[i] }))
  const intTex = `\\int_{${s.mode === 'funcion' ? limTex(s.a) : N(c.a, 6)}}^{${s.mode === 'funcion' ? limTex(s.b) : N(c.b, 6)}} ${c.f ? c.f.tex : 'f(x)'}\\,dx`
  const EN = variant === 'simpson' ? 'E_{2N}' : variant === 'trapecio' ? 'E_N' : 'E'
  return (
    <>
      <Stats
        items={[
          { label: 'Integral aproximada', value: fmt(c.value, 14), accent: true, hint: `${def.label}${c.coefs ? '' : ' (h variable)'}, ${nLabel(variant, c.n)}` },
          ...(c.ref ? refStats(c.value, c.ref) : [{ label: `Paso ${hs}`, value: Number.isFinite(c.h) ? fmt(c.h) : 'variable' }, { label: 'Puntos', value: c.xs.length }]),
        ]}
      />
      {c.f && Number.isFinite(c.bound) && (
        <Alert kind={Number.isFinite(err) && err <= c.bound * 1.0001 + 1e-15 ? 'ok' : 'warn'}>
          Mayoración del error: <Tex>{`|${EN}| \\le ${boundCoefTex(def, hs)}\\max_{x\\in[a,b]}|${kName}(x)| = ${texNum(c.bound, 4)}`}</Tex>
          {c.M && (
            <>
              {' '}
              con <Tex>{`\\max_{[a,b]}|${kName}(x)| \\approx ${N(c.M.M, 6)}`}</Tex> (en x ≈ {fmt(c.M.at, 5)})
            </>
          )}
          {Number.isFinite(err) && (err <= c.bound * 1.0001 + 1e-15 ? ' ✓ el error real está dentro de la cota.' : ' — el error real supera la cota estimada (la derivada podría no ser acotada o el muestreo subestima M).')}
        </Alert>
      )}
      {!c.coefs && <Alert kind="info">Datos con espaciamiento variable: se aplica el trapecio en cada subintervalo, <Tex>{'\\sum \\tfrac{x_{i+1}-x_i}{2}(y_i + y_{i+1})'}</Tex>.</Alert>}
      <RefNote ref={c.ref} integral={intTex} />
      <Tabs
        tabs={[
          { label: 'Gráfica', content: <Card><NCPlot s={s} c={c} /></Card> },
          { label: 'Paso a paso', content: <Card><Steps steps={steps(s, c, variant)} /></Card> },
          { label: 'Otras reglas', content: <Card><OtherRules s={s} c={c} /></Card> },
          ...(c.f ? [{ label: 'Convergencia', content: <Card><ConvPlot s={s} c={c} /></Card> }] : []),
        ]}
      />
      <Card title="Nodos, valores y pesos">
        <DataTable
          filename="newton_cotes_nodos"
          columns={[
            { key: 'i', tex: 'k', fmt: 'int', align: 'center' },
            { key: 'x', tex: 'x_k' },
            { key: 'y', tex: 'f(x_k)' },
            ...(c.coefs ? [{ key: 'c', tex: 'c_k', fmt: 'int' as const, align: 'center' as const }] : []),
            { key: 'w', tex: c.coefs ? `w_k = ${def.factorTex.replace(/[hH]/, hs)}c_k` : 'w_k' },
            { key: 'wy', tex: 'w_k f(x_k)' },
          ]}
          rows={rows}
        />
      </Card>
      <ScilabCode code={scilab(s, c, variant)} filename={variant === 'general' ? 'newton_cotes_' + s.rule : variant} />
    </>
  )
}

function NCPlot({ s, c }: { s: S; c: Calc }) {
  const data = useMemo(() => {
    const def = A.NC[s.rule]
    const tr: Trace[] = []
    const m = c.coefs ? def.m : 1
    const panels = Math.min(c.n / m, 300)
    for (let p = 0; p < panels; p++) {
      const px = c.xs.slice(p * m, p * m + m + 1)
      const py = c.ys.slice(p * m, p * m + m + 1)
      const K = m === 1 ? 2 : 40
      const sx: number[] = [], sy: number[] = []
      for (let k = 0; k < K; k++) {
        const x = px[0] + ((px[m] - px[0]) * k) / (K - 1)
        sx.push(x)
        sy.push(A.lagrange(px, py, x))
      }
      tr.push({
        x: [px[0], ...sx, px[m], px[0]],
        y: [0, ...sy, 0, 0],
        type: 'scatter',
        mode: 'lines',
        fill: 'toself',
        fillcolor: p % 2 ? 'rgba(245,158,11,0.22)' : 'rgba(45,212,191,0.22)',
        line: { color: p % 2 ? SERIES[1] : SERIES[0], width: 1 },
        name: m === 1 ? 'trapecios' : m === 2 ? 'parábolas (paneles)' : m === 3 ? 'cúbicas (paneles)' : 'cuárticas (paneles)',
        legendgroup: 'panel',
        showlegend: p === 0,
        hoverinfo: 'skip',
      })
    }
    if (c.f) {
      const lo = Math.min(c.a, c.b), hi = Math.max(c.a, c.b)
      const pad = (hi - lo) * 0.08
      tr.push({ ...sample(c.f.f, lo - pad, hi + pad, 500), type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: SERIES[2], width: 2.5 } })
    }
    tr.push({ x: c.xs, y: c.ys, type: 'scatter', mode: 'markers', name: 'nodos (xᵢ, f(xᵢ))', marker: { color: SERIES[3], size: c.n > 60 ? 4 : 8 } })
    return tr
  }, [s, c])
  return <Plot data={data} layout={{ xaxis: { title: { text: 'x' } } }} />
}

function OtherRules({ s, c }: { s: S; c: Calc }) {
  const rows = (Object.keys(A.NC) as A.NCRule[]).map((r) => {
    const def = A.NC[r]
    let v = NaN
    let note = ''
    if (!c.coefs && r !== 'trapecio') note = 'requiere h constante'
    else if (c.n % def.m !== 0) note = `n no es múltiplo de ${def.m}`
    else v = c.coefs ? A.newtonCotesData(c.xs, c.ys, r).value : A.trapecioNoUniforme(c.xs, c.ys)
    return { r, name: def.label, v, err: c.ref && Number.isFinite(v) ? Math.abs(v - c.ref.value) : NaN, note }
  })
  return (
    <DataTable
      filename="comparacion_newton_cotes"
      columns={[
        { key: 'name', label: 'Regla', align: 'left' },
        { key: 'v', label: 'Aproximación', get: (r) => (Number.isFinite(r.v) ? fmt(r.v, 14) : '—') },
        ...(c.ref ? [{ key: 'err', label: 'Error', get: (r: any) => (Number.isFinite(r.err) ? fmtErr(r.err) : '—') }] : []),
        { key: 'note', label: 'Nota', align: 'left' },
      ]}
      rows={rows}
      highlight={(r) => r.r === s.rule}
    />
  )
}

function ConvPlot({ s, c }: { s: S; c: Calc }) {
  const data = useMemo(() => {
    if (!c.f || !c.ref || !Number.isFinite(c.ref.value)) return []
    const f = c.f
    const ref = c.ref.value
    return (Object.keys(A.NC) as A.NCRule[]).map((r, i) => {
      const m = A.NC[r].m
      const ns: number[] = []
      for (let k = 1; k <= 11; k++) {
        const n = m * 2 ** (k - 1)
        if (n <= 4096) ns.push(n)
      }
      const errs = ns.map((n) => Math.abs(A.newtonCotes(f.f, c.a, c.b, n, r).value - ref))
      return { x: ns, y: errs.map((e) => (e > 0 ? e : null)), type: 'scatter', mode: 'lines+markers', name: A.NC[r].label, line: { color: SERIES[i], width: r === s.rule ? 3 : 1.5 } } as Trace
    })
  }, [s, c])
  if (!data.length) return <p className="muted">Se necesita un valor de referencia para graficar la convergencia.</p>
  return (
    <>
      <Plot data={data} height={400} layout={{ xaxis: { type: 'log', title: { text: 'n (subintervalos)' } }, yaxis: { type: 'log', title: { text: 'error absoluto' }, exponentformat: 'power' } }} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        En log-log las rectas tienen pendiente −2 (trapecio), −4 (Simpson) y −6 (Boole): al duplicar n el error se divide por 4, 16 y 64 respectivamente, hasta tocar el piso del redondeo (~10⁻¹⁵).
      </p>
    </>
  )
}

function steps(s: S, c: Calc, variant: NCVariant) {
  const def = A.NC[s.rule]
  const out: { text?: string; tex?: string }[] = []
  const n = c.n
  const fname = c.f ? 'f' : 'y'
  if (!c.coefs) {
    out.push({ text: 'Trapecio con datos no equiespaciados (5.14): cada subintervalo aporta (xₖ₊₁ − xₖ)(yₖ + yₖ₊₁)/2.' })
    const terms = c.xs.slice(0, -1).map((x, i) => `\\tfrac{${N(c.xs[i + 1] - x, 6)}}{2}(${N(c.ys[i], 8)} + ${N(c.ys[i + 1], 8)})`)
    const shown = terms.length > 6 ? [...terms.slice(0, 3), '\\cdots', ...terms.slice(-2)] : terms
    out.push({ tex: `I \\approx ${shown.join(' + ')} = ${N(c.value, 12)}` })
    return out
  }
  const simple = n === def.m
  const hs = stepSym(def, n)
  const book = variant !== 'general' || s.rule === 'trapecio' || s.rule === 'simpson13'
  const nDen = !book ? `n` : s.rule === 'trapecio' ? (simple ? '1' : 'N') : simple ? '2' : '2N'
  const nNum = !book || s.rule === 'trapecio' || simple ? String(n) : `2\\cdot ${n / 2}`
  if (c.f) out.push({ text: 'Paso de integración:', tex: `${hs} = \\frac{b-a}{${nDen}} = \\frac{${N(c.b)} - ${P(c.a)}}{${nNum}} = ${N(c.h)}` })
  else out.push({ text: `Datos equiespaciados con ${n} subintervalos:`, tex: `${hs} = x_1 - x_0 = ${N(c.h)}` })
  const idx = n <= 12 ? c.xs.map((_, i) => i) : [0, 1, 2, 3, -1, n - 2, n - 1, n]
  out.push({
    text: c.f ? `Nodos x_k = a + k·${hs} y valores de la función:` : 'Tabla de valores:',
    tex: '\\begin{array}{c|' + 'c'.repeat(idx.length) + '} k & ' + idx.map((i) => (i < 0 ? '\\cdots' : i)).join(' & ') + ' \\\\ \\hline x_k & ' + idx.map((i) => (i < 0 ? '\\cdots' : N(c.xs[i], 6))).join(' & ') + ` \\\\ ${fname}(x_k) & ` + idx.map((i) => (i < 0 ? '\\cdots' : N(c.ys[i], 7))).join(' & ') + '\\end{array}',
  })
  const factor = def.factorTex.replace(/[hH]/, hs)
  const eqs = simple ? (s.rule === 'trapecio' ? ' (5.8)' : s.rule === 'simpson13' ? ' (5.18)' : '') : def.eq ? ` ${def.eq}` : ''
  out.push({
    text: simple ? `${def.label}, fórmula simple${eqs}:` : `${def.label} compuesta${eqs} (${n / def.m} bloque${n / def.m === 1 ? '' : 's'} de ${def.m} subintervalo${def.m === 1 ? '' : 's'}):`,
    tex: `I \\approx ${factor}\\Big[${texSymbolicSum(c.coefs, 9, fname + '(x_{%})')}\\Big]`,
  })
  // Agrupar por coeficiente, con la notación del texto para trapecio y Simpson
  const groupName = (co: number) => {
    if (co === 1) return `${fname}(a) + ${fname}(b)`
    if (s.rule === 'trapecio' && co === 2) return `\\textstyle\\sum_{k=1}^{N-1} ${fname}(x_k)`
    if (s.rule === 'simpson13' && co === 4) return `\\textstyle\\sum_{k=0}^{N-1} ${fname}(x_{2k+1})`
    if (s.rule === 'simpson13' && co === 2) return `\\textstyle\\sum_{k=0}^{N-2} ${fname}(x_{2k+2})`
    return `\\textstyle\\sum_{c_k=${co}} ${fname}(x_k)`
  }
  const groups = new Map<number, number[]>()
  c.coefs.forEach((co, i) => groups.set(co, [...(groups.get(co) ?? []), i]))
  const gs = [...groups.entries()].sort((p, q) => p[0] - q[0])
  const gsum = gs.map(([co, is]) => ({ co, is, sum: is.reduce((t, i) => t + c.ys[i], 0) }))
  const fac = def.num === 1 ? `\\frac{${N(c.h)}}{${def.den}}` : `\\frac{${def.num}(${N(c.h)})}{${def.den}}`
  if (gs.length > 1 && !simple) {
    out.push({
      text: 'Agrupamos los valores según su coeficiente:',
      tex: '\\begin{aligned}' + gsum.map((g) => `${groupName(g.co)} &= ${g.is.length <= 5 ? g.is.map((i) => P(c.ys[i], 8)).join(' + ') + ' = ' : ''}${N(g.sum, 12)} &&(${g.is.length}\\text{ nodos})`).join('\\\\') + '\\end{aligned}',
    })
    const S = gsum.reduce((t, g) => t + g.co * g.sum, 0)
    out.push({ text: 'Sustituimos:', tex: `I \\approx ${fac}\\Big[${gsum.map((g) => `${g.co === 1 ? '' : g.co}(${N(g.sum, 10)})`).join(' + ')}\\Big] = ${fac}\\,(${N(S, 12)}) = ${N(c.value, 14)}` })
  } else {
    const S = c.coefs.reduce((t, co, i) => t + co * c.ys[i], 0)
    out.push({ text: 'Sustituimos:', tex: `I \\approx ${fac}\\Big[${c.coefs.map((co, i) => `${co === 1 ? '' : co}(${N(c.ys[i], 10)})`).join(' + ')}\\Big] = ${fac}\\,(${N(S, 12)}) = ${N(c.value, 14)}` })
  }
  if (c.f && c.M && c.dTex) {
    const kName = def.deriv <= 3 ? "f" + "'".repeat(def.deriv) : `f^{(${def.deriv})}`
    const EN = simple ? (s.rule === 'trapecio' ? 'E_1' : s.rule === 'simpson13' ? 'E_2' : 'E') : s.rule === 'trapecio' ? 'E_N' : s.rule === 'simpson13' ? 'E_{2N}' : 'E'
    out.push({ text: 'Derivada que aparece en el término de error:', tex: `${kName}(x) = ${c.dTex.length < 220 ? c.dTex : '\\dots'}` })
    out.push({
      text: `Mayoración del error (M = máx|${kName.replace(/[{}^]/g, '')}| en [a, b], estimado muestreando 600 puntos):`,
      tex: `|${EN}| \\le ${boundCoefTex(def, hs)}\\,M = ${boundCoefTex(def, `(${N(Math.abs(c.h), 6)})`).replace('(b-a)', `(${N(Math.abs(c.b - c.a), 6)})`)}(${N(c.M.M, 6)}) = ${texNum(c.bound, 4)}`,
    })
  }
  if (c.ref && Number.isFinite(c.ref.value)) out.push({ text: 'Error exacto (comparación con el valor de referencia):', tex: `|I - I_{\\text{aprox}}| = |${N(c.ref.value, 14)} - ${P(c.value, 14)}| = ${texNum(Math.abs(c.ref.value - c.value), 4)}` })
  return out
}

function scilab(s: S, c: Calc, variant: NCVariant): string {
  const def = A.NC[s.rule]
  const head = `// ${def.label}${c.coefs ? (c.n === def.m ? ' (simple)' : ' compuesta') : ' (h variable)'} — generado por NumLab\nclear; clc;\n`
  const core = `m = ${def.m};                 // subintervalos por bloque
w = [${def.w.join(' ')}];   // pesos de un bloque
c = zeros(1, n + 1);
for p = 1:m:n
  c(p:p+m) = c(p:p+m) + w;
end
I = (${def.num}/${def.den})*h*sum(c .* y);
mprintf('%4s %14s %16s %6s\\n', 'k', 'x_k', 'f(x_k)', 'c_k');
for i = 1:n+1
  mprintf('%4d %14.8f %16.10f %6d\\n', i-1, x(i), y(i), c(i));
end
mprintf('\\nI aproximada = %.15f\\n', I);
`
  if (s.mode === 'datos') {
    const xs = c.xs.join(' ')
    const ys = c.ys.join(' ')
    if (!c.coefs) return `${head}x = [${xs}];\ny = [${ys}];\nI = 0;\nfor k = 1:length(x)-1      // formula (5.14)\n  I = I + (x(k+1) - x(k))*(y(k) + y(k+1))/2;\nend\nmprintf('I (trapecio, h variable) = %.15f\\n', I);\nmprintf('inttrap de Scilab       = %.15f\\n', inttrap(x, y));\n`
    return `${head}x = [${xs}];\ny = [${ys}];\nn = length(x) - 1;\nh = x(2) - x(1);\n${core}${s.rule === 'trapecio' ? "mprintf('inttrap de Scilab = %.15f\\n', inttrap(x, y));\n" : ''}`
  }
  const dk = c.f ? compileDerivative(c.f, 'x', def.deriv) : null
  const kName = def.deriv <= 3 ? 'f' + "'".repeat(def.deriv) : `f^(${def.deriv})`
  const kNameS = kName.replace(/'/g, "''") // comilla simple escapada dentro de cadenas de Scilab
  const fdef = `function y = f(x)
  y = ${toScilab(s.f, true)};
endfunction
function y = dk(x)   // ${kName}, para la mayoracion
  y = ${dk && dk.ok ? toScilab(dk.node, true) : '0*x  // escribe aqui la derivada'};
endfunction

a = ${sci(s.a)}; b = ${sci(s.b)};
xx = linspace(a, b, 601);
M = max(abs(dk(xx)));
`
  const tail = `Iref = intg(a, b, f);   // referencia: integral adaptativa de Scilab
mprintf('intg (referencia) = %.15f\\n', Iref);
mprintf('Error exacto      = %.3e\\n', abs(Iref - I));
`
  if (variant !== 'general' && s.rule === 'trapecio')
    return `${head}${fdef}N = ${c.n};
H = (b - a)/N;
x = a + (0:N)*H;                                   // x_k = a + k*H
I = H/2*(f(a) + 2*sum(f(x(2:N))) + f(b));          // formula (5.11)
E = H^2/12*(b - a)*M;                              // mayoracion (5.13)
mprintf('N = %d, H = %.8f\\n', N, H);
mprintf('I aproximada   = %.15f\\n', I);
mprintf('|E_N| <= %.3e  (max|${kNameS}| = %.6f)\\n', E, M);
${tail}`
  if (variant !== 'general' && s.rule === 'simpson13')
    return `${head}${fdef}N = ${c.n / 2};                                   // se usan 2N subintervalos
H = (b - a)/(2*N);
x = a + (0:2*N)*H;                                 // x_k = a + k*H
imp = sum(f(x(2:2:2*N)));                          // f(x_1) + f(x_3) + ... + f(x_{2N-1})
par = sum(f(x(3:2:2*N-1)));                        // f(x_2) + ... + f(x_{2N-2})
I = H/3*(f(a) + 4*imp + 2*par + f(b));             // formula (5.21)
E = H^4/180*(b - a)*M;                             // mayoracion (5.23)
mprintf('N = %d, H = %.8f\\n', N, H);
mprintf('I aproximada   = %.15f\\n', I);
mprintf('|E_2N| <= %.3e  (max|${kNameS}| = %.6f)\\n', E, M);
${tail}`
  return `${head}${fdef}n = ${s.n};
h = (b - a)/n;
x = linspace(a, b, n + 1);
y = f(x);
${core}mprintf('|E| <= %.3e  (max|${kNameS}| = %.6f)\\n', ${def.Csci}*abs(b-a)*abs(h)^${def.p}*M, M);
${tail}`
}
