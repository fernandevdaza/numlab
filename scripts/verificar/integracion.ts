// Tema 5 · Derivación e integración numérica: ejemplos resueltos y práctica del texto (cap. 5, Dr. H. Rojas),
// más comprobaciones de formas cerradas.
import * as A from '../../src/modules/integracion/algorithms.ts'
import { cerca, seccion, verdad } from './check.ts'

const ln = Math.log
const lnI = 2 * ln(2) - 1 // ∫₁² ln x dx = 0.386294…

/* ─────────────── Newton-Cotes ─────────────── */

seccion('Ej. 5.1 · trapecio compuesto, ∫₁² ln x dx, N = 6')
{
  const r = A.newtonCotes(ln, 1, 2, 6, 'trapecio')
  cerca('I ≈ 0.385139', r.value, '0.385139')
  cerca('suma interior Σ ln(x_k) = 1.964259', r.ys.slice(1, -1).reduce((t, v) => t + v, 0), '1.964259')
  const def = A.NC.trapecio
  const M = A.maxAbs((x) => -1 / x ** 2, 1, 2).M
  cerca('cota |E₆| ≤ H²/12 (b−a) max|f″| = 0.002315', def.C * 1 * r.h ** def.p * M, '0.002315')
  // El texto escribe E = 0.001055 (errata): 0.386294 − 0.385139 = 0.001155, coherente con su 0.30 %.
  cerca('error exacto E = 0.001155…', lnI - r.value, '0.001155', 1e-6)
  cerca('error relativo 0.30 %', (100 * (lnI - r.value)) / lnI, '0.30')
  cerca('tabla: N = 10 → 0.385878', A.newtonCotes(ln, 1, 2, 10, 'trapecio').value, '0.385878')
  cerca('tabla: N = 100 → 0.386290', A.newtonCotes(ln, 1, 2, 100, 'trapecio').value, '0.386290')
  cerca('tabla: N = 220 → 0.386294', A.newtonCotes(ln, 1, 2, 220, 'trapecio').value, '0.386294')
  // El texto rotula N = 5 la columna con 0.385139, que es el valor de N = 6; con N = 5 sale 0.384632.
  cerca('N = 5 (el texto repite 0.385139, que es N = 6)', A.newtonCotes(ln, 1, 2, 5, 'trapecio').value, '0.384632')
}

seccion('Ej. 5.2 · Simpson compuesto, ∫₁² ln x dx, N = 3 (2N = 6 subintervalos)')
{
  const r = A.newtonCotes(ln, 1, 2, 6, 'simpson13')
  cerca('I ≈ 0.386287', r.value, '0.386287')
  cerca('Σ impares = 1.165752', r.ys[1] + r.ys[3] + r.ys[5], '1.165752')
  cerca('Σ pares interiores = 0.798508', r.ys[2] + r.ys[4], '0.798508')
  const M = A.maxAbs((x) => -6 / x ** 4, 1, 2).M
  cerca('cota |E₆| ≤ H⁴/180 (b−a) max|f⁽⁴⁾| = 0.000026', A.NC.simpson13.C * r.h ** 4 * M, '0.000026')
  cerca('error exacto E = 0.000007', lnI - r.value, '0.000007')
}

