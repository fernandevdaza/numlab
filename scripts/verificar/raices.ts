// Tema 2 · Ecuaciones no lineales: ejemplos resueltos del texto (Cap. 2, Dr. H. Rojas) y respuestas de su práctica.
import * as A from '../../src/modules/raices/algorithms.ts'
import { cerca, seccion, verdad } from './check.ts'

const o = (tol: number, criterion: A.Criterion = 'o', maxIter = 50): A.Opts => ({ tol, maxIter, criterion })
/** El texto suele escribir los valores truncados ("1.306342..."): compara los d primeros decimales. */
const trunc = (desc: string, x: number, esperado: string) => {
  const d = (esperado.split('.')[1] ?? '').length
  const t = Math.trunc(x * 10 ** d) / 10 ** d
  verdad(`${desc}: ${x} ≈ ${esperado}…`, Math.abs(t - Number(esperado)) < 0.5 * 10 ** -d)
}
const ALFA = 1.3652300134141
const f = (x: number) => x ** 3 + 4 * x ** 2 - 10
const df = (x: number) => 3 * x ** 2 + 8 * x
const g3 = (x: number) => 0.5 * Math.sqrt(10 - x ** 3)

seccion('Criterio de parada (2.3)')
cerca("'o' = min(|Δx|, |f|)", A.stopValue('o', 1.1, 1, 1e-3), 1e-3)
cerca("'abs' = |Δx|", A.stopValue('abs', 1.1, 1, 1e-3), 0.1, 1e-15)
cerca("'o' ignora un residuo no finito", A.stopValue('o', 1.1, 1, NaN), 0.1, 1e-15)

seccion('Ej. 2.2 · bisección x³ + 4x² − 10 en [1, 1.5], EPS = 0.01')
cerca('n por (2.6): ⌈(ln 0.5 − ln 0.01)/ln 2⌉ = ⌈5.64⌉', A.biseccionIterMin(1, 1.5, 0.01), 6)
{
  const r = A.biseccion(f, 1, 1.5, o(0.01))
  verdad('6 iteraciones', r.rows.length === 6 && r.converged)
  const xm = ['1.25', '1.375', '1.3125', '1.34375', '1.359375', '1.3671875']
  const fm = ['-1.7968', '0.1621', '-0.8483', '-0.3509', '-0.09640', '0.0323']
  r.rows.forEach((row, i) => {
    cerca(`x_M(${i + 1})`, row.c, xm[i])
    trunc(`f(x_M(${i + 1}))`, row.fc, fm[i]) // el texto trunca: "−0.8483…"
  })
  cerca('|α − x_M(6)| = 1.96·10⁻³', Math.abs(ALFA - r.root), '0.00196')
}

seccion('Ej. 2.3 · escalera en el pasillo (bisección en [0.48, 0.52])')
{
  const fe = (a: number) => (-4 * Math.cos(a)) / Math.sin(a) ** 2 + (5 * Math.cos(Math.PI / 3 - a)) / Math.sin(Math.PI / 3 - a) ** 2
  cerca('f(0.48)', fe(0.48), '-2.03', 0.01)
  cerca('f(0.52)', fe(0.52), '3.01')
  const r = A.biseccion(fe, 0.48, 0.52, o(1e-3))
  verdad('6 iteraciones con EPS = 10⁻³', r.rows.length === 6)
  cerca('α = 0.495625', r.root, '0.495625')
  cerca('f(α) = −0.0494', fe(r.root), '-0.0494')
  cerca('L(α) = 4/sen α + 5/sen(π/3 − α) = 17.9522 m', 4 / Math.sin(r.root) + 5 / Math.sin(Math.PI / 3 - r.root), '17.9522')
  // El texto escribe f(0.4975) = +0.11…; el valor correcto es +0.187 (errata del texto).
  cerca('f(0.4975) (el texto dice +0.11…, errata)', r.rows[3].fc, '0.187')
}

