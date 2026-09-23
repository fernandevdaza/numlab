// Tema 4 · Interpolación: ejemplos del texto (Cap. 4, Dr. Hugo Rojas) y comprobaciones de consistencia.
import { parse } from 'mathjs'
import * as A from '../../src/modules/interpolacion/algorithms.ts'
import { taylorDerivative } from '../../src/modules/interpolacion/taylor.ts'
import { cerca, seccion, verdad } from './check.ts'

// Datos de log10(x) redondeados a 6 decimales, como en el texto
const X = [1.2, 1.6, 2.1, 2.5, 2.7]
const Y = [0.079181, 0.20412, 0.322219, 0.39794, 0.431364]
const xb = 2.3
const exacto = Math.log10(xb)

/* ─────────── Lagrange ─────────── */
seccion('Ej. 4.2 · Lagrange de grado 4, f(2.3)')
{
  const L = A.lagrangeBasisAt(X, xb)
  ;['0.015954', '-0.088889', '0.570370', '0.658120', '-0.155556'].forEach((v, i) => cerca(`L${i}(2.3)`, L[i], v))
  const p = L.reduce((acc, l, i) => acc + Y[i] * l, 0)
  cerca('P4(2.3)', p, '0.361695')
  cerca('Σ L_i(2.3) = 1', L.reduce((a, b) => a + b, 0), 1)
  const lag = A.lagrange(X, Y)
  cerca('P4 desarrollado (coeficientes) = forma producto', A.polyEval(lag.coeffs, xb), p, 1e-11)
  cerca('f(2.3) exacto', exacto, '0.361728')
}

/* ─────────── Diferencias divididas ─────────── */
seccion('Ej. 4.4 · Tabla de diferencias divididas de avance')
const F = A.dividedDifferences(X, Y)
{
  const tabla: [number, number, string][] = [
    [0, 1, '0.312348'], [0, 2, '-0.084611'], [0, 3, '0.025003'], [0, 4, '-0.007496'],
    [1, 1, '0.236198'], [1, 2, '-0.052106'], [1, 3, '0.013759'],
    [2, 1, '0.189303'], [2, 2, '-0.036971'],
    [3, 1, '0.167120'],
  ]
  for (const [i, j, v] of tabla) cerca(`F[${i}][${j}]`, F[i][j], v, 6e-7)
}
const ddEval = (k: number, m: number, dir: A.Direction) => {
  const idx = A.supportIndices(X.length - 1, k, m, dir)!
  return A.newtonEval(idx.map((i) => X[i]), A.newtonCoefs(F, k, m, dir), xb)
}
seccion('Ej. 4.4 · Newton de avance y polinomios «apoyados»')
cerca('P4(2.3) avance', ddEval(0, 4, 'avance'), '0.361695')
// el texto opera con los coeficientes redondeados a 6 decimales: diferencias de ±1 en el 6.º decimal
cerca('P3(2.3) apoyado en x1', ddEval(1, 3, 'avance'), '0.361779', 1e-6)
// el texto imprime 0.361695 en esta línea (errata); el valor correcto 0.361464 es el mismo del Ej. 4.11
cerca('P3(2.3) apoyado en x0 (texto: 0.361695, errata; Ej. 4.11: 0.361464)', ddEval(0, 3, 'avance'), '0.361464')
cerca('P2(2.3) apoyado en x2', ddEval(2, 2, 'avance'), '0.361559', 1e-6)
verdad('P3 apoyado en x2 de avance: datos insuficientes', A.supportIndices(4, 2, 3, 'avance') === null)

seccion('Ej. 4.6 · Newton de diferencias divididas de retroceso')
cerca('P4(2.3) retroceso', ddEval(4, 4, 'retroceso'), '0.361695')
cerca('P1(2.3) retroceso apoyado en x3', ddEval(3, 1, 'retroceso'), '0.360079', 1e-6)
{
  const a = A.newtonCoefs(F, 4, 4, 'retroceso')
  ;['0.431364', '0.167120', '-0.036971', '0.013759', '-0.007496'].forEach((v, j) => cerca(`coef. retroceso a${j}`, a[j], v, 6e-7))
}

