// Tema 3 — Sistemas de ecuaciones lineales y no lineales.
// Ejemplos resueltos del texto (Rojas, cap. 3), su práctica y resultados conocidos (formas cerradas, Burden).
import { cerca, seccion, verdad } from './check.ts'
import {
  cSums, colDominance, det, diagDominance, eigenvalues, fl, gauss, gaussOps, inverse, iterativo, lu, newtonSistema, norm1M, normInfM, potencia,
  puntoFijoSistema, singularExtremes, solve, thomas, type Mat, type Vec,
} from '../../src/modules/sistemas/algorithms.ts'

const vec = (desc: string, x: Vec, esperado: (number | string)[], tol?: number) => esperado.forEach((e, i) => cerca(`${desc} x${i + 1}`, x[i], e, tol))

seccion('Aritmética de t cifras (fl)')
cerca('fl(0.13365, 4) (empate → hacia afuera)', fl(0.13365, 4), 0.1337)
cerca('fl(1.372 · 0.6867, 4)', fl(1.372 * 0.6867, 4), 0.9422)
cerca('fl(−0.0026265, 4)', fl(-0.0026265, 4), -0.002627)
cerca('fl(9.99996, 4) → 10.00', fl(9.99996, 4), 10)
cerca('fl(2.0035, 4)', fl(2.0035, 4), 2.004)
cerca('fl(x, 0) = x', fl(Math.PI, 0), Math.PI)

// Ej. 3.1: sistema con 4 cifras, con y sin pivoteo
const A31: Mat = [
  [0.729, 0.81, 0.9],
  [1, 1, 1],
  [1.331, 1.21, 1.1],
]
const b31: Vec = [0.6867, 0.8338, 1]
seccion('Ej. 3.1 — Gauss con pivoteo, 4 cifras')
{
  const r = gauss(A31, b31, 'parcial', 4)
  verdad('primer pivote: fila 3 (1.331)', r.steps[0].swap?.[1] === 2)
  cerca('m₂₁ = 0.7513', r.steps[0].mult.find((m) => m.i === 1)!.m, '0.7513')
  cerca('m₃₁ = 0.5477', r.steps[0].mult.find((m) => m.i === 2)!.m, '0.5477')
  verdad('segundo pivote: intercambio (0.1473 > 0.09090)', r.steps[1].swap !== null)
  cerca('a₂₂⁽²⁾ = 0.1473', r.aug[1][1], '0.1473')
  cerca('a₂₃⁽²⁾ = 0.2975', r.aug[1][2], '0.2975')
  cerca('b₂⁽²⁾ = 0.1390', r.aug[1][3], '0.1390')
  cerca('a₃₃⁽²⁾ = −0.01000', r.aug[2][2], '-0.01000')
  cerca('b₃⁽²⁾ = −0.003280', r.aug[2][3], '-0.003280')
  vec('Ej. 3.1 con pivoteo', r.x, ['0.2246', '0.2812', '0.3280'])
}
seccion('Ej. 3.1 — Gauss sin pivoteo, 4 cifras')
{
  const r = gauss(A31, b31, 'none', 4)
  cerca('m₂₁ = 1.372', r.steps[0].mult[0].m, '1.372')
  cerca('m₃₁ = 1.826', r.steps[0].mult[1].m, '1.826')
  cerca('m₃₂ = 2.423', r.steps[1].mult[0].m, '2.423')
  cerca('a₃₃⁽²⁾ = 0.02640', r.aug[2][2], '0.02640')
  cerca('b₃⁽²⁾ = 0.008700', r.aug[2][3], '0.008700')
  vec('Ej. 3.1 sin pivoteo', r.x, ['0.2251', '0.2790', '0.3295'])
  const ex = gauss(A31, b31, 'parcial')
  vec('Ej. 3.1 solución exacta (Matlab)', ex.x, ['0.22454545', '0.28136364', '0.32789091'])
}
seccion('Tabla de operaciones de Gauss (texto)')
{
  const n = 10
  const o = gaussOps(n)
  cerca('restas triangularización Σi² = (n−1)n(2n−1)/6', o.tri.sub, 285)
  cerca('divisiones triangularización (n−1)n/2', o.tri.div, 45)
  cerca('divisiones sustitución n', o.back.div, 10)
  const r = gauss(Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? n + 1 : 1 / (i + j + 1)))), new Array(n).fill(1), 'none')
  verdad('conteo real = tabla (matriz A)', r.ops.tri.sub === o.tri.sub && r.ops.tri.mul === o.tri.mul && r.ops.tri.div === o.tri.div)
  verdad('conteo real = tabla (sustitución)', r.ops.back.sub === o.back.sub && r.ops.back.mul === o.back.mul && r.ops.back.div === o.back.div)
  verdad('transformación de b: (n−1)n/2 mult. y restas', r.ops.rhs.mul === 45 && r.ops.rhs.sub === 45)
}
seccion('Práctica 01 — Gauss con pivoteo (S₁), 4 cifras')
{
  const r = gauss(
    [
      [1.2034, -9.0718, 0.25645],
      [2.0035, -4.0203, 0.63452],
      [0.98867, -0.67498, 3.2457],
    ],
    [5.2346, 3.6678, -0.46798],
    'parcial',
    4,
  )
  cerca('u₁₁ = 2.004', r.aug[0][0], '2.004')
  cerca('u₂₂ = −6.659', r.aug[1][1], '-6.659')
  cerca('u₂₃ = −0.1244', r.aug[1][2], '-0.1244')
  cerca('u₃₃ = 2.909', r.aug[2][2], '2.909')
  vec('B', r.aug.map((q) => q[3]), ['3.668', '3.033', '-1.682'])
  vec('Práct. 01', r.x, ['1.121', '-0.4447', '-0.5782'])
}

