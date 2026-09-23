import { createElement } from 'react'
import type { TopicDef } from '../types'
import { PolySolver, type PolyKind } from './PolySolver'
import { ErrorInterp } from './ErrorInterp'
import { Runge } from './Runge'
import { Splines } from './Splines'
import { SHORT, SUMMARY } from './theory'

const POLY = 'Interpolación polinomial'
const ERR = 'Error de interpolación'
const SEG = 'Interpolación segmentaria'

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
  title: 'Interpolación',
  shortTitle: 'Interpolación',
  blurb: 'Polinomio de interpolación (Lagrange, diferencias divididas y finitas de avance y retroceso), su error, el fenómeno de Runge y splines cúbicas.',
  glyph: 'P(x)',
  methods: [
    poly('lagrange', 'lagrange polinomio base L_i interpolacion polinomial vandermonde'),
    poly('diferencias-divididas', 'newton diferencias divididas avance retroceso apoyado tabla forma anidada'),
    poly('diferencias-finitas', 'newton gregory diferencias finitas avance retroceso adelante atras delta nabla equiespaciados apoyado'),
    { id: 'error-interpolacion', title: SHORT['error-interpolacion'], group: ERR, summary: SUMMARY['error-interpolacion'], keywords: 'error interpolacion cota derivada punto adicional mayorar R_n', component: ErrorInterp },
    { id: 'runge', title: SHORT.runge, group: ERR, summary: SUMMARY.runge, keywords: 'runge chebyshev nodos oscilacion 1/(1+x^2)', component: Runge },
    { id: 'splines', title: SHORT.splines, group: SEG, summary: SUMMARY.splines, keywords: 'splines cubicas cubicos trazadores segmentaria natural forzada forzado sujeto clamped tridiagonal thomas M_i', component: Splines },
  ],
}
