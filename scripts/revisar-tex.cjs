// Busca barras invertidas mal escapadas en textos TeX dentro de strings/plantillas de JS/TS.
// En JS, '\;' es ';' (la barra desaparece) y '\frac' contiene un salto de página (\f).
// Uso: node scripts/revisar-tex.cjs [--fix]   (--fix corrige los escapes desconocidos: \; \, \% \{ \leq …)
const ts = require('typescript')
const fs = require('node:fs')
const path = require('node:path')

const FIX = process.argv.includes('--fix')
const files = []
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f.name)) files.push(p) } }
walk(path.join(__dirname, '..', 'src'))

// escapes válidos de JS que NO queremos tocar automáticamente
const VALID = new Set(['n', 'r', 't', 'b', 'f', 'v', '0', "'", '"', '\\', '`', '$', 'u', 'x', '\n', '\r'])
let unknown = 0, suspicious = 0
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const edits = []
  const visit = (node) => {
    const k = node.kind
    const isStr = k === ts.SyntaxKind.StringLiteral || k === ts.SyntaxKind.NoSubstitutionTemplateLiteral || k === ts.SyntaxKind.TemplateHead || k === ts.SyntaxKind.TemplateMiddle || k === ts.SyntaxKind.TemplateTail
    if (isStr) {
      // ¿plantilla etiquetada con String.raw?
      let p = node.parent
      while (p && (p.kind === ts.SyntaxKind.TemplateExpression || p.kind === ts.SyntaxKind.TemplateSpan)) p = p.parent
      const raw = p && p.kind === ts.SyntaxKind.TaggedTemplateExpression && p.tag.getText(sf) === 'String.raw'
      // JSX: atributo con string literal → el contenido es literal (no hay escapes)
      const jsxAttr = node.parent && node.parent.kind === ts.SyntaxKind.JsxAttribute
      if (!raw && !jsxAttr) {
        const start = node.getStart(sf), text = node.getText(sf)
        const re = /\\(\\|.)/gs
        let m
        while ((m = re.exec(text))) {
          const c = m[1]
          if (c === '\\') continue
          const at = start + m.index
          const line = sf.getLineAndCharacterOfPosition(at).line + 1
          if (!VALID.has(c)) {
            unknown++
            console.log(`${path.relative(process.cwd(), file)}:${line}  \\${c}  (escape desconocido: la barra se pierde)`)
            edits.push(at)
          } else if ('ftbrv'.includes(c) && /[a-z]/.test(text[m.index + 2] ?? '') && /\\\\[a-zA-Z]/.test(text)) {
            // p. ej. "\frac" o "\theta" en un string que además tiene comandos TeX con doble barra
            suspicious++
            console.log(`${path.relative(process.cwd(), file)}:${line}  \\${c}${text.slice(m.index + 2, m.index + 8)}…  (¿comando TeX convertido en carácter de control?)`)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  if (FIX && edits.length) {
    let out = src
    for (const at of edits.sort((a, b) => b - a)) out = out.slice(0, at) + '\\' + out.slice(at)
    fs.writeFileSync(file, out)
  }
}
console.log(`\n${unknown} escapes desconocidos${FIX ? ' (corregidos)' : ''} · ${suspicious} sospechosos para revisar a mano`)
process.exitCode = unknown && !FIX ? 1 : 0
