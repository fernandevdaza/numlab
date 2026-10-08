// Espacio de trabajo: motor de la hoja de cálculo y funciones extra (regresión, polyfit, seq).
import { emptySheet, evaluateSheet, pasteBlock, translateFormula } from '../../src/modules/espacio/hoja.ts'
import { linreg, polyfit } from '../../src/lib/extras.ts'
import { cerca, seccion, verdad } from './check.ts'

seccion('Regresión por mínimos cuadrados')
{
  // y = 2x + 1 exacta
  const [m, b, r2] = linreg([0, 1, 2, 3], [1, 3, 5, 7])
  cerca('linreg: pendiente 2', m, 2, 1e-12)
  cerca('linreg: ordenada 1', b, 1, 1e-12)
  cerca('linreg: r² = 1', r2, 1, 1e-12)
  // Burden & Faires, ej. 8.1 (y ≈ 1.538x − 0.360)
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], y = [1.3, 3.5, 4.2, 5.0, 7.0, 8.8, 10.1, 12.5, 13.0, 15.6]
  const [m2, b2] = linreg(x, y)
  cerca('Burden 8.1: pendiente 1.538', m2, 1.538, 5e-4)
  cerca('Burden 8.1: ordenada −0.360', b2, -0.36, 5e-4)
  // polinomio de grado 2 exacto: y = 1 − 2x + 3x²
  const c = polyfit([-1, 0, 1, 2, 3], [-1, 0, 1, 2, 3].map((t) => 1 - 2 * t + 3 * t * t), 2)
  verdad(`polyfit grado 2: [1, −2, 3] → [${c.map((v) => v.toFixed(10)).join(', ')}]`, Math.abs(c[0] - 1) < 1e-9 && Math.abs(c[1] + 2) < 1e-9 && Math.abs(c[2] - 3) < 1e-9)
}

seccion('Hoja de cálculo: fórmulas, rangos, ciclos y columnas con nombre')
{
  verdad('traducción: =SUMA(A1:B2)*C3 → sum(__r(…))*__c(…)', translateFormula('=SUMA(A1:B2)*C3') === 'sum(__r("A1","B2"))*__c("C3")')
  verdad('traducción: referencias absolutas $A$1', translateFormula('=$A$1+B$2') === '__c("A1")+__c("B2")')
  const s = emptySheet()
  s.names = { A: 't', B: 'v' }
  ;[0, 1, 2, 3].forEach((t, i) => {
    s.cells['A' + (i + 1)] = String(t)
    s.cells['B' + (i + 1)] = String(2 * t + 1)
  })
  Object.assign(s.cells, {
    C1: '=A2^2 + B4',
    C2: '=PROMEDIO(B1:B4)',
    C3: '=C4 + 1',
    C4: '=C3',
    C5: '=linreg(t, v)[1]',
    C6: '=sum(seq(k^2, k, 1, 4))',
    C7: '=SI(A2 > 0, k, 0)',
    C8: '=CONTAR(A1:B4)',
    D1: 'texto',
    D2: '3,5',
  })
  s.colFormulas = { E: '=t^2 + 1' }
  s.names.E = 'w'
  const r = evaluateSheet(s, { k: 10 })
  const v = (ref: string) => r.get(ref).value
  verdad(`C1 = A2² + B4 = 8 → ${v('C1')}`, v('C1') === 8)
  verdad(`C2 = PROMEDIO(B1:B4) = 4 → ${v('C2')}`, v('C2') === 4)
  verdad(`C3 ↔ C4: ciclo detectado → ${r.get('C3').error}`, r.get('C3').error === '#CICLO')
  verdad(`C5 = linreg(t, v)[1] = 2 → ${v('C5')}`, Math.abs((v('C5') as number) - 2) < 1e-12)
  verdad(`C6 = Σ k² (k = 1…4) = 30 → ${v('C6')}`, v('C6') === 30)
  verdad(`C7 usa la variable del documento k = 10 → ${v('C7')}`, v('C7') === 10)
  verdad(`C8 = CONTAR(A1:B4) = 8 → ${v('C8')}`, v('C8') === 8)
  verdad(`texto y coma decimal: «texto», 3,5 → ${v('D1')}, ${v('D2')}`, v('D1') === 'texto' && v('D2') === 3.5)
  verdad(`fórmula de columna w = t² + 1 → [${r.lists.w}]`, r.lists.w.join() === '1,2,5,10')
  verdad(`listas compartidas t y v → [${r.lists.t}] [${r.lists.v}]`, r.lists.t.join() === '0,1,2,3' && r.lists.v.join() === '1,3,5,7')
  const p = pasteBlock(emptySheet(2, 2), { c: 1, r: 1 }, 'x\ty\n1\t2\n3\t4\n')
  verdad(`pegar TSV desde B2: B2=x, C4=4, tamaño 3×4 → ${p.cells.B2}, ${p.cells.C4}, ${p.cols}×${p.rows}`, p.cells.B2 === 'x' && p.cells.C4 === '4' && p.cols === 3 && p.rows === 4)
}
