// Tema 6 · Ecuaciones diferenciales ordinarias: ejemplos resueltos y práctica del cap. 6 del texto
// (Dr. Hugo Rojas), más órdenes de convergencia y el problema de Bouguer para el misil.
import { cerca, seccion, verdad } from './check.ts'
import { adamsMoulton, pursuit, puntoMedio2, rkf45, rkSolve, slopeLogLog, TABLEAUS, taylorSolve, taylorSolveVec, trapecio, type OdeFn, type ScalarFn } from '../../src/modules/edo/algorithms.ts'

const y1 = (r: { w: number[][] }, i: number, m = 0) => r.w[i][m]

// Problema de los Ej. 6.1–6.7: y' = x − y, y(0) = 2, h = 0.1; exacta y = 3e^{−x} + x − 1
const f: ScalarFn = (x, y) => x - y
const F: OdeFn = (x, y) => [x - y[0]]
const yex = (x: number) => 3 * Math.exp(-x) + x - 1

seccion('Ej. 6.1 · Euler (y′ = x − y, y(0) = 2, h = 0.1)')
{
  const r = rkSolve(F, TABLEAUS.euler, 0, [2], 0.1, 3)
  cerca('y₁', y1(r, 1), '1.8')
  cerca('y₂', y1(r, 2), '1.63')
  cerca('y₃', y1(r, 3), '1.487')
  cerca('exacta y(0.3)', yex(0.3), '1.522455')
}

seccion('Ej. 6.2 · Punto medio del texto (2 pasos, arranque con Euler)')
{
  const r = puntoMedio2(F, 0, [2], 0.1, 3)
  cerca('y₁ (Euler)', y1(r, 1), '1.8')
  cerca('y₂ = y₀ + 2h f(x₁, y₁)', y1(r, 2), '1.66')
  cerca('y₃ = y₁ + 2h f(x₂, y₂)', y1(r, 3), '1.508')
}

seccion('Ej. 6.3 · Trapecio o Euler modificado (predictor-corrector)')
{
  const r = rkSolve(F, TABLEAUS.heun, 0, [2], 0.1, 3)
  cerca('y₁', y1(r, 1), '1.815')
  cerca('y₂', y1(r, 2), '1.657075')
  cerca('y₃', y1(r, 3), '1.523653')
}

seccion('Ej. 6.4 · Adams-Moulton (arranque con el trapecio)')
{
  const r = adamsMoulton(F, 0, [2], 0.1, 4, 'heun')
  cerca('y₃ (trapecio)', y1(r, 3), '1.523653')
  cerca('predicción Adams-Bashforth ỹ₄', r.extra![4]!.pred, '1.412034')
  cerca('corrección Adams-Moulton y₄', y1(r, 4), '1.412039')
  cerca('exacta y(0.4)', yex(0.4), '1.410960')
}

seccion('Ej. 6.5 · Taylor de orden 2 (y″ = 1 − f)')
{
  const r = taylorSolve([f, (x, y) => 1 - f(x, y)], 0, 2, 0.1, 3)
  cerca('y₁', y1(r, 1), '1.815')
  cerca('y₂', y1(r, 2), '1.657075')
  cerca('y₃', y1(r, 3), '1.523653')
}

seccion('Ej. 6.6 · Runge-Kutta de orden 2 del texto (γ₂ = 3/4)')
{
  const r = rkSolve(F, TABLEAUS.ralston, 0, [2], 0.1, 2)
  cerca('V₂ del primer paso = −5.4/3', r.k[1]![1][0], -5.4 / 3, 1e-12)
  cerca('y₁', y1(r, 1), '1.815')
  cerca('y₂', y1(r, 2), '1.657075')
}

seccion('Ej. 6.7 · Runge-Kutta de orden 4')
{
  const r = rkSolve(F, TABLEAUS.rk4, 0, [2], 0.1, 2)
  cerca('y₁', y1(r, 1), '1.814513')
  cerca('y₂', y1(r, 2), '1.656193')
}

