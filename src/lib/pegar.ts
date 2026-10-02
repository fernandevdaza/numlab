// Copiar y pegar matemáticas entre el CAS, las fórmulas renderizadas y los campos de los módulos.
//
// · texToPlain: TeX (lo que hay detrás de cada fórmula KaTeX) → sintaxis que entienden mathjs y el CAS.
// · cleanPasted: limpia texto pegado: TeX, símbolos Unicode (·, −, ², √, π…), «f(x) = …», «+ C».
// · installClipboard: al copiar una fórmula se copia en sintaxis de entrada, y al pegar en un campo
//   matemático se limpia el texto antes de insertarlo.

/** Contenido del grupo {…} que empieza en s[i] (debe ser «{»). */
function readGroup(s: string, i: number): { body: string; end: number } | null {
  if (s[i] !== '{') return null
  let depth = 0
  for (let k = i; k < s.length; k++) {
    if (s[k] === '{') depth++
    else if (s[k] === '}' && --depth === 0) return { body: s.slice(i + 1, k), end: k + 1 }
  }
  return null
}

const skipSpaces = (s: string, i: number) => {
  while (s[i] === ' ') i++
  return i
}

/** Reemplaza \cmd{a}{b}… (de dentro hacia fuera) con fmt(a, b, …). */
function replaceCmd(s: string, re: RegExp, nArgs: number, fmt: (args: string[], opt?: string) => string): string {
  for (let guard = 0; guard < 200; guard++) {
    re.lastIndex = 0
    const m = re.exec(s)
    if (!m) break
    let i = m.index + m[0].length
    let opt: string | undefined
    i = skipSpaces(s, i)
    if (s[i] === '[') {
      const close = s.indexOf(']', i)
      if (close < 0) break
      opt = s.slice(i + 1, close)
      i = skipSpaces(s, close + 1)
    }
    const args: string[] = []
    for (let k = 0; k < nArgs; k++) {
      i = skipSpaces(s, i)
      const g = readGroup(s, i)
      if (g) {
        args.push(g.body)
        i = g.end
      } else if (i < s.length) {
        // argumento de un solo carácter: \frac12
        args.push(s[i])
        i++
      } else break
    }
    if (args.length < nArgs) break
    s = s.slice(0, m.index) + fmt(args, opt) + s.slice(i)
  }
  return s
}

const FN_TEX: Record<string, string> = { ln: 'log', arcsin: 'asin', arccos: 'acos', arctan: 'atan', operatorname: '' }

/** Convierte TeX (de KaTeX o de otra fuente) a sintaxis de entrada: \frac{1}{x} → (1)/(x). */
export function texToPlain(tex: string): string {
  let s = tex
    // matrices primero (antes de que «\\\\» se confunda con un espacio «\\ »)
    .replace(/\\begin\{[pbvBV]?matrix\}([\s\S]*?)\\end\{[pbvBV]?matrix\}/g, (_, body: string) => '[' + body.split(/\\\\/).map((r) => r.split('&').map((c) => c.trim()).join(', ')).join('; ') + ']')
    .replace(/\\(?:displaystyle|textstyle|limits)\b/g, '')
    .replace(/\\left\.|\\right\./g, '')
    .replace(/\\(?:left|right|bigl|bigr|Bigl|Bigr|big|Big|bigg|Bigg)\s*(\\[{}|]|[()[\]|])/g, '$1')
    .replace(/\\left\\vert|\\right\\vert|\\vert|\\lvert|\\rvert|\\mid/g, '|')
    .replace(/\\[{}]/g, (m) => (m === '\\{' ? '(' : ')'))
    .replace(/\\(?:,|;|:|!|>| |quad|qquad)/g, ' ')
    .replace(/~/g, ' ')
    .replace(/\\(?:cdot|times|ast)\b/g, '*')
    .replace(/\\div\b/g, '/')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\(?:le|leq)\b/g, '<=')
    .replace(/\\(?:ge|geq)\b/g, '>=')
    .replace(/\\(?:ne|neq)\b/g, '!=')
    .replace(/\\(?:to|rightarrow|Rightarrow|implies)\b/g, ' => ')
    .replace(/\\infty\b/g, 'Infinity')
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\(?:mathrm|mathit|mathbf|text|textrm|operatorname)\s*\{([^{}]*)\}/g, '$1')
  // entre paréntesis: «\frac{1}{2}x» es (1/2)x, no 1/(2x)
  s = replaceCmd(s, /\\[dt]?frac/g, 2, ([a, b]) => `((${a})/(${b}))`)
  s = replaceCmd(s, /\\binom/g, 2, ([a, b]) => `combinations(${a}, ${b})`)
  s = replaceCmd(s, /\\sqrt/g, 1, ([a], n) => (n ? `nthRoot(${a}, ${n})` : `sqrt(${a})`))
  s = s
    .replace(/\\(sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|arcsin|arccos|arctan|exp|ln|log)\b/g, (_, f: string) => FN_TEX[f] ?? f)
    .replace(/\^\s*\{([^{}]*)\}/g, (_, e: string) => (/^(\d+|[a-zA-Z])$/.test(e.trim()) ? '^' + e.trim() : `^(${e})`))
    .replace(/_\s*\{([^{}]*)\}/g, (_, e: string) => '_' + e.replace(/\W/g, ''))
    .replace(/\\[a-zA-Z]+/g, (m) => m.slice(1))
    .replace(/[{}]/g, (m) => (m === '{' ? '(' : ')'))
  // paréntesis innecesarios alrededor de un número o símbolo: (x)^2 → x^2, (1)/(4) → 1/4
  for (let k = 0; k < 3; k++) s = s.replace(/(?<![\w)^])\(\s*([\w.]+)\s*\)/g, '$1')
  return tidy(unwrap(tidy(s)))
}

