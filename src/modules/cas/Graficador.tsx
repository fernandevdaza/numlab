import { useMemo } from 'react'
import { compile, compileDerivative, evalNumber, math, normalize, type Compiled } from '../../lib/expr'
import { fmt } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, sample, sampleRange, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, CheckField, DataTable, FieldRow, MethodPage, NumField, ScilabCode } from '../../components/ui'
import { numericRoots } from './numerico'
import './cas.css'

interface Fn {
  src: string
  on: boolean
}
interface Param {
  value: number
  min: number
  max: number
}
interface S {
  fns: Fn[]
  xmin: string
  xmax: string
  ymin: string
  ymax: string
  roots: boolean
  extrema: boolean
  inter: boolean
  deriv: boolean
  params: Record<string, Param>
}

const CONSTS = new Set(['x', 'pi', 'e', 'E', 'PI', 'i', 'Infinity', 'NaN', 'phi', 'tau'])

/** Parámetros libres (símbolos distintos de x y de constantes) de una expresión. */
function freeParams(src: string): string[] {
  try {
    const node = math.parse(normalize(src))
    const out = new Set<string>()
    node.traverse((n: any, _p: string, parent: any) => {
      if (n.isSymbolNode) {
        const isFn = parent && parent.isFunctionNode && parent.fn === n
        if (!isFn && !CONSTS.has(n.name)) out.add(n.name)
      }
    })
    return [...out]
  } catch {
    return []
  }
}

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: 'sin, cos', value: { fns: [{ src: 'sin(x)', on: true }, { src: 'cos(x)', on: true }], xmin: '-2pi', xmax: '2pi', ymin: '', ymax: '' } },
  { label: 'cos x = x', value: { fns: [{ src: 'cos(x)', on: true }, { src: 'x', on: true }], xmin: '-2', xmax: '3', ymin: '', ymax: '' } },
  { label: 'Polinomio y derivada', value: { fns: [{ src: 'x^3 - 3x^2 + 1', on: true }], xmin: '-2', xmax: '4', deriv: true, ymin: '', ymax: '' } },
  { label: 'Familia a·sin(b·x)', value: { fns: [{ src: 'a * sin(b * x)', on: true }, { src: 'sin(x)', on: true }], xmin: '-6', xmax: '6', ymin: '-3', ymax: '3', params: { a: { value: 1.5, min: -3, max: 3 }, b: { value: 2, min: 0, max: 5 } } } },
  { label: 'eˣ vs polinomios', value: { fns: [{ src: 'exp(x)', on: true }, { src: '1 + x + x^2/2', on: true }, { src: '1 + x + x^2/2 + x^3/6', on: true }], xmin: '-3', xmax: '3', ymin: '-2', ymax: '12' } },
  { label: 'tan x (asíntotas)', value: { fns: [{ src: 'tan(x)', on: true }], xmin: '-5', xmax: '5', ymin: '-10', ymax: '10' } },
]

