import { useMemo } from 'react'
import { evalNumber } from '../../lib/expr'
import { fmt, fmtErr } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { useTheme } from '../../components/theme'
import { Plot, SERIES } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, Examples, MatrixField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs, VectorField } from '../../components/ui'
import * as A from './algorithms'
import { N, Note, readSystem, sciMat, sciVec, texM, TOPIC } from './shared'
import { THEORY, TITLES } from './theory'
import { L } from '../../i18n'

interface S {
  A: string
  b: string
  eps: string
  /** 'ultimo': sólo se perturba bₙ (como en el Ej. 3.4); 'alternada': δbᵢ = ±ε‖b‖∞ */
  modo: 'ultimo' | 'alternada'
}

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: L('Ej. 3.4', 'Ex. 3.4'), value: { A: '0.9999 -1.0001\n1 -1', b: '1 1', eps: '1e-4', modo: 'ultimo' } },
  { label: L('Práct. 05 (Hilbert 4)', 'Practice 05 (Hilbert 4)'), value: { A: '1 1/2 1/3 1/4\n1/2 1/3 1/4 1/5\n1/3 1/4 1/5 1/6\n1/4 1/5 1/6 1/7', b: '1 2 3 4', eps: '1e-4', modo: 'alternada' } },
  { label: L('Bien condicionada', 'Well-conditioned'), value: { A: '4 1 0\n1 4 1\n0 1 4', b: '5 6 5', modo: 'alternada' } },
  { label: L('Rectas casi paralelas', 'Nearly parallel lines'), value: { A: '1 1\n1 1.0001', b: '2 2.0001', modo: 'ultimo' } },
  { label: 'Hilbert 6', value: { A: '1 1/2 1/3 1/4 1/5 1/6\n1/2 1/3 1/4 1/5 1/6 1/7\n1/3 1/4 1/5 1/6 1/7 1/8\n1/4 1/5 1/6 1/7 1/8 1/9\n1/5 1/6 1/7 1/8 1/9 1/10\n1/6 1/7 1/8 1/9 1/10 1/11', b: '1 1 1 1 1 1', modo: 'alternada' } },
  { label: L('det pequeño, κ = 1', 'small det, κ = 1'), value: { A: '0.1 0 0\n0 0.1 0\n0 0 0.1', b: '1 1 1', modo: 'alternada' } },
]