seccion('Ej. 3.2 — LU de Doolittle, 4 cifras (sistema del Ej. 3.1 reordenado)')
{
  const r = lu(
    [
      [1.331, 1.21, 1.1],
      [1, 1, 1],
      [0.729, 0.81, 0.9],
    ],
    [1, 0.8338, 0.6867],
    'doolittle',
    4,
  )
  cerca('l₂₁ = 0.7513', r.L[1][0], '0.7513')
  cerca('l₃₁ = 0.5477', r.L[2][0], '0.5477')
  cerca('l₃₂ = 1.620', r.L[2][1], '1.620')
  cerca('u₂₂ = 0.09090', r.U[1][1], '0.09090')
  cerca('u₂₃ = 0.1736', r.U[1][2], '0.1736')
  cerca('u₃₃ = 0.01630', r.U[2][2], '0.01630')
  vec('y', r.y, ['1.000', '0.08250', '0.005300'])
  vec('Ej. 3.2', r.x, ['0.2220', '0.2866', '0.3252'])
}
seccion('Práctica 02 — LU de Doolittle (S₂), 4 cifras')
{
  const A2: Mat = [
    [1.0657, 0.34252, -2.7826],
    [-2.0986, 0.37852, 0.52046],
    [0.56722, 3.4967, 1.5874],
  ]
  const b2: Vec = [1.0035, 0.64246, 2.0645]
  const r = lu(A2, b2, 'doolittle', 4)
  cerca('l₂₁ = −1.969', r.L[1][0], '-1.969')
  cerca('l₃₁ = 0.5321', r.L[2][0], '0.5321')
  cerca('l₃₂ = 3.148', r.L[2][1], '3.148')
  cerca('u₂₂ = 1.053', r.U[1][1], '1.053')
  cerca('u₂₃ = −4.960', r.U[1][2], '-4.960')
  // El texto da u₃₃ = 18.67 y x = (−0.2520, 0.7930, −0.3598): con redondeo correcto a 4 cifras,
  // u₃₃ = 1.587 + 1.481 + 15.61 = 18.68. Su "x exacta" (−0.251973, 0.794521, −0.359497) no satisface S₂ tal
  // como está impreso (residuo ≈ 4·10⁻⁴), así que se verifica contra la solución exacta de los datos impresos.
  cerca('u₃₃ = 18.68 (texto: 18.67)', r.U[2][2], '18.68')
  vec('Práct. 02 (4 cifras)', r.x, ['-0.2523', '0.7939', '-0.3596'])
  vec('Práct. 02 exacta', lu(A2, b2, 'doolittle').x, ['-0.251969', '0.794420', '-0.359347'])
  const inv = inverse(A2)!
  cerca('(A⁻¹)₁₂ exacta = −0.4902', inv[0][1], '-0.4902')
  cerca('(A⁻¹)₃₃ exacta = 0.05354', inv[2][2], '0.05354')
}
seccion('LU: Crout, PA = LU, Cholesky (complementos)')
{
  const A: Mat = [
    [2, 1, -1],
    [-3, -1, 2],
    [-2, 1, 2],
  ]
  const b: Vec = [8, -11, -3]
  for (const k of ['doolittle', 'crout', 'pivoteo'] as const) vec(k, lu(A, b, k).x, [2, 3, -1], 1e-12)
  cerca('Crout: u₁₂ = 1/2', lu(A, b, 'crout').U[0][1], 0.5)
  const c = lu(
    [
      [4, 12, -16],
      [12, 37, -43],
      [-16, -43, 98],
    ],
    [0, 6, 39],
    'cholesky',
  )
  cerca('Cholesky l₃₃ = 3', c.L[2][2], 3)
  cerca('det(A) = 36', c.det, 36, 1e-9)
}

