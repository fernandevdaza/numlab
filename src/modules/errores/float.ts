// Algoritmos puros sobre representación en punto flotante (IEEE 754 y sistemas F(β,t,L,U)).
// Todo lo "exacto" se hace con BigInt para no depender del propio punto flotante.
import { L } from '../../i18n.ts'

export type Prec = 16 | 32 | 64

export interface FormatInfo {
  bits: number
  /** bits de exponente */
  w: number
  /** bits de mantisa (fracción) */
  m: number
  bias: number
  name: string
}

export const FORMATS: Record<Prec, FormatInfo> = {
  16: { bits: 16, w: 5, m: 10, bias: 15, name: L('media (binary16)', 'half (binary16)') },
  32: { bits: 32, w: 8, m: 23, bias: 127, name: L('simple (binary32)', 'single (binary32)') },
  64: { bits: 64, w: 11, m: 52, bias: 1023, name: L('doble (binary64)', 'double (binary64)') },
}

/** Redondea al formato indicado (float32 usa Math.fround; float16 se codifica exactamente con BigInt). */
export const roundP = (x: number, p: Prec) => (p === 32 ? Math.fround(x) : p === 16 ? f16round(x) : x)

/** Bits de x redondeado a binary16 (al más cercano, empate a par). */
function f16Bits(x: number): string {
  if (Number.isNaN(x)) return '0111111000000000'
  const sign = x < 0 || Object.is(x, -0) ? '1' : '0'
  if (!Number.isFinite(x)) return sign + '111110000000000'
  if (x === 0) return sign + '0'.repeat(15)
  const { num, k } = exactRational(x)
  return encodeIeee({ num, den: 1n << BigInt(k) }, 16).bits
}
function f16FromBits(bits: string): number {
  const sign = bits[0] === '1' ? -1 : 1
  const E = parseInt(bits.slice(1, 6), 2)
  const M = parseInt(bits.slice(6), 2)
  if (E === 31) return M ? NaN : sign * Infinity
  if (E === 0) return sign * M * 2 ** -24
  return sign * (1 + M / 1024) * 2 ** (E - 15)
}
export function f16round(x: number): number {
  return f16FromBits(f16Bits(x))
}

/* ───────────────────────── Bits ───────────────────────── */

/** Cadena de '0'/'1' con todos los bits del número en el formato dado (big-endian). */
export function toBits(x: number, p: Prec): string {
  if (p === 16) return f16Bits(x)
  if (p === 32) {
    const b = new DataView(new ArrayBuffer(4))
    b.setFloat32(0, x)
    return b.getUint32(0).toString(2).padStart(32, '0')
  }
  const b = new DataView(new ArrayBuffer(8))
  b.setFloat64(0, x)
  return b.getBigUint64(0).toString(2).padStart(64, '0')
}

export function fromBits(bits: string, p: Prec): number {
  if (p === 16) return f16FromBits(bits)
  if (p === 32) {
    const b = new DataView(new ArrayBuffer(4))
    b.setUint32(0, parseInt(bits, 2) >>> 0)
    return b.getFloat32(0)
  }
  const b = new DataView(new ArrayBuffer(8))
  b.setBigUint64(0, BigInt('0b' + bits))
  return b.getFloat64(0)
}

export function bitsToHex(bits: string): string {
  let h = ''
  for (let i = 0; i < bits.length; i += 4) h += parseInt(bits.slice(i, i + 4), 2).toString(16).toUpperCase()
  return h
}

export type FloatKind = 'cero' | 'subnormal' | 'normal' | 'infinito' | 'NaN'

export interface Decomposed {
  bits: string
  sign: 0 | 1
  expBits: string
  manBits: string
  /** exponente almacenado (sesgado) */
  E: number
  /** exponente real (sin sesgo) */
  e: number
  kind: FloatKind
  hex: string
  /** entero de la fracción (m bits) */
  frac: bigint
  /** 1.f (normal) o 0.f (subnormal) como número */
  significand: number
}

