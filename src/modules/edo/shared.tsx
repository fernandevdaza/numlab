// Componentes y utilidades compartidas por las páginas del Tema 6.
import { useMemo, useState, type ReactNode } from 'react'
import type { MathNode } from 'mathjs'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, FieldRow, IntField, NumField, ScilabCode, SelectField, Stats, Steps, Tabs, type Column } from '../../components/ui'
import { fmt, fmtErr } from '../../lib/format'
import { compile, type Compiled } from '../../lib/expr'
import { puntoMedio2, rkSolve, TABLEAUS, taylorSolveVec, thinIdx, toFrac, type OdeFn, type OdeResult, type ScalarFn, type Tableau, type Vec } from './algorithms'
import { coefSci, coefTex, compileOde, secondDerivatives, substTex, texOf, tn, tp } from './sym'
import { L } from '../../i18n'
import './edo.css'

export type Step = { text?: ReactNode; tex?: string }

/* ───────────────────────── Campos ───────────────────────── */

/**
 * Campo de expresión para EDO: acepta primas (y', y'') y muestra la vista previa en TeX
 * con los nombres de variables bonitos (y1 → y₁, dy → y′).
 */
export function OdeField({ label, value, onChange, vars, names, texPrefix, hint, placeholder }: { label: ReactNode; value: string; onChange: (v: string) => void; vars: string[]; names?: Record<string, string>; texPrefix?: string; hint?: ReactNode; placeholder?: string }) {
  const res = useMemo(() => compileOde(value, vars), [value, vars.join(',')])
  const tex = useMemo(() => (res.ok ? texOf(res.node, names ?? Object.fromEntries(vars.map((v) => [v, v]))) : ''), [res, names])
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className={'input mono' + (res.ok || !value ? '' : ' invalid')} data-palette="expr" data-vars={vars.join(',')} value={value} placeholder={placeholder} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(e) => onChange(e.target.value)} />
      {res.ok ? (
        <span className="field-preview">
          <Tex>{(texPrefix ? texPrefix + ' ' : '') + tex}</Tex>
        </span>
      ) : value ? (
        <span className="field-error">{res.error}</span>
      ) : null}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export interface MeshState {
  t0: string
  tf: string
  mode: 'h' | 'N'
  h: string
  N: number
}

export function MeshFields<S extends MeshState>({ s, set }: { s: S; set: (p: Partial<MeshState>) => void }) {
  return (
    <>
      <FieldRow>
        <NumField label={<Tex>t_0</Tex>} value={s.t0} onChange={(t0) => set({ t0 })} />
        <NumField label={<Tex>t_f</Tex>} value={s.tf} onChange={(tf) => set({ tf })} />
      </FieldRow>
      <FieldRow>
        <SelectField
          label={L('Discretización', 'Discretization')}
          value={s.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'h', label: L('Paso h', 'Step size h') },
            { value: 'N', label: L('Nº de pasos N', 'Number of steps N') },
          ]}
        />
        {s.mode === 'h' ? <NumField label={L('Paso h', 'Step size h')} value={s.h} onChange={(h) => set({ h })} /> : <IntField label="N" value={s.N} onChange={(N) => set({ N })} min={1} max={100000} />}
      </FieldRow>
    </>
  )
}

/* ───────────────────────── TeX de un paso de Runge-Kutta ───────────────────────── */

export function vecTex(v: Vec, digits = 8): string {
  return '\\begin{bmatrix}' + v.map((x) => tn(x, digits)).join('\\\\') + '\\end{bmatrix}'
}
const lcm = (a: number, b: number): number => {
  const g = (x: number, y: number): number => (y ? g(y, x % y) : x)
  return (a * b) / g(a, b)
}

/** Combinación simbólica Σ c_l k_l en TeX (omite ceros). */
function combTex(cs: number[], bold: boolean): string {
  const K = (l: number) => (bold ? `\\mathbf k_{${l + 1}}` : `k_{${l + 1}}`)
  let out = ''
  cs.forEach((c, l) => {
    if (!c) return
    const neg = c < 0
    const a = Math.abs(c)
    const co = a === 1 ? '' : coefTex(a)
    out += (out ? (neg ? ' - ' : ' + ') : neg ? '-' : '') + co + K(l)
  })
  return out
}

/** Fórmula de actualización con denominador común: h/6 (k1 + 2k2 + 2k3 + k4). */
function updateParts(b: number[]): { q: number; p: number[] } {
  let q = 1
  const fr = b.map((x) => toFrac(x, 60))
  if (fr.every((f) => f)) {
    fr.forEach((f) => (q = lcm(q, f![1])))
    return { q, p: b.map((x) => Math.round(x * q)) }
  }
  return { q: 1, p: b }
}

/**
 * Paso a paso de un paso de Runge-Kutta (escalar o vectorial) con números sustituidos.
 * nodes[m] = componente m de F en las variables ['t', ...vars].
 */
