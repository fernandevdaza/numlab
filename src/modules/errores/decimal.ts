// "Computadora decimal a 7 dits" del texto de la materia (Dr. Hugo Rojas, Cap. 1.5):
//   2 dits de signos (número y exponente) · k dits de exponente · t dits de mantisa
//   x_A = ±0.d₁d₂…d_t × 10^(±e),  d₁ ≠ 0,  0 ≤ e ≤ 10^k − 1
// Cada operación se hace con los valores almacenados y su resultado se vuelve a almacenar.
// La aritmética "exacta" usa BigNumber de 64 dígitos (decimal.js), así 26.075 es exactamente 26.075.

import { create, all, type MathNode } from 'mathjs'
import { normalize } from '../../lib/expr.ts'
import { L } from '../../i18n.ts'

export const dm = create(all, { number: 'BigNumber', precision: 64 })
export type D = any // Decimal de decimal.js

export type DitRound = 'redondeo' | 'truncado'
/**
 * Normalización de la mantisa:
 *  '0.d'  → 0.d₁d₂…d_t × 10^e      (texto: el punto va ANTES del primer dígito no nulo; t cifras)
 *  'd.d'  → d₁.d₂…d_t × 10^e       (punto DESPUÉS del primer dígito no nulo; t cifras en total)
 *  'd.d+' → d₀.d₁d₂…d_t × 10^e     (punto después del primer dígito; t dits DESPUÉS del punto ⇒ t+1 cifras)
 */
export type DitNorm = '0.d' | 'd.d' | 'd.d+'

export interface DitMachine {
  /** dits de mantisa */
  t: number
  /** dits de exponente */
  k: number
  round: DitRound
  norm?: DitNorm
}

export const TEXTO_7: DitMachine = { t: 4, k: 1, round: 'redondeo', norm: '0.d' }

/** cifras significativas que guarda la mantisa */
export const sigOf = (M: DitMachine) => ((M.norm ?? '0.d') === 'd.d+' ? M.t + 1 : M.t)
export const totalDits = (M: DitMachine) => 2 + M.k + sigOf(M)
export const maxExp = (M: DitMachine) => 10 ** M.k - 1

export interface StoredD {
  value: D
  status: 'ok' | 'cero' | 'overflow' | 'underflow'
  /** exponente de la forma normalizada (0.d… o d.d…) */
  E: number
  /** dígitos significativos de la mantisa */
  digits: string
  neg: boolean
  norm: DitNorm
}

const ROUND_HALF_UP = 4
const ROUND_DOWN = 1

/** Almacena un valor en la máquina decimal. */
export function storeD(v: D, M: DitMachine): StoredD {
  const zero = dm.bignumber(0)
  const norm = M.norm ?? '0.d'
  const sig = sigOf(M)
  if (v.isZero()) return { value: zero, status: 'cero', E: 0, digits: '0'.repeat(sig), neg: false, norm }
  const r = v.toSignificantDigits(sig, M.round === 'redondeo' ? ROUND_HALF_UP : ROUND_DOWN)
  // decimal.js: r = d.ddd × 10^r.e  ⇒  0.dddd × 10^(r.e + 1)
  const E = norm === '0.d' ? r.e + 1 : r.e
  const neg = r.isNegative()
  const digits = r.abs().times(dm.bignumber(10).pow(-r.e)).toFixed(sig - 1).replace('.', '')
  const mx = maxExp(M)
  if (E > mx) return { value: r, status: 'overflow', E, digits, neg, norm }
  if (E < -mx) return { value: zero, status: 'underflow', E, digits, neg, norm }
  return { value: r, status: 'ok', E, digits, neg, norm }
}

/** Mantisa escrita según la normalización: 0.dddd o d.ddd */
export function mantStr(s: StoredD): string {
  return s.norm === '0.d' ? '0.' + s.digits : s.digits[0] + '.' + s.digits.slice(1)
}
/** Texto 0.dddd×10^E  /  d.ddd×10^E */
export function texStored(s: StoredD): string {
  if (s.status === 'cero') return '0'
  return `${s.neg ? '-' : ''}${mantStr(s)}\\times 10^{${s.E}}`
}
export function plainStored(s: StoredD): string {
  if (s.status === 'cero') return '0'
  const sup = (n: number) => String(n).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c])
  return `${s.neg ? '−' : ''}${mantStr(s)} × 10${sup(s.E)}`
}

export interface TraceRow {
  /** subexpresión en TeX */
  tex: string
  kind: 'dato' | 'operación'
  /** resultado exacto con los operandos almacenados */
  exact: D
  stored: StoredD
}

export class MachineError extends Error {
  trace: TraceRow[]
  constructor(msg: string, trace: TraceRow[]) {
    super(msg)
    this.trace = trace
  }
}

