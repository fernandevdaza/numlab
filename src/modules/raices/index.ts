import { createElement } from 'react'
import type { MethodDef, TopicDef } from '../types'
import { RootSolver, type RootKind } from './RootSolver'
import { Comparar } from './Comparar'
import { L } from '../../i18n'

// Orden y agrupación del texto de la materia, Cap. 2: §2.3 raíces simples (bisección, punto fijo, Aitken,
// Steffensen, Newton-Raphson, secante, posición falsa) y §2.4 raíces de multiplicidad m > 1.
const SIMPLES = L('Raíces simples', 'Simple roots')
const MULTIPLES = L('Raíces múltiples', 'Multiple roots')

const m = (id: RootKind, title: string, group: string, summary: string, keywords = ''): MethodDef => ({
  id,
  title,
  group,
  summary,
  keywords,
  component: () => createElement(RootSolver, { kind: id }),
})

export const topic: TopicDef = {
  id: 'raices',
  num: 2,
  title: L('Ecuaciones no lineales', 'Nonlinear equations'),
  shortTitle: L('Ecuaciones no lineales', 'Nonlinear equations'),
  blurb: L(
    'Raíces de f(x) = 0: bisección, punto fijo, Aitken, Steffensen, Newton, secante, posición falsa y raíces múltiples.',
    'Roots of f(x) = 0: bisection, fixed point, Aitken, Steffensen, Newton, secant, false position and multiple roots.',
  ),
  glyph: 'f(x)=0',
  methods: [
    m('biseccion', L('Método de la bisección', 'Bisection method'), SIMPLES, L('Parte a la mitad un intervalo con cambio de signo hasta alcanzar la precisión EPS.', 'Halves an interval with a sign change until the precision EPS is reached.'), 'biseccion bisection bolzano intervalo interval mitad halving xI xD'),
    m('punto-fijo', L('Método del punto fijo', 'Fixed-point iteration'), SIMPLES, L('Itera xₙ₊₁ = g(xₙ); converge si |g′(x)| < 1 cerca de la raíz.', 'Iterates xₙ₊₁ = g(xₙ); converges if |g′(x)| < 1 near the root.'), 'punto fijo fixed point iteracion iteration g(x) telaraña cobweb orden de convergencia order of convergence contraccion contraction'),
    m('aitken', L('Método de Aitken (Δ²)', 'Aitken\'s Δ² method'), SIMPLES, L('Acelera una sucesión de punto fijo con tres términos consecutivos.', 'Accelerates a fixed-point sequence using three consecutive terms.'), 'delta cuadrado squared aceleracion acceleration yn'),
    m('steffensen', L('Método de Steffensen', 'Steffensen\'s method'), SIMPLES, L('Punto fijo + Aitken reiniciado: convergencia cuadrática sin derivadas.', 'Fixed point + restarted Aitken: quadratic convergence without derivatives.'), 'steffenson aitken aceleracion acceleration cuadratica quadratic'),
    m('newton', L('Método de Newton-Raphson', 'Newton–Raphson method'), SIMPLES, L('Recta tangente: xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ), convergencia cuadrática.', 'Tangent line: xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ), quadratic convergence.'), 'newton raphson tangente tangent derivada derivative cuadratica quadratic'),
    m('secante', L('Método de la secante', 'Secant method'), SIMPLES, L('Newton sin derivadas: secante por las dos últimas aproximaciones (orden 1.618).', 'Newton without derivatives: secant line through the last two approximations (order 1.618).'), 'secante secant numero aureo golden ratio sin derivada derivative-free'),
    m('posicion-falsa', L('Método de la posición falsa', 'False position method'), SIMPLES, L('Secante que mantiene la raíz encerrada en [x_I, x_D]; versión modificada.', 'Secant that keeps the root bracketed in [x_I, x_D]; modified version.'), 'posicion falsa false position regula falsi illinois intervalo interval secante secant bracketing'),
    m('newton-mod', L('Método de Newton modificado', 'Modified Newton method'), MULTIPLES, L('xₙ₊₁ = xₙ − m f/f′ para raíces de multiplicidad m; estima m y método u = f/f′.', 'xₙ₊₁ = xₙ − m f/f′ for roots of multiplicity m; estimates m, plus the u = f/f′ method.'), 'newton modificado modified multiplicidad multiplicity raiz multiple root doble double metodo alternativo alternative u = f/f\''),
    {
      id: 'comparar',
      title: L('Comparar métodos', 'Compare methods'),
      group: L('Comparación', 'Comparison'),
      summary: L('Resuelve la misma ecuación con todos los métodos y compara iteraciones y orden.', 'Solves the same equation with every method and compares iterations and order.'),
      keywords: 'comparar compare orden order convergencia convergence',
      component: Comparar,
    },
  ],
}
