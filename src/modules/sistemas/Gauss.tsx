import { useMemo } from 'react'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { useTheme } from '../../components/theme'
import { Alert, Card, DataTable, Examples, IntField, MatrixField, MethodPage, ScilabCode, SelectField, Stats, Steps, Tabs, VectorField } from '../../components/ui'
import * as A from './algorithms'
import { N, P, readSystem, sciMat, sciVec, texAug, vecText, sciFl } from './shared'
import { CostPlot, SystemPlot } from './SystemPlot'
import { THEORY, TITLES } from './theory'
import { TOPIC } from './shared'
import { L } from '../../i18n'

interface S {
  A: string
  b: string
  pivot: A.Pivot
  /** cifras de la mantisa (0 = doble precisión) */
  t: number
}

const EJ31 = { A: '0.729 0.81 0.9\n1 1 1\n1.331 1.21 1.1', b: '0.6867 0.8338 1.000' }

export const GAUSS_EXAMPLES: { label: string; value: S }[] = [
  { label: L('Ej. 3.1 con pivoteo (4 cifras)', 'Ex. 3.1 with pivoting (4 digits)'), value: { ...EJ31, pivot: 'parcial', t: 4 } },
  { label: L('Ej. 3.1 sin pivoteo (4 cifras)', 'Ex. 3.1 without pivoting (4 digits)'), value: { ...EJ31, pivot: 'none', t: 4 } },
  { label: L('Práct. 01 (S₁, 4 cifras)', 'Practice 01 (S₁, 4 digits)'), value: { A: '1.2034 -9.0718 0.25645\n2.0035 -4.0203 0.63452\n0.98867 -0.67498 3.2457', b: '5.2346 3.6678 -0.46798', pivot: 'parcial', t: 4 } },
  { label: L('Clásico 3×3', 'Classic 3×3'), value: { A: '2 1 -1\n-3 -1 2\n-2 1 2', b: '8 -11 -3', pivot: 'parcial', t: 0 } },
  { label: L('Pivote pequeño (0.003)', 'Small pivot (0.003)'), value: { A: '0.003 59.14\n5.291 -6.130', b: '59.17 46.78', pivot: 'none', t: 4 } },
  { label: L('Pivote cero a₁₁ = 0', 'Zero pivot a₁₁ = 0'), value: { A: '0 2 3\n4 6 7\n2 -3 6', b: '8 -3 5', pivot: 'parcial', t: 0 } },
  { label: L('Singular', 'Singular'), value: { A: '1 2 3\n4 5 6\n7 8 9', b: '1 2 3', pivot: 'parcial', t: 0 } },
  { label: L('Hilbert 4 (mal cond.)', 'Hilbert 4 (ill-cond.)'), value: { A: '1 1/2 1/3 1/4\n1/2 1/3 1/4 1/5\n1/3 1/4 1/5 1/6\n1/4 1/5 1/6 1/7', b: '1 1 1 1', pivot: 'parcial', t: 0 } },
]

const idx = (n: number, i: number, j: number) => (n > 9 ? `${i + 1},${j + 1}` : `${i + 1}${j + 1}`)

export function Gauss() {
  const [s, setS] = useLocalState<S>('sistemas:gauss:v2', GAUSS_EXAMPLES[0].value)
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)
  const { digits } = useTheme()

  const calc = useMemo(() => {
    const sys = readSystem(d.A, d.b)
    if ('error' in sys) return { error: sys.error }
    const res = A.gauss(sys.A, sys.b, d.pivot, d.t)
    const exact = d.t ? A.gauss(sys.A, sys.b, 'parcial') : res
    const inv = res.ok ? A.inverse(sys.A) : null
    const cond = inv ? A.normInfM(sys.A) * A.normInfM(inv) : Infinity
    return { sys, res, exact, cond }
  }, [d])

  const inputs = (
    <>
      <MatrixField label={L('Matriz de coeficientes A', 'Coefficient matrix A')} value={s.A} onChange={(A) => set({ A })} rows={5} hint={L('Una fila por línea; valores separados por espacios. Admite fracciones: 1/3, sqrt(2)…', 'One row per line; values separated by spaces. Fractions allowed: 1/3, sqrt(2)…')} />
      <VectorField label={L('Vector independiente b', 'Right-hand side vector b')} value={s.b} onChange={(b) => set({ b })} />
      <SelectField
        label={L('Estrategia de pivoteo', 'Pivoting strategy')}
        value={s.pivot}
        onChange={(pivot) => set({ pivot })}
        options={[
          { value: 'parcial', label: L('Pivoteo parcial: mayor |aᵢₖ| de la columna (texto)', 'Partial pivoting: largest |aᵢₖ| in the column (textbook)') },
          { value: 'none', label: L('Sin pivoteo (intercambia sólo si el pivote es 0)', 'No pivoting (interchange only if the pivot is 0)') },
          { value: 'escalado', label: L('Pivoteo parcial escalado |aᵢₖ|/sᵢ (Burden)', 'Scaled partial pivoting |aᵢₖ|/sᵢ (Burden)') },
        ]}
      />
      <IntField label={L('Cifras de la mantisa (0 = doble precisión)', 'Mantissa digits (0 = double precision)')} value={s.t} onChange={(t) => set({ t })} min={0} max={12} hint={L('Simula la calculadora de t cifras de los ejemplos del texto: redondea cada dato y cada operación.', 'Simulates the t-digit calculator of the textbook examples: rounds every datum and every operation.')} />
      <Examples items={GAUSS_EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.gauss} topic={TOPIC} theory={THEORY.gauss} inputs={inputs}>
      {'error' in calc ? (
        <Alert kind="error">{calc.error}</Alert>
      ) : (
        <GaussResults s={d} sys={calc.sys} res={calc.res} exact={calc.exact} cond={calc.cond} digits={digits} />
      )}
    </MethodPage>
  )
}

