import { createElement } from 'react'
import type { TopicDef } from '../types'
import { Gauss } from './Gauss'
import { LU } from './LU'
import { Thomas } from './Thomas'
import { Iterativos } from './Iterativos'
import { NewtonSistemas } from './NewtonSistemas'
import { PuntoFijoSistemas } from './PuntoFijoSistemas'
import { Potencia } from './Potencia'
import { Condicion } from './Condicion'

// Orden del capítulo 3 del texto: métodos directos (3.2: Gauss, Thomas, LU), iterativos (3.3), estabilidad (3.4) y
// sistemas no lineales (3.5: Newton, punto fijo). La potencia es un complemento (valores propios, sílabo).
export const topic: TopicDef = {
  id: 'sistemas',
  num: 3,
  title: 'Sistemas de ecuaciones lineales',
  shortTitle: 'Sistemas lineales',
  blurb: 'Ax = b por métodos directos (Gauss, Thomas, LU) e iterativos (Jacobi, Gauss-Seidel), condicionamiento, sistemas no lineales y valores propios.',
  glyph: 'Ax=b',
  methods: [
    {
      id: 'gauss',
      title: 'Eliminación de Gauss',
      group: 'Métodos directos',
      summary: 'Triangulariza con pivoteo parcial y resuelve por sustitución regresiva.',
      keywords: 'gauss pivoteo parcial escalado triangularizacion matriz aumentada sustitucion regresiva determinante directo calculadora 4 cifras',
      component: Gauss,
    },
    {
      id: 'thomas',
      title: 'Método de Thomas',
      group: 'Métodos directos',
      summary: 'Gauss especializado para matrices tridiagonales: costo proporcional a n.',
      keywords: 'tridiagonal banda thomas algoritmo TDMA splines',
      component: Thomas,
    },
    {
      id: 'lu',
      title: 'Factorización LU',
      group: 'Métodos directos',
      summary: 'A = LU (Doolittle o Crout), luego sustitución progresiva y regresiva.',
      keywords: 'lu doolittle crout cholesky permutacion PA=LU descomposicion factorizacion progresiva regresiva',
      component: LU,
    },
    {
      id: 'jacobi',
      title: 'Método de Gauss-Jacobi',
      group: 'Métodos iterativos',
      summary: 'Desplazamientos simultáneos x⁽ᵏ⁺¹⁾ = Cx⁽ᵏ⁾ + D con criterio de convergencia.',
      keywords: 'jacobi iterativo desplazamientos simultaneos dominancia diagonal radio espectral norma',
      component: () => createElement(Iterativos, { kind: 'jacobi' }),
    },
    {
      id: 'gauss-seidel',
      title: 'Método de Gauss-Seidel y SOR',
      group: 'Métodos iterativos',
      summary: 'Desplazamientos sucesivos: usa cada componente nueva de inmediato; relajación ω.',
      keywords: 'gauss seidel iterativo desplazamientos sucesivos relajacion sor omega sobrerrelajacion radio espectral',
      component: () => createElement(Iterativos, { kind: 'gauss-seidel' }),
    },
    {
      id: 'condicion',
      title: 'Número de condición',
      group: 'Análisis del sistema',
      summary: 'Normas de matriz y κ(A) = ‖A‖‖A⁻¹‖: estabilidad (condicionamiento) de Ax = b.',
      keywords: 'condicionamiento estabilidad mal condicionado norma inversa determinante hilbert cond kappa',
      component: Condicion,
    },
    {
      id: 'newton-sistemas',
      title: 'Newton para sistemas',
      group: 'Sistemas no lineales',
      summary: 'Resuelve F(x) = 0 resolviendo J(xₖ)Δx = −F(xₖ) en cada iteración.',
      keywords: 'newton raphson jacobiano no lineal multivariable sistemas no lineales',
      component: NewtonSistemas,
    },
    {
      id: 'punto-fijo-sistemas',
      title: 'Punto fijo para sistemas',
      group: 'Sistemas no lineales',
      summary: 'Iteración x = g(x) con despejes gᵢ; variante de Seidel y condición de suficiencia.',
      keywords: 'punto fijo iteracion despeje g seidel sistemas no lineales',
      component: PuntoFijoSistemas,
    },
    {
      id: 'potencia',
      title: 'Método de la potencia',
      group: 'Valores propios',
      summary: 'Valor propio dominante (y el más cercano a q con la potencia inversa).',
      keywords: 'valores propios autovalores eigen potencia inversa desplazamiento espectro',
      component: Potencia,
    },
  ],
}
