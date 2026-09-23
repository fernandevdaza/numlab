import { useMemo } from 'react'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { useTheme } from '../../components/theme'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, IntField, MatrixField, MethodPage, ScilabCode, SelectField, Stats, Steps, Tabs, VectorField } from '../../components/ui'
import * as A from './algorithms'
import { N, Note, P, readSystem, sciMat, sciVec, texAug, texM, texMinusTerms, TOPIC, vecText, sciFl } from './shared'
import { THEORY, TITLES } from './theory'

interface S {
  A: string
  b: string
  kind: A.LUKind
  /** cifras de la mantisa (0 = doble precisión) */
  t: number
}

const EXAMPLES: { label: string; value: S }[] = [
  { label: 'Ej. 3.2 (Ej. 3.1 reordenado, 4 cifras)', value: { A: '1.331 1.21 1.1\n1 1 1\n0.729 0.81 0.9', b: '1.000 0.8338 0.6867', kind: 'doolittle', t: 4 } },
  { label: 'Práct. 02 (S₂, 4 cifras)', value: { A: '1.0657 0.34252 -2.7826\n-2.0986 0.37852 0.52046\n0.56722 3.4967 1.5874', b: '1.0035 0.64246 2.0645', kind: 'doolittle', t: 4 } },
  { label: 'Clásico 3×3', value: { A: '2 1 -1\n-3 -1 2\n-2 1 2', b: '8 -11 -3', kind: 'doolittle', t: 0 } },
  { label: 'Crout 3×3', value: { A: '2 1 -1\n-3 -1 2\n-2 1 2', b: '8 -11 -3', kind: 'crout', t: 0 } },
  { label: 'Requiere P (a₁₁ = 0)', value: { A: '0 1 4\n1 2 3\n5 6 0', b: '5 6 11', kind: 'pivoteo', t: 0 } },
  { label: 'Simétrica def. positiva', value: { A: '4 12 -16\n12 37 -43\n-16 -43 98', b: '0 6 39', kind: 'cholesky', t: 0 } },
  { label: 'Tridiagonal 4×4', value: { A: '2 -1 0 0\n-1 2 -1 0\n0 -1 2 -1\n0 0 -1 2', b: '1 0 0 1', kind: 'doolittle', t: 0 } },
]

const KIND_LABEL: Record<A.LUKind, string> = {
  doolittle: 'Doolittle (lᵢᵢ = 1), como en el texto',
  crout: 'Crout (uᵢᵢ = 1)',
  pivoteo: 'Doolittle con pivoteo parcial: PA = LU (Burden)',
  cholesky: 'Cholesky: A = LLᵀ (Burden)',
}

export function LU() {
  const [s, setS] = useLocalState<S>('sistemas:lu:v2', EXAMPLES[0].value)
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)
  const { digits } = useTheme()

  const calc = useMemo(() => {
    const sys = readSystem(d.A, d.b)
    if ('error' in sys) return { error: sys.error }
    const res = A.lu(sys.A, sys.b, d.kind, d.t)
    // inversa columna por columna con la misma factorización: A·X = I  ⇔  L U xⱼ = eⱼ
    const inv = res.ok ? A.transpose(A.eye(sys.n).map((e) => A.lu(sys.A, e, d.kind, d.t).x)) : null
    const exact = d.t && res.ok ? A.lu(sys.A, sys.b, d.kind === 'cholesky' ? 'cholesky' : 'pivoteo') : null
    return { sys, res, inv, exact }
  }, [d])

  const inputs = (
    <>
      <MatrixField label="Matriz A" value={s.A} onChange={(A) => set({ A })} rows={5} />
      <VectorField label="Vector b" value={s.b} onChange={(b) => set({ b })} />
      <SelectField label="Factorización" value={s.kind} onChange={(kind) => set({ kind })} options={(Object.keys(KIND_LABEL) as A.LUKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
      <IntField label="Cifras de la mantisa (0 = doble precisión)" value={s.t} onChange={(t) => set({ t })} min={0} max={12} hint="Simula la calculadora de t cifras de los ejemplos del texto: redondea cada dato y cada operación." />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.lu} topic={TOPIC} theory={THEORY.lu} inputs={inputs}>
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <LUResults s={d} sys={calc.sys} res={calc.res} inv={calc.inv} exact={calc.exact} digits={digits} />}
    </MethodPage>
  )
}