// Sistema de los Ej. 6.8 y 6.9: y1' = y2 + x, y2' = y1 + 1, Y(0) = (1, 0), h = 0.05
const Fs: OdeFn = (x, y) => [y[1] + x, y[0] + 1]
seccion('Ej. 6.8 · Sistema con trapecio o Euler modificado')
{
  const r = rkSolve(Fs, TABLEAUS.heun, 0, [1, 0], 0.05, 2)
  cerca('y₁(0.05)', y1(r, 1, 0), '1.00375')
  cerca('y₂(0.05)', y1(r, 1, 1), '0.1')
  cerca('y₁(0.1)', y1(r, 2, 0), '1.015005')
  cerca('y₂(0.1)', y1(r, 2, 1), '0.200375')
  cerca('exacta y₁(0.1) = 3/2(eˣ + e⁻ˣ) − 2', 1.5 * (Math.exp(0.1) + Math.exp(-0.1)) - 2, '1.015013')
}

seccion('Ej. 6.9 · Sistema con Taylor de orden 2 (Y″ = ∂F/∂x + J·F)')
{
  const D2: OdeFn = (x, y) => [1 + (y[0] + 1), y[1] + x]
  const r = taylorSolveVec([Fs, D2], 0, [1, 0], 0.05, 2)
  cerca('y₁(0.05)', y1(r, 1, 0), '1.00375')
  cerca('y₂(0.05)', y1(r, 1, 1), '0.1')
  cerca('y₁(0.1)', y1(r, 2, 0), '1.0150046875')
  cerca('y₂(0.1)', y1(r, 2, 1), '0.200375')
}

seccion('Ej. 6.10 · Tercer orden y‴ = y″ + y′ − y + x con RK2 del texto')
{
  const G: OdeFn = (x, u) => [u[1], u[2], u[2] + u[1] - u[0] + x]
  const r = rkSolve(G, TABLEAUS.ralston, 0, [0, 1, -1], 0.05, 2)
  cerca('Y(0.05) · y', y1(r, 1, 0), '0.04875')
  cerca("Y(0.05) · y'", y1(r, 1, 1), '0.95')
  cerca('Y(0.05) · y″', y1(r, 1, 2), '-1.00125')
  cerca('y(0.1)', y1(r, 2, 0), '0.094998')
  cerca("y'(0.1)", y1(r, 2, 1), '0.899875')
  cerca('y″(0.1)', y1(r, 2, 2), '-1.005002')
  const ex = (x: number) => -0.5 * Math.exp(x) - 0.5 * Math.exp(-x) + x + 1
  cerca('exacta y(0.1)', ex(0.1), '0.094996')
}

seccion('Práctica 1 · y′ = ln x + x², y(1) = 3: Euler y punto medio')
{
  const P: OdeFn = (x, y) => [Math.log(x) + x * x]
  const e1 = rkSolve(P, TABLEAUS.euler, 1, [3], 0.1, 3)
  const p1 = puntoMedio2(P, 1, [3], 0.1, 3)
  const e2 = rkSolve(P, TABLEAUS.euler, 1, [3], 0.05, 6)
  const p2 = puntoMedio2(P, 1, [3], 0.05, 6)
  cerca('Euler h=0.1, x=1.2', y1(e1, 2), '3.230531')
  cerca('Euler h=0.1, x=1.3', y1(e1, 3), '3.392763')
  cerca('Punto medio h=0.1, x=1.2', y1(p1, 2), '3.261062')
  cerca('Punto medio h=0.1, x=1.3', y1(p1, 3), '3.424464')
  cerca('Euler h=0.05, x=1.3', y1(e2, 6), '3.416341')
  cerca('Punto medio h=0.05, x=1.1', y1(p2, 2), '3.115129')
  cerca('Punto medio h=0.05, x=1.3 (el texto trunca 3.4399196)', y1(p2, 6), '3.439919', 1e-6)
  const ex = (x: number) => x * Math.log(x) - x + x ** 3 / 3 + 11 / 3
  cerca('exacta y(1.3)', ex(1.3), '3.440074')
}

seccion('Práctica 2 · y′ = −2xy + 2x, y(0) = 0: Euler modificado y Taylor 2')
{
  const P: OdeFn = (x, y) => [-2 * x * y[0] + 2 * x]
  const d2: ScalarFn = (x, y) => -2 * y + 2 + (-2 * x) * (-2 * x * y + 2 * x)
  const h1 = rkSolve(P, TABLEAUS.heun, 0, [0], 0.1, 3)
  const t1 = taylorSolve([(x, y) => P(x, [y])[0], d2], 0, 0, 0.1, 3)
  const h2 = rkSolve(P, TABLEAUS.heun, 0, [0], 0.05, 6)
  const t2 = taylorSolve([(x, y) => P(x, [y])[0], d2], 0, 0, 0.05, 6)
  cerca('Euler mod. h=0.1, x=0.2', y1(h1, 2), '0.039304')
  cerca('Euler mod. h=0.1, x=0.3', y1(h1, 3), '0.086186')
  cerca('Taylor 2 h=0.1, x=0.2', y1(t1, 2), '0.039502')
  cerca('Taylor 2 h=0.1, x=0.3', y1(t1, 3), '0.086759')
  cerca('Euler mod. h=0.05, x=0.3', y1(h2, 6), '0.086080')
  cerca('Taylor 2 h=0.05, x=0.3', y1(t2, 6), '0.086255')
}

