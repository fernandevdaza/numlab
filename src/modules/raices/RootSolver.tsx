import { useMemo } from 'react'
import { compile, compileDerivative, evalNumber, toScilab, type Compiled } from '../../lib/expr'
import { fmt, fmtErr, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, sampleRange, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import {
  Alert, Card, CheckField, DataTable, Examples, ExprField, FieldRow, IntField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs, type Column,
} from '../../components/ui'
import * as A from './algorithms'
import { DESCRIPTIONS, THEORY, TITLES, TOPIC } from './theory'
import { L } from '../../i18n'

export type RootKind = 'biseccion' | 'posicion-falsa' | 'punto-fijo' | 'aitken' | 'steffensen' | 'newton' | 'secante' | 'newton-mod'

const usesG = (k: RootKind) => k === 'punto-fijo' || k === 'aitken' || k === 'steffensen'
/** Métodos cerrados: trabajan con un intervalo [a, b] con cambio de signo. */
const usesInterval = (k: RootKind) => k === 'biseccion' || k === 'posicion-falsa'

interface State {
  f: string
  g: string
  df: string
  a: string
  b: string
  x0: string
  x1: string
  tol: string
  maxIter: number
  crit: A.Criterion
  variant: 'm' | 'mu'
  m: number
  /** posición falsa modificada (mitad de f en el extremo que queda fijo) */
  mod: boolean
  xmin: string
  xmax: string
}

// Por defecto se cargan los ejemplos del texto de la materia (Cap. 2): f(x) = x³ + 4x² − 10, raíz α = 1.3652300134141…
const TXT = 'x^3 + 4x^2 - 10'
const DEFAULTS: Record<RootKind, Partial<State>> = {
  biseccion: { f: TXT, a: '1', b: '1.5', tol: '0.01' },
  'posicion-falsa': { f: TXT, a: '1', b: '1.5', tol: '1e-5', mod: false },
  'punto-fijo': { g: 'sqrt(10/(4 + x))', x0: '1.5' },
  aitken: { g: '0.5*sqrt(10 - x^3)', x0: '1.5' },
  steffensen: { g: '0.5*sqrt(10 - x^3)', x0: '1.5' },
  newton: { f: TXT, x0: '1.5' },
  secante: { f: TXT, x0: '1.5', x1: '1.4' },
  'newton-mod': { f: 'x^3 - 6.4x^2 + 11.04x - 5.76', x0: '1', m: 2, variant: 'm', tol: '1e-5', crit: 'abs' },
}

/** Un ejemplo fija también EPS, el criterio y el número de iteraciones (para que no arrastre los del anterior). */
const ex = (label: string, value: Partial<State>) => ({ label, value: { tol: '1e-8', maxIter: 50, crit: 'o' as A.Criterion, ...value } })
const G3 = '0.5*sqrt(10 - x^3)'
const ESFERA = 'x^3 - 0.3x^2 + 0.002552'

// «Ej. X.Y» reproduce los números del texto; «Práctica N» los de la práctica del capítulo (respuestas del texto).
const EXAMPLES: Record<RootKind, { label: string; value: Partial<State> }[]> = {
  biseccion: [
    ex(L('Ej. 2.2 · x³ + 4x² − 10 en [1, 1.5], EPS = 0.01', 'Ex. 2.2 · x³ + 4x² − 10 on [1, 1.5], EPS = 0.01'), { f: TXT, a: '1', b: '1.5', tol: '0.01' }),
    ex(L('Ej. 2.3 · escalera en el pasillo, [0.48, 0.52], EPS = 10⁻³', 'Ex. 2.3 · ladder around a corridor corner, [0.48, 0.52], EPS = 10⁻³'), { f: '-4cos(x)/sin(x)^2 + 5cos(pi/3 - x)/sin(pi/3 - x)^2', a: '0.48', b: '0.52', tol: '1e-3' }),
    ex(L('Esfera flotante (datos del Ej. 2.5) en [0, 0.2]', 'Floating sphere (data from Ex. 2.5) on [0, 0.2]'), { f: ESFERA, a: '0', b: '0.2', tol: '1e-6' }),
    ex(L('x³ − x − 2 en [1, 2]', 'x³ − x − 2 on [1, 2]'), { f: 'x^3 - x - 2', a: '1', b: '2' }),
    ex(L('cos x = x en [0, 1]', 'cos x = x on [0, 1]'), { f: 'cos(x) - x', a: '0', b: '1' }),
    ex(L('√2 en [1, 2]', '√2 on [1, 2]'), { f: 'x^2 - 2', a: '1', b: '2' }),
  ],
  'punto-fijo': [
    ex(L('Ej. 2.4 · g₁ = 10/(x² + 4x) (no converge)', 'Ex. 2.4 · g₁ = 10/(x² + 4x) (does not converge)'), { g: '10/(x^2 + 4x)', x0: '1.5', maxIter: 5 }),
    ex(L('Ej. 2.4 · g₂ = √(10/(4 + x)) (converge)', 'Ex. 2.4 · g₂ = √(10/(4 + x)) (converges)'), { g: 'sqrt(10/(4 + x))', x0: '1.5', maxIter: 5 }),
    ex(L('Ej. 2.4 · g₃ = ½√(10 − x³) (converge)', 'Ex. 2.4 · g₃ = ½√(10 − x³) (converges)'), { g: G3, x0: '1.5', maxIter: 5 }),
    ex(L('Ej. 2.4 · g₄ = (10 − 4x²)^(1/3) (número complejo)', 'Ex. 2.4 · g₄ = (10 − 4x²)^(1/3) (complex number)'), { g: '(10 - 4x^2)^(1/3)', x0: '1.5', maxIter: 5 }),
    ex(L('Ej. 2.5 · esfera: g₁ = 0.002552/(0.3h − h²)', 'Ex. 2.5 · sphere: g₁ = 0.002552/(0.3h − h²)'), { g: '0.002552/(0.3x - x^2)', x0: '0.1', maxIter: 5 }),
    ex(L('Ej. 2.5 · esfera: g₂ = √(0.002552/(0.3 − h))', 'Ex. 2.5 · sphere: g₂ = √(0.002552/(0.3 − h))'), { g: 'sqrt(0.002552/(0.3 - x))', x0: '0.1', maxIter: 5 }),
    ex(L('Ej. 2.5 · esfera: g₃ = (0.3h² − 0.002552)^(1/3)', 'Ex. 2.5 · sphere: g₃ = (0.3h² − 0.002552)^(1/3)'), { g: '(-0.002552 + 0.3x^2)^(1/3)', x0: '0.1', maxIter: 5 }),
    ex(L('Práctica 2.1 · x eˣ − 2: g = 2e^(−x)', 'Practice 2.1 · x eˣ − 2: g = 2e^(−x)'), { g: '2exp(-x)', x0: '0.84', maxIter: 4 }),
    ex('g = cos x', { g: 'cos(x)', x0: '0.5' }),
    ex(L('g = x² − 2 (diverge)', 'g = x² − 2 (diverges)'), { g: 'x^2 - 2', x0: '1.5' }),
  ],
  aitken: [
    ex(L('Ej. 2.5 (Aitken) · g₃ = ½√(10 − x³), x₀ = 1.5', 'Ex. 2.5 (Aitken) · g₃ = ½√(10 − x³), x₀ = 1.5'), { g: G3, x0: '1.5', tol: '1e-12', maxIter: 5 }),
    ex(L('Práctica 3.1 · g = 2e^(−x), x₀ = 0.84 (3 iteraciones)', 'Practice 3.1 · g = 2e^(−x), x₀ = 0.84 (3 iterations)'), { g: '2exp(-x)', x0: '0.84', tol: '1e-12', maxIter: 3 }),
    ex(L('Práctica 3.2 · g = ln x + 2, x₀ = 3.1 (3 iteraciones)', 'Practice 3.2 · g = ln x + 2, x₀ = 3.1 (3 iterations)'), { g: 'ln(x) + 2', x0: '3.1', tol: '1e-12', maxIter: 3 }),
    ex('g = cos x', { g: 'cos(x)', x0: '0.5' }),
  ],
  steffensen: [
    ex(L('Texto 2.3.5 · g₃ = ½√(10 − x³), x₀ = 1.5', 'Textbook §2.3.5 · g₃ = ½√(10 − x³), x₀ = 1.5'), { g: G3, x0: '1.5', tol: '1e-12', maxIter: 3 }),
    ex(L('Práctica 3.1 · g = 2e^(−x), x₀ = 0.84 (3 iteraciones)', 'Practice 3.1 · g = 2e^(−x), x₀ = 0.84 (3 iterations)'), { g: '2exp(-x)', x0: '0.84', tol: '1e-14', maxIter: 3 }),
    ex('g = cos x', { g: 'cos(x)', x0: '0.5' }),
    ex(L('g = x² − 2 (¡converge!)', 'g = x² − 2 (it converges!)'), { g: 'x^2 - 2', x0: '2.5' }),
  ],
  newton: [
    ex(L('Ej. 2.6 · x³ + 4x² − 10, x₀ = 1.5', 'Ex. 2.6 · x³ + 4x² − 10, x₀ = 1.5'), { f: TXT, x0: '1.5', tol: '1e-12' }),
    ex(L('Práctica 4.1 · eˣ − tan x, x₀ = 1.2 (4 iteraciones)', 'Practice 4.1 · eˣ − tan x, x₀ = 1.2 (4 iterations)'), { f: 'exp(x) - tan(x)', x0: '1.2', tol: '1e-14', maxIter: 4 }),
    ex(L('Práctica 6 · bacterias: 70e^(−1.5t) + 25e^(−0.075t) = 9, t₀ = 14', 'Practice 6 · bacteria: 70e^(−1.5t) + 25e^(−0.075t) = 9, t₀ = 14'), { f: '70exp(-1.5x) + 25exp(-0.075x) - 9', x0: '14' }),
    ex('√2', { f: 'x^2 - 2', x0: '1' }),
    ex(L('x³ − 2x + 2 (ciclo)', 'x³ − 2x + 2 (cycle)'), { f: 'x^3 - 2x + 2', x0: '0' }),
    ex(L('atan x (diverge)', 'atan x (diverges)'), { f: 'atan(x)', x0: '1.5' }),
  ],
  secante: [
    ex(L('Ej. 2.7 · x³ + 4x² − 10, x₀ = 1.5, x₁ = 1.4', 'Ex. 2.7 · x³ + 4x² − 10, x₀ = 1.5, x₁ = 1.4'), { f: TXT, x0: '1.5', x1: '1.4', tol: '1e-4' }),
    ex('x³ − x − 2', { f: 'x^3 - x - 2', x0: '1', x1: '2' }),
    ex('eˣ − 3x', { f: 'exp(x) - 3x', x0: '0', x1: '1' }),
    ex('cos x − x', { f: 'cos(x) - x', x0: '0', x1: '1' }),
  ],
  'posicion-falsa': [
    ex(L('Ej. 2.8 · x³ + 4x² − 10 en [1, 1.5]', 'Ex. 2.8 · x³ + 4x² − 10 on [1, 1.5]'), { f: TXT, a: '1', b: '1.5', tol: '1e-5', mod: false }),
    ex(L('Ej. 2.8 · versión modificada (mitad de f)', 'Ex. 2.8 · modified version (half of f)'), { f: TXT, a: '1', b: '1.5', tol: '1e-5', mod: true }),
    ex(L('Práctica 4.1 · eˣ − tan x en [1.2, 1.4] (4 iteraciones)', 'Practice 4.1 · eˣ − tan x on [1.2, 1.4] (4 iterations)'), { f: 'exp(x) - tan(x)', a: '1.2', b: '1.4', tol: '1e-14', maxIter: 4, mod: false }),
    ex(L('Práctica 4.2 · eˣ + 2^(−x) + 2cos x − 6 en [1.7, 2] (4 iteraciones)', 'Practice 4.2 · eˣ + 2^(−x) + 2cos x − 6 on [1.7, 2] (4 iterations)'), { f: 'exp(x) + 2^(-x) + 2cos(x) - 6', a: '1.7', b: '2', tol: '1e-14', maxIter: 4, mod: false }),
    ex(L('x¹⁰ − 1 en [0, 1.3] (lenta sin la modificación)', 'x¹⁰ − 1 on [0, 1.3] (slow without the modification)'), { f: 'x^10 - 1', a: '0', b: '1.3', mod: false }),
  ],
  'newton-mod': [
    ex(L('Ej. 2.9 · x³ − 6.4x² + 11.04x − 5.76, x₀ = 1, m = 2', 'Ex. 2.9 · x³ − 6.4x² + 11.04x − 5.76, x₀ = 1, m = 2'), { f: 'x^3 - 6.4x^2 + 11.04x - 5.76', x0: '1', m: 2, variant: 'm', tol: '1e-5', crit: 'abs' }),
    ex(L('Ej. 2.9 · método alternativo u = f/f′', 'Ex. 2.9 · alternative method u = f/f′'), { f: 'x^3 - 6.4x^2 + 11.04x - 5.76', x0: '1', variant: 'mu', tol: '1e-5', crit: 'abs' }),
    ex(L('Práctica 5 · x⁴ − 4.8x³ + 8.64x² − 6.912x + 2.0736 (m = 4)', 'Practice 5 · x⁴ − 4.8x³ + 8.64x² − 6.912x + 2.0736 (m = 4)'), { f: 'x^4 - 4.8x^3 + 8.64x^2 - 6.912x + 2.0736', x0: '1', m: 4, variant: 'm' }),
    ex(L('Práctica 7 · x⁴ − 3.2x³ + 0.96x² + 4.608x − 3.456, x₀ = 1.3, m = 2 (4 iteraciones)', 'Practice 7 · x⁴ − 3.2x³ + 0.96x² + 4.608x − 3.456, x₀ = 1.3, m = 2 (4 iterations)'), { f: 'x^4 - 3.2x^3 + 0.96x^2 + 4.608x - 3.456', x0: '1.3', m: 2, variant: 'm', tol: '1e-14', maxIter: 4, crit: 'abs' }),
    ex('(x − 1)³(x + 2), m = 3', { f: '(x - 1)^3 * (x + 2)', x0: '2', m: 3, variant: 'm' }),
    ex('eˣ − x − 1, m = 2', { f: 'exp(x) - x - 1', x0: '1', m: 2, variant: 'm' }),
  ],
}

/** Textos del criterio de parada según el método. */
const X: Record<RootKind, string> = { biseccion: 'x_M', 'posicion-falsa': 'αₛ', 'punto-fijo': 'xₙ₊₁', aitken: 'yₙ', steffensen: 'yₙ', newton: 'xₙ₊₁', secante: 'xₙ₊₁', 'newton-mod': 'xₙ₊₁' }
const DX: Record<RootKind, string> = {
  biseccion: '|x_D − x_I|',
  'posicion-falsa': '|αₛ⁽ⁿ⁾ − αₛ⁽ⁿ⁻¹⁾|',
  'punto-fijo': '|xₙ₊₁ − xₙ|',
  aitken: '|yₙ − yₙ₋₁|',
  steffensen: '|yₙ − xₙ|',
  newton: '|xₙ₊₁ − xₙ|',
  secante: '|xₙ₊₁ − xₙ|',
  'newton-mod': '|xₙ₊₁ − xₙ|',
}
const RES: Record<RootKind, string> = {
  biseccion: '|f(x_M)|',
  'posicion-falsa': '|f(αₛ)|',
  'punto-fijo': '|xₙ₊₁ − g(xₙ₊₁)|',
  aitken: '|yₙ − g(yₙ)|',
  steffensen: '|yₙ − g(yₙ)|',
  newton: '|f(xₙ₊₁)|',
  secante: '|f(xₙ₊₁)|',
  'newton-mod': '|f(xₙ₊₁)|',
}

export function RootSolver({ kind }: { kind: RootKind }) {
  const [s, setS] = useLocalState<State>('raices:' + kind, {
    f: 'x^3 - x - 2', g: 'cos(x)', df: '', a: '1', b: '2', x0: '1', x1: '2', tol: '1e-8', maxIter: 50, crit: 'o', variant: 'm', m: 2, mod: false, xmin: '', xmax: '',
    ...DEFAULTS[kind],
  })
  const set = (p: Partial<State>) => setS((prev) => ({ ...prev, ...p }))
  const d = useDebounced(s, 200)

  const calc = useMemo(() => compute(kind, d), [kind, d])

  const inputs = (
    <>
      {usesG(kind) ? (
        <ExprField label={L('Función de iteración g(x)', 'Iteration function g(x)')} value={s.g} onChange={(g) => set({ g })} texPrefix="g(x) =" hint={L('Se busca el punto fijo x = g(x)', 'We look for the fixed point x = g(x)')} />
      ) : (
        <ExprField label={L('Función f(x)', 'Function f(x)')} value={s.f} onChange={(f) => set({ f })} texPrefix="f(x) =" hint={L('Se busca f(x) = 0. Usa ^, sqrt, exp, ln, sin…', 'We solve f(x) = 0. Use ^, sqrt, exp, ln, sin…')} />
      )}
      {(kind === 'newton' || kind === 'newton-mod') && calc.dTex && (
        <div className="field">
          <span className="field-label">{L('Derivadas (simbólicas)', 'Derivatives (symbolic)')}</span>
          <span className="field-preview">
            <Tex>{"f'(x) = " + calc.dTex}</Tex>
          </span>
          {kind === 'newton-mod' && calc.d2Tex && (
            <span className="field-preview">
              <Tex>{"f''(x) = " + calc.d2Tex}</Tex>
            </span>
          )}
        </div>
      )}
      {usesInterval(kind) ? (
        <FieldRow>
          <NumField label={<><Tex>x_I</Tex> {L('(izquierda)', '(left)')}</>} value={s.a} onChange={(a) => set({ a })} />
          <NumField label={<><Tex>x_D</Tex> {L('(derecha)', '(right)')}</>} value={s.b} onChange={(b) => set({ b })} />
        </FieldRow>
      ) : kind === 'secante' ? (
        <FieldRow>
          <NumField label={<Tex>x_0</Tex>} value={s.x0} onChange={(x0) => set({ x0 })} />
          <NumField label={<Tex>x_1</Tex>} value={s.x1} onChange={(x1) => set({ x1 })} />
        </FieldRow>
      ) : (
        <NumField label={<>{L('Valor inicial', 'Initial value')} <Tex>x_0</Tex></>} value={s.x0} onChange={(x0) => set({ x0 })} />
      )}
      {kind === 'newton-mod' && (
        <>
          <SelectField
            label={L('Variante', 'Variant')}
            value={s.variant}
            onChange={(variant) => set({ variant })}
            options={[
              { value: 'm', label: L('Newton modificado (texto): x − m·f/f′', 'Modified Newton (textbook): x − m·f/f′') },
              { value: 'mu', label: L('Método alternativo: Newton sobre u = f/f′ (sin conocer m)', 'Alternative method: Newton on u = f/f′ (m not needed)') },
            ]}
          />
          {s.variant === 'm' && <IntField label={L('Multiplicidad m', 'Multiplicity m')} value={s.m} onChange={(m) => set({ m })} min={1} max={20} hint={L('Si no la conoces, estímala con la tabla «Estimación de m» (4 iteraciones de Newton).', 'If you do not know it, estimate it with the “Estimate of m” table (4 Newton iterations).')} />}
        </>
      )}
      {kind === 'posicion-falsa' && (
        <CheckField label={L('Versión modificada del texto: si un extremo no cambia en 2 iteraciones seguidas, usar la mitad de su f', 'Textbook modified version: if an endpoint does not change in 2 consecutive iterations, use half of its f value')} value={s.mod} onChange={(mod) => set({ mod })} />
      )}
      <FieldRow>
        <NumField label={L('Tolerancia EPS', 'Tolerance EPS')} value={s.tol} onChange={(tol) => set({ tol })} />
        <IntField label={L('Máx. iteraciones', 'Max. iterations')} value={s.maxIter} onChange={(maxIter) => set({ maxIter })} min={1} max={1000} />
      </FieldRow>
      <SelectField
        label={L('Criterio de parada', 'Stopping criterion')}
        value={s.crit}
        onChange={(crit) => set({ crit })}
        options={[
          { value: 'o', label: L(`Texto (2.3): ${RES[kind]} ≤ EPS o ${DX[kind]} ≤ EPS`, `Textbook (2.3): ${RES[kind]} ≤ EPS or ${DX[kind]} ≤ EPS`) },
          { value: 'abs', label: L(`Sólo error absoluto: ${DX[kind]} ≤ EPS`, `Absolute error only: ${DX[kind]} ≤ EPS`) },
          { value: 'rel', label: L(`Sólo error relativo: ${DX[kind]}/|${X[kind]}| ≤ EPS`, `Relative error only: ${DX[kind]}/|${X[kind]}| ≤ EPS`) },
          { value: 'f', label: L(`Sólo residuo: ${RES[kind]} ≤ EPS`, `Residual only: ${RES[kind]} ≤ EPS`) },
        ]}
      />
      <FieldRow>
        <NumField label={L('Gráfica: x mín', 'Plot: x min')} value={s.xmin} onChange={(xmin) => set({ xmin })} placeholder="auto" />
        <NumField label={L('x máx', 'x max')} value={s.xmax} onChange={(xmax) => set({ xmax })} placeholder="auto" />
      </FieldRow>
      <Examples items={EXAMPLES[kind]} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES[kind]} topic={TOPIC} description={DESCRIPTIONS[kind]} theory={THEORY[kind]} inputs={inputs}>
      {calc.error ? (
        <Alert kind="error">{calc.error}</Alert>
      ) : (
        calc.res && <Results kind={kind} s={d} c={calc as Required<Calc>} />
      )}
    </MethodPage>
  )
}

