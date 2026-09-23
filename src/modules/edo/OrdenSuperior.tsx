import { useMemo } from 'react'
import type { MathNode } from 'mathjs'
import { compile, compileDerivative, evalNumber, math, toScilab, type Compiled } from '../../lib/expr'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Tex } from '../../components/Tex'
import { Alert, Card, Examples, ExprField, IntField, MethodPage, parseVector, SelectField, Steps, VectorField } from '../../components/ui'
import * as A from './algorithms'
import { compileOde, derivName, derivTex, sciOf, texOf, tn, xToT } from './sym'
import { MeshFields, methodIntro, OdeField, sciSysBody, sciSystemTail, solveSystem, SYS_METHODS, sysMethodName, SystemResults, vecTex, type MeshState, type Step, type SysMethod, type SysSolve, type SysView } from './shared'
import { DESCRIPTIONS, THEORY, TITLES, TOPIC } from './theory'
import { L } from '../../i18n'

interface Eq {
  order: number
  f: string
  ics: string
}
interface State extends MeshState {
  neq: number
  eqs: Eq[]
  method: SysMethod
  exact: string
}

const VARS1 = ['y']
const VARSN = ['x', 'y', 'z']
const varNames = (neq: number) => (neq === 1 ? VARS1 : VARSN.slice(0, neq))

const EXAMPLES: { label: string; value: Partial<State> }[] = [
  { label: L('Ej. 6.10 · tercer orden, RK2', 'Ex. 6.10 · third order, RK2'), value: { neq: 1, eqs: [{ order: 3, f: "y'' + y' - y + t", ics: '0 1 -1' }], t0: '0', tf: '0.1', mode: 'h', h: '0.05', method: 'ralston', exact: '-0.5exp(t) - 0.5exp(-t) + t + 1' } },
  { label: L('Práctica 5 · RK2 / RK4', 'Practice 5 · RK2 / RK4'), value: { neq: 1, eqs: [{ order: 3, f: "t + 1 - 2y'' + y' + 2y", ics: '3/4 -1/2 1' }], t0: '0', tf: '0.15', mode: 'h', h: '0.05', method: 'ralston', exact: 'cosh(t) - t/2 - 1/4' } },
  { label: L('Práctica 7 · masa-resorte, punto medio', 'Practice 7 · mass-spring, midpoint'), value: { neq: 1, eqs: [{ order: 2, f: "(50sin(0.5t) - 0.2y' - 200y)/1.2", ics: '0.2 0' }], t0: '0', tf: '0.1', mode: 'h', h: '0.05', method: 'pm2', exact: '' } },
  { label: L('Práctica 8 · circuito, Taylor 2', 'Practice 8 · circuit, Taylor 2'), value: { neq: 1, eqs: [{ order: 2, f: "(24sin(10t) - 6y' - 50y)/0.5", ics: '0 0.1' }], t0: '0', tf: '0.1', mode: 'h', h: '0.05', method: 'taylor2', exact: '' } },
  { label: L('Burden: y″ − 2y′ + 2y = e²ᵗ sen t', 'Burden: y″ − 2y′ + 2y = e²ᵗ sin t'), value: { neq: 1, eqs: [{ order: 2, f: "exp(2t)*sin(t) + 2y' - 2y", ics: '-0.4 -0.6' }], t0: '0', tf: '1', mode: 'h', h: '0.1', method: 'rk4', exact: '0.2exp(2t)*(sin(t) - 2cos(t))' } },
  { label: L('Oscilador amortiguado', 'Damped oscillator'), value: { neq: 1, eqs: [{ order: 2, f: "-0.8y' - 4y", ics: '1 0' }], t0: '0', tf: '10', mode: 'h', h: '0.1', method: 'rk4', exact: 'exp(-0.4t)*(cos(sqrt(3.84)*t) + 0.4/sqrt(3.84)*sin(sqrt(3.84)*t))' } },
  { label: L('Péndulo no lineal', 'Nonlinear pendulum'), value: { neq: 1, eqs: [{ order: 2, f: '-9.81/1*sin(y)', ics: 'pi/4 0' }], t0: '0', tf: '10', mode: 'h', h: '0.05', method: 'rk4', exact: '' } },
  { label: 'Van der Pol (μ = 2)', value: { neq: 1, eqs: [{ order: 2, f: "2(1 - y^2)*y' - y", ics: '2 0' }], t0: '0', tf: '30', mode: 'h', h: '0.02', method: 'rk4', exact: '' } },
  { label: L('Tercer orden: y‴ = y', 'Third order: y‴ = y'), value: { neq: 1, eqs: [{ order: 3, f: 'y', ics: '1 1 1' }], t0: '0', tf: '2', mode: 'h', h: '0.2', method: 'rk4', exact: 'exp(t)' } },
  { label: L('Kepler: órbita (2 ec. de orden 2)', 'Kepler: orbit (2 second-order eqs.)'), value: { neq: 2, eqs: [{ order: 2, f: '-x/(x^2 + y^2)^(3/2)', ics: '1 0' }, { order: 2, f: '-y/(x^2 + y^2)^(3/2)', ics: '0 1.2' }], t0: '0', tf: '20', mode: 'h', h: '0.02', method: 'rk4', exact: '' } },
  { label: L('Masas-resortes acopladas', 'Coupled mass-spring system'), value: { neq: 2, eqs: [{ order: 2, f: '-2x + y', ics: '1 0' }, { order: 2, f: 'x - 2y', ics: '0 0' }], t0: '0', tf: '30', mode: 'h', h: '0.05', method: 'rk4', exact: '' } },
]