seccion('Newton-Cotes: grado de exactitud y órdenes')
{
  cerca('trapecio exacto en x (∫₀² x = 2)', A.newtonCotes((x) => x, 0, 2, 1, 'trapecio').value, 2)
  cerca('Simpson exacto en x³ (∫₀² x³ = 4)', A.newtonCotes((x) => x ** 3, 0, 2, 2, 'simpson13').value, 4)
  cerca('Simpson 3/8 exacto en x³', A.newtonCotes((x) => x ** 3, 0, 2, 3, 'simpson38').value, 4)
  cerca('Boole exacto en x⁵ (∫₀² x⁵ = 64/6)', A.newtonCotes((x) => x ** 5, 0, 2, 4, 'boole').value, 64 / 6)
  cerca('Simpson simple ∫₀² x⁴ = 6.666667 (Burden)', A.newtonCotes((x) => x ** 4, 0, 2, 2, 'simpson13').value, 20 / 3)
  const e1 = Math.abs(A.newtonCotes(Math.sin, 0, Math.PI, 8, 'trapecio').value - 2)
  const e2 = Math.abs(A.newtonCotes(Math.sin, 0, Math.PI, 16, 'trapecio').value - 2)
  cerca('trapecio: E(h)/E(h/2) ≈ 4', e1 / e2, 4, 0.02)
  const s1 = Math.abs(A.newtonCotes(Math.sin, 0, Math.PI, 8, 'simpson13').value - 2)
  const s2 = Math.abs(A.newtonCotes(Math.sin, 0, Math.PI, 16, 'simpson13').value - 2)
  cerca('Simpson: E(h)/E(h/2) ≈ 16', s1 / s2, 16, 0.3)
  cerca('trapecio h variable (5.14) = uniforme cuando h es constante', A.trapecioNoUniforme([1, 1.5, 2], [ln(1), ln(1.5), ln(2)]), A.newtonCotes(ln, 1, 2, 2, 'trapecio').value)
}

seccion('Práctica 1 y 2 · trapecio (n = 2ᵏ) y Simpson (N = 1, 2, 4)')
{
  const I1 = (x: number) => Math.exp(-(x ** 2) / 2) / Math.sqrt(2 * Math.PI)
  const I2 = (x: number) => x ** 3 * Math.exp(x)
  const I3 = (x: number) => Math.cos(x) / Math.sqrt(x)
  const T = [
    [I1, -1, 1, ['0.483941', '0.640913', '0.672522', '0.680164']],
    [I2, 0, 1, ['1.359141', '0.782616', '0.619601', '0.577565']],
    [I3, 1, 2, ['0.123021', '0.090389', '0.082017', '0.079906']],
  ] as const
  T.forEach(([f, a, b, vals], j) => vals.forEach((v, k) => cerca(`I${j + 1} trapecio n = ${2 ** k}`, A.newtonCotes(f, a, b, 2 ** k, 'trapecio').value, v)))
  const S = [
    [I1, -1, 1, ['0.693237', '0.683058', '0.682711']],
    [I2, 0, 1, ['0.590440', '0.565263', '0.563553']],
    [I3, 1, 2, ['0.079511', '0.079227', '0.079202']],
  ] as const
  S.forEach(([f, a, b, vals], j) => vals.forEach((v, k) => cerca(`I${j + 1} Simpson N = ${2 ** k}`, A.newtonCotes(f, a, b, 2 * 2 ** k, 'simpson13').value, v)))
}

/* ─────────────── Romberg ─────────────── */

seccion('Ej. 5.3 · Romberg-Richardson, ∫₁² ln x dx, k_max = 3 (notación I_k^(m))')
{
  const r = A.romberg(ln, 1, 2, 4, 0)
  const I = A.rombergLibro(r.R)
  const esperado = [
    ['0.346574', '0.385835', '0.386288', '0.386294'],
    ['0.376019', '0.386260', '0.386294'],
    ['0.383700', '0.386292'],
    ['0.385644'],
  ]
  esperado.forEach((fila, k) => fila.forEach((v, m) => cerca(`I_${k}^(${m})`, I[k][m], v)))
  verdad('9 evaluaciones de f', r.evals === 9, String(r.evals))
  verdad('sin tolerancia se calculan las k_max + 1 filas', r.R.length === 4 && !r.converged)
  cerca('columna m = 1 coincide con Simpson (n = 2)', I[0][1], A.newtonCotes(ln, 1, 2, 2, 'simpson13').value)
  const t = A.romberg(Math.sin, 0, Math.PI, 12, 1e-10)
  verdad('con tolerancia se detiene antes', t.converged && t.R.length < 12)
  cerca('∫₀^π sen x = 2 (tol 1e-10)', t.value, 2, 1e-9)
}

