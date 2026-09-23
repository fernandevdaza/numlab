import { useMemo } from 'react'
import { compile, evalNumber, toScilab, type Compiled } from '../../lib/expr'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Tex } from '../../components/Tex'
import { Alert, Examples, IntField, MethodPage, parseVector, SelectField, VectorField } from '../../components/ui'
import * as A from './algorithms'
import { compileOde, sciOf, sysNames, sysTex, xToT, type Naming } from './sym'
import { MeshFields, methodIntro, OdeField, sciSysBody, sciSystemTail, solveSystem, SYS_METHODS, sysMethodName, SystemResults, type MeshState, type SysMethod, type SysSolve, type SysView } from './shared'
import { DESCRIPTIONS, THEORY, TITLES, TOPIC } from './theory'

export { SYS_METHODS, type SysMethod } from './shared'

interface State extends MeshState {
  n: number
  naming: Naming
  fs: string[]
  y0: string
  method: SysMethod
  exact: string
}

const EXAMPLES: { label: string; value: Partial<State> }[] = [
  {
    label: 'Ej. 6.8 · Euler modificado',
    value: { n: 2, naming: 'y', fs: ['y2 + t', 'y1 + 1'], y0: '1 0', t0: '0', tf: '0.1', mode: 'h', h: '0.05', method: 'heun', exact: '1.5exp(t) + 1.5exp(-t) - 2; 1.5exp(t) - 1.5exp(-t) - t' },
  },
  {
    label: 'Ej. 6.9 · Taylor 2',
    value: { n: 2, naming: 'y', fs: ['y2 + t', 'y1 + 1'], y0: '1 0', t0: '0', tf: '0.1', mode: 'h', h: '0.05', method: 'taylor2', exact: '1.5exp(t) + 1.5exp(-t) - 2; 1.5exp(t) - 1.5exp(-t) - t' },
  },
  {
    label: 'Práctica 4 · trapecio',
    value: { n: 2, naming: 'y', fs: ['3y1 + 2y2', '4y1 + y2'], y0: '0 1', t0: '0', tf: '0.3', mode: 'h', h: '0.1', method: 'heun', exact: '(exp(5t) - exp(-t))/3; (exp(5t) + 2exp(-t))/3' },
  },
  {
    label: 'Burden: circuito (con exacta)',
    value: { n: 2, naming: 'y', fs: ['-4y1 + 3y2 + 6', '-2.4y1 + 1.6y2 + 3.6'], y0: '0 0', t0: '0', tf: '0.5', mode: 'h', h: '0.1', method: 'rk4', exact: '-3.375exp(-2t) + 1.875exp(-0.4t) + 1.5; -2.25exp(-2t) + 2.25exp(-0.4t)' },
  },
  { label: 'Lotka-Volterra', value: { n: 2, naming: 'xyz', fs: ['1.1x - 0.4x*y', '0.1x*y - 0.4y'], y0: '10 5', t0: '0', tf: '50', mode: 'h', h: '0.05', method: 'rk4', exact: '' } },
  { label: 'Oscilador armónico', value: { n: 2, naming: 'xyz', fs: ['y', '-x'], y0: '1 0', t0: '0', tf: '20', mode: 'h', h: '0.1', method: 'euler', exact: 'cos(t); -sin(t)' } },
  { label: 'Lorenz (caos)', value: { n: 3, naming: 'xyz', fs: ['10(y - x)', 'x*(28 - z) - y', 'x*y - 8/3*z'], y0: '1 1 1', t0: '0', tf: '40', mode: 'h', h: '0.005', method: 'rk4', exact: '' } },
  { label: 'Rössler', value: { n: 3, naming: 'xyz', fs: ['-y - z', 'x + 0.2y', '0.2 + z*(x - 5.7)'], y0: '1 1 1', t0: '0', tf: '150', mode: 'h', h: '0.02', method: 'rk4', exact: '' } },
  { label: 'Epidemia SIR', value: { n: 3, naming: 'xyz', fs: ['-0.5x*y', '0.5x*y - 0.1y', '0.1y'], y0: '0.99 0.01 0', t0: '0', tf: '100', mode: 'h', h: '0.5', method: 'rk4', exact: '' } },
]

