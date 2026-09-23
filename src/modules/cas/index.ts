import type { TopicDef } from '../types'
import './cas.css'
import { Consola } from './Consola'
import { Graficador } from './Graficador'

export const topic: TopicDef = {
  id: 'cas',
  num: 0,
  title: 'Herramientas',
  shortTitle: 'Herramientas',
  blurb: 'Calculadora simbólica tipo cuaderno (derivadas, integrales, límites, Taylor, ecuaciones, matrices) y graficador de funciones con parámetros.',
  glyph: '⌘',
  methods: [
    {
      id: 'calculadora',
      title: 'Calculadora simbólica (CAS)',
      summary: 'Cuaderno de comandos: derivadas, integrales, límites, Taylor, ecuaciones y matrices.',
      keywords: 'cas calculadora simbolica consola cuaderno derivada integral limite taylor resolver ecuacion matriz determinante inversa eig autovalores symbolab wolfram',
      component: Consola,
    },
    {
      id: 'graficador',
      title: 'Graficador de funciones',
      summary: 'Varias funciones con parámetros ajustables; raíces, extremos e intersecciones.',
      keywords: 'grafica graficar plot funciones geogebra desmos raices extremos intersecciones parametros deslizador',
      component: Graficador,
    },
  ],
}
