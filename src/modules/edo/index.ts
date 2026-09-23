import { createElement } from 'react'
import type { MethodDef, TopicDef } from '../types'
import { Solver1D } from './Solver1D'
import { Sistemas } from './Sistemas'
import { OrdenSuperior } from './OrdenSuperior'
import { Comparar } from './Comparar'
import { Misil } from './Misil'
import { SHORT, SUMMARY, type OdeKind, type PageId } from './theory'

const G_INT = 'Métodos basados en integración numérica'
const G_TAYLOR = 'Métodos de Taylor y Runge-Kutta'
const G_SIS = 'Sistemas y orden superior'
const G_APL = 'Comparación y aplicaciones'

const base = (id: PageId, group: string, keywords: string) => ({ id, title: SHORT[id], summary: SUMMARY[id], group, keywords: 'edo pvi valor inicial ecuacion diferencial ' + keywords })

const m = (id: OdeKind, group: string, keywords = ''): MethodDef => ({ ...base(id, group, keywords), component: () => createElement(Solver1D, { kind: id }) })

// Orden del sílabo y del cap. 6 del texto: 6.1.1 (integración numérica), 6.1.2 (Taylor y Runge-Kutta),
// 6.2 (sistemas), 6.3 (orden superior); luego la comparación y el misil (sesión 30).
export const topic: TopicDef = {
  id: 'edo',
  num: 6,
  title: 'Ecuaciones diferenciales ordinarias',
  shortTitle: 'Ecuaciones diferenciales',
  blurb: 'PVI y′ = f(x, y): Euler, punto medio, trapecio o Euler modificado, Adams-Moulton, Taylor y Runge-Kutta; sistemas, orden superior y un misil de persecución en R³.',
  glyph: "y'=f",
  methods: [
    m('euler', G_INT, 'rectangulo tangente explicito estabilidad taylor orden 1'),
    m('punto-medio', G_INT, 'dos pasos leapfrog salto de rana explicito rk2 midpoint'),
    m('heun', G_INT, 'trapecio euler modificado heun predictor corrector rk2'),
    m('trapecio', G_INT, 'implicito newton punto fijo rigido a-estable corrector iterado'),
    m('adams-moulton', G_INT, 'adams bashforth bashford multipaso cuatro pasos predictor corrector diferencias regresivas'),
    m('taylor', G_TAYLOR, 'serie derivadas orden 2 orden 1 simbolicas'),
    m('runge-kutta', G_TAYLOR, 'rk2 rk3 rk4 ralston gamma kutta rkf45 fehlberg adaptativo butcher'),
    { ...base('sistemas-edo', G_SIS, 'sistema matricial jacobiano lotka volterra lorenz plano de fase 3d'), component: Sistemas },
    { ...base('orden-superior', G_SIS, 'segundo tercer orden reduccion sistema pendulo oscilador masa resorte circuito van der pol kepler'), component: OrdenSuperior },
    { ...base('comparar-edo', G_APL, 'comparacion orden error log-log convergencia eficiencia'), component: Comparar },
    { ...base('misil', G_APL, 'persecucion pursuit curva 3d r3 sesion 30 bouguer'), component: Misil },
  ],
}