seccion('Práctica 04.2 — Thomas (S₅)')
{
  const S5 = [[-0.46521, 3.5023, 0.38471], [1.3456, 3.0576, 1.4936, 4.46723], [0.35679, -1.3925, -0.94618], [0, -2.5284, 0.38519, -1.3762]] as const
  // Respuesta del texto con 4 cifras: (0.1033, −0.3895, 0.9251, −0.3876); aquí x₃ = 0.9250. Su "x exacta"
  // (0.103248, −0.389494, 0.925266, −0.387721) no satisface S₅ tal como está impreso (residuo ≈ 10⁻³).
  vec('S₅ con 4 cifras', thomas(...(S5 as unknown as [Vec, Vec, Vec, Vec]), 4).x, ['0.1033', '-0.3895', '0.9250', '-0.3876'])
  const r = thomas(...(S5 as unknown as [Vec, Vec, Vec, Vec]))
  vec('S₅ exacta (datos impresos)', r.x, ['0.103301', '-0.389590', '0.925770', '-0.387791'])
  const b = thomas([-1, -1, -1], [2, 2, 2, 2], [-1, -1, -1], [1, 0, 0, 1])
  vec('Burden (1,1,1,1)', b.x, [1, 1, 1, 1], 1e-12)
  cerca('b₂⁽¹⁾ = 2 − (−1/2)(−1) = 1.5', b.rows[1].bk, 1.5)
  cerca('variante normalizada c′₁ = −1/2', b.rows[0].cp, -0.5)
}