interface Calc {
  error?: string
  res?: A.RootResult
  f?: Compiled
  g?: Compiled
  df?: Compiled
  d2f?: Compiled
  dTex?: string
  d2Tex?: string
}

function compute(kind: RootKind, s: State): Calc {
  const opts: A.Opts = { tol: evalNumber(s.tol), maxIter: s.maxIter, criterion: s.crit }
  if (!(opts.tol > 0)) return { error: L('La tolerancia debe ser un número positivo.', 'The tolerance must be a positive number.') }
  if (usesG(kind)) {
    const g = compile(s.g)
    if (!g.ok) return { error: 'g(x): ' + g.error }
    const x0 = evalNumber(s.x0)
    if (!Number.isFinite(x0)) return { error: L('x₀ inválido', 'Invalid x₀') }
    const dg = compileDerivative(g)
    const res = kind === 'punto-fijo' ? A.puntoFijo(g.f, x0, opts) : kind === 'aitken' ? A.aitken(g.f, x0, opts) : A.steffensen(g.f, x0, opts)
    return { res, g, df: dg.ok ? dg : undefined, dTex: dg.ok ? dg.tex : undefined }
  }
  const f = compile(s.f)
  if (!f.ok) return { error: 'f(x): ' + f.error }
  const df = compileDerivative(f)
  const d2f = df.ok ? compileDerivative(df) : df
  const base = { f, df: df.ok ? df : undefined, d2f: d2f.ok ? d2f : undefined, dTex: df.ok ? df.tex : undefined, d2Tex: d2f.ok ? d2f.tex : undefined }
  const x0 = evalNumber(s.x0)
  switch (kind) {
    case 'biseccion':
    case 'posicion-falsa': {
      const a = evalNumber(s.a), b = evalNumber(s.b)
      if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: L('Intervalo inválido', 'Invalid interval') }
      if (a === b) return { error: L('a y b deben ser distintos', 'a and b must be different') }
      return { ...base, res: kind === 'biseccion' ? A.biseccion(f.f, a, b, opts) : A.posicionFalsa(f.f, a, b, opts, s.mod) }
    }
    case 'newton':
      if (!df.ok) return { error: df.error }
      if (!Number.isFinite(x0)) return { error: L('x₀ inválido', 'Invalid x₀') }
      return { ...base, res: A.newton(f.f, df.f, x0, opts) }
    case 'secante': {
      const x1 = evalNumber(s.x1)
      if (!Number.isFinite(x0) || !Number.isFinite(x1)) return { error: L('Valores iniciales inválidos', 'Invalid initial values') }
      return { ...base, res: A.secante(f.f, x0, x1, opts) }
    }
    case 'newton-mod':
      if (!df.ok || !d2f.ok) return { error: L('No se pudo derivar f', 'Could not differentiate f') }
      if (!Number.isFinite(x0)) return { error: L('x₀ inválido', 'Invalid x₀') }
      return { ...base, res: A.newtonModificado(f.f, df.f, d2f.f, x0, opts, s.variant, s.m) }
  }
  return { error: L('Método desconocido', 'Unknown method') }
}