export function Condicion() {
  const [s, setS] = useLocalState<S>('sistemas:condicion:v2', { A: '0.9999 -1.0001\n1 -1', b: '1 1', eps: '1e-4', modo: 'ultimo' })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)
  useTheme()

  const calc = useMemo(() => {
    const sys = readSystem(d.A, d.b)
    if ('error' in sys) return { error: sys.error }
    const eps = evalNumber(d.eps)
    if (!Number.isFinite(eps)) return { error: L('Perturbación inválida.', 'Invalid perturbation.') }
    const inv = A.inverse(sys.A)
    const det = A.det(sys.A)
    if (!inv) return { error: L(`A es singular (det A = ${fmt(det)}): A⁻¹ no existe y κ(A) = ∞.`, `A is singular (det A = ${fmt(det)}): A⁻¹ does not exist and κ(A) = ∞.`) }
    const nA = A.normInfM(sys.A), nI = A.normInfM(inv)
    const n1A = A.norm1M(sys.A), n1I = A.norm1M(inv)
    const sv = A.singularExtremes(sys.A)
    const k2 = sv ? sv.max / sv.min : NaN
    const x = A.solve(sys.A, sys.b)!
    const nb = A.normInf(sys.b) || 1
    const db = d.modo === 'ultimo' ? sys.b.map((_, i) => (i === sys.n - 1 ? eps : 0)) : sys.b.map((_, i) => (i % 2 ? -1 : 1) * eps * nb)
    const xt = A.solve(sys.A, sys.b.map((v, i) => v + db[i]))!
    const relB = A.normInf(db) / nb
    const relX = A.normInf(A.vsub(xt, x)) / (A.normInf(x) || 1)
    return { ...sys, inv, det, nA, nI, n1A, n1I, sv, k2, kInf: nA * nI, k1: n1A * n1I, x, xt, db, relB, relX, eps, modo: d.modo }
  }, [d])

  const inputs = (
    <>
      <MatrixField label={L('Matriz A', 'Matrix A')} value={s.A} onChange={(A) => set({ A })} rows={4} />
      <VectorField label={L('Vector b (para el experimento de perturbación)', 'Vector b (for the perturbation experiment)')} value={s.b} onChange={(b) => set({ b })} />
      <NumField label={L('Perturbación ε', 'Perturbation ε')} value={s.eps} onChange={(eps) => set({ eps })} />
      <SelectField
        label={L('Cómo se perturba b', 'How b is perturbed')}
        value={s.modo}
        onChange={(modo) => set({ modo })}
        options={[
          { value: 'ultimo', label: L('Sólo la última ecuación: bₙ + ε (como en el Ej. 3.4)', 'Only the last equation: bₙ + ε (as in Ex. 3.4)') },
          { value: 'alternada', label: L('Todas: δbᵢ = ±ε‖b‖∞ con signos alternados', 'All: δbᵢ = ±ε‖b‖∞ with alternating signs') },
        ]}
      />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.condicion} topic={TOPIC} theory={THEORY.condicion} description={L('Estabilidad de Ax = b (texto, §3.4): normas de matriz, inversa y número de condición κ(A) = ‖A‖‖A⁻¹‖.', 'Stability of Ax = b (textbook, §3.4): matrix norms, inverse and condition number κ(A) = ‖A‖‖A⁻¹‖.')} inputs={inputs}>
      {'error' in calc ? (
        <Alert kind="error">{calc.error}</Alert>
      ) : (
        <>
          <Stats
            items={[
              { label: 'κ∞(A)', value: fmt(calc.kInf, 6), accent: true, hint: L(`≈ ${Math.max(0, Math.log10(calc.kInf)).toFixed(1)} cifras decimales perdidas`, `≈ ${Math.max(0, Math.log10(calc.kInf)).toFixed(1)} decimal digits lost`) },
              { label: 'κ₁(A)', value: fmt(calc.k1, 6) },
              { label: L('κ₂(A) = σmáx/σmín', 'κ₂(A) = σmax/σmin'), value: fmt(calc.k2, 6), hint: L('cond(A) en Matlab/Scilab', 'cond(A) in Matlab/Scilab') },
              { label: 'det(A)', value: fmt(calc.det) },
            ]}
          />
          <Alert kind={calc.kInf <= 50 ? 'ok' : calc.kInf < 1e3 ? 'info' : 'warn'}>
            {calc.kInf <= 50
              ? L(
                  'κ(A) es pequeño (del orden de 10): el sistema está bien condicionado; pequeños errores en los datos tienen un efecto pequeño en la solución.',
                  'κ(A) is small (of the order of 10): the system is well-conditioned; small errors in the data have a small effect on the solution.',
                )
              : calc.kInf < 1e3
                ? L('Condicionamiento moderado: se pierden algunas cifras significativas.', 'Moderate conditioning: a few significant digits are lost.')
                : calc.kInf < 1e14
                  ? L(
                      'κ(A) es grande: el sistema está mal condicionado (inestable); pequeños errores en A o b producen grandes cambios en x.',
                      'κ(A) is large: the system is ill-conditioned (unstable); small errors in A or b produce large changes in x.',
                    )
                  : L('Matriz numéricamente singular en precisión doble (κ ≈ 1/ε_máq).', 'Numerically singular matrix in double precision (κ ≈ 1/ε_mach).')}{' '}
            {L(
              <>Con doble precisión (≈ 16 cifras) se esperan ≈ {Math.max(0, 16 - Math.log10(calc.kInf)).toFixed(0)} cifras correctas en x.</>,
              <>In double precision (≈ 16 digits) about {Math.max(0, 16 - Math.log10(calc.kInf)).toFixed(0)} correct digits are expected in x.</>,
            )}
          </Alert>
          <Tabs
            tabs={[
              { label: L('Cálculo de κ', 'Computing κ'), content: <Card><Steps steps={condSteps(calc)} /></Card> },
              {
                label: L('Perturbación', 'Perturbation'),
                content: (
                  <Card>
                    <Steps
                      steps={[
                        { text: L('Solución del sistema original y del perturbado:', 'Solution of the original and the perturbed system:'), tex: `Ax = b \\Rightarrow x = ${texM(calc.x)},\\qquad A\\tilde x = b + \\delta b \\Rightarrow \\tilde x = ${texM(calc.xt)}` },
                        {
                          text:
                            calc.modo === 'ultimo'
                              ? L(`Perturbación aplicada (b${calc.b.length} → b${calc.b.length} + ε, como en el Ej. 3.4):`, `Applied perturbation (b${calc.b.length} → b${calc.b.length} + ε, as in Ex. 3.4):`)
                              : L('Perturbación aplicada:', 'Applied perturbation:'),
                          tex: `\\delta b = ${texM(calc.db)},\\qquad \\frac{\\|\\delta b\\|_\\infty}{\\|b\\|_\\infty} = ${N(calc.relB)}`,
                        },
                        {
                          text: L('Comparación con la cota teórica:', 'Comparison with the theoretical bound:'),
                          tex: `\\frac{\\|\\tilde x - x\\|_\\infty}{\\|x\\|_\\infty} = ${N(calc.relX)} \\;\\le\\; \\kappa_\\infty(A)\\frac{\\|\\delta b\\|_\\infty}{\\|b\\|_\\infty} = ${N(calc.kInf)}\\cdot ${N(calc.relB)} = ${N(calc.kInf * calc.relB)}`,
                        },
                        { text: L(`Factor de amplificación observado: ${fmt(calc.relX / calc.relB, 5)} (máximo posible: κ∞ = ${fmt(calc.kInf, 5)}).`, `Observed amplification factor: ${fmt(calc.relX / calc.relB, 5)} (largest possible: κ∞ = ${fmt(calc.kInf, 5)}).`) },
                      ]}
                    />
                  </Card>
                ),
              },
              { label: 'Hilbert Hₙ', content: <Card><HilbertPlot /></Card> },
            ]}
          />
          <ScilabCode code={scilabCond(calc.A, calc.b, calc.eps, calc.modo)} filename="condicion" />
        </>
      )}
    </MethodPage>
  )
}

