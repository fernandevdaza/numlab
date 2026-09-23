import Plotly from 'plotly.js-dist-min'
import { useEffect, useRef } from 'react'
import { useTheme } from './theme'
import { sampleFn, type SamplePoint } from '../lib/plotmath'
import { SERIES } from './palette'

export type Trace = Record<string, any>

interface Props {
  data: Trace[]
  layout?: Record<string, any>
  height?: number
  /** Ejes con la misma escala (útil para trayectorias). */
  equalAxes?: boolean
}

/** Colores de series, consistentes en claro/oscuro (ver palette.ts). */
export { SERIES, SERIES_DARK, SERIES_LIGHT } from './palette'

export function Plot({ data, layout, height = 380, equalAxes }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { dark } = useTheme()
  useEffect(() => {
    if (!ref.current) return
    const fg = dark ? '#cbd5e1' : '#334155'
    const grid = dark ? 'rgba(148,163,184,0.14)' : 'rgba(100,116,139,0.18)'
    const zero = dark ? 'rgba(203,213,225,0.45)' : 'rgba(51,65,85,0.5)'
    const narrow = (ref.current.clientWidth || 800) < 560
    const legendItems = new Set(data.filter((t) => t && t.showlegend !== false && t.name && t.visible !== false).map((t) => t.legendgroup || t.name)).size
    const axis = { gridcolor: grid, zerolinecolor: zero, linecolor: grid, tickfont: { size: 11 }, automargin: true }
    // Leyenda debajo de todo (referida al contenedor): Plotly amplía el margen inferior para que no
    // choque con las etiquetas ni el título del eje x, y la barra de herramientas (arriba) queda libre.
    const legend = {
      orientation: 'h',
      x: 0,
      xanchor: 'left',
      y: 0,
      yanchor: 'bottom',
      yref: 'container',
      bgcolor: 'rgba(0,0,0,0)',
      font: { size: narrow ? 10.5 : 11.5 },
      ...(narrow ? { itemwidth: 30 } : {}),
      // en pantallas angostas con muchas series: dos columnas en vez de una lista larga
      ...(narrow && legendItems > 3 ? { entrywidth: 0.5, entrywidthmode: 'fraction' } : {}),
      ...(layout?.legend ?? {}),
    }
    const L: any = {
      height,
      margin: { l: 55, r: 20, t: layout?.title ? 40 : 16, b: 45 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif', color: fg, size: 12 },
      hoverlabel: { font: { family: 'Geist Mono, ui-monospace, monospace', size: 12 } },
      colorway: [...SERIES],
      modebar: { bgcolor: 'rgba(0,0,0,0)', color: dark ? 'rgba(203,213,225,0.55)' : 'rgba(51,65,85,0.5)', activecolor: SERIES[0] },
      hovermode: 'closest',
      ...layout,
      legend,
      xaxis: { ...axis, ...(layout?.xaxis ?? {}) },
      yaxis: { ...axis, ...(equalAxes ? { scaleanchor: 'x' } : {}), ...(layout?.yaxis ?? {}) },
    }
    // Asíntotas: si alguna traza trae un rango sugerido (sampleFn detectó un polo) y la página no
    // fijó uno, se usa ese rango para que los valores que explotan no aplasten la curva.
    const yr = layout?.yaxis?.range
    if (!yr && layout?.yaxis?.type !== 'log' && !layout?.scene) {
      const hints = data.map((t) => t?.meta?.yrange).filter((r): r is [number, number] => Array.isArray(r))
      if (hints.length) {
        let lo = Math.min(...hints.map((r) => r[0]))
        let hi = Math.max(...hints.map((r) => r[1]))
        const H = hi - lo
        // incluir marcadores (raíces, iteraciones…) que queden razonablemente cerca
        for (const t of data) {
          if (t?.meta?.yrange || !Array.isArray(t?.y) || t.y.length > 60) continue
          for (const v of t.y) if (typeof v === 'number' && Number.isFinite(v) && v > lo - 5 * H && v < hi + 5 * H) (lo = Math.min(lo, v)), (hi = Math.max(hi, v))
        }
        L.yaxis = { ...L.yaxis, range: [lo, hi], autorange: false }
      }
    }
    if (layout?.scene) {
      const { automargin: _am, ...axis3 } = axis
      const sa = { ...axis3, backgroundcolor: 'rgba(0,0,0,0)', showbackground: false }
      L.scene = { xaxis: sa, yaxis: sa, zaxis: sa, ...layout.scene }
    }
    Plotly.react(ref.current, data as any, L, { responsive: true, displaylogo: false, locale: 'es' } as any)
  }, [data, layout, height, dark, equalAxes])
  useEffect(() => {
    const el = ref.current
    return () => {
      if (el) Plotly.purge(el)
    }
  }, [])
  return <div className="plot" ref={ref} style={{ minHeight: height }} />
}

/**
 * Muestrea una función en [a,b] para graficar: malla de `n` puntos + refinamiento adaptativo
 * (picos, oscilaciones) + corte de la línea sólo en discontinuidades reales (asíntotas, saltos).
 * Ver src/lib/plotmath.ts.
 */
export function sample(f: (x: number) => number, a: number, b: number, n = 600): SamplePoint {
  return sampleFn(f, a, b, { n: Math.max(n, 300) })
}

/** Rango [min, max] de una muestra para fijar ejes; respeta el rango sugerido si hubo asíntotas. */
export function sampleRange(s: SamplePoint): [number, number] {
  if (s.meta?.yrange) return s.meta.yrange
  const v = s.y.filter((t): t is number => t !== null)
  return v.length ? [Math.min(...v), Math.max(...v)] : [-1, 1]
}
