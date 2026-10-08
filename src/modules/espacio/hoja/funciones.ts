// Catálogo de funciones de la hoja de cálculo: nombre en inglés y en español (como Excel), ayuda de
// argumentos para el autocompletado y la implementación. Las funciones con nombres en minúscula de
// mathjs (sin, sqrt, linreg, seq…) también funcionan; éstas son las «de hoja».

export type Cat = 'math' | 'stat' | 'logic' | 'lookup' | 'text' | 'fin' | 'trig'

export interface Arg {
  name: string
  es: string
  desc: string
  descEs: string
  optional?: boolean
  /** se repite (valor1, valor2, …) */
  rep?: boolean
}

export interface FnDef {
  en: string
  es: string
  cat: Cat
  desc: string
  descEs: string
  args: Arg[]
  /** argumentos sin evaluar (SI, SI.ERROR): recibe funciones que los evalúan */
  lazy?: boolean
  impl: (...a: any[]) => any
}

/** Error de hoja con su código (#DIV/0!, #N/A…). */
export class XlError extends Error {
  code: string
  constructor(code: string, detail?: string) {
    super(code + (detail ? ' ' + detail : ''))
    this.code = code
  }
}

/* ─────────────── valores ─────────────── */

/** Celdas crudas de un argumento: rangos (con .cells), listas, matrices o un valor suelto. */
export function cellsOf(v: any): any[][] {
  if (v && Array.isArray(v.cells)) return v.cells
  if (v && typeof v.toArray === 'function') v = v.toArray()
  if (Array.isArray(v)) return Array.isArray(v[0]) ? v : v.map((x: any) => [x])
  return [[v]]
}
const flat = (args: any[]): any[] => args.flatMap((a) => cellsOf(a).flat())
const isNum = (v: any): v is number => typeof v === 'number' && Number.isFinite(v)
/** Números de los argumentos (en rangos se ignoran textos y vacíos; los valores sueltos se convierten). */
function nums(args: any[]): number[] {
  const out: number[] = []
  for (const a of args) {
    const isRange = (a && Array.isArray(a.cells)) || Array.isArray(a) || (a && typeof a.toArray === 'function')
    for (const v of cellsOf(a).flat()) {
      if (isNum(v)) out.push(v)
      else if (!isRange && typeof v === 'boolean') out.push(v ? 1 : 0)
      else if (!isRange && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) out.push(Number(v))
      else if (!isRange && v !== null && v !== undefined && typeof v !== 'number') throw new XlError('#VALUE!')
    }
  }
  return out
}
const num = (v: any): number => {
  if (isNum(v)) return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  if (Number.isFinite(n)) return n
  throw new XlError('#VALUE!')
}
const str = (v: any): string => (v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v))
const truthy = (v: any): boolean => (typeof v === 'string' ? (v.toUpperCase() === 'TRUE' || v.toUpperCase() === 'VERDADERO' ? true : v.toUpperCase() === 'FALSE' || v.toUpperCase() === 'FALSO' ? false : (() => { throw new XlError('#VALUE!') })()) : !!num(v))

