// Mini-arnés de aserciones numéricas para los scripts de verificación.
// Cada archivo scripts/verificar/*.ts llama a `seccion` y `cerca`; scripts/verificar-metodos.ts los ejecuta todos.

let fallos = 0
let total = 0

export function seccion(nombre: string) {
  console.log(`\n── ${nombre}`)
}

/**
 * Comprueba |obtenido − esperado| ≤ tol. Por defecto tol = media unidad del último decimal mostrado
 * en `esperado` cuando se pasa como string (p. ej. '0.361694' ⇒ tol = 5e-7), como en las tablas del texto.
 */
export function cerca(desc: string, obtenido: number, esperado: number | string, tol?: number) {
  total++
  let e: number
  let t: number
  if (typeof esperado === 'string') {
    e = Number(esperado)
    const dec = (esperado.split('.')[1] ?? '').replace(/[eE].*$/, '').length
    t = tol ?? 0.5 * 10 ** -dec * 1.0000001
  } else {
    e = esperado
    t = tol ?? 1e-12 * Math.max(1, Math.abs(e))
  }
  const ok = Number.isFinite(obtenido) && Math.abs(obtenido - e) <= t
  if (!ok) fallos++
  console.log(`${ok ? '✓' : '✗'} ${desc}: ${obtenido}${ok ? '' : `  (esperado ${esperado} ± ${t.toExponential(1)})`}`)
}

export function verdad(desc: string, cond: boolean, detalle = '') {
  total++
  if (!cond) fallos++
  console.log(`${cond ? '✓' : '✗'} ${desc}${!cond && detalle ? '  ← ' + detalle : ''}`)
}

export function resumen(): number {
  console.log(fallos ? `\n✗ ${fallos} de ${total} comprobaciones fallaron` : `\n✓ ${total} comprobaciones correctas`)
  return fallos
}