export function decompose(x: number, p: Prec): Decomposed {
  const F = FORMATS[p]
  const bits = toBits(x, p)
  const sign = bits[0] === '1' ? 1 : 0
  const expBits = bits.slice(1, 1 + F.w)
  const manBits = bits.slice(1 + F.w)
  const E = parseInt(expBits, 2)
  const frac = BigInt('0b' + manBits)
  const allOnes = E === 2 ** F.w - 1
  let kind: FloatKind
  if (allOnes) kind = frac === 0n ? 'infinito' : 'NaN'
  else if (E === 0) kind = frac === 0n ? 'cero' : 'subnormal'
  else kind = 'normal'
  const e = E === 0 ? 1 - F.bias : E - F.bias
  const fnum = Number(frac) / 2 ** F.m
  return { bits, sign, expBits, manBits, E, e, kind, hex: bitsToHex(bits), frac, significand: kind === 'normal' ? 1 + fnum : fnum }
}

/* ───────────────────────── Valor exacto ───────────────────────── */

/** x = num / 2^k exactamente (x finito). */
export function exactRational(x: number): { num: bigint; k: number } {
  if (x === 0) return { num: 0n, k: 0 }
  const d = decompose(x, 64)
  let M = d.kind === 'normal' ? d.frac | (1n << 52n) : d.frac
  let e2 = d.e - 52 // x = M·2^e2
  if (d.sign) M = -M
  if (e2 >= 0) return { num: M << BigInt(e2), k: 0 }
  // simplificar potencias de 2
  let k = -e2
  while (k > 0 && (M & 1n) === 0n) {
    M >>= 1n
    k--
  }
  return { num: M, k }
}

/** Expansión decimal EXACTA del double x (siempre finita porque el denominador es 2^k). */
export function exactDecimal(x: number): string {
  if (Number.isNaN(x)) return 'NaN'
  if (!Number.isFinite(x)) return x > 0 ? 'Infinity' : '-Infinity'
  if (x === 0) return Object.is(x, -0) ? '-0' : '0'
  const { num, k } = exactRational(x)
  const neg = num < 0n
  const a = neg ? -num : num
  if (k === 0) return (neg ? '-' : '') + a.toString()
  // a / 2^k = a·5^k / 10^k
  const digits = (a * 5n ** BigInt(k)).toString().padStart(k + 1, '0')
  const ip = digits.slice(0, digits.length - k)
  const fp = digits.slice(digits.length - k).replace(/0+$/, '')
  return (neg ? '-' : '') + ip + (fp ? '.' + fp : '')
}

/** Cantidad de cifras significativas de la expansión exacta. */
export function countSigDigits(dec: string): number {
  const s = dec.replace('-', '').replace('.', '').replace(/^0+/, '')
  return s.length
}

/* ───────────────────────── Vecinos, ulp ───────────────────────── */

export function nextUp(x: number, p: Prec): number {
  if (Number.isNaN(x) || x === Infinity) return x
  if (x === 0) return fromBits('0'.repeat(FORMATS[p].bits - 1) + '1', p)
  const bits = toBits(x, p)
  const n = p !== 64 ? BigInt(parseInt(bits, 2)) : BigInt('0b' + bits)
  const nn = x > 0 ? n + 1n : n - 1n
  return fromBits(nn.toString(2).padStart(FORMATS[p].bits, '0'), p)
}
export function nextDown(x: number, p: Prec): number {
  return -nextUp(-x, p)
}
/** Distancia al siguiente float hacia +∞ (para |x|). */
export function ulp(x: number, p: Prec): number {
  const a = Math.abs(x)
  if (!Number.isFinite(a)) return NaN
  const u = nextUp(a, p)
  return u === Infinity ? a - nextDown(a, p) : u - a
}

export const EPS: Record<Prec, number> = { 16: 2 ** -10, 32: 2 ** -23, 64: 2 ** -52 }
export const LIMITS: Record<Prec, { minSub: number; minNormal: number; max: number }> = {
  16: { minSub: 2 ** -24, minNormal: 2 ** -14, max: 65504 },
  32: { minSub: 2 ** -149, minNormal: 2 ** -126, max: (2 - 2 ** -23) * 2 ** 127 },
  64: { minSub: 2 ** -1074, minNormal: 2 ** -1022, max: Number.MAX_VALUE },
}

