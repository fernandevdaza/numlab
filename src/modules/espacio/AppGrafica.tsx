// App de gráficas: vista algebraica (entradas) + lienzo con zoom y desplazamiento, estilo GeoGebra.
import Plotly from 'plotly.js-dist-min'
import { useEffect, useMemo, useRef } from 'react'
import { useTheme } from '../../components/theme'
import { SERIES } from '../../components/palette'
import { Tex } from '../../components/Tex'
import { texOf, prep, type Session } from '../cas/engine'
import { L, LANG } from '../../i18n'
import { fmt } from '../../lib/format'
import { useDebounced } from '../../lib/useLocalState'
import { uid, type GraphEntry, type Pane } from './doc'
import { classify, implicitGrid, sampleParam, sampleView, specialPoints, type Item, type View } from './grafica'

type GraphPane = Extract<Pane, { kind: 'graph' }>

const TIPO: Record<string, string> = { raíz: L('raíz', 'root'), máximo: L('máximo', 'maximum'), mínimo: L('mínimo', 'minimum'), intersección: L('intersección', 'intersection') }

/** TeX de la entrada para mostrarla debajo del campo (si se puede). */
function entryTex(src: string): string | null {
  try {
    const t = prep(src)
    const i = t.search(/(?<![<>=!])=(?!=)/)
    if (i > 0) return `${texOf(t.slice(0, i))} = ${texOf(t.slice(i + 1))}`
    return texOf(t)
  } catch {
    return null
  }
}

const decimalsOf = (step: number) => Math.max(0, Math.min(8, Math.ceil(-Math.log10(step) - 1e-9)))