seccion('Ej. 2.4 · punto fijo desde x₀ = 1.5 (5 iteraciones)')
{
  const tabla: [string, (x: number) => number, string[]][] = [
    ['g₁ = 10/(x² + 4x)', (x) => 10 / (x * x + 4 * x), ['1.212121', '1.582849', '1.131631', '1.722027', '1.014869']],
    ['g₂ = √(10/(4 + x))', (x) => Math.sqrt(10 / (4 + x)), ['1.348400', '1.367376', '1.364957', '1.365265', '1.365226']],
    ['g₃ = ½√(10 − x³)', g3, ['1.286954', '1.402541', '1.345458', '1.375170', '1.360094']],
  ]
  for (const [nombre, g, esperado] of tabla) {
    const r = A.puntoFijo(g, 1.5, o(1e-14, 'o', 5))
    esperado.forEach((e, i) => cerca(`${nombre}: x${i + 1}`, r.iterates[i + 1], e))
  }
  // g₄ = (10 − 4x²)^(1/3): 1, 1.817121 y luego raíz cúbica de un negativo (número complejo en el texto).
  const g4 = (x: number) => { const v = 10 - 4 * x * x; return v >= 0 ? Math.cbrt(v) : NaN }
  const r4 = A.puntoFijo(g4, 1.5, o(1e-14, 'o', 5))
  cerca('g₄: x1', r4.iterates[1], '1.000000')
  cerca('g₄: x2', r4.iterates[2], '1.817121')
  verdad('g₄: se detiene (número complejo)', !r4.converged && r4.iterates.length === 3)
}

seccion('Ej. 2.5 · esfera flotante h³ − 0.3h² + 0.002552 = 0, h₀ = 0.1')
{
  const r1 = A.puntoFijo((h) => 0.002552 / (0.3 * h - h * h), 0.1, o(1e-14, 'o', 5))
  ;['0.127600', '0.116009', '0.119562', '0.118293', '0.118727'].forEach((e, i) => cerca(`g₁: h${i + 1}`, r1.iterates[i + 1], e))
  const r2 = A.puntoFijo((h) => Math.sqrt(0.002552 / (0.3 - h)), 0.1, o(1e-14, 'o', 5))
  ;['0.112960', '0.116808', '0.118029', '0.118424', '0.118553'].forEach((e, i) => cerca(`g₂: h${i + 1}`, r2.iterates[i + 1], e))
  const r2b = A.puntoFijo((h) => Math.sqrt(0.002552 / (0.3 - h)), 0.1, o(1e-10))
  cerca('g₂ converge a h = 0.118615 (roots de Matlab)', r2b.root, '0.118615')
  const g3e = (h: number) => { const v = -0.002552 + 0.3 * h * h; return v >= 0 ? Math.cbrt(v) : NaN }
  const r3 = A.puntoFijo(g3e, 0.1, o(1e-14, 'o', 5))
  cerca('g₃: h1', r3.iterates[1], '0.076517')
  verdad('g₃: número complejo en la 2.ª iteración', !r3.converged && r3.iterates.length === 2)
}

seccion('Ej. 2.5 (Aitken) · y_n con g₃, x₀ = 1.5')
{
  const r = A.aitken(g3, 1.5, o(1e-14, 'o', 5))
  ;['1.361886', '1.364329', '1.364999', '1.365169', '1.365214'].forEach((e, i) => cerca(`y${i}`, r.rows[i].hat, e))
  // El error de y_n decrece con razón ≈ g′(α)² ≈ 0.262 (convergencia lineal más rápida).
  const e = r.rows.map((row) => Math.abs(row.hat - ALFA))
  const gp = (-0.75 * ALFA ** 2) / Math.sqrt(10 - ALFA ** 3)
  cerca('razón de errores de y_n ≈ g′(α)²', e[4] / e[3], gp * gp, 0.01)
}

seccion('Steffensen (texto §2.3.5) · g₃, x₀ = 1.5')
{
  const r = A.steffensen(g3, 1.5, o(1e-14, 'abs', 3))
  // El texto escribe y₀ = 1.361887 en esta tabla y 1.361886 en la de Aitken; el valor es 1.3618865 → 1.361886.
  cerca('y0', r.rows[0].xn, '1.361886')
  cerca('x1 = g(y0)', r.rows[1].g1, '1.366937')
  cerca('x2 = g(x1)', r.rows[1].g2, '1.364355')
  cerca('y1', r.rows[1].xn, '1.365228')
  cerca('y2 (12 dígitos exactos)', r.rows[2].xn, '1.3652300134136')
  verdad('orden estimado ≈ 2', Math.abs((A.ordenFinal(A.steffensen(g3, 1.5, o(1e-15)).iterates) ?? 0) - 2) < 0.3)
}

seccion('Ej. 2.6 · Newton-Raphson, x₀ = 1.5')
{
  const r = A.newton(f, df, 1.5, o(1e-12))
  ;['1.373333', '1.365262', '1.365230013', '1.36523001341'].forEach((e, i) => trunc(`x${i + 1}`, r.iterates[i + 1], e))
  verdad('se detiene en 4 iteraciones', r.rows.length === 4 && r.converged)
  cerca('orden estimado ≈ 2', A.ordenFinal(r.iterates) ?? NaN, 2, 0.15)
}