/* ─────────── Diferencias finitas ─────────── */
const XF = [1.2, 1.6, 2.0, 2.4, 2.8]
const YF = [0.079181, 0.20412, 0.30103, 0.380211, 0.447158]
const h = A.equiStep(XF)!
const D = A.forwardDifferences(YF)
seccion('Ej. 4.8 · Diferencias finitas de avance')
cerca('h', h, 0.4, 1e-12)
{
  const tabla: [number, number, string][] = [
    [1, 0, '0.124939'], [2, 0, '-0.028029'], [3, 0, '0.010300'], [4, 0, '-0.004805'],
    [1, 1, '0.096910'], [2, 1, '-0.017729'], [3, 1, '0.005495'],
    [1, 2, '0.079181'], [2, 2, '-0.012234'],
    [1, 3, '0.066947'],
  ]
  for (const [k, i, v] of tabla) cerca(`Δ^${k} f(x${i})`, D[k][i], v)
}
{
  const r = A.newtonForward(A.finiteCoefs(D, 0, 4, 'avance'), XF[0], h, xb)
  cerca('s = (2.3 − 1.2)/0.4', r.s, 2.75, 1e-12)
  cerca('P4(2.3)', r.value, '0.361695')
  const r2 = A.newtonForward(A.finiteCoefs(D, 1, 2, 'avance'), XF[1], h, xb)
  cerca('s apoyado en x1', r2.s, 1.75, 1e-12)
  // el texto imprime 0.362037 (errata aritmética): 0.204120 + 1.75·0.096910 + 0.65625·(−0.017729) = 0.362078
  cerca('P2(2.3) apoyado en x1 (texto: 0.362037, errata)', r2.value, '0.362078')
}
seccion('Ej. 4.10 · Diferencias finitas de retroceso')
{
  const nab = A.finiteCoefs(D, 4, 4, 'retroceso')
  ;['0.447158', '0.066947', '-0.012234', '0.005495', '-0.004805'].forEach((v, k) => cerca(`∇^${k} f(x4)`, nab[k], v))
  const r = A.newtonBackward(nab, XF[4], h, xb)
  cerca('s = (2.3 − 2.8)/0.4', r.s, -1.25, 1e-12)
  cerca('P4(2.3)', r.value, '0.361695')
  // forma del texto con |s|: Σ (−1)^k C(|s|,k) ∇^k f(x_n)
  const sa = Math.abs(r.s)
  const texto = nab.reduce((acc, d, k) => acc + (-1) ** k * A.binomGen(sa, k) * d, 0)
  cerca('forma con |s| (4.28) = forma con s(s+1)…', texto, r.value, 1e-14)
  const r1 = A.newtonBackward(A.finiteCoefs(D, 3, 1, 'retroceso'), XF[3], h, xb)
  cerca('P1(2.3) apoyado en x3 (s = −0.25)', r1.value, '0.360415', 1e-6)
}
seccion('Diferencias finitas = divididas (4.22)')
{
  const FF = A.dividedDifferences(XF, YF)
  for (let k = 1; k <= 4; k++) cerca(`f[x0..x${k}] = Δ^${k}f(x0)/(k! h^k)`, FF[0][k], D[k][0] / (A.factorial(k) * h ** k), 1e-10)
}

/* ─────────── Error de interpolación ─────────── */
seccion('Ej. 4.11 · Error de P3(2.3) con nodos 1.2, 1.6, 2.1, 2.5')
{
  const xs = X.slice(0, 4), ys = Y.slice(0, 4)
  const a = A.dividedDifferences(xs, ys)[0]
  const p3 = A.newtonEval(xs, a, xb)
  cerca('P3(2.3)', p3, '0.361464')
  const est = A.extraPointEstimate(xs, ys, 2.7, 0.431364, xb)
  cerca('f[x0..x4] con el punto añadido 2.7', est.dd, '-0.007496')
  cerca('Estimación (4.31) con punto adicional', est.value, '0.0002309')
  const d4 = taylorDerivative(parse('log10(x)'), 4)
  const M = A.maxAbsSample(d4, 1.2, 2.5, 4000)
  cerca('máx |f⁗| en x = 1.2', M.at, 1.2, 1e-12)
  cerca('máx |f⁗| = 6/(1.2⁴ ln 10)', M.max, 6 / (1.2 ** 4 * Math.LN10), 1e-12)
  const cota = (M.max / A.factorial(4)) * Math.abs(A.nodeProduct(xs, xb))
  cerca('Cota (4.35)', cota, '0.001613')
  cerca('Error exacto f(2.3) − P3(2.3)', exacto - p3, '0.000264')
  verdad('error exacto ≤ cota', Math.abs(exacto - p3) <= cota)
  // Con f exacta (lo que hace la página «Estimación del error»)
  const yx = xs.map(Math.log10)
  const est2 = A.extraPointEstimate(xs, yx, 2.7, Math.log10(2.7), xb)
  cerca('Estimación (4.31) con f exacta', est2.value, 0.000231, 2e-6)
}

