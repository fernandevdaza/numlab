// Verificación numérica de los métodos contra resultados conocidos
// (ejemplos del texto de la materia, tablas de Burden & Faires y formas cerradas).
//   node --experimental-strip-types --no-warnings scripts/verificar-metodos.ts [filtro]
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resumen } from './verificar/check.ts'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'verificar')
const filtro = process.argv[2] ?? ''
const archivos = readdirSync(dir)
  .filter((f) => f.endsWith('.ts') && f !== 'check.ts' && f.includes(filtro))
  .sort()
for (const f of archivos) await import(pathToFileURL(join(dir, f)).href)
process.exitCode = resumen() ? 1 : 0