/* ───────────────────────── Resultados ───────────────────────── */

function Results({ kind, s, c }: { kind: RootKind; s: State; c: Required<Calc> }) {
  const { res } = c
  const fn = usesG(kind) ? (x: number) => c.g.f(x) - x : c.f.f
  const residual = Number.isFinite(res.root) ? fn(res.root) : NaN
  const order = A.ordenFinal(res.iterates)
  const ordEst = A.ordenEstimado(res.iterates)
  const rows = res.rows.map((r, i) => ({ ...r, p: ordEst[i] ?? NaN }))

  const extra: string[] = []
  if (usesG(kind) && c.df && Number.isFinite(res.root)) {
    const dg = Math.abs(c.df.f(res.root))
    extra.push(`|g'(x^*)| \\approx ${texNum(dg, 4)}`)
  }

  return (
    <>
      <Stats
        items={[
          { label: kind === 'punto-fijo' || kind === 'aitken' || kind === 'steffensen' ? L('Punto fijo x*', 'Fixed point x*') : L('Raíz x*', 'Root x*'), value: fmt(res.root, 15), accent: true },
          { label: L('Iteraciones', 'Iterations'), value: res.rows.length, hint: res.converged ? L('convergió', 'converged') : L('no convergió', 'did not converge') },
          { label: usesG(kind) ? L('Residuo g(x*) − x*', 'Residual g(x*) − x*') : L('Residuo f(x*)', 'Residual f(x*)'), value: fmtErr(residual) },
          { label: L('Orden estimado p', 'Estimated order p'), value: order !== null ? order.toFixed(3) : '—', hint: ORDER_HINT[kind] },
        ]}
      />
      <Alert kind={res.converged ? 'ok' : 'warn'}>
        {res.message}
        {kind === 'biseccion' && res.rows.length > 0 && (
          <>
            {' '}· {L('Cota a priori: se necesitan', 'A priori bound:')} <b>n ≥ {A.biseccionIterMin(evalNumber(s.a), evalNumber(s.b), evalNumber(s.tol))}</b> {L('iteraciones para error < tol.', 'iterations are needed for error < tol.')}
          </>
        )}
        {extra.length > 0 && (
          <>
            {' '}· <Tex>{extra.join(',\\;')}</Tex>
            {c.df && Math.abs(c.df.f(res.root)) >= 1 && kind === 'punto-fijo' && L(' ⇒ no se cumple la condición de contracción', ' ⇒ the contraction condition does not hold')}
          </>
        )}
      </Alert>
      <Tabs
        tabs={[
          { label: L('Gráfica', 'Plot'), content: <Card><MainPlot kind={kind} s={s} c={c} /></Card> },
          { label: L('Convergencia', 'Convergence'), content: <Card><ConvPlot res={res} /></Card> },
          { label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={stepsFor(kind, s, c)} /></Card> },
        ]}
      />
      {kind === 'newton-mod' && <MultiplicidadCard s={s} c={c} />}
      <Card title={L('Tabla de iteraciones', 'Iteration table')}>
        <DataTable columns={columnsFor(kind, s)} rows={rows} highlightLast={res.converged} filename={kind} />
      </Card>
      <ScilabCode code={scilabFor(kind, s)} filename={kind.replace('-', '_')} />
    </>
  )
}