seccion('Práctica 3 · Romberg n_max = 3; Práctica 7 · Romberg con datos (W = 8.5280)')
{
  const I1 = (x: number) => Math.exp(-(x ** 2) / 2) / Math.sqrt(2 * Math.PI)
  cerca('I1: I₀⁽³⁾ = 0.682693', A.romberg(I1, -1, 1, 4, 0).value, '0.682693')
  cerca('I2: I₀⁽³⁾ = 0.563436', A.romberg((x) => x ** 3 * Math.exp(x), 0, 1, 4, 0).value, '0.563436')
  cerca('I3: I₀⁽³⁾ = 0.079201', A.romberg((x) => Math.cos(x) / Math.sqrt(x), 1, 2, 4, 0).value, '0.079201')
  const d = A.rombergDatos([0, 0.09, 0.18, 0.27, 0.36], [0, 10, 22, 37, 52])
  verdad('datos: 5 puntos válidos', !('error' in d))
  if (!('error' in d)) cerca('W = 8.5280', d.value, '8.5280')
  verdad('datos: 4 puntos se rechazan', 'error' in A.rombergDatos([0, 1, 2, 3], [0, 1, 4, 9]))
  const g = A.rombergDatos([1, 1.25, 1.5, 1.75, 2], [1, 1.25, 1.5, 1.75, 2].map(ln))
  const f = A.romberg(ln, 1, 2, 3, 0)
  if (!('error' in g)) cerca('datos = función cuando los datos son f(xᵢ)', g.value, f.value)
}

/* ─────────────── Gauss-Legendre ─────────────── */

seccion('Ej. 5.4 / 5.5 · Gauss-Legendre, ∫₁² ln x dx')
{
  cerca('orden n = 1 (punto medio) = 0.405465', A.gaussQuad(ln, 1, 2, 1).value, '0.405465')
  cerca('orden n = 2 = 0.386595', A.gaussQuad(ln, 1, 2, 2).value, '0.386595')
  const q = A.gaussQuad(ln, 1, 2, 2)
  cerca('nodo x = 1.211325', q.xs[0], '1.211325')
  cerca('nodo x = 1.788675', q.xs[1], '1.788675')
  cerca('orden n = 5: 6 decimales correctos', A.gaussQuad(ln, 1, 2, 5).value, lnI, 5e-7)
}

seccion('Ej. 5.6 y tabla de nodos y pesos (ec. 5.38, 5.39)')
{
  const g2 = A.gaussLegendre(2)
  cerca('n = 2: z = 1/√3', g2.t[1], 1 / Math.sqrt(3))
  cerca('n = 2: w = 1 con la fórmula del texto (5.39)', A.pesoGaussLibro(2, 1 / Math.sqrt(3)), 1)
  const tabla: Record<number, [string, string][]> = {
    3: [['0.7745966692', '0.5555555556'], ['0', '0.8888888889']],
    4: [['0.8611363116', '0.3478548451'], ['0.3399810436', '0.6521451549']],
    5: [['0.9061798459', '0.2369268851'], ['0.5384693101', '0.4786286705'], ['0', '0.5688888889']],
    // El texto imprime ±0.6924695142 para el nodo exterior de n = 6; el valor correcto es ±0.9324695142.
    6: [['0.9324695142', '0.1713244924'], ['0.6612093865', '0.3607615730'], ['0.2386191861', '0.4679139346']],
  }
  for (const [n, filas] of Object.entries(tabla)) {
    const g = A.gaussLegendre(Number(n))
    filas.forEach(([z, w], i) => {
      const idx = g.t.length - 1 - i
      cerca(`n = ${n}: z = ±${z}`, Math.abs(g.t[idx]), z)
      cerca(`n = ${n}: w = ${w}`, g.w[idx], w)
      cerca(`n = ${n}: w con (5.39)`, A.pesoGaussLibro(Number(n), g.t[idx]), g.w[idx], 1e-12)
    })
  }
  cerca('n = 3 exacto en grado 5: ∫₋₁² (x⁵ − 2x³ + x + 1) dx', A.gaussQuad((x) => x ** 5 - 2 * x ** 3 + x + 1, -1, 2, 3).value, 63 / 6 - 7.5 + 1.5 + 3)
}

