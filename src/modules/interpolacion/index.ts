import { createElement } from 'react'
import type { TopicDef } from '../types'
import { PolySolver, type PolyKind } from './PolySolver'
import { ErrorInterp } from './ErrorInterp'
import { Runge } from './Runge'
import { Splines } from './Splines'
import { SHORT, SUMMARY } from './theory'
import { L } from '../../i18n'

const POLY = L('Interpolación polinomial', 'Polynomial interpolation')
const ERR = L('Error de interpolación', 'Interpolation error')
const SEG = L('Interpolación segmentaria', 'Piecewise interpolation')

const poly = (id: PolyKind, keywords: string) => ({
  id,
  title: SHORT[id],
  group: POLY,
  summary: SUMMARY[id],
  keywords,
  component: () => createElement(PolySolver, { kind: id }),
})

// Orden del sílabo y del Cap. 4 del texto: 4.2 polinomial, 4.3 error (y Runge), 4.4 splines.
export const topic: TopicDef = {
  id: 'interpolacion',
  num: 4,
  title: L('Interpolación', 'Interpolation'),
  shortTitle: L('Interpolación', 'Interpolation'),
  blurb: L(
    'Polinomio de interpolación (Lagrange, diferencias divididas y finitas de avance y retroceso), su error, el fenómeno de Runge y splines cúbicas.',
    'Interpolating polynomial (Lagrange, forward and backward divided and finite differences), its error, the Runge phenomenon and cubic splines.',
  ),
  glyph: 'P(x)',
  methods: [
    poly('lagrange', 'lagrange polinomio base L_i interpolacion polinomial vandermonde polynomial basis interpolation'),
    poly('diferencias-divididas', 'newton diferencias divididas avance retroceso apoyado tabla forma anidada divided differences forward backward based table nested form'),
    poly('diferencias-finitas', 'newton gregory diferencias finitas avance retroceso adelante atras delta nabla equiespaciados apoyado finite differences forward backward equally spaced based'),
    { id: 'error-interpolacion', title: SHORT['error-interpolacion'], group: ERR, summary: SUMMARY['error-interpolacion'], keywords: 'error interpolacion cota derivada punto adicional mayorar R_n interpolation bound derivative extra point estimate', component: ErrorInterp },
    { id: 'runge', title: SHORT.runge, group: ERR, summary: SUMMARY.runge, keywords: 'runge chebyshev nodos oscilacion 1/(1+x^2) nodes oscillation phenomenon', component: Runge },
    { id: 'splines', title: SHORT.splines, group: SEG, summary: SUMMARY.splines, keywords: 'splines cubicas cubicos trazadores segmentaria natural forzada forzado sujeto clamped tridiagonal thomas M_i cubic spline piecewise', component: Splines },
  ],
}
