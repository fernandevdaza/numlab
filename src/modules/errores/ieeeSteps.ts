// Desarrollo "de examen" para codificar un número en IEEE 754.
import { texNum } from '../../lib/format'
import { L } from '../../i18n'
import { baseTex, bitsToHex, encodeIeee, exactDecimal, FORMATS, ratToDecimal, ratToNumber, reduce, toBase, type Prec, type Rational } from './float'

export interface Step {
  text?: string
  tex?: string
}

const abs = (a: bigint) => (a < 0n ? -a : a)

/** Racional exacto de un double. */
export function ratOfDouble(x: number): Rational {
  const e = exactDecimal(x)
  const m = e.match(/^(-?)(\d+)(?:\.(\d+))?$/)!
  const fp = m[3] ?? ''
  return reduce({ num: BigInt(m[1] + m[2] + fp), den: 10n ** BigInt(fp.length) })
}

/** Bits de |r| desde el 1 principal: `count` bits (el primero es el 1 principal). */
function leadingBits(r: Rational, e: number, count: number): string {
  const a = abs(r.num)
  const sh = count - 1 - e
  let N: bigint
  if (sh >= 0) N = (a << BigInt(sh)) / r.den
  else N = a / (r.den << BigInt(-sh))
  return N.toString(2)
}

