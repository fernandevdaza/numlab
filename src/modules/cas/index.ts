import type { TopicDef } from '../types'
import './cas.css'
import { Consola } from './Consola'
import { Graficador } from './Graficador'
import { L } from '../../i18n'

export const topic: TopicDef = {
  id: 'cas',
  num: 0,
  title: L('Herramientas', 'Tools'),
  shortTitle: L('Herramientas', 'Tools'),
  blurb: L(
    'Calculadora simbólica tipo cuaderno (derivadas, integrales, límites, Taylor, ecuaciones, matrices) y graficador de funciones con parámetros.',
    'Notebook-style symbolic calculator (derivatives, integrals, limits, Taylor series, equations, matrices) and a function plotter with parameters.',
  ),
  glyph: '⌘',
  methods: [
    {
      id: 'calculadora',
      title: L('Calculadora simbólica (CAS)', 'Symbolic calculator (CAS)'),
      summary: L('Cuaderno de comandos: derivadas, integrales, límites, Taylor, ecuaciones y matrices.', 'Command notebook: derivatives, integrals, limits, Taylor series, equations and matrices.'),
      keywords:
        'cas calculadora simbolica symbolic calculator consola console cuaderno notebook derivada derivative integral limite limit taylor series resolver solve ecuacion equation matriz matrix determinante determinant inversa inverse eig autovalores eigenvalues symbolab wolfram',
      component: Consola,
    },
    {
      id: 'graficador',
      title: L('Graficador de funciones', 'Function plotter'),
      summary: L('Varias funciones con parámetros ajustables; raíces, extremos e intersecciones.', 'Several functions with adjustable parameters; roots, extrema and intersections.'),
      keywords:
        'grafica graficar plot plotter graph funciones functions geogebra desmos raices roots extremos extrema intersecciones intersections parametros parameters deslizador slider',
      component: Graficador,
    },
  ],
}
