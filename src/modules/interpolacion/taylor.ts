// Derivadas de orden alto por diferenciación automática en modo Taylor.
// Evalúa el árbol de mathjs con aritmética de series truncadas: c_k = f^{(k)}(x0)/k!.
// Es exacto (salvo redondeo) y muy rápido, a diferencia de derivar simbólicamente n veces.

type S = number[]

const cst = (v: number, K: number): S => {
  const s = new Array(K + 1).fill(0)
  s[0] = v
  return s
}
const add = (a: S, b: S) => a.map((v, i) => v + b[i])
const subS = (a: S, b: S) => a.map((v, i) => v - b[i])
const scale = (a: S, k: number) => a.map((v) => v * k)
function mul(a: S, b: S): S {
  const K = a.length - 1
  const out = new Array(K + 1).fill(0)
  for (let k = 0; k <= K; k++) {
    let t = 0
    for (let j = 0; j <= k; j++) t += a[j] * b[k - j]
    out[k] = t
  }
  return out
}
function div(a: S, b: S): S {
  const K = a.length - 1
  const q = new Array(K + 1).fill(0)
  for (let k = 0; k <= K; k++) {
    let t = a[k]
    for (let j = 1; j <= k; j++) t -= b[j] * q[k - j]
    q[k] = t / b[0]
  }
  return q
}
function exp(a: S): S {
  const K = a.length - 1
  const e = new Array(K + 1).fill(0)
  e[0] = Math.exp(a[0])
  for (let k = 1; k <= K; k++) {
    let t = 0
    for (let j = 1; j <= k; j++) t += j * a[j] * e[k - j]
    e[k] = t / k
  }
  return e
}
function log(a: S): S {
  const K = a.length - 1
  const l = new Array(K + 1).fill(0)
  l[0] = Math.log(a[0])
  for (let k = 1; k <= K; k++) {
    let t = 0
    for (let j = 1; j < k; j++) t += j * l[j] * a[k - j]
    l[k] = (a[k] - t / k) / a[0]
  }
  return l
}
function powConst(a: S, r: number): S {
  const K = a.length - 1
  if (Number.isInteger(r) && r >= 0 && r <= 64) {
    let out = cst(1, K)
    let base = a
    let e = r
    while (e > 0) {
      if (e & 1) out = mul(out, base)
      e >>= 1
      if (e) base = mul(base, base)
    }
    return out
  }
  if (Number.isInteger(r) && r < 0) return div(cst(1, K), powConst(a, -r))
  const p = new Array(K + 1).fill(0)
  p[0] = Math.pow(a[0], r)
  for (let k = 1; k <= K; k++) {
    let t = 0
    for (let j = 1; j <= k; j++) t += ((r + 1) * j - k) * a[j] * p[k - j]
    p[k] = t / (k * a[0])
  }
  return p
}
function sinCos(a: S, hyper = false): [S, S] {
  const K = a.length - 1
  const s = new Array(K + 1).fill(0)
  const c = new Array(K + 1).fill(0)
  s[0] = hyper ? Math.sinh(a[0]) : Math.sin(a[0])
  c[0] = hyper ? Math.cosh(a[0]) : Math.cos(a[0])
  for (let k = 1; k <= K; k++) {
    let ts = 0, tc = 0
    for (let j = 1; j <= k; j++) {
      ts += j * a[j] * c[k - j]
      tc += j * a[j] * s[k - j]
    }
    s[k] = ts / k
    c[k] = (hyper ? tc : -tc) / k
  }
  return [s, c]
}
/** Integra una serie de derivada: dado g' (como serie) y g(x0), devuelve g. */
function integrate(dg: S, g0: number): S {
  const K = dg.length - 1
  const g = new Array(K + 1).fill(0)
  g[0] = g0
  for (let k = 1; k <= K; k++) g[k] = dg[k - 1] / k
  return g
}
function deriv(a: S): S {
  const K = a.length - 1
  return a.map((_, k) => (k < K ? (k + 1) * a[k + 1] : 0))
}