seccion('Práctica 3 · y′ = y + 2cos x, y(0) = 1: RK4 y Adams-Moulton (arranque RK4)')
{
  const P: OdeFn = (x, y) => [y[0] + 2 * Math.cos(x)]
  const r = rkSolve(P, TABLEAUS.rk4, 0, [1], 0.1, 5)
  const a = adamsMoulton(P, 0, [1], 0.1, 5, 'rk4')
  cerca('RK4 x=0.4', y1(r, 4), '2.452005')
  cerca('RK4 x=0.5', y1(r, 5), '2.899284')
  cerca('Adams-Moulton x=0.4', y1(a, 4), '2.452006')
  cerca('Adams-Moulton x=0.5', y1(a, 5), '2.899286')
  cerca('exacta 2eˣ + sen x − cos x en 0.5', 2 * Math.exp(0.5) + Math.sin(0.5) - Math.cos(0.5), '2.899286')
}

seccion('Práctica 4 · y1′ = 3y1 + 2y2, y2′ = 4y1 + y2 con el trapecio (h = 0.1)')
{
  const r = rkSolve((_x, y) => [3 * y[0] + 2 * y[1], 4 * y[0] + y[1]], TABLEAUS.heun, 0, [0, 1], 0.1, 3)
  cerca('y1(0.1)', y1(r, 1, 0), '0.240000')
  cerca('y2(0.1)', y1(r, 1, 1), '1.145000')
  cerca('y1(0.2)', y1(r, 2, 0), '0.607200')
  cerca('y2(0.2)', y1(r, 2, 1), '1.426225')
  cerca('y1(0.3)', y1(r, 3, 0), '1.183266')
  cerca('y2(0.3)', y1(r, 3, 1), '1.924484')
}

seccion('Práctica 5 · y‴ + 2y″ − y′ − 2y = x + 1: RK2 del texto y RK4 (h = 0.05)')
{
  const G: OdeFn = (x, u) => [u[1], u[2], x + 1 - 2 * u[2] + u[1] + 2 * u[0]]
  const r2 = rkSolve(G, TABLEAUS.ralston, 0, [0.75, -0.5, 1], 0.05, 3)
  const r4 = rkSolve(G, TABLEAUS.rk4, 0, [0.75, -0.5, 1], 0.05, 3)
  cerca('RK2 x=0.10', y1(r2, 2), '0.705002')
  cerca('RK2 x=0.15', y1(r2, 3), '0.686264')
  cerca('RK4 x=0.05', y1(r4, 1), '0.726250')
  cerca('RK4 x=0.15', y1(r4, 3), '0.686271')
}

seccion('Práctica 6 · Circuito RC: 200Q′ + Q/(5·10⁻⁴) = 12cos(100t), RK2 del texto (h = 0.05)')
{
  const r = rkSolve((t, q) => [(12 * Math.cos(100 * t) - q[0] / 5e-4) / 200], TABLEAUS.ralston, 0, [0], 0.05, 2)
  cerca('Q(0.1)', y1(r, 2), '-0.0024')
}

seccion('Práctica 7 · 1.2x″ + 0.2x′ + 200x = 50 sen(0.5t) con el punto medio (2 pasos, h = 0.05)')
{
  const G: OdeFn = (t, u) => [u[1], (50 * Math.sin(0.5 * t) - 0.2 * u[1] - 200 * u[0]) / 1.2]
  const r = puntoMedio2(G, 0, [0.2, 0], 0.05, 2)
  cerca('x(0.1)', y1(r, 2, 0), '0.0333')
  cerca('v(0.1)', y1(r, 2, 1), '-3.2014')
  cerca('a(0.1) = F₂(0.1, x, v)', G(0.1, r.w[2])[1], '-2.9395')
}

