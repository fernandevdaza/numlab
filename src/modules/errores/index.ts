import type { TopicDef } from '../types'
import { L } from '../../i18n'
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
const REP = L('Representación en la computadora', 'Computer representation')
const ERR = L('Errores', 'Errors')
const EST = L('Estabilidad y condición', 'Stability and conditioning')
const TAY = L('Series de Taylor', 'Taylor series')

export const topic: TopicDef = {
  id: 'errores',
  num: 1,
  title: L('Representación de números y errores', 'Number representation and errors'),
  shortTitle: L('Números y errores', 'Numbers & errors'),
  blurb: L(
    'Sistemas numéricos, coma flotante (máquina de 16 bits, IEEE 754), computadora de 7 dits, errores, condición, estabilidad y Taylor.',
    'Number systems, floating point (16-bit machine, IEEE 754), 7-dit decimal computer, errors, conditioning, stability and Taylor.',
  ),
  glyph: 'ε',
  methods: [
    {
      id: 'conversion',
      title: L('Conversión entre bases', 'Conversion between bases'),
      group: REP,
      summary: L(
        'Decimal ↔ binario, octal y hexadecimal con divisiones y multiplicaciones sucesivas.',
        'Decimal ↔ binary, octal and hexadecimal by repeated division and multiplication.',
      ),
      keywords: 'sistemas numericos base binario octal hexadecimal hexagesimal cambio de base multiplicaciones sucesivas divisiones sucesivas number systems base conversion binary octal hexadecimal repeated division multiplication',
      component: Conversion,
    },
    {
      id: 'maquina-16',
      title: L('Máquina binaria de 16 bits', '16-bit binary machine'),
      group: REP,
      summary: L(
        'Palabra 1·7·8 del texto: almacenar, leer, vecinos y operar, con bias y redondeo.',
        'The 1·7·8 word from the textbook: store, read, neighbors and arithmetic, with bias and rounding.',
      ),
      keywords: 'palabra 16 bits coma flotante 1 7 8 mantisa exponente bias sesgo redondeo truncado justo mas grande mas pequeño unidad de redondeo overflow underflow word 16-bit floating point mantissa exponent bias rounding chopping largest smallest unit round-off overflow underflow',
      component: Maquina,
    },
    {
      id: 'ieee754',
      title: L('Estándar IEEE 754', 'IEEE 754 standard'),
      group: REP,
      summary: L(
        'Bits de un número en media, simple y doble precisión; valor exacto almacenado.',
        'Bits of a number in half, single and double precision; exact stored value.',
      ),
      keywords: 'ieee 754 bits flotante float double binary64 binary32 mantisa exponente sesgo subnormal nan infinito realmax realmin half single double precision exponent bias infinity',
      component: Ieee754,
    },
    {
      id: 'sistema-f',
      title: L('Sistema flotante F(β, t, L, U)', 'Floating-point system F(β, t, L, U)'),
      group: REP,
      summary: L(
        'Un sistema de punto flotante pequeño: todos sus números, UFL, OFL y redondeo.',
        'A small floating-point system: all its numbers, UFL, OFL and rounding.',
      ),
      keywords: 'sistema de punto flotante juguete redondeo corte chopping overflow underflow ufl ofl toy floating point system rounding chopping',
      component: SistemaF,
    },
    {
      id: 'epsilon',
      title: L('Épsilon de máquina', 'Machine epsilon'),
      group: REP,
      summary: L(
        'Menor ε con 1 + ε > 1: el bucle clásico y el espaciado entre flotantes.',
        'Smallest ε with 1 + ε > 1: the classic loop and the spacing between floats.',
      ),
      keywords: 'eps %eps precision ulp unidad de redondeo epsilon maquina machine epsilon unit round-off precision spacing',
      component: Epsilon,
    },
    {
      id: 'errores',
      title: L('Error absoluto y relativo', 'Absolute and relative error'),
      group: ERR,
      summary: L(
        'Errores absoluto, relativo y porcentual; cifras significativas según el texto.',
        'Absolute, relative and percent errors; significant digits as defined in the textbook.',
      ),
      keywords: 'error absoluto relativo porcentual cifras significativas digitos significativos decimales correctos absolute relative percent error significant digits correct decimals',
      component: Errores,
    },
    {
      id: 'dits',
      title: L('Computadora decimal de 7 dits', '7-dit decimal computer'),
      group: ERR,
      summary: L(
        'Máquina ±0.d₁d₂d₃d₄×10^±e: error propagado y error de redondeo paso a paso.',
        'Machine ±0.d₁d₂d₃d₄×10^±e: propagated error and round-off error step by step.',
      ),
      keywords: 'dits 7 dits maquina decimal computadora decimal mantisa 4 digitos error propagado error de redondeo overflow underflow asociativa decimal machine decimal computer 4-digit mantissa propagated error round-off error associative',
      component: Dits,
    },
    {
      id: 'propagacion',
      title: L('Propagación de errores', 'Error propagation'),
      group: ERR,
      summary: L(
        'Error de f(x₁,…,xₙ) a partir de los errores de los datos (derivadas parciales).',
        'Error in f(x₁,…,xₙ) from the errors in the data (partial derivatives).',
      ),
      keywords: 'propagacion error propagado derivadas parciales incertidumbre medicion error propagation propagated error partial derivatives uncertainty measurement',
      component: Propagacion,
    },
    {
      id: 'cancelacion',
      title: L('Cancelación catastrófica', 'Catastrophic cancellation'),
      group: ERR,
      summary: L(
        'Resta de números cercanos: pérdida de cifras y reformulaciones estables.',
        'Subtracting nearby numbers: loss of significant digits and stable reformulations.',
      ),
      keywords: 'cancelacion resta numeros cercanos perdida de cifras forward backward progresivo regresivo cuadratica catastrophic cancellation subtraction nearby numbers loss of significance quadratic',
      component: Cancelacion,
    },
    {
      id: 'condicion',
      title: L('Número de condición', 'Condition number'),
      group: EST,
      summary: L(
        'K = |x f′(x)/f(x)|: sensibilidad del problema (estabilidad matemática).',
        'K = |x f′(x)/f(x)|: sensitivity of the problem (mathematical stability).',
      ),
      keywords: 'numero condicion condicionamiento kappa bien mal condicionado estabilidad matematica problema estable inestable condition number conditioning well ill conditioned mathematical stability stable unstable problem',
      component: Condicion,
    },
    {
      id: 'estabilidad',
      title: L('Estabilidad numérica', 'Numerical stability'),
      group: EST,
      summary: L(
        'Algoritmos equivalentes que amplifican (o no) los errores de redondeo.',
        'Equivalent algorithms that amplify (or do not amplify) round-off errors.',
      ),
      keywords: 'estabilidad numerica algoritmo estable inestable recurrencia serie exponencial kahan suma consistencia numerical stability stable unstable algorithm recurrence exponential series kahan summation consistency',
      component: Estabilidad,
    },
    {
      id: 'taylor',
      title: L('Series de Taylor', 'Taylor series'),
      group: TAY,
      summary: L(
        'Polinomio de Taylor, resto de Lagrange y error de truncamiento.',
        'Taylor polynomial, Lagrange remainder and truncation error.',
      ),
      keywords: 'taylor serie polinomio resto lagrange maclaurin truncamiento taylor series polynomial lagrange remainder maclaurin truncation error',
      component: Taylor,
    },
  ],
}
