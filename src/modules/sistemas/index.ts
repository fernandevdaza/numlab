import { createElement } from 'react'
import type { TopicDef } from '../types'
import { L } from '../../i18n'
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
  title: L('Sistemas de ecuaciones lineales', 'Systems of linear equations'),
  shortTitle: L('Sistemas lineales', 'Linear systems'),
  blurb: L('Ax = b por métodos directos (Gauss, Thomas, LU) e iterativos (Jacobi, Gauss-Seidel), condicionamiento, sistemas no lineales y valores propios.', 'Ax = b by direct methods (Gauss, Thomas, LU) and iterative methods (Jacobi, Gauss–Seidel), conditioning, nonlinear systems and eigenvalues.'),
  glyph: 'Ax=b',
  methods: [
    {
      id: 'gauss',
      title: L('Eliminación de Gauss', 'Gaussian elimination'),
      group: L('Métodos directos', 'Direct methods'),
      summary: L('Triangulariza con pivoteo parcial y resuelve por sustitución regresiva.', 'Reduces to triangular form with partial pivoting and solves by back substitution.'),
      keywords: 'gauss pivoteo parcial escalado triangularizacion matriz aumentada sustitucion regresiva determinante directo calculadora 4 cifras gaussian elimination partial pivoting scaled augmented matrix back substitution determinant direct 4 digits',
      component: Gauss,
    },
    {
      id: 'thomas',
      title: L('Método de Thomas', 'Thomas algorithm'),
      group: L('Métodos directos', 'Direct methods'),
      summary: L('Gauss especializado para matrices tridiagonales: costo proporcional a n.', 'Gaussian elimination specialized to tridiagonal matrices: cost proportional to n.'),
      keywords: 'tridiagonal banda thomas algoritmo TDMA splines band algorithm',
      component: Thomas,
    },
    {
      id: 'lu',
      title: L('Factorización LU', 'LU factorization'),
      group: L('Métodos directos', 'Direct methods'),
      summary: L('A = LU (Doolittle o Crout), luego sustitución progresiva y regresiva.', 'A = LU (Doolittle or Crout), then forward and back substitution.'),
      keywords: 'lu doolittle crout cholesky permutacion PA=LU descomposicion factorizacion progresiva regresiva permutation decomposition factorization forward back substitution',
      component: LU,
    },
    {
      id: 'jacobi',
      title: L('Método de Gauss-Jacobi', 'Jacobi method'),
      group: L('Métodos iterativos', 'Iterative methods'),
      summary: L('Desplazamientos simultáneos x⁽ᵏ⁺¹⁾ = Cx⁽ᵏ⁾ + D con criterio de convergencia.', 'Simultaneous displacements x⁽ᵏ⁺¹⁾ = Cx⁽ᵏ⁾ + D with a convergence criterion.'),
      keywords: 'jacobi iterativo desplazamientos simultaneos dominancia diagonal radio espectral norma iterative simultaneous displacements diagonal dominance spectral radius norm',
      component: () => createElement(Iterativos, { kind: 'jacobi' }),
    },
    {
      id: 'gauss-seidel',
      title: L('Método de Gauss-Seidel y SOR', 'Gauss–Seidel method and SOR'),
      group: L('Métodos iterativos', 'Iterative methods'),
      summary: L('Desplazamientos sucesivos: usa cada componente nueva de inmediato; relajación ω.', 'Successive displacements: uses each new component immediately; relaxation ω.'),
      keywords: 'gauss seidel iterativo desplazamientos sucesivos relajacion sor omega sobrerrelajacion radio espectral iterative successive displacements relaxation over-relaxation spectral radius',
      component: () => createElement(Iterativos, { kind: 'gauss-seidel' }),
    },
    {
      id: 'condicion',
      title: L('Número de condición', 'Condition number'),
      group: L('Análisis del sistema', 'System analysis'),
      summary: L('Normas de matriz y κ(A) = ‖A‖‖A⁻¹‖: estabilidad (condicionamiento) de Ax = b.', 'Matrix norms and κ(A) = ‖A‖‖A⁻¹‖: stability (conditioning) of Ax = b.'),
      keywords: 'condicionamiento estabilidad mal condicionado norma inversa determinante hilbert cond kappa condition number conditioning stability ill-conditioned norm inverse determinant',
      component: Condicion,
    },
    {
      id: 'newton-sistemas',
      title: L('Newton para sistemas', 'Newton for systems'),
      group: L('Sistemas no lineales', 'Nonlinear systems'),
      summary: L('Resuelve F(x) = 0 resolviendo J(xₖ)Δx = −F(xₖ) en cada iteración.', 'Solves F(x) = 0 by solving J(xₖ)Δx = −F(xₖ) at each iteration.'),
      keywords: 'newton raphson jacobiano no lineal multivariable sistemas no lineales jacobian nonlinear systems multivariate',
      component: NewtonSistemas,
    },
    {
      id: 'punto-fijo-sistemas',
      title: L('Punto fijo para sistemas', 'Fixed point for systems'),
      group: L('Sistemas no lineales', 'Nonlinear systems'),
      summary: L('Iteración x = g(x) con despejes gᵢ; variante de Seidel y condición de suficiencia.', 'Iteration x = g(x) with rearrangements gᵢ; Seidel variant and sufficient condition.'),
      keywords: 'punto fijo iteracion despeje g seidel sistemas no lineales fixed point iteration nonlinear systems',
      component: PuntoFijoSistemas,
    },
    {
      id: 'potencia',
      title: L('Método de la potencia', 'Power method'),
      group: L('Valores propios', 'Eigenvalues'),
      summary: L('Valor propio dominante (y el más cercano a q con la potencia inversa).', 'Dominant eigenvalue (and the one closest to q with inverse iteration).'),
      keywords: 'valores propios autovalores eigen potencia inversa desplazamiento espectro eigenvalues eigenvector power method inverse shift spectrum',
      component: Potencia,
    },
  ],
}