seccion('Práctica 8 · 0.5Q″ + 6Q′ + 50Q = 24 sen(10t) con Taylor de orden 2 (h = 0.05)')
{
  const H: OdeFn = (t, u) => [u[1], (24 * Math.sin(10 * t) - 6 * u[1] - 50 * u[0]) / 0.5]
  const D2: OdeFn = (t, u) => {
    const f = H(t, u)
    return [f[1], (240 * Math.cos(10 * t) - 6 * f[1] - 50 * f[0]) / 0.5]
  }
  const r = taylorSolveVec([H, D2], 0, [0, 0.1], 0.05, 2)
  cerca('Q(0.1)', y1(r, 2, 0), '0.0544')
  cerca('I(0.1)', y1(r, 2, 1), '1.6134')
}

seccion('Trapecio implícito (Newton) en y′ = −20y: A-estable')
{
  const r = trapecio((_t, y) => -20 * y, () => -20, 0, 1, 0.12, 10, 'newton')
  const R = (1 - 1.2) / (1 + 1.2)
  cerca('w₁ = R(z)·w₀, R = (1 + z/2)/(1 − z/2)', y1(r, 1), R, 1e-12)
  verdad('|w_N| decrece aunque h|λ| = 2.4 > 2', Math.abs(y1(r, 10)) < 1e-9)
  const e = rkSolve((_t, y) => [-20 * y[0]], TABLEAUS.euler, 0, [1], 0.12, 10)
  verdad('Euler con el mismo h oscila y crece (|1 + hλ| = 1.4)', Math.abs(y1(e, 10)) > 10)
}

seccion('Órdenes de convergencia (y′ = y − t² + 1 en [0, 2], Burden)')
{
  const B: OdeFn = (t, y) => [y[0] - t * t + 1]
  const exB = (2 + 1) ** 2 - 0.5 * Math.exp(2)
  const Ns = [10, 20, 40, 80, 160]
  const ord = (run: (N: number) => number) => slopeLogLog(Ns.map((N) => 2 / N), Ns.map((N) => Math.abs(run(N) - exB)))!
  const last = (r: { w: number[][] }) => r.w[r.w.length - 1][0]
  cerca('Euler: p ≈ 1', ord((N) => last(rkSolve(B, TABLEAUS.euler, 0, [0.5], 2 / N, N))), 1, 0.1)
  cerca('Punto medio (2 pasos): p ≈ 2', ord((N) => last(puntoMedio2(B, 0, [0.5], 2 / N, N))), 2, 0.15)
  cerca('Euler modificado: p ≈ 2', ord((N) => last(rkSolve(B, TABLEAUS.heun, 0, [0.5], 2 / N, N))), 2, 0.1)
  cerca('RK2 γ₂ = 3/4: p ≈ 2', ord((N) => last(rkSolve(B, TABLEAUS.ralston, 0, [0.5], 2 / N, N))), 2, 0.1)
  cerca('RK3: p ≈ 3', ord((N) => last(rkSolve(B, TABLEAUS.rk3, 0, [0.5], 2 / N, N))), 3, 0.15)
  cerca('RK4: p ≈ 4', ord((N) => last(rkSolve(B, TABLEAUS.rk4, 0, [0.5], 2 / N, N))), 4, 0.15)
  const eAM = (N: number) => Math.abs(last(adamsMoulton(B, 0, [0.5], 2 / N, N, 'rk4')) - exB)
  cerca('Adams-Moulton (arranque RK4): log₂(E(h)/E(h/2)) ≈ 4 con N = 320 → 640', Math.log2(eAM(320) / eAM(640)), 4, 0.1)
  const r = rkSolve(B, TABLEAUS.rk4, 0, [0.5], 0.2, 10)
  cerca('Burden tabla 5.8: RK4 w₁₀', y1(r, 10), '5.3053630')
  const a = rkf45(B, 0, [0.5], 2, 1e-5, 0.01, 0.25)
  cerca('Burden tabla 5.11: RKF45 w(2)', a.w[a.w.length - 1][0], exB, 1e-4)
}

seccion('Misil: persecución de Bouguer (T = a·v_M/(v_M² − v_T²) = 20/3)')
{
  const r = pursuit((t) => [0, t, 0], [10, 0, 0], 2, 0, 10, 0.0005, 0.002)
  verdad('hay captura', r.captured)
  cerca('tiempo de captura', r.tCapture, 20 / 3, 5e-3)
}