/** Estimación de m con 4 iteraciones de Newton-Raphson (relación 2.23 del texto). */
function MultiplicidadCard({ s, c }: { s: State; c: Required<Calc> }) {
  const x0 = evalNumber(s.x0)
  const nw = A.newton(c.f.f, c.df.f, x0, { tol: 0, maxIter: 4, criterion: 'abs' })
  const xs = nw.iterates.slice(0, 5)
  const ms = A.estimarMultiplicidad(xs)
  const rows = xs.map((x, n) => ({ n, x, m: n >= 2 ? ms[n - 2] : NaN }))
  const last = ms.filter(Number.isFinite).pop()
  return (
    <Card title={L('Estimación de la multiplicidad m (4 iteraciones de Newton)', 'Estimate of the multiplicity m (4 Newton iterations)')}>
      <DataTable
        columns={[
          { key: 'n', tex: 'n', fmt: 'int', align: 'center' },
          { key: 'x', tex: String.raw`x_n \;(\text{Newton})` },
          { key: 'm', tex: String.raw`m \approx \left[1 - \frac{x_n - x_{n-1}}{x_{n-1} - x_{n-2}}\right]^{-1}`, get: (r: any) => (Number.isFinite(r.m) ? fmt(r.m, 6) : '—') },
        ]}
        rows={rows}
        filename="estimacion_m"
      />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        {L(<>
        Como <Tex>{String.raw`g'(\alpha) = 1 - 1/m`}</Tex> para la función de iteración de Newton y <Tex>{String.raw`g'(\alpha) \approx (x_{n+1}-x_n)/(x_n - x_{n-1})`}</Tex> (2.23), los cocientes de pasos sucesivos
        estiman <Tex>m</Tex>; como <Tex>m</Tex> es entero se redondea{last !== undefined && Number.isFinite(last) ? <> (aquí <b>m ≈ {Math.max(1, Math.round(last))}</b>{Math.round(last) !== s.m && s.variant === 'm' ? ', distinto del m que ingresaste' : ''})</> : null}. Si m ≈ 1 la raíz es simple.
        </>, <>
        Since <Tex>{String.raw`g'(\alpha) = 1 - 1/m`}</Tex> for Newton's iteration function and <Tex>{String.raw`g'(\alpha) \approx (x_{n+1}-x_n)/(x_n - x_{n-1})`}</Tex> (2.23), the ratios of successive steps
        estimate <Tex>m</Tex>; since <Tex>m</Tex> is an integer, it is rounded{last !== undefined && Number.isFinite(last) ? <> (here <b>m ≈ {Math.max(1, Math.round(last))}</b>{Math.round(last) !== s.m && s.variant === 'm' ? ', different from the m you entered' : ''})</> : null}. If m ≈ 1 the root is simple.
        </>)}
      </p>
    </Card>
  )
}

const ORDER_HINT: Record<RootKind, string> = {
  biseccion: L('teórico: 1 (lineal, C = ½)', 'theoretical: 1 (linear, C = ½)'),
  'posicion-falsa': L('teórico: 1 si un extremo queda fijo; mayor con la modificación', 'theoretical: 1 if an endpoint stays fixed; higher with the modification'),
  'punto-fijo': L('teórico: 1 si g′(x*) ≠ 0', 'theoretical: 1 if g′(x*) ≠ 0'),
  aitken: L('lineal con C = g′(α)² (acelera el punto fijo)', 'linear with C = g′(α)² (accelerates fixed point)'),
  steffensen: L('teórico: 2 (cuadrático)', 'theoretical: 2 (quadratic)'),
  newton: L('teórico: 2 (raíz simple)', 'theoretical: 2 (simple root)'),
  secante: L('teórico: φ ≈ 1.618', 'theoretical: φ ≈ 1.618'),
  'newton-mod': L('teórico: 2 (recupera cuadrática)', 'theoretical: 2 (quadratic restored)'),
}

function columnsFor(kind: RootKind, s: State): Column<any>[] {
  const n: Column<any> = { key: 'n', tex: 'n', fmt: 'int', align: 'center' }
  const err: Column<any> = { key: 'err', tex: s.crit === 'o' ? '\\min(|\\Delta x|,|f|)' : s.crit === 'f' ? L('\\text{residuo}', '\\text{residual}') : s.crit === 'rel' ? L('\\text{error rel.}', '\\text{rel. error}') : '|\\Delta x|', fmt: 'err' }
  const p: Column<any> = { key: 'p', tex: 'p_n', get: (r) => (Number.isFinite(r.p) ? r.p.toFixed(3) : '—') }
  switch (kind) {
    case 'biseccion':
      return [n, { key: 'a', tex: 'x_I' }, { key: 'b', tex: 'x_D' }, { key: 'fa', tex: 'f(x_I)', fmt: 'err' }, { key: 'fb', tex: 'f(x_D)', fmt: 'err' }, { key: 'c', tex: 'x_M=\\frac{x_I+x_D}{2}' }, { key: 'fc', tex: 'f(x_M)', fmt: 'err' }, { ...err, tex: s.crit === 'abs' ? '\\frac{x_D-x_I}{2}' : err.tex }]
    case 'posicion-falsa':
      return [n, { key: 'a', tex: 'x_I' }, { key: 'b', tex: 'x_D' }, { key: 'fa', tex: 'f(x_I)', fmt: 'err' }, { key: 'fb', tex: 'f(x_D)', fmt: 'err' }, { key: 'c', tex: '\\alpha_S\\;(2.19)' }, { key: 'fc', tex: 'f(\\alpha_S)', fmt: 'err' }, err, p]
    case 'punto-fijo':
      return [n, { key: 'x', tex: 'x_n' }, { key: 'gx', tex: 'x_{n+1}=g(x_n)' }, err, p]
    case 'aitken':
      return [n, { key: 'x', tex: 'x_n' }, { key: 'x1', tex: 'x_{n+1}' }, { key: 'x2', tex: 'x_{n+2}' }, { key: 'hat', tex: 'y_n\\;(2.17)' }, err, p]
    case 'steffensen':
      return [n, { key: 'x', tex: 'x_n' }, { key: 'g1', tex: 'g(x_n)' }, { key: 'g2', tex: 'g(g(x_n))' }, { key: 'xn', tex: 'y_n = x_{n+1}' }, err, p]
    case 'newton':
      return [n, { key: 'x', tex: 'x_n' }, { key: 'fx', tex: 'f(x_n)', fmt: 'err' }, { key: 'dfx', tex: "f'(x_n)" }, { key: 'xn', tex: 'x_{n+1}' }, err, p]
    case 'secante':
      return [n, { key: 'xp', tex: 'x_{n-1}' }, { key: 'x', tex: 'x_n' }, { key: 'fx', tex: 'f(x_n)', fmt: 'err' }, { key: 'xn', tex: 'x_{n+1}' }, err, p]
    case 'newton-mod':
      return [n, { key: 'x', tex: 'x_n' }, { key: 'fx', tex: 'f(x_n)', fmt: 'err' }, { key: 'dfx', tex: "f'(x_n)", fmt: 'err' }, { key: 'd2fx', tex: "f''(x_n)" }, { key: 'xn', tex: 'x_{n+1}' }, err, p]
  }
}

/* ───────────────────────── Gráficas ───────────────────────── */

function plotRange(s: State, pts: number[]): [number, number] {
  const xmin = evalNumber(s.xmin), xmax = evalNumber(s.xmax)
  const fin = pts.filter(Number.isFinite).filter((v) => Math.abs(v) < 1e6)
  let lo = fin.length ? Math.min(...fin) : -5
  let hi = fin.length ? Math.max(...fin) : 5
  if (hi - lo < 1e-9) {
    lo -= 1
    hi += 1
  }
  const pad = Math.max((hi - lo) * 0.5, 0.75)
  return [Number.isFinite(xmin) ? xmin : lo - pad, Number.isFinite(xmax) ? xmax : hi + pad]
}

function MainPlot({ kind, s, c }: { kind: RootKind; s: State; c: Required<Calc> }) {
  const { res } = c
  const data = useMemo(() => {
    const pts = usesInterval(kind) ? [evalNumber(s.a), evalNumber(s.b)] : res.iterates.slice(0, 8)
    const [a, b] = plotRange(s, pts)
    const traces: Trace[] = []
    if (usesG(kind)) {
      const gs = sample(c.g.f, a, b)
      traces.push({ ...gs, type: 'scatter', mode: 'lines', name: 'y = g(x)', line: { color: SERIES[0], width: 2.5 } })
      traces.push({ x: [a, b], y: [a, b], type: 'scatter', mode: 'lines', name: 'y = x', line: { color: SERIES[1], dash: 'dash', width: 1.5 } })
      // Diagrama de telaraña
      const it = kind === 'steffensen' ? [] : kind === 'aitken' ? res.rows.flatMap((r) => [r.x]).concat(res.rows.length ? [res.rows[res.rows.length - 1].x1, res.rows[res.rows.length - 1].x2] : []) : res.iterates
      const cx: number[] = [], cy: number[] = []
      it.slice(0, 30).forEach((x, i) => {
        if (i === 0) {
          cx.push(x); cy.push(0)
        }
        const gx = c.g.f(x)
        cx.push(x, gx); cy.push(gx, gx)
      })
      if (cx.length) traces.push({ x: cx, y: cy, type: 'scatter', mode: 'lines', name: L('telaraña', 'cobweb'), line: { color: SERIES[2], width: 1.2 } })
      traces.push({ x: res.iterates, y: res.iterates.map((x) => c.g.f(x)), type: 'scatter', mode: 'markers', name: kind === 'aitken' ? 'yₙ (Aitken)' : 'xₙ', marker: { color: SERIES[3], size: 7 } })
    } else {
      const fs = sample(c.f.f, a, b)
      traces.push({ ...fs, type: 'scatter', mode: 'lines', name: 'f(x)', line: { color: SERIES[0], width: 2.5 } })
      const shown = res.iterates.slice(0, 12)
      if (kind === 'newton' || kind === 'newton-mod') {
        // tangentes (Newton) o rectas de la iteración modificada
        res.rows.slice(0, 5).forEach((r, i) => {
          traces.push({ x: [r.x, r.x, r.xn], y: [0, r.fx, 0], type: 'scatter', mode: 'lines', name: i === 0 ? (kind === 'newton' ? L('tangentes', 'tangents') : L('pasos', 'steps')) : undefined, showlegend: i === 0, legendgroup: 't', line: { color: SERIES[1], width: 1.3, dash: 'dot' } })
        })
      }
      if (kind === 'posicion-falsa') {
        res.rows.slice(0, 5).forEach((r, i) => {
          traces.push({ x: [r.a, r.b], y: [r.fa, r.fb], type: 'scatter', mode: 'lines', name: i === 0 ? L('secantes', 'secants') : undefined, showlegend: i === 0, legendgroup: 's', line: { color: SERIES[1], width: 1.3, dash: 'dot' } })
        })
      }
      if (kind === 'secante') {
        res.rows.slice(0, 5).forEach((r, i) => {
          traces.push({ x: [r.xp, r.xn], y: [r.fxp, 0], type: 'scatter', mode: 'lines', name: i === 0 ? L('secantes', 'secants') : undefined, showlegend: i === 0, legendgroup: 's', line: { color: SERIES[1], width: 1.3, dash: 'dot' } })
        })
      }
      if (kind === 'biseccion') {
        res.rows.slice(0, 8).forEach((r, i) => {
          const y = -((i + 1) * (Math.max(...sampleRange(fs).map(Math.abs)) || 1)) / 14
          traces.push({ x: [r.a, r.b], y: [y, y], type: 'scatter', mode: 'lines+markers', name: i === 0 ? '[aₙ, bₙ]' : undefined, showlegend: i === 0, legendgroup: 'i', line: { color: SERIES[2], width: 3 }, marker: { size: 5 } })
        })
      }
      traces.push({ x: shown, y: shown.map(() => 0), type: 'scatter', mode: 'text+markers', text: shown.map((_, i) => (i < 3 ? (usesInterval(kind) ? `${i + 1}` : `x${i}`) : '')), textposition: 'top center', name: L('iteraciones', 'iterates'), marker: { color: SERIES[3], size: 7 } })
    }
    if (Number.isFinite(res.root))
      traces.push({ x: [res.root], y: [usesG(kind) ? res.root : 0], type: 'scatter', mode: 'markers', name: 'x*', marker: { color: SERIES[5], size: 12, symbol: 'star' } })
    return traces
  }, [kind, s, c])
  return <Plot data={data} />
}

function ConvPlot({ res }: { res: A.RootResult }) {
  const data = useMemo(() => {
    const it = res.iterates
    const ref = res.root
    const e = it.map((x) => Math.abs(x - ref)).map((v) => (v > 0 ? v : null))
    const d = it.slice(1).map((x, i) => Math.abs(x - it[i])).map((v) => (v > 0 ? v : null))
    return [
      { x: d.map((_, i) => i + 1), y: d, type: 'scatter', mode: 'lines+markers', name: '|xₙ − xₙ₋₁|', line: { color: SERIES[0] } },
      { x: e.map((_, i) => i), y: e, type: 'scatter', mode: 'lines+markers', name: L('|xₙ − x*| (x* = última aprox.)', '|xₙ − x*| (x* = last approx.)'), line: { color: SERIES[1], dash: 'dot' } },
    ] as Trace[]
  }, [res])
  return (
    <>
      <Plot data={data} layout={{ yaxis: { type: 'log', title: { text: L('error (escala log)', 'error (log scale)') }, exponentformat: 'power' }, xaxis: { title: { text: 'n' }, dtick: 1 } }} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
        {L(
          'En escala logarítmica: una recta indica convergencia lineal (pendiente = log C); una curva que cae cada vez más rápido indica orden superior (la cantidad de cifras correctas se duplica en Newton).',
          'On a log scale, a straight line indicates linear convergence (slope = log C); a curve that drops ever faster indicates higher order (with Newton the number of correct digits doubles at each step).',
        )}
      </p>
    </>
  )
}

/* ───────────────────────── Paso a paso ───────────────────────── */

function stepsFor(kind: RootKind, s: State, c: Required<Calc>): { text?: string; tex?: string }[] {
  const r = c.res.rows
  const N = (x: number) => texNum(x, 10)
  const out: { text?: string; tex?: string }[] = []
  const take = r.slice(0, 3)
  switch (kind) {
    case 'biseccion': {
      const a = evalNumber(s.a), b = evalNumber(s.b)
      out.push({ text: L('Verificamos el cambio de signo (teorema de Bolzano):', 'Check the sign change (Bolzano\'s theorem):'), tex: `f(x_I) = f(${N(a)}) = ${N(c.f.f(a))},\\quad f(x_D) = f(${N(b)}) = ${N(c.f.f(b))}\\;\\Rightarrow\\; f(x_I)f(x_D) ${c.f.f(a) * c.f.f(b) < 0 ? '<' : '>'} 0` })
      const tol = evalNumber(s.tol)
      if (tol > 0 && b !== a)
        out.push({ text: L('Número de iteraciones para garantizar |α − x_M| ≤ EPS (relación 2.6):', 'Number of iterations that guarantees |α − x_M| ≤ EPS (relation 2.6):'), tex: `n \\ge \\frac{\\ln(${N(Math.abs(b - a))}) - \\ln(${N(tol)})}{\\ln 2} = ${N(Math.log(Math.abs(b - a) / tol) / Math.LN2)}\\;\\Rightarrow\\; n = ${A.biseccionIterMin(a, b, tol)}` })
      take.forEach((x) => {
        const sameAsI = x.fa * x.fc > 0
        out.push({
          text: L(`Iteración ${x.n}:`, `Iteration ${x.n}:`),
          tex: `x_M = \\frac{${N(x.a)} + ${N(x.b)}}{2} = ${N(x.c)},\\quad f(x_M) = ${N(x.fc)}\\;\\Rightarrow\\; ${sameAsI ? `f(x_M)f(x_I) > 0,\\ x_I = ${N(x.c)}` : `f(x_M)f(x_I) < 0,\\ x_D = ${N(x.c)}`}`,
        })
      })
      break
    }
    case 'posicion-falsa': {
      const a = evalNumber(s.a), b = evalNumber(s.b)
      out.push({ text: L('Verificamos el cambio de signo:', 'Check the sign change:'), tex: `f(x_I) = f(${N(a)}) = ${N(c.f.f(a))},\\quad f(x_D) = f(${N(b)}) = ${N(c.f.f(b))}\\;\\Rightarrow\\; f(x_I)f(x_D) ${c.f.f(a) * c.f.f(b) < 0 ? '<' : '>'} 0` })
      out.push({ text: L('Raíz de la secante que une (x_I, f(x_I)) y (x_D, f(x_D)) — relación (2.19):', 'Root of the secant line through (x_I, f(x_I)) and (x_D, f(x_D)) — relation (2.19):'), tex: '\\alpha_S = x_D - \\frac{x_D - x_I}{f(x_D) - f(x_I)}\\,f(x_D)' })
      take.forEach((x) => {
        const sameAsI = x.fa * x.fc > 0
        out.push({
          text: L(`Iteración ${x.n}${x.mod ? ' (se usa la mitad del valor de f en el extremo que no cambió en dos iteraciones)' : ''}:`, `Iteration ${x.n}${x.mod ? ' (half of the f value is used at the endpoint that did not change for two iterations)' : ''}:`),
          tex: `\\alpha_S = ${N(x.b)} - \\frac{${N(x.b)} - ${N(x.a)}}{${N(x.fb)} - (${N(x.fa)})}\\,(${N(x.fb)}) = ${N(x.c)},\\quad f(\\alpha_S) = ${N(x.fc)}\\;\\Rightarrow\\; ${sameAsI ? 'x_I = \\alpha_S' : 'x_D = \\alpha_S'}`,
        })
      })
      break
    }
    case 'punto-fijo':
      out.push({ text: L('Iteramos xₙ₊₁ = g(xₙ):', 'Iterate xₙ₊₁ = g(xₙ):') })
      take.forEach((x) => out.push({ tex: `x_{${x.n + 1}} = g(${N(x.x)}) = ${c.g.tex.replace(/\bx\b/g, `(${N(x.x)})`)} = ${N(x.gx)}` }))
      if (c.df) {
        const dg = c.df.f(c.res.root)
        out.push({ text: L('Criterio de convergencia (teorema del punto fijo):', 'Convergence criterion (fixed-point theorem):'), tex: `g'(x) = ${c.dTex},\\qquad |g'(x^*)| = ${N(Math.abs(dg))} ${Math.abs(dg) < 1 ? L('< 1 \\Rightarrow \\text{converge (localmente)}', '< 1 \\Rightarrow \\text{converges (locally)}') : L('\\geq 1 \\Rightarrow \\text{no hay contracción}', '\\geq 1 \\Rightarrow \\text{not a contraction}')}` })
      }
      break
    case 'aitken':
      take.forEach((x) =>
        out.push({ text: `n = ${x.n}:`, tex: `y_{${x.n}} = x_{${x.n}} - \\frac{(x_{${x.n + 1}}-x_{${x.n}})^2}{x_{${x.n + 2}} - 2x_{${x.n + 1}} + x_{${x.n}}} = ${N(x.x)} - \\frac{(${N(x.x1)} - ${N(x.x)})^2}{${N(x.x2)} - 2(${N(x.x1)}) + ${N(x.x)}} = ${N(x.hat)}` }),
      )
      break
    case 'steffensen':
      take.forEach((x) =>
        out.push({ text: L(`Iteración ${x.n}: calculamos g(xₙ) = ${fmt(x.g1)}, g(g(xₙ)) = ${fmt(x.g2)}`, `Iteration ${x.n}: compute g(xₙ) = ${fmt(x.g1)}, g(g(xₙ)) = ${fmt(x.g2)}`), tex: `y_{${x.n}} = ${N(x.x)} - \\frac{(${N(x.g1)} - ${N(x.x)})^2}{${N(x.g2)} - 2(${N(x.g1)}) + ${N(x.x)}} = ${N(x.xn)}` }),
      )
      break
    case 'newton':
      out.push({ text: L('Derivada:', 'Derivative:'), tex: `f'(x) = ${c.dTex}` })
      take.forEach((x) => out.push({ text: L(`Iteración ${x.n}:`, `Iteration ${x.n}:`), tex: `x_{${x.n + 1}} = x_{${x.n}} - \\frac{f(x_{${x.n}})}{f'(x_{${x.n}})} = ${N(x.x)} - \\frac{${N(x.fx)}}{${N(x.dfx)}} = ${N(x.xn)}` }))
      break
    case 'secante':
      take.forEach((x) => out.push({ text: L(`Iteración ${x.n}:`, `Iteration ${x.n}:`), tex: `x_{${x.n + 1}} = x_{${x.n}} - f(x_{${x.n}})\\frac{x_{${x.n}} - x_{${x.n - 1}}}{f(x_{${x.n}}) - f(x_{${x.n - 1}})} = ${N(x.x)} - (${N(x.fx)})\\frac{${N(x.x)} - ${N(x.xp)}}{${N(x.fx)} - ${N(x.fxp)}} = ${N(x.xn)}` }))
      break
    case 'newton-mod':
      out.push({ tex: `f'(x) = ${c.dTex},\\qquad f''(x) = ${c.d2Tex}` })
      take.forEach((x) =>
        out.push({
          text: L(`Iteración ${x.n}:`, `Iteration ${x.n}:`),
          tex: s.variant === 'm' ? `x_{${x.n + 1}} = x_{${x.n}} - ${s.m}\\,\\frac{f(x_{${x.n}})}{f'(x_{${x.n}})} = ${N(x.x)} - ${s.m}\\cdot\\frac{${N(x.fx)}}{${N(x.dfx)}} = ${N(x.xn)}` : `x_{${x.n + 1}} = x_{${x.n}} - \\frac{f f'}{(f')^2 - f f''} = ${N(x.x)} - \\frac{(${N(x.fx)})(${N(x.dfx)})}{(${N(x.dfx)})^2 - (${N(x.fx)})(${N(x.d2fx)})} = ${N(x.xn)}`,
        }),
      )
      break
  }
  if (r.length > 3) out.push({ text: L(`… y así sucesivamente hasta la iteración ${r[r.length - 1].n} (ver tabla).`, `… and so on up to iteration ${r[r.length - 1].n} (see the table).`) })
  return out
}

/* ───────────────────────── Scilab ───────────────────────── */

function scilabFor(kind: RootKind, s: State): string {
  const F = toScilab(s.f, false)
  const G = toScilab(s.g, false)
  const tol = s.tol
  const N = s.maxIter
  const f = compile(s.f)
  const df = f.ok ? compileDerivative(f) : null
  const d2f = df && df.ok ? compileDerivative(df) : null
  const DF = df && df.ok ? toScilab(df.node, false) : L("// escribe f'(x)", "// write f'(x)")
  const D2F = d2f && d2f.ok ? toScilab(d2f.node, false) : L("// escribe f''(x)", "// write f''(x)")
  const head = `// ${TITLES[kind]} — ${L('generado por NumLab', 'generated by NumLab')}\nclear; clc;\n`
  /** Condición de parada en Scilab: dx = |x_nuevo − x_anterior|, res = residuo, xn = x_nuevo. */
  const stop = (dx: string, res: string, xn: string) =>
    s.crit === 'o' ? `abs(${res}) <= tol | ${dx} <= tol` : s.crit === 'f' ? `abs(${res}) <= tol` : s.crit === 'rel' ? `${dx}/abs(${xn}) <= tol` : `${dx} <= tol`
  const fdef = `function y = f(x)\n  y = ${F};\nendfunction\n`
  const gdef = `function y = g(x)\n  y = ${G};\nendfunction\n`
  const dfdef = `function y = df(x)\n  y = ${DF};\nendfunction\n`
  switch (kind) {
    case 'biseccion':
      return `${head}${fdef}\nxI = ${s.a}; xD = ${s.b}; tol = ${tol}; maxit = ${N};\nif f(xI)*f(xD) > 0 then\n  error('${L('f(xI) y f(xD) deben tener signos opuestos', 'f(xI) and f(xD) must have opposite signs')}');\nend\nmprintf('${L('Iteraciones necesarias (2.6)', 'Required iterations (2.6)')}: %d\\n', ceil((log(abs(xD - xI)) - log(tol))/log(2)));\nmprintf('%4s %14s %14s %14s %12s\\n', 'n', 'xI', 'xD', 'xM', 'f(xM)');\nfor n = 1:maxit\n  xM = (xI + xD)/2;\n  mprintf('%4d %14.10f %14.10f %14.10f %12.3e\\n', n, xI, xD, xM, f(xM));\n  if f(xM)*f(xI) > 0 then\n    xI = xM;\n  else\n    xD = xM;\n  end\n  if f(xM) == 0 | ${stop('abs(xD - xI)', 'f(xM)', 'xM')} then\n    break;\n  end\nend\nmprintf('${L('Raiz aproximada', 'Approximate root')}: %.15f\\n', xM);\n`
    case 'posicion-falsa':
      return `${head}${fdef}\nxI = ${s.a}; xD = ${s.b}; tol = ${tol}; maxit = ${N};\nif f(xI)*f(xD) > 0 then\n  error('${L('f(xI) y f(xD) deben tener signos opuestos', 'f(xI) and f(xD) must have opposite signs')}');\nend\nfI = f(xI); fD = f(xD);${s.mod ? '\nfijoI = 0; fijoD = 0; // ' + L('iteraciones seguidas sin cambiar cada extremo', 'consecutive iterations without changing each endpoint') + '' : ''}\naS = %nan;\nmprintf('%4s %14s %14s %14s %12s\\n', 'n', 'xI', 'xD', 'alfaS', 'f(alfaS)');\nfor n = 1:maxit\n  aOld = aS;\n  aS = xD - (xD - xI)/(fD - fI)*fD;   // ${L('relacion', 'relation')} (2.19)\n  fS = f(aS);\n  mprintf('%4d %14.10f %14.10f %14.10f %12.3e\\n', n, xI, xD, aS, fS);\n  if fS*fI > 0 then\n    xI = aS; fI = fS;${s.mod ? ' fijoI = 0; fijoD = fijoD + 1;' : ''}\n  else\n    xD = aS; fD = fS;${s.mod ? ' fijoD = 0; fijoI = fijoI + 1;' : ''}\n  end${s.mod ? '\n  // ' + L('version modificada: mitad de f en el extremo que no cambio en dos iteraciones', 'modified version: half of f at the endpoint that did not change in two iterations') + '\n  if fijoI >= 2 then fI = fI/2; end\n  if fijoD >= 2 then fD = fD/2; end' : ''}\n  if fS == 0 | ${s.crit === 'o' || s.crit === 'f' ? `abs(fS) <= tol${s.crit === 'o' ? ' | abs(aS - aOld) <= tol' : ''}` : s.crit === 'rel' ? 'abs(aS - aOld)/abs(aS) <= tol' : 'abs(aS - aOld) <= tol'} then\n    break;\n  end\nend\nmprintf('${L('Raiz aproximada', 'Approximate root')}: %.15f\\n', aS);\n`
    case 'punto-fijo':
      return `${head}${gdef}\nx = ${s.x0}; tol = ${tol}; maxit = ${N};\nmprintf('%4s %18s %18s\\n', 'n', 'x_n', 'x_(n+1)');\nfor n = 0:maxit-1\n  xn = g(x);\n  mprintf('%4d %18.12f %18.12f\\n', n, x, xn);\n  dx = abs(xn - x);\n  x = xn;\n  if ${stop('dx', 'x - g(x)', 'x')} then break; end\nend\nmprintf('${L('Punto fijo', 'Fixed point')}: %.15f\\n', x);\n`
    case 'aitken':
      return `${head}${gdef}\nx0 = ${s.x0}; tol = ${tol}; maxit = ${N};\n// ${L('sucesion de punto fijo', 'fixed-point sequence')} x(1) = x_0, x(2) = x_1, ...\nx = zeros(1, maxit + 2); x(1) = x0;\nfor k = 2:maxit + 2\n  x(k) = g(x(k-1));\nend\nyOld = %nan;\nmprintf('%4s %18s %18s\\n', 'n', 'x_n', 'y_n');\nfor n = 1:maxit\n  y = x(n) - (x(n+1) - x(n))^2 / (x(n+2) - 2*x(n+1) + x(n));   // ${L('relacion', 'relation')} (2.17)\n  mprintf('%4d %18.12f %18.12f\\n', n-1, x(n), y);\n  if n > 1 & (${stop('abs(y - yOld)', 'y - g(y)', 'y')}) then break; end\n  yOld = y;\nend\nmprintf('${L('Aproximacion', 'Approximation')} (Aitken): %.15f\\n', y);\n`
    case 'steffensen':
      return `${head}${gdef}\nx = ${s.x0}; tol = ${tol}; maxit = ${N};\nmprintf('%4s %18s %18s\\n', 'n', 'x_n', 'y_n');\nfor n = 0:maxit-1\n  x1 = g(x); x2 = g(x1);\n  y = x - (x1 - x)^2 / (x2 - 2*x1 + x);   // Aitken (2.17) ${L('con', 'with')} x, g(x), g(g(x))\n  mprintf('%4d %18.12f %18.12f\\n', n, x, y);\n  dx = abs(y - x);\n  x = y;   // ${L('se reinicia la iteracion con y_n', 'restart the iteration from y_n')}\n  if ${stop('dx', 'x - g(x)', 'x')} then break; end\nend\nmprintf('${L('Punto fijo', 'Fixed point')} (Steffensen): %.15f\\n', x);\n`
    case 'newton':
      return `${head}${fdef}${dfdef}\nx = ${s.x0}; tol = ${tol}; maxit = ${N};\nmprintf('%4s %18s %14s\\n', 'n', 'x_n', 'f(x_n)');\nfor n = 0:maxit-1\n  xn = x - f(x)/df(x);   // ${L('relacion', 'relation')} (2.18)\n  mprintf('%4d %18.12f %14.4e\\n', n, x, f(x));\n  dx = abs(xn - x);\n  x = xn;\n  if ${stop('dx', 'f(x)', 'x')} then break; end\nend\nmprintf('${L('Raiz', 'Root')}: %.15f\\n', x);\n`
    case 'secante':
      return `${head}${fdef}\nx0 = ${s.x0}; x1 = ${s.x1}; tol = ${tol}; maxit = ${N};\nfor n = 1:maxit\n  x2 = x1 - (x1 - x0)/(f(x1) - f(x0))*f(x1);\n  mprintf('%4d %18.12f %12.3e\\n', n, x2, abs(x2 - x1));\n  dx = abs(x2 - x1);\n  x0 = x1; x1 = x2;\n  if ${stop('dx', 'f(x1)', 'x1')} then break; end\nend\nmprintf('${L('Raiz', 'Root')}: %.15f\\n', x1);\n`
    case 'newton-mod':
      return s.variant === 'm'
        ? `${head}${fdef}${dfdef}\nm = ${s.m}; // ${L('multiplicidad', 'multiplicity')}\nx = ${s.x0}; tol = ${tol}; maxit = ${N};\nfor n = 0:maxit-1\n  if f(x) == 0 then break; end\n  xn = x - m*f(x)/df(x);   // ${L('relacion', 'relation')} (2.21)\n  mprintf('%4d %18.12f %12.3e\\n', n, xn, abs(xn - x));\n  dx = abs(xn - x);\n  x = xn;\n  if ${stop('dx', 'f(x)', 'x')} then break; end\nend\nmprintf('${L('Raiz multiple', 'Multiple root')}: %.15f\\n', x);\n`
        : `${head}${fdef}${dfdef}function y = d2f(x)\n  y = ${D2F};\nendfunction\n\n// ${L('metodo alternativo: Newton aplicado a', 'alternative method: Newton applied to')} u(x) = f(x)/f'(x)\nx = ${s.x0}; tol = ${tol}; maxit = ${N};\nfor n = 0:maxit-1\n  if f(x) == 0 then break; end\n  xn = x - f(x)*df(x)/(df(x)^2 - f(x)*d2f(x));\n  mprintf('%4d %18.12f %12.3e\\n', n, xn, abs(xn - x));\n  dx = abs(xn - x);\n  x = xn;\n  if ${stop('dx', 'f(x)', 'x')} then break; end\nend\nmprintf('${L('Raiz multiple', 'Multiple root')}: %.15f\\n', x);\n`
  }
}
