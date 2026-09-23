import { useMemo } from 'react'
import { fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { useTheme } from '../../components/theme'
import { Tex } from '../../components/Tex'
import { Plot, SERIES } from '../../components/Plot'
import { Alert, Card, DataTable, Examples, IntField, MethodPage, ScilabCode, SelectField, Stats, Steps, Tabs, VectorField, parseVector } from '../../components/ui'
import * as A from './algorithms'
import { N, Note, P, sciVec, texM, TOPIC, vecText, sciFl } from './shared'
import { CostPlot } from './SystemPlot'
import { THEORY, TITLES } from './theory'
import { L } from '../../i18n'

interface S {
  a: string
  b: string
  c: string
  d: string
  /** 'libro': fórmulas 3.8–3.9 del texto; 'normalizada': c′, d′ (Burden) */
  variant: 'libro' | 'normalizada'
  /** cifras de la mantisa (0 = doble precisión) */
  t: number
}

const S5 = { a: '-0.46521 3.5023 0.38471', b: '1.3456 3.0576 1.4936 4.46723', c: '0.35679 -1.3925 -0.94618', d: '0 -2.5284 0.38519 -1.3762' }

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: L('Práct. 04.2 (S₅, 4 cifras)', 'Practice 04.2 (S₅, 4 digits)'), value: { ...S5, t: 4 } },
  { label: L('Práct. 04.2 (S₅, doble precisión)', 'Practice 04.2 (S₅, double precision)'), value: { ...S5, t: 0 } },
  { label: 'Burden (x = 1,1,1,1)', value: { a: '-1 -1 -1', b: '2 2 2 2', c: '-1 -1 -1', d: '1 0 0 1', t: 0 } },
  { label: L('Calor 1D: u(0)=0, u(1)=100', '1D heat: u(0)=0, u(1)=100'), value: { a: '-1 -1 -1 -1 -1 -1 -1 -1', b: '2 2 2 2 2 2 2 2 2', c: '-1 -1 -1 -1 -1 -1 -1 -1', d: '0 0 0 0 0 0 0 0 100', t: 0 } },
  { label: L('u″ = −1 (flecha de viga)', 'u″ = −1 (beam deflection)'), value: { a: '1 1 1 1 1 1', b: '-2 -2 -2 -2 -2 -2 -2', c: '1 1 1 1 1 1', d: '-0.015625 -0.015625 -0.015625 -0.015625 -0.015625 -0.015625 -0.015625', t: 0 } },
  { label: L('Spline natural (1 4 1)', 'Natural spline (1 4 1)'), value: { a: '1 1 1', b: '4 4 4 4', c: '1 1 1', d: '6 12 18 24', t: 0 } },
  { label: L('No dominante', 'Not dominant'), value: { a: '3 1', b: '1 2 1', c: '2 4', d: '3 9 2', t: 0 } },
]