export function rkSteps(o: { tab: Tableau; res: OdeResult; i: number; h: number; nodes: MathNode[]; vars: string[]; exact?: ((t: number) => number)[] | null }): Step[] {
  const { tab, res, i, h, nodes, vars } = o
  const vector = nodes.length > 1
  const ti = res.t[i], wi = res.w[i]
  const ks = res.k[i + 1]
  if (!ks) return []
  const W = (j: number | string) => (vector ? `\\mathbf W_{${j}}` : `w_{${j}}`)
  const K = (j: number) => (vector ? `\\mathbf k_{${j}}` : `k_{${j}}`)
  const F = vector ? '\\mathbf F' : 'f'
  const V = (v: Vec) => (vector ? vecTex(v) : tn(v[0]))
  const out: Step[] = []
  out.push({
    text: L(
      <>Paso {i + 1}: de <Tex>{`t_{${i}} = ${tn(ti)}`}</Tex> a <Tex>{`t_{${i + 1}} = ${tn(res.t[i + 1])}`}</Tex>, con <Tex>{`${W(i)} = ${V(wi)}`}</Tex></>,
      <>Step {i + 1}: from <Tex>{`t_{${i}} = ${tn(ti)}`}</Tex> to <Tex>{`t_{${i + 1}} = ${tn(res.t[i + 1])}`}</Tex>, with <Tex>{`${W(i)} = ${V(wi)}`}</Tex></>,
    ),
  })
  const valsAt = (t: number, y: Vec) => {
    const vals: Record<string, number> = { t }
    vars.forEach((v, m) => (vals[v] = y[m]))
    const substs = nodes.map((nd) => substTex(nd, vals))
    return vector ? '\\begin{bmatrix}' + substs.join('\\\\') + '\\end{bmatrix}' : substs[0]
  }
  const exactStep = (): Step[] => {
    if (!o.exact || !o.exact.length) return []
    const t1 = res.t[i + 1]
    const ex = o.exact.map((e) => e(t1))
    const err = Math.max(...ex.map((e, m) => Math.abs(e - res.w[i + 1][m])))
    return ex.every(Number.isFinite)
      ? [{ text: L('Comparación con la solución exacta:', 'Comparison with the exact solution:'), tex: `y(t_{${i + 1}}) = ${vector ? vecTex(ex) : tn(ex[0])},\\qquad ${vector ? '\\lVert \\mathbf Y - \\mathbf W\\rVert_\\infty' : `|y(t_{${i + 1}}) - w_{${i + 1}}|`} = ${tn(err, 4)}` }]
      : []
  }
  if (tab.id === 'heun') {
    // Presentación del texto: predictor de Euler y corrector del trapecio
    const t1 = res.t[i + 1]
    const pred = wi.map((x, m) => x + h * ks[0][m])
    const Wt = vector ? `\\tilde{\\mathbf W}_{${i + 1}}` : `\\tilde w_{${i + 1}}`
    out.push({ tex: `${F}(t_{${i}}, ${W(i)}) = ${valsAt(ti, wi)} = ${V(ks[0])}` })
    out.push({ text: 'Predictor (Euler):', tex: `${Wt} = ${W(i)} + h\\,${F}(t_{${i}}, ${W(i)}) = ${V(wi)} + ${tn(h)}${vector ? vecTex(ks[0], 7) : '\\cdot ' + tp(ks[0][0])} = ${V(pred)}` })
    out.push({ tex: `${F}(t_{${i + 1}}, ${Wt}) = ${F}\\left(${tn(t1)},\\; ${V(pred)}\\right) = ${valsAt(t1, pred)} = ${V(ks[1])}` })
    out.push({
      text: L('Corrector (trapecio):', 'Corrector (trapezoidal):'),
      tex: `${W(i + 1)} = ${W(i)} + \\frac h2\\left[${F}(t_{${i}}, ${W(i)}) + ${F}(t_{${i + 1}}, ${Wt})\\right] = ${V(wi)} + \\frac{${tn(h)}}{2}\\left[${vector ? vecTex(ks[0], 7) : tp(ks[0][0])} + ${vector ? vecTex(ks[1], 7) : tp(ks[1][0])}\\right] = ${V(res.w[i + 1])}`,
    })
    out.push(...exactStep())
    return out
  }
  tab.b.forEach((_, j) => {
    const c = tab.c[j]
    const tArg = ti + c * h
    const yArg = wi.slice()
    for (let l = 0; l < j; l++) for (let m = 0; m < yArg.length; m++) yArg[m] += h * (tab.a[j][l] || 0) * ks[l][m]
    const tSym = c === 0 ? `t_{${i}}` : `t_{${i}} + ${c === 1 ? '' : coefTex(c)}h`
    const comb = combTex(tab.a[j] ?? [], vector)
    const single = (tab.a[j] ?? []).filter((x) => x).length === 1
    const ySym = comb ? (single && !comb.startsWith('-') ? `${W(i)} + h\\,${comb}` : `${W(i)} + h\\left(${comb}\\right)`) : W(i)
    const vals: Record<string, number> = { t: tArg }
    vars.forEach((v, m) => (vals[v] = yArg[m]))
    const substs = nodes.map((nd) => substTex(nd, vals))
    const substPart = vector ? '\\begin{bmatrix}' + substs.join('\\\\') + '\\end{bmatrix}' : substs[0]
    out.push({
      tex: `${K(j + 1)} = ${F}\\left(${tSym},\\; ${ySym}\\right) = ${F}\\left(${tn(tArg)},\\; ${V(yArg)}\\right) = ${substPart} = ${V(ks[j])}`,
    })
  })
  const { q, p } = updateParts(tab.b)
  const symTerms = combTex(p, vector)
  const numTerms = p
    .map((pj, j) => (pj ? `${pj === 1 ? '' : pj === -1 ? '-' : tn(pj) + '\\cdot '}${vector ? vecTex(ks[j], 7) : tp(ks[j][0])}` : ''))
    .filter(Boolean)
    .join(' + ')
    .replace(/\+ -/g, '- ')
  const hq = q === 1 ? 'h' : `\\frac{h}{${q}}`
  const hqn = q === 1 ? tn(h) : `\\frac{${tn(h)}}{${q}}`
  const single = p.filter((x) => x).length === 1 && p.find((x) => x) === 1
  out.push({
    tex: `${W(i + 1)} = ${W(i)} + ${hq}${single ? symTerms : `\\left(${symTerms}\\right)`} = ${V(wi)} + ${hqn}${single ? '\\cdot ' + numTerms : `\\left(${numTerms}\\right)`} = ${V(res.w[i + 1])}`,
  })
  out.push(...exactStep())
  return out
}