function LUResults({ s, sys, res, inv, exact, digits }: { s: S; sys: { A: A.Mat; b: A.Vec; n: number }; res: A.LUResult; inv: A.Mat | null; exact: A.LUResult | null; digits: number }) {
  const n = sys.n
  const dd = s.t ? s.t + 2 : undefined
  const hasP = s.kind === 'pivoteo'
  const PA = A.matMul(res.P, sys.A)
  const factorErr = res.ok ? Math.max(...A.matMul(res.L, res.U).map((r, i) => Math.max(...r.map((v, j) => Math.abs(v - PA[i][j]))))) : NaN
  const sym = A.isSymmetric(sys.A)
  const er = (i: number) => (exact && exact.x[i] !== 0 ? Math.abs((res.x[i] - exact.x[i]) / exact.x[i]) : NaN)
  return (
    <>
      <Stats
        items={[
          { label: 'Solución x', value: res.ok ? vecText(res.x, s.t || Math.min(digits, 8)) : '—', accent: true, hint: s.t ? `aritmética de ${s.t} cifras` : undefined },
          { label: 'det(A)', value: res.ok ? fmt(res.det, s.t || undefined) : '—', hint: s.kind === 'cholesky' ? '∏ lᵢᵢ²' : hasP ? 'det(P)·∏ uᵢᵢ' : s.kind === 'crout' ? '∏ lᵢᵢ' : '∏ uᵢᵢ' },
          { label: hasP ? '‖PA − LU‖' : s.kind === 'cholesky' ? '‖A − LLᵀ‖' : '‖A − LU‖', value: res.ok ? fmtErr(factorErr) : '—', hint: 'verificación de la factorización' },
          exact
            ? { label: 'Error relativo máx.', value: res.ok ? `${fmt(100 * Math.max(...res.x.map((_, i) => er(i))), 2)} %` : '—', hint: 'respecto de la solución en doble precisión' }
            : { label: 'Residuo ‖b − Ax‖∞', value: res.ok ? fmtErr(A.normInf(res.residual)) : '—' },
        ]}
      />
      {res.ok ? (
        <Alert kind="ok">
          Factorización {KIND_LABEL[s.kind].split(/[,(]/)[0].trim()} obtenida.{' '}
          {hasP ? (res.perm.some((p, i) => p !== i) ? `Orden de filas: (${res.perm.map((p) => p + 1).join(', ')}).` : 'No hizo falta intercambiar filas (P = I).') : ''}
        </Alert>
      ) : (
        <Alert kind="error">
          {res.error}
          {s.kind === 'cholesky' && !sym && ' (A no es simétrica)'}
        </Alert>
      )}
      {res.ok && (
        <Card title="Factores">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
            {hasP && <Tex>{'P = ' + texM(res.P, 1)}</Tex>}
            <Tex>{'L = ' + texM(res.L, dd)}</Tex>
            <Tex>{(s.kind === 'cholesky' ? 'L^T = ' : 'U = ') + texM(res.U, dd)}</Tex>
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0' }}>
            {hasP ? 'Se verifica PA = LU. ' : ''}Resolver Ax = b ⇔ Ly = {hasP ? 'Pb' : 'b'} (progresiva) y luego Ux = y (regresiva): cada nuevo b cuesta sólo O(n²).
          </p>
        </Card>
      )}
      <Tabs
        tabs={[
          { label: 'Paso a paso', content: <Card><Steps steps={luSteps(res, n, s.kind, dd)} /></Card> },
          {
            label: 'Solución',
            content: (
              <Card>
                {res.ok ? (
                  <DataTable
                    filename="lu_solucion"
                    columns={[
                      { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
                      { key: 'pb', tex: hasP ? '(Pb)_i' : 'b_i' },
                      { key: 'y', tex: 'y_i', get: (r: any) => fmt(r.y, dd) },
                      { key: 'x', tex: 'x_i', get: (r: any) => fmt(r.x, dd) },
                      ...(exact
                        ? [
                            { key: 'ex', tex: 'x_i\;\\text{(doble precisión)}' },
                            { key: 'er', tex: '\\text{E.R. (\\%)}', get: (r: any) => (Number.isFinite(r.er) ? fmt(100 * r.er, 3) : '—') },
                          ]
                        : [{ key: 'r', tex: '(b-Ax)_i', fmt: 'err' as const }]),
                    ]}
                    rows={res.x.map((x, i) => ({ i: i + 1, pb: res.Pb[i], y: res.y[i], x, ex: exact?.x[i], er: er(i), r: res.residual[i] }))}
                  />
                ) : (
                  <p className="muted">La factorización no pudo completarse.</p>
                )}
              </Card>
            ),
          },
          {
            label: 'Inversa A⁻¹',
            content: (
              <Card>
                {inv ? (
                  <>
                    <Tex block>{`A^{-1} = ${texM(inv, dd ?? 6)}`}</Tex>
                    <Note>
                      Con la misma factorización se resuelven n sistemas L U xⱼ = eⱼ (eⱼ = columna j de la identidad{hasP ? ', permutada por P' : ''}); cada xⱼ es la columna j de A⁻¹
                      (Práctica 02 del texto).
                    </Note>
                  </>
                ) : (
                  <p className="muted">A no es invertible (o la factorización no pudo completarse).</p>
                )}
              </Card>
            ),
          },
        ]}
      />
      <ScilabCode code={scilabLU(sys.A, sys.b, s.kind, s.t)} filename={'lu_' + s.kind} />
    </>
  )
}

const ij = (n: number, i: number, j: number) => (n > 9 ? `${i + 1},${j + 1}` : `${i + 1}${j + 1}`)

function entryTex(e: A.Entry, n: number, kind: A.LUKind, d?: number): string {
  const lhs = `${e.M.toLowerCase()}_{${ij(n, e.i, e.j)}}`
  // nombres simbólicos de los términos de la suma
  const names = e.terms.map((_, m) => {
    if (kind === 'cholesky') return e.sqrt ? `l_{${ij(n, e.i, m)}}^2` : `l_{${ij(n, e.i, m)}}l_{${ij(n, e.j, m)}}`
    return `l_{${ij(n, e.i, m)}}u_{${ij(n, m, e.j)}}`
  })
  const symNum = e.terms.length ? `a_{${ij(n, e.i, e.j)}} - ${names.join(' - ')}` : `a_{${ij(n, e.i, e.j)}}`
  const num = e.sqrt ? N(e.a, d) + e.terms.map(([p]) => ` - ${P(p, d)}^2`).join('') : texMinusTerms(e.a, e.terms, d)
  const divName = kind === 'cholesky' ? `l_{${ij(n, e.j, e.j)}}` : kind === 'crout' ? `l_{${ij(n, e.i, e.i)}}` : `u_{${ij(n, e.j, e.j)}}`
  if (e.sqrt) return `${lhs} &= \\sqrt{${symNum}} = \\sqrt{${num}} = ${N(e.value, d)}`
  if (e.div !== undefined) return `${lhs} &= \\frac{${symNum}}{${divName}} = \\frac{${num}}{${N(e.div, d)}} = ${N(e.value, d)}`
  return e.terms.length ? `${lhs} &= ${symNum} = ${num} = ${N(e.value, d)}` : `${lhs} &= a_{${ij(n, e.i, e.j)}} = ${N(e.value, d)}`
}

function luSteps(res: A.LUResult, n: number, kind: A.LUKind, d?: number): { text?: string; tex?: string }[] {
  const out: { text?: string; tex?: string }[] = []
  if (kind === 'pivoteo') {
    out.push({ text: 'Eliminación gaussiana con pivoteo parcial; los multiplicadores forman L y los intercambios forman P:' })
    for (const st of res.steps) {
      const k = st.k
      if (st.swap) out.push({ text: `Columna ${k + 1}: el mayor |aᵢ${k + 1}| está en la fila ${st.swap[1] + 1} ⇒ F${k + 1} ↔ F${st.swap[1] + 1} (también se intercambian en P y en las columnas ya calculadas de L).` })
      else out.push({ text: `Columna ${k + 1}: el pivote ya es el de mayor módulo, no se intercambia.` })
      if (st.mult.length)
        out.push({
          tex:
            '\\begin{aligned}' +
            st.mult.map(({ i, m }) => `l_{${ij(n, i, k)}} = m_{${ij(n, i, k)}} &= ${N(m, d)} &&\\Rightarrow F_{${i + 1}} \\leftarrow F_{${i + 1}} - ${P(m, d)}F_{${k + 1}}`).join(' \\\\ ') +
            '\\end{aligned}\\qquad\\longrightarrow\; ' +
            texM(st.U, d),
        })
    }
  } else {
    const label =
      kind === 'doolittle'
        ? 'en el paso k, primero la fila k de U y luego la columna k de L (así todo lo que aparece a la derecha ya fue calculado)'
        : kind === 'crout'
          ? 'en el paso k, primero la columna k de L y luego la fila k de U'
          : 'columna k de L'
    out.push({ text: `Se calculan las entradas en este orden: ${label}.` })
    const stages = new Map<number, A.Entry[]>()
    for (const e of res.entries) {
      const k = kind === 'doolittle' ? (e.M === 'U' ? e.i : e.j) : kind === 'crout' ? (e.M === 'L' ? e.j : e.i) : e.j
      stages.set(k, [...(stages.get(k) ?? []), e])
    }
    for (const [k, es] of stages) {
      const what = kind === 'doolittle' ? `${k + 1}.ª fila de U${k < n - 1 ? ` y ${k + 1}.ª columna de L` : ''}` : kind === 'crout' ? `${k + 1}.ª columna de L${k < n - 1 ? ` y ${k + 1}.ª fila de U` : ''}` : `${k + 1}.ª columna de L`
      out.push({ text: `k = ${k + 1}: ${what}`, tex: '\\begin{aligned}' + es.map((e) => entryTex(e, n, kind, d)).join(' \\\\ ') + '\\end{aligned}' })
    }
  }
  if (!res.ok) {
    out.push({ text: '✕ ' + res.error })
    return out
  }
  if (kind === 'pivoteo') {
    out.push({ text: 'Factores obtenidos:', tex: `P = ${texM(res.P, 1)},\\quad L = ${texM(res.L, d)},\\quad U = ${texM(res.U, d)}` })
    out.push({ text: 'Permutamos b:', tex: `Pb = ${texM(res.Pb, d)}` })
  }
  const bName = kind === 'pivoteo' ? '(Pb)' : 'b'
  out.push({ text: `(1) Sustitución progresiva Ly = ${kind === 'pivoteo' ? 'Pb' : 'b'} (se calculan y₁, y₂, …, yₙ en ese orden):`, tex: texAug(res.L.map((r, i) => [...r, res.Pb[i]]), d) })
  out.push({
    tex:
      '\\begin{aligned}' +
      res.fwd
        .map((f) => {
          const i = f.i
          const numer = texMinusTerms(f.rhs, f.terms, d)
          const needDiv = f.diag !== 1
          const symb = `${bName}_{${i + 1}}` + (f.terms.length ? ` - \\sum_{j<${i + 1}} l_{${i + 1}j}y_j` : '')
          return needDiv
            ? `y_{${i + 1}} &= \\frac{${symb}}{l_{${ij(n, i, i)}}} = \\frac{${numer}}{${N(f.diag, d)}} = ${N(f.value, d)}`
            : `y_{${i + 1}} &= ${symb} = ${numer} = ${N(f.value, d)}`
        })
        .join(' \\\\ ') +
      '\\end{aligned}',
  })
  out.push({ text: '(2) Sustitución regresiva Ux = y (se calculan xₙ, xₙ₋₁, …, x₁):', tex: texAug(res.U.map((r, i) => [...r, res.y[i]]), d) })
  out.push({
    tex:
      '\\begin{aligned}' +
      [...res.bwd]
        .reverse()
        .map((f) => {
          const i = f.i
          const numer = texMinusTerms(f.rhs, f.terms, d)
          const symb = `y_{${i + 1}}` + (f.terms.length ? ` - \\sum_{j>${i + 1}} u_{${i + 1}j}x_j` : '')
          return f.diag !== 1 ? `x_{${i + 1}} &= \\frac{${symb}}{u_{${ij(n, i, i)}}} = \\frac{${numer}}{${N(f.diag, d)}} = ${N(f.value, d)}` : `x_{${i + 1}} &= ${symb} = ${numer} = ${N(f.value, d)}`
        })
        .join(' \\\\ ') +
      '\\end{aligned}',
  })
  return out
}

function scilabLU(Am: A.Mat, b: A.Vec, kind: A.LUKind, t: number): string {
  // Las sumas se escriben con bucles explícitos: en Scilab 6, [] - x o x - [] da [] (no 0) y rompería k = 1.
  const F = (e: string) => (t ? `fl(${e})` : e)
  const flDef = t ? sciFl(t) : ''
  const head = `// Factorización LU — ${KIND_LABEL[kind]}${t ? ` — aritmética de ${t} cifras` : ''} — generado por NumLab
clear; clc;
${flDef}A = ${F(sciMat(Am))};
b = ${F(sciVec(b))};
n = size(A, 1);
`
  const fact: Record<A.LUKind, string> = {
    doolittle: `// Doolittle: L con unos en la diagonal; fila k de U y luego columna k de L
L = eye(n, n); U = zeros(n, n);
for k = 1:n
  for j = k:n
    s = A(k, j);
    for m = 1:k-1
      s = ${F(`s - ${F('L(k, m) * U(m, j)')}`)};
    end
    U(k, j) = s;
  end
  if U(k, k) == 0 then error('u(k,k) = 0: reordene las ecuaciones'); end
  for i = k+1:n
    s = A(i, k);
    for m = 1:k-1
      s = ${F(`s - ${F('L(i, m) * U(m, k)')}`)};
    end
    L(i, k) = ${F('s / U(k, k)')};
  end
end
Pb = b;
disp('L ='); disp(L); disp('U ='); disp(U);
mprintf('||A - L*U|| = %e\\n', norm(A - L*U));
`,
    crout: `// Crout: U con unos en la diagonal; columna k de L y luego fila k de U
L = zeros(n, n); U = eye(n, n);
for k = 1:n
  for i = k:n
    s = A(i, k);
    for m = 1:k-1
      s = ${F(`s - ${F('L(i, m) * U(m, k)')}`)};
    end
    L(i, k) = s;
  end
  if L(k, k) == 0 then error('l(k,k) = 0: reordene las ecuaciones'); end
  for j = k+1:n
    s = A(k, j);
    for m = 1:k-1
      s = ${F(`s - ${F('L(k, m) * U(m, j)')}`)};
    end
    U(k, j) = ${F('s / L(k, k)')};
  end
end
Pb = b;
disp('L ='); disp(L); disp('U ='); disp(U);
mprintf('||A - L*U|| = %e\\n', norm(A - L*U));
`,
    pivoteo: `// Eliminación con pivoteo parcial: P*A = L*U
U = A; L = eye(n, n); P = eye(n, n);
for k = 1:n-1
  [mx, p] = max(abs(U(k:n, k)));
  p = p + k - 1;
  if mx == 0 then error('Matriz singular'); end
  if p <> k then
    U([k p], :) = U([p k], :);
    P([k p], :) = P([p k], :);
    if k > 1 then L([k p], 1:k-1) = L([p k], 1:k-1); end
  end
  for i = k+1:n
    L(i, k) = ${F('U(i, k) / U(k, k)')};
    U(i, k) = 0;
    U(i, k+1:n) = ${F(`U(i, k+1:n) - ${F('L(i, k) * U(k, k+1:n)')}`)};
  end
end
Pb = P * b;
disp('P ='); disp(P); disp('L ='); disp(L); disp('U ='); disp(U);
mprintf('||P*A - L*U|| = %e\\n', norm(P*A - L*U));
// Comparación con la función de Scilab: [L2, U2, P2] = lu(A) cumple P2*A = L2*U2
[L2, U2, P2] = lu(A);
disp('lu(A) de Scilab, U ='); disp(U2);
`,
    cholesky: `// Cholesky: A = L*L'  (A simétrica definida positiva)
L = zeros(n, n);
for j = 1:n
  s = A(j, j);
  for m = 1:j-1
    s = ${F(`s - ${F('L(j, m)^2')}`)};
  end
  if s <= 0 then error('A no es definida positiva'); end
  L(j, j) = ${F('sqrt(s)')};
  for i = j+1:n
    s = A(i, j);
    for m = 1:j-1
      s = ${F(`s - ${F('L(i, m) * L(j, m)')}`)};
    end
    L(i, j) = ${F('s / L(j, j)')};
  end
end
U = L';
Pb = b;
disp('L ='); disp(L);
// Scilab: R = chol(A) devuelve la triangular SUPERIOR con R'*R = A (R = L')
disp('chol(A) de Scilab ='); disp(chol(A));
`,
  }
  return (
    head +
    fact[kind] +
    `
// (1) Sustitución progresiva: L*y = Pb
y = zeros(n, 1);
for i = 1:n
  s = Pb(i);
  for j = 1:i-1
    s = ${F(`s - ${F('L(i, j) * y(j)')}`)};
  end
  y(i) = ${F('s / L(i, i)')};
end
// (2) Sustitución regresiva: U*x = y
x = zeros(n, 1);
for i = n:-1:1
  s = y(i);
  for j = i+1:n
    s = ${F(`s - ${F('U(i, j) * x(j)')}`)};
  end
  x(i) = ${F('s / U(i, i)')};
end
disp('y ='); disp(y);
disp('x ='); disp(x);
mprintf('det(A) = %.10g\\n', det(A));
disp('Verificación A\\b ='); disp(A\\b);
`
  )
}
