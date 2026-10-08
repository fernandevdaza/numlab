import type { TopicDef } from '../types'
import './cas.css'
import { Consola } from './Consola'
import { Graficador } from './Graficador'
import { Espacio } from '../espacio/Espacio'
import { L } from '../../i18n'

export const topic: TopicDef = {
  id: 'cas',
  num: 0,
  title: L('Herramientas', 'Tools'),
  shortTitle: L('Herramientas', 'Tools'),
  blurb: L(
    'Espacio de trabajo con calculadora, gráficas, hoja de cálculo y notas; calculadora simbólica tipo cuaderno y graficador de funciones con parámetros.',
    'A workspace with a calculator, graphs, a spreadsheet and notes; a notebook-style symbolic calculator and a function plotter with parameters.',
  ),
  glyph: '⌘',
  methods: [
    {
      id: 'espacio',
      title: L('Espacio de trabajo', 'Workspace'),
      summary: L('Páginas con calculadora, gráficas, hoja de cálculo y notas que comparten variables (estilo TI-Nspire y GeoGebra).', 'Pages with a calculator, graphs, a spreadsheet and notes that share variables (TI-Nspire and GeoGebra style).'),
      keywords:
        'espacio trabajo workspace documento document paginas pages nspire ti-nspire geogebra desmos hoja calculo spreadsheet excel tabla table listas lists regresion regression linreg graficas graphs deslizador slider punto point implicita implicit parametrica parametric notas notes',
      component: Espacio,
    },
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
