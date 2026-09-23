import type { TopicDef } from '../types'
import './errores.css'
import { Ieee754 } from './Ieee754'
import { Maquina } from './Maquina'
import { Dits } from './Dits'
import { Conversion } from './Conversion'
import { SistemaF } from './SistemaF'
import { Epsilon } from './Epsilon'
import { Errores } from './Errores'
import { Propagacion } from './Propagacion'
import { Condicion } from './Condicion'
import { Cancelacion } from './Cancelacion'
import { Estabilidad } from './Estabilidad'
import { Taylor } from './Taylor'

// Orden del texto de la materia, Cap. 1: §1.1–1.2 sistemas numéricos y conversión, §1.3–1.4 coma flotante y la
// máquina de 16 bits (anexo: IEEE 754), §1.5 errores (con la computadora decimal de 7 dits), §1.6 condición
// (estabilidad matemática), §1.7 estabilidad numérica y anexo: teorema de Taylor.
const REP = 'Representación en la computadora'
const ERR = 'Errores'
const EST = 'Estabilidad y condición'
const TAY = 'Series de Taylor'

export const topic: TopicDef = {
  id: 'errores',
  num: 1,
  title: 'Representación de números y errores',
  shortTitle: 'Números y errores',
  blurb: 'Sistemas numéricos, coma flotante (máquina de 16 bits, IEEE 754), computadora de 7 dits, errores, condición, estabilidad y Taylor.',
  glyph: 'ε',
  methods: [
    {
      id: 'conversion',
      title: 'Conversión entre bases',
      group: REP,
      summary: 'Decimal ↔ binario, octal y hexadecimal con divisiones y multiplicaciones sucesivas.',
      keywords: 'sistemas numericos base binario octal hexadecimal hexagesimal cambio de base multiplicaciones sucesivas divisiones sucesivas',
      component: Conversion,
    },
    {
      id: 'maquina-16',
      title: 'Máquina binaria de 16 bits',
      group: REP,
      summary: 'Palabra 1·7·8 del texto: almacenar, leer, vecinos y operar, con bias y redondeo.',
      keywords: 'palabra 16 bits coma flotante 1 7 8 mantisa exponente bias sesgo redondeo truncado justo mas grande mas pequeño unidad de redondeo overflow underflow',
      component: Maquina,
    },
    {
      id: 'ieee754',
      title: 'Estándar IEEE 754',
      group: REP,
      summary: 'Bits de un número en media, simple y doble precisión; valor exacto almacenado.',
      keywords: 'ieee 754 bits flotante float double binary64 binary32 mantisa exponente sesgo subnormal nan infinito realmax realmin',
      component: Ieee754,
    },
    {
      id: 'sistema-f',
      title: 'Sistema flotante F(β, t, L, U)',
      group: REP,
      summary: 'Un sistema de punto flotante pequeño: todos sus números, UFL, OFL y redondeo.',
      keywords: 'sistema de punto flotante juguete redondeo corte chopping overflow underflow ufl ofl',
      component: SistemaF,
    },
    {
      id: 'epsilon',
      title: 'Épsilon de máquina',
      group: REP,
      summary: 'Menor ε con 1 + ε > 1: el bucle clásico y el espaciado entre flotantes.',
      keywords: 'eps %eps precision ulp unidad de redondeo epsilon maquina',
      component: Epsilon,
    },
    {
      id: 'errores',
      title: 'Error absoluto y relativo',
      group: ERR,
      summary: 'Errores absoluto, relativo y porcentual; cifras significativas según el texto.',
      keywords: 'error absoluto relativo porcentual cifras significativas digitos significativos decimales correctos',
      component: Errores,
    },
    {
      id: 'dits',
      title: 'Computadora decimal de 7 dits',
      group: ERR,
      summary: 'Máquina ±0.d₁d₂d₃d₄×10^±e: error propagado y error de redondeo paso a paso.',
      keywords: 'dits 7 dits maquina decimal computadora decimal mantisa 4 digitos error propagado error de redondeo overflow underflow asociativa',
      component: Dits,
    },
    {
      id: 'propagacion',
      title: 'Propagación de errores',
      group: ERR,
      summary: 'Error de f(x₁,…,xₙ) a partir de los errores de los datos (derivadas parciales).',
      keywords: 'propagacion error propagado derivadas parciales incertidumbre medicion',
      component: Propagacion,
    },
    {
      id: 'cancelacion',
      title: 'Cancelación catastrófica',
      group: ERR,
      summary: 'Resta de números cercanos: pérdida de cifras y reformulaciones estables.',
      keywords: 'cancelacion resta numeros cercanos perdida de cifras forward backward progresivo regresivo cuadratica',
      component: Cancelacion,
    },
    {
      id: 'condicion',
      title: 'Número de condición',
      group: EST,
      summary: 'K = |x f′(x)/f(x)|: sensibilidad del problema (estabilidad matemática).',
      keywords: 'numero condicion condicionamiento kappa bien mal condicionado estabilidad matematica problema estable inestable',
      component: Condicion,
    },
    {
      id: 'estabilidad',
      title: 'Estabilidad numérica',
      group: EST,
      summary: 'Algoritmos equivalentes que amplifican (o no) los errores de redondeo.',
      keywords: 'estabilidad numerica algoritmo estable inestable recurrencia serie exponencial kahan suma consistencia',
      component: Estabilidad,
    },
    {
      id: 'taylor',
      title: 'Series de Taylor',
      group: TAY,
      summary: 'Polinomio de Taylor, resto de Lagrange y error de truncamiento.',
      keywords: 'taylor serie polinomio resto lagrange maclaurin truncamiento',
      component: Taylor,
    },
  ],
}
