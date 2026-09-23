// Interpretación geométrica de Ax = b (n = 2: rectas, n = 3: planos) y gráfica de costo O(n³).
import { useMemo } from 'react'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { fmt } from '../../lib/format'
import type { Mat, Vec } from './linalg'
import { gaussOps } from './algorithms'
import { Note } from './shared'

export function SystemPlot({ A, b, x }: { A: Mat; b: Vec; x: Vec | null }) {
  const n = A.length
  const data = useMemo(() => {
    if (n === 2) return lines2(A, b, x)
    if (n === 3) return planes3(A, b, x)
    return []
  }, [A, b, x, n])
  if (n !== 2 && n !== 3) return <Note>La interpretación geométrica sólo se dibuja para n = 2 (rectas) o n = 3 (planos). Tu sistema tiene n = {n}.</Note>
  return (
    <>
      {n === 2 ? (
        <Plot data={data} equalAxes layout={{ xaxis: { title: { text: 'x₁' } }, yaxis: { title: { text: 'x₂' } } }} />
      ) : (
        <Plot data={data} height={460} layout={{ scene: { xaxis: { title: { text: 'x₁' } }, yaxis: { title: { text: 'x₂' } }, zaxis: { title: { text: 'x₃' } }, aspectmode: 'cube' }, margin: { l: 0, r: 0, t: 10, b: 10 } }} />
      )}
      <Note>
        Cada ecuación es {n === 2 ? 'una recta' : 'un plano'}; la solución es su punto de intersección. {n === 2 ? 'Rectas casi paralelas' : 'Planos casi paralelos'} ⇒ sistema mal
        condicionado (pequeños cambios en los datos mueven mucho la intersección).
      </Note>
    </>
  )
}

function center(x: Vec | null, n: number): { c: Vec; R: number } {
  const c = x && x.every(Number.isFinite) ? x : new Array(n).fill(0)
  const R = Math.max(2, ...c.map((v) => Math.abs(v) * 0.6))
  return { c, R }
}

function lines2(A: Mat, b: Vec, x: Vec | null): Trace[] {
  const { c, R } = center(x, 2)
  const traces: Trace[] = A.map((r, i) => {
    const [a1, a2] = r
    let X: number[], Y: number[]
    if (Math.abs(a2) >= Math.abs(a1)) {
      X = [c[0] - R, c[0] + R]
      Y = X.map((t) => (b[i] - a1 * t) / a2)
    } else {
      Y = [c[1] - R, c[1] + R]
      X = Y.map((t) => (b[i] - a2 * t) / a1)
    }
    return { x: X, y: Y, type: 'scatter', mode: 'lines', name: `E${i + 1}: ${fmt(a1, 4)}x₁ + ${fmt(a2, 4)}x₂ = ${fmt(b[i], 4)}`, line: { color: SERIES[i], width: 2.5 } }
  })
  if (x) traces.push({ x: [x[0]], y: [x[1]], type: 'scatter', mode: 'markers+text', text: [`(${fmt(x[0], 5)}, ${fmt(x[1], 5)})`], textposition: 'top right', name: 'solución', marker: { color: SERIES[3], size: 12, symbol: 'star' } })
  return traces
}

function planes3(A: Mat, b: Vec, x: Vec | null): Trace[] {
  const { c, R } = center(x, 3)
  const K = 14
  const traces: Trace[] = A.map((r, i) => {
    // despejar la coordenada con mayor coeficiente
    const s = [0, 1, 2].reduce((p, j) => (Math.abs(r[j]) > Math.abs(r[p]) ? j : p), 0)
    const [u, v] = [0, 1, 2].filter((j) => j !== s)
    const G: number[][][] = [[], [], []]
    for (let a = 0; a < K; a++) {
      const rowU: number[] = [], rowV: number[] = [], rowS: number[] = []
      for (let bb = 0; bb < K; bb++) {
        const tu = c[u] - R + (2 * R * a) / (K - 1)
        const tv = c[v] - R + (2 * R * bb) / (K - 1)
        rowU.push(tu)
        rowV.push(tv)
        rowS.push(r[s] ? (b[i] - r[u] * tu - r[v] * tv) / r[s] : NaN)
      }
      G[u].push(rowU)
      G[v].push(rowV)
      G[s].push(rowS)
    }
    const col = SERIES[i]
    return { type: 'surface', x: G[0], y: G[1], z: G[2], opacity: 0.55, showscale: false, colorscale: [[0, col], [1, col]], name: `E${i + 1}`, showlegend: true, hoverinfo: 'name' }
  })
  if (x) traces.push({ type: 'scatter3d', mode: 'markers', x: [x[0]], y: [x[1]], z: [x[2]], name: 'solución', marker: { color: SERIES[3], size: 6 } })
  return traces
}

/** Gráfica log-log del número de operaciones vs n. */
export function CostPlot({ n, extra }: { n: number; extra?: { name: string; f: (n: number) => number }[] }) {
  const data = useMemo(() => {
    const ns = Array.from({ length: 60 }, (_, i) => Math.round(2 * Math.pow(500, i / 59)))
    const g = (m: number) => gaussOps(m).total
    const tr: Trace[] = [{ x: ns, y: ns.map(g), type: 'scatter', mode: 'lines', name: 'Gauss (tabla del texto) ≈ 2n³/3', line: { color: SERIES[0], width: 2.5 } }]
    ;(extra ?? []).forEach((e, i) => tr.push({ x: ns, y: ns.map(e.f), type: 'scatter', mode: 'lines', name: e.name, line: { color: SERIES[i + 1], width: 2, dash: 'dash' } }))
    tr.push({ x: [n], y: [g(n)], type: 'scatter', mode: 'markers+text', text: [`n = ${n}: ${Math.round(g(n))} operaciones`], textposition: 'top left', name: 'tu sistema', marker: { color: SERIES[3], size: 11 } })
    return tr
  }, [n, extra])
  return (
    <>
      <Plot data={data} layout={{ xaxis: { type: 'log', title: { text: 'n (tamaño del sistema)' } }, yaxis: { type: 'log', title: { text: 'operaciones' }, exponentformat: 'power' } }} />
      <Note>
        En escala log-log una ley de potencia es una recta: la pendiente 3 indica que el tiempo de cálculo es proporcional a <b>n³</b> (si n = 10 tarda 1 s, n = 100 tarda ≈ 1000 s).
        Con n = 1000 son ≈ 6.7·10⁸ operaciones; con n = 10⁶ serían ≈ 7·10¹⁷, por eso se usan métodos iterativos o estructuras especiales (tridiagonal, dispersa).
      </Note>
    </>
  )
}