const CONSTS: Record<string, number> = { pi: Math.PI, PI: Math.PI, e: Math.E, E: Math.E, phi: (1 + Math.sqrt(5)) / 2, tau: 2 * Math.PI }

function ev(node: any, x0: number, K: number, v: string): S {
  if (node.isParenthesisNode) return ev(node.content, x0, K, v)
  if (node.isConstantNode) return cst(Number(node.value), K)
  if (node.isSymbolNode) {
    if (node.name === v) {
      const s = cst(x0, K)
      if (K >= 1) s[1] = 1
      return s
    }
    if (node.name in CONSTS) return cst(CONSTS[node.name], K)
    throw new Error('Símbolo no soportado: ' + node.name)
  }
  if (node.isOperatorNode) {
    const args = node.args.map((a: any) => ev(a, x0, K, v))
    switch (node.fn) {
      case 'add': return args.reduce(add)
      case 'subtract': return subS(args[0], args[1])
      case 'multiply': return args.reduce(mul)
      case 'divide': return div(args[0], args[1])
      case 'unaryMinus': return scale(args[0], -1)
      case 'unaryPlus': return args[0]
      case 'pow': {
        const [a, b] = args
        if (b.slice(1).every((t: number) => t === 0)) return powConst(a, b[0])
        return exp(mul(b, log(a)))
      }
    }
    throw new Error('Operador no soportado: ' + node.op)
  }
  if (node.isFunctionNode) {
    const name = node.fn?.name ?? node.name
    const args = node.args.map((a: any) => ev(a, x0, K, v))
    const a = args[0]
    switch (name) {
      case 'exp': return exp(a)
      case 'log':
        return args.length === 2 ? div(log(a), log(args[1])) : log(a)
      case 'ln': return log(a)
      case 'log10': return scale(log(a), 1 / Math.LN10)
      case 'log2': return scale(log(a), 1 / Math.LN2)
      case 'sqrt': return powConst(a, 0.5)
      case 'cbrt': return a[0] < 0 ? scale(powConst(scale(a, -1), 1 / 3), -1) : powConst(a, 1 / 3)
      case 'sin': case 'sen': return sinCos(a)[0]
      case 'cos': return sinCos(a)[1]
      case 'tan': case 'tg': { const [s, c] = sinCos(a); return div(s, c) }
      case 'sec': return div(cst(1, K), sinCos(a)[1])
      case 'csc': return div(cst(1, K), sinCos(a)[0])
      case 'cot': { const [s, c] = sinCos(a); return div(c, s) }
      case 'sinh': return sinCos(a, true)[0]
      case 'cosh': return sinCos(a, true)[1]
      case 'tanh': { const [s, c] = sinCos(a, true); return div(s, c) }
      case 'atan': case 'arctan': case 'arctg':
        return integrate(div(deriv(a), add(cst(1, K), mul(a, a))), Math.atan(a[0]))
      case 'asin': case 'arcsen':
        return integrate(div(deriv(a), powConst(subS(cst(1, K), mul(a, a)), 0.5)), Math.asin(a[0]))
      case 'acos': case 'arccos':
        return integrate(scale(div(deriv(a), powConst(subS(cst(1, K), mul(a, a)), 0.5)), -1), Math.acos(a[0]))
      case 'abs': return a[0] < 0 ? scale(a, -1) : a
      case 'pow': return ev({ isOperatorNode: true, fn: 'pow', args: node.args }, x0, K, v)
      case 'square': return mul(a, a)
      case 'cube': return mul(a, mul(a, a))
    }
    throw new Error('Función no soportada para derivadas de orden alto: ' + name)
  }
  throw new Error('Expresión no soportada')
}

/** Devuelve una función x ↦ f^{(k)}(x) usando series de Taylor. Lanza error si la expresión no es soportada. */
export function taylorDerivative(node: unknown, k: number, v = 'x'): (x: number) => number {
  let kfact = 1
  for (let i = 2; i <= k; i++) kfact *= i
  ev(node, 0.5, k, v) // valida soporte (puede dar NaN, no importa)
  return (x: number) => {
    try {
      return ev(node, x, k, v)[k] * kfact
    } catch {
      return NaN
    }
  }
}