export function Thomas() {
  const [s, setS] = useLocalState<S>('sistemas:thomas:v2', { ...S5, variant: 'libro', t: 4 })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)
  useTheme()

  const calc = useMemo(() => {
    const b = parseVector(d.b)
    if (!b) return { error: L('Diagonal principal b inválida.', 'Invalid main diagonal b.') }
    const n = b.length
    if (n < 2) return { error: L('Se necesitan al menos 2 ecuaciones.', 'At least 2 equations are needed.') }
    const a = parseVector(d.a)
    const c = parseVector(d.c)
    const dd = parseVector(d.d)
    if (!a || a.length !== n - 1) return { error: L(`La subdiagonal a debe tener n − 1 = ${n - 1} valores (tiene ${a ? a.length : 0}).`, `The subdiagonal a must have n − 1 = ${n - 1} values (it has ${a ? a.length : 0}).`) }
    if (!c || c.length !== n - 1) return { error: L(`La superdiagonal c debe tener n − 1 = ${n - 1} valores (tiene ${c ? c.length : 0}).`, `The superdiagonal c must have n − 1 = ${n - 1} values (it has ${c ? c.length : 0}).`) }
    if (!dd || dd.length !== n) return { error: L(`El lado derecho d debe tener n = ${n} valores (tiene ${dd ? dd.length : 0}).`, `The right-hand side d must have n = ${n} values (it has ${dd ? dd.length : 0}).`) }
    const res = A.thomas(a, b, c, dd, d.t)
    const exact = d.t ? A.thomas(a, b, c, dd) : null
    const M = A.tridiagToMatrix(a, b, c)
    const dom = A.diagDominance(M)
    const residual = res.ok ? A.vsub(dd, A.matVec(M, res.x)) : []
    return { a, b, c, d: dd, n, res, exact, M, dom, residual }
  }, [d])

  const inputs = (
    <>
      <VectorField label={L(<>Subdiagonal <Tex>{'a_2,\\dots,a_n'}</Tex> (n − 1 valores)</>, <>Subdiagonal <Tex>{'a_2,\\dots,a_n'}</Tex> (n − 1 values)</>)} value={s.a} onChange={(a) => set({ a })} />
      <VectorField label={L(<>Diagonal principal <Tex>{'b_1,\\dots,b_n'}</Tex></>, <>Main diagonal <Tex>{'b_1,\\dots,b_n'}</Tex></>)} value={s.b} onChange={(b) => set({ b })} />
      <VectorField label={L(<>Superdiagonal <Tex>{'c_1,\\dots,c_{n-1}'}</Tex> (n − 1 valores)</>, <>Superdiagonal <Tex>{'c_1,\\dots,c_{n-1}'}</Tex> (n − 1 values)</>)} value={s.c} onChange={(c) => set({ c })} />
      <VectorField label={L(<>Lado derecho <Tex>{'d_1,\\dots,d_n'}</Tex></>, <>Right-hand side <Tex>{'d_1,\\dots,d_n'}</Tex></>)} value={s.d} onChange={(dd) => set({ d: dd })} />
      <SelectField
        label={L('Presentación', 'Presentation')}
        value={s.variant}
        onChange={(variant) => set({ variant })}
        options={[
          { value: 'libro', label: L('Como en el texto: bₖ⁽ᵏ⁻¹⁾, dₖ⁽ᵏ⁻¹⁾ y sustitución regresiva', 'As in the textbook: bₖ⁽ᵏ⁻¹⁾, dₖ⁽ᵏ⁻¹⁾ and back substitution') },
          { value: 'normalizada', label: L('Normalizada (Burden): c′ᵢ, d′ᵢ', 'Normalized (Burden): c′ᵢ, d′ᵢ') },
        ]}
      />
      <IntField label={L('Cifras de la mantisa (0 = doble precisión)', 'Mantissa digits (0 = double precision)')} value={s.t} onChange={(t) => set({ t })} min={0} max={12} hint={L('Simula la calculadora de t cifras de la práctica del texto.', 'Simulates the t-digit calculator of the textbook practice.')} />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.thomas} topic={TOPIC} theory={THEORY.thomas} inputs={inputs}>
      {'error' in calc ? (
        <Alert kind="error">{calc.error}</Alert>
      ) : (
        <>
          <Card title={L('Sistema tridiagonal', 'Tridiagonal system')}>
            <Tex block>{texM(calc.M, 5) + '\\,x = ' + texM(calc.d, 5)}</Tex>
          </Card>
          <Stats
            items={[
              { label: L('Solución x', 'Solution x'), value: calc.res.ok ? vecText(calc.res.x, d.t || undefined) : '—', accent: true, hint: d.t ? L(`aritmética de ${d.t} cifras`, `${d.t}-digit arithmetic`) : undefined },
              { label: 'n', value: calc.n },
              { label: L('Operaciones', 'Operations'), value: 8 * calc.n - 7, hint: L(`8n − 7 (tabla de la Práctica 04.1) · proporcional a n  vs  Gauss ≈ ${Math.round(A.gaussOps(calc.n).total)}`, `8n − 7 (table of Practice 04.1) · proportional to n  vs  Gauss ≈ ${Math.round(A.gaussOps(calc.n).total)}`) },
              calc.exact?.ok
                ? { label: L('x en doble precisión', 'x in double precision'), value: vecText(calc.exact.x), hint: L('para comparar con la aritmética de t cifras', 'to compare with t-digit arithmetic') }
                : { label: L('Residuo ‖d − Ax‖∞', 'Residual ‖d − Ax‖∞'), value: calc.res.ok ? fmtErr(A.normInf(calc.residual)) : '—' },
            ]}
          />
          {!calc.res.ok ? (
            <Alert kind="error">{calc.res.error}</Alert>
          ) : calc.dom.strict || calc.dom.weak ? (
            <Alert kind="ok">{L('La matriz es diagonalmente dominante (|bᵢ| ≥ |aᵢ| + |cᵢ|): Thomas es estable sin pivoteo.', 'The matrix is diagonally dominant (|bᵢ| ≥ |aᵢ| + |cᵢ|): the Thomas algorithm is stable without pivoting.')}</Alert>
          ) : (
            <Alert kind="warn">
              {L(
                <>
                  La matriz no es diagonalmente dominante (filas {calc.dom.rows.filter((r) => !r.weak).map((r) => r.i + 1).join(', ')}): Thomas no hace pivoteo y puede ser inestable o
                  encontrar un pivote nulo. Revisa el residuo.
                </>,
                <>
                  The matrix is not diagonally dominant (rows {calc.dom.rows.filter((r) => !r.weak).map((r) => r.i + 1).join(', ')}): the Thomas algorithm does not pivot and may be unstable
                  or run into a zero pivot. Check the residual.
                </>,
              )}
            </Alert>
          )}
          <Tabs
            tabs={[
              { label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={thomasSteps(calc.res, d.variant, d.t)} /></Card> },
              {
                label: L('Tabla', 'Table'),
                content: (
                  <Card>
                    <DataTable
                      filename="thomas"
                      columns={[
                        { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
                        { key: 'a', tex: 'a_i' },
                        { key: 'b', tex: 'b_i' },
                        { key: 'c', tex: 'c_i' },
                        { key: 'd', tex: 'd_i' },
                        ...(d.variant === 'libro'
                          ? [
                              { key: 'm', tex: 'a_i / b_{i-1}^{(i-2)}' },
                              { key: 'bk', tex: 'b_i^{(i-1)}' },
                              { key: 'dk', tex: 'd_i^{(i-1)}' },
                            ]
                          : [
                              { key: 'den', tex: "b_i - a_i c'_{i-1}" },
                              { key: 'cp', tex: "c'_i" },
                              { key: 'dp', tex: "d'_i" },
                            ]),
                        { key: 'x', tex: 'x_i' },
                      ]}
                      rows={calc.res.rows.map((r) => ({ ...r, i: r.i + 1, a: Number.isNaN(r.a) ? '—' : r.a, c: Number.isNaN(r.c) ? '—' : r.c, m: Number.isNaN(r.m) ? '—' : r.m, cp: Number.isNaN(r.cp) ? '—' : r.cp }))}
                    />
                  </Card>
                ),
              },
              {
                label: L('Gráfica', 'Plot'),
                content: (
                  <Card>
                    <Plot
                      data={[{ x: calc.res.x.map((_, i) => i + 1), y: calc.res.x, type: 'scatter', mode: 'lines+markers', name: 'xᵢ', line: { color: SERIES[0], width: 2.5 }, marker: { size: 7 } }]}
                      layout={{ xaxis: { title: { text: 'i' }, dtick: 1 }, yaxis: { title: { text: 'xᵢ' } } }}
                    />
                    <Note>{L('Perfil de la solución. En problemas de diferencias finitas (calor, viga) xᵢ ≈ u(tᵢ) en los nodos interiores.', 'Solution profile. In finite-difference problems (heat, beam) xᵢ ≈ u(tᵢ) at the interior nodes.')}</Note>
                  </Card>
                ),
              },
              { label: L('Costo O(n)', 'Cost O(n)'), content: <Card><CostPlot n={calc.n} extra={[{ name: 'Thomas: 8n − 7', f: (m) => 8 * m - 7 }]} /></Card> },
            ]}
          />
          <ScilabCode code={scilabThomas(calc.a, calc.b, calc.c, calc.d, d.t)} filename="thomas" />
        </>
      )}
    </MethodPage>
  )
}