// Ej. 3.3
const b33: Vec = [1, 0.8484, 0.6867]
const A33: Mat = [
  [1.431, 1.21, 1.1],
  [0.331, 1.3, 0.7],
  [0.729, 0.81, 1.6],
]
seccion('Ej. 3.3 — criterio de suficiencia (sistema reordenado)')
{
  const f = diagDominance(A33)
  const c = colDominance(A33)
  cerca('fila 1: Σ|a₁ⱼ| = 2.31', f.rows[0].off, 2.31)
  cerca('fila 2: Σ|a₂ⱼ| = 1.031', f.rows[1].off, 1.031)
  cerca('fila 3: Σ|a₃ⱼ| = 1.539', f.rows[2].off, 1.539)
  cerca('columna 1: Σ|aᵢ₁| = 1.06', c.rows[0].off, 1.06)
  cerca('columna 2: Σ|aᵢ₂| = 2.02', c.rows[1].off, 2.02)
  cerca('columna 3: Σ|aᵢ₃| = 1.80', c.rows[2].off, 1.8)
  verdad('no se cumple por filas ni por columnas', !f.strict && !c.strict)
  verdad('con C: sumas por filas ≥ 1 en la fila 1', !cSums(A33)!.rowOk)
}
seccion('Ej. 3.3 — Gauss-Jacobi (diverge) y Gauss-Seidel (converge), x⁽⁰⁾ = 0')
{
  const o = { omega: 1, tol: 0, maxIter: 100, crit: 'abs' as const, norm: '2' as const }
  const j = iterativo(A33, b33, [0, 0, 0], { ...o, method: 'jacobi' })
  vec('Jacobi k=1', j.rows[1].x, ['0.698812', '0.652615', '0.429188'])
  vec('Jacobi k=3', j.rows[3].x, ['0.661646', '0.817435', '0.389219'])
  vec('Jacobi k=10', j.rows[10].x, ['-0.524616', '0.163031', '-0.430578'])
  vec('Jacobi k=100', j.rows[100].x, ['-148.324010', '-89.044468', '-106.408966'])
  const g = iterativo(A33, b33, [0, 0, 0], { ...o, method: 'gs', maxIter: 50 })
  vec('Gauss-Seidel k=1', g.rows[1].x, ['0.698812', '0.474687', '-0.129519'])
  vec('Gauss-Seidel k=3', g.rows[3].x, ['0.224383', '0.631138', '0.007440'])
  vec('Gauss-Seidel k=10', g.rows[10].x, ['0.162440', '0.577182', '0.062978'])
  vec('Gauss-Seidel → solución', g.x, ['0.16215445262197', '0.57740939792756', '0.06299236982329'])
}
seccion('Ej. 3.3 — sistema modificado a₂₁ = 2.431, eps = 10⁻⁴ (norma euclidiana)')
{
  const A: Mat = [
    [2.431, 1.21, 1.1],
    [0.331, 1.3, 0.7],
    [0.729, 0.81, 1.6],
  ]
  verdad('ahora es EDD por filas', diagDominance(A).strict)
  const o = { omega: 1, tol: 1e-4, maxIter: 500, crit: 'abs' as const, norm: '2' as const }
  const j = iterativo(A, b33, [0, 0, 0], { ...o, method: 'jacobi' })
  cerca('Jacobi: 86 iteraciones', j.rows.length - 1, 86, 0)
  vec('Jacobi k=86', j.x, ['0.077738', '0.578462'])
  const g = iterativo(A, b33, [0, 0, 0], { ...o, method: 'gs' })
  cerca('Gauss-Seidel: 10 iteraciones', g.rows.length - 1, 10, 0)
  vec('Gauss-Seidel k=10', g.x, ['0.077791', '0.578478', '0.100890'])
  vec('solución exacta', solve(A, b33)!, ['0.07776411056545', '0.57848589072445', '0.10089774494436'])
}
seccion('Práctica 03 — S₃ reordenado, 4 iteraciones desde x⁽⁰⁾ = 0')
{
  const A: Mat = [
    [4, 1, 1, -1],
    [1, 9, 3, 4],
    [-1, 3, 7, 2],
    [0, 1, 0, 6],
  ]
  const b: Vec = [-3, 15, 10, 2]
  verdad('EDD por filas', diagDominance(A).strict)
  verdad('no EDD por columnas', !colDominance(A).strict)
  const o = { omega: 1, tol: 0, maxIter: 4, crit: 'abs' as const, norm: '2' as const }
  vec('Jacobi x⁽⁴⁾', iterativo(A, b, [0, 0, 0, 0], { ...o, method: 'jacobi' }).x, ['-1.302540', '1.487682', '0.524124', '0.061434'])
  vec('Gauss-Seidel x⁽⁴⁾', iterativo(A, b, [0, 0, 0, 0], { ...o, method: 'gs' }).x, ['-1.268669', '1.596748', '0.543882', '0.067209'])
  vec('exacta', solve(A, b)!, ['-1.268272', '1.596346', '0.544020', '0.067276'])
}
seccion('SOR (Burden, ej. 7.4.x): ω = 1.25 converge más rápido que Gauss-Seidel')
{
  const A: Mat = [
    [4, 3, 0],
    [3, 4, -1],
    [0, -1, 4],
  ]
  const o = { tol: 1e-7, maxIter: 200, crit: 'abs' as const, norm: 'inf' as const, method: 'gs' as const }
  const s = iterativo(A, [24, 30, -24], [1, 1, 1], { ...o, omega: 1.25 })
  const g = iterativo(A, [24, 30, -24], [1, 1, 1], { ...o, omega: 1 })
  vec('SOR', s.x, [3, 4, -5], 1e-6)
  verdad(`SOR (${s.rows.length - 1}) < Gauss-Seidel (${g.rows.length - 1}) iteraciones`, s.rows.length < g.rows.length)
}

