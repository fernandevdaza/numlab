// Espacio de trabajo: motor de la hoja de cálculo y funciones extra (regresión, polyfit, seq).
import { emptySheet, evaluateSheet, pasteBlock, translateFormula } from '../../src/modules/espacio/hoja.ts'
import { adjustForInsert, caretContext, cycleReference, shiftFormula } from '../../src/modules/espacio/hoja/tokens.ts'
import { fillRange, insertLines, makeClip, pasteClip, setCells } from '../../src/modules/espacio/hoja/ops.ts'
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
  verdad(`traducción: =SUMA(A1:B2)*C3 → ${translateFormula('=SUMA(A1:B2)*C3')}`, translateFormula('=SUMA(A1:B2)*C3') === 'XL_SUM(__r("A1","B2"))*__c("C3")')
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
    C7: '=SI(A2 > 0; k; 0)',
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
  verdad(`C3 ↔ C4: ciclo detectado → ${r.get('C3').error}`, r.get('C3').error === '#CIRC!')
  verdad(`C5 = linreg(t, v)[1] = 2 → ${v('C5')}`, Math.abs((v('C5') as number) - 2) < 1e-12)
  verdad(`C6 = Σ k² (k = 1…4) = 30 → ${v('C6')}`, v('C6') === 30)
  verdad(`C7 usa la variable del documento k = 10 → ${v('C7')}`, v('C7') === 10)
  verdad(`C8 = CONTAR(A1:B4) = 8 → ${v('C8')}`, v('C8') === 8)
  verdad(`texto y coma decimal: «texto», 3,5 → ${v('D1')}, ${v('D2')}`, v('D1') === 'texto' && v('D2') === 3.5)
  verdad(`fórmula de columna w = t² + 1 → [${r.lists.w}]`, r.lists.w.join() === '1,2,5,10')
  verdad(`listas compartidas t y v → [${r.lists.t}] [${r.lists.v}]`, r.lists.t.join() === '0,1,2,3' && r.lists.v.join() === '1,3,5,7')
  const p = pasteBlock(emptySheet(2, 2), { c: 1, r: 1 }, 'x\ty\n1\t2\n3\t4\n')
  verdad(`pegar TSV desde B2: B2=x, C4=4, tamaño 3×5 → ${p.cells.B2}, ${p.cells.C4}, ${p.cols}×${p.rows}`, p.cells.B2 === 'x' && p.cells.C4 === '4' && p.cols === 3 && p.rows === 5)
}

seccion('Hoja: fórmulas al estilo Excel (español e inglés)')
{
  const s = emptySheet()
  Object.assign(s.cells, {
    A1: 'manzana', B1: '3', A2: 'pera', B2: '5', A3: 'uva', B3: '0',
    C1: '=BUSCARV("pera"; A1:B3; 2; FALSO)', C2: '=SI(B3=0; "cero"; 1/B3)', C3: '=1/B3', C4: '=SI.ERROR(1/B3; -1)',
    C5: '=A1 & " y " & A2', C6: '=SUMA(B1:B3) * 10%', C7: '=CONTAR.SI(B1:B3; ">2")', C8: '=noexiste(1)',
    C9: '=SUMAR.SI(A1:A3; "p*"; B1:B3)', C10: '=COINCIDIR(5; B1:B3; 0)', C11: '=INDICE(A1:B3; 3; 1)', C12: '=PROMEDIO(B:B)',
    C13: '=2,5 * 2', C14: '=ROUND(PI(), 2)', C15: '=AND(B1>1, B2>1)', C16: '=VNA(0,1; 100; 100)', C17: '=B1<>B2', C18: '=C99',
  })
  const r = evaluateSheet(s)
  const v = (k: string) => r.get(k).value, e = (k: string) => r.get(k).error
  verdad(`BUSCARV exacta → ${v('C1')}`, v('C1') === 5)
  verdad(`SI con texto → ${v('C2')}`, v('C2') === 'cero')
  verdad(`1/0 → ${e('C3')}`, e('C3') === '#DIV/0!')
  verdad(`SI.ERROR atrapa la división entre cero → ${v('C4')}`, v('C4') === -1)
  verdad(`& concatena → ${v('C5')}`, v('C5') === 'manzana y pera')
  verdad(`porcentaje 10% → ${v('C6')}`, Math.abs((v('C6') as number) - 0.8) < 1e-12)
  verdad(`CONTAR.SI(">2") → ${v('C7')}`, v('C7') === 2)
  verdad(`función desconocida → ${e('C8')}`, e('C8') === '#NAME?')
  verdad(`SUMAR.SI con comodín → ${v('C9')}`, v('C9') === 5)
  verdad(`COINCIDIR exacta → ${v('C10')}`, v('C10') === 2)
  verdad(`INDICE devuelve texto → ${v('C11')}`, v('C11') === 'uva')
  verdad(`columna completa B:B → ${v('C12')}`, Math.abs((v('C12') as number) - 8 / 3) < 1e-12)
  verdad(`coma decimal fuera de paréntesis: 2,5 × 2 → ${v('C13')}`, v('C13') === 5)
  verdad(`nombres en inglés: ROUND(PI(), 2) → ${v('C14')}`, v('C14') === 3.14)
  verdad(`AND → ${v('C15')}`, v('C15') === true)
  verdad(`VNA con «;» y coma decimal → ${v('C16')}`, Math.abs((v('C16') as number) - 173.55371900826447) < 1e-9)
  verdad(`<> → ${v('C17')}`, v('C17') === true)
  verdad(`celda vacía vale 0 → ${v('C18')}`, v('C18') === 0)
}