export function AppGrafica({ pane, session, onChange }: { pane: GraphPane; session: Session; onChange: (p: GraphPane) => void }) {
  const set = (p: Partial<GraphPane>) => onChange({ ...pane, ...p })
  const setEntry = (id: string, p: Partial<GraphEntry>) => set({ entries: pane.entries.map((e) => (e.id === id ? { ...e, ...p } : e)) })
  const inputs = useRef(new Map<string, HTMLInputElement>())

  const items = useMemo(() => pane.entries.map((e) => classify(e.src, session)), [pane.entries, session])

  const addEntry = (after?: string) => {
    const used = new Set(pane.entries.map((e) => e.color))
    let color = 0
    while (used.has(color) && color < 7) color++
    const e: GraphEntry = { id: uid(), src: '', on: true, color }
    const i = after ? pane.entries.findIndex((x) => x.id === after) + 1 : pane.entries.length
    const entries = [...pane.entries.slice(0, i), e, ...pane.entries.slice(i)]
    set({ entries })
    requestAnimationFrame(() => inputs.current.get(e.id)?.focus())
  }
  const removeEntry = (id: string) => {
    const i = pane.entries.findIndex((e) => e.id === id)
    const entries = pane.entries.filter((e) => e.id !== id)
    set({ entries: entries.length ? entries : [{ id: uid(), src: '', on: true, color: 0 }] })
    const prev = entries[Math.max(0, i - 1)]
    if (prev) requestAnimationFrame(() => inputs.current.get(prev.id)?.focus())
  }

  return (
    <div className="gx">
      <div className="gx-algebra">
        {pane.entries.map((e, k) => {
          const it = items[k]
          const color = SERIES[e.color % SERIES.length]
          const tex = it.kind !== 'empty' && it.kind !== 'error' ? entryTex(e.src) : null
          const slider = it.kind === 'slider' ? (e.slider ?? autoSlider(it.value)) : null
          return (
            <div key={e.id} className={'gx-entry' + (it.kind === 'error' ? ' bad' : '')}>
              <button
                className={'gx-dot' + (e.on ? ' on' : '')}
                style={{ '--c': color } as any}
                title={e.on ? L('Ocultar', 'Hide') : L('Mostrar', 'Show')}
                onClick={() => setEntry(e.id, { on: !e.on })}
                disabled={it.kind === 'slider' || it.kind === 'def' || it.kind === 'empty'}
              />
              <div className="gx-main">
                <input
                  ref={(el) => {
                    if (el) inputs.current.set(e.id, el)
                    else inputs.current.delete(e.id)
                  }}
                  className="input mono gx-input"
                  data-palette="expr"
                  data-paste="cas"
                  value={e.src}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  placeholder={k === 0 ? L('f(x) = x^2, (1, 2), x^2 + y^2 = 4, a = 2…', 'f(x) = x^2, (1, 2), x^2 + y^2 = 4, a = 2…') : ''}
                  onChange={(ev) => setEntry(e.id, { src: ev.target.value })}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') {
                      ev.preventDefault()
                      const next = pane.entries[k + 1]
                      if (next) inputs.current.get(next.id)?.focus()
                      else addEntry(e.id)
                    } else if (ev.key === 'Backspace' && !e.src && pane.entries.length > 1) {
                      ev.preventDefault()
                      removeEntry(e.id)
                    } else if (ev.key === 'ArrowDown' && pane.entries[k + 1]) inputs.current.get(pane.entries[k + 1].id)?.focus()
                    else if (ev.key === 'ArrowUp' && pane.entries[k - 1]) inputs.current.get(pane.entries[k - 1].id)?.focus()
                  }}
                />
                {it.kind === 'error' && e.src.trim() ? <div className="gx-err">{it.msg}</div> : tex && it.kind !== 'slider' ? <div className="gx-tex"><Tex>{tex}</Tex></div> : null}
                {slider && it.kind === 'slider' && (
                  <div className="gx-slider">
                    <input className="gx-lim mono" value={slider.min} title={L('mínimo', 'minimum')} onChange={(ev) => Number.isFinite(Number(ev.target.value)) && ev.target.value.trim() !== '' && setEntry(e.id, { slider: { ...slider, min: Number(ev.target.value) } })} />
                    <input
                      type="range"
                      min={slider.min}
                      max={slider.max}
                      step={slider.step}
                      value={it.value}
                      onChange={(ev) => setEntry(e.id, { src: `${it.name} = ${Number(ev.target.value).toFixed(decimalsOf(slider.step))}`, slider })}
                    />
                    <input className="gx-lim mono" value={slider.max} title={L('máximo', 'maximum')} onChange={(ev) => Number.isFinite(Number(ev.target.value)) && ev.target.value.trim() !== '' && setEntry(e.id, { slider: { ...slider, max: Number(ev.target.value) } })} />
                  </div>
                )}
              </div>
              <button className="gx-x" title={L('Eliminar', 'Delete')} onClick={() => removeEntry(e.id)}>
                ✕
              </button>
            </div>
          )
        })}
        <button className="btn ghost sm gx-add" onClick={() => addEntry()}>
          + {L('Entrada', 'Entry')}
        </button>
        <div className="gx-help muted">
          {L('Funciones, puntos (1, 2), listas (t, v), curvas x² + y² = 4, paramétricas (cos(t), sin(t)) y deslizadores a = 2. Usa lo definido en las otras apps.', 'Functions, points (1, 2), lists (t, v), curves x² + y² = 4, parametric (cos(t), sin(t)) and sliders a = 2. Uses what the other apps define.')}
        </div>
      </div>
      <div className="gx-canvas">
        <div className="gx-tools">
          <label className="check sm">
            <input type="checkbox" checked={pane.equal} onChange={(e) => set({ equal: e.target.checked })} />
            <span>{L('Ejes 1:1', 'Axes 1:1')}</span>
          </label>
          <label className="check sm">
            <input type="checkbox" checked={pane.special} onChange={(e) => set({ special: e.target.checked })} />
            <span>{L('Raíces y extremos', 'Roots & extrema')}</span>
          </label>
          <button className="btn ghost sm" onClick={() => set({ view: { x: [-10, 10], y: [-7, 7] } })}>
            {L('⌂ Vista inicial', '⌂ Home view')}
          </button>
        </div>
        <Canvas pane={pane} items={items} onView={(view) => set({ view })} />
      </div>
    </div>
  )
}

function autoSlider(v: number) {
  const span = Math.max(5, Math.ceil(Math.abs(v) * 2))
  return { min: -span, max: span, step: 0.1 }
}

/* ─────────────── lienzo ─────────────── */

