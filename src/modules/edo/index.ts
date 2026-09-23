import { createElement } from 'react'
import type { MethodDef, TopicDef } from '../types'
import { Solver1D } from './Solver1D'
import { Sistemas } from './Sistemas'
import { OrdenSuperior } from './OrdenSuperior'
import { Comparar } from './Comparar'
import { Misil } from './Misil'
import { SHORT, SUMMARY, type OdeKind, type PageId } from './theory'
import { L } from '../../i18n'

const G_INT = L('Métodos basados en integración numérica', 'Methods based on numerical integration')
const G_TAYLOR = L('Métodos de Taylor y Runge-Kutta', 'Taylor and Runge-Kutta methods')
const G_SIS = L('Sistemas y orden superior', 'Systems and higher-order equations')
const G_APL = L('Comparación y aplicaciones', 'Comparison and applications')

const base = (id: PageId, group: string, keywords: string) => ({ id, title: SHORT[id], summary: SUMMARY[id], group, keywords: 'edo pvi valor inicial ecuacion diferencial ode ivp initial value differential equation ' + keywords })

const m = (id: OdeKind, group: string, keywords = ''): MethodDef => ({ ...base(id, group, keywords), component: () => createElement(Solver1D, { kind: id }) })

// Orden del sílabo y del cap. 6 del texto: 6.1.1 (integración numérica), 6.1.2 (Taylor y Runge-Kutta),
// 6.2 (sistemas), 6.3 (orden superior); luego la comparación y el misil (sesión 30).
export const topic: TopicDef = {
  id: 'edo',
  num: 6,
  title: L('Ecuaciones diferenciales ordinarias', 'Ordinary differential equations'),
  shortTitle: L('Ecuaciones diferenciales', 'ODEs'),
  blurb: L(
    'PVI y′ = f(x, y): Euler, punto medio, trapecio o Euler modificado, Adams-Moulton, Taylor y Runge-Kutta; sistemas, orden superior y un misil de persecución en R³.',
    'IVP y′ = f(x, y): Euler, midpoint, trapezoidal or modified Euler, Adams-Moulton, Taylor and Runge-Kutta; systems, higher-order equations and a pursuit missile in R³.',
  ),
  glyph: "y'=f",
  methods: [
    m('euler', G_INT, 'rectangulo tangente explicito estabilidad taylor orden 1 rectangle tangent explicit stability order'),
    m('punto-medio', G_INT, 'dos pasos leapfrog salto de rana explicito rk2 midpoint punto medio two-step explicit'),
    m('heun', G_INT, 'trapecio euler modificado heun predictor corrector rk2 trapezoidal modified euler'),
    m('trapecio', G_INT, 'implicito newton punto fijo rigido a-estable corrector iterado implicit trapezoidal fixed point stiff a-stable iterated'),
    m('adams-moulton', G_INT, 'adams bashforth bashford multipaso cuatro pasos predictor corrector diferencias regresivas multistep four-step backward differences'),
    m('taylor', G_TAYLOR, 'serie derivadas orden 2 orden 1 simbolicas taylor series derivatives order symbolic'),
    m('runge-kutta', G_TAYLOR, 'rk2 rk3 rk4 ralston gamma kutta rkf45 fehlberg adaptativo butcher runge-kutta adaptive'),
    { ...base('sistemas-edo', G_SIS, 'sistema matricial jacobiano lotka volterra lorenz plano de fase 3d system matrix jacobian phase plane first-order'), component: Sistemas },
    { ...base('orden-superior', G_SIS, 'segundo tercer orden reduccion sistema pendulo oscilador masa resorte circuito van der pol kepler second third order reduction pendulum oscillator mass spring circuit higher-order'), component: OrdenSuperior },
    { ...base('comparar-edo', G_APL, 'comparacion orden error log-log convergencia eficiencia comparison order convergence efficiency'), component: Comparar },
    { ...base('misil', G_APL, 'persecucion pursuit curva 3d r3 sesion 30 bouguer misil missile curve session'), component: Misil },
  ],
}
