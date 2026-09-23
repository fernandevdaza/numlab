// Entrada de datos compartida: puntos (x, y) o nodos x + función f(x).
import { compile, evalNumber, type Compiled } from '../../lib/expr'
import { fmt } from '../../lib/format'
import { Tex } from '../../components/Tex'
import { CheckField, ExprField, MatrixField, parseMatrix, parseVector, SelectField, VectorField } from '../../components/ui'
import { duplicateNodes } from './algorithms'
import { L } from '../../i18n'

export type DataMode = 'puntos' | 'tabla' | 'funcion'

export interface DataState {
  mode: DataMode
  xs: string
  ys: string
  tabla: string
  f: string
  xbar: string
  frac: boolean
}

export const DATA_DEFAULTS: DataState = {
  mode: 'funcion',
  xs: '2 2.75 4',
  ys: '',
  tabla: '',
  f: '1/x',
  xbar: '3',
  frac: true,
}

export interface ParsedData {
  error?: string
  xs: number[]
  ys: number[]
  /** función exacta (si se conoce) */
  f?: Compiled
  xbar: number
}

/**
 * Lee los datos del formulario y valida.
 * @param opts.sort ordena los puntos por x (splines)
 * @param opts.max número máximo de puntos
 */
export function parseData(s: DataState, opts: { sort?: boolean; max?: number; min?: number } = {}): ParsedData {
  const max = opts.max ?? 25
  const min = opts.min ?? 2
  const bad = (error: string): ParsedData => ({ error, xs: [], ys: [], xbar: NaN })
  let xs: number[] | null = null
  let ys: number[] | null = null
  let f: Compiled | undefined
  if (s.f.trim()) {
    const c = compile(s.f)
    if (c.ok) f = c
    else if (s.mode === 'funcion') return bad('f(x): ' + c.error)
  } else if (s.mode === 'funcion') return bad(L('Escribe la función f(x) para generar los valores y.', 'Enter the function f(x) to generate the y values.'))

  if (s.mode === 'tabla') {
    const M = parseMatrix(s.tabla)
    if (!M) return bad(L('Tabla inválida: escribe un punto por línea, "x y".', 'Invalid table: enter one point per line, "x y".'))
    if (M[0].length !== 2) return bad(L(`La tabla debe tener exactamente 2 columnas (x, y); tiene ${M[0].length}.`, `The table must have exactly 2 columns (x, y); it has ${M[0].length}.`))
    xs = M.map((r) => r[0])
    ys = M.map((r) => r[1])
  } else {
    xs = parseVector(s.xs)
    if (!xs) return bad(L('Nodos x inválidos: escribe números separados por espacios o comas.', 'Invalid x nodes: enter numbers separated by spaces or commas.'))
    if (s.mode === 'puntos') {
      ys = parseVector(s.ys)
      if (!ys) return bad(L('Valores y inválidos: escribe números separados por espacios o comas.', 'Invalid y values: enter numbers separated by spaces or commas.'))
      if (ys.length !== xs.length) return bad(L(`Hay ${xs.length} valores de x pero ${ys.length} valores de y: deben tener la misma cantidad.`, `There are ${xs.length} x values but ${ys.length} y values: they must have the same length.`))
    } else {
      ys = xs.map((x) => f!.f(x))
      const k = ys.findIndex((v) => !Number.isFinite(v))
      if (k >= 0) return bad(L(`f(x) no está definida en x = ${fmt(xs[k])} (nodo ${k}).`, `f(x) is not defined at x = ${fmt(xs[k])} (node ${k}).`))
    }
  }
  if (xs.length < min) return bad(L(`Se necesitan al menos ${min} puntos.`, `At least ${min} points are needed.`))
  if (xs.length > max) return bad(L(`Demasiados puntos (${xs.length}); el máximo para este método es ${max}.`, `Too many points (${xs.length}); the maximum for this method is ${max}.`))
  const dup = duplicateNodes(xs)
  if (dup) return bad(
      L(
        `Los nodos deben ser distintos: x${sub(dup[0])} = x${sub(dup[1])} = ${fmt(xs[dup[0]])}. La interpolación polinomial no admite abscisas repetidas.`,
        `The nodes must be distinct: x${sub(dup[0])} = x${sub(dup[1])} = ${fmt(xs[dup[0]])}. Polynomial interpolation does not allow repeated abscissas.`,
      ),
    )
  if (opts.sort) {
    const idx = xs.map((_, i) => i).sort((i, j) => xs![i] - xs![j])
    xs = idx.map((i) => xs![i])
    ys = idx.map((i) => ys![i])
  }
  const xbar = s.xbar.trim() ? evalNumber(s.xbar) : NaN
  if (s.xbar.trim() && !Number.isFinite(xbar)) return bad(L('El valor x̄ a evaluar es inválido.', 'The evaluation point x̄ is invalid.'))
  return { xs, ys, f, xbar }
}