function Canvas({ pane, items, onView }: { pane: GraphPane; items: Item[]; onView: (v: View) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { dark } = useTheme()
  const view = useDebounced(pane.view, 60)
  const onViewRef = useRef(onView)
  onViewRef.current = onView
  // la vista sigue al usuario (arrastrar, rueda, zoom): se vuelve a muestrear con el nuevo rango
  const onRelayout = useRef(() => {
    const fl = (ref.current as any)?._fullLayout
    if (!fl?.xaxis?.range || !fl?.yaxis?.range) return
    const v: View = { x: [fl.xaxis.range[0], fl.xaxis.range[1]], y: [fl.yaxis.range[0], fl.yaxis.range[1]] }
    if ([...v.x, ...v.y].every(Number.isFinite)) onViewRef.current(v)
  })

  const data = useMemo(() => {
    const traces: any[] = []
    const fns: { label: string; f: (x: number) => number }[] = []
    pane.entries.forEach((e, k) => {
      const it = items[k]
      if (!e.on || !it) return
      const color = SERIES[e.color % SERIES.length]
      const hover = (lbl: string) => `${lbl}<br>(%{x:.6g}, %{y:.6g})<extra></extra>`
      switch (it.kind) {
        case 'fn': {
          const s = sampleView(it.f, view)
          traces.push({ x: s.x, y: s.y, type: 'scatter', mode: 'lines', line: { color, width: 2.6 }, name: it.label, hovertemplate: hover(it.label) })
          fns.push({ label: it.label, f: it.f })
          break
        }
        case 'vline': {
          const h = view.y[1] - view.y[0]
          traces.push({ x: [it.x, it.x], y: [view.y[0] - h, view.y[1] + h], type: 'scatter', mode: 'lines', line: { color, width: 2.6 }, name: it.label, hovertemplate: hover(it.label) })
          break
        }
        case 'implicit': {
          const g = implicitGrid(it.F, view)
          traces.push({ x: g.xs, y: g.ys, z: g.z, type: 'contour', contours: { start: 0, end: 0, size: 1, coloring: 'none' }, line: { color, width: 2.6, smoothing: 0.6 }, showscale: false, hoverinfo: 'skip', name: it.label })
          break
        }
        case 'param': {
          const s = sampleParam(it.fx, it.fy, it.t0, it.t1)
          traces.push({ ...s, type: 'scatter', mode: 'lines', line: { color, width: 2.6 }, name: it.label, hovertemplate: hover(it.label) })
          break
        }
        case 'point':
          traces.push({ x: [it.x], y: [it.y], type: 'scatter', mode: 'markers+text', text: [it.label.length <= 3 ? it.label : ''], textposition: 'top right', textfont: { color, size: 13 }, marker: { color, size: 10, line: { color: dark ? '#0b0f14' : '#fff', width: 1.5 } }, name: it.label, hovertemplate: hover(it.label) })
          break
        case 'points':
          traces.push({ x: it.xs, y: it.ys, type: 'scatter', mode: 'markers', marker: { color, size: 8, line: { color: dark ? '#0b0f14' : '#fff', width: 1 } }, name: it.label, hovertemplate: hover(it.label) })
          break
      }
    })
    if (pane.special && fns.length) {
      const sp = specialPoints(fns, view)
      if (sp.length)
        traces.push({
          x: sp.map((p) => p.x),
          y: sp.map((p) => p.y),
          type: 'scatter',
          mode: 'markers',
          marker: { size: 7, color: dark ? '#0b0f14' : '#fff', line: { color: dark ? '#cbd5e1' : '#334155', width: 1.8 } },
          text: sp.map((p) => `${TIPO[p.kind]} · ${p.of}<br>(${fmt(p.x, 8)}, ${fmt(p.y, 8)})`),
          hovertemplate: '%{text}<extra></extra>',
          name: L('puntos especiales', 'special points'),
        })
    }
    return traces
  }, [pane.entries, pane.special, items, view, dark])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fg = dark ? '#cbd5e1' : '#334155'
    const grid = dark ? 'rgba(148,163,184,0.16)' : 'rgba(100,116,139,0.2)'
    const zero = dark ? 'rgba(203,213,225,0.7)' : 'rgba(51,65,85,0.75)'
    const axis = { gridcolor: pane.grid ? grid : 'rgba(0,0,0,0)', zerolinecolor: zero, zerolinewidth: 1.4, linecolor: grid, tickfont: { size: 11 }, automargin: true, autorange: false }
    const layout: any = {
      margin: { l: 40, r: 12, t: 10, b: 30 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: '"Geist Variable", system-ui, sans-serif', color: fg, size: 12 },
      hoverlabel: { font: { family: '"Geist Mono Variable", ui-monospace, monospace', size: 12 } },
      showlegend: false,
      dragmode: 'pan',
      hovermode: 'closest',
      uirevision: pane.id,
      xaxis: { ...axis, range: [...pane.view.x] },
      yaxis: { ...axis, range: [...pane.view.y], ...(pane.equal ? { scaleanchor: 'x', scaleratio: 1 } : {}) },
    }
    Plotly.react(el, data, layout, { responsive: true, displaylogo: false, scrollZoom: true, locale: LANG, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toImage'] } as any).then((gd: any) => {
      // tras purgar (o en el primer dibujo) Plotly crea un emisor nuevo: registrar el evento una vez
      if (!gd._ev?.listenerCount?.('plotly_relayout')) gd.on('plotly_relayout', onRelayout.current)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dark, pane.equal, pane.grid, pane.id])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => el.isConnected && (el as any)._fullLayout && Plotly.Plots.resize(el))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const el = ref.current
    return () => {
      if (el) Plotly.purge(el)
    }
  }, [])
  return <div className="gx-plot" ref={ref} />
}
