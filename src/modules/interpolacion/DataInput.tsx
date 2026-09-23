// Entrada de datos compartida: puntos (x, y) o nodos x + función f(x).
import { compile, evalNumber, type Compiled } from '../../lib/expr'
import { fmt } from '../../lib/format'
import { Tex } from '../../components/Tex'
import { CheckField, ExprField, MatrixField, parseMatrix, parseVector, SelectField, VectorField } from '../../components/ui'
import { duplicateNodes } from './algorithms'

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
  } else if (s.mode === 'funcion') return bad('Escribe la función f(x) para generar los valores y.')

  if (s.mode === 'tabla') {
    const M = parseMatrix(s.tabla)
    if (!M) return bad('Tabla inválida: escribe un punto por línea, "x y".')
    if (M[0].length !== 2) return bad(`La tabla debe tener exactamente 2 columnas (x, y); tiene ${M[0].length}.`)
    xs = M.map((r) => r[0])
    ys = M.map((r) => r[1])
  } else {
    xs = parseVector(s.xs)
    if (!xs) return bad('Nodos x inválidos: escribe números separados por espacios o comas.')
    if (s.mode === 'puntos') {
      ys = parseVector(s.ys)
      if (!ys) return bad('Valores y inválidos: escribe números separados por espacios o comas.')
      if (ys.length !== xs.length) return bad(`Hay ${xs.length} valores de x pero ${ys.length} valores de y: deben tener la misma cantidad.`)
    } else {
      ys = xs.map((x) => f!.f(x))
      const k = ys.findIndex((v) => !Number.isFinite(v))
      if (k >= 0) return bad(`f(x) no está definida en x = ${fmt(xs[k])} (nodo ${k}).`)
    }
  }
  if (xs.length < min) return bad(`Se necesitan al menos ${min} puntos.`)
  if (xs.length > max) return bad(`Demasiados puntos (${xs.length}); el máximo para este método es ${max}.`)
  const dup = duplicateNodes(xs)
  if (dup) return bad(`Los nodos deben ser distintos: x${sub(dup[0])} = x${sub(dup[1])} = ${fmt(xs[dup[0]])}. La interpolación polinomial no admite abscisas repetidas.`)
  if (opts.sort) {
    const idx = xs.map((_, i) => i).sort((i, j) => xs![i] - xs![j])
    xs = idx.map((i) => xs![i])
    ys = idx.map((i) => ys![i])
  }
  const xbar = s.xbar.trim() ? evalNumber(s.xbar) : NaN
  if (s.xbar.trim() && !Number.isFinite(xbar)) return bad('El valor x̄ a evaluar es inválido.')
  return { xs, ys, f, xbar }
}

function sub(n: number) {
  return String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d])
}

/** Campos de entrada de datos. */
export function DataInput({ s, set, xbarLabel = 'Evaluar en x̄ =', showFrac = true, requireF = false }: { s: DataState; set: (p: Partial<DataState>) => void; xbarLabel?: string; showFrac?: boolean; requireF?: boolean }) {
  const modes: { value: DataMode; label: string }[] = requireF
    ? [{ value: 'funcion', label: 'Nodos x + función f(x)' }]
    : [
        { value: 'funcion', label: 'Nodos x + función f(x)' },
        { value: 'puntos', label: 'Puntos: lista de x y lista de y' },
        { value: 'tabla', label: 'Tabla de dos columnas (x y)' },
      ]
  const mode = requireF ? 'funcion' : s.mode
  return (
    <>
      {!requireF && <SelectField label="Datos de entrada" value={mode} onChange={(m) => set({ mode: m })} options={modes} />}
      {mode === 'tabla' ? (
        <MatrixField label="Puntos (una fila por punto: x y)" value={s.tabla} onChange={(tabla) => set({ tabla })} rows={5} hint="Ejemplo: 1 0.765 ↵ 1.3 0.620 ↵ …" />
      ) : (
        <VectorField label={<>Nodos <Tex>{'x_0, x_1, \\dots, x_n'}</Tex></>} value={s.xs} onChange={(xs) => set({ xs })} hint="Separados por espacios o comas; admite pi/4, sqrt(2)…" />
      )}
      {mode === 'puntos' && <VectorField label={<>Valores <Tex>{'y_i = f(x_i)'}</Tex></>} value={s.ys} onChange={(ys) => set({ ys })} />}
      <ExprField
        label={mode === 'funcion' ? 'Función f(x)' : 'f(x) exacta (opcional)'}
        value={s.f}
        onChange={(f) => set({ f })}
        texPrefix="f(x) ="
        hint={mode === 'funcion' ? 'Se usa para generar yᵢ = f(xᵢ) y calcular el error real.' : 'Si la conoces, se muestra el error real |f(x) − P(x)|.'}
      />
      <label className="field">
        <span className="field-label">{xbarLabel}</span>
        <input className="input mono" value={s.xbar} placeholder="(opcional)" spellCheck={false} onChange={(e) => set({ xbar: e.target.value })} />
        {s.xbar.trim() && !/^\s*-?\d*\.?\d+\s*$/.test(s.xbar) && Number.isFinite(evalNumber(s.xbar)) && <span className="field-preview mono">= {fmt(evalNumber(s.xbar), 12)}</span>}
      </label>
      {showFrac && <CheckField label="Mostrar coeficientes exactos como fracciones" value={s.frac} onChange={(frac) => set({ frac })} />}
    </>
  )
}