/* ───────────────────────── Scilab ───────────────────────── */

/** Cuerpo del bucle de un RK explícito en Scilab. vector: usa W(:,i). */
export function sciRkBody(tab: Tableau, vector: boolean, fname = 'f', ind = '  '): string {
  const W = (j: string) => (vector ? `W(:,${j})` : `w(${j})`)
  const lines: string[] = []
  const terms = (cs: number[]) =>
    cs
      .map((c, l) => (c ? (c === 1 ? `k${l + 1}` : c === -1 ? `-k${l + 1}` : `${coefSci(c)}*k${l + 1}`) : ''))
      .filter(Boolean)
      .join(' + ')
      .replace(/\+ -/g, '- ')
  tab.b.forEach((_, j) => {
    const c = tab.c[j]
    const tArg = c === 0 ? 't(i)' : c === 1 ? 't(i) + h' : `t(i) + ${coefSci(c)}*h`
    const tm = terms(tab.a[j] ?? [])
    const yArg = tm ? `${W('i')} + h*(${tm})` : W('i')
    lines.push(`${ind}k${j + 1} = ${fname}(${tArg}, ${yArg});`)
  })
  const { q, p } = updateParts(tab.b)
  const pt = terms(p)
  lines.push(`${ind}${W('i+1')} = ${W('i')} + ${q === 1 ? 'h' : `h/${q}`}*(${pt});`)
  return lines.join('\n')
}

/* ───────────────────────── Gráficas ───────────────────────── */

/** Campo de direcciones de y' = f(t, y) como segmentos cortos (una sola traza). */
export function slopeField(f: ScalarFn, t0: number, t1: number, y0: number, y1: number, nx = 22, ny = 16): Trace {
  const xs: (number | null)[] = []
  const ys: (number | null)[] = []
  const sx = t1 - t0, sy = y1 - y0
  const seg = 0.36 * Math.min(1 / nx, 1 / ny)
  for (let a = 0; a < nx; a++)
    for (let b = 0; b < ny; b++) {
      const t = t0 + ((a + 0.5) * sx) / nx
      const y = y0 + ((b + 0.5) * sy) / ny
      let m: number
      try {
        m = f(t, y)
      } catch {
        continue
      }
      if (!Number.isFinite(m)) continue
      const ux = 1 / sx, uy = m / sy
      const n = Math.hypot(ux, uy)
      const dx = (seg * ux * sx) / n, dy = (seg * uy * sy) / n
      xs.push(t - dx, t + dx, null)
      ys.push(y - dy, y + dy, null)
    }
  return { x: xs, y: ys, type: 'scatter', mode: 'lines', name: L('campo de direcciones', 'direction field'), hoverinfo: 'skip', line: { color: 'rgba(148,163,184,0.55)', width: 1.2 } }
}

