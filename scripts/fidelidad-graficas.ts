// Prueba de fidelidad del muestreo de gráficas (src/lib/plotmath.ts).
// Compara la polilínea que se dibuja contra la función exacta en una malla muy fina.
//   pnpm test:graficas
import { sampleFn } from '../src/lib/plotmath.ts'

type Caso = { nombre: string; f: (x: number) => number; a: number; b: number; ventana: [number, number]; maxErr: number; cortesMin?: number; cortesMax?: number }

function medir(c: Caso) {
  const s = sampleFn(c.f, c.a, c.b)
  const N = 100001
  const H = c.ventana[1] - c.ventana[0]
  let maxErr = 0, huecos = 0, visibles = 0, j = 0
  for (let k = 0; k < N; k++) {
    const x = c.a + ((c.b - c.a) * k) / (N - 1)
    const fx = c.f(x)
    if (!Number.isFinite(fx)) continue
    const dentro = fx >= c.ventana[0] && fx <= c.ventana[1]
    while (j < s.x.length - 2 && s.x[j + 1] < x) j++
    const y0 = s.y[j], y1 = s.y[j + 1]
    if (y0 === null || y1 === null) {
      if (dentro) (huecos++, visibles++)
      continue
    }
    const t = (x - s.x[j]) / (s.x[j + 1] - s.x[j] || 1)
    const clamp = (v: number) => Math.min(Math.max(v, c.ventana[0]), c.ventana[1])
    const e = Math.abs(clamp(y0 + t * (y1 - y0)) - clamp(fx)) / H
    if (dentro) visibles++
    maxErr = Math.max(maxErr, e)
  }
  return { maxErr, huecos: huecos / Math.max(1, visibles), cortes: s.y.filter((v) => v === null).length, puntos: s.x.length }
}

const casos: Caso[] = [
  { nombre: 'sin(x)', f: Math.sin, a: -10, b: 10, ventana: [-1.2, 1.2], maxErr: 0.005, cortesMax: 0 },
  { nombre: 'sin(50x)', f: (x) => Math.sin(50 * x), a: 0, b: 2, ventana: [-1.2, 1.2], maxErr: 0.01, cortesMax: 0 },
  { nombre: 'pico estrecho', f: (x) => 1000 * Math.exp(-2000 * (x - 0.3) ** 2), a: -3, b: 3, ventana: [-50, 1050], maxErr: 0.01, cortesMax: 0 },
  { nombre: 'tan(x)', f: Math.tan, a: -5, b: 5, ventana: [-10, 10], maxErr: 0.01, cortesMin: 4, cortesMax: 4 },
  { nombre: '1/x', f: (x) => 1 / x, a: -2, b: 2, ventana: [-20, 20], maxErr: 0.01, cortesMin: 1, cortesMax: 1 },
  { nombre: 'floor(x)', f: Math.floor, a: -3, b: 3, ventana: [-3.5, 3.5], maxErr: 0.01, cortesMin: 5, cortesMax: 6 },
  { nombre: '|x|/x', f: (x) => Math.abs(x) / x, a: -2, b: 2, ventana: [-1.5, 1.5], maxErr: 0.01 },
  { nombre: 'atan(1000x) (continua)', f: (x) => Math.atan(1000 * x), a: -1, b: 1, ventana: [-1.7, 1.7], maxErr: 0.01, cortesMax: 0 },
  { nombre: 'Runge', f: (x) => 1 / (1 + 25 * x * x), a: -1, b: 1, ventana: [-0.1, 1.1], maxErr: 0.005, cortesMax: 0 },
  { nombre: 'e^x', f: Math.exp, a: -3, b: 10, ventana: [-1000, 23000], maxErr: 0.005, cortesMax: 0 },
  { nombre: 'sqrt(x)', f: Math.sqrt, a: -1, b: 4, ventana: [-0.2, 2.2], maxErr: 0.01 },
  { nombre: 'x·sin(1/x)', f: (x) => x * Math.sin(1 / x), a: -0.5, b: 0.5, ventana: [-0.6, 0.6], maxErr: 0.03 },
  { nombre: '1/sin(x)', f: (x) => 1 / Math.sin(x), a: -7, b: 7, ventana: [-10, 10], maxErr: 0.01, cortesMin: 5 },
]

let fallos = 0
for (const c of casos) {
  const r = medir(c)
  const problemas: string[] = []
  if (r.maxErr > c.maxErr) problemas.push(`error ${(100 * r.maxErr).toFixed(2)}% > ${(100 * c.maxErr).toFixed(2)}%`)
  if (r.huecos > 0.002) problemas.push(`huecos falsos ${(100 * r.huecos).toFixed(2)}%`)
  if (c.cortesMin !== undefined && r.cortes < c.cortesMin) problemas.push(`cortes ${r.cortes} < ${c.cortesMin}`)
  if (c.cortesMax !== undefined && r.cortes > c.cortesMax) problemas.push(`cortes ${r.cortes} > ${c.cortesMax}`)
  if (problemas.length) fallos++
  console.log(`${problemas.length ? '✗' : '✓'} ${c.nombre.padEnd(24)} error ${(100 * r.maxErr).toFixed(3).padStart(7)}%  cortes ${String(r.cortes).padStart(2)}  puntos ${r.puntos}${problemas.length ? '  ← ' + problemas.join(', ') : ''}`)
}
console.log(fallos ? `\n${fallos} caso(s) fallaron` : '\nTodas las gráficas dentro de tolerancia.')
process.exit(fallos ? 1 : 0)
