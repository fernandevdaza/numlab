import { createElement } from 'react'
import type { MethodDef, TopicDef } from '../types'
import { RootSolver, type RootKind } from './RootSolver'
import { Comparar } from './Comparar'

// Orden y agrupación del texto de la materia, Cap. 2: §2.3 raíces simples (bisección, punto fijo, Aitken,
// Steffensen, Newton-Raphson, secante, posición falsa) y §2.4 raíces de multiplicidad m > 1.
const SIMPLES = 'Raíces simples'
const MULTIPLES = 'Raíces múltiples'

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
  title: 'Ecuaciones no lineales',
  shortTitle: 'Ecuaciones no lineales',
  blurb: 'Raíces de f(x) = 0: bisección, punto fijo, Aitken, Steffensen, Newton, secante, posición falsa y raíces múltiples.',
  glyph: 'f(x)=0',
  methods: [
    m('biseccion', 'Método de la bisección', SIMPLES, 'Parte a la mitad un intervalo con cambio de signo hasta alcanzar la precisión EPS.', 'biseccion bolzano intervalo mitad xI xD'),
    m('punto-fijo', 'Método del punto fijo', SIMPLES, 'Itera xₙ₊₁ = g(xₙ); converge si |g′(x)| < 1 cerca de la raíz.', 'iteracion g(x) telaraña cobweb orden de convergencia contraccion'),
    m('aitken', 'Método de Aitken (Δ²)', SIMPLES, 'Acelera una sucesión de punto fijo con tres términos consecutivos.', 'delta cuadrado aceleracion yn'),
    m('steffensen', 'Método de Steffensen', SIMPLES, 'Punto fijo + Aitken reiniciado: convergencia cuadrática sin derivadas.', 'steffenson aitken aceleracion cuadratica'),
    m('newton', 'Método de Newton-Raphson', SIMPLES, 'Recta tangente: xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ), convergencia cuadrática.', 'newton raphson tangente derivada cuadratica'),
    m('secante', 'Método de la secante', SIMPLES, 'Newton sin derivadas: secante por las dos últimas aproximaciones (orden 1.618).', 'secante numero aureo sin derivada'),
    m('posicion-falsa', 'Método de la posición falsa', SIMPLES, 'Secante que mantiene la raíz encerrada en [x_I, x_D]; versión modificada.', 'posicion falsa regula falsi illinois intervalo secante'),
    m('newton-mod', 'Método de Newton modificado', MULTIPLES, 'xₙ₊₁ = xₙ − m f/f′ para raíces de multiplicidad m; estima m y método u = f/f′.', 'newton modificado multiplicidad raiz multiple doble metodo alternativo u = f/f\''),
    {
      id: 'comparar',
      title: 'Comparar métodos',
      group: 'Comparación',
      summary: 'Resuelve la misma ecuación con todos los métodos y compara iteraciones y orden.',
      keywords: 'comparar orden convergencia',
      component: Comparar,
    },
  ],
}