export function OrdenSuperior() {
  const [s, setS] = useLocalState<State>('edo:orden-superior', { ...(EXAMPLES[5].value as State), N: 100 })
  const set = (p: Partial<State>) => setS((prev) => ({ ...prev, ...p }))
  const d = useDebounced(s, 250)
  const names = varNames(s.neq)
  const calc = useMemo(() => compute(d), [d])

  const setEq = (i: number, p: Partial<Eq>) => set({ eqs: s.eqs.map((e, j) => (j === i ? { ...e, ...p } : e)) })
  const allowed = names.flatMap((v, i) => Array.from({ length: s.eqs[i]?.order ?? 1 }, (_, k) => derivName(v, k)))
  const texNames: Record<string, string> = { t: 't' }
  names.forEach((v, i) => Array.from({ length: s.eqs[i]?.order ?? 1 }, (_, k) => (texNames[derivName(v, k)] = derivTex(v, k))))
  const allowedTxt = names.flatMap((v, i) => Array.from({ length: s.eqs[i]?.order ?? 1 }, (_, k) => v + "'".repeat(k))).join(', ')

  const inputs = (
    <>
      <IntField
        label={L('Número de ecuaciones', 'Number of equations')}
        value={s.neq}
        onChange={(neq) => set({ neq, eqs: Array.from({ length: neq }, (_, i) => s.eqs[i] ?? { order: 2, f: '0', ics: '0 0' }) })}
        min={1}
        max={3}
        hint={s.neq === 1 ? L('Incógnita: y(t)', 'Unknown: y(t)') : `${L('Incógnitas', 'Unknowns')}: ${names.join(', ')}`}
      />
      <div className="edo-eqs">
        {names.map((v, i) => {
          const e = s.eqs[i] ?? { order: 2, f: '0', ics: '0 0' }
          return (
            <div className="edo-eq" key={i}>
              {s.neq > 1 && <div className="edo-eq-head">{L('Ecuación', 'Equation')} {i + 1}</div>}
              <IntField label={L(`Orden de la ecuación en ${v}`, `Order of the equation in ${v}`)} value={e.order} onChange={(order) => setEq(i, { order })} min={1} max={6} />
              <OdeField
                label={<Tex>{`${derivTex(v, e.order)} = f(t, \\dots)`}</Tex>}
                value={e.f}
                onChange={(f) => setEq(i, { f })}
                vars={s.neq === 1 ? ['t', 'x', ...allowed] : ['t', ...allowed]}
                names={texNames}
                texPrefix={`${derivTex(v, e.order)} =`}
                hint={L(<>Puedes usar t, {allowedTxt} (también dy, d2y…)</>, <>You may use t, {allowedTxt} (also dy, d2y…)</>)}
              />
              <VectorField label={<>{L('Condiciones iniciales', 'Initial conditions')} <Tex>{Array.from({ length: e.order }, (_, k) => derivTex(v, k) + '(t_0)').join(',\\,')}</Tex></>} value={e.ics} onChange={(ics) => setEq(i, { ics })} />
            </div>
          )
        })}
      </div>
      <MeshFields s={s} set={set} />
      <SelectField label={L('Método', 'Method')} value={s.method} onChange={(method) => set({ method })} options={SYS_METHODS} />
      {s.neq === 1 && (
        <ExprField
          label={L('Solución exacta y(t) (opcional)', 'Exact solution y(t) (optional)')}
          value={s.exact}
          onChange={(exact) => set({ exact })}
          vars={['t', 'x']}
          texPrefix="y(t) ="
          hint={L('Sus derivadas se calculan simbólicamente para medir el error de todas las componentes', 'Its derivatives are computed symbolically to measure the error of every component')}
        />
      )}
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES['orden-superior']} topic={TOPIC} description={DESCRIPTIONS['orden-superior']} theory={THEORY['orden-superior']} inputs={inputs}>
      {'error' in calc ? (
        <Alert kind="error">{calc.error}</Alert>
      ) : (
        <>
          <Card title={L('Reducción a un sistema de primer orden', 'Reduction to a first-order system')}>
            <Steps steps={calc.reduction} />
          </Card>
          <SystemResults key={calc.sig} {...calc.view} />
        </>
      )}
    </MethodPage>
  )
}