/** Criterio de CONTAR.SI / SUMAR.SI: ">5", "<>x", "=abc", "a*", 3… */
export function criterion(c: any): (v: any) => boolean {
  if (typeof c === 'number') return (v) => isNum(v) && v === c
  const s = str(c)
  const m = s.match(/^(<=|>=|<>|=|<|>)?(.*)$/)!
  const op = m[1] ?? '='
  const rhs = m[2]
  const n = Number(rhs)
  if (rhs !== '' && Number.isFinite(n) && op !== '=' && op !== '<>') {
    const f = { '<': (a: number) => a < n, '>': (a: number) => a > n, '<=': (a: number) => a <= n, '>=': (a: number) => a >= n }[op as '<' | '>' | '<=' | '>=']
    return (v) => isNum(v) && f(v)
  }
  const eq = (v: any) => {
    if (rhs !== '' && Number.isFinite(n)) return isNum(v) ? v === n : str(v) === rhs
    if (rhs === '') return v === null || v === undefined || v === ''
    const re = new RegExp('^' + rhs.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
    return re.test(str(v))
  }
  return op === '<>' ? (v) => !eq(v) : eq
}

const mean = (a: number[]) => {
  if (!a.length) throw new XlError('#DIV/0!')
  return a.reduce((s, x) => s + x, 0) / a.length
}
const variance = (a: number[], sample: boolean) => {
  const n = a.length
  if (n < (sample ? 2 : 1)) throw new XlError('#DIV/0!')
  const m = mean(a)
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (sample ? n - 1 : n)
}
const pairs = (x: any, y: any): [number[], number[]] => {
  const X = cellsOf(x).flat(), Y = cellsOf(y).flat()
  if (X.length !== Y.length) throw new XlError('#N/A')
  const xs: number[] = [], ys: number[] = []
  X.forEach((v, i) => {
    if (isNum(v) && isNum(Y[i])) (xs.push(v), ys.push(Y[i]))
  })
  return [xs, ys]
}
const fit = (x: any, y: any) => {
  const [xs, ys] = pairs(x, y)
  if (xs.length < 2) throw new XlError('#DIV/0!')
  const mx = mean(xs), my = mean(ys)
  let sxx = 0, sxy = 0, syy = 0
  xs.forEach((v, i) => ((sxx += (v - mx) ** 2), (sxy += (v - mx) * (ys[i] - my)), (syy += (ys[i] - my) ** 2)))
  if (sxx === 0) throw new XlError('#DIV/0!')
  return { m: sxy / sxx, b: my - (sxy / sxx) * mx, r: sxy / Math.sqrt(sxx * syy) }
}
const roundTo = (x: number, d: number, mode: 'round' | 'up' | 'down') => {
  const f = 10 ** Math.trunc(d)
  const y = x * f
  const r = mode === 'round' ? Math.sign(y) * Math.round(Math.abs(y) + 1e-9) : mode === 'up' ? Math.sign(y) * Math.ceil(Math.abs(y) - 1e-9) : Math.trunc(y)
  return r / f
}

/** Búsqueda exacta o aproximada (lista ordenada) en una fila o columna. Índice 0-based o −1. */
function lookupIndex(list: any[], key: any, exact: boolean): number {
  if (exact) {
    const f = criterion(typeof key === 'number' ? key : '=' + str(key))
    return list.findIndex((v) => f(v))
  }
  let best = -1
  for (let i = 0; i < list.length; i++) {
    const v = list[i]
    if (v === null || v === undefined) continue
    const le = typeof key === 'number' ? isNum(v) && v <= key : str(v).toLowerCase() <= str(key).toLowerCase()
    if (le) best = i
    else break
  }
  return best
}

const A = (name: string, es: string, desc: string, descEs: string, extra: Partial<Arg> = {}): Arg => ({ name, es, desc, descEs, ...extra })
const VALS = [A('value1', 'valor1', 'Number, cell or range', 'Número, celda o rango'), A('value2', 'valor2', 'More values', 'Más valores', { optional: true, rep: true })]
const RANGE = A('range', 'rango', 'Range to evaluate', 'Rango que se evalúa')
const CRIT = A('criteria', 'criterio', 'Condition, e.g. ">5", "<>0", "a*"', 'Condición, p. ej. ">5", "<>0", "a*"')

export const FUNCTIONS: FnDef[] = [
  // ── matemáticas
  { en: 'SUM', es: 'SUMA', cat: 'math', desc: 'Adds numbers', descEs: 'Suma los números', args: VALS, impl: (...a) => nums(a).reduce((s, x) => s + x, 0) },
  { en: 'PRODUCT', es: 'PRODUCTO', cat: 'math', desc: 'Multiplies numbers', descEs: 'Multiplica los números', args: VALS, impl: (...a) => nums(a).reduce((s, x) => s * x, 1) },
  { en: 'SUMSQ', es: 'SUMA.CUADRADOS', cat: 'math', desc: 'Sum of squares', descEs: 'Suma de los cuadrados', args: VALS, impl: (...a) => nums(a).reduce((s, x) => s + x * x, 0) },
  { en: 'SUMPRODUCT', es: 'SUMAPRODUCTO', cat: 'math', desc: 'Sum of products of corresponding items', descEs: 'Suma de los productos elemento a elemento', args: [A('array1', 'matriz1', 'First range', 'Primer rango'), A('array2', 'matriz2', 'More ranges', 'Más rangos', { optional: true, rep: true })], impl: (...a) => {
    const ls = a.map((x) => cellsOf(x).flat())
    if (ls.some((l) => l.length !== ls[0].length)) throw new XlError('#VALUE!')
    return ls[0].reduce((s, _, i) => s + ls.reduce((p, l) => p * (isNum(l[i]) ? l[i] : 0), 1), 0)
  } },
  { en: 'SUMIF', es: 'SUMAR.SI', cat: 'math', desc: 'Adds the cells that meet a condition', descEs: 'Suma las celdas que cumplen una condición', args: [RANGE, CRIT, A('sum_range', 'rango_suma', 'Cells to add (default: range)', 'Celdas que se suman (por defecto: rango)', { optional: true })], impl: (r, c, s) => {
    const R = cellsOf(r).flat(), S = s === undefined ? R : cellsOf(s).flat(), f = criterion(c)
    return R.reduce((acc, v, i) => acc + (f(v) && isNum(S[i]) ? S[i] : 0), 0)
  } },
  { en: 'ROUND', es: 'REDONDEAR', cat: 'math', desc: 'Rounds to a number of digits', descEs: 'Redondea a una cantidad de decimales', args: [A('number', 'número', 'Number', 'Número'), A('digits', 'decimales', 'Decimals', 'Decimales', { optional: true })], impl: (x, d = 0) => roundTo(num(x), num(d), 'round') },
  { en: 'ROUNDUP', es: 'REDONDEAR.MAS', cat: 'math', desc: 'Rounds away from zero', descEs: 'Redondea alejándose de cero', args: [A('number', 'número', 'Number', 'Número'), A('digits', 'decimales', 'Decimals', 'Decimales', { optional: true })], impl: (x, d = 0) => roundTo(num(x), num(d), 'up') },
  { en: 'ROUNDDOWN', es: 'REDONDEAR.MENOS', cat: 'math', desc: 'Rounds toward zero', descEs: 'Redondea hacia cero', args: [A('number', 'número', 'Number', 'Número'), A('digits', 'decimales', 'Decimals', 'Decimales', { optional: true })], impl: (x, d = 0) => roundTo(num(x), num(d), 'down') },
  { en: 'INT', es: 'ENTERO', cat: 'math', desc: 'Rounds down to an integer', descEs: 'Redondea hacia abajo al entero', args: [A('number', 'número', 'Number', 'Número')], impl: (x) => Math.floor(num(x)) },
  { en: 'TRUNC', es: 'TRUNCAR', cat: 'math', desc: 'Truncates to an integer (or digits)', descEs: 'Trunca a entero (o a decimales)', args: [A('number', 'número', 'Number', 'Número'), A('digits', 'decimales', 'Decimals', 'Decimales', { optional: true })], impl: (x, d = 0) => roundTo(num(x), num(d), 'down') },
  { en: 'ABS', es: 'ABS', cat: 'math', desc: 'Absolute value', descEs: 'Valor absoluto', args: [A('number', 'número', 'Number', 'Número')], impl: (x) => Math.abs(num(x)) },
  { en: 'SIGN', es: 'SIGNO', cat: 'math', desc: 'Sign: 1, 0 or −1', descEs: 'Signo: 1, 0 o −1', args: [A('number', 'número', 'Number', 'Número')], impl: (x) => Math.sign(num(x)) },
  { en: 'SQRT', es: 'RAIZ', cat: 'math', desc: 'Square root', descEs: 'Raíz cuadrada', args: [A('number', 'número', 'Number', 'Número')], impl: (x) => {
    if (num(x) < 0) throw new XlError('#NUM!')
    return Math.sqrt(num(x))
  } },
  { en: 'POWER', es: 'POTENCIA', cat: 'math', desc: 'Number raised to a power', descEs: 'Número elevado a una potencia', args: [A('number', 'número', 'Base', 'Base'), A('power', 'potencia', 'Exponent', 'Exponente')], impl: (x, p) => num(x) ** num(p) },
  { en: 'EXP', es: 'EXP', cat: 'math', desc: 'e raised to a power', descEs: 'e elevado a una potencia', args: [A('number', 'número', 'Exponent', 'Exponente')], impl: (x) => Math.exp(num(x)) },
  { en: 'LN', es: 'LN', cat: 'math', desc: 'Natural logarithm', descEs: 'Logaritmo natural', args: [A('number', 'número', 'Positive number', 'Número positivo')], impl: (x) => {
    if (num(x) <= 0) throw new XlError('#NUM!')
    return Math.log(num(x))
  } },
  { en: 'LOG', es: 'LOG', cat: 'math', desc: 'Logarithm in a base (10 by default)', descEs: 'Logaritmo en una base (10 por defecto)', args: [A('number', 'número', 'Positive number', 'Número positivo'), A('base', 'base', 'Base', 'Base', { optional: true })], impl: (x, b = 10) => {
    if (num(x) <= 0 || num(b) <= 0 || num(b) === 1) throw new XlError('#NUM!')
    return Math.log(num(x)) / Math.log(num(b))
  } },
  { en: 'LOG10', es: 'LOG10', cat: 'math', desc: 'Base-10 logarithm', descEs: 'Logaritmo en base 10', args: [A('number', 'número', 'Positive number', 'Número positivo')], impl: (x) => Math.log10(num(x)) },
  { en: 'MOD', es: 'RESIDUO', cat: 'math', desc: 'Remainder of a division', descEs: 'Resto de una división', args: [A('number', 'número', 'Dividend', 'Dividendo'), A('divisor', 'divisor', 'Divisor', 'Divisor')], impl: (x, d) => {
    if (num(d) === 0) throw new XlError('#DIV/0!')
    return num(x) - num(d) * Math.floor(num(x) / num(d))
  } },
  { en: 'PI', es: 'PI', cat: 'math', desc: 'The number π', descEs: 'El número π', args: [], impl: () => Math.PI },
  { en: 'FACT', es: 'FACT', cat: 'math', desc: 'Factorial', descEs: 'Factorial', args: [A('number', 'número', 'Non-negative integer', 'Entero no negativo')], impl: (x) => {
    const n = Math.floor(num(x))
    if (n < 0) throw new XlError('#NUM!')
    let p = 1
    for (let k = 2; k <= n; k++) p *= k
    return p
  } },
  { en: 'RAND', es: 'ALEATORIO', cat: 'math', desc: 'Random number in [0, 1)', descEs: 'Número aleatorio en [0, 1)', args: [], impl: () => Math.random() },
  { en: 'RANDBETWEEN', es: 'ALEATORIO.ENTRE', cat: 'math', desc: 'Random integer between two numbers', descEs: 'Entero aleatorio entre dos números', args: [A('bottom', 'inferior', 'Lower bound', 'Límite inferior'), A('top', 'superior', 'Upper bound', 'Límite superior')], impl: (a, b) => Math.floor(num(a) + Math.random() * (num(b) - num(a) + 1)) },
  // ── trigonometría
  { en: 'SIN', es: 'SENO', cat: 'trig', desc: 'Sine (radians)', descEs: 'Seno (radianes)', args: [A('angle', 'ángulo', 'Angle in radians', 'Ángulo en radianes')], impl: (x) => Math.sin(num(x)) },
  { en: 'COS', es: 'COS', cat: 'trig', desc: 'Cosine (radians)', descEs: 'Coseno (radianes)', args: [A('angle', 'ángulo', 'Angle in radians', 'Ángulo en radianes')], impl: (x) => Math.cos(num(x)) },
  { en: 'TAN', es: 'TAN', cat: 'trig', desc: 'Tangent (radians)', descEs: 'Tangente (radianes)', args: [A('angle', 'ángulo', 'Angle in radians', 'Ángulo en radianes')], impl: (x) => Math.tan(num(x)) },
  { en: 'ASIN', es: 'ASENO', cat: 'trig', desc: 'Arcsine', descEs: 'Arcoseno', args: [A('number', 'número', 'Value in [−1, 1]', 'Valor en [−1, 1]')], impl: (x) => Math.asin(num(x)) },
  { en: 'ACOS', es: 'ACOS', cat: 'trig', desc: 'Arccosine', descEs: 'Arcocoseno', args: [A('number', 'número', 'Value in [−1, 1]', 'Valor en [−1, 1]')], impl: (x) => Math.acos(num(x)) },
  { en: 'ATAN', es: 'ATAN', cat: 'trig', desc: 'Arctangent', descEs: 'Arcotangente', args: [A('number', 'número', 'Number', 'Número')], impl: (x) => Math.atan(num(x)) },
  { en: 'RADIANS', es: 'RADIANES', cat: 'trig', desc: 'Degrees to radians', descEs: 'Grados a radianes', args: [A('angle', 'ángulo', 'Angle in degrees', 'Ángulo en grados')], impl: (x) => (num(x) * Math.PI) / 180 },
  { en: 'DEGREES', es: 'GRADOS', cat: 'trig', desc: 'Radians to degrees', descEs: 'Radianes a grados', args: [A('angle', 'ángulo', 'Angle in radians', 'Ángulo en radianes')], impl: (x) => (num(x) * 180) / Math.PI },
  // ── estadística
  { en: 'AVERAGE', es: 'PROMEDIO', cat: 'stat', desc: 'Arithmetic mean', descEs: 'Media aritmética', args: VALS, impl: (...a) => mean(nums(a)) },
  { en: 'AVERAGEIF', es: 'PROMEDIO.SI', cat: 'stat', desc: 'Mean of the cells that meet a condition', descEs: 'Media de las celdas que cumplen una condición', args: [RANGE, CRIT, A('average_range', 'rango_promedio', 'Cells to average', 'Celdas que se promedian', { optional: true })], impl: (r, c, s) => {
    const R = cellsOf(r).flat(), S = s === undefined ? R : cellsOf(s).flat(), f = criterion(c)
    return mean(R.flatMap((v, i) => (f(v) && isNum(S[i]) ? [S[i]] : [])))
  } },
  { en: 'MEDIAN', es: 'MEDIANA', cat: 'stat', desc: 'Median', descEs: 'Mediana', args: VALS, impl: (...a) => {
    const s = nums(a).sort((x, y) => x - y)
    if (!s.length) throw new XlError('#NUM!')
    const h = s.length >> 1
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2
  } },
  { en: 'MODE', es: 'MODA', cat: 'stat', desc: 'Most frequent value', descEs: 'Valor más frecuente', args: VALS, impl: (...a) => {
    const cnt = new Map<number, number>()
    for (const x of nums(a)) cnt.set(x, (cnt.get(x) ?? 0) + 1)
    let best: number | null = null, bc = 1
    for (const [x, c] of cnt) if (c > bc) ((best = x), (bc = c))
    if (best === null) throw new XlError('#N/A')
    return best
  } },
  { en: 'MIN', es: 'MIN', cat: 'stat', desc: 'Smallest value', descEs: 'Valor mínimo', args: VALS, impl: (...a) => {
    const n = nums(a)
    return n.length ? Math.min(...n) : 0
  } },
  { en: 'MAX', es: 'MAX', cat: 'stat', desc: 'Largest value', descEs: 'Valor máximo', args: VALS, impl: (...a) => {
    const n = nums(a)
    return n.length ? Math.max(...n) : 0
  } },
  { en: 'LARGE', es: 'K.ESIMO.MAYOR', cat: 'stat', desc: 'k-th largest value', descEs: 'k-ésimo valor más grande', args: [A('array', 'matriz', 'Range', 'Rango'), A('k', 'k', 'Position', 'Posición')], impl: (r, k) => {
    const s = nums([r]).sort((x, y) => y - x)
    const i = Math.ceil(num(k)) - 1
    if (i < 0 || i >= s.length) throw new XlError('#NUM!')
    return s[i]
  } },
  { en: 'SMALL', es: 'K.ESIMO.MENOR', cat: 'stat', desc: 'k-th smallest value', descEs: 'k-ésimo valor más pequeño', args: [A('array', 'matriz', 'Range', 'Rango'), A('k', 'k', 'Position', 'Posición')], impl: (r, k) => {
    const s = nums([r]).sort((x, y) => x - y)
    const i = Math.ceil(num(k)) - 1
    if (i < 0 || i >= s.length) throw new XlError('#NUM!')
    return s[i]
  } },
  { en: 'COUNT', es: 'CONTAR', cat: 'stat', desc: 'Counts the numbers', descEs: 'Cuenta los números', args: VALS, impl: (...a) => flat(a).filter(isNum).length },
  { en: 'COUNTA', es: 'CONTARA', cat: 'stat', desc: 'Counts the non-empty cells', descEs: 'Cuenta las celdas no vacías', args: VALS, impl: (...a) => flat(a).filter((v) => v !== null && v !== undefined && v !== '').length },
  { en: 'COUNTBLANK', es: 'CONTAR.BLANCO', cat: 'stat', desc: 'Counts the empty cells', descEs: 'Cuenta las celdas vacías', args: [RANGE], impl: (r) => cellsOf(r).flat().filter((v) => v === null || v === undefined || v === '').length },
  { en: 'COUNTIF', es: 'CONTAR.SI', cat: 'stat', desc: 'Counts the cells that meet a condition', descEs: 'Cuenta las celdas que cumplen una condición', args: [RANGE, CRIT], impl: (r, c) => cellsOf(r).flat().filter(criterion(c)).length },
  { en: 'STDEV', es: 'DESVEST', cat: 'stat', desc: 'Sample standard deviation', descEs: 'Desviación estándar muestral', args: VALS, impl: (...a) => Math.sqrt(variance(nums(a), true)) },
  { en: 'STDEVP', es: 'DESVESTP', cat: 'stat', desc: 'Population standard deviation', descEs: 'Desviación estándar poblacional', args: VALS, impl: (...a) => Math.sqrt(variance(nums(a), false)) },
  { en: 'VAR', es: 'VAR', cat: 'stat', desc: 'Sample variance', descEs: 'Varianza muestral', args: VALS, impl: (...a) => variance(nums(a), true) },
  { en: 'VARP', es: 'VARP', cat: 'stat', desc: 'Population variance', descEs: 'Varianza poblacional', args: VALS, impl: (...a) => variance(nums(a), false) },
  { en: 'CORREL', es: 'COEF.DE.CORREL', cat: 'stat', desc: 'Correlation coefficient', descEs: 'Coeficiente de correlación', args: [A('array1', 'matriz1', 'x values', 'Valores x'), A('array2', 'matriz2', 'y values', 'Valores y')], impl: (x, y) => fit(x, y).r },
  { en: 'SLOPE', es: 'PENDIENTE', cat: 'stat', desc: 'Slope of the least-squares line', descEs: 'Pendiente de la recta de mínimos cuadrados', args: [A('known_y', 'conocido_y', 'y values', 'Valores y'), A('known_x', 'conocido_x', 'x values', 'Valores x')], impl: (y, x) => fit(x, y).m },
  { en: 'INTERCEPT', es: 'INTERSECCION.EJE', cat: 'stat', desc: 'Intercept of the least-squares line', descEs: 'Ordenada al origen de la recta de mínimos cuadrados', args: [A('known_y', 'conocido_y', 'y values', 'Valores y'), A('known_x', 'conocido_x', 'x values', 'Valores x')], impl: (y, x) => fit(x, y).b },
  { en: 'RSQ', es: 'COEFICIENTE.R2', cat: 'stat', desc: 'R² of the least-squares line', descEs: 'R² de la recta de mínimos cuadrados', args: [A('known_y', 'conocido_y', 'y values', 'Valores y'), A('known_x', 'conocido_x', 'x values', 'Valores x')], impl: (y, x) => fit(x, y).r ** 2 },
  { en: 'FORECAST', es: 'PRONOSTICO', cat: 'stat', desc: 'Value of the least-squares line at x', descEs: 'Valor de la recta de mínimos cuadrados en x', args: [A('x', 'x', 'Point', 'Punto'), A('known_y', 'conocido_y', 'y values', 'Valores y'), A('known_x', 'conocido_x', 'x values', 'Valores x')], impl: (x0, y, x) => {
    const f = fit(x, y)
    return f.m * num(x0) + f.b
  } },
  // ── lógicas
  { en: 'IF', es: 'SI', cat: 'logic', desc: 'One value if a condition is true, another if false', descEs: 'Un valor si la condición es verdadera y otro si es falsa', args: [A('logical_test', 'prueba_lógica', 'Condition', 'Condición'), A('value_if_true', 'valor_si_verdadero', 'Result if true', 'Resultado si es verdadera'), A('value_if_false', 'valor_si_falso', 'Result if false', 'Resultado si es falsa', { optional: true })], lazy: true, impl: (c, t, f) => (truthy(c()) ? (t ? t() : true) : f ? f() : false) },
  { en: 'IFERROR', es: 'SI.ERROR', cat: 'logic', desc: 'A value, or another one if it is an error', descEs: 'Un valor, u otro si es un error', args: [A('value', 'valor', 'Value to check', 'Valor que se revisa'), A('value_if_error', 'valor_si_error', 'Result on error', 'Resultado si hay error')], lazy: true, impl: (v, e) => {
    try {
      const r = v()
      if (typeof r === 'number' && !Number.isFinite(r)) return e()
      return r
    } catch {
      return e()
    }
  } },
  { en: 'AND', es: 'Y', cat: 'logic', desc: 'True if all are true', descEs: 'Verdadero si todas lo son', args: [A('logical1', 'valor_lógico1', 'Condition', 'Condición'), A('logical2', 'valor_lógico2', 'More conditions', 'Más condiciones', { optional: true, rep: true })], impl: (...a) => flat(a).every((v) => truthy(v)) },
  { en: 'OR', es: 'O', cat: 'logic', desc: 'True if any is true', descEs: 'Verdadero si alguna lo es', args: [A('logical1', 'valor_lógico1', 'Condition', 'Condición'), A('logical2', 'valor_lógico2', 'More conditions', 'Más condiciones', { optional: true, rep: true })], impl: (...a) => flat(a).some((v) => truthy(v)) },
  { en: 'NOT', es: 'NO', cat: 'logic', desc: 'Negation', descEs: 'Negación', args: [A('logical', 'valor_lógico', 'Condition', 'Condición')], impl: (v) => !truthy(v) },
  { en: 'ISNUMBER', es: 'ESNUMERO', cat: 'logic', desc: 'True if the value is a number', descEs: 'Verdadero si el valor es un número', args: [A('value', 'valor', 'Value', 'Valor')], impl: (v) => isNum(v) },
  { en: 'ISBLANK', es: 'ESBLANCO', cat: 'logic', desc: 'True if the cell is empty', descEs: 'Verdadero si la celda está vacía', args: [A('value', 'valor', 'Cell', 'Celda')], impl: (v) => v === null || v === undefined || v === '' },
  // ── búsqueda
  { en: 'VLOOKUP', es: 'BUSCARV', cat: 'lookup', desc: 'Looks up a value in the first column and returns a column of that row', descEs: 'Busca en la primera columna y devuelve una columna de esa fila', args: [A('lookup_value', 'valor_buscado', 'Value to find', 'Valor que se busca'), A('table', 'matriz_tabla', 'Table range', 'Rango de la tabla'), A('col_index', 'indicador_columnas', 'Column to return (1 = first)', 'Columna que se devuelve (1 = primera)'), A('range_lookup', 'ordenado', 'TRUE = approximate (default), FALSE = exact', 'VERDADERO = aproximada (por defecto), FALSO = exacta', { optional: true })], impl: (k, t, c, approx = true) => {
    const T = cellsOf(t), ci = Math.floor(num(c)) - 1
    if (ci < 0 || ci >= (T[0]?.length ?? 0)) throw new XlError('#REF!')
    const i = lookupIndex(T.map((r) => r[0]), k, !truthy(approx))
    if (i < 0) throw new XlError('#N/A')
    return T[i][ci] ?? 0
  } },
  { en: 'HLOOKUP', es: 'BUSCARH', cat: 'lookup', desc: 'Looks up a value in the first row and returns a row of that column', descEs: 'Busca en la primera fila y devuelve una fila de esa columna', args: [A('lookup_value', 'valor_buscado', 'Value to find', 'Valor que se busca'), A('table', 'matriz_tabla', 'Table range', 'Rango de la tabla'), A('row_index', 'indicador_filas', 'Row to return (1 = first)', 'Fila que se devuelve (1 = primera)'), A('range_lookup', 'ordenado', 'TRUE = approximate (default), FALSE = exact', 'VERDADERO = aproximada (por defecto), FALSO = exacta', { optional: true })], impl: (k, t, r, approx = true) => {
    const T = cellsOf(t), ri = Math.floor(num(r)) - 1
    if (ri < 0 || ri >= T.length) throw new XlError('#REF!')
    const i = lookupIndex(T[0], k, !truthy(approx))
    if (i < 0) throw new XlError('#N/A')
    return T[ri][i] ?? 0
  } },
  { en: 'INDEX', es: 'INDICE', cat: 'lookup', desc: 'Value at a row and column of a range', descEs: 'Valor en una fila y columna de un rango', args: [A('array', 'matriz', 'Range', 'Rango'), A('row', 'núm_fila', 'Row (1 = first)', 'Fila (1 = primera)'), A('column', 'núm_columna', 'Column (1 = first)', 'Columna (1 = primera)', { optional: true })], impl: (t, r, c) => {
    const T = cellsOf(t)
    let ri = Math.floor(num(r)) - 1, ci = c === undefined ? 0 : Math.floor(num(c)) - 1
    // INDICE(fila_o_columna, n) en un rango de una sola fila
    if (c === undefined && T.length === 1) [ri, ci] = [0, ri]
    if (ri < 0 || ci < 0 || ri >= T.length || ci >= (T[ri]?.length ?? 0)) throw new XlError('#REF!')
    return T[ri][ci] ?? 0
  } },
  { en: 'MATCH', es: 'COINCIDIR', cat: 'lookup', desc: 'Position of a value in a row or column', descEs: 'Posición de un valor en una fila o columna', args: [A('lookup_value', 'valor_buscado', 'Value to find', 'Valor que se busca'), A('lookup_array', 'matriz_buscada', 'Row or column', 'Fila o columna'), A('match_type', 'tipo_de_coincidencia', '0 = exact, 1 = approximate (default)', '0 = exacta, 1 = aproximada (por defecto)', { optional: true })], impl: (k, r, t = 1) => {
    const i = lookupIndex(cellsOf(r).flat(), k, num(t) === 0)
    if (i < 0) throw new XlError('#N/A')
    return i + 1
  } },
  { en: 'CHOOSE', es: 'ELEGIR', cat: 'lookup', desc: 'Chooses a value from a list by position', descEs: 'Elige un valor de una lista por su posición', args: [A('index', 'índice', 'Position (1 = first)', 'Posición (1 = primera)'), A('value1', 'valor1', 'Values', 'Valores', { rep: true })], impl: (i, ...v) => {
    const k = Math.floor(num(i)) - 1
    if (k < 0 || k >= v.length) throw new XlError('#VALUE!')
    return v[k]
  } },
  // ── texto
  { en: 'CONCATENATE', es: 'CONCATENAR', cat: 'text', desc: 'Joins texts', descEs: 'Une textos', args: [A('text1', 'texto1', 'Text', 'Texto'), A('text2', 'texto2', 'More texts', 'Más textos', { optional: true, rep: true })], impl: (...a) => flat(a).map(str).join('') },
  { en: 'CONCAT', es: 'CONCAT', cat: 'text', desc: 'Joins texts and ranges', descEs: 'Une textos y rangos', args: [A('text1', 'texto1', 'Text or range', 'Texto o rango'), A('text2', 'texto2', 'More', 'Más', { optional: true, rep: true })], impl: (...a) => flat(a).map(str).join('') },
  { en: 'LEFT', es: 'IZQUIERDA', cat: 'text', desc: 'First characters of a text', descEs: 'Primeros caracteres de un texto', args: [A('text', 'texto', 'Text', 'Texto'), A('num_chars', 'núm_caracteres', 'How many (1 by default)', 'Cuántos (1 por defecto)', { optional: true })], impl: (t, n = 1) => str(t).slice(0, num(n)) },
  { en: 'RIGHT', es: 'DERECHA', cat: 'text', desc: 'Last characters of a text', descEs: 'Últimos caracteres de un texto', args: [A('text', 'texto', 'Text', 'Texto'), A('num_chars', 'núm_caracteres', 'How many (1 by default)', 'Cuántos (1 por defecto)', { optional: true })], impl: (t, n = 1) => (num(n) ? str(t).slice(-num(n)) : '') },
  { en: 'MID', es: 'EXTRAE', cat: 'text', desc: 'Characters from the middle of a text', descEs: 'Caracteres del medio de un texto', args: [A('text', 'texto', 'Text', 'Texto'), A('start', 'posición_inicial', 'First position (1 = first)', 'Posición inicial (1 = primera)'), A('num_chars', 'núm_caracteres', 'How many', 'Cuántos')], impl: (t, s, n) => str(t).substr(num(s) - 1, num(n)) },
  { en: 'LEN', es: 'LARGO', cat: 'text', desc: 'Number of characters', descEs: 'Número de caracteres', args: [A('text', 'texto', 'Text', 'Texto')], impl: (t) => str(t).length },
  { en: 'UPPER', es: 'MAYUSC', cat: 'text', desc: 'To uppercase', descEs: 'A mayúsculas', args: [A('text', 'texto', 'Text', 'Texto')], impl: (t) => str(t).toUpperCase() },
  { en: 'LOWER', es: 'MINUSC', cat: 'text', desc: 'To lowercase', descEs: 'A minúsculas', args: [A('text', 'texto', 'Text', 'Texto')], impl: (t) => str(t).toLowerCase() },
  { en: 'TRIM', es: 'ESPACIOS', cat: 'text', desc: 'Removes extra spaces', descEs: 'Quita los espacios sobrantes', args: [A('text', 'texto', 'Text', 'Texto')], impl: (t) => str(t).trim().replace(/\s+/g, ' ') },
  { en: 'VALUE', es: 'VALOR', cat: 'text', desc: 'Text to number', descEs: 'Texto a número', args: [A('text', 'texto', 'Text', 'Texto')], impl: (t) => {
    const n = Number(str(t).replace(',', '.'))
    if (!Number.isFinite(n)) throw new XlError('#VALUE!')
    return n
  } },
  { en: 'TEXT', es: 'TEXTO', cat: 'text', desc: 'Number as text with a format ("0.00", "0%")', descEs: 'Número como texto con un formato ("0.00", "0%")', args: [A('value', 'valor', 'Number', 'Número'), A('format', 'formato', 'Format, e.g. "0.00" or "0%"', 'Formato, p. ej. "0.00" o "0%"')], impl: (v, f) => {
    const fs = str(f)
    const d = (fs.split(/[.,]/)[1] ?? '').replace(/[^0#]/g, '').length
    return fs.includes('%') ? (num(v) * 100).toFixed(d) + '%' : num(v).toFixed(d)
  } },
  // ── financieras
  { en: 'NPV', es: 'VNA', cat: 'fin', desc: 'Net present value of future cash flows', descEs: 'Valor neto actual de flujos futuros', args: [A('rate', 'tasa', 'Discount rate per period', 'Tasa de descuento por período'), A('value1', 'valor1', 'Cash flows (from period 1)', 'Flujos (desde el período 1)', { rep: true })], impl: (r, ...v) => nums(v).reduce((s, x, i) => s + x / (1 + num(r)) ** (i + 1), 0) },
  { en: 'IRR', es: 'TIR', cat: 'fin', desc: 'Internal rate of return', descEs: 'Tasa interna de retorno', args: [A('values', 'valores', 'Cash flows (period 0 first)', 'Flujos (primero el período 0)'), A('guess', 'estimar', 'Initial guess', 'Estimación inicial', { optional: true })], impl: (v, g = 0.1) => {
    const f = nums([v])
    const npv = (r: number) => f.reduce((s, x, i) => s + x / (1 + r) ** i, 0)
    const d = (r: number) => f.reduce((s, x, i) => s - (i * x) / (1 + r) ** (i + 1), 0)
    let r = num(g)
    for (let k = 0; k < 100; k++) {
      const dr = npv(r) / d(r)
      r -= dr
      if (!Number.isFinite(r)) break
      if (Math.abs(dr) < 1e-12) return r
    }
    throw new XlError('#NUM!')
  } },
  { en: 'PMT', es: 'PAGO', cat: 'fin', desc: 'Payment of a loan with constant payments', descEs: 'Pago de un préstamo con cuotas constantes', args: [A('rate', 'tasa', 'Rate per period', 'Tasa por período'), A('nper', 'nper', 'Number of payments', 'Número de pagos'), A('pv', 'va', 'Present value', 'Valor actual'), A('fv', 'vf', 'Future value', 'Valor futuro', { optional: true }), A('type', 'tipo', '0 = end, 1 = start', '0 = al final, 1 = al inicio', { optional: true })], impl: (r, n, pv, fv = 0, t = 0) => {
    const i = num(r), N = num(n), P = num(pv), F = num(fv)
    if (i === 0) return -(P + F) / N
    const q = (1 + i) ** N
    return -(i * (P * q + F)) / ((1 + i * num(t)) * (q - 1))
  } },
  { en: 'FV', es: 'VF', cat: 'fin', desc: 'Future value of an investment', descEs: 'Valor futuro de una inversión', args: [A('rate', 'tasa', 'Rate per period', 'Tasa por período'), A('nper', 'nper', 'Number of periods', 'Número de períodos'), A('pmt', 'pago', 'Payment per period', 'Pago por período'), A('pv', 'va', 'Present value', 'Valor actual', { optional: true }), A('type', 'tipo', '0 = end, 1 = start', '0 = al final, 1 = al inicio', { optional: true })], impl: (r, n, p, pv = 0, t = 0) => {
    const i = num(r), N = num(n)
    if (i === 0) return -(num(pv) + num(p) * N)
    const q = (1 + i) ** N
    return -(num(pv) * q + (num(p) * (1 + i * num(t)) * (q - 1)) / i)
  } },
  { en: 'PV', es: 'VA', cat: 'fin', desc: 'Present value of an investment', descEs: 'Valor actual de una inversión', args: [A('rate', 'tasa', 'Rate per period', 'Tasa por período'), A('nper', 'nper', 'Number of periods', 'Número de períodos'), A('pmt', 'pago', 'Payment per period', 'Pago por período'), A('fv', 'vf', 'Future value', 'Valor futuro', { optional: true }), A('type', 'tipo', '0 = end, 1 = start', '0 = al final, 1 = al inicio', { optional: true })], impl: (r, n, p, fv = 0, t = 0) => {
    const i = num(r), N = num(n)
    if (i === 0) return -(num(fv) + num(p) * N)
    const q = (1 + i) ** N
    return -(num(fv) + (num(p) * (1 + i * num(t)) * (q - 1)) / i) / q
  } },
]

const BY_NAME = new Map<string, FnDef>()
for (const f of FUNCTIONS) {
  BY_NAME.set(f.en, f)
  BY_NAME.set(f.es, f)
}
/** Función de hoja por nombre (inglés o español, sin distinguir mayúsculas). */
export const sheetFunction = (name: string): FnDef | undefined => BY_NAME.get(name.toUpperCase())
/** Nombre interno con el que se registra en mathjs. */
export const internalName = (f: FnDef) => 'XL_' + f.en
