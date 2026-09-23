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

interface S {
  A: string
  b: string
  eps: string
  /** 'ultimo': sólo se perturba bₙ (como en el Ej. 3.4); 'alternada': δbᵢ = ±ε‖b‖∞ */
  modo: 'ultimo' | 'alternada'
}

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: 'Ej. 3.4', value: { A: '0.9999 -1.0001\n1 -1', b: '1 1', eps: '1e-4', modo: 'ultimo' } },
  { label: 'Práct. 05 (Hilbert 4)', value: { A: '1 1/2 1/3 1/4\n1/2 1/3 1/4 1/5\n1/3 1/4 1/5 1/6\n1/4 1/5 1/6 1/7', b: '1 2 3 4', eps: '1e-4', modo: 'alternada' } },
  { label: 'Bien condicionada', value: { A: '4 1 0\n1 4 1\n0 1 4', b: '5 6 5', modo: 'alternada' } },
  { label: 'Rectas casi paralelas', value: { A: '1 1\n1 1.0001', b: '2 2.0001', modo: 'ultimo' } },
  { label: 'Hilbert 6', value: { A: '1 1/2 1/3 1/4 1/5 1/6\n1/2 1/3 1/4 1/5 1/6 1/7\n1/3 1/4 1/5 1/6 1/7 1/8\n1/4 1/5 1/6 1/7 1/8 1/9\n1/5 1/6 1/7 1/8 1/9 1/10\n1/6 1/7 1/8 1/9 1/10 1/11', b: '1 1 1 1 1 1', modo: 'alternada' } },
  { label: 'det pequeño, κ = 1', value: { A: '0.1 0 0\n0 0.1 0\n0 0 0.1', b: '1 1 1', modo: 'alternada' } },
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
    if (!Number.isFinite(eps)) return { error: 'Perturbación inválida.' }
    const inv = A.inverse(sys.A)
    const det = A.det(sys.A)
    if (!inv) return { error: `A es singular (det A = ${fmt(det)}): A⁻¹ no existe y κ(A) = ∞.` }
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
      <MatrixField label="Matriz A" value={s.A} onChange={(A) => set({ A })} rows={4} />
      <VectorField label="Vector b (para el experimento de perturbación)" value={s.b} onChange={(b) => set({ b })} />
      <NumField label="Perturbación ε" value={s.eps} onChange={(eps) => set({ eps })} />
      <SelectField
        label="Cómo se perturba b"
        value={s.modo}
        onChange={(modo) => set({ modo })}
        options={[
          { value: 'ultimo', label: 'Sólo la última ecuación: bₙ + ε (como en el Ej. 3.4)' },
          { value: 'alternada', label: 'Todas: δbᵢ = ±ε‖b‖∞ con signos alternados' },
        ]}
      />
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.condicion} topic={TOPIC} theory={THEORY.condicion} description="Estabilidad de Ax = b (texto, §3.4): normas de matriz, inversa y número de condición κ(A) = ‖A‖‖A⁻¹‖." inputs={inputs}>
      {'error' in calc ? (
        <Alert kind="error">{calc.error}</Alert>
      ) : (
        <>
          <Stats
            items={[
              { label: 'κ∞(A)', value: fmt(calc.kInf, 6), accent: true, hint: `≈ ${Math.max(0, Math.log10(calc.kInf)).toFixed(1)} cifras decimales perdidas` },
              { label: 'κ₁(A)', value: fmt(calc.k1, 6) },
              { label: 'κ₂(A) = σmáx/σmín', value: fmt(calc.k2, 6), hint: 'cond(A) en Matlab/Scilab' },
              { label: 'det(A)', value: fmt(calc.det) },
            ]}
          />
          <Alert kind={calc.kInf <= 50 ? 'ok' : calc.kInf < 1e3 ? 'info' : 'warn'}>
            {calc.kInf <= 50
              ? 'κ(A) es pequeño (del orden de 10): el sistema está bien condicionado; pequeños errores en los datos tienen un efecto pequeño en la solución.'
              : calc.kInf < 1e3
                ? 'Condicionamiento moderado: se pierden algunas cifras significativas.'
                : calc.kInf < 1e14
                  ? 'κ(A) es grande: el sistema está mal condicionado (inestable); pequeños errores en A o b producen grandes cambios en x.'
                  : 'Matriz numéricamente singular en precisión doble (κ ≈ 1/ε_máq).'}{' '}
            Con doble precisión (≈ 16 cifras) se esperan ≈ {Math.max(0, 16 - Math.log10(calc.kInf)).toFixed(0)} cifras correctas en x.
          </Alert>
          <Tabs
            tabs={[
              { label: 'Cálculo de κ', content: <Card><Steps steps={condSteps(calc)} /></Card> },
              {
                label: 'Perturbación',
                content: (
                  <Card>
                    <Steps
                      steps={[
                        { text: 'Solución del sistema original y del perturbado:', tex: `Ax = b \\Rightarrow x = ${texM(calc.x)},\\qquad A\\tilde x = b + \\delta b \\Rightarrow \\tilde x = ${texM(calc.xt)}` },
                        { text: calc.modo === 'ultimo' ? `Perturbación aplicada (b${calc.b.length} → b${calc.b.length} + ε, como en el Ej. 3.4):` : 'Perturbación aplicada:', tex: `\\delta b = ${texM(calc.db)},\\qquad \\frac{\\|\\delta b\\|_\\infty}{\\|b\\|_\\infty} = ${N(calc.relB)}` },
                        {
                          text: 'Comparación con la cota teórica:',
                          tex: `\\frac{\\|\\tilde x - x\\|_\\infty}{\\|x\\|_\\infty} = ${N(calc.relX)} \\;\\le\\; \\kappa_\\infty(A)\\frac{\\|\\delta b\\|_\\infty}{\\|b\\|_\\infty} = ${N(calc.kInf)}\\cdot ${N(calc.relB)} = ${N(calc.kInf * calc.relB)}`,
                        },
                        { text: `Factor de amplificación observado: ${fmt(calc.relX / calc.relB, 5)} (máximo posible: κ∞ = ${fmt(calc.kInf, 5)}).` },
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
      text: 'Norma infinito de A (máxima suma absoluta por filas):',
      tex: small
        ? `\\|A\\|_\\infty = \\max\\{${c.A.map((r) => r.map((v) => N(Math.abs(v), 5)).join('+')).join(',\\; ')}\\} = \\max\\{${rowSums(c.A).map((v) => N(v, 6)).join(',\\,')}\\} = ${N(c.nA)}`
        : `\\|A\\|_\\infty = ${N(c.nA)}`,
    },
    { text: 'Inversa de A (Gauss-Jordan / LU):', tex: `A^{-1} = ${texM(c.inv, 6)}` },
    { text: 'Norma infinito de la inversa:', tex: `\\|A^{-1}\\|_\\infty = \\max\\{${rowSums(c.inv).map((v) => N(v, 6)).join(',\\,')}\\} = ${N(c.nI)}` },
    { text: 'Número de condición en norma ∞:', tex: `\\kappa_\\infty(A) = \\|A\\|_\\infty\\,\\|A^{-1}\\|_\\infty = ${N(c.nA)}\\cdot ${N(c.nI)} = ${N(c.kInf)}` },
    { text: 'En norma 1 (máxima suma por columnas):', tex: `\\kappa_1(A) = \\|A\\|_1\\,\\|A^{-1}\\|_1 = ${N(c.n1A)}\\cdot ${N(c.n1I)} = ${N(c.k1)}` },
    ...(c.sv
      ? [{ text: 'En norma 2 (valores singulares = √ valores propios de AᵀA):', tex: `\\kappa_2(A) = \\frac{\\sigma_{\\max}}{\\sigma_{\\min}} = \\frac{${N(c.sv.max)}}{${N(c.sv.min)}} = ${N(c.k2)}` }]
      : []),
    { text: 'Cifras significativas que se pueden perder:', tex: `\\log_{10}\\kappa_\\infty(A) \\approx ${N(Math.log10(c.kInf), 3)}` },
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
      <Note>La matriz de Hilbert es el ejemplo clásico de mal condicionamiento: κ crece exponencialmente (≈ e^(3.5n)). Con n ≈ 12 ya se pierden todas las cifras en doble precisión.</Note>
    </>
  )
}

function scilabCond(Am: A.Mat, b: A.Vec, eps: number, modo: S['modo']): string {
  return `// Número de condición y sensibilidad de Ax = b — generado por NumLab
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
mprintf('cond_2(A)       = %e   (cond(A) de Scilab)\\n', cond(A));
mprintf('rcond(A)        = %e   (estimación de 1/cond_1)\\n', rcond(A));
// Experimento de perturbación
x = A \\ b;
n = size(b, 1);
${modo === 'ultimo' ? `db = zeros(n, 1); db(n) = ${eps};       // sólo la última ecuación (Ej. 3.4)` : `db = ${eps} * norm(b, %inf) * ((-1) .^ (0:n-1))';`}
xt = A \\ (b + db);
relb = norm(db, %inf) / norm(b, %inf);
relx = norm(xt - x, %inf) / norm(x, %inf);
mprintf('Error relativo en b: %e\\n', relb);
mprintf('Error relativo en x: %e  (cota: %e)\\n', relx, norm(A, 'inf') * norm(Ainv, 'inf') * relb);
`
}
