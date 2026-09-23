// "Máquina de palabras de n bits" del texto de la materia (Dr. Hugo Rojas, Cap. 1):
//   1 bit de signo · w bits de exponente · m bits de mantisa (el 1 entero NO se almacena).
// Modo 'ieee' aplica las reglas de IEEE 754 (sesgo 2^(w−1)−1, subnormales, ±∞, empate a par).
// Las convenciones alternativas del texto: exponente con signo o con bias 2^(w−1) / 2^(w−1) − 1,
// sin subnormales ni ∞, y redondeo que mira sólo el bit m+1 ("si es 1 se suma una unidad").
// Todo se calcula EXACTO con racionales BigInt.

import { reduce, type Rational } from './float.ts'

/** 'ieee': sesgo 2^(w−1)−1, exponente todo 0 ⇒ cero/subnormal, todo 1 ⇒ ∞/NaN (IEEE 754). */
export type ExpMode = 'ieee' | 'signo' | 'bias-peq' | 'bias-gra'
/** 'par': al más cercano, empate a par (IEEE 754). 'redondeo': mira sólo el bit m+1 (texto). */
export type RoundMode = 'par' | 'redondeo' | 'truncado'

export interface Machine {
  /** bits de exponente (incluye el bit de signo del exponente en modo 'signo') */
  w: number
  /** bits de mantisa almacenados */
  m: number
  expMode: ExpMode
  round: RoundMode
}

export const TEXTO_16: Machine = { w: 7, m: 8, expMode: 'ieee', round: 'par' }

export function totalBits(M: Machine) {
  return 1 + M.w + M.m
}

export function bias(M: Machine): number | null {
  if (M.expMode === 'bias-peq') return 2 ** (M.w - 1)
  if (M.expMode === 'bias-gra' || M.expMode === 'ieee') return 2 ** (M.w - 1) - 1
  return null
}

export function expRange(M: Machine): { emin: number; emax: number } {
  const b = bias(M)
  if (b === null) {
    const mx = 2 ** (M.w - 1) - 1
    return { emin: -mx, emax: mx }
  }
  // IEEE: E = 0 y E = 2^w − 1 están reservados
  if (M.expMode === 'ieee') return { emin: 1 - b, emax: 2 ** M.w - 2 - b }
  return { emin: -b, emax: 2 ** M.w - 1 - b }
}

export function encodeExp(e: number, M: Machine): string {
  const b = bias(M)
  if (b === null) return (e < 0 ? '1' : '0') + Math.abs(e).toString(2).padStart(M.w - 1, '0')
  return (e + b).toString(2).padStart(M.w, '0')
}

export function decodeExp(bits: string, M: Machine): number {
  const b = bias(M)
  if (b === null) return (bits[0] === '1' ? -1 : 1) * parseInt(bits.slice(1), 2)
  return parseInt(bits, 2) - b
}

const babs = (a: bigint) => (a < 0n ? -a : a)
const pow2 = (k: number): Rational => (k >= 0 ? { num: 1n << BigInt(k), den: 1n } : { num: 1n, den: 1n << BigInt(-k) })
export const mul = (a: Rational, b: Rational): Rational => reduce({ num: a.num * b.num, den: a.den * b.den })
export const add = (a: Rational, b: Rational): Rational => reduce({ num: a.num * b.den + b.num * a.den, den: a.den * b.den })
export const neg = (a: Rational): Rational => ({ num: -a.num, den: a.den })
export const div = (a: Rational, b: Rational): Rational => reduce({ num: a.num * b.den, den: a.den * b.num })

/** Valor ±N·2^(e−m) como racional. */
function value(sign: 0 | 1, N: bigint, e: number, m: number): Rational {
  const r = mul({ num: N, den: 1n }, pow2(e - m))
  return sign ? neg(r) : r
}

/** e = ⌊log₂(a/den)⌋ exacto. */
function floorLog2(a: bigint, den: bigint): number {
  let e = a.toString(2).length - den.toString(2).length
  const ge = (k: number) => (k >= 0 ? a >= den << BigInt(k) : a << BigInt(-k) >= den)
  while (!ge(e)) e--
  while (ge(e + 1)) e++
  return e
}