/** Quita los paréntesis que envuelven toda la expresión: ((-15)/4) → (-15)/4. */
function unwrap(s: string): string {
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0, wraps = true
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++
      else if (s[i] === ')' && --depth === 0 && i < s.length - 1) {
        wraps = false
        break
      }
    }
    if (!wraps) break
    s = s.slice(1, -1).trim()
  }
  return s
}

/** Espacios y signos sobrantes. */
function tidy(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*,\s*/g, ', ')
    .trim()
}

const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+', 'ⁿ': 'n', 'ˣ': 'x' }
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }

/** Símbolos Unicode habituales → sintaxis de entrada. */
export function unicodeToPlain(src: string): string {
  return src
    .replace(/[−–—]/g, '-')
    .replace(/[×·⋅∙•]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/∞/g, 'Infinity')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/[    ]/g, ' ')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ⁿˣ]+/g, (m) => {
      const e = [...m].map((c) => SUP[c]).join('')
      return /^\w$/.test(e) ? '^' + e : `^(${e})`
    })
    .replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, (m) => [...m].map((c) => SUB[c]).join(''))
    .replace(/[√∛∜]\s*\(/g, (m) => (m[0] === '√' ? 'sqrt(' : m[0] === '∛' ? 'cbrt(' : 'nthRoot(4, '))
    .replace(/[√∛]\s*([\w.]+)/g, (m, a: string) => (m[0] === '√' ? `sqrt(${a})` : `cbrt(${a})`))
}

/** |a| → abs(a) (sin anidar). */
const absBars = (s: string) => s.replace(/\|([^|]+)\|/g, 'abs($1)')

/** Parte derecha de «lhs = rhs» o «lhs ≈ rhs» (ignora <=, >=, ==, !=). */
export function rightHandSide(s: string): string {
  const parts = s.split(/(?<![<>=!:])(?::=|=|≈)(?!=)/)
  return parts.length > 1 ? parts[parts.length - 1].trim() : s
}

/**
 * Limpia texto pegado (o escrito) para que lo entiendan los campos matemáticos.
 * rhs: quedarse con lo que está a la derecha de «=» (campos de los módulos; el CAS lo usa para asignar).
 */
export function cleanPasted(src: string, { rhs = true }: { rhs?: boolean } = {}): string {
  let s = src
  if (/\\[a-zA-Z]|\^\s*\{|\\frac/.test(s)) s = texToPlain(s)
  s = unicodeToPlain(s)
  if (rhs) {
    s = unwrap(rightHandSide(s).replace(/\s*\+\s*C\s*$/, '').trim())
  }
  if (/\|/.test(s) && !/\|\|/.test(s)) s = absBars(s)
  return s === src ? src : tidy(s)
}

/* ───────────────────────── portapapeles ───────────────────────── */

const isMathField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && (el.matches('[data-palette="expr"], [data-palette="num"], [data-palette="matrix"], [data-paste]') ?? false)

const closestKatex = (n: Node | null): Element | null => {
  const el = n && (n.nodeType === 1 ? (n as Element) : n.parentElement)
  return el?.closest('.katex') ?? null
}

/** Texto plano de una fórmula KaTeX (a partir de su anotación TeX). */
export function katexToPlain(k: Element): string {
  const ann = k.querySelector('annotation[encoding="application/x-tex"]')
  return ann ? texToPlain(ann.textContent ?? '') : (k.querySelector('.katex-html')?.textContent ?? k.textContent ?? '')
}

let installed = false

/** Instala los manejadores globales de copiar y pegar (una sola vez). */
export function installClipboard() {
  if (installed || typeof document === 'undefined') return
  installed = true

  // Copiar: las fórmulas KaTeX se copian en sintaxis de entrada, no como texto duplicado (MathML + HTML).
  document.addEventListener('copy', (e) => {
    if (e.defaultPrevented || !e.clipboardData) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) return
    const range = sel.getRangeAt(0).cloneRange()
    const a = closestKatex(range.startContainer), b = closestKatex(range.endContainer)
    if (a) range.setStartBefore(a)
    if (b) range.setEndAfter(b)
    const frag = range.cloneContents()
    const list = frag.querySelectorAll('.katex')
    if (!list.length) return
    list.forEach((k) => k.replaceWith(document.createTextNode(' ' + katexToPlain(k) + ' ')))
    e.clipboardData.setData('text/plain', frag.textContent?.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim() ?? '')
    e.preventDefault()
  })

  // Pegar en un campo matemático: limpiar TeX, símbolos Unicode y «f(x) =».
  document.addEventListener('paste', (e) => {
    const el = e.target as Element | null
    if (!isMathField(el) || !e.clipboardData) return
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    const cas = el.getAttribute('data-paste') === 'cas'
    const clean = text
      .split('\n')
      .map((l) => cleanPasted(l, { rhs: !cas }))
      .join('\n')
    if (clean === text) return
    e.preventDefault()
    // insertText conserva el deshacer y dispara el onChange de React
    if (!document.execCommand('insertText', false, clean)) {
      const start = el.selectionStart ?? el.value.length, end = el.selectionEnd ?? start
      el.setRangeText(clean, start, end, 'end')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
}