export function ieeeSteps(r: Rational, p: Prec): Step[] {
  const F = FORMATS[p]
  const out: Step[] = []
  const enc = encodeIeee(r, p)
  const a: Rational = { num: abs(r.num), den: r.den }
  const dec = (q: Rational, d = 14) => {
    const v = Math.abs(ratToNumber(q))
    if (v !== 0 && (v < 1e-6 || v >= 1e15)) return texNum(ratToNumber(q), 17)
    return ratToDecimal(q, d).replace('…', '\\ldots')
  }
  const abbrev = (bits: string) => (bits.length > 40 ? `${bits.slice(0, 24)}\\ldots\\text{ (${bits.length} bits)}` : bits)
  out.push({ text: L('1) Signo:', '1) Sign:'), tex: `x = ${dec(r, 20)} ${enc.sign ? '< 0 \\Rightarrow s = 1' : '\\ge 0 \\Rightarrow s = 0'}` })
  if (a.num === 0n) {
    out.push({ text: L('El cero se representa con exponente y fracción nulos:', 'Zero is represented with an all-zero exponent and fraction:'), tex: `${enc.sign}\\;|\\;${'0'.repeat(F.w)}\\;|\\;0\\ldots0` })
    return out
  }
  // parte entera y fraccionaria
  const conv = toBase(a, 2, 80)
  const I = conv.intPart
  const intLine = I > 0n ? `${I > 10n ** 15n ? texNum(Number(I), 17) : I} = (${abbrev(conv.intDigits)})_2` : '0 = (0)_2'
  out.push({ text: L('2) Parte entera a binario (divisiones sucesivas entre 2, se leen los residuos de abajo hacia arriba):', '2) Integer part to binary (repeated division by 2, remainders read from bottom to top):'), tex: I > 0n && conv.intSteps.length <= 12 ? conv.intSteps.map((s) => `${s.n} = 2\\cdot ${s.q} + \\mathbf{${s.r}}`).join('\\\\ ') + `\\\\ \\Rightarrow ${intLine}` : intLine })
  if (conv.fracSteps.length && I === 0n && enc.e < -12) {
    out.push({ text: L(
        `Parte fraccionaria: multiplicando por 2 repetidamente, los primeros ${-enc.e - 1} dígitos son 0 y el primer 1 aparece en la posición ${-enc.e} (es decir, 2^${enc.e} ≤ |x| < 2^${enc.e + 1}).`,
        `Fractional part: multiplying by 2 repeatedly, the first ${-enc.e - 1} digits are 0 and the first 1 appears at position ${-enc.e} (that is, 2^${enc.e} ≤ |x| < 2^${enc.e + 1}).`,
      ) })
  } else if (conv.fracSteps.length) {
    const rows = conv.fracSteps.slice(0, 10).map((s) => {
      const fr: Rational = reduce({ num: s.num, den: s.den })
      const prod: Rational = reduce({ num: s.prodNum, den: s.den })
      return `${dec(fr, 10)} \\times 2 = ${dec(prod, 10)} \\;\\rightarrow\\; \\mathbf{${s.digit}}`
    })
    const more = conv.fracSteps.length > 10 ? '\\\\ \\vdots' : ''
    const period = conv.periodStart >= 0 ? L(`\\text{ (se repite el resto a partir del dígito ${conv.periodStart + 1}: expansión periódica)}`, `\\text{ (the remainder repeats from digit ${conv.periodStart + 1} on: repeating expansion)}`) : conv.terminates ? L('\\text{ (termina)}', '\\text{ (terminates)}') : ''
    out.push({ text: L('Parte fraccionaria (multiplicaciones sucesivas por 2, se toma la parte entera):', 'Fractional part (repeated multiplication by 2, take the integer part):'), tex: `\\begin{array}{l}${rows.join('\\\\ ')}${more}\\end{array}` })
    out.push({ tex: `|x| = ${baseTex({ ...conv, neg: false }, 2)}${period}` })
  } else out.push({ tex: `|x| = (${abbrev(conv.intDigits)})_2` })
  // normalización
  const e = enc.e
  const lb = leadingBits(a, e, F.m + 3)
  const norm = `1.${lb.slice(1, F.m + 1)}\\,${lb.slice(F.m + 1)}\\ldots`
  out.push({ text: L(
      `3) Normalizar: se corre el punto ${Math.abs(e)} lugar(es) a la ${e >= 0 ? 'izquierda' : 'derecha'} para dejar un solo 1 antes del punto:`,
      `3) Normalize: move the point ${Math.abs(e)} place(s) to the ${e >= 0 ? 'left' : 'right'} so that a single 1 remains before the point:`,
    ), tex: `|x| = (${norm})_2 \\times 2^{${e}}` })
  const emin = 1 - F.bias
  if (enc.overflow && !enc.subnormal && e + F.bias >= 2 ** F.w - 1) {
    out.push({ text: L(
        `4) Exponente sesgado: E = e + ${F.bias} = ${e + F.bias} ≥ ${2 ** F.w - 1} ⇒ no cabe: OVERFLOW, se guarda ±∞.`,
        `4) Biased exponent: E = e + ${F.bias} = ${e + F.bias} ≥ ${2 ** F.w - 1} ⇒ it does not fit: OVERFLOW, ±∞ is stored.`,
      ), tex: `${enc.sign}\\;|\\;${'1'.repeat(F.w)}\\;|\\;${'0'.repeat(8)}\\ldots` })
    return out
  }
  if (enc.subnormal) {
    out.push({ text: L(
        `4) El exponente e = ${e} es menor que el mínimo ${emin} ⇒ número SUBNORMAL: E = 0 y se escribe como 0.f × 2^${emin} (sin 1 implícito).`,
        `4) The exponent e = ${e} is below the minimum ${emin} ⇒ SUBNORMAL number: E = 0 and it is written as 0.f × 2^${emin} (no implicit 1).`,
      ) })
  } else {
    out.push({ text: L('4) Exponente sesgado (se suma el sesgo) y se pasa a binario con ', '4) Biased exponent (add the bias) and convert to binary with ') + F.w + ' bits:', tex: `E = e + ${F.bias} = ${e} + ${F.bias} = ${e + F.bias} = (${(e + F.bias).toString(2).padStart(F.w, '0')})_2` })
  }
  // redondeo
  const g = enc.guard
  out.push({
    text: L(
      `5) Fracción: se toman ${F.m} bits ${enc.subnormal ? 'de 0.f' : 'después del 1 implícito'} y se mira el bit de guarda (siguiente) y los restantes:`,
      `5) Fraction: take ${F.m} bits ${enc.subnormal ? 'of 0.f' : 'after the implicit 1'} and look at the guard bit (the next one) and the rest:`,
    ),
    tex: `f = ${enc.mantTrunc.replace(/(.{4})/g, '$1\\,')}\\;\\Big|\\; g = ${g},\\ \\text{${L('resto', 'rest')}} ${enc.sticky ? '\\ne 0' : '= 0'}`,
  })
  const rule =
    g === 0
      ? L('g = 0 ⇒ se trunca (redondeo hacia abajo).', 'g = 0 ⇒ chop (round down).')
      : enc.sticky
        ? L('g = 1 y resto ≠ 0 ⇒ más de la mitad: se suma 1 al último bit.', 'g = 1 and rest ≠ 0 ⇒ more than half: add 1 to the last bit.')
        : enc.roundedUp
          ? L('Empate exacto (g = 1, resto = 0) y el último bit es 1 ⇒ redondeo al par: se suma 1.', 'Exact tie (g = 1, rest = 0) and the last bit is 1 ⇒ round to even: add 1.')
          : L('Empate exacto y el último bit es 0 ⇒ redondeo al par: se deja igual.', 'Exact tie and the last bit is 0 ⇒ round to even: leave it unchanged.')
  out.push({ text: L('Redondeo al más cercano (empate al par): ', 'Round to nearest (ties to even): ') + rule + (enc.carry ? L(' El acarreo desborda la mantisa: se incrementa el exponente.', ' The carry overflows the mantissa: the exponent is incremented.') : '') })
  if (enc.underflowToZero) {
    out.push({ text: L('El resultado es menor que la mitad del menor subnormal ⇒ UNDERFLOW a cero.', 'The result is less than half the smallest subnormal ⇒ UNDERFLOW to zero.') })
  }
  const E2 = enc.E.toString(2).padStart(F.w, '0')
  out.push({ text: L('6) Se ensamblan los campos s | E | f:', '6) Assemble the fields s | E | f:'), tex: `${enc.sign}\\;|\\;${E2}\\;|\\;${enc.mant.replace(/(.{4})/g, '$1\\,')}` })
  out.push({ text: L('En hexadecimal (grupos de 4 bits):', 'In hexadecimal (groups of 4 bits):'), tex: `\\texttt{0x${bitsToHex(enc.bits)}}` })
  const stored = enc.value
  out.push({ text: L('7) Valor realmente almacenado y error de representación:', '7) Value actually stored and representation error:'), tex: `fl(x) = ${texNum(stored, 17)},\\qquad \\frac{|x - fl(x)|}{|x|} ${relLine(r, stored, p)}` })
  return out
}

function relLine(r: Rational, stored: number, p: Prec): string {
  if (!Number.isFinite(stored)) return '= \\infty'
  const s = ratOfDouble(stored)
  // |r - s|/|r| exacto → número
  const num = abs(r.num * s.den - s.num * r.den)
  const den = abs(r.num) * s.den
  if (num === 0n) return L('= 0 \\;(\\text{exacto})', '= 0 \\;(\\text{exact})')
  const rel = Number((num * 10n ** 30n) / den) / 1e30
  const u = 2 ** -(FORMATS[p].m + 1)
  return `\\approx ${texNum(rel, 4)} ${rel <= u * (1 + 1e-9) ? '\\le' : '>'} u = 2^{-${FORMATS[p].m + 1}} \\approx ${texNum(u, 4)}`
}
