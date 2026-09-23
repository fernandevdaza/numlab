// Herramientas: rutinas numéricas puras de la calculadora y el graficador (integración y raíces).
import { integrateNumeric, numericRoots } from '../../src/modules/cas/numerico.ts'
import { cerca, seccion, verdad } from './check.ts'

seccion('Integración numérica (tanh-sinh + Simpson adaptativo)')
cerca('∫₀^π sen x dx = 2', integrateNumeric(Math.sin, 0, Math.PI), 2, 1e-12)
cerca('∫₀¹ eˣ dx = e − 1', integrateNumeric(Math.exp, 0, 1), Math.E - 1, 1e-12)
cerca('∫₀¹ 1/√x dx = 2 (singularidad en el extremo)', integrateNumeric((x) => 1 / Math.sqrt(x), 0, 1), 2, 1e-8)
cerca('∫₀^∞ e^(−x²) dx = √π/2', integrateNumeric((x) => Math.exp(-x * x), 0, Infinity), Math.sqrt(Math.PI) / 2, 1e-10)
cerca('∫₋∞^∞ 1/(1+x²) dx = π', integrateNumeric((x) => 1 / (1 + x * x), -Infinity, Infinity), Math.PI, 1e-9)
cerca('∫₁⁰ x dx = −½ (límites invertidos)', integrateNumeric((x) => x, 1, 0), -0.5, 1e-13)
cerca('∫₋₁¹ |x| dx = 1 (no derivable)', integrateNumeric(Math.abs, -1, 1), 1, 1e-9)

seccion('Raíces por muestreo + bisección')
{
  const r = numericRoots((x) => x ** 3 + 4 * x ** 2 - 10, -5, 5)
  verdad(`x³ + 4x² − 10: una raíz real (${r.length})`, r.length === 1)
  cerca('… = 1.3652300134141', r[0], 1.3652300134141, 1e-12)
  const s = numericRoots(Math.sin, -1, 10)
  verdad(`sen x en [−1, 10]: 0, π, 2π, 3π (${s.map((v) => v.toFixed(6)).join(', ')})`, s.length === 4 && Math.abs(s[3] - 3 * Math.PI) < 1e-12)
  verdad('tan x en [1, 2]: la asíntota π/2 no es raíz', numericRoots(Math.tan, 1, 2).length === 0)
  const c = numericRoots((x) => x ** 3 - 6.4 * x ** 2 + 11.04 * x - 5.76, 0, 5)
  // la raíz doble 1.2 no cambia de signo: sólo aparece si cae exactamente en la malla de muestreo (aquí sí)
  verdad(`(x − 1.2)²(x − 4): encuentra la raíz simple 4 y ninguna espuria (${c.join(', ')})`, c.some((r) => Math.abs(r - 4) < 1e-9) && c.every((r) => Math.abs(r - 4) < 1e-9 || Math.abs(r - 1.2) < 1e-7))
}