seccion('Ej. 3.4 — número de condición')
{
  const A: Mat = [
    [0.9999, -1.0001],
    [1, -1],
  ]
  const inv = inverse(A)!
  vec('A⁻¹ fila 1', inv[0], [-5000, 5000.5], 1e-8)
  vec('A⁻¹ fila 2', inv[1], [-5000, 4999.5], 1e-8)
  cerca('‖A‖₁ = 2.0001', norm1M(A), 2.0001)
  cerca('‖A⁻¹‖₁ = 10000.0', norm1M(inv), 10000, 1e-8)
  cerca('‖A‖∞ = 2.0000', normInfM(A), 2)
  cerca('‖A⁻¹‖∞ = 10000.5', normInfM(inv), 10000.5, 1e-8)
  cerca('κ∞ = 20001', normInfM(A) * normInfM(inv), 20001, 1e-6)
  const x = solve(A, [1, 1])!
  vec('x (b = (1, 1))', x, [0.5, -0.5], 1e-10)
  const e = 1e-3
  const xe = solve(A, [1, 1 + e])!
  cerca('x(ε) = 0.5 + 5000.5ε', xe[0], 0.5 + 5000.5 * e, 1e-8)
  cerca('y(ε) = −0.5 + 4999.5ε', xe[1], -0.5 + 4999.5 * e, 1e-8)
}
seccion('Práctica 05 — Hilbert 4')
{
  const H: Mat = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => 1 / (i + j + 1)))
  const sv = singularExtremes(H)!
  cerca('κ₂(H₄) = cond(H₄) = 15513.7', sv.max / sv.min, '15513.7')
  vec('x', solve(H, [1, 2, 3, 4])!, [-64, 900, -2520, 1820], 1e-8)
  const H2 = H.map((r) => r.slice())
  H2[1][0] = 1.0001 / 2
  vec('x con a₂₁ = 1.0001/2', solve(H2, [1, 2, 3, 4])!, ['-64.4', '903.9', '-2528.7', '1825.4'])
  cerca('det(H₄) = 1/6048000', det(H), 1 / 6048000, 1e-18)
}

const newton2 = (f1: (x: number, y: number) => number, f2: (x: number, y: number) => number, J: ((x: number, y: number) => number)[][], x0: Vec, it: number) =>
  newtonSistema([f1, f2] as any, J as any, x0, { tol: 0, maxIter: it })
seccion('Ej. 3.6 — Newton: x² − y = 0.2, y² − x = 0.3')
{
  const f1 = (x: number, y: number) => x * x - y - 0.2
  const f2 = (x: number, y: number) => y * y - x - 0.3
  const J = [
    [(x: number) => 2 * x, () => -1],
    [() => -1, (_: number, y: number) => 2 * y],
  ]
  const r = newton2(f1, f2, J, [-0.3, -0.1], 2)
  // el texto trunca ("0.0136363..") ⇒ tolerancia de una unidad del último decimal
  vec('Δ⁽⁰⁾', r.rows[0].dx, [0.0136363, -0.0181818], 1e-7)
  vec('x⁽¹⁾', r.rows[0].xn, [-0.286363, -0.118181], 1e-6)
  cerca('f₁(x⁽¹⁾) = 0.185950e−3', r.rows[1].F[0], 0.18595e-3, 1e-9)
  cerca('f₂(x⁽¹⁾) = 0.330578e−3', r.rows[1].F[1], 0.330578e-3, 1e-9)
  vec('x⁽²⁾', r.x, [-0.286032, -0.118185], 1e-6)
  const s = newton2(f1, f2, J, [1.2, 1.2], 2)
  vec('Δ⁽⁰⁾ desde (1.2, 1.2)', s.rows[0].dx, [-0.007563, 0.021848], 1e-6)
  vec('x⁽¹⁾', s.rows[0].xn, [1.192436, 1.221848], 1e-6)
  vec('x⁽²⁾', s.x, [1.192309, 1.221601], 1e-6)
}
seccion('Práctica 6.1 — Newton: 4x² − y² − 1 = 0, x² − 2x + y² − 4y − 3 = 0')
{
  const f1 = (x: number, y: number) => 4 * x * x - y * y - 1
  const f2 = (x: number, y: number) => x * x - 2 * x + y * y - 4 * y - 3
  const J = [
    [(x: number) => 8 * x, (_: number, y: number) => -2 * y],
    [(x: number) => 2 * x - 2, (_: number, y: number) => 2 * y - 4],
  ]
  const r = newton2(f1, f2, J, [0.5, -0.8], 2)
  vec('x⁽¹⁾', r.rows[1].x, ['0.665384615384615', '-0.813461538461538'])
  vec('x⁽²⁾', r.x, ['0.642539119125331', '-0.805851305928887'])
  const s = newton2(f1, f2, J, [-1.7, 3], 2)
  vec('x⁽²⁾ desde (−1.7, 3)', s.x, ['-1.616446568957439', '3.074342623191941'])
}
seccion('Ej. 3.5 — x² + y² = 2, xy = 1: raíz doble en (1, 1), J singular ⇒ Newton lineal')
{
  const r = newtonSistema(
    [(x: number, y: number) => x * x + y * y - 2, (x: number, y: number) => x * y - 1] as any,
    [
      [(x: number) => 2 * x, (_: number, y: number) => 2 * y],
      [(_: number, y: number) => y, (x: number) => x],
    ] as any,
    [1.5, 0.8],
    { tol: 1e-7, maxIter: 100 },
  )
  vec('→ (1, 1)', r.x, [1, 1], 1e-6)
  verdad(`convergencia lenta (${r.rows.length} iteraciones > 10)`, r.rows.length > 10)
}

