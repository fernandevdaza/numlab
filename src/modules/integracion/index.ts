import { L } from '../../i18n'
import type { TopicDef } from '../types'
import { CompararIntegracion } from './Comparar'
import { Derivadas } from './Derivadas'
import { GaussLegendre } from './GaussLegendre'
import { IntegralesDobles } from './IntegralesDobles'
import { NewtonCotes, Simpson, Trapecio } from './NewtonCotes'
import { Romberg } from './Romberg'

const NC_GROUP = L('Fórmulas de Newton-Cotes', 'Newton–Cotes formulas')

export const topic: TopicDef = {
  id: 'integracion',
  num: 5,
  title: L('Derivación e integración numérica', 'Numerical differentiation and integration'),
  shortTitle: L('Derivación e integración', 'Differentiation & integration'),
  blurb: L(
    'Diferencias finitas, trapecio y Simpson, Romberg-Richardson, cuadratura de Gauss-Legendre e integrales dobles, con cotas de error.',
    'Finite differences, trapezoidal and Simpson rules, Romberg–Richardson, Gauss–Legendre quadrature and double integrals, with error bounds.',
  ),
  glyph: '∫',
  methods: [
    {
      id: 'derivadas',
      title: L('Diferencias finitas', 'Finite differences'),
      group: L('Derivación numérica', 'Numerical differentiation'),
      summary: L(
        "Aproxima f'(x) y f''(x) con avance, retroceso, central y extrapolada; error vs h.",
        "Approximates f'(x) and f''(x) with forward, backward, central and extrapolated formulas; error vs h.",
      ),
      keywords:
        'derivacion numerica derivada diferencias finitas avance retroceso progresiva regresiva central centrada extrapolada taylor richardson segunda derivada coeficientes indeterminados h optimo interpolacion numerical differentiation derivative finite differences forward backward central centered extrapolated second derivative undetermined coefficients optimal step',
      component: Derivadas,
    },
    {
      id: 'trapecio',
      title: L('Regla del trapecio', 'Trapezoidal rule'),
      group: NC_GROUP,
      summary: L(
        'Trapecio simple y compuesto (N subintervalos), cota del error y datos tabulados.',
        'Simple and composite trapezoidal rule (N subintervals), error bound and tabulated data.',
      ),
      keywords:
        'trapecio trapezoidal compuesto newton cotes integracion numerica datos tabulados no equiespaciados trapezoid composite numerical integration tabulated data unequally spaced',
      component: Trapecio,
    },
    {
      id: 'simpson',
      title: L('Regla de Simpson', "Simpson's rule"),
      group: NC_GROUP,
      summary: L(
        'Simpson 1/3 simple y compuesto (2N subintervalos) con la mayoración del error.',
        "Simple and composite Simpson's 1/3 rule (2N subintervals) with the error bound.",
      ),
      keywords: 'simpson 1/3 un tercio parabola compuesto newton cotes integracion numerica one third parabola composite numerical integration',
      component: Simpson,
    },
    {
      id: 'newton-cotes',
      title: L('Newton-Cotes (todas las reglas)', 'Newton–Cotes (all rules)'),
      group: NC_GROUP,
      summary: L(
        'Compara trapecio, Simpson 1/3, Simpson 3/8 y Boole con la misma malla.',
        "Compares the trapezoidal, Simpson's 1/3, Simpson's 3/8 and Boole's rules on the same grid.",
      ),
      keywords:
        'newton cotes cerradas simpson 3/8 tres octavos boole compuesta datos tabulados closed three eighths composite tabulated data trapezoidal',
      component: NewtonCotes,
    },
    {
      id: 'romberg',
      title: L('Método de Romberg-Richardson', 'Romberg–Richardson method'),
      group: L('Extrapolación', 'Extrapolation'),
      summary: L(
        'Extrapolación de Richardson sobre trapecios con n = 2ᵏ: tabla I_k^(m).',
        'Richardson extrapolation on trapezoidal sums with n = 2ᵏ: table I_k^(m).',
      ),
      keywords: 'romberg richardson extrapolacion tabla trapecio extrapolation table trapezoidal',
      component: Romberg,
    },
    {
      id: 'gauss-legendre',
      title: L('Cuadratura de Gauss-Legendre', 'Gauss–Legendre quadrature'),
      group: L('Cuadratura de Gauss', 'Gaussian quadrature'),
      summary: L(
        'Nodos y pesos de orden n, cambio de variable a [−1, 1]; exacta hasta grado 2n − 1.',
        'Nodes and weights of order n, change of variable to [−1, 1]; exact up to degree 2n − 1.',
      ),
      keywords:
        'gauss legendre cuadratura gaussiana nodos pesos polinomios de legendre cambio de variable punto medio gaussian quadrature nodes weights legendre polynomials change of variable midpoint',
      component: GaussLegendre,
    },
    {
      id: 'integrales-dobles',
      title: L('Integrales dobles', 'Double integrals'),
      group: L('Integrales múltiples', 'Multiple integrals'),
      summary: L(
        'Integral iterada ∫∫ f dy dx con límites variables φ₁(x), φ₂(x) por Gauss o Simpson.',
        'Iterated integral ∫∫ f dy dx with variable limits φ₁(x), φ₂(x) by Gauss or Simpson.',
      ),
      keywords:
        'integral doble multiple iterada gauss legendre 2d simpson region limites variables volumen double integral multiple iterated region variable limits volume',
      component: IntegralesDobles,
    },
    {
      id: 'comparar-integracion',
      title: L('Comparar métodos de integración', 'Compare integration methods'),
      group: L('Comparación', 'Comparison'),
      summary: L(
        'Misma integral con todos los métodos: error contra número de evaluaciones.',
        'The same integral with every method: error versus number of function evaluations.',
      ),
      keywords: 'comparacion comparar error evaluaciones convergencia comparison compare evaluations convergence',
      component: CompararIntegracion,
    },
  ],
}