seccion('Práctica 4 · Gauss-Legendre orden 3 y 4')
{
  const I1 = (x: number) => Math.exp(-(x ** 2) / 2) / Math.sqrt(2 * Math.PI)
  const I2 = (x: number) => x ** 3 * Math.exp(x)
  const I3 = (x: number) => Math.cos(x) / Math.sqrt(x)
  cerca('I1 n = 3 = 0.682997', A.gaussQuad(I1, -1, 1, 3).value, '0.682997')
  cerca('I2 n = 3 = 0.563295', A.gaussQuad(I2, 0, 1, 3).value, '0.563295')
  cerca('I3 n = 3 = 0.079193 (el texto trunca 0.0791938)', A.gaussQuad(I3, 1, 2, 3).value, '0.079193', 1e-6)
  cerca('I1 n = 4 = 0.682680', A.gaussQuad(I1, -1, 1, 4).value, '0.682680')
  cerca('I2 n = 4 = 0.563436', A.gaussQuad(I2, 0, 1, 4).value, '0.563436')
  cerca('I3 n = 4 = 0.079200', A.gaussQuad(I3, 1, 2, 4).value, '0.079200')
}

/* ─────────────── Integrales dobles ─────────────── */

seccion('Ej. 5.7 · ∬ cos(x+y) sobre el triángulo 0 ≤ y ≤ x ≤ π, Gauss n = 2 × 2')
{
  const r = A.integralDoble((x, y) => Math.cos(x + y), 0, Math.PI, () => 0, (x) => x, 'gauss', 2, 2)
  cerca('I ≈ −1.909043', r.value, '-1.909043')
  cerca('x₁ = 0.663897', r.rows[0].x, '0.663897')
  cerca('x₂ = 2.477696', r.rows[1].x, '2.477696')
  cerca('h(0.663897) = 0.354413', r.rows[0].g, '0.354413')
  cerca('h(2.477696) = −1.569747', r.rows[1].g, '-1.569747')
  cerca('error relativo ≈ 4.5 %', (100 * Math.abs(r.value + 2)) / 2, '4.5')
  const ref = A.referenciaDoble((x, y) => Math.cos(x + y), 0, Math.PI, () => 0, (x) => x)
  cerca('referencia adaptativa = −2', ref.value, -2, 1e-9)
}

seccion('Práctica 6 y 8 · integrales dobles con Gauss (orden exterior n, interior m)')
{
  cerca('6.1 ∬ sen(x+y), 0≤x≤π, −3≤y≤3, n = 2, m = 3 → 0.749639', A.integralDoble((x, y) => Math.sin(x + y), 0, Math.PI, () => -3, () => 3, 'gauss', 2, 3).value, '0.749639')
  cerca('6.1 exacto 4 sen 3 = 0.564480', 4 * Math.sin(3), '0.564480')
  cerca('6.2 ∬ (x³+4y), x² ≤ y ≤ 2x, n = 2, m = 3 → 11.5555556', A.integralDoble((x, y) => x ** 3 + 4 * y, 0, 2, (x) => x * x, (x) => 2 * x, 'gauss', 2, 3).value, '11.5555556')
  cerca('8 momento de inercia del semicírculo, n = 2, m = 1 → 0.8165', A.integralDoble((x, y) => x * x + y * y, -1, 1, () => 0, (x) => Math.sqrt(1 - x * x), 'gauss', 2, 1).value, '0.8165')
  cerca('Simpson 2D exacto en x² + y² sobre [0,1]² (2/3)', A.integralDoble((x, y) => x * x + y * y, 0, 1, () => 0, () => 1, 'simpson13', 2, 2).value, 2 / 3)
}