seccion('Ej. 3.7 — punto fijo: x² − 2x − y + 0.5 = 0, x² + 4y² − 4 = 0')
{
  const g1 = (x: number, y: number) => Math.sqrt(2 * x + y - 0.5)
  const g2 = (x: number) => Math.sqrt(4 - x * x) / 2
  const r = puntoFijoSistema([g1, g2] as any, [1.6, 0.1], { tol: 0, maxIter: 30, seidel: false })
  vec('k=1', r.rows[1].x, ['1.673320053068151', '0.600000000000000'])
  vec('k=10', r.rows[10].x, ['1.902301391801866', '0.304803143188226'])
  vec('k=20', r.rows[20].x, ['1.900704571531789', '0.311203749522654'])
  vec('k=30', r.rows[30].x, ['1.900676791812875', '0.311219136351415'])
  const s = puntoFijoSistema([g1, g2] as any, [1.6, 0.1], { tol: 0, maxIter: 10, seidel: true })
  vec('Seidel k=1', s.rows[1].x, ['1.673320053068151', '0.547722557505166'])
  vec('Seidel k=10', s.x, ['1.900676721163405', '0.311218573364255'])
  const h1 = (x: number, y: number) => (x * x - y + 0.5) / 2
  const t = puntoFijoSistema([h1, g2] as any, [-0.2, 1], { tol: 0, maxIter: 10, seidel: false })
  vec('2.ª raíz k=1', t.rows[1].x, ['-0.230000000000000', '0.994987437106620'])
  vec('2.ª raíz k=10', t.x, ['-0.222214554625582', '0.993808418323179'])
}
seccion('Práctica 6.2 — punto fijo: x² − y − 0.2 = 0, y² − x − 0.3 = 0')
{
  const r = puntoFijoSistema([(_: number, y: number) => Math.sqrt(y + 0.2), (x: number) => Math.sqrt(x + 0.3)] as any, [1.2, 1.2], { tol: 0, maxIter: 2, seidel: false })
  vec('k=1', r.rows[1].x, ['1.183215956619923', '1.224744871391589'])
  vec('k=2', r.x, ['1.193626772233092', '1.217873538845443'])
  const s = puntoFijoSistema([(_: number, y: number) => y * y - 0.3, (x: number) => x * x - 0.2] as any, [-0.3, -0.2], { tol: 0, maxIter: 2, seidel: false })
  vec('k=1 (2.ª raíz)', s.rows[1].x, ['-0.26', '-0.11'])
  vec('k=2 (2.ª raíz)', s.x, ['-0.2879', '-0.1324'])
}

seccion('Valores propios (complemento): potencia, Burden ej. 9.2')
{
  const A: Mat = [
    [-4, 14, 0],
    [-5, 13, 0],
    [-1, 0, 2],
  ]
  cerca('λ dominante = 6', potencia(A, [1, 1, 1], { variant: 'directa', shift: 0, tol: 1e-10, maxIter: 200 }).lambda, 6, 1e-8)
  cerca('potencia inversa q = 0 → λ = 2', potencia(A, [1, 1, 1], { variant: 'inversa', shift: 0, tol: 1e-12, maxIter: 200 }).lambda, 2, 1e-8)
  const ev = eigenvalues(A)!.map((c) => c.re).sort((a, b) => a - b)
  vec('spec(A) = {2, 3, 6}', ev, [2, 3, 6], 1e-10)
}