function thomasSteps(res: A.ThomasResult, variant: S['variant'], t: number): { text?: string; tex?: string }[] {
  const out: { text?: string; tex?: string }[] = []
  const rows = res.rows
  const n = rows.length
  const dg = t ? t + 2 : undefined
  const Nd = (x: number) => N(x, dg)
  const Pd = (x: number) => P(x, dg)
  if (t) out.push({ text: L(`Aritmética de ${t} cifras: cada dato y cada resultado intermedio se redondea a ${t} cifras significativas.`, `${t}-digit arithmetic: every datum and every intermediate result is rounded to ${t} significant digits.`) })
  const lines: string[] = []
  if (variant === 'libro') {
    out.push({ text: L('Triangularización: en cada columna se anula el único elemento bajo la diagonal; los cᵢ no cambian (fórmula 3.8):', 'Triangular reduction: in each column the only entry below the diagonal is eliminated; the cᵢ do not change (formula 3.8):') })
    rows.forEach((r) => {
      const i = r.i + 1
      if (r.i === 0) {
        lines.push(`b_1^{(0)} &= ${Nd(r.bk)}, & d_1^{(0)} &= ${Nd(r.dk)}`)
      } else {
        const prev = rows[r.i - 1]
        const fac = `\\tfrac{${Nd(r.a)}}{${Nd(prev.bk)}}`
        lines.push(`b_{${i}}^{(${i - 1})} &= ${Nd(r.b)} - ${fac}\\cdot ${Pd(prev.c)} = ${Nd(r.bk)}, & d_{${i}}^{(${i - 1})} &= ${Nd(r.d)} - ${fac}\\cdot ${Pd(prev.dk)} = ${Nd(r.dk)}`)
      }
    })
  } else {
    out.push({ text: L('Barrido hacia adelante (variante normalizada):', 'Forward sweep (normalized variant):') })
    rows.forEach((r) => {
      const i = r.i + 1
      if (r.i === 0) {
        lines.push(`c'_1 &= \\frac{c_1}{b_1} = \\frac{${Nd(r.c)}}{${Nd(r.b)}} = ${Nd(r.cp)}, & d'_1 &= \\frac{d_1}{b_1} = \\frac{${Nd(r.d)}}{${Nd(r.b)}} = ${Nd(r.dp)}`)
      } else {
        const prev = rows[r.i - 1]
        const den = `${Nd(r.b)} - ${Pd(r.a)}\\cdot ${Pd(prev.cp)}`
        const cpart = r.i < n - 1 ? `c'_{${i}} &= \\frac{${Nd(r.c)}}{${den}} = ${Nd(r.cp)}, & ` : '& & '
        lines.push(`${cpart}d'_{${i}} &= \\frac{${Nd(r.d)} - ${Pd(r.a)}\\cdot ${Pd(prev.dp)}}{${den}} = ${Nd(r.dp)}`)
      }
    })
  }
  out.push({ tex: '\\begin{aligned}' + lines.slice(0, 12).join(' \\\\ ') + '\\end{aligned}' })
  if (lines.length > 12) out.push({ text: L(`… (${lines.length - 12} filas más en la tabla)`, `… (${lines.length - 12} more rows in the table)`) })
  if (!res.ok) {
    out.push({ text: '✕ ' + res.error })
    return out
  }
  out.push({ text: variant === 'libro' ? L('Sustitución regresiva (fórmula 3.9):', 'Back substitution (formula 3.9):') : L('Sustitución regresiva:', 'Back substitution:') })
  const back: string[] = []
  if (variant === 'libro') {
    back.push(`x_{${n}} &= \\frac{d_{${n}}^{(${n - 1})}}{b_{${n}}^{(${n - 1})}} = \\frac{${Nd(rows[n - 1].dk)}}{${Nd(rows[n - 1].bk)}} = ${Nd(rows[n - 1].x)}`)
    for (let k = n - 2; k >= 0; k--)
      back.push(`x_{${k + 1}} &= \\frac{d_{${k + 1}}^{(${k})} - c_{${k + 1}}x_{${k + 2}}}{b_{${k + 1}}^{(${k})}} = \\frac{${Nd(rows[k].dk)} - ${Pd(rows[k].c)}\\cdot ${Pd(rows[k + 1].x)}}{${Nd(rows[k].bk)}} = ${Nd(rows[k].x)}`)
  } else {
    back.push(`x_{${n}} &= d'_{${n}} = ${Nd(rows[n - 1].x)}`)
    for (let k = n - 2; k >= 0; k--) back.push(`x_{${k + 1}} &= d'_{${k + 1}} - c'_{${k + 1}}x_{${k + 2}} = ${Nd(rows[k].dp)} - ${Pd(rows[k].cp)}\\cdot ${Pd(rows[k + 1].x)} = ${Nd(rows[k].x)}`)
  }
  out.push({ tex: '\\begin{aligned}' + back.slice(0, 12).join(' \\\\ ') + '\\end{aligned}' })
  if (back.length > 12) out.push({ text: L('… (ver tabla)', '… (see table)') })
  return out
}