/* ─────────────── Derivación numérica ─────────────── */

const mcos = (x: number) => -Math.cos(x)

seccion('Ej. 5.8 · primera derivada de −cos x en x = 0.1 (ec. 5.44–5.47)')
{
  const filas: [number, string, string, string, string][] = [
    [0.2, '0.198338380762099', '0', '0.09966711079379', '0.099833395854390'],
    [0.1, '0.149375874367841', '0.049958347219743', '0.09979182458924', '0.099833415347013'],
    [0.05, '0.124661746839669', '0.074921902338811', '0.09982301765757', '0.099833416565589'],
  ]
  for (const [h, av, re, ce, ex] of filas) {
    cerca(`h = ${h}: avance (5.44)`, A.diffApprox(mcos, 0.1, h, 'progresiva2'), av, 1e-14)
    cerca(`h = ${h}: retroceso (5.45)`, A.diffApprox(mcos, 0.1, h, 'regresiva2'), re, 1e-14)
    cerca(`h = ${h}: central x ± h/2 (5.46)`, A.diffApprox(mcos, 0.1, h, 'centralMedio'), ce, 1e-13)
    cerca(`h = ${h}: extrapolada (5.47)`, A.diffApprox(mcos, 0.1, h, 'extrapolada'), ex, 1e-14)
  }
  const e = (h: number) => Math.abs(A.diffApprox(mcos, 0.1, h, 'extrapolada') - Math.sin(0.1))
  cerca('extrapolada: error ≈ h⁴/7680·|f⁽⁵⁾(0.1)| (f⁽⁵⁾ = sen)', e(0.2), (0.2 ** 4 / 7680) * Math.sin(0.1), 2e-10)
  const r = A.richardsonDeriv(mcos, 0.1, 0.2, 2, 'centralMedio')
  cerca('Richardson de la central = extrapolada', r.N[1][1], A.diffApprox(mcos, 0.1, 0.2, 'extrapolada'), 1e-15)
}

seccion('Ej. 5.9 · derivada por interpolación lineal en (x ± h/2), −cos x en x = 0.1')
{
  const filas: [number, string, string][] = [
    [0.5, '0.098796', '1.038'],
    [0.25, '0.099574', '0.260'],
    [0.125, '0.099768', '0.065'],
  ]
  for (const [h, v, pct] of filas) {
    const D = A.diffApprox(mcos, 0.1, h, 'centralMedio')
    cerca(`h = ${h}: f′(0.1) ≈ ${v}… (el texto trunca)`, D, v, 1e-6)
    cerca(`h = ${h}: error relativo ${pct} %`, (100 * Math.abs(D - Math.sin(0.1))) / Math.sin(0.1), pct)
  }
}

seccion('Ej. 5.10 · segunda derivada de −cos x en x = 0 (ec. 5.49) y mayoración')
{
  const filas: [number, string, string, string][] = [
    [0.5, '0.979340', '0.020660', '0.020833'],
    [0.25, '0.994803', '0.005197', '0.005208'],
    [0.125, '0.998699', '0.001301', '0.001302'],
  ]
  for (const [h, v, err, may] of filas) {
    const D = A.diffApprox(mcos, 0, h, 'segunda3')
    cerca(`h = ${h}: f″(0) ≈ ${v}`, D, v)
    cerca(`h = ${h}: error exacto ${err}`, 1 - D, err)
    cerca(`h = ${h}: error mayorado h²/12·max|f⁽⁴⁾| = ${may}`, A.cotaDerivada('segunda3', 0, h, mcos).bound, may)
  }
}