seccion('Ej. 2.7 · secante, x₀ = 1.5, x₁ = 1.4')
{
  const r = A.secante(f, 1.5, 1.4, o(1e-4))
  ;['1.367392', '1.365266', '1.3652300'].forEach((e, i) => trunc(`x${i + 2}`, r.iterates[i + 2], e))
  cerca('x2 redondeado', r.iterates[2], '1.367393')
  verdad('con EPS = 10⁻⁴ se detiene en x₄ (como la tabla)', r.iterates.length === 5 && r.converged)
  const r2 = A.secante((x) => x ** 3 - x - 2, 1, 2, o(1e-15, 'abs'))
  cerca('orden estimado ≈ 1.618 (x³ − x − 2)', A.ordenFinal(r2.iterates) ?? NaN, 1.618, 0.12)
}

seccion('Ej. 2.8 · posición falsa en [1, 1.5]')
{
  const r = A.posicionFalsa(f, 1, 1.5, o(1e-5))
  const as = ['1.338983', '1.363563', '1.365125', '1.365223', '1.365230']
  const fs = ['-0.4278', '-0.0275', '-0.0017', '-0.0001', '-0.000006869']
  r.rows.forEach((row, i) => {
    cerca(`α_S(${i + 1})`, row.c, as[i])
    trunc(`f(α_S(${i + 1}))`, row.fc, fs[i])
    cerca(`x_D fijo = 1.5 (${i + 1})`, row.b, 1.5)
  })
  verdad('5 iteraciones con EPS = 10⁻⁵', r.rows.length === 5 && r.converged)
  const m = A.posicionFalsa(f, 1, 1.5, o(1e-5), true)
  cerca('modificada, it. 3: f(x_D)/2 = 2.375/2', m.rows[2].fb, 1.1875)
  cerca('modificada, α_S(3)', m.rows[2].c, '1.366652')
  cerca('modificada, f(α_S(3)) = +0.0234… (el texto pone “−”, errata)', m.rows[2].fc, '0.0235')
  cerca('modificada, α_S(4)', m.rows[3].c, '1.365229')
  cerca('modificada, f(α_S(4)) = −1.9188·10⁻⁵', m.rows[3].fc, -1.9188e-5, 1e-8)
  cerca('modificada, α_S(5) = 1.36523001 (9 dígitos correctos)', m.rows[4].c, '1.36523001')
  cerca('modificada, f(α_S(5)) ≈ −1.3366·10⁻⁸ (texto)', m.rows[4].fc, -1.3366e-8, 1e-11)
  verdad('modificada: 5 iteraciones', m.rows.length === 5 && m.converged)
  const lenta = A.posicionFalsa((x) => x ** 10 - 1, 0, 1.3, o(1e-8)).rows.length
  const rapida = A.posicionFalsa((x) => x ** 10 - 1, 0, 1.3, o(1e-8), true).rows.length
  verdad(`la modificación acelera x¹⁰ − 1 (${lenta} → ${rapida} iteraciones)`, rapida < lenta / 3)
}

seccion('Ej. 2.9 · Newton modificado, f = x³ − 6.4x² + 11.04x − 5.76, x₀ = 1')
{
  const p = (x: number) => x ** 3 - 6.4 * x ** 2 + 11.04 * x - 5.76
  const dp = (x: number) => 3 * x * x - 12.8 * x + 11.04
  const d2p = (x: number) => 6 * x - 12.8
  const nw = A.newton(p, dp, 1, o(0, 'abs', 4))
  ;['1.096774', '1.147486', '1.173503', '1.186690'].forEach((e, i) => cerca(`Newton x${i + 1}`, nw.iterates[i + 1], e))
  const ms = A.estimarMultiplicidad(nw.iterates)
  trunc('m ≈ 2.10', ms[0], '2.10')
  trunc('m ≈ 2.053', ms[1], '2.053')
  trunc('m ≈ 2.027', ms[2], '2.027')
  verdad('m = 2 al redondear', Math.round(ms[2]) === 2)
  const r = A.newtonModificado(p, dp, d2p, 1, o(1e-5, 'abs'), 'm', 2)
  ;['1.193548', '1.199993', '1.200000'].forEach((e, i) => cerca(`Newton mod. x${i + 1}`, r.iterates[i + 1], e))
  verdad('3 iteraciones', r.rows.length === 3 && r.converged)
  const u = A.newtonModificado(p, dp, d2p, 1, o(1e-10), 'mu')
  cerca('método alternativo u = f/f′ → 1.2', u.root, 1.2, 1e-7)
}