function GaussResults({ s, sys, res, exact, cond, digits }: { s: S; sys: { A: A.Mat; b: A.Vec; n: number }; res: A.GaussResult; exact: A.GaussResult; cond: number; digits: number }) {
  const n = sys.n
  const th = A.gaussOps(n)
  const o = res.ops
  const steps = gaussSteps(res, n, s.pivot, s.t)
  const dd = s.t ? s.t + 2 : undefined
  const rounded = s.t > 0 && exact.ok
  const er = (i: number) => (rounded && exact.x[i] !== 0 ? Math.abs((res.x[i] - exact.x[i]) / exact.x[i]) : NaN)
  const maxEr = rounded && res.ok ? Math.max(...res.x.map((_, i) => er(i))) : NaN
  return (
    <>
      <Stats
        items={[
          { label: L('Solución x', 'Solution x'), value: res.ok ? vecText(res.x, s.t || Math.min(digits, 8)) : '—', accent: true, hint: s.t ? L(`aritmética de ${s.t} cifras`, `${s.t}-digit arithmetic`) : undefined },
          { label: 'det(A)', value: fmt(res.det, s.t || undefined), hint: `(−1)${String(res.swaps).replace(/\d/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+c])} · ∏ aᵢᵢ⁽ⁱ⁻¹⁾` },
          rounded
            ? { label: L('Error relativo máx.', 'Max. relative error'), value: Number.isFinite(maxEr) ? `${fmt(100 * maxEr, 2)} %` : '—', hint: L('respecto de la solución en doble precisión', 'with respect to the double-precision solution') }
            : { label: 'cond∞(A)', value: fmt(cond, 4), hint: Number.isFinite(cond) ? L(`≈ ${Math.max(0, Math.log10(cond)).toFixed(1)} cifras perdidas`, `≈ ${Math.max(0, Math.log10(cond)).toFixed(1)} digits lost`) : L('matriz singular', 'singular matrix') },
          {
            label: L('Operaciones', 'Operations'),
            value: o.tri.sub + o.tri.mul + o.tri.div + o.rhs.sub + o.rhs.mul + o.back.sub + o.back.mul + o.back.div,
            hint: L(
              `matriz: ${o.tri.sub} −, ${o.tri.mul} ×, ${o.tri.div} ÷ · b: ${o.rhs.sub} −, ${o.rhs.mul} × · sustitución: ${o.back.sub} −, ${o.back.mul} ×, ${o.back.div} ÷ (tabla del texto: ${th.total}, sin contar b)`,
              `matrix: ${o.tri.sub} −, ${o.tri.mul} ×, ${o.tri.div} ÷ · b: ${o.rhs.sub} −, ${o.rhs.mul} × · substitution: ${o.back.sub} −, ${o.back.mul} ×, ${o.back.div} ÷ (textbook table: ${th.total}, not counting b)`,
            ),
          },
        ]}
      />
      {res.ok ? (
        <Alert kind={cond > 1e10 ? 'warn' : 'ok'}>
          {L(
            <>
              Solución única{res.swaps > 0 ? ` (${res.swaps} intercambio${res.swaps > 1 ? 's' : ''} de ecuaciones)` : ''}. Residuo ‖b − Ax‖∞ = {fmtErr(A.normInf(res.residual))}.
              {cond > 1e10 && ' ⚠ Sistema muy mal condicionado: la solución puede tener pocas cifras correctas.'}
            </>,
            <>
              Unique solution{res.swaps > 0 ? ` (${res.swaps} row interchange${res.swaps > 1 ? 's' : ''})` : ''}. Residual ‖b − Ax‖∞ = {fmtErr(A.normInf(res.residual))}.
              {cond > 1e10 && ' ⚠ Very ill-conditioned system: the solution may have few correct digits.'}
            </>,
          )}
        </Alert>
      ) : (
        <Alert kind="error">{res.error}</Alert>
      )}
      <Tabs
        tabs={[
          { label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={steps} /></Card> },
          {
            label: L('Solución', 'Solution'),
            content: (
              <Card>
                {res.ok ? (
                  <DataTable
                    filename="gauss_solucion"
                    columns={[
                      { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
                      { key: 'x', tex: 'x_i', get: (r: any) => fmt(r.x, dd) },
                      ...(rounded
                        ? [
                            { key: 'ex', tex: L('x_i\\;\\text{(doble precisión)}', 'x_i\\;\\text{(double precision)}') },
                            { key: 'er', tex: L('\\text{E.R. (\\%)}', '\\text{R.E. (\\%)}'), get: (r: any) => (Number.isFinite(r.er) ? fmt(100 * r.er, 3) : '—') },
                          ]
                        : []),
                      { key: 'u', tex: 'a_{ii}^{(i-1)}', get: (r: any) => fmt(r.u, dd) },
                      { key: 'r', tex: '(b-Ax)_i', fmt: 'err' as const },
                    ]}
                    rows={res.x.map((x, i) => ({ i: i + 1, x, ex: exact.x[i], er: er(i), u: res.aug[i][i], r: res.residual[i] }))}
                  />
                ) : (
                  <p className="muted">{L('Sin solución única.', 'No unique solution.')}</p>
                )}
              </Card>
            ),
          },
          { label: L('Gráfica', 'Plot'), content: <Card><SystemPlot A={sys.A} b={sys.b} x={res.ok ? res.x : null} /></Card> },
          { label: L('Costo O(n³)', 'Cost O(n³)'), content: <Card><CostPlot n={n} /></Card> },
        ]}
      />
      <ScilabCode code={scilabGauss(sys.A, sys.b, s.pivot, s.t)} filename="gauss" />
    </>
  )
}

function gaussSteps(res: A.GaussResult, n: number, pivot: A.Pivot, t: number): { text?: string; tex?: string }[] {
  const out: { text?: string; tex?: string }[] = []
  const d = t ? t + 2 : undefined
  const Nd = (x: number) => N(x, d)
  const Pd = (x: number) => P(x, d)
  out.push({
    text: t
      ? L(`Matriz aumentada inicial [A | b] (datos redondeados a ${t} cifras; cada operación también se redondea):`, `Initial augmented matrix [A | b] (data rounded to ${t} digits; every operation is rounded too):`)
      : L('Matriz aumentada inicial [A | b]:', 'Initial augmented matrix [A | b]:'),
    tex: texAug(res.aug0, d),
  })
  if (pivot === 'escalado')
    out.push({ text: L('Factores de escala sᵢ = máx |aᵢⱼ| de cada fila (se calculan una sola vez):', 'Scale factors sᵢ = max |aᵢⱼ| of each row (computed only once):'), tex: res.aug0.map((r, i) => `s_{${i + 1}} = ${N(Math.max(...r.slice(0, n).map(Math.abs)))}`).join(',\\quad ') })
  for (const st of res.steps) {
    const k = st.k
    if (st.swap) {
      const [a, p] = st.swap
      const why =
        pivot === 'parcial'
          ? L(`el mayor |aᵢ${k + 1}| en la columna ${k + 1} (ecuaciones ${k + 1}…${n}) está en la ecuación ${p + 1}`, `the largest |aᵢ${k + 1}| in column ${k + 1} (equations ${k + 1}…${n}) is in equation ${p + 1}`)
          : pivot === 'escalado'
            ? L(`la mayor razón |aᵢ${k + 1}|/sᵢ está en la fila ${p + 1}`, `the largest ratio |aᵢ${k + 1}|/sᵢ is in row ${p + 1}`)
            : L(`el pivote a${k + 1}${k + 1} es cero`, `the pivot a${k + 1}${k + 1} is zero`)
      out.push({ text: L(`Columna ${k + 1} — pivoteo: ${why} ⇒ intercambiamos E${a + 1} ↔ E${p + 1}.`, `Column ${k + 1} — pivoting: ${why} ⇒ interchange E${a + 1} ↔ E${p + 1}.`), tex: (st.ratios ? st.ratios.map((r, j) => `\\tfrac{|a_{${idx(n, k + j, k)}}|}{s_{${k + j + 1}}} = ${N(r, 5)}`).join(',\\; ') + '\\qquad ' : '') + texAug(st.before, d, { box: [k, k] }) })
    } else {
      out.push({
        text: L(
          `Columna ${k + 1} — pivote a${k + 1}${k + 1} = ${fmt(st.pivot, d)}${pivot === 'parcial' ? ' (ya es el de mayor valor absoluto en su columna)' : ''}. Anulamos x${k + 1} en las ecuaciones ${k + 2}…${n}:`,
          `Column ${k + 1} — pivot a${k + 1}${k + 1} = ${fmt(st.pivot, d)}${pivot === 'parcial' ? ' (already the largest in absolute value in its column)' : ''}. Eliminate x${k + 1} from equations ${k + 2}…${n}:`,
        ),
        tex: st.ratios ? st.ratios.map((r, j) => `\\tfrac{|a_{${idx(n, k + j, k)}}|}{s_{${k + j + 1}}} = ${N(r, 5)}`).join(',\\; ') : undefined,
      })
    }
    if (st.swap) out.push({ text: L(`Anulamos x${k + 1} en las ecuaciones ${k + 2}…${n} con el pivote a${k + 1}${k + 1} = ${fmt(st.pivot, d)}:`, `Eliminate x${k + 1} from equations ${k + 2}…${n} with the pivot a${k + 1}${k + 1} = ${fmt(st.pivot, d)}:`) })
    out.push({
      tex:
        '\\begin{aligned}' +
        st.mult
          .map(({ i, m }) => `m_{${idx(n, i, k)}} = \\frac{a_{${idx(n, i, k)}}}{a_{${idx(n, k, k)}}} &= \\frac{${Nd(st.before[i][k])}}{${Nd(st.pivot)}} = ${Nd(m)} &&\\Rightarrow\\; E_{${i + 1}} \\leftarrow E_{${i + 1}} - ${Pd(m)}\\,E_{${k + 1}}`)
          .join(' \\\\ ') +
        '\\end{aligned}',
    })
    out.push({ tex: '\\longrightarrow\\;' + texAug(st.after, d, { hl: st.mult.map((m) => m.i) }) })
  }
  if (!res.ok) {
    out.push({ text: '✕ ' + res.error })
    return out
  }
  out.push({ text: L('Sistema triangular superior obtenido. Sustitución regresiva (desde la última ecuación):', 'Upper triangular system obtained. Back substitution (starting from the last equation):') })
  for (let q = res.back.length - 1; q >= 0; q--) {
    const bs = res.back[q]
    const i = bs.i
    const sum = bs.terms.map(([u, x]) => ` - ${Pd(u)}\\cdot ${Pd(x)}`).join('')
    out.push({
      tex: bs.terms.length
        ? `x_{${i + 1}} = \\frac{b_{${i + 1}} - \\sum_{j>${i + 1}} a_{${i + 1}j}x_j}{a_{${idx(n, i, i)}}} = \\frac{${Nd(bs.rhs)}${sum}}{${Nd(bs.diag)}} = ${Nd(bs.x)}`
        : `x_{${i + 1}} = \\frac{b_{${i + 1}}}{a_{${idx(n, i, i)}}} = \\frac{${Nd(bs.rhs)}}{${Nd(bs.diag)}} = ${Nd(bs.x)}`,
    })
  }
  out.push({
    text: L('Determinante como subproducto (producto de la diagonal del sistema triangular):', 'Determinant as a by-product (product of the diagonal of the triangular system):'),
    tex: `\\det A = (-1)^{${res.swaps}}\\prod_{i=1}^{${n}} a_{ii}^{(i-1)} = ${res.swaps % 2 ? '-' : ''}${res.aug.map((r, i) => Pd(r[i])).join('\\cdot ')} = ${N(res.det)}`,
  })
  return out
}

function scilabGauss(Am: A.Mat, b: A.Vec, pivot: A.Pivot, t: number): string {
  // con t > 0 se envuelve cada operación en fl(·) (redondeo a t cifras), como la calculadora del texto
  const F = (e: string) => (t ? `fl(${e})` : e)
  const piv =
    pivot === 'parcial'
      ? `  // ${L('Pivoteo parcial: ecuación con el mayor |a(i,k)|, i >= k', 'Partial pivoting: equation with the largest |a(i,k)|, i >= k')}
  [mx, p] = max(abs(Ab(k:n, k)));
  p = p + k - 1;
  if mx == 0 then error('${L('Matriz singular: pivote nulo', 'Singular matrix: zero pivot')}'); end
  if p <> k then
    Ab([k p], :) = Ab([p k], :);
    nswap = nswap + 1;
    mprintf('${L('Intercambio', 'Interchange')} E%d <-> E%d\\n', k, p);
  end
`
      : pivot === 'escalado'
        ? `  // ${L('Pivoteo escalado: mayor |a(i,k)|/s(i)', 'Scaled pivoting: largest |a(i,k)|/s(i)')}
  [mx, p] = max(abs(Ab(k:n, k)) ./ s(k:n));
  p = p + k - 1;
  if mx == 0 then error('${L('Matriz singular: pivote nulo', 'Singular matrix: zero pivot')}'); end
  if p <> k then
    Ab([k p], :) = Ab([p k], :);
    s([k p]) = s([p k]);
    nswap = nswap + 1;
    mprintf('${L('Intercambio', 'Interchange')} E%d <-> E%d\\n', k, p);
  end
`
        : `  // ${L('Sin pivoteo (solo se intercambia si el pivote es exactamente 0)', 'No pivoting (interchange only if the pivot is exactly 0)')}
  if Ab(k, k) == 0 then
    p = find(Ab(k+1:n, k) <> 0, 1) + k;
    if p == [] then error('${L('Matriz singular: pivote nulo', 'Singular matrix: zero pivot')}'); end
    Ab([k p], :) = Ab([p k], :);
    nswap = nswap + 1;
    mprintf('${L('Intercambio', 'Interchange')} E%d <-> E%d\\n', k, p);
  end
`
  const flDef = t ? sciFl(t) : ''
  const title = L(
    `Método de Gauss (${pivot === 'none' ? 'sin pivoteo' : pivot === 'parcial' ? 'con pivoteo parcial' : 'pivoteo escalado'}${t ? `, aritmética de ${t} cifras` : ''}) — generado por NumLab`,
    `Gaussian elimination (${pivot === 'none' ? 'no pivoting' : pivot === 'parcial' ? 'partial pivoting' : 'scaled pivoting'}${t ? `, ${t}-digit arithmetic` : ''}) — generated by NumLab`,
  )
  return `// ${title}
clear; clc;
${flDef}A = ${sciMat(Am)};
b = ${sciVec(b)};
n = size(A, 1);
Ab = ${F('[A b]')};      // ${L('matriz aumentada', 'augmented matrix')}
nswap = 0;
${pivot === 'escalado' ? `s = max(abs(A), "c");   // ${L('factores de escala por fila', 'row scale factors')}\\n` : ''}
// ${L('Triangularización', 'Triangular reduction')}
for k = 1:n-1
${piv}  for i = k+1:n
    m = ${F('Ab(i, k) / Ab(k, k)')};          // ${L('factor', 'multiplier')} a(i,k)/a(k,k)
    Ab(i, k) = 0;
    Ab(i, k+1:n+1) = ${F(`Ab(i, k+1:n+1) - ${F('m * Ab(k, k+1:n+1)')}`)};
    mprintf('m(%d,%d) = %10.6f   E%d <- E%d - m*E%d\\n', i, k, m, i, i, k);
  end
  mprintf('${L('Matriz aumentada tras la columna', 'Augmented matrix after column')} %d:\\n', k);
  disp(Ab);
end
if Ab(n, n) == 0 then error('${L('Matriz singular', 'Singular matrix')}'); end

// ${L('Sustitución regresiva', 'Back substitution')}
x = zeros(n, 1);
for i = n:-1:1
  s = Ab(i, n+1);
  for j = i+1:n
    s = ${F(`s - ${F('Ab(i, j) * x(j)')}`)};
  end
  x(i) = ${F('s / Ab(i, i)')};
end
disp('${L('Solución x =', 'Solution x =')}'); disp(x);
mprintf('det(A) = (-1)^%d * prod(diag) = %.10g\\n', nswap, (-1)^nswap * prod(diag(Ab(:, 1:n))));
mprintf('${L('Residuo', 'Residual')} ||b - A*x||inf = %e\\n', norm(b - A*x, %inf));
mprintf('cond(A) (${L('norma 2', '2-norm')}) = %e\\n', cond(A));
disp('${L('Verificación con el operador de Scilab A\\b:', 'Check with the Scilab operator A\\b:')}'); disp(A\\b);
`
}