function scilabThomas(a: A.Vec, b: A.Vec, c: A.Vec, d: A.Vec, t: number): string {
  const F = (e: string) => (t ? `fl(${e})` : e)
  const flDef = t ? sciFl(t) : ''
  return `// ${L(`Método de Thomas (sistema tridiagonal, fórmulas 3.8-3.9 del texto)${t ? ` — aritmética de ${t} cifras` : ''} — generado por NumLab`, `Thomas algorithm (tridiagonal system, textbook formulas 3.8-3.9)${t ? ` — ${t}-digit arithmetic` : ''} — generated by NumLab`)}
clear; clc;
${flDef}a = ${F(sciVec([0, ...a]))};   // ${L('subdiagonal (a(1) no se usa)', 'subdiagonal (a(1) is not used)')}
b = ${F(sciVec(b))};   // diagonal
c = ${F(sciVec([...c, 0]))};   // ${L('superdiagonal (c(n) no se usa)', 'superdiagonal (c(n) is not used)')}
d = ${F(sciVec(d))};   // ${L('lado derecho', 'right-hand side')}
n = length(b);
// ${L('Triangularización: se anula a(k+1); los c(k) no cambian', 'Triangular reduction: a(k+1) is eliminated; the c(k) do not change')}
for k = 1:n-1
  if b(k) == 0 then error('${L('Pivote nulo en la fila ', 'Zero pivot in row ')}' + string(k)); end
  m = ${F('a(k+1) / b(k)')};
  b(k+1) = ${F(`b(k+1) - ${F('m * c(k)')}`)};
  d(k+1) = ${F(`d(k+1) - ${F('m * d(k)')}`)};
end
// ${L('Sustitución regresiva', 'Back substitution')}
x = zeros(n, 1);
x(n) = ${F('d(n) / b(n)')};
for k = n-1:-1:1
  x(k) = ${F(`${F(`d(k) - ${F('c(k) * x(k+1)')}`)} / b(k)`)};
end
mprintf('%4s %14s %14s %14s\\n', 'k', 'b(k)', 'd(k)', 'x(k)');
for k = 1:n
  mprintf('%4d %14.8f %14.8f %14.8f\\n', k, b(k), d(k), x(k));
end
// ${L('Verificación con la matriz completa (datos originales)', 'Check with the full matrix (original data)')}
A = diag(${sciVec(b)}) + diag(${sciVec(a)}, -1) + diag(${sciVec(c)}, 1);
disp('A\\d ='); disp(A \\ ${sciVec(d)});
plot(1:n, x', '-o'); xtitle('${L('Solución del sistema tridiagonal', 'Solution of the tridiagonal system')}', 'k', 'x_k');
`
}