/** Representación decimal más corta que, redondeada al formato, vuelve a dar x. */
export function shortest(x: number, p: Prec): string {
  if (Number.isNaN(x)) return 'NaN'
  if (!Number.isFinite(x)) return x > 0 ? 'Infinity' : '-Infinity'
  if (x === 0) return Object.is(x, -0) ? '-0' : '0'
  if (p === 64) return String(x)
  for (let k = 1; k <= 9; k++) {
    const s = x.toPrecision(k)
    if (roundP(Number(s), p) === x) return String(Number(s))
  }
  return String(x)
}

/* ───────────────────────── Racionales y cambio de base ───────────────────────── */

export interface Rational {
  num: bigint
  den: bigint
}

const babs = (a: bigint) => (a < 0n ? -a : a)
export function gcd(a: bigint, b: bigint): bigint {
  a = babs(a)
  b = babs(b)
  while (b) [a, b] = [b, a % b]
  return a
}
export function reduce(r: Rational): Rational {
  if (r.den < 0n) r = { num: -r.num, den: -r.den }
  const g = gcd(r.num, r.den) || 1n
  return { num: r.num / g, den: r.den / g }
}

/** Parsea un decimal ("-12.375", "1.5e-3") o una fracción ("1/3") de forma EXACTA. */
export function parseRational(src: string): Rational | null {
  const s = src.trim().replace(/\s+/g, '').replace(',', '.')
  let m = s.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/)
  if (m && (m[2] || m[3])) {
    const sign = m[1] === '-' ? -1n : 1n
    const ip = m[2] || '0'
    const fp = m[3] || ''
    const ex = Number(m[4] || 0)
    let num = BigInt(ip + fp) * sign
    let den = 10n ** BigInt(fp.length)
    if (ex > 0) num *= 10n ** BigInt(ex)
    if (ex < 0) den *= 10n ** BigInt(-ex)
    return reduce({ num, den })
  }
  m = s.match(/^([+-]?\d+)\/([+-]?\d+)$/)
  if (m && BigInt(m[2]) !== 0n) return reduce({ num: BigInt(m[1]), den: BigInt(m[2]) })
  return null
}

export function ratToNumber(r: Rational): number {
  // suficientemente preciso para mostrar
  const n = Number(r.num), d = Number(r.den)
  if (Number.isFinite(n) && Number.isFinite(d)) return n / d
  const s = r.num.toString().length - r.den.toString().length
  const sh = BigInt(Math.max(0, 20 - s))
  return Number((r.num * 10n ** sh) / r.den) / 10 ** Number(sh)
}

export function ratToTex(r: Rational): string {
  if (r.den === 1n) return r.num.toString()
  return (r.num < 0n ? '-' : '') + `\\frac{${babs(r.num)}}{${r.den}}`
}

export const DIGITS = '0123456789ABCDEF'

export interface IntStep {
  n: bigint
  q: bigint
  r: number
}
export interface FracStep {
  /** fracción actual (num/den) */
  num: bigint
  den: bigint
  /** producto por β (num·β/den) */
  prodNum: bigint
  digit: number
}
export interface BaseConversion {
  neg: boolean
  intPart: bigint
  intSteps: IntStep[]
  intDigits: string
  fracSteps: FracStep[]
  fracDigits: string
  /** índice (en fracDigits) donde empieza el período, o -1 si termina/cortado */
  periodStart: number
  terminates: boolean
  truncated: boolean
}