export interface Stored {
  sign: 0 | 1
  zero: boolean
  /** exponente de la forma normalizada 1.b₁b₂… × 2^e (antes de redondear) */
  e0: number
  /** primeros bits después del punto (m + 6) de la mantisa exacta */
  mantBits: string
  /** true si la mantisa exacta tiene más bits (no nulos) de los mostrados */
  moreBits: boolean
  /** bit m+1 (el que decide el redondeo) */
  guard: 0 | 1
  /** hay algún 1 después del bit m+1 */
  sticky: boolean
  /** IEEE: número subnormal (0.f × 2^emin) */
  subnormal: boolean
  /** IEEE: desborda a ±∞ */
  infinite: boolean
  /** mantisa exacta cabe en m bits */
  exact: boolean
  /** mantisa truncada / almacenada (incluye el 1 implícito): N ∈ [2^m, 2^(m+1)) */
  Ntrunc: bigint
  N: bigint
  roundedUp: boolean
  /** el redondeo produjo acarreo 1.111…1 + 1 = 10.000… ⇒ exponente + 1 */
  carry: boolean
  /** exponente final */
  e: number
  overflow: boolean
  underflow: boolean
  expBits: string
  manBits: string
  bits: string
  value: Rational
  /** números de máquina vecinos: el mayor ≤ x y el menor ≥ x (iguales si x es representable) */
  below: Rational | null
  above: Rational | null
}

/** Almacena el racional r en la máquina M. */
export function store(r: Rational, M: Machine): Stored {
  const sign: 0 | 1 = r.num < 0n ? 1 : 0
  const a = babs(r.num)
  const den = r.den
  const { emin, emax } = expRange(M)
  const zeroBits = '0'.repeat(totalBits(M))
  const base = { sign, e0: 0, mantBits: '', moreBits: false, guard: 0 as 0 | 1, sticky: false, subnormal: false, infinite: false, exact: true, Ntrunc: 0n, N: 0n, roundedUp: false, carry: false, e: 0, overflow: false, underflow: false, expBits: '0'.repeat(M.w), manBits: '0'.repeat(M.m), bits: zeroBits, value: { num: 0n, den: 1n }, below: null, above: null }
  if (a === 0n) return { ...base, zero: true }
  const e0 = floorLog2(a, den)
  // IEEE subnormal: se fija el exponente en emin y se pierde el 1 implícito
  const subnormal = M.expMode === 'ieee' && e0 < emin
  const eUse = subnormal ? emin : e0
  // a/den · 2^(m+6−eUse) = [1] b₁ … b_{m+6}.resto
  const extra = 6
  const sh = M.m + extra - eUse
  const numS = sh >= 0 ? a << BigInt(sh) : a
  const denS = sh >= 0 ? den : den << BigInt(-sh)
  const big = numS / denS
  const moreBits = numS % denS !== 0n
  const mantBits = subnormal ? big.toString(2).padStart(M.m + extra, '0') : big.toString(2).slice(1) // quitar el 1 entero
  const Ntrunc = big >> BigInt(extra)
  const guard: 0 | 1 = mantBits[M.m] === '1' ? 1 : 0
  const sticky = moreBits || /1/.test(mantBits.slice(M.m + 1))
  const exact = !guard && !sticky
  let N = Ntrunc
  let roundedUp = false
  const up = M.round === 'redondeo' ? guard === 1 : M.round === 'par' ? guard === 1 && (sticky || (Ntrunc & 1n) === 1n) : false
  if (up) {
    N += 1n
    roundedUp = true
  }
  let e = eUse
  let carry = false
  if (!subnormal && N === 1n << BigInt(M.m + 1)) {
    N >>= 1n
    e += 1
    carry = true
  }
  const becameNormal = subnormal && N === 1n << BigInt(M.m)
  // vecinos (en magnitud): truncado y truncado + 1 ulp
  const nb = (n: bigint, ee: number): Rational | null => {
    if (subnormal) return n > 1n << BigInt(M.m) ? null : value(sign, n, emin, M.m)
    let NN = n, E = ee
    if (NN === 1n << BigInt(M.m + 1)) {
      NN >>= 1n
      E++
    }
    if (NN < 1n << BigInt(M.m)) {
      NN = (1n << BigInt(M.m + 1)) - 1n
      E--
    }
    if (E > emax || E < emin) return null
    return value(sign, NN, E, M.m)
  }
  const loMag = exact ? value(sign, Ntrunc, eUse, M.m) : nb(Ntrunc, eUse)
  const hiMag = exact ? value(sign, Ntrunc, eUse, M.m) : nb(Ntrunc + 1n, eUse)
  const [below, above] = sign ? [hiMag, loMag] : [loMag, hiMag]

  const common = { sign, zero: false, e0, mantBits, moreBits, guard, sticky, subnormal: subnormal && !becameNormal, exact, Ntrunc, N, roundedUp, carry: carry || becameNormal, e, below, above }
  if (e > emax) {
    if (M.expMode === 'ieee') {
      const expBits = '1'.repeat(M.w)
      return { ...base, ...common, overflow: true, infinite: true, expBits, manBits: '0'.repeat(M.m), bits: String(sign) + expBits + '0'.repeat(M.m), value: { num: 0n, den: 1n } }
    }
    return { ...base, ...common, overflow: true }
  }
  if (subnormal) {
    if (N === 0n) return { ...base, ...common, underflow: true, bits: String(sign) + zeroBits.slice(1) }
    const expBits = becameNormal ? encodeExp(emin, M) : '0'.repeat(M.w)
    const manBits = (becameNormal ? 0n : N).toString(2).padStart(M.m, '0')
    return { ...base, ...common, expBits, manBits, bits: String(sign) + expBits + manBits, value: value(sign, N, emin, M.m) }
  }
  if (e < emin) return { ...base, ...common, underflow: true }
  const expBits = encodeExp(e, M)
  const manBits = (N - (1n << BigInt(M.m))).toString(2).padStart(M.m, '0')
  return { ...base, ...common, expBits, manBits, bits: String(sign) + expBits + manBits, value: value(sign, N, e, M.m) }
}