interface C {
  A: A.Mat
  inv: A.Mat
  nA: number
  nI: number
  n1A: number
  n1I: number
  kInf: number
  k1: number
  k2: number
  sv: { max: number; min: number } | null
  det: number
}

function condSteps(c: C): { text?: string; tex?: string }[] {
  const rowSums = (M: A.Mat) => M.map((r) => r.reduce((s, v) => s + Math.abs(v), 0))
  const n = c.A.length
  const small = n <= 6
  return [
    {
      text: L('Norma infinito de A (máxima suma absoluta por filas):', 'Infinity norm of A (maximum absolute row sum):'),
      tex: small
        ? `\\|A\\|_\\infty = \\max\\{${c.A.map((r) => r.map((v) => N(Math.abs(v), 5)).join('+')).join(',\\; ')}\\} = \\max\\{${rowSums(c.A).map((v) => N(v, 6)).join(',\\,')}\\} = ${N(c.nA)}`
        : `\\|A\\|_\\infty = ${N(c.nA)}`,
    },
    { text: L('Inversa de A (Gauss-Jordan / LU):', 'Inverse of A (Gauss–Jordan / LU):'), tex: `A^{-1} = ${texM(c.inv, 6)}` },
    { text: L('Norma infinito de la inversa:', 'Infinity norm of the inverse:'), tex: `\\|A^{-1}\\|_\\infty = \\max\\{${rowSums(c.inv).map((v) => N(v, 6)).join(',\\,')}\\} = ${N(c.nI)}` },
    { text: L('Número de condición en norma ∞:', 'Condition number in the ∞-norm:'), tex: `\\kappa_\\infty(A) = \\|A\\|_\\infty\\,\\|A^{-1}\\|_\\infty = ${N(c.nA)}\\cdot ${N(c.nI)} = ${N(c.kInf)}` },
    { text: L('En norma 1 (máxima suma por columnas):', 'In the 1-norm (maximum column sum):'), tex: `\\kappa_1(A) = \\|A\\|_1\\,\\|A^{-1}\\|_1 = ${N(c.n1A)}\\cdot ${N(c.n1I)} = ${N(c.k1)}` },
    ...(c.sv
      ? [{ text: L('En norma 2 (valores singulares = √ valores propios de AᵀA):', 'In the 2-norm (singular values = √ eigenvalues of AᵀA):'), tex: `\\kappa_2(A) = \\frac{\\sigma_{\\max}}{\\sigma_{\\min}} = \\frac{${N(c.sv.max)}}{${N(c.sv.min)}} = ${N(c.k2)}` }]
      : []),
    { text: L('Cifras significativas que se pueden perder:', 'Significant digits that may be lost:'), tex: `\\log_{10}\\kappa_\\infty(A) \\approx ${N(Math.log10(c.kInf), 3)}` },
  ]
}