interface Comp {
  v: string
  k: number
  name: string
  tex: string
}

export function compute(s: State): { error: string } | { view: SysView; reduction: Step[]; sig: string } {
  const neq = Math.max(1, Math.min(3, s.neq))
  const names = varNames(neq)
  const eqs = names.map((_, i) => s.eqs[i] ?? { order: 2, f: '0', ics: '0 0' })
  if (eqs.some((e) => !(e.order >= 1 && e.order <= 6))) return { error: L('El orden de cada ecuación debe estar entre 1 y 6.', 'The order of each equation must be between 1 and 6.') }
  const comps: Comp[] = []
  names.forEach((v, i) => {
    for (let k = 0; k < eqs[i].order; k++) comps.push({ v, k, name: derivName(v, k), tex: derivTex(v, k) })
  })
  const vars = ['t', ...comps.map((c) => c.name)]
  const fs: Compiled[] = []
  for (let i = 0; i < neq; i++) {
    const c = compileOde(neq === 1 ? xToT(eqs[i].f) : eqs[i].f, vars)
    if (!c.ok) return { error: `${L('Ecuación', 'Equation')} ${i + 1}: ${c.error.replace(/\bd(\d?)([a-z])\b/g, (_m, k: string, v: string) => v + "'".repeat(Number(k || 1)))}` }
    fs.push(c)
  }
  const y0: number[] = []
  for (let i = 0; i < neq; i++) {
    const v = parseVector(eqs[i].ics)
    if (!v) return { error: L(`Condiciones iniciales de la ecuación ${i + 1} inválidas.`, `Invalid initial conditions for equation ${i + 1}.`) }
    if (v.length !== eqs[i].order) {
      const list = Array.from({ length: eqs[i].order }, (_, k) => names[i] + "'".repeat(k) + '(t₀)').join(', ')
      return {
        error: L(
          `La ecuación ${i + 1} es de orden ${eqs[i].order}: necesita ${eqs[i].order} condiciones iniciales (${list}); hay ${v.length}.`,
          `Equation ${i + 1} is of order ${eqs[i].order}: it needs ${eqs[i].order} initial conditions (${list}); there are ${v.length}.`,
        ),
      }
    }
    y0.push(...v)
  }
  const t0 = evalNumber(s.t0), tf = evalNumber(s.tf)
  const m = A.mesh(t0, tf, s.mode, evalNumber(s.h), s.N)
  if (m.error) return { error: m.error }

  // nodos del lado derecho del sistema reducido
  const nodes: MathNode[] = comps.map((c, j) => {
    const i = names.indexOf(c.v)
    return c.k < eqs[i].order - 1 ? math.parse(comps[j + 1].name) : fs[i].node
  })
  const cfs = nodes.map((n) => compile(n.toString(), vars))
  const fns = cfs.map((c) => (c.ok ? c.f : () => NaN))
  const F: A.OdeFn = (t, y) => fns.map((f) => f(t, ...y))
  const method: SysMethod = SYS_METHODS.some((o) => o.value === s.method) ? s.method : 'rk4'
  const sol = solveSystem(method, F, nodes, comps.map((c) => c.name), t0, y0, m.h, m.N)
  if (sol.error) return { error: sol.error }
  const res = sol.res

  // solución exacta y sus derivadas (sólo una ecuación)
  const warn: string[] = m.warn ? [m.warn] : []
  let exact: ((t: number) => number)[] | null = null
  if (neq === 1 && s.exact.trim()) {
    const e = compile(xToT(s.exact), ['t'])
    if (!e.ok) warn.push(L('Solución exacta ignorada: ', 'Exact solution ignored: ') + e.error)
    else {
      const ds = [e.f]
      for (let k = 1; k < eqs[0].order; k++) {
        const dk = compileDerivative(e, 't', k)
        if (dk.ok) ds.push(dk.f)
      }
      exact = ds.length === eqs[0].order ? ds : [e.f]
    }
  }

  // Reducción en TeX
  const nice: Record<string, string> = { t: 't' }
  comps.forEach((c) => (nice[c.name] = c.tex))
  const uName: Record<string, string> = { t: 't' }
  comps.forEach((c, j) => (uName[c.name] = `u_{${j + 1}}`))
  const reduction: Step[] = []
  reduction.push({
    text:
      neq === 1
        ? L(`Ecuación de orden ${eqs[0].order} con sus condiciones iniciales:`, `Equation of order ${eqs[0].order} with its initial conditions:`)
        : L('Sistema de ecuaciones de orden superior:', 'System of higher-order equations:'),
    tex:
      (neq === 1 ? '' : '\\begin{cases}') +
      names.map((v, i) => `${derivTex(v, eqs[i].order)} = ${texOf(fs[i].node, nice)}`).join('\\\\') +
      (neq === 1 ? '' : '\\end{cases}') +
      `\\qquad ${comps.map((c, j) => `${c.tex}(${tn(t0)}) = ${tn(y0[j])}`).join(',\\;')}`,
  })
  reduction.push({
    text: L(
      `Cambio de variables: una nueva incógnita por cada derivada de orden menor al de su ecuación (${comps.length} en total):`,
      `Change of variables: one new unknown for each derivative of lower order than its equation (${comps.length} in total):`,
    ),
    tex: comps.map((c, j) => `u_{${j + 1}} = ${c.tex}`).join(',\\qquad '),
  })
  reduction.push({
    text: L('Derivando cada nueva variable y usando la EDO para la derivada de mayor orden:', 'Differentiating each new variable and using the ODE for the highest-order derivative:'),
    tex:
      '\\begin{aligned}' +
      comps
        .map((c, j) => {
          const i = names.indexOf(c.v)
          const last = c.k === eqs[i].order - 1
          return `u_{${j + 1}}' &= ${derivTex(c.v, c.k + 1)} = ${last ? texOf(fs[i].node, uName) : `u_{${j + 2}}`}`
        })
        .join('\\\\') +
      '\\end{aligned}',
  })
  reduction.push({
    text: L('Sistema de primer orden en forma vectorial, listo para los métodos numéricos:', 'First-order system in vector form, ready for the numerical methods:'),
    tex: `\\mathbf U' = \\mathbf F(t, \\mathbf U) = \\begin{bmatrix}${nodes.map((n) => texOf(n, uName)).join('\\\\')}\\end{bmatrix},\\qquad \\mathbf U(${tn(t0)}) = ${vecTex(y0)}`,
  })

  const sig = comps.map((c) => c.name).join(',')
  const idx = (v: string, k: number) => comps.findIndex((c) => c.v === v && c.k === k)
  const phase: [number, number, number] =
    neq >= 2 ? [idx(names[0], 0), idx(names[1], 0), Math.max(0, neq >= 3 ? idx(names[2], 0) : Math.min(2, comps.length - 1))] : [0, Math.min(1, comps.length - 1), Math.min(2, comps.length - 1)]

  return {
    sig,
    reduction,
    view: {
      res, tab: sol.tab, method, d2: sol.d2, h: m.h, nodes, vars: comps.map((c) => c.name),
      preSteps: methodIntro(method, sol.tab, sol.d2, uName, comps.length > 1),
      labels: comps.map((c, j) => `u_{${j + 1}} = ${c.tex}`), plain: comps.map((c) => c.v + "'".repeat(c.k)),
      exact, warn: warn.join(' '), phase,
      filename: 'edo_orden_superior',
      scilab: scilabHO(s, comps, nodes, method, sol, m.N, y0, neq === 1 && exact ? s.exact : ''),
    },
  }
}