/* ─────────── Splines cúbicas ─────────── */
// El Ej. 4.12 usa f(2.5) = 0.397994 (en el resto del capítulo 0.397940 = log10 2.5): se reproduce tal cual.
const YS = [0.079181, 0.20412, 0.322219, 0.397994, 0.431364]
seccion('Ej. 4.12 (1) · Spline natural (M0 = M4 = 0)')
{
  const sp = A.cubicSplineM(X, YS, 'natural')
  verdad('sistema de n − 1 = 3 ecuaciones', sp.A.length === 3)
  cerca('H[0][0] = (h0+h1)/3', sp.A[0][0], 0.3, 1e-12)
  cerca('H[0][1] = h1/6', sp.A[0][1], '0.083333')
  cerca('H[1][2] = h2/6', sp.A[1][2], '0.066667')
  cerca('Y2', sp.r[1], '-0.046761')
  cerca('Y3', sp.r[2], '-0.022588')
  cerca('M1', sp.M[1], '-0.234109')
  cerca('M2', sp.M[2], '-0.071000')
  cerca('M3', sp.M[3], '-0.089271')
  cerca('S2(2.3)', A.splineMEval(sp, xb), '0.361709')
  const b = A.cubicSpline(X, YS, 'natural')
  cerca('Burden (a,b,c,d) da el mismo S(2.3)', A.splineEval(b, xb), A.splineMEval(sp, xb), 1e-13)
  cerca('M_i = 2c_i', b.c[2] * 2, sp.M[2], 1e-13)
  cerca('tramo desarrollado en potencias de x', A.polyEval(A.splineMPiece(sp, 2), xb), A.splineMEval(sp, xb), 1e-10)
}
seccion('Ej. 4.12 (2) · Spline forzada: f\'(1.2) = 0.361912, f\'(2.7) = 0.160850')
{
  const sp = A.cubicSplineM(X, YS, 'sujeto', 0.361912, 0.16085)
  verdad('sistema de n + 1 = 5 ecuaciones', sp.A.length === 5)
  cerca('H[0][0] = h0/3', sp.A[0][0], '0.133333')
  cerca('H[4][4] = h3/3', sp.A[4][4], '0.066667')
  cerca('M0', sp.M[0], '-0.290178')
  cerca('M1 (texto: −0.163118)', sp.M[1], '-0.163118', 1e-5)
  cerca('M2', sp.M[2], '-0.094449')
  cerca('M3', sp.M[3], '-0.072496')
  cerca('M4', sp.M[4], '-0.053752')
  cerca('S2(2.3)', A.splineMEval(sp, xb), '0.361776')
  const b = A.cubicSpline(X, YS, 'sujeto', 0.361912, 0.16085)
  cerca('Burden da el mismo S(2.3)', A.splineEval(b, xb), A.splineMEval(sp, xb), 1e-13)
  cerca("S'(1.2) = y'0", A.splineDeriv(b, 1.2, 1), 0.361912, 1e-12)
}
seccion('Splines: consistencia')
{
  const xs = [0, 1, 2, 3], ys = xs.map(Math.exp)
  const sp = A.cubicSplineM(xs, ys, 'natural')
  xs.forEach((x, i) => cerca(`S(x${i}) = y${i}`, A.splineMEval(sp, x), ys[i], 1e-12))
  // Burden & Faires, Ej. 3.5 (natural, e^x en 0..3): c = [0, 0.75685, 5.83007, 0] ⇒ M = 2c
  cerca('M1 (Burden: 2·0.75685)', sp.M[1], 2 * 0.75685, 1e-5)
  cerca('M2 (Burden: 2·5.83007)', sp.M[2], 2 * 5.83007, 1e-5)
  const dos = A.cubicSplineM([0, 1], [1, 3], 'natural')
  cerca('2 nodos, natural: recta', A.splineMEval(dos, 0.25), 1.5, 1e-14)
  // Un cúbico se reproduce exactamente con la spline forzada
  const g = (x: number) => x ** 3 - 2 * x
  const xn = [0, 0.5, 1.5, 2]
  const cl = A.cubicSplineM(xn, xn.map(g), 'sujeto', -2, 10)
  cerca('forzada reproduce x³ − 2x', A.splineMEval(cl, 1.2), g(1.2), 1e-12)
}