export function Sistemas() {
  const [s, setS] = useLocalState<State>('edo:sistemas-edo', { ...(EXAMPLES[4].value as State), N: 100 })
  const set = (p: Partial<State>) => setS((prev) => ({ ...prev, ...p }))
  const d = useDebounced(s, 250)
  const names = sysNames(s.n, s.naming)
  const vars = ['t', ...names]
  const texNames = Object.fromEntries(vars.map((v) => [v, sysTex(v)]))
  const calc = useMemo(() => compute(d), [d])

  const inputs = (
    <>
      <IntField label="Número de ecuaciones n" value={s.n} onChange={(n) => set({ n, fs: Array.from({ length: n }, (_, i) => s.fs[i] ?? '0') })} min={1} max={6} />
      <SelectField
        label="Nombres de las incógnitas"
        value={s.naming}
        onChange={(naming) => set({ naming })}
        options={[
          { value: 'xyz', label: 'x, y, z, w, u, v' },
          { value: 'y', label: 'y1, y2, …, yn' },
        ]}
        hint={<>Variables permitidas: <span className="mono">t, {names.join(', ')}</span>{s.naming === 'y' ? ' (puedes escribir x en lugar de t, como en el texto)' : ''}</>}
      />
      <div className="edo-eqs">
        {names.map((nm, i) => (
          <OdeField
            key={i + nm}
            label={<Tex>{`${sysTex(nm)}' = f_{${i + 1}}(t, ${names.map(sysTex).join(', ')})`}</Tex>}
            value={s.fs[i] ?? ''}
            onChange={(v) => set({ fs: names.map((_, j) => (j === i ? v : s.fs[j] ?? '0')) })}
            vars={s.naming === 'y' ? [...vars, 'x'] : vars}
            names={texNames}
            texPrefix={`${sysTex(nm)}' =`}
          />
        ))}
      </div>
      <VectorField label={<>Condición inicial <Tex>{`(${names.map((x) => sysTex(x) + '_0').join(', ')})`}</Tex></>} value={s.y0} onChange={(y0) => set({ y0 })} hint="Valores separados por espacios o comas" />
      <MeshFields s={s} set={set} />
      <SelectField label="Método" value={s.method} onChange={(method) => set({ method })} options={SYS_METHODS} />
      <label className="field">
        <span className="field-label">Solución exacta (opcional)</span>
        <input className="input mono" value={s.exact} spellCheck={false} placeholder="expr₁(t); expr₂(t); …" onChange={(e) => set({ exact: e.target.value })} />
        <span className="field-hint">Una expresión en t por componente, separadas por “;”</span>
      </label>
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES['sistemas-edo']} topic={TOPIC} description={DESCRIPTIONS['sistemas-edo']} theory={THEORY['sistemas-edo']} inputs={inputs}>
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <SystemResults key={calc.names.join(',')} {...calc.view} />}
    </MethodPage>
  )
}