export function Graficador() {
  const [s, setS] = useLocalState<S>('cas:graficador', {
    fns: [
      { src: 'x^3 - 3x^2 + 1', on: true },
      { src: 'sin(2x)', on: true },
    ],
    xmin: '-2',
    xmax: '4',
    ymin: '',
    ymax: '',
    roots: true,
    extrema: true,
    inter: true,
    deriv: false,
    params: {},
  })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const setFn = (i: number, p: Partial<Fn>) => setS((v) => ({ ...v, fns: v.fns.map((f, k) => (k === i ? { ...f, ...p } : f)) }))
  const d = useDebounced(s, 120)

  const paramNames = useMemo(() => [...new Set(s.fns.flatMap((f) => freeParams(f.src)))].sort(), [s.fns])
  const params = useMemo(() => {
    const out: Record<string, Param> = {}
    for (const n of paramNames) out[n] = s.params[n] ?? { value: 1, min: -5, max: 5 }
    return out
  }, [paramNames, s.params])
  const setParam = (n: string, p: Partial<Param>) => set({ params: { ...s.params, [n]: { ...params[n], ...p } } })

  const calc = useMemo(() => {
    const names = [...new Set(d.fns.flatMap((f) => freeParams(f.src)))].sort()
    const pv = names.map((n) => (d.params[n] ?? { value: 1 }).value)
    const a = evalNumber(d.xmin), b = evalNumber(d.xmax)
    if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return { error: 'Rango de x inválido (x mín < x máx).' }
    const compiled = d.fns.map((f) => (f.src.trim() ? compile(f.src, ['x', ...names]) : null))
    const fns: { i: number; label: string; f: (x: number) => number; c: Compiled }[] = []
    compiled.forEach((c, i) => {
      if (c && c.ok && d.fns[i].on) fns.push({ i, label: d.fns[i].src, f: (x: number) => c.f(x, ...pv), c })
    })
    const traces: Trace[] = []
    const points: { tipo: string; fn: string; x: number; y: number }[] = []
    const span = b - a
    const hD = span * 1e-6
    for (const fn of fns) {
      const col = SERIES[fn.i % SERIES.length]
      const sm = sample(fn.f, a, b, 800)
      traces.push({ ...sm, type: 'scatter', mode: 'lines', name: fn.label, line: { color: col, width: 2.4 }, hovertemplate: `${fn.label}: %{y:.6g}<extra></extra>` })
      // derivada simbólica exacta (mathjs); si no se puede, diferencia centrada
      const dsym = compileDerivative(fn.c, 'x')
      const df = dsym.ok ? (x: number) => dsym.f(x, ...pv) : (x: number) => (fn.f(x + hD) - fn.f(x - hD)) / (2 * hD)
      const snap = (r: number) => (Math.abs(r) < 1e-12 * Math.max(1, span) ? 0 : r)
      if (d.deriv) {
        const ds = sample(df, a, b, 800)
        traces.push({ ...ds, type: 'scatter', mode: 'lines', name: `(${fn.label})′`, line: { color: col, width: 1.3, dash: 'dash' }, hovertemplate: `(${fn.label})′: %{y:.6g}<extra></extra>` })
      }
      if (d.roots) {
        for (const r of numericRoots(fn.f, a, b, 3000)) points.push({ tipo: 'raíz', fn: fn.label, x: snap(r), y: 0 })
      }
      if (d.extrema) {
        for (const r0 of numericRoots(df, a, b, 3000)) {
          const r = snap(r0)
          const y = fn.f(r)
          if (!Number.isFinite(y)) continue
          const l = fn.f(r - span * 1e-4), rr = fn.f(r + span * 1e-4)
          if (!Number.isFinite(l) || !Number.isFinite(rr)) continue
          const tipo = l < y && rr < y ? 'máximo' : l > y && rr > y ? 'mínimo' : 'punto crítico'
          points.push({ tipo, fn: fn.label, x: r, y })
          // raíz de multiplicidad par (toca el eje sin cruzarlo): la búsqueda por cambio de signo no la ve
          const [ylo, yhi] = sampleRange(sm)
          const tolY = 1e-9 * Math.max(1, Math.abs(ylo), Math.abs(yhi))
          if (d.roots && Math.abs(y) <= tolY && !points.some((p) => p.tipo === 'raíz' && p.fn === fn.label && Math.abs(p.x - r) < 1e-6 * (1 + Math.abs(r))))
            points.push({ tipo: 'raíz', fn: fn.label + ' (raíz doble)', x: r, y: 0 })
        }
      }
    }
    if (d.inter)
      for (let p = 0; p < fns.length; p++)
        for (let q = p + 1; q < fns.length; q++) {
          const F = fns[p], G = fns[q]
          for (const r of numericRoots((x) => F.f(x) - G.f(x), a, b, 3000)) points.push({ tipo: 'intersección', fn: `${F.label} ∩ ${G.label}`, x: r, y: F.f(r) })
        }
    const style: Record<string, { color: string; symbol: string }> = {
      raíz: { color: SERIES[5], symbol: 'circle' },
      máximo: { color: SERIES[6], symbol: 'triangle-up' },
      mínimo: { color: SERIES[4], symbol: 'triangle-down' },
      'punto crítico': { color: SERIES[2], symbol: 'square' },
      intersección: { color: SERIES[7], symbol: 'diamond' },
    }
    for (const tipo of Object.keys(style)) {
      const pts = points.filter((p) => p.tipo === tipo)
      if (!pts.length) continue
      traces.push({
        x: pts.map((p) => p.x),
        y: pts.map((p) => p.y),
        type: 'scatter',
        mode: 'markers',
        name: tipo === 'intersección' ? 'intersecciones' : tipo === 'raíz' ? 'raíces' : tipo === 'máximo' ? 'máximos' : tipo === 'mínimo' ? 'mínimos' : 'puntos críticos',
        marker: { color: style[tipo].color, size: 10, symbol: style[tipo].symbol, line: { width: 1.5, color: 'rgba(0,0,0,0.35)' } },
        text: pts.map((p) => `${tipo} de ${p.fn}<br>x = ${fmt(p.x, 10)}<br>y = ${fmt(p.y, 10)}`),
        hovertemplate: '%{text}<extra></extra>',
      })
    }
    const errors = compiled.map((c, i) => (c && !c.ok ? `f${i + 1}: ${c.error}` : null))
    return { traces, points, errors, a, b, names, pv }
  }, [d])

  const ymin = evalNumber(s.ymin), ymax = evalNumber(s.ymax)
  const yrange = Number.isFinite(ymin) && Number.isFinite(ymax) && ymin < ymax ? [ymin, ymax] : undefined

  const inputs = (
    <>
      <div className="field">
        <span className="field-label">Funciones de x</span>
        {s.fns.map((f, i) => {
          const c = f.src.trim() ? compile(f.src, ['x', ...paramNames]) : null
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="fn-row">
                <span className="fn-swatch" style={{ background: SERIES[i % SERIES.length], opacity: f.on ? 1 : 0.3 }} />
                <input type="checkbox" checked={f.on} onChange={(e) => setFn(i, { on: e.target.checked })} title="Mostrar / ocultar" style={{ accentColor: SERIES[i % SERIES.length] }} />
                <input className={'input mono' + (c && !c.ok ? ' invalid' : '')} data-palette="expr" data-vars="x" value={f.src} spellCheck={false} placeholder={`f${i + 1}(x)`} onChange={(e) => setFn(i, { src: e.target.value })} />
                <button className="fn-del" title="Quitar" onClick={() => set({ fns: s.fns.filter((_, k) => k !== i) })}>
                  ✕
                </button>
              </div>
              {c && !c.ok && <div className="fn-err">{c.error}</div>}
              {c && c.ok && (
                <div className="fn-tex">
                  <Tex>{`f_{${i + 1}}(x) = ${c.tex}`}</Tex>
                </div>
              )}
            </div>
          )
        })}
        <button className="btn sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => set({ fns: [...s.fns, { src: '', on: true }] })}>
          + Agregar función
        </button>
      </div>
      {paramNames.length > 0 && (
        <div className="field">
          <span className="field-label">Parámetros (deslizadores)</span>
          {paramNames.map((n) => {
            const p = params[n]
            return (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="param">
                  <span className="param-name">{n}</span>
                  <input type="range" min={p.min} max={p.max} step={(p.max - p.min) / 200 || 0.01} value={p.value} onChange={(e) => setParam(n, { value: Number(e.target.value) })} />
                  <span className="param-val">{fmt(p.value, 4)}</span>
                </div>
                <div className="param-lims">
                  <input className="input mono" type="number" value={p.min} title="mínimo" onChange={(e) => Number.isFinite(Number(e.target.value)) && setParam(n, { min: Number(e.target.value) })} />
                  <input className="input mono" type="number" value={p.value} title="valor" onChange={(e) => Number.isFinite(Number(e.target.value)) && setParam(n, { value: Number(e.target.value) })} />
                  <input className="input mono" type="number" value={p.max} title="máximo" onChange={(e) => Number.isFinite(Number(e.target.value)) && setParam(n, { max: Number(e.target.value) })} />
                </div>
              </div>
            )
          })}
        </div>
      )}
      <FieldRow>
        <NumField label="x mín" value={s.xmin} onChange={(xmin) => set({ xmin })} />
        <NumField label="x máx" value={s.xmax} onChange={(xmax) => set({ xmax })} />
      </FieldRow>
      <FieldRow>
        <NumField label="y mín" value={s.ymin} onChange={(ymin) => set({ ymin })} placeholder="auto" />
        <NumField label="y máx" value={s.ymax} onChange={(ymax) => set({ ymax })} placeholder="auto" />
      </FieldRow>
      <CheckField label="Marcar raíces" value={s.roots} onChange={(roots) => set({ roots })} />
      <CheckField label="Marcar máximos y mínimos" value={s.extrema} onChange={(extrema) => set({ extrema })} />
      <CheckField label="Marcar intersecciones" value={s.inter} onChange={(inter) => set({ inter })} />
      <CheckField label="Mostrar derivadas (línea discontinua)" value={s.deriv} onChange={(deriv) => set({ deriv })} />
      <div className="examples">
        <span className="field-label">Ejemplos</span>
        <div className="chips">
          {EXAMPLES.map((ex) => (
            <button key={ex.label} className="chip" onClick={() => set({ deriv: false, params: s.params, ...ex.value, ...(ex.value.params ? { params: { ...s.params, ...ex.value.params } } : {}) })}>
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )

  return (
    <MethodPage title="Graficador de funciones" topic="Herramientas" description="Grafica varias funciones a la vez, con parámetros ajustables. Pasa el cursor para leer valores; se marcan raíces, extremos e intersecciones calculados numéricamente." inputs={inputs}>
      {'error' in calc ? (
        <Alert kind="error">{calc.error}</Alert>
      ) : (
        <>
          {calc.errors.filter(Boolean).map((e, i) => (
            <Alert key={i} kind="error">
              {e}
            </Alert>
          ))}
          <Card>
            <Plot
              data={calc.traces}
              height={520}
              layout={{ xaxis: { title: { text: 'x' }, range: [calc.a, calc.b] }, yaxis: yrange ? { range: yrange } : {}, hovermode: 'x unified', dragmode: 'pan' }}
            />
            <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
              Arrastra para desplazar, rueda o doble clic para zoom. Los puntos especiales se refinan por bisección (raíces de f, de f′ y de f − g).
            </p>
          </Card>
          {calc.points.length > 0 && (
            <Card title="Puntos especiales">
              <DataTable
                filename="puntos"
                columns={[
                  { key: 'tipo', label: 'Tipo', align: 'left' },
                  { key: 'fn', label: 'Función', align: 'left' },
                  { key: 'x', tex: 'x', get: (r) => fmt(r.x, 12) },
                  { key: 'y', tex: 'y', get: (r) => fmt(r.y, 12) },
                ]}
                rows={calc.points.slice().sort((p, q) => p.x - q.x)}
                maxHeight={320}
              />
            </Card>
          )}
          <ScilabCode
            filename="graficador"
            code={`// Gráfica de varias funciones — generado por NumLab
clear; clc; clf;
${calc.names.map((n, i) => `${n} = ${calc.pv[i]};`).join('\n')}${calc.names.length ? '\n' : ''}x = linspace(${calc.a}, ${calc.b}, 800);
${s.fns
  .filter((f) => f.on && f.src.trim())
  .map((f, i) => `y${i + 1} = ${scilabExpr(f.src)};`)
  .join('\n')}
plot(x, [${s.fns
              .filter((f) => f.on && f.src.trim())
              .map((_, i) => `y${i + 1}`)
              .join('; ')}]');
xgrid(); xlabel('x'); legend(${s.fns
              .filter((f) => f.on && f.src.trim())
              .map((f) => `'${f.src.replace(/'/g, '')}'`)
              .join(', ')});
`}
          />
        </>
      )}
    </MethodPage>
  )
}

function scilabExpr(src: string): string {
  try {
    const node = math.parse(normalize(src))
    const t = node.transform((n: any) => {
      if (n.isSymbolNode && (n.name === 'pi' || n.name === 'PI')) return new math.SymbolNode('%pi')
      if (n.isSymbolNode && (n.name === 'e' || n.name === 'E')) return new math.SymbolNode('%e')
      return n
    })
    return t
      .toString({ parenthesis: 'keep', implicit: 'show' })
      .replace(/(?<![.])\*/g, '.*')
      .replace(/(?<![.])\//g, './')
      .replace(/(?<![.])\^/g, '.^')
  } catch {
    return src
  }
}