/** Convierte un racional a base β: divisiones sucesivas (parte entera) y multiplicaciones sucesivas (parte fraccionaria). */
export function toBase(r: Rational, beta: number, maxFrac = 64): BaseConversion {
  const B = BigInt(beta)
  const neg = r.num < 0n
  const a = babs(r.num)
  const den = r.den
  const intPart = a / den
  let rem = a % den
  const intSteps: IntStep[] = []
  let n = intPart
  if (n === 0n) intSteps.push({ n: 0n, q: 0n, r: 0 })
  while (n > 0n) {
    intSteps.push({ n, q: n / B, r: Number(n % B) })
    n = n / B
  }
  const intDigits = intSteps.map((s) => DIGITS[s.r]).reverse().join('')
  const fracSteps: FracStep[] = []
  const seen = new Map<string, number>()
  let periodStart = -1
  let truncated = false
  while (rem !== 0n) {
    const key = rem.toString()
    if (seen.has(key)) {
      periodStart = seen.get(key)!
      break
    }
    if (fracSteps.length >= maxFrac) {
      truncated = true
      break
    }
    seen.set(key, fracSteps.length)
    const prod = rem * B
    const digit = Number(prod / den)
    fracSteps.push({ num: rem, den, prodNum: prod, digit })
    rem = prod % den
  }
  return {
    neg,
    intPart,
    intSteps,
    intDigits,
    fracSteps,
    fracDigits: fracSteps.map((s) => DIGITS[s.digit]).join(''),
    periodStart,
    terminates: rem === 0n,
    truncated,
  }
}

/** TeX del número en base β con período sobrerrayado. */
export function baseTex(c: BaseConversion, beta: number): string {
  let f = c.fracDigits
  if (c.periodStart >= 0) f = f.slice(0, c.periodStart) + '\\overline{' + f.slice(c.periodStart) + '}'
  else if (c.truncated) f += '\\ldots'
  return `${c.neg ? '-' : ''}(${c.intDigits}${f ? '.' + f : ''})_{${beta}}`
}

/** Parsea un número escrito en base β ("1011.011", "-A.8") como racional exacto. */
export function parseInBase(src: string, beta: number): Rational | null {
  const s = src.trim().toUpperCase().replace(/\s+/g, '').replace(',', '.')
  const m = s.match(/^([+-]?)([0-9A-F]*)(?:\.([0-9A-F]*))?$/)
  if (!m || !(m[2] || m[3])) return null
  const all = (m[2] || '') + (m[3] || '')
  if ([...all].some((ch) => DIGITS.indexOf(ch) >= beta)) return null
  const B = BigInt(beta)
  let num = 0n
  for (const ch of all) num = num * B + BigInt(DIGITS.indexOf(ch))
  const den = B ** BigInt((m[3] || '').length)
  return reduce({ num: m[1] === '-' ? -num : num, den })
}

/** Decimal exacto (o con `maxDigits` decimales y "…") de un racional. */
export function ratToDecimal(r: Rational, maxDigits = 60): string {
  const neg = r.num < 0n
  const a = babs(r.num)
  const ip = a / r.den
  let rem = a % r.den
  let fp = ''
  while (rem !== 0n && fp.length < maxDigits) {
    rem *= 10n
    fp += (rem / r.den).toString()
    rem %= r.den
  }
  return (neg ? '-' : '') + ip.toString() + (fp ? '.' + fp : '') + (rem !== 0n ? '…' : '')
}

/* ───────────────────────── Codificación IEEE paso a paso (exacta) ───────────────────────── */

export interface IeeeEncoding {
  sign: 0 | 1
  /** exponente de la forma normalizada 1.xxx × 2^e (antes de ver si es subnormal) */
  e: number
  subnormal: boolean
  overflow: boolean
  underflowToZero: boolean
  /** bits tras el 1 implícito (m bits) antes de redondear */
  mantTrunc: string
  guard: 0 | 1
  sticky: boolean
  roundedUp: boolean
  carry: boolean
  /** resultado final */
  E: number
  mant: string
  bits: string
  value: number
}

function bitLength(n: bigint): number {
  return n === 0n ? 0 : n.toString(2).length
}