function HilbertPlot() {
  const data = useMemo(() => {
    const ns = Array.from({ length: 11 }, (_, i) => i + 2)
    const ks = ns.map((n) => {
      const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => 1 / (i + j + 1)))
      const inv = A.inverse(H)
      return inv ? A.normInfM(H) * A.normInfM(inv) : null
    })
    return [{ x: ns, y: ks, type: 'scatter', mode: 'lines+markers', name: 'κ∞(Hₙ)', line: { color: SERIES[0], width: 2.5 } }]
  }, [])
  return (
    <>
      <Tex block>{'H_n = \\left[\\frac{1}{i+j-1}\\right]_{i,j=1}^{n}'}</Tex>
      <Plot data={data} layout={{ xaxis: { title: { text: 'n' }, dtick: 1 }, yaxis: { type: 'log', exponentformat: 'power', title: { text: 'κ∞(Hₙ)' } } }} />
      <Note>
        {L(
          'La matriz de Hilbert es el ejemplo clásico de mal condicionamiento: κ crece exponencialmente (≈ e^(3.5n)). Con n ≈ 12 ya se pierden todas las cifras en doble precisión.',
          'The Hilbert matrix is the classic example of ill-conditioning: κ grows exponentially (≈ e^(3.5n)). By n ≈ 12 all digits are already lost in double precision.',
        )}
      </Note>
    </>
  )
}

function scilabCond(Am: A.Mat, b: A.Vec, eps: number, modo: S['modo']): string {
  return `// ${L('Número de condición y sensibilidad de Ax = b — generado por NumLab', 'Condition number and sensitivity of Ax = b — generated by NumLab')}
clear; clc;
A = ${sciMat(Am)};
b = ${sciVec(b)};
Ainv = inv(A);
disp('A^-1 ='); disp(Ainv);
mprintf('det(A)          = %e\\n', det(A));
mprintf('||A||inf        = %f\\n', norm(A, 'inf'));
mprintf('||A^-1||inf     = %f\\n', norm(Ainv, 'inf'));
mprintf('cond_inf(A)     = %e\\n', norm(A, 'inf') * norm(Ainv, 'inf'));
mprintf('cond_1(A)       = %e\\n', norm(A, 1) * norm(Ainv, 1));
mprintf('cond_2(A)       = %e   (${L('cond(A) de Scilab', 'Scilab cond(A)')})\\n', cond(A));
mprintf('rcond(A)        = %e   (${L('estimación de 1/cond_1', 'estimate of 1/cond_1')})\\n', rcond(A));
// ${L('Experimento de perturbación', 'Perturbation experiment')}
x = A \\ b;
n = size(b, 1);
${modo === 'ultimo' ? `db = zeros(n, 1); db(n) = ${eps};       // ${L('sólo la última ecuación (Ej. 3.4)', 'only the last equation (Ex. 3.4)')}` : `db = ${eps} * norm(b, %inf) * ((-1) .^ (0:n-1))';`}
xt = A \\ (b + db);
relb = norm(db, %inf) / norm(b, %inf);
relx = norm(xt - x, %inf) / norm(x, %inf);
mprintf('${L('Error relativo en b', 'Relative error in b')}: %e\\n', relb);
mprintf('${L('Error relativo en x: %e  (cota: %e)', 'Relative error in x: %e  (bound: %e)')}\\n', relx, norm(A, 'inf') * norm(Ainv, 'inf') * relb);
`
}