export function compute(s: State): { error: string } | { view: SysView; names: string[] } {
  const n = Math.max(1, Math.min(6, s.n))
  const names = sysNames(n, s.naming)
  const vars = ['t', ...names]
  const cs: Compiled[] = []
  const alias = (src: string) => (s.naming === 'y' ? xToT(src) : src)
  for (let i = 0; i < n; i++) {
    const c = compileOde(alias(s.fs[i] ?? ''), vars)
    if (!c.ok) return { error: `Ecuación ${i + 1} (${names[i]}′): ${c.error}` }
    cs.push(c)
  }
  const y0 = parseVector(s.y0)
  if (!y0) return { error: 'Condición inicial inválida.' }
  if (y0.length !== n) return { error: `La condición inicial debe tener ${n} valores (tiene ${y0.length}).` }
  const t0 = evalNumber(s.t0), tf = evalNumber(s.tf)
  const m = A.mesh(t0, tf, s.mode, evalNumber(s.h), s.N)
  if (m.error) return { error: m.error }
  const warn: string[] = m.warn ? [m.warn] : []
  let exact: ((t: number) => number)[] | null = null
  if (s.exact.trim()) {
    const parts = s.exact.split(';').map((p) => p.trim()).filter(Boolean)
    const ec = parts.map((p) => compile(xToT(p), ['t']))
    const bad = ec.find((e) => !e.ok)
    if (bad && !bad.ok) warn.push('Solución exacta ignorada: ' + bad.error)
    else if (ec.length !== n) warn.push(`Solución exacta ignorada: se esperaban ${n} expresiones separadas por “;”.`)
    else exact = ec.map((e) => (e as Compiled).f)
  }
  const F: A.OdeFn = (t, y) => cs.map((c) => c.f(t, ...y))
  const method: SysMethod = SYS_METHODS.some((o) => o.value === s.method) ? s.method : 'rk4'
  const nodes = cs.map((c) => c.node)
  const sol = solveSystem(method, F, nodes, names, t0, y0, m.h, m.N)
  if (sol.error) return { error: sol.error }
  const texNames = Object.fromEntries(vars.map((v) => [v, sysTex(v)]))
  return {
    names,
    view: {
      res: sol.res, tab: sol.tab, method, d2: sol.d2, h: m.h, nodes, vars: names,
      labels: names.map(sysTex), plain: names, exact,
      preSteps: methodIntro(method, sol.tab, sol.d2, texNames, n > 1),
      scilab: scilabSys(s, cs, names, method, sol, m.N, y0, exact ? s.exact : ''),
      filename: 'edo_sistema', warn: warn.join(' '),
      phase: [0, Math.min(1, n - 1), Math.min(2, n - 1)],
    },
  }
}

function scilabSys(s: State, cs: Compiled[], names: string[], method: SysMethod, sol: SysSolve, N: number, y0: number[], exact: string): string {
  const n = names.length
  const rename = Object.fromEntries(names.map((v, i) => [v, `Y(${i + 1})`]))
  let code = `// Sistema de EDO de primer orden — ${sysMethodName(method)} — generado por NumLab\n// Convención: Y = [${names.join('; ')}]\nclear; clc;\n\nfunction dY = F(t, Y)\n  dY = zeros(${n}, 1);\n`
  cs.forEach((c, i) => (code += `  dY(${i + 1}) = ${sciOf(c.node, rename)};   // ${names[i]}'\n`))
  code += `endfunction\n`
  if (sol.d2) {
    code += `\nfunction d = D2(t, Y)   // Y'' = dF/dt + J*F\n  d = zeros(${n}, 1);\n`
    sol.d2.forEach((d, i) => (code += `  d(${i + 1}) = ${sciOf(d, rename)};\n`))
    code += `endfunction\n`
  }
  code += `\nt0 = ${toScilab(s.t0, false)}; tf = ${toScilab(s.tf, false)};\nN = ${N}; h = (tf - t0)/N;\nt = t0 + (0:N)*h;\nW = zeros(${n}, N+1);\nW(:,1) = [${y0.join('; ')}];\n\nfor i = 1:N\n`
  code += sciSysBody(method, sol.tab, true, 'F') + `\nend\n`
  code += sciSystemTail(n, names)
  if (exact) {
    const ex = exact.split(';').map((p) => `(${toScilab(p.trim(), true)}) + 0*t`)
    code += `\n// Error respecto a la solución exacta (evaluada en toda la malla)\nYex = [${ex.join('; ')}];\nmprintf('Error máximo (norma inf): %e\\n', max(abs(Yex - W)));\n`
  }
  return code
}
