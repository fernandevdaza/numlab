// Tema 1 · Representación de números y errores: ejemplos del texto (Cap. 1, Dr. H. Rojas) y valores conocidos.
import * as F from '../../src/modules/errores/float.ts'
import * as Q from '../../src/modules/errores/palabra.ts'
import * as T from '../../src/modules/errores/decimal.ts'
import * as I from '../../src/modules/errores/incognitas.ts'
import { cerca, seccion, verdad } from './check.ts'

const R = (s: string) => F.parseRational(s)!
const num = (r: F.Rational) => Q.ratToNum(r)
const M16 = (expMode: Q.ExpMode, round: Q.RoundMode): Q.Machine => ({ w: 7, m: 8, expMode, round })

seccion('Ej. 1.1 · conversión de 74.38 a otras bases')
{
  const c2 = F.toBase(R('74.38'), 2, 8)
  verdad(`(74)₁₀ = (1001010)₂ → ${c2.intDigits}`, c2.intDigits === '1001010')
  verdad(`(0.38)₁₀ = (0.01100001…)₂ → ${c2.fracDigits.slice(0, 8)}`, c2.fracDigits.slice(0, 8) === '01100001')
  const c8 = F.toBase(R('74.38'), 8, 4)
  verdad(`(74.38)₁₀ = (112.3024…)₈ → ${c8.intDigits}.${c8.fracDigits.slice(0, 4)}`, c8.intDigits === '112' && c8.fracDigits.slice(0, 4) === '3024')
  const c16 = F.toBase(R('74.38'), 16, 3)
  verdad(`(74.38)₁₀ = (4A.614…)₁₆ → ${c16.intDigits}.${c16.fracDigits.slice(0, 3)}`, c16.intDigits === '4A' && c16.fracDigits.slice(0, 3) === '614')
  const b = F.parseInBase('100101010011.0010101011', 2)!
  const o = F.toBase(b, 8, 4), h = F.toBase(b, 16, 3)
  verdad(`Ej. 1.2 · (100101010011.0010101011)₂ = (4523.1254)₈ → ${o.intDigits}.${o.fracDigits}`, o.intDigits === '4523' && o.fracDigits.startsWith('1254'))
  verdad(`Ej. 1.2 · … = (953.2AC)₁₆ → ${h.intDigits}.${h.fracDigits}`, h.intDigits === '953' && h.fracDigits.startsWith('2AC'))
}

seccion('Ej. 1.5 / 1.6 · 74.89 en la máquina de 16 bits (1·7·8, exponente con signo)')
{
  const t = Q.store(R('74.89'), M16('signo', 'truncado'))
  cerca('truncado → 74.75', num(t.value), 74.75)
  verdad(`palabra truncada 0 0000110 00101011 → ${t.bits}`, t.bits === '0000011000101011')
  const r = Q.store(R('74.89'), M16('signo', 'redondeo'))
  cerca('redondeo → 75.00', num(r.value), 75)
  verdad(`palabra redondeada → ${r.bits}`, r.bits === '0000011000101100')
  const P = Q.props(M16('signo', 'redondeo'))
  cerca('número más grande 1.11111111·2⁶³', num(P.xmax), 1.841071527669059e19, 1e5)
  cerca('número más pequeño 2⁻⁶³', num(P.xmin), 1.084202172485504e-19, 1e-33)
  cerca('unidad de redondeo (redondeo) 2⁻⁹', num(P.delta), 0.001953125)
  cerca('unidad de redondeo (truncado) 2⁻⁸', num(Q.props(M16('signo', 'truncado')).delta), 0.00390625)
  cerca('bias 64: número más pequeño 2⁻⁶⁴', num(Q.props(M16('bias-peq', 'redondeo')).xmin), 5.421010862427522e-20, 1e-34)
  cerca('bias 63: número más grande', num(Q.props(M16('bias-gra', 'redondeo')).xmax), 3.682143055338118e19, 1e5)
}

seccion('Ej. 1.7 · −237.69 con bias 64 y redondeo')
{
  const s = Q.store(R('-237.69'), M16('bias-peq', 'redondeo'))
  cerca('valor almacenado −237.5', num(s.value), -237.5)
  verdad(`exponente 7 + 64 = 71 = 1000111 → ${s.expBits}`, s.expBits === '1000111')
  verdad(`palabra 1 1000111 11011011 → ${s.bits}`, s.bits === '1100011111011011')
}

seccion('Ej. 1.8 · leer 0000111111010101 (bias 64)')
{
  const d = Q.decode('0000111111010101', M16('bias-peq', 'redondeo'))
  verdad(`exponente 15 − 64 = −49 → ${d.e}`, d.e === -49)
  cerca('valor 3.254341240932490·10⁻¹⁵', num(d.value), 3.25434124093249e-15, 1e-29)
}