export interface Decoded {
  kind: 'normal' | 'subnormal' | 'cero' | 'infinito' | 'NaN'
  sign: 0 | 1
  expBits: string
  manBits: string
  e: number
  zero: boolean
  value: Rational
}

/** Lee una palabra de bits (con la convención de que todos los bits 0 ⇒ cero). */
export function decode(bits: string, M: Machine): Decoded {
  const sign: 0 | 1 = bits[0] === '1' ? 1 : 0
  const expBits = bits.slice(1, 1 + M.w)
  const manBits = bits.slice(1 + M.w)
  const e = decodeExp(expBits, M)
  const f = BigInt('0b' + (manBits || '0'))
  if (M.expMode === 'ieee') {
    const { emin } = expRange(M)
    if (/^1+$/.test(expBits)) return { kind: f ? 'NaN' : 'infinito', sign, expBits, manBits, e, zero: false, value: { num: 0n, den: 1n } }
    if (/^0+$/.test(expBits)) {
      if (!f) return { kind: 'cero', sign, expBits, manBits, e: emin, zero: true, value: { num: 0n, den: 1n } }
      return { kind: 'subnormal', sign, expBits, manBits, e: emin, zero: false, value: value(sign, f, emin, M.m) }
    }
  }
  const zero = /^0+$/.test(bits.slice(1))
  const N = (1n << BigInt(M.m)) + f
  return { kind: zero ? 'cero' : 'normal', sign, expBits, manBits, e, zero, value: zero ? { num: 0n, den: 1n } : value(sign, N, e, M.m) }
}

export interface Props {
  emin: number
  emax: number
  xmax: Rational
  xmin: Rational
  delta: Rational
  /** menor subnormal (sólo IEEE) */
  minSub: Rational | null
  /** cantidad de números representables (± mantisas × exponentes, más el cero) */
  count: bigint
}

export function props(M: Machine): Props {
  const { emin, emax } = expRange(M)
  const xmax = mul({ num: (1n << BigInt(M.m + 1)) - 1n, den: 1n }, pow2(emax - M.m))
  const xmin = pow2(emin)
  const delta = pow2(M.round === 'truncado' ? -M.m : -(M.m + 1))
  const ieee = M.expMode === 'ieee'
  const count = 2n * (1n << BigInt(M.m)) * BigInt(emax - emin + 1) + 1n + (ieee ? 2n * ((1n << BigInt(M.m)) - 1n) : 0n)
  return { emin, emax, xmax, xmin, delta, count, minSub: ieee ? pow2(emin - M.m) : null }
}

export function ratToNum(r: Rational): number {
  const n = Number(r.num), d = Number(r.den)
  if (Number.isFinite(n) && Number.isFinite(d)) return n / d
  // números con muchas cifras: escalar
  const s = r.den.toString().length - 15
  return s > 0 ? Number(r.num) / Number(r.den / 10n ** BigInt(s)) / 10 ** s : NaN
}