seccion('Práctica del Cap. 2 (respuestas del texto)')
{
  const g = (x: number) => 2 * Math.exp(-x)
  trunc('3.1 Aitken, g = 2e^(−x), x₀ = 0.84, 3 it.', A.aitken(g, 0.84, o(0, 'abs', 3)).root, '0.85262208')
  trunc('3.1 Steffensen, 3 it.', A.steffensen(g, 0.84, o(0, 'abs', 3)).root, '0.85260550')
  trunc('3.2 Aitken, g = ln x + 2, x₀ = 3.1, 3 it.', A.aitken((x) => Math.log(x) + 2, 3.1, o(0, 'abs', 3)).root, '3.14619374')
  trunc('3.2 Steffensen', A.steffensen((x) => Math.log(x) + 2, 3.1, o(0, 'abs', 3)).root, '3.146193220620')
  const f41 = (x: number) => Math.exp(x) - Math.tan(x)
  const df41 = (x: number) => Math.exp(x) - 1 / Math.cos(x) ** 2
  trunc('4.1 Newton, x₀ = 1.2, 4 it.', A.newton(f41, df41, 1.2, o(0, 'abs', 4)).root, '1.306342')
  trunc('4.1 Posición falsa, [1.2, 1.4], 4 it.', A.posicionFalsa(f41, 1.2, 1.4, o(0, 'abs', 4)).root, '1.302967')
  const f42 = (x: number) => Math.exp(x) + 2 ** -x + 2 * Math.cos(x) - 6
  const df42 = (x: number) => Math.exp(x) - Math.LN2 * 2 ** -x - 2 * Math.sin(x)
  trunc('4.2 Newton, x₀ = 2, 4 it.', A.newton(f42, df42, 2, o(0, 'abs', 4)).root, '1.82938360')
  trunc('4.2 Posición falsa, [1.7, 2], 4 it.', A.posicionFalsa(f42, 1.7, 2, o(0, 'abs', 4)).root, '1.82934112')
  const q = (x: number) => x ** 4 - 4.8 * x ** 3 + 8.64 * x ** 2 - 6.912 * x + 2.0736
  const dq = (x: number) => 4 * x ** 3 - 14.4 * x * x + 17.28 * x - 6.912
  const r5 = A.newtonModificado(q, dq, (x) => 12 * x * x - 28.8 * x + 17.28, 1, o(1e-8), 'm', 4)
  verdad('5 Newton mod. m = 4 desde 1.0 → 1.2 sin saltar por el redondeo', r5.converged && Math.abs(r5.root - 1.2) < 1e-9, String(r5.root))
  const C = (t: number) => 70 * Math.exp(-1.5 * t) + 25 * Math.exp(-0.075 * t) - 9
  const dC = (t: number) => -105 * Math.exp(-1.5 * t) - 1.875 * Math.exp(-0.075 * t)
  trunc('6 bacterias, Newton t₀ = 14', A.newton(C, dC, 14, o(1e-10)).root, '13.622016')
  const P = (x: number) => x ** 4 - 3.2 * x ** 3 + 0.96 * x ** 2 + 4.608 * x - 3.456
  const dP = (x: number) => 4 * x ** 3 - 9.6 * x ** 2 + 1.92 * x + 4.608
  cerca('7 Newton x₀ = −1, 4 it.', A.newton(P, dP, -1, o(0, 'abs', 4)).root, '-1.200000')
  trunc('7 Newton mod. m = 2, x₀ = 1.3, 4 it. (el redondeo da 1.200007, como el texto)', A.newtonModificado(P, dP, (x) => 12 * x * x - 19.2 * x + 1.92, 1.3, o(0, 'abs', 4), 'm', 2).root, '1.200007')
}

seccion('Orden de convergencia estimado')
{
  const b = A.biseccion((x) => x * x - 2, 1, 2, o(1e-12, 'abs'))
  cerca('bisección ≈ 1', A.ordenFinal(b.iterates) ?? NaN, 1, 0.35)
  const pf = A.puntoFijo(Math.cos, 0.5, o(1e-12, 'abs'))
  cerca('punto fijo g = cos ≈ 1', A.ordenFinal(pf.iterates) ?? NaN, 1, 0.1)
  const nd = A.newton((x) => (x - 1) ** 2 * (x + 2), (x) => 2 * (x - 1) * (x + 2) + (x - 1) ** 2, 2, o(1e-10, 'abs'))
  cerca('Newton en raíz doble ≈ 1 (g′(α) = 1 − 1/m = ½)', A.ordenFinal(nd.iterates) ?? NaN, 1, 0.1)
}
