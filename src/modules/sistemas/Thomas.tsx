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
  { label: 'Práct. 04.2 (S₅, 4 cifras)', value: { ...S5, t: 4 } },
  { label: 'Práct. 04.2 (S₅, doble precisión)', value: { ...S5, t: 0 } },
  { label: 'Burden (x = 1,1,1,1)', value: { a: '-1 -1 -1', b: '2 2 2 2', c: '-1 -1 -1', d: '1 0 0 1', t: 0 } },
  { label: 'Calor 1D: u(0)=0, u(1)=100', value: { a: '-1 -1 -1 -1 -1 -1 -1 -1', b: '2 2 2 2 2 2 2 2 2', c: '-1 -1 -1 -1 -1 -1 -1 -1', d: '0 0 0 0 0 0 0 0 100', t: 0 } },
  { label: 'u″ = −1 (flecha de viga)', value: { a: '1 1 1 1 1 1', b: '-2 -2 -2 -2 -2 -2 -2', c: '1 1 1 1 1 1', d: '-0.015625 -0.015625 -0.015625 -0.015625 -0.015625 -0.015625 -0.015625', t: 0 } },
  { label: 'Spline natural (1 4 1)', value: { a: '1 1 1', b: '4 4 4 4', c: '1 1 1', d: '6 12 18 24', t: 0 } },
  { label: 'No dominante', value: { a: '3 1', b: '1 2 1', c: '2 4', d: '3 9 2', t: 0 } },
]