seccion('Ej. 1.9 · vecinos de w = −6.2945·10⁻³ (bias 63, redondeo)')
{
  for (const round of ['redondeo', 'par'] as const) {
    const s = Q.store(R('-6.2945e-3'), M16('ieee', round))
    cerca(`[${round}] w_A = −0.006301879882813`, num(s.value), -0.006301879882813, 1e-15)
    verdad(`[${round}] palabra 1 0110111 10011101 → ${s.bits}`, s.bits === '1011011110011101')
    cerca(`[${round}] justo más pequeño`, num(s.below!), -0.006301879882813, 1e-15)
    cerca(`[${round}] justo más grande`, num(s.above!), -0.00628662109375, 1e-15)
  }
}

seccion('Ej. 1.10 · z = 77.74 − 69.91 (bias 63, redondeo)')
{
  const M = M16('ieee', 'redondeo')
  const u = Q.store(R('77.74'), M), v = Q.store(R('69.91'), M)
  cerca('u_C = 77.75', num(u.value), 77.75)
  verdad(`u_C palabra 0 1000101 00110111 → ${u.bits}`, u.bits === '0100010100110111')
  cerca('v_C = 70', num(v.value), 70)
  const z = Q.store(Q.add(u.value, Q.neg(v.value)), M)
  cerca('z_C = 7.75', num(z.value), 7.75)
  verdad(`z_C palabra 0 1000001 11110000 → ${z.bits}`, z.bits === '0100000111110000')
  cerca('error relativo |z − z_C|/|z| ≈ 0.0102', Math.abs(7.83 - 7.75) / 7.83, '0.0102')
}

seccion('Ej. 1.12 · cifras significativas (Er ≤ 5·10^−(m+1))')
{
  const er = Math.abs(-0.001234 - -0.001229) / 0.001234
  cerca('Er = 0.004052', er, '0.004052')
  cerca('m = 2 (texto)', T.sigTexto(er), 2)
  cerca('Er = 5·10⁻³ exacto ⇒ m = 2 (≤)', T.sigTexto(5e-3), 2)
}

seccion('Ej. 1.15 / 1.16 · computadora decimal de 7 dits (0.d₁d₂d₃d₄ × 10^e, redondeo)')
{
  const M = T.TEXTO_7
  const pi = T.storeD(T.dm.pi, M)
  verdad(`π_A = 0.3142·10¹ → ${T.plainStored(pi)}`, pi.digits === '3142' && pi.E === 1)
  const r = T.evalD(T.parseExpr('sqrt(x)'), { x: T.dm.pi }, M, 'maquina')
  const fa = Number(r.value.toString())
  cerca('√π_A almacenado = 0.1773·10¹', fa, 1.773)
  const sqrtPiA = Math.sqrt(3.142)
  cerca('error propagado √π − √π_A = −0.0001149', Math.sqrt(Math.PI) - sqrtPiA, '-0.0001149')
  cerca('error de redondeo √π_A − f_A = −0.000432', sqrtPiA - fa, -0.000432, 1e-6)
  const d = T.evalD(T.parseExpr('a/b'), { a: T.dm.bignumber('3.2789e-4'), b: T.dm.bignumber('4.07546e-5') }, M, 'maquina')
  const datos = d.trace.filter((t) => t.kind === 'dato').map((t) => Number(t.stored.value.toString()))
  verdad(`datos almacenados 0.3279·10⁻³ y 0.4075·10⁻⁴ → ${datos.join(', ')}`, datos[0] === 3.279e-4 && datos[1] === 4.075e-5)
  cerca('a_A/b_A = 8.046625766871166', 3.279e-4 / 4.075e-5, 8.046625766871166)
  cerca('resultado almacenado 0.8047·10¹', Number(d.value.toString()), 8.047)
  verdad('overflow: 10¹⁰ no cabe con 1 dit de exponente', T.storeD(T.dm.bignumber('1e10'), M).status === 'overflow')
}

seccion('Épsilon de máquina y límites IEEE 754')
{
  cerca('ε doble = 2⁻⁵²', F.epsLoop(64).eps, 2 ** -52, 0)
  cerca('ε simple = 2⁻²³', F.epsLoop(32).eps, 2 ** -23, 0)
  cerca('ε media = 2⁻¹⁰', F.epsLoop(16).eps, 2 ** -10, 0)
  verdad('realmax doble = 1.797693134862316·10³⁰⁸', F.LIMITS[64].max === Number.MAX_VALUE)
  cerca('realmin doble', F.LIMITS[64].minNormal, 2.225073858507201e-308, 1e-322)
  verdad(`0.1 en simple = 0x3DCCCCCD → ${F.bitsToHex(F.toBits(0.1, 32))}`, F.bitsToHex(F.toBits(0.1, 32)) === '3DCCCCCD')
  const e = F.encodeIeee(R('-118.625'), 32)
  verdad(`−118.625 en simple = 0xC2ED4000 → ${F.bitsToHex(e.bits)}`, F.bitsToHex(e.bits) === 'C2ED4000')
  const h = F.encodeIeee(R('2049'), 16)
  cerca('2049 en media → 2048 (empate a par)', h.value, 2048)
}