function sub(n: number) {
  return String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d])
}

/** Campos de entrada de datos. */
export function DataInput({ s, set, xbarLabel = L('Evaluar en x̄ =', 'Evaluate at x̄ ='), showFrac = true, requireF = false }: { s: DataState; set: (p: Partial<DataState>) => void; xbarLabel?: string; showFrac?: boolean; requireF?: boolean }) {
  const modes: { value: DataMode; label: string }[] = requireF
    ? [{ value: 'funcion', label: L('Nodos x + función f(x)', 'Nodes x + function f(x)') }]
    : [
        { value: 'funcion', label: L('Nodos x + función f(x)', 'Nodes x + function f(x)') },
        { value: 'puntos', label: L('Puntos: lista de x y lista de y', 'Points: list of x and list of y') },
        { value: 'tabla', label: L('Tabla de dos columnas (x y)', 'Two-column table (x y)') },
      ]
  const mode = requireF ? 'funcion' : s.mode
  return (
    <>
      {!requireF && <SelectField label={L('Datos de entrada', 'Input data')} value={mode} onChange={(m) => set({ mode: m })} options={modes} />}
      {mode === 'tabla' ? (
        <MatrixField label={L('Puntos (una fila por punto: x y)', 'Points (one row per point: x y)')} value={s.tabla} onChange={(tabla) => set({ tabla })} rows={5} hint={L('Ejemplo: 1 0.765 ↵ 1.3 0.620 ↵ …', 'Example: 1 0.765 ↵ 1.3 0.620 ↵ …')} />
      ) : (
        <VectorField label={<>{L('Nodos', 'Nodes')} <Tex>{'x_0, x_1, \\dots, x_n'}</Tex></>} value={s.xs} onChange={(xs) => set({ xs })} hint={L('Separados por espacios o comas; admite pi/4, sqrt(2)…', 'Separated by spaces or commas; accepts pi/4, sqrt(2)…')} />
      )}
      {mode === 'puntos' && <VectorField label={<>{L('Valores', 'Values')} <Tex>{'y_i = f(x_i)'}</Tex></>} value={s.ys} onChange={(ys) => set({ ys })} />}
      <ExprField
        label={mode === 'funcion' ? L('Función f(x)', 'Function f(x)') : L('f(x) exacta (opcional)', 'Exact f(x) (optional)')}
        value={s.f}
        onChange={(f) => set({ f })}
        texPrefix="f(x) ="
        hint={
          mode === 'funcion'
            ? L('Se usa para generar yᵢ = f(xᵢ) y calcular el error real.', 'Used to generate yᵢ = f(xᵢ) and compute the actual error.')
            : L('Si la conoces, se muestra el error real |f(x) − P(x)|.', 'If known, the actual error |f(x) − P(x)| is shown.')
        }
      />
      <label className="field">
        <span className="field-label">{xbarLabel}</span>
        <input className="input mono" value={s.xbar} placeholder={L('(opcional)', '(optional)')} spellCheck={false} onChange={(e) => set({ xbar: e.target.value })} />
        {s.xbar.trim() && !/^\s*-?\d*\.?\d+\s*$/.test(s.xbar) && Number.isFinite(evalNumber(s.xbar)) && <span className="field-preview mono">= {fmt(evalNumber(s.xbar), 12)}</span>}
      </label>
      {showFrac && <CheckField label={L('Mostrar coeficientes exactos como fracciones', 'Show exact coefficients as fractions')} value={s.frac} onChange={(frac) => set({ frac })} />}
    </>
  )
}
