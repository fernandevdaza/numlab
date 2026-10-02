// Expresiones matemáticas: parseo, compilación, derivación simbólica y conversión a TeX / Scilab.
import { create, all, type MathNode } from 'mathjs'
import { L } from '../i18n.ts'
import { cleanPasted } from './pegar.ts'

export const math = create(all, { number: 'number' })

// Alias cómodos para estudiantes: ln(x), sen(x), tg(x), arcsen, etc.
math.import(
  {
    ln: (x: number) => Math.log(x),
    sen: (x: number) => Math.sin(x),
    tg: (x: number) => Math.tan(x),
    arcsen: (x: number) => Math.asin(x),
    arccos: (x: number) => Math.acos(x),
    arctan: (x: number) => Math.atan(x),
    arctg: (x: number) => Math.atan(x),
  },
  { override: true },
)

/** Normaliza la entrada del usuario antes de parsear. */
export function normalize(src: string): string {
  // texto copiado de una fórmula o del CAS: TeX, ·, −, ², «f(x) = …»
  return cleanPasted(src)
    .replace(/\*\*/g, '^')
    .replace(/\bln\s*\(/g, 'log(')
    .replace(/\bsen\s*\(/g, 'sin(')
    .replace(/\btg\s*\(/g, 'tan(')
    .replace(/\barcsen\s*\(/g, 'asin(')
    .replace(/\barctg\s*\(/g, 'atan(')
    .replace(/\barctan\s*\(/g, 'atan(')
    .replace(/\barccos\s*\(/g, 'acos(')
    .replace(/,(?=\d)/g, '.') // 3,14 -> 3.14 solo cuando no hay espacio (argumentos usan ", ")
    .trim()
}

export interface Compiled {
  ok: true
  src: string
  node: MathNode
  /** Evalúa con los argumentos en el orden de `vars`. */
  f: (...args: number[]) => number
  tex: string
  vars: string[]
}
export interface CompileError {
  ok: false
  src: string
  error: string
}
export type CompileResult = Compiled | CompileError

const KNOWN_CONSTANTS = new Set(['pi', 'e', 'E', 'PI', 'i', 'Infinity', 'NaN', 'phi', 'tau'])

/** Compila una expresión en las variables dadas (por defecto x). Nunca lanza excepción. */
export function compile(src: string, vars: string[] = ['x']): CompileResult {
  try {
    if (!src.trim()) return { ok: false, src, error: L('Expresión vacía', 'Empty expression') }
    const node = math.parse(normalize(src))
    // Verificar variables libres desconocidas
    const unknown = new Set<string>()
    node.traverse((n: MathNode, _path: string, parent: MathNode | null) => {
      if ((n as any).isSymbolNode) {
        const name = (n as any).name as string
        const isFnName = parent && (parent as any).isFunctionNode && (parent as any).fn === n
        if (!isFnName && !vars.includes(name) && !KNOWN_CONSTANTS.has(name)) unknown.add(name)
      }
    })
    if (unknown.size) {
      return {
        ok: false,
        src,
        error: L(
          `Variable desconocida: ${[...unknown].join(', ')}. Variables permitidas: ${vars.join(', ')}`,
          `Unknown variable: ${[...unknown].join(', ')}. Allowed variables: ${vars.join(', ')}`,
        ),
      }
    }
    const code = node.compile()
    const f = (...args: number[]) => {
      const scope: Record<string, number> = {}
      for (let i = 0; i < vars.length; i++) scope[vars[i]] = args[i]
      try {
        const v = code.evaluate(scope)
        return typeof v === 'number' ? v : Number(v)
      } catch {
        return NaN
      }
    }
    // evaluación de prueba: detecta errores que el parser no ve (p. ej. "sqrt()" sin argumento)
    try {
      const scope: Record<string, number> = {}
      for (const v of vars) scope[v] = 0.5
      code.evaluate(scope)
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      if (/Too few arguments|Too many arguments|Wrong number of arguments/i.test(msg))
        return { ok: false, src, error: L('Número de argumentos incorrecto en una función (p. ej. sqrt() vacío)', 'Wrong number of arguments in a function (e.g. empty sqrt())') }
    }
    return { ok: true, src, node, f, tex: toTex(node), vars }
  } catch (e: any) {
    return { ok: false, src, error: traducirError(e?.message ?? String(e)) }
  }
}

/** Mensajes de math.js: en español se traducen; en inglés se dejan tal cual (ya están en inglés). */
function traducirError(msg: string): string {
  if (L(false, true)) return msg
  return msg
    .replace('Unexpected end of expression', 'Expresión incompleta')
    .replace('Parenthesis ) expected', 'Falta cerrar paréntesis )')
    .replace('Unexpected operator', 'Operador inesperado')
    .replace('Undefined symbol', 'Símbolo no definido')
    .replace('Value expected', 'Se esperaba un valor')
}

export function toTex(node: MathNode | string): string {
  try {
    const n = typeof node === 'string' ? math.parse(normalize(node)) : node
    return n.toTex({ parenthesis: 'auto', implicit: 'hide' }).replace(/\\mathrm\{log\}/g, '\\ln')
      .replace(/(\d)\s*\\cdot\s*(?=[a-zA-Z]|\\left|\\sqrt|\\sin|\\cos|\\tan|\\exp|\\ln|\\pi)/g, '$1')
  } catch {
    return String(node)
  }
}

/** Derivada simbólica simplificada. */
export function derivative(node: MathNode | string, variable = 'x'): MathNode {
  const n = typeof node === 'string' ? math.parse(normalize(node)) : node
  const d = math.derivative(n, variable)
  try {
    return math.simplify(d)
  } catch {
    return d
  }
}

/** Compila la derivada de una expresión ya compilada. */
export function compileDerivative(c: Compiled, variable = 'x', order = 1): CompileResult {
  try {
    let n: MathNode = c.node
    for (let k = 0; k < order; k++) n = derivative(n, variable)
    return compile(n.toString(), c.vars)
  } catch (e: any) {
    return { ok: false, src: c.src, error: L('No se pudo derivar: ', 'Could not differentiate: ') + (e?.message ?? e) }
  }
}

/** Evalúa una expresión numérica constante como "pi/4" o "sqrt(2)". Devuelve NaN si falla. */
export function evalNumber(src: string | number): number {
  if (typeof src === 'number') return src
  try {
    const v = math.evaluate(normalize(src))
    return typeof v === 'number' ? v : Number(v)
  } catch {
    return NaN
  }
}

/**
 * Convierte una expresión a sintaxis Scilab.
 * elementwise=true usa .* ./ .^ para que funcione con vectores.
 */
export function toScilab(src: string | MathNode, elementwise = true): string {
  try {
    const n = typeof src === 'string' ? math.parse(normalize(src)) : src
    const t = n.transform((node: any) => {
      if (node.isSymbolNode && !node.isFunctionNode) {
        if (node.name === 'pi' || node.name === 'PI') return new math.SymbolNode('%pi')
        if (node.name === 'e' || node.name === 'E') return new math.SymbolNode('%e')
      }
      return node
    })
    let s = t.toString({ parenthesis: 'keep', implicit: 'show' })
    s = s.replace(/\blog10\(/g, 'LOG10_TMP(').replace(/\blog\(/g, 'log(').replace(/LOG10_TMP\(/g, 'log10(')
    if (elementwise) s = s.replace(/(?<![.])\*/g, '.*').replace(/(?<![.])\//g, './').replace(/(?<![.])\^/g, '.^')
    return s
  } catch {
    return String(src)
  }
}