seccion('Hoja: mover referencias, relleno, pegar e insertar filas')
{
  verdad(`copiar =A1+$B$1+C$2 una fila abajo y una columna a la derecha → ${shiftFormula('=A1+$B$1+C$2', 1, 1)}`, shiftFormula('=A1+$B$1+C$2', 1, 1) === '=B2+$B$1+D$2')
  verdad(`fuera de la hoja → ${shiftFormula('=A1', -1, 0)}`, shiftFormula('=A1', -1, 0) === '=#REF!')
  verdad(`F4: A1 → $A$1`, cycleReference('=A1+1', 3)?.text === '=$A$1+1')
  verdad(`insertar 2 filas en la fila 3: =SUM(A1:A5)+A7 → ${adjustForInsert('=SUM(A1:A5)+A7', 'row', 2, 2)}`, adjustForInsert('=SUM(A1:A5)+A7', 'row', 2, 2) === '=SUM(A1:A7)+A9')
  verdad(`eliminar la fila 3: =A3+SUM(A1:A5) → ${adjustForInsert('=A3+SUM(A1:A5)', 'row', 2, -1)}`, adjustForInsert('=A3+SUM(A1:A5)', 'row', 2, -1) === '=#REF!+SUM(A1:A4)')
  const ctx = caretContext('=SUMA(A1; ', 10)
  verdad(`contexto: dentro de SUMA, argumento 2, se puede apuntar → ${ctx.fn?.name} ${ctx.fn?.argIndex} ${ctx.canInsertRef}`, ctx.fn?.name === 'SUMA' && ctx.fn.argIndex === 1 && ctx.canInsertRef)
  let s = emptySheet()
  s = setCells(s, [['A1', '1'], ['A2', '3'], ['B1', '=A1*2'], ['C1', 'Año 1']])
  const f = fillRange(s, { r0: 0, r1: 1, c0: 0, c1: 0 }, 'down', 3)
  verdad(`serie 1, 3 → 5, 7, 9 → ${['A3', 'A4', 'A5'].map((k) => f.cells[k])}`, ['A3', 'A4', 'A5'].map((k) => f.cells[k]).join() === '5,7,9')
  const g = fillRange(s, { r0: 0, r1: 0, c0: 1, c1: 2 }, 'down', 2)
  verdad(`fórmula relativa y «Año 1» al rellenar → ${g.cells.B3}, ${g.cells.C3}`, g.cells.B3 === '=A3*2' && g.cells.C3 === 'Año 3')
  const clip = makeClip(s, undefined, { r0: 0, r1: 0, c0: 1, c1: 1 }, false, () => '')
  const p = pasteClip(s, clip, { r0: 4, r1: 4, c0: 3, c1: 3 })
  verdad(`pegar =A1*2 en D5 → ${p.sheet.cells.D5}`, p.sheet.cells.D5 === '=C5*2')
  const cut = pasteClip(s, makeClip(s, undefined, { r0: 0, r1: 1, c0: 0, c1: 0 }, true, () => ''), { r0: 5, r1: 5, c0: 0, c1: 0 })
  verdad(`cortar A1:A2 → A6: la fórmula que apuntaba a A1 lo sigue → ${cut.sheet.cells.B1}`, cut.sheet.cells.B1 === '=A6*2' && cut.sheet.cells.A6 === '1' && !cut.sheet.cells.A1)
  const ins = insertLines(s, 'row', 0, 1)
  verdad(`insertar una fila arriba: B2 = =A2*2 → ${ins.cells.B2}`, ins.cells.B2 === '=A2*2' && ins.cells.A2 === '1')
  const del = insertLines(s, 'col', 0, -1)
  verdad(`eliminar la columna A: =A1*2 → ${del.cells.A1}`, del.cells.A1 === '=#REF!*2')
}