/** Rango [min, max] con margen de los valores finitos. */
export function range(vals: number[], pad = 0.08): [number, number] {
  const f = vals.filter((v) => Number.isFinite(v) && Math.abs(v) < 1e12)
  if (!f.length) return [-1, 1]
  let lo = Math.min(...f), hi = Math.max(...f)
  if (hi - lo < 1e-12) {
    lo -= 1
    hi += 1
  }
  const p = (hi - lo) * pad
  return [lo - p, hi + p]
}

export function sampleT(g: (t: number) => number, a: number, b: number, n = 400): { x: number[]; y: (number | null)[] } {
  const x: number[] = [], y: (number | null)[] = []
  for (let i = 0; i < n; i++) {
    const t = a + ((b - a) * i) / (n - 1)
    let v: number
    try {
      v = g(t)
    } catch {
      v = NaN
    }
    x.push(t)
    y.push(Number.isFinite(v) ? v : null)
  }
  return x.length ? { x, y } : { x: [], y: [] }
}

/* ───────────────────────── Resultados de sistemas ───────────────────────── */

export interface SysView {
  res: OdeResult
  /** tabla de Butcher (null para punto medio de 2 pasos y Taylor 2) */
  tab: Tableau | null
  method: SysMethod
  /** Y'' simbólica (Taylor 2) */
  d2: MathNode[] | null
  h: number
  /** F por componentes (en las variables ['t', ...vars]) */
  nodes: MathNode[]
  vars: string[]
  /** TeX de cada componente */
  labels: string[]
  /** nombre plano de cada componente (leyendas/CSV) */
  plain: string[]
  exact?: ((t: number) => number)[] | null
  scilab: string
  filename: string
  /** pasos previos al paso a paso (p. ej. reducción de orden) */
  preSteps?: Step[]
  /** índices iniciales para el plano de fase */
  phase?: [number, number, number]
  warn?: string
}