seccion('Práctica derivación 1–3')
{
  const sx = (x: number) => Math.sin(x) / x
  const ex = Math.cos(0.01) / 0.01 - Math.sin(0.01) / 0.01 ** 2
  cerca("f′(0.01) exacta = −0.00333330000010…", ex, '-0.00333330000010', 1e-14)
  const P1: [number, string, string, string, string][] = [
    [0.2, '-0.03658571836668', '0.02994574664911', '-0.00332996789671', '-0.003333299702573'],
    [0.1, '-0.01998780351441', '0.01332786772099', '-0.00333246675111', '-0.003333299981519'],
    [0.05, '-0.01166450851846', '0.00499957501625', '-0.00333309167392', '-0.003333299998959'],
  ]
  // La respuesta del texto da la retroceso con signo cambiado: usa el recuadro de (5.45), que tiene un «−» de más
  // (en el Ej. 5.8 el texto sí usa (f(x) − f(x−h))/h). Aquí se compara con el valor correcto (positivo).
  for (const [h, av, re, ce, et] of P1) {
    cerca(`sen x / x, h = ${h}: avance`, A.diffApprox(sx, 0.01, h, 'progresiva2'), av, 1e-13)
    cerca(`sen x / x, h = ${h}: retroceso`, A.diffApprox(sx, 0.01, h, 'regresiva2'), re, 1e-13)
    cerca(`sen x / x, h = ${h}: central`, A.diffApprox(sx, 0.01, h, 'centralMedio'), ce, 1e-13)
    cerca(`sen x / x, h = ${h}: extrapolada`, A.diffApprox(sx, 0.01, h, 'extrapolada'), et, 1e-14)
  }
  const xc = (x: number) => x * Math.cos(x)
  const P2: [number, string][] = [
    [0.2, '-0.99500416527803'],
    [0.1, '-0.99875026039496'],
    [0.05, '-0.99968751627570'],
  ]
  for (const [h, v] of P2) cerca(`x cos x en π, h = ${h}`, A.diffApprox(xc, Math.PI, h, 'centralMedio'), v, 1e-13)
  const P3: [number, string, string][] = [
    [0.2, '-0.74577445834634', '0.21131271508687'],
    [0.1, '-0.71613610979359', '0.01930101110943'],
    [0.05, '-0.70932816543676', '0.00319511313657'],
  ]
  for (const [h, v, may] of P3) {
    cerca(`√x, f″(0.5), h = ${h}`, A.diffApprox(Math.sqrt, 0.5, h, 'segunda3'), v, 1e-12)
    cerca(`√x, mayoración h = ${h}`, A.cotaDerivada('segunda3', 0.5, h, (x) => (-15 / 16) * x ** -3.5).bound, may, 1e-12)
  }
}

seccion('Derivación: órdenes y Richardson')
{
  const f = (x: number) => x * Math.exp(x)
  const d1 = 3 * Math.exp(2)
  for (const s of Object.keys(A.SCHEMES) as A.DiffScheme[]) {
    const sc = A.SCHEMES[s]
    const ex = sc.k === 1 ? d1 : 4 * Math.exp(2)
    const e1 = Math.abs(A.diffApprox(f, 2, 0.1, s) - ex)
    const e2 = Math.abs(A.diffApprox(f, 2, 0.05, s) - ex)
    cerca(`${sc.label}: orden observado ≈ ${sc.p}`, Math.log2(e1 / e2), sc.p, 0.15)
  }
  const r = A.richardsonDeriv(f, 2, 0.2, 4, 'progresiva2')
  cerca('Richardson desde avance (4 niveles) ≈ 3e²', r.N[3][3], d1, 1e-4)
  verdad('factores de avance: 2, 4, 8', r.factors.slice(1).join(',') === '2,4,8', r.factors.join(','))
  const c = A.richardsonDeriv(f, 2, 0.2, 3, 'centrada5')
  verdad('factores de la centrada de 5 puntos: 16, 64', c.factors.slice(1).join(',') === '16,64', c.factors.join(','))
}