/** Codifica un racional en IEEE 754 con redondeo al más cercano (empate a par), exactamente. */
export function encodeIeee(r: Rational, p: Prec): IeeeEncoding {
  const F = FORMATS[p]
  const sign: 0 | 1 = r.num < 0n ? 1 : 0
  const a = babs(r.num)
  const den = r.den
  const zeroRes = (under: boolean): IeeeEncoding => {
    const bits = String(sign) + '0'.repeat(F.bits - 1)
    return { sign, e: 0, subnormal: false, overflow: false, underflowToZero: under, mantTrunc: '0'.repeat(F.m), guard: 0, sticky: false, roundedUp: false, carry: false, E: 0, mant: '0'.repeat(F.m), bits, value: fromBits(bits, p) }
  }
  if (a === 0n) return zeroRes(false)
  // e = floor(log2(a/den))
  let e = bitLength(a) - bitLength(den)
  // ajustar: 2^e <= a/den < 2^(e+1)
  const ge = (k: number) => (k >= 0 ? a >= den << BigInt(k) : a << BigInt(-k) >= den)
  while (!ge(e)) e--
  while (ge(e + 1)) e++
  const emin = 1 - F.bias
  const subnormal = e < emin
  const eUse = subnormal ? emin : e
  // N = floor(a/den · 2^(m - eUse)), resto
  const sh = F.m - eUse
  let numS = a, denS = den
  if (sh >= 0) numS = a << BigInt(sh)
  else denS = den << BigInt(-sh)
  let N = numS / denS
  const rem = numS % denS
  const twice = rem * 2n
  const guard: 0 | 1 = twice >= denS ? 1 : 0
  const sticky = guard ? twice !== denS : rem !== 0n
  const mantTrunc = (subnormal ? N : N - (1n << BigInt(F.m))).toString(2).padStart(F.m, '0')
  let roundedUp = false
  if (twice > denS || (twice === denS && (N & 1n) === 1n)) {
    N += 1n
    roundedUp = true
  }
  let E = subnormal ? 0 : e + F.bias
  let carry = false
  if (!subnormal && N === 1n << BigInt(F.m + 1)) {
    carry = true
    N >>= 1n
    E += 1
  }
  if (subnormal && N === 1n << BigInt(F.m)) {
    // pasó a ser normal mínimo
    E = 1
    N = N // el 1 implícito aparece
    carry = true
  }
  const overflow = E >= 2 ** F.w - 1
  if (overflow) {
    const bits = String(sign) + '1'.repeat(F.w) + '0'.repeat(F.m)
    return { sign, e, subnormal, overflow, underflowToZero: false, mantTrunc, guard, sticky, roundedUp, carry, E: 2 ** F.w - 1, mant: '0'.repeat(F.m), bits, value: fromBits(bits, p) }
  }
  const mantInt = E === 0 ? N : N - (1n << BigInt(F.m))
  const mant = mantInt.toString(2).padStart(F.m, '0').slice(-F.m)
  const bits = String(sign) + E.toString(2).padStart(F.w, '0') + mant
  const value = fromBits(bits, p)
  if (value === 0) return { ...zeroRes(true), e, subnormal: true, mantTrunc, guard, sticky }
  return { sign, e, subnormal, overflow, underflowToZero: false, mantTrunc, guard, sticky, roundedUp, carry, E, mant, bits, value }
}

/* ───────────────────────── Sistema F(β, t, L, U) ───────────────────────── */

export type Conv = '0.d' | 'd.d'

export interface ToySystem {
  beta: number
  t: number
  L: number
  U: number
  conv: Conv
  subnormals: boolean
}

export interface ToyInfo {
  count: number
  minPos: number
  max: number
  eps: number
  uRound: number
  uChop: number
  minSub: number | null
}

/** Valor de mantisa entera M (t dígitos) con exponente e. */
const toyVal = (S: ToySystem, M: number, e: number) => M * S.beta ** (e - S.t + (S.conv === 'd.d' ? 1 : 0))

export function toyInfo(S: ToySystem): ToyInfo {
  const { beta: b, t, L, U } = S
  const normals = 2 * (b - 1) * b ** (t - 1) * (U - L + 1)
  const subs = S.subnormals ? 2 * (b ** (t - 1) - 1) : 0
  const eps = b ** (1 - t)
  return {
    count: normals + subs + 1,
    minPos: toyVal(S, b ** (t - 1), L),
    max: toyVal(S, b ** t - 1, U),
    eps,
    uRound: eps / 2,
    uChop: eps,
    minSub: S.subnormals ? toyVal(S, 1, L) : null,
  }
}