export function SystemResults(v: SysView) {
  const { res, labels, plain } = v
  const n = res.w[0].length
  const [px, setPx] = useState(String(v.phase?.[0] ?? 0))
  const [py, setPy] = useState(String(v.phase?.[1] ?? Math.min(1, n - 1)))
  const [pz, setPz] = useState(String(v.phase?.[2] ?? Math.min(2, n - 1)))
  const N = res.t.length - 1
  const last = res.w[N]
  const idx = useMemo(() => thinIdx(res.t.length, 4000), [res])
  const exact = v.exact && v.exact.length ? v.exact : null
  const errs = useMemo(() => (exact ? res.t.map((t, i) => Math.max(...exact.map((e, m) => Math.abs(e(t) - res.w[i][m])))) : null), [res, exact])

  const compPlot = useMemo(() => {
    const tr: Trace[] = []
    const t = idx.map((i) => res.t[i])
    const mk = res.t.length <= 80
    for (let m = 0; m < n; m++) {
      tr.push({ x: t, y: idx.map((i) => res.w[i][m]), type: 'scatter', mode: mk ? 'lines+markers' : 'lines', name: plain[m], line: { color: SERIES[m % SERIES.length], width: 2 }, marker: { size: 5 } })
      if (exact && exact[m]) {
        const s = sampleT(exact[m], res.t[0], res.t[N])
        tr.push({ ...s, type: 'scatter', mode: 'lines', name: plain[m] + L(' exacta', ' exact'), line: { color: SERIES[m % SERIES.length], dash: 'dot', width: 1.5 } })
      }
    }
    return tr
  }, [res, idx, exact])

  const phasePlot = useMemo(() => {
    const a = Number(px), b = Number(py)
    return [
      { x: idx.map((i) => res.w[i][a]), y: idx.map((i) => res.w[i][b]), type: 'scatter', mode: 'lines', name: L('trayectoria', 'trajectory'), line: { color: SERIES[0], width: 2 } },
      { x: [res.w[0][a]], y: [res.w[0][b]], type: 'scatter', mode: 'markers', name: L('inicio', 'start'), marker: { color: SERIES[5], size: 10 } },
      { x: [last[a]], y: [last[b]], type: 'scatter', mode: 'markers', name: L('final', 'end'), marker: { color: SERIES[6], size: 10, symbol: 'x' } },
    ] as Trace[]
  }, [res, idx, px, py])

  const plot3d = useMemo(() => {
    if (n < 3) return []
    const a = Number(px), b = Number(py), c = Number(pz)
    const tt = idx.map((i) => res.t[i])
    return [
      { x: idx.map((i) => res.w[i][a]), y: idx.map((i) => res.w[i][b]), z: idx.map((i) => res.w[i][c]), type: 'scatter3d', mode: 'lines', name: L('trayectoria', 'trajectory'), line: { color: tt, colorscale: 'Viridis', width: 4 } },
      { x: [res.w[0][a]], y: [res.w[0][b]], z: [res.w[0][c]], type: 'scatter3d', mode: 'markers', name: L('inicio', 'start'), marker: { color: SERIES[5], size: 5 } },
    ] as Trace[]
  }, [res, idx, px, py, pz])

  const compOpts = plain.map((p, m) => ({ value: String(m), label: p }))
  const steps: Step[] = [...(v.preSteps ?? [])]
  for (let i = 0; i < Math.min(2, N); i++)
    steps.push(...(v.tab ? rkSteps({ tab: v.tab, res, i, h: v.h, nodes: v.nodes, vars: v.vars, exact }) : multiSteps({ method: v.method, res, i, h: v.h, nodes: v.nodes, vars: v.vars, d2: v.d2, exact })))
  if (N > 2) steps.push({ text: L(`… y así sucesivamente hasta t_${N} = ${fmt(res.t[N])} (ver tabla).`, `… and so on up to t_${N} = ${fmt(res.t[N])} (see table).`) })

  const rows = useMemo(() => thinIdx(res.t.length, 1001).map((i) => {
    const r: Record<string, number> = { i, t: res.t[i] }
    res.w[i].forEach((x, m) => (r['w' + m] = x))
    if (errs) r.err = errs[i]
    return r
  }), [res, errs])
  const cols: Column<any>[] = [
    { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
    { key: 't', tex: 't_i' },
    ...labels.map((l, m) => ({ key: 'w' + m, tex: l, label: plain[m] })),
    ...(errs ? [{ key: 'err', tex: '\\lVert \\mathbf Y(t_i) - \\mathbf W_i\\rVert_\\infty', label: 'error', fmt: 'err' as const }] : []),
  ]

  const tabs = [
    { label: L('Componentes vs t', 'Components vs t'), content: <Card><Plot data={compPlot} layout={{ xaxis: { title: { text: 't' } } }} height={400} /></Card> },
  ]
  if (n >= 2)
    tabs.push({
      label: L('Plano de fase', 'Phase plane'),
      content: (
        <Card>
          <div className="edo-axes">
            <SelectField label={L('Eje horizontal', 'Horizontal axis')} value={px} onChange={setPx} options={compOpts} />
            <SelectField label={L('Eje vertical', 'Vertical axis')} value={py} onChange={setPy} options={compOpts} />
          </div>
          <Plot data={phasePlot} layout={{ xaxis: { title: { text: plain[Number(px)] } }, yaxis: { title: { text: plain[Number(py)] } } }} height={420} />
        </Card>
      ),
    })
  if (n >= 3)
    tabs.push({
      label: L('Trayectoria 3D', '3D trajectory'),
      content: (
        <Card>
          <div className="edo-axes">
            <SelectField label="x" value={px} onChange={setPx} options={compOpts} />
            <SelectField label="y" value={py} onChange={setPy} options={compOpts} />
            <SelectField label="z" value={pz} onChange={setPz} options={compOpts} />
          </div>
          <Plot data={plot3d} layout={{ uirevision: 'sys3d', scene: { xaxis: { title: { text: plain[Number(px)] } }, yaxis: { title: { text: plain[Number(py)] } }, zaxis: { title: { text: plain[Number(pz)] } }, aspectmode: 'cube' }, margin: { l: 0, r: 0, t: 10, b: 0 } }} height={520} />
          <p className="muted edo-note">{L('El color indica el tiempo (oscuro → claro). Arrastra para rotar.', 'Color indicates time (dark → light). Drag to rotate.')}</p>
        </Card>
      ),
    })
  if (errs)
    tabs.push({
      label: 'Error',
      content: (
        <Card>
          <Plot data={[{ x: idx.map((i) => res.t[i]), y: idx.map((i) => (errs[i] > 0 ? errs[i] : null)), type: 'scatter', mode: 'lines+markers', name: L('error global', 'global error'), line: { color: SERIES[6] }, marker: { size: 4 } }]} layout={{ yaxis: { type: 'log', exponentformat: 'power', title: { text: '‖Y(tᵢ) − Wᵢ‖∞' } }, xaxis: { title: { text: 't' } } }} />
        </Card>
      ),
    })
  tabs.push({ label: L('Paso a paso', 'Step by step'), content: <Card><Steps steps={steps} /></Card> })

  return (
    <>
      <Stats
        items={[
          ...last.slice(0, 4).map((x, m) => ({ label: <>{plain[m]}(t_f)</>, value: fmt(x, 10), accent: m === 0 })),
          { label: L('Pasos', 'Steps'), value: N, hint: `h = ${fmt(v.h, 8)}` },
          ...(errs
            ? [{ label: L('Error final', 'Final error'), value: fmtErr(errs[N]), hint: L('norma ∞ vs exacta', '∞-norm vs exact') }]
            : [{ label: L('Evaluaciones de F', 'Evaluations of F'), value: res.nevals, hint: `${v.tab ? v.tab.b.length : v.method === 'taylor2' ? L('2 (F y Y″)', '2 (F and Y″)') : 1} ${L('por paso', 'per step')}` }]),
        ]}
      />
      {v.warn && <Alert kind="warn">{v.warn}</Alert>}
      <Alert kind={res.ok ? 'ok' : 'error'}>{res.message}</Alert>
      <Tabs tabs={tabs} />
      <Card title={L('Tabla de resultados', 'Results table')}>
        {res.t.length > 1001 && (
          <p className="muted edo-note">
            {L(`Se muestran 1001 de ${res.t.length} filas (muestreo uniforme); el CSV contiene las filas mostradas.`, `Showing 1001 of ${res.t.length} rows (uniform sampling); the CSV contains the rows shown.`)}
          </p>
        )}
        <DataTable columns={cols} rows={rows} filename={v.filename} />
      </Card>
      <ScilabCode code={v.scilab} filename={v.filename} />
    </>
  )
}

/** Scilab: bloque que imprime y grafica una matriz W (n × N+1). */
export function sciSystemTail(n: number, names: string[], odeCompare = true): string {
  const hdr = names.map((x) => `'${x}'`).join(', ')
  let s = `\n// ${L('Tabla (primeras filas)', 'Table (first rows)')}\nmprintf('%4s %12s' + strcat(repmat(' %16s', 1, ${n})) + '\\n', 'i', 't', ${hdr});\nfor i = 1:min(N+1, 21)\n  mprintf('%4d %12.6f' + strcat(repmat(' %16.10f', 1, ${n})) + '\\n', i-1, t(i), W(:,i)');\nend\n`
  s += `\n// ${L('Gráficas', 'Plots')}\nscf(0); clf();\nplot(t', W');\nxlabel('t'); legend(${hdr});\ntitle('${L('Componentes vs t', 'Components vs t')}');\n`
  if (n >= 2) s += `scf(1); clf();\nplot(W(1,:), W(2,:));\nxlabel('${names[0]}'); ylabel('${names[1]}'); title('${L('Plano de fase', 'Phase plane')}');\n`
  if (n >= 3) s += `scf(2); clf();\nparam3d(W(1,:), W(2,:), W(3,:));\ntitle('${L('Trayectoria 3D', '3D trajectory')}');\n`
  if (odeCompare)
    s += `\n// ${L('Comparación con el integrador de Scilab (ode usa lsoda por defecto)', "Comparison with Scilab's integrator (ode uses lsoda by default)")}:\nW_ode = ode(W(:,1), t0, t, F);\nmprintf('${L('Diferencia max. con ode()', 'Max. difference with ode()')}: %e\\n', max(abs(W_ode - W)));\n`
  return s
}

/* ───────────────────────── Métodos para sistemas ───────────────────────── */

/** 'punto-medio' es el RK2 del punto medio (Burden); 'pm2' es el punto medio de 2 pasos del texto. */
export type SysMethod = 'euler' | 'pm2' | 'heun' | 'taylor2' | 'ralston' | 'rk4' | 'punto-medio' | 'rk3'
export const SYS_METHODS: { value: SysMethod; label: string }[] = [
  { value: 'euler', label: L('Euler (orden 1)', 'Euler (order 1)') },
  { value: 'pm2', label: L('Punto medio del texto, 2 pasos (orden 2)', 'Textbook midpoint, two-step (order 2)') },
  { value: 'heun', label: L('Trapecio o Euler modificado (orden 2)', 'Trapezoidal or modified Euler (order 2)') },
  { value: 'taylor2', label: L('Taylor de orden 2 con jacobiano', 'Taylor of order 2 with Jacobian') },
  { value: 'ralston', label: L('RK2 del texto, γ₂ = ¾ (orden 2)', 'Textbook RK2, γ₂ = ¾ (order 2)') },
  { value: 'rk4', label: L('RK4 clásico (orden 4)', 'Classical RK4 (order 4)') },
  { value: 'punto-medio', label: L('RK2 del punto medio (Burden)', 'Midpoint RK2 (Burden)') },
  { value: 'rk3', label: L('RK3 de Kutta (orden 3)', "Kutta's RK3 (order 3)") },
]
export const sysMethodName = (m: SysMethod) => SYS_METHODS.find((o) => o.value === m)?.label ?? m

export interface SysSolve {
  res: OdeResult
  tab: Tableau | null
  /** Y'' = ∂F/∂t + J·F por componentes (sólo Taylor 2) */
  d2: MathNode[] | null
  error?: string
}

/**
 * Resuelve Y' = F(t, Y) con el método elegido. nodes[m] es la componente m de F en ['t', ...vars].
 */
export function solveSystem(method: SysMethod, F: OdeFn, nodes: MathNode[], vars: string[], t0: number, y0: Vec, h: number, N: number): SysSolve {
  if (method === 'pm2') return { res: puntoMedio2(F, t0, y0, h, N), tab: null, d2: null }
  if (method === 'taylor2') {
    let d2: MathNode[]
    try {
      d2 = secondDerivatives(nodes, vars)
    } catch (e: any) {
      return { res: { t: [t0], w: [y0], k: [null], ok: false, message: '', nevals: 0 }, tab: null, d2: null, error: L('No se pudo derivar F simbólicamente: ', 'Could not differentiate F symbolically: ') + (e?.message ?? e) }
    }
    const cs = d2.map((n) => compile(n.toString(), ['t', ...vars]))
    const bad = cs.find((c) => !c.ok)
    if (bad && !bad.ok) return { res: { t: [t0], w: [y0], k: [null], ok: false, message: '', nevals: 0 }, tab: null, d2: null, error: L('Derivada no compilable: ', 'Derivative could not be compiled: ') + bad.error }
    const fs = cs.map((c) => (c as Compiled).f)
    const D2: OdeFn = (t, y) => fs.map((f) => f(t, ...y))
    return { res: taylorSolveVec([F, D2], t0, y0, h, N), tab: null, d2 }
  }
  const tab = TABLEAUS[method]
  return { res: rkSolve(F, tab, t0, y0, h, N), tab, d2: null }
}

/** Paso a paso de los métodos que no son Runge-Kutta (punto medio de 2 pasos y Taylor 2), escalar o vectorial. */
export function multiSteps(o: { method: SysMethod; res: OdeResult; i: number; h: number; nodes: MathNode[]; vars: string[]; d2: MathNode[] | null; exact?: ((t: number) => number)[] | null }): Step[] {
  const { res, i, h, nodes, vars } = o
  const vector = nodes.length > 1
  const ti = res.t[i], wi = res.w[i]
  const ks = res.k[i + 1]
  if (!ks) return []
  const W = (j: number | string) => (vector ? `\\mathbf W_{${j}}` : `w_{${j}}`)
  const F = vector ? '\\mathbf F' : 'f'
  const V = (v: Vec, d = 8) => (vector ? vecTex(v, d) : tn(v[0], d))
  const Vp = (v: Vec) => (vector ? vecTex(v, 7) : tp(v[0]))
  const subst = (ns: MathNode[], t: number, y: Vec) => {
    const vals: Record<string, number> = { t }
    vars.forEach((v, m) => (vals[v] = y[m]))
    const s = ns.map((nd) => substTex(nd, vals))
    return vector ? '\\begin{bmatrix}' + s.join('\\\\') + '\\end{bmatrix}' : s[0]
  }
  const out: Step[] = []
  out.push({ text: <>{L('Paso', 'Step')} {i + 1}: <Tex>{`t_{${i}} = ${tn(ti)},\\; ${W(i)} = ${V(wi)}`}</Tex></> })
  out.push({ tex: `${F}(t_{${i}}, ${W(i)}) = ${subst(nodes, ti, wi)} = ${V(ks[0])}` })
  if (o.method === 'pm2') {
    if (i === 0) out.push({ text: L('Primer valor con Euler (el método necesita dos valores previos):', 'First value with Euler (the method needs two previous values):'), tex: `${W(1)} = ${W(0)} + h\\,${F}(t_0, ${W(0)}) = ${V(wi)} + ${tn(h)}${vector ? '' : '\\cdot '}${Vp(ks[0])} = ${V(res.w[1])}` })
    else out.push({ text: L('Punto medio (2 pasos):', 'Midpoint (two-step):'), tex: `${W(i + 1)} = ${W(i - 1)} + 2h\\,${F}(t_{${i}}, ${W(i)}) = ${V(res.w[i - 1])} + 2\\cdot ${tn(h)}${vector ? '' : '\\cdot '}${Vp(ks[0])} = ${V(res.w[i + 1])}` })
  } else if (o.method === 'taylor2' && o.d2) {
    const Y2 = vector ? "\\mathbf Y''" : "y''"
    out.push({ tex: `${Y2}_{${i}} = ${subst(o.d2, ti, wi)} = ${V(ks[1])}` })
    out.push({ tex: `${W(i + 1)} = ${W(i)} + h\\,${F}(t_{${i}}, ${W(i)}) + \\frac{h^2}{2}${Y2}_{${i}} = ${V(wi)} + ${tn(h)}${vector ? '' : '\\cdot '}${Vp(ks[0])} + \\frac{${tn(h)}^2}{2}${vector ? '' : '\\cdot '}${Vp(ks[1])} = ${V(res.w[i + 1])}` })
  }
  if (o.exact && o.exact.length) {
    const t1 = res.t[i + 1]
    const ex = o.exact.map((e) => e(t1))
    const err = Math.max(...ex.map((e, m) => Math.abs(e - res.w[i + 1][m])))
    if (ex.every(Number.isFinite)) out.push({ tex: `y(t_{${i + 1}}) = ${vector ? vecTex(ex) : tn(ex[0])},\\qquad \\text{error} = ${tn(err, 4)}` })
  }
  return out
}

/** Pasos previos: fórmula del método para sistemas (y derivadas simbólicas de Taylor 2). */
export function methodIntro(method: SysMethod, tab: Tableau | null, d2: MathNode[] | null, names: Record<string, string>, vector: boolean): Step[] {
  const W = (j: string) => (vector ? `\\mathbf W_{${j}}` : `w_{${j}}`)
  const F = vector ? '\\mathbf F' : 'f'
  if (method === 'pm2') return [{ text: L('Punto medio del texto (método de 2 pasos):', 'Textbook midpoint method (two-step method):'), tex: `${W('1')} = ${W('0')} + h\\,${F}(t_0, ${W('0')}),\\qquad ${W('i+1')} = ${W('i-1')} + 2h\\,${F}(t_i, ${W('i')})` }]
  if (method === 'taylor2' && d2)
    return [
      { text: L('Taylor de orden 2: la segunda derivada se obtiene derivando F con la regla de la cadena (jacobiano):', 'Taylor of order 2: the second derivative is obtained by differentiating F with the chain rule (Jacobian):'), tex: `${vector ? "\\mathbf Y''" : "y''"} = \\frac{\\partial ${F}}{\\partial t} + ${vector ? 'J\\,\\mathbf F' : 'f_y\\,f'} = ${vector ? '\\begin{bmatrix}' + d2.map((d) => texOf(d, names)).join('\\\\') + '\\end{bmatrix}' : texOf(d2[0], names)}` },
      { tex: `${W('i+1')} = ${W('i')} + h\\,${F}(t_i, ${W('i')}) + \\frac{h^2}{2}\\,${vector ? "\\mathbf Y''" : "y''"}(t_i, ${W('i')})` },
    ]
  if (tab?.id === 'heun') return [{ text: L('Trapecio o Euler modificado (predictor-corrector):', 'Trapezoidal or modified Euler (predictor-corrector):'), tex: `\\tilde{${vector ? '\\mathbf W' : 'w'}}_{i+1} = ${W('i')} + h\\,${F}(t_i, ${W('i')}),\\qquad ${W('i+1')} = ${W('i')} + \\frac h2\\left[${F}(t_i, ${W('i')}) + ${F}(t_{i+1}, \\tilde{${vector ? '\\mathbf W' : 'w'}}_{i+1})\\right]` }]
  if (tab && tab.b.length > 1) return [{ text: L(`Coeficientes de ${tab.name} (γ = b, α = c, β = a en la tabla de Butcher):`, `Coefficients of ${tab.name} (γ = b, α = c, β = a in the Butcher tableau):`), tex: butcherTex(tab) }]
  return []
}

/** Tabla de Butcher en TeX. */
export function butcherTex(tab: Tableau): string {
  const s = tab.b.length
  const rows = tab.c.map((ci, j) => `${coefTex(ci)} & ` + Array.from({ length: s }, (_, l) => (l < j ? coefTex(tab.a[j][l] ?? 0) : '')).join(' & '))
  return `\\begin{array}{c|${'c'.repeat(s)}} ${rows.join(' \\\\ ')} \\\\ \\hline & ${tab.b.map(coefTex).join(' & ')}\\end{array}`
}

/** Cuerpo del bucle en Scilab (W(:,i) si vector) para cualquier método de sistemas. */
export function sciSysBody(method: SysMethod, tab: Tableau | null, vector: boolean, fname: string, d2name = 'D2'): string {
  const W = (j: string) => (vector ? `W(:,${j})` : `w(${j})`)
  if (method === 'pm2')
    return `  if i == 1 then\n    ${W('2')} = ${W('1')} + h*${fname}(t(1), ${W('1')});   // ${L('y1 con Euler', 'y1 with Euler')}\n  else\n    ${W('i+1')} = ${W('i-1')} + 2*h*${fname}(t(i), ${W('i')});   // ${L('punto medio (2 pasos)', 'midpoint (two-step)')}\n  end`
  if (method === 'taylor2') return `  ${W('i+1')} = ${W('i')} + h*${fname}(t(i), ${W('i')}) + h^2/2*${d2name}(t(i), ${W('i')});`
  if (tab?.id === 'heun')
    return `  Fi = ${fname}(t(i), ${W('i')});\n  P  = ${W('i')} + h*Fi;                     // predictor (Euler)\n  ${W('i+1')} = ${W('i')} + h/2*(Fi + ${fname}(t(i+1), P));   // corrector (${L('trapecio', 'trapezoidal')})`
  return sciRkBody(tab!, vector, fname)
}