/* ─────────── Práctica del Cap. 4 (respuestas del texto) ─────────── */
seccion('Práctica 3 · ln x con diferencias divididas de avance, x = 1.5')
{
  const xs = [1, 1.35, 1.7, 1.9, 3], ys = [0, 0.3001, 0.53063, 0.64185, 1.09861]
  const G = A.dividedDifferences(xs, ys)
  const ev = (k: number, m: number) => A.newtonEval(A.supportIndices(4, k, m, 'avance')!.map((i) => xs[i]), A.newtonCoefs(G, k, m, 'avance'), 1.5)
  cerca('P3 apoyado en x0', ev(0, 3), '0.405792')
  cerca('P3 apoyado en x1 (el texto trunca)', ev(1, 3), '0.405060', 1e-6)
  cerca('P4', ev(0, 4), '0.405610')
}
seccion('Práctica 4 · presión de vapor (diferencias finitas, h = 10)')
{
  const T = [50, 60, 70, 80, 90, 100], P = [24.94, 30.11, 36.05, 42.84, 50.57, 59.3]
  const D = A.forwardDifferences(P)
  const fw = (x: number, k: number, m: number) => A.newtonForward(A.finiteCoefs(D, k, m, 'avance'), T[k], 10, x).value
  const bw = (x: number, k: number, m: number) => A.newtonBackward(A.finiteCoefs(D, k, m, 'retroceso'), T[k], 10, x).value
  cerca('P3(64) avance apoyado en x0', fw(64, 0, 3), '32.3891')
  cerca('P5(64)', fw(64, 0, 5), '32.3898')
  cerca('P1(74) avance apoyado en x2', fw(74, 2, 1), '38.7660')
  cerca('P3(74) avance apoyado en x1', fw(74, 1, 3), '38.6590')
  cerca('P3(74) retroceso apoyado en x4 (mismo polinomio)', bw(74, 4, 3), fw(74, 1, 3), 1e-11)
  cerca('P5(74) retroceso', bw(74, 5, 5), '38.6588')
}
seccion('Práctica 5 · f(x) = sen²x, P3(2.15) y su error')
{
  const f = (x: number) => Math.sin(x) ** 2
  const xs = [2, 2.1, 2.2, 2.3], ys = xs.map(f)
  cerca('datos f(x_i) de la tabla', ys[0], '0.826822')
  const p3 = A.newtonEval(xs, A.dividedDifferences(xs, ys)[0], 2.15)
  cerca('P3(2.15)', p3, '0.7003921')
  cerca('f(2.15)', f(2.15), '0.7003995', 1e-7)
  cerca('estimación con el punto 2.5 (4.31)', A.extraPointEstimate(xs, ys, 2.5, f(2.5), 2.15).value, 4.99e-6, 1e-8)
  const d4 = taylorDerivative(parse('sin(x)^2'), 4)
  const M = A.maxAbsSample(d4, 2, 2.3, 4000)
  cerca('cota (4.35)', (M.max / 24) * Math.abs(A.nodeProduct(xs, 2.15)), 1.23e-5, 5e-8)
}
seccion('Práctica 6 · splines con los datos de la Práctica 5, x = 2.15')
{
  const f = (x: number) => Math.sin(x) ** 2
  const xs = [2, 2.1, 2.2, 2.3, 2.5], ys = xs.map(f)
  cerca('forzada (y\' = sen 2x en los extremos)', A.splineMEval(A.cubicSplineM(xs, ys, 'sujeto', Math.sin(4), Math.sin(5)), 2.15), 0.70039891142448, 1e-13)
  cerca('natural', A.splineMEval(A.cubicSplineM(xs, ys, 'natural'), 2.15), 0.70058584199852, 1e-13)
}

/* ─────────── Runge ─────────── */
seccion('Fenómeno de Runge (Fig. 4.1: 1/(1+x²) en [−5, 5], grado 10)')
{
  const f = (x: number) => 1 / (1 + x * x)
  const err = (nodes: number[]) => {
    const ys = nodes.map(f), w = A.baryWeights(nodes)
    return A.maxAbsSample((x) => f(x) - A.baryEval(nodes, ys, w, x), -5, 5, 4000).max
  }
  const e10 = err(A.equiNodes(-5, 5, 10))
  cerca('máx |f − P10| equiespaciados ≈ 1.9156', e10, 1.9156, 2e-3)
  verdad('el error crece de n = 10 a n = 20', err(A.equiNodes(-5, 5, 20)) > e10)
  verdad('Chebyshev n = 10 mucho menor', err(A.chebyshevNodes(-5, 5, 10)) < 0.2)
  const xs = A.equiNodes(-5, 5, 10)
  const sp = A.cubicSplineM(xs, xs.map(f), 'natural')
  const es = A.maxAbsSample((x) => f(x) - A.splineMEval(sp, x), -5, 5, 4000).max
  verdad('spline con 10 subintervalos: error < 0.03 (Fig. 4.2)', es < 0.03, String(es))
}