/** Enumera los números positivos del sistema (incluye subnormales si corresponde). */
export function toyEnumerate(S: ToySystem, limit = 20000): { values: number[]; truncated: boolean; exps: number[] } {
  const values: number[] = []
  const exps: number[] = []
  const { beta: b, t } = S
  if (S.subnormals)
    for (let M = 1; M < b ** (t - 1); M++) {
      values.push(toyVal(S, M, S.L))
      exps.push(S.L - 1)
    }
  for (let e = S.L; e <= S.U; e++) {
    for (let M = b ** (t - 1); M < b ** t; M++) {
      if (values.length >= limit) return { values, exps, truncated: true }
      values.push(toyVal(S, M, e))
      exps.push(e)
    }
  }
  return { values, exps, truncated: false }
}

export interface ToyRound {
  x: number
  /** dígitos de |x| en base β a partir del primero no nulo (t + 4 dígitos) */
  digits: number[]
  e: number
  chop: number
  round: number
  chopDigits: number[]
  roundDigits: number[]
  roundE: number
  status: 'ok' | 'overflow' | 'underflow' | 'cero'
}

/** fl(x) por corte (chopping) y redondeo en el sistema. */
export function toyRound(S: ToySystem, x: number): ToyRound {
  const { beta: b, t } = S
  const off = S.conv === 'd.d' ? 1 : 0
  if (x === 0 || !Number.isFinite(x)) return { x, digits: [], e: 0, chop: 0, round: 0, chopDigits: [], roundDigits: [], roundE: 0, status: 'cero' }
  const ax = Math.abs(x)
  const sg = Math.sign(x)
  // exponente tal que la mantisa quede normalizada
  let e = Math.floor(Math.log(ax) / Math.log(b)) + 1 - off
  const mant = (ee: number) => ax / b ** (ee + off) // en [1/b, 1)
  while (mant(e) >= 1) e++
  while (mant(e) < 1 / b) e--
  // dígitos (con tolerancia relativa para evitar 299.999… en lugar de 300)
  const TOL = 1 + 1e-12
  const scaled = mant(e) * b ** t
  const big = Math.floor(mant(e) * b ** (t + 4) * TOL)
  const digits: number[] = []
  {
    let v = big
    for (let k = 0; k < t + 4; k++) {
      digits.unshift(v % b)
      v = Math.floor(v / b)
    }
  }
  let Mc = Math.floor(scaled * TOL)
  let Mr = Math.floor(scaled * TOL + 0.5)
  let eR = e
  if (Mr >= b ** t) {
    Mr = Mr / b
    eR = e + 1
  }
  if (Mc >= b ** t) Mc = b ** t - 1
  const toDigits = (M: number) => {
    const out: number[] = []
    let v = Math.round(M)
    for (let k = 0; k < t; k++) {
      out.unshift(v % b)
      v = Math.floor(v / b)
    }
    return out
  }
  let status: ToyRound['status'] = 'ok'
  if (e > S.U) status = 'overflow'
  else if (e < S.L) status = 'underflow'
  const chop = status === 'ok' ? sg * toyVal(S, Mc, e) : status === 'overflow' ? sg * Infinity : 0
  const round = status === 'ok' && eR <= S.U ? sg * toyVal(S, Mr, eR) : status === 'underflow' ? 0 : sg * Infinity
  if (status === 'ok' && eR > S.U) status = 'overflow' // sólo el redondeo desborda
  return { x, digits, e, chop, round, chopDigits: toDigits(Mc), roundDigits: toDigits(Mr), roundE: eR, status }
}

/* ───────────────────────── Épsilon de máquina ───────────────────────── */

export interface EpsRow {
  k: number
  eps: number
  sum: number
  greater: boolean
}

/** Bucle clásico: eps = 1; mientras (x0 + eps > x0) eps = eps/2. */
export function epsLoop(p: Prec, x0 = 1, factor = 2, maxIter = 1200): { rows: EpsRow[]; eps: number } {
  const R = (v: number) => roundP(v, p)
  const X = R(x0)
  let eps = R(1)
  const rows: EpsRow[] = []
  let last = eps
  for (let k = 0; k < maxIter; k++) {
    const sum = R(X + eps)
    const greater = sum > X
    rows.push({ k, eps, sum, greater })
    if (!greater) break
    last = eps
    eps = R(eps / factor)
    if (eps === 0) break
  }
  return { rows, eps: last }
}