function scilabHO(s: State, comps: Comp[], nodes: MathNode[], method: SysMethod, sol: SysSolve, N: number, y0: number[], exact: string): string {
  const n = comps.length
  const rename = Object.fromEntries(comps.map((c, j) => [c.name, `U(${j + 1})`]))
  let code = `// ${L('Ecuación(es) de orden superior reducidas a sistema', 'Higher-order equation(s) reduced to a system')} — ${sysMethodName(method)} — ${L('generado por NumLab', 'generated by NumLab')}\n// ${L('Cambio de variables', 'Change of variables')}: ${comps.map((c, j) => `U(${j + 1}) = ${c.v}${"'".repeat(c.k)}`).join(', ')}\nclear; clc;\n\nfunction dU = F(t, U)\n  dU = zeros(${n}, 1);\n`
  nodes.forEach((nd, j) => (code += `  dU(${j + 1}) = ${sciOf(nd, rename)};\n`))
  code += `endfunction\n`
  if (sol.d2) {
    code += `\nfunction d = D2(t, U)   // U'' = dF/dt + J*F\n  d = zeros(${n}, 1);\n`
    sol.d2.forEach((d, j) => (code += `  d(${j + 1}) = ${sciOf(d, rename)};\n`))
    code += `endfunction\n`
  }
  code += `\nt0 = ${toScilab(s.t0, false)}; tf = ${toScilab(s.tf, false)};\nN = ${N}; h = (tf - t0)/N;\nt = t0 + (0:N)*h;\nW = zeros(${n}, N+1);\nW(:,1) = [${y0.join('; ')}];\n\nfor i = 1:N\n`
  code += sciSysBody(method, sol.tab, true, 'F') + `\nend\n`
  code += sciSystemTail(n, comps.map((c) => c.v + (c.k ? `d${c.k}` : '')))
  if (exact)
    code += `\n// ${L('Error en y respecto a la solución exacta', 'Error in y with respect to the exact solution')}\nyex = (${toScilab(exact, true)}) + 0*t;\nmprintf('${L('Error máximo en y', 'Maximum error in y')}: %e\\n', max(abs(yex - W(1,:))));\n`
  return code
}
