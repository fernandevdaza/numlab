import type { TopicDef } from '../types'
import { CompararIntegracion } from './Comparar'
import { Derivadas } from './Derivadas'
import { GaussLegendre } from './GaussLegendre'
import { IntegralesDobles } from './IntegralesDobles'
import { NewtonCotes, Simpson, Trapecio } from './NewtonCotes'
import { Romberg } from './Romberg'

export const topic: TopicDef = {
  id: 'integracion',
  num: 5,
  title: 'Derivación e integración numérica',
  shortTitle: 'Derivación e integración',
  blurb: 'Diferencias finitas, trapecio y Simpson, Romberg-Richardson, cuadratura de Gauss-Legendre e integrales dobles, con cotas de error.',
  glyph: '∫',
  methods: [
    {
      id: 'derivadas',
      title: 'Diferencias finitas',
      group: 'Derivación numérica',
      summary: "Aproxima f'(x) y f''(x) con avance, retroceso, central y extrapolada; error vs h.",
      keywords: 'derivacion numerica derivada diferencias finitas avance retroceso progresiva regresiva central centrada extrapolada taylor richardson segunda derivada coeficientes indeterminados h optimo interpolacion',
      component: Derivadas,
    },
    {
      id: 'trapecio',
      title: 'Regla del trapecio',
      group: 'Fórmulas de Newton-Cotes',
      summary: 'Trapecio simple y compuesto (N subintervalos), cota del error y datos tabulados.',
      keywords: 'trapecio trapezoidal compuesto newton cotes integracion numerica datos tabulados no equiespaciados',
      component: Trapecio,
    },
    {
      id: 'simpson',
      title: 'Regla de Simpson',
      group: 'Fórmulas de Newton-Cotes',
      summary: 'Simpson 1/3 simple y compuesto (2N subintervalos) con la mayoración del error.',
      keywords: 'simpson 1/3 un tercio parabola compuesto newton cotes integracion numerica',
      component: Simpson,
    },
    {
      id: 'newton-cotes',
      title: 'Newton-Cotes (todas las reglas)',
      group: 'Fórmulas de Newton-Cotes',
      summary: 'Compara trapecio, Simpson 1/3, Simpson 3/8 y Boole con la misma malla.',
      keywords: 'newton cotes cerradas simpson 3/8 tres octavos boole compuesta datos tabulados',
      component: NewtonCotes,
    },
    {
      id: 'romberg',
      title: 'Método de Romberg-Richardson',
      group: 'Extrapolación',
      summary: 'Extrapolación de Richardson sobre trapecios con n = 2ᵏ: tabla I_k^(m).',
      keywords: 'romberg richardson extrapolacion tabla trapecio',
      component: Romberg,
    },
    {
      id: 'gauss-legendre',
      title: 'Cuadratura de Gauss-Legendre',
      group: 'Cuadratura de Gauss',
      summary: 'Nodos y pesos de orden n, cambio de variable a [−1, 1]; exacta hasta grado 2n − 1.',
      keywords: 'gauss legendre cuadratura gaussiana nodos pesos polinomios de legendre cambio de variable punto medio',
      component: GaussLegendre,
    },
    {
      id: 'integrales-dobles',
      title: 'Integrales dobles',
      group: 'Integrales múltiples',
      summary: 'Integral iterada ∫∫ f dy dx con límites variables φ₁(x), φ₂(x) por Gauss o Simpson.',
      keywords: 'integral doble multiple iterada gauss legendre 2d simpson region limites variables volumen',
      component: IntegralesDobles,
    },
    {
      id: 'comparar-integracion',
      title: 'Comparar métodos de integración',
      group: 'Comparación',
      summary: 'Misma integral con todos los métodos: error contra número de evaluaciones.',
      keywords: 'comparacion comparar error evaluaciones convergencia',
      component: CompararIntegracion,
    },
  ],
}