seccion('Sistema F(β, t, L, U)')
{
  const info = F.toyInfo({ beta: 2, t: 3, L: -1, U: 2, conv: '0.d', subnormals: false } as F.ToySystem)
  cerca('F(2,3,−1,2): 2(β−1)β^(t−1)(U−L+1)+1 = 33 números', Number(info.count), 33)
  cerca('ε = β^(1−t) = 0.25', info.eps, 0.25)
  cerca('UFL = β^(L−1) = 0.25', info.minPos, 0.25)
  cerca('OFL = (1 − β^−t)β^U = 3.5', info.max, 3.5)
}

seccion('Bits desconocidos con condiciones (1·7·8, IEEE)')
{
  const M: Q.Machine = { w: 7, m: 8, expMode: 'ieee', round: 'par' }
  const run = (pattern: string, conds: string) => {
    const p = I.parsePattern(pattern, 16)
    if (!p.ok) throw new Error(p.error)
    const c = I.parseConds(conds)
    if (c.errors.length) throw new Error(c.errors.join(' '))
    return { vars: p.vars, rows: I.solve(p.chars, p.vars, c.conds, M) }
  }
  // x = 64·(1.001a0b11)₂ = 72.75 + 4a + b
  const r1 = run('0 1000101 001a0b11', '74 < x < 77')
  verdad(`0 1000101 001a0b11: valores 72.75, 73.75, 76.75, 77.75 → ${r1.rows.map((r) => num(r.d.value)).join(', ')}`, r1.rows.map((r) => num(r.d.value)).join() === '72.75,73.75,76.75,77.75')
  const s1 = r1.rows.filter((r) => r.ok)
  verdad(`74 < x < 77 ⇒ única solución a = 1, b = 0 (x = 76.75) → ${s1.map((r) => r.values.join('')).join(' | ')}`, s1.length === 1 && s1[0].values.join('') === '10' && num(s1[0].d.value) === 76.75)
  const f1 = I.forced(r1.rows, r1.vars)
  verdad(`bits determinados: a = 1, b = 0 → ${f1.join(', ')}`, f1.join() === '1,0')
  // bit desconocido en el exponente: E = 69 (x = 77.75) o E = 71 (x = 311)
  const r2 = run('0 10001a1 00110111', 'x < 100')
  verdad(`0 10001a1 00110111, x < 100 ⇒ a = 0 (x = 77.75) → ${r2.rows.filter((r) => r.ok).map((r) => r.values[0] + ': ' + num(r.d.value)).join(' | ')}`, r2.rows.filter((r) => r.ok).length === 1 && r2.rows[0].ok && num(r2.rows[1].d.value) === 311)
  // Ej. 1.9: de los dos vecinos de w = −6.2945·10⁻³, el ≥ w es −0.00628662109375
  const r3 = run('1 0110111 1001110a', 'x >= -6.2945e-3')
  verdad(`Ej. 1.9: vecino ≥ w ⇒ a = 0 (x = −0.00628662109375) → ${r3.rows.filter((r) => r.ok).map((r) => num(r.d.value)).join()}`, r3.rows.filter((r) => r.ok).length === 1 && num(r3.rows[0].d.value) === -0.00628662109375)
  // la misma letra en dos posiciones es el mismo bit
  const r4 = run('0 1000101 a01a0111', 'x > 0')
  verdad(`a repetida: 2 combinaciones, no 4 → ${r4.rows.length}`, r4.rows.length === 2 && r4.rows[1].bits.endsWith('10110111'))
  // |x| y potencias exactas; exponente todo en unos (IEEE) ⇒ ∞, que no es < 2^-8 pero sí ≥
  const c5 = I.parseConds('|x| ≥ 2^-8; x != 0')
  verdad(`|x| ≥ 2^-8; x ≠ 0 se leen como 2 condiciones exactas → ${c5.conds.length}`, c5.conds.length === 2 && c5.conds[0].abs && c5.conds[0].value.den === 256n)
  const r6 = run('0 111111a 00000000', 'x >= 1000')
  verdad(`0 111111a 00000000: a = 1 es +∞ y cumple x ≥ 1000 → ${r6.rows.map((r) => r.d.kind + (r.ok ? '✓' : '✗')).join(' ')}`, r6.rows[1].d.kind === 'infinito' && r6.rows[1].ok && r6.rows[0].ok)
  verdad('«y < 3» es un error de sintaxis', I.parseConds('y < 3').errors.length === 1)
  verdad('la letra x no se admite en la plantilla', !I.parsePattern('0 1000101 0010x011', 16).ok)
}