export function Thomas() {
  const [s, setS] = useLocalState<S>('sistemas:thomas:v2', { ...S5, variant: 'libro', t: 4 })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)
  useTheme()

  const calc = useMemo(() => {
    const b = parseVector(d.b)
    if (!b) return { error: 'Diagonal principal b inválida.' }
    const n = b.length
    if (n < 2) return { error: 'Se necesitan al menos 2 ecuaciones.' }
    const a = parseVector(d.a)
    const c = parseVector(d.c)
    const dd = parseVector(d.d)
    if (!a || a.length !== n - 1) return { error: `La subdiagonal a debe tener n − 1 = ${n - 1} valores (tiene ${a ? a.length : 0}).` }
    if (!c || c.length !== n - 1) return { error: `La superdiagonal c debe tener n − 1 = ${n - 1} valores (tiene ${c ? c.length : 0}).` }
    if (!dd || dd.length !== n) return { error: `El lado derecho d debe tener n = ${n} valores (tiene ${dd ? dd.length : 0}).` }
    const res = A.thomas(a, b, c, dd, d.t)
    const exact = d.t ? A.thomas(a, b, c, dd) : null
    const M = A.tridiagToMatrix(a, b, c)
    const dom = A.diagDominance(M)
    const residual = res.ok ? A.vsub(dd, A.matVec(M, res.x)) : []
    return { a, b, c, d: dd, n, res, exact, M, dom, residual }
  }, [d])

  const inputs = (
    <>
      <VectorField label={<>Subdiagonal <Tex>{'a_2,\\dots,a_n'}</Tex> (n − 1 valores)</>} value={s.a} onChange={(a) => set({ a })} />
      <VectorField label={<>Diagonal principal <Tex>{'b_1,\\dots,b_n'}</Tex></>} value={s.b} onChange={(b) => set({ b })} />
      <VectorField label={<>Superdiagonal <Tex>{'c_1,\\dots,c_{n-1}'}</Tex> (n − 1 valores)</>} value={s.c} onChange={(c) => set({ c })} />
      <VectorField label={<>Lado derecho <Tex>{'d_1,\\dots,d_n'}</Tex></>} value={s.d} onChange={(dd) => set({ d: dd })} />
      <SelectField
        label="Presentación"
        value={s.variant}
        onChange={(variant) => set({ variant })}
        options={[
          { value: 'libro', label: 'Como en el texto: bₖ⁽ᵏ⁻¹⁾, dₖ⁽ᵏ⁻¹⁾ y sustitución regresiva' },
          { value: 'normalizada', label: 'Normalizada (Burden): c′ᵢ, d′ᵢ' },
        ]}
      />
      <IntField label="Cifras de la mantisa (0 = doble precisión)" value={s.t} onChange={(t) => set({ t })} min={0} max={12} hint="Simula la calculadora de t cifras de la práctica del texto." />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.thomas} topic={TOPIC} theory={THEORY.thomas} inputs={inputs}>
      {'error' in calc ? (
        <Alert kind="error">{calc.error}</Alert>
      ) : (
        <>
          <Card title="Sistema tridiagonal">
            <Tex block>{texM(calc.M, 5) + '\\,x = ' + texM(calc.d, 5)}</Tex>
          </Card>
          <Stats
            items={[
              { label: 'Solución x', value: calc.res.ok ? vecText(calc.res.x, d.t || undefined) : '—', accent: true, hint: d.t ? `aritmética de ${d.t} cifras` : undefined },
              { label: 'n', value: calc.n },
              { label: 'Operaciones', value: 8 * calc.n - 7, hint: `8n − 7 (tabla de la Práctica 04.1) · proporcional a n  vs  Gauss ≈ ${Math.round(A.gaussOps(calc.n).total)}` },
              calc.exact?.ok
                ? { label: 'x en doble precisión', value: vecText(calc.exact.x), hint: 'para comparar con la aritmética de t cifras' }
                : { label: 'Residuo ‖d − Ax‖∞', value: calc.res.ok ? fmtErr(A.normInf(calc.residual)) : '—' },
            ]}
          />
          {!calc.res.ok ? (
            <Alert kind="error">{calc.res.error}</Alert>
          ) : calc.dom.strict || calc.dom.weak ? (
            <Alert kind="ok">La matriz es diagonalmente dominante (|bᵢ| ≥ |aᵢ| + |cᵢ|): Thomas es estable sin pivoteo.</Alert>
          ) : (
            <Alert kind="warn">
              La matriz no es diagonalmente dominante (filas {calc.dom.rows.filter((r) => !r.weak).map((r) => r.i + 1).join(', ')}): Thomas no hace pivoteo y puede ser inestable o
              encontrar un pivote nulo. Revisa el residuo.
            </Alert>
          )}
          <Tabs
            tabs={[
              { label: 'Paso a paso', content: <Card><Steps steps={thomasSteps(calc.res, d.variant, d.t)} /></Card> },
              {
                label: 'Tabla',
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
                label: 'Gráfica',
                content: (
                  <Card>
                    <Plot
                      data={[{ x: calc.res.x.map((_, i) => i + 1), y: calc.res.x, type: 'scatter', mode: 'lines+markers', name: 'xᵢ', line: { color: SERIES[0], width: 2.5 }, marker: { size: 7 } }]}
                      layout={{ xaxis: { title: { text: 'i' }, dtick: 1 }, yaxis: { title: { text: 'xᵢ' } } }}
                    />
                    <Note>Perfil de la solución. En problemas de diferencias finitas (calor, viga) xᵢ ≈ u(tᵢ) en los nodos interiores.</Note>
                  </Card>
                ),
              },
              { label: 'Costo O(n)', content: <Card><CostPlot n={calc.n} extra={[{ name: 'Thomas: 8n − 7', f: (m) => 8 * m - 7 }]} /></Card> },
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
  if (t) out.push({ text: `Aritmética de ${t} cifras: cada dato y cada resultado intermedio se redondea a ${t} cifras significativas.` })
  const lines: string[] = []
  if (variant === 'libro') {
    out.push({ text: 'Triangularización: en cada columna se anula el único elemento bajo la diagonal; los cᵢ no cambian (fórmula 3.8):' })
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
    out.push({ text: 'Barrido hacia adelante (variante normalizada):' })
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
  if (lines.length > 12) out.push({ text: `… (${lines.length - 12} filas más en la tabla)` })
  if (!res.ok) {
    out.push({ text: '✕ ' + res.error })
    return out
  }
  out.push({ text: variant === 'libro' ? 'Sustitución regresiva (fórmula 3.9):' : 'Sustitución regresiva:' })
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
  if (back.length > 12) out.push({ text: '… (ver tabla)' })
  return out
}

function scilabThomas(a: A.Vec, b: A.Vec, c: A.Vec, d: A.Vec, t: number): string {
  const F = (e: string) => (t ? `fl(${e})` : e)
  const flDef = t ? sciFl(t) : ''
  return `// Método de Thomas (sistema tridiagonal, fórmulas 3.8-3.9 del texto)${t ? ` — aritmética de ${t} cifras` : ''} — generado por NumLab
clear; clc;
${flDef}a = ${F(sciVec([0, ...a]))};   // subdiagonal (a(1) no se usa)
b = ${F(sciVec(b))};   // diagonal
c = ${F(sciVec([...c, 0]))};   // superdiagonal (c(n) no se usa)
d = ${F(sciVec(d))};   // lado derecho
n = length(b);
// Triangularización: se anula a(k+1); los c(k) no cambian
for k = 1:n-1
  if b(k) == 0 then error('Pivote nulo en la fila ' + string(k)); end
  m = ${F('a(k+1) / b(k)')};
  b(k+1) = ${F(`b(k+1) - ${F('m * c(k)')}`)};
  d(k+1) = ${F(`d(k+1) - ${F('m * d(k)')}`)};
end
// Sustitución regresiva
x = zeros(n, 1);
x(n) = ${F('d(n) / b(n)')};
for k = n-1:-1:1
  x(k) = ${F(`${F(`d(k) - ${F('c(k) * x(k+1)')}`)} / b(k)`)};
end
mprintf('%4s %14s %14s %14s\\n', 'k', 'b(k)', 'd(k)', 'x(k)');
for k = 1:n
  mprintf('%4d %14.8f %14.8f %14.8f\\n', k, b(k), d(k), x(k));
end
// Verificación con la matriz completa (datos originales)
A = diag(${sciVec(b)}) + diag(${sciVec(a)}, -1) + diag(${sciVec(c)}, 1);
disp('A\\d ='); disp(A \\ ${sciVec(d)});
plot(1:n, x', '-o'); xtitle('Solución del sistema tridiagonal', 'k', 'x_k');
`
}
