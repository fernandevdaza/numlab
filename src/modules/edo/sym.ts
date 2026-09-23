// Utilidades simbólicas del módulo EDO: primas (y', y''), TeX con renombrado de variables,
// sustitución numérica para el "paso a paso", derivadas totales para Taylor y conversión a Scilab.
import type { MathNode } from 'mathjs'
import { compile, derivative, math, toScilab, toTex, type CompileResult } from '../../lib/expr'
import { fmt } from '../../lib/format'

/** y' → dy, y'' → d2y, x''' → d3x (las primas de mathjs serían "transpuesta"). */
export function primes(src: string): string {
  return src.replace(/(?<![A-Za-z_])([A-Za-z])('+)/g, (_m, v: string, p: string) => (p.length === 1 ? 'd' + v : `d${p.length}${v}`))
}

/**
 * El texto usa x como variable independiente; en las páginas de una ecuación escalar la aplicación usa t.
 * Permite escribir x en lugar de t (sólo si la expresión no usa ya t).
 */
export function xToT(src: string): string {
  // (se permite un número delante: 10x = 10·x)
  if (/(?<![A-Za-z_])t(?![A-Za-z_0-9])/.test(src)) return src
  return src.replace(/(?<![A-Za-z_])x(?![A-Za-z_0-9(])/g, 't')
}

/** Nombre interno de la k-ésima derivada de la variable v: v, dv, d2v, d3v… */
export function derivName(v: string, k: number): string {
  return k === 0 ? v : k === 1 ? 'd' + v : `d${k}${v}`
}
/** TeX de la k-ésima derivada: y, y', y'', y''', y^{(4)} */
export function derivTex(v: string, k: number): string {
  return k <= 3 ? v + "'".repeat(k) : `${v}^{(${k})}`
}

/** Compila aceptando primas. */
export function compileOde(src: string, vars: string[]): CompileResult {
  const r = compile(primes(src), vars)
  return r.ok ? r : { ...r, src }
}

function isFnName(n: any, parent: any) {
  return parent && parent.isFunctionNode && parent.fn === n
}

/** TeX de un nodo renombrando variables (p. ej. y1 → y_1, dy → y'). */
export function texOf(node: MathNode, names: Record<string, string>): string {
  const keys: string[] = []
  const tr = node.transform((n: any, _p: string, parent: any) => {
    if (n.isSymbolNode && !isFnName(n, parent) && names[n.name] !== undefined) {
      keys.push(names[n.name])
      return new math.SymbolNode(`QZ${keys.length - 1}QZ`)
    }
    return n
  })
  return toTex(tr).replace(/QZ(\d+)QZ/g, (_m, i: string) => '{' + keys[Number(i)] + '}')
}

/** Número redondeado para mostrar en sustituciones. */
export function rnd(x: number, digits = 7): number {
  return Number.isFinite(x) ? Number(x.toPrecision(digits)) : x
}

/** Expresión con los valores numéricos sustituidos, en TeX (para el paso a paso). */
export function substTex(node: MathNode, values: Record<string, number>, digits = 7): string {
  // multiplicación implícita "4 y" → explícita "4·(valor)" para que no se confundan los números
  const copy = node.cloneDeep()
  copy.traverse((n: any) => {
    if (n.isOperatorNode && n.implicit) n.implicit = false
  })
  const tr = copy.transform((n: any, _p: string, parent: any) => {
    if (n.isSymbolNode && !isFnName(n, parent) && values[n.name] !== undefined) {
      const v = rnd(values[n.name], digits)
      const c = new math.ConstantNode(v)
      const inArgs = parent && (parent.isFunctionNode || parent.isParenthesisNode)
      return v < 0 && !inArgs ? new math.ParenthesisNode(c) : c
    }
    return n
  })
  try {
    return tr.toTex({ parenthesis: 'keep', implicit: 'hide' }).replace(/\\mathrm\{log\}/g, '\\ln')
  } catch {
    return ''
  }
}

/** Número a TeX, con signo y notación científica. */
export function tn(x: number, digits = 8): string {
  const s = fmt(x, digits)
  const m = s.match(/^(-?[\d.]+)e([+-]\d+)$/)
  if (m) return `${m[1]}\\times 10^{${Number(m[2])}}`
  return s.replace('∞', '\\infty').replace('−', '-')
}
/** Número entre paréntesis si es negativo. */
export function tp(x: number, digits = 8): string {
  return x < 0 ? `(${tn(x, digits)})` : tn(x, digits)
}

/** Coeficiente como fracción TeX (\tfrac12) o decimal. */
export function coefTex(x: number): string {
  for (let q = 1; q <= 60; q++) {
    const p = Math.round(x * q)
    if (Math.abs(p / q - x) < 1e-12) return q === 1 ? String(p) : `${p < 0 ? '-' : ''}\\tfrac{${Math.abs(p)}}{${q}}`
  }
  return tn(x, 6)
}
/** Coeficiente como fracción Scilab (1/2) o decimal. */
export function coefSci(x: number): string {
  for (let q = 1; q <= 60000; q++) {
    const p = Math.round(x * q)
    if (Math.abs(p / q - x) < 1e-13) return q === 1 ? String(p) : `${p}/${q}`
  }
  return String(x)
}

function simp(n: MathNode): MathNode {
  try {
    return math.simplify(n)
  } catch {
    return n
  }
}

/**
 * Derivadas totales de y respecto de t a lo largo de la solución de y' = f(t, y):
 *   D₁ = f,  D_{k+1} = ∂D_k/∂t + ∂D_k/∂y · f.
 * Devuelve [D₁, …, D_p] como nodos simplificados.
 */
export function totalDerivatives(f: MathNode, p: number): MathNode[] {
  const out: MathNode[] = [f]
  for (let k = 1; k < p; k++) {
    const D = out[k - 1]
    const dt = derivative(D, 't')
    const dy = derivative(D, 'y')
    const comb = new math.OperatorNode('+', 'add', [dt, new math.OperatorNode('*', 'multiply', [dy, f])])
    out.push(simp(comb))
  }
  return out
}

/** Expresión a Scilab renombrando variables (p. ej. y1 → Y(1)). */
export function sciOf(node: MathNode, rename: Record<string, string> = {}): string {
  const tr = node.transform((n: any, _p: string, parent: any) => {
    if (n.isSymbolNode && !isFnName(n, parent) && rename[n.name] !== undefined) return new math.SymbolNode(rename[n.name])
    return n
  })
  return toScilab(tr, false)
}

/** Nombres de variables para sistemas: y1..yn o x, y, z, w, u, v. */
export type Naming = 'y' | 'xyz'
export const XYZ = ['x', 'y', 'z', 'w', 'u', 'v']
export function sysNames(n: number, naming: Naming): string[] {
  return naming === 'xyz' && n <= XYZ.length ? XYZ.slice(0, n) : Array.from({ length: n }, (_, i) => 'y' + (i + 1))
}
export function sysTex(name: string): string {
  const m = name.match(/^([a-z])(\d+)$/)
  return m ? `${m[1]}_{${m[2]}}` : name
}

/**
 * Segunda derivada de un sistema Y' = F(t, Y) a lo largo de la solución (Taylor 2 para sistemas):
 *   Y''_m = ∂f_m/∂t + Σ_j ∂f_m/∂y_j · f_j   (= ∂F/∂t + J·F).
 */
export function secondDerivatives(nodes: MathNode[], vars: string[]): MathNode[] {
  return nodes.map((fm) => {
    let acc: MathNode = derivative(fm, 't')
    vars.forEach((v, j) => {
      acc = new math.OperatorNode('+', 'add', [acc, new math.OperatorNode('*', 'multiply', [derivative(fm, v), nodes[j]])])
    })
    return simp(acc)
  })
}