const FUNS: Record<string, (x: D) => D> = {
  sqrt: (x) => x.sqrt(),
  exp: (x) => x.exp(),
  log: (x) => x.ln(),
  ln: (x) => x.ln(),
  log10: (x) => x.log(10),
  sin: (x) => x.sin(),
  cos: (x) => x.cos(),
  tan: (x) => x.tan(),
  abs: (x) => x.abs(),
  atan: (x) => x.atan(),
  asin: (x) => x.asin(),
  acos: (x) => x.acos(),
}

/** Modo de evaluación: 'maquina' almacena todo; 'datos' almacena sólo los datos; 'exacto' nada. */
export type EvalMode = 'maquina' | 'datos' | 'exacto'

/** TeX limpio de un nodo (mathjs pone \\mathrm{b} a letras que confunde con unidades). */
export function cleanTex(t: string): string {
  return t.replace(/\\mathrm\{([A-Za-z])\}/g, '{$1}').replace(/\{\s+/g, '{').replace(/^\s+/, '').replace(/\\mathrm\{log\}/g, '\\ln')
}

export function parseExpr(src: string): MathNode {
  return dm.parse(normalize(src))
}

/**
 * Evalúa el árbol con los valores de las variables. En modo 'maquina' devuelve también la traza de
 * cada almacenamiento. Lanza MachineError si hay overflow.
 */
export function evalD(node: MathNode, vars: Record<string, D>, M: DitMachine, mode: EvalMode): { value: D; trace: TraceRow[] } {
  const trace: TraceRow[] = []
  const stored = new Map<string, D>()
  const put = (tex: string, kind: TraceRow['kind'], v: D): D => {
    if (mode === 'exacto' || (mode === 'datos' && kind === 'operación')) return v
    const s = storeD(v, M)
    if (mode === 'maquina') trace.push({ tex, kind, exact: v, stored: s })
    if (s.status === 'overflow') throw new MachineError(L(`Overflow al almacenar ${tex}: el exponente ${s.E} supera ${maxExp(M)}.`, `Overflow when storing ${tex}: the exponent ${s.E} exceeds ${maxExp(M)}.`), trace)
    return s.value
  }
  const ev = (n: any): D => {
    switch (n.type) {
      case 'ParenthesisNode':
        return ev(n.content)
      case 'ConstantNode': {
        const v = dm.bignumber(n.value)
        const key = 'c:' + String(n.value)
        // las constantes que se almacenan sin cambio (2, 4, 0.5…) no se muestran en la traza
        if (!stored.has(key)) stored.set(key, storeD(v, M).value.eq(v) && mode !== 'exacto' ? v : put(String(n.value), 'dato', v))
        return stored.get(key)
      }
      case 'SymbolNode': {
        const name = n.name as string
        let v: D
        if (name in vars) v = vars[name]
        else if (name === 'pi') v = dm.pi
        else if (name === 'e') v = dm.e
        else throw new Error(L(`Variable sin valor: ${name}`, `Variable has no value: ${name}`))
        const key = 's:' + name
        if (!stored.has(key)) stored.set(key, put(name === 'pi' ? '\\pi' : name, 'dato', v))
        return stored.get(key)
      }
      case 'OperatorNode': {
        const args = n.args.map(ev)
        const tex = cleanTex(n.toTex({ parenthesis: 'auto' }))
        switch (n.fn) {
          case 'unaryMinus':
            return args[0].neg()
          case 'unaryPlus':
            return args[0]
          case 'add':
            return put(tex, 'operación', args[0].plus(args[1]))
          case 'subtract':
            return put(tex, 'operación', args[0].minus(args[1]))
          case 'multiply':
            return put(tex, 'operación', args[0].times(args[1]))
          case 'divide':
            if (args[1].isZero()) throw new MachineError(L(`División entre cero en ${tex}.`, `Division by zero in ${tex}.`), trace)
            return put(tex, 'operación', args[0].div(args[1]))
          case 'pow':
            return put(tex, 'operación', args[0].pow(args[1]))
        }
        throw new Error(L('Operador no soportado: ', 'Unsupported operator: ') + n.op)
      }
      case 'FunctionNode': {
        const name = n.fn.name as string
        const f = FUNS[name]
        if (!f) throw new Error(L('Función no soportada: ', 'Unsupported function: ') + name)
        const a = ev(n.args[0])
        if ((name === 'sqrt' || name === 'log' || name === 'ln') && a.isNegative()) throw new MachineError(L(`${name} de un número negativo en ${n.toTex()}.`, `${name} of a negative number in ${n.toTex()}.`), trace)
        return put(cleanTex(n.toTex({ parenthesis: 'auto' })), 'operación', f(a))
      }
    }
    throw new Error(L('Expresión no soportada: ', 'Unsupported expression: ') + n.type)
  }
  const value = ev(node)
  return { value, trace }
}

/** Cifras significativas según el texto: mayor m ≥ 0 con Er ≤ 5·10^−(m+1). */
export function sigTexto(rel: number): number {
  if (!Number.isFinite(rel)) return 0
  if (rel === 0) return Infinity
  return Math.max(0, Math.floor(Math.log10(5 / rel) + 1e-12) - 1)
}
