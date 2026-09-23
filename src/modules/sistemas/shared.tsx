// Utilidades de presentación compartidas por las páginas del Tema 3.
import type { ReactNode } from 'react'
import { fmt, texNum } from '../../lib/format'
import { parseMatrix, parseVector } from '../../components/ui'
import type { Mat, Vec } from './linalg'

export const TOPIC = 'Tema 3 · Sistemas de ecuaciones lineales'

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/** Lee A (n×n) y b (n) desde texto, con mensajes de error en español. */
export function readSystem(Atext: string, btext?: string): { A: Mat; b: Vec; n: number } | { error: string } {
  const A = parseMatrix(Atext)
  if (!A) return { error: 'Matriz A inválida: escribe una fila por línea (o separadas por “;”) y el mismo número de valores en cada fila.' }
  const n = A.length
  if (A.some((r) => r.length !== n)) return { error: `A debe ser cuadrada (n×n): tiene ${n} fila${n > 1 ? 's' : ''} y ${A[0].length} columna${A[0].length > 1 ? 's' : ''}.` }
  if (n > 20) return { error: 'Tamaño máximo admitido: 20×20.' }
  if (btext === undefined) return { A, b: new Array(n).fill(0), n }
  const b = parseVector(btext)
  if (!b) return { error: 'Vector b inválido: escribe n números separados por espacios, comas o “;”.' }
  if (b.length !== n) return { error: `Dimensiones incompatibles: A es ${n}×${n} pero b tiene ${b.length} componente${b.length > 1 ? 's' : ''}.` }
  return { A, b, n }
}

/** Lee un vector opcional de tamaño n (vacío ⇒ ceros). */
export function readVec(text: string, n: number, name: string, fill = 0): Vec | string {
  if (!text.trim()) return new Array(n).fill(fill)
  const v = parseVector(text)
  if (!v) return `${name} inválido.`
  if (v.length !== n) return `${name} debe tener ${n} componentes (tiene ${v.length}).`
  return v
}

/** Número en TeX. */
export const N = (x: number, d?: number) => texNum(x, d)
/** Número en TeX, entre paréntesis si es negativo. */
export const P = (x: number, d?: number) => (x < 0 ? `(${texNum(x, d)})` : texNum(x, d))

/** Matriz aumentada [A | b] en TeX. `box` recuadra el pivote; `hl` resalta filas. */
export function texAug(M: Mat, d?: number, opts: { box?: [number, number]; hl?: number[] } = {}): string {
  const n = M[0].length - 1
  const cols = 'c'.repeat(n) + '|c'
  const body = M.map((r, i) =>
    r
      .map((v, j) => {
        let s = texNum(v, d)
        if (opts.box && opts.box[0] === i && opts.box[1] === j) s = `\\boxed{${s}}`
        if (opts.hl?.includes(i)) s = `\\color{#14b8a6}{${s}}`
        return s
      })
      .join(' & '),
  ).join(' \\\\ ')
  return `\\left[\\begin{array}{${cols}}${body}\\end{array}\\right]`
}

/** Matriz en TeX con cifras configurables. */
export function texM(M: Mat | Vec, d?: number): string {
  const rows = Array.isArray(M[0]) ? (M as Mat) : (M as Vec).map((x) => [x])
  return '\\begin{bmatrix}' + rows.map((r) => r.map((x) => texNum(x, d)).join(' & ')).join(' \\\\ ') + '\\end{bmatrix}'
}

/** Vector fila en TeX: (v₁, v₂, …)ᵀ */
export const texVecT = (v: Vec, d?: number) => `(${v.map((x) => texNum(x, d)).join(',\\;')})^T`

/** Vector en texto plano compacto para Stats. */
export const vecText = (v: Vec, d = 6): string => (v.length > 5 ? `(${v.slice(0, 4).map((x) => fmt(x, d)).join(', ')}, …)` : `(${v.map((x) => fmt(x, d)).join(', ')})`)

/** Σ p·q en TeX con números: "a − (p₁)(q₁) − (p₂)(q₂)" */
export function texMinusTerms(a: number, terms: [number, number][], d?: number): string {
  return N(a, d) + terms.map(([p, q]) => ` - ${P(p, d)}\\cdot ${P(q, d)}`).join('')
}

/* ─────────── Scilab ─────────── */
const sn = (x: number) => (Number.isInteger(x) ? String(x) : String(+x.toPrecision(15)))
export const sciMat = (A: Mat) => '[' + A.map((r) => r.map(sn).join(' ')).join('; ') + ']'
export const sciVec = (b: Vec) => '[' + b.map(sn).join('; ') + ']'
export const sciRow = (b: Vec) => '[' + b.map(sn).join(' ') + ']'

/**
 * Definición Scilab de fl(x): redondeo a t cifras significativas (como fl() de algorithms.ts). El paso
 * round(r*1e6)/1e6 elimina el ruido binario (p. ej. 0.13365/1e-4 = 1336.4999…) antes de redondear.
 */
export const sciFl = (t: number) => `t = ${t};              // cifras de la mantisa
// fl(x): redondeo a t cifras significativas (elemento a elemento)
function y = fl(x)
  y = x;
  nz = find(x <> 0);
  e = floor(log10(abs(x(nz)))) - t + 1;
  r = x(nz) ./ 10 .^ e;
  r = round(r * 1e6) / 1e6;
  y(nz) = round(r) .* 10 .^ e;
endfunction
`

/** Nota pequeña bajo una gráfica o tabla. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
      {children}
    </p>
  )
}

/** Conteo de filas en texto: "F₂ ← F₂ − m F₁" */
export const sub = (i: number) => String(i + 1)
