import { useEffect, useMemo, useRef, useState } from 'react'
import { compile, evalNumber, toScilab, type Compiled } from '../../lib/expr'
import { fmt } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, ExprField, FieldRow, MethodPage, NumField, parseVector, ScilabCode, Stats, Steps, Tabs, VectorField, type Column } from '../../components/ui'
import * as A from './algorithms'
import { tn } from './sym'
import { vecTex, type Step } from './shared'
import { DESCRIPTIONS, THEORY, TITLES, TOPIC } from './theory'

export interface State {
  xT: string
  yT: string
  zT: string
  M0: string
  vM: string
  eps: string
  tMax: string
  h: string
}

const EXAMPLES: { label: string; value: Partial<State> }[] = [
  { label: 'Hélice ascendente', value: { xT: '10cos(0.5t)', yT: '10sin(0.5t)', zT: 't', M0: '0 -15 0', vM: '8', eps: '0.05', tMax: '30', h: '0.002' } },
  { label: 'Bouguer 2D (T = 20/3)', value: { xT: '0', yT: 't', zT: '0', M0: '10 0 0', vM: '2', eps: '0.002', tMax: '10', h: '0.0005' } },
  { label: 'Blanco en círculo', value: { xT: '20cos(t/4)', yT: '20sin(t/4)', zT: '0', M0: '0 0 0', vM: '6', eps: '0.05', tMax: '40', h: '0.002' } },
  { label: 'Avión evasivo', value: { xT: '3t', yT: '15 + 5sin(t)', zT: '10 + 2cos(2t)', M0: '0 0 0', vM: '8', eps: '0.05', tMax: '40', h: '0.002' } },
  { label: 'Misil lento (sin captura)', value: { xT: '10cos(0.5t)', yT: '10sin(0.5t)', zT: 't', M0: '0 -15 0', vM: '4.5', eps: '0.05', tMax: '40', h: '0.004' } },
]

export function Misil() {
  const [s, setS] = useLocalState<State>('edo:misil', EXAMPLES[0].value as State)
  const set = (p: Partial<State>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 300)
  const calc = useMemo(() => compute(d), [d])

  const inputs = (
    <>
      <ExprField label="Blanco: x_T(t)" value={s.xT} onChange={(xT) => set({ xT })} vars={['t']} texPrefix="x_T(t) =" />
      <ExprField label="Blanco: y_T(t)" value={s.yT} onChange={(yT) => set({ yT })} vars={['t']} texPrefix="y_T(t) =" />
      <ExprField label="Blanco: z_T(t)" value={s.zT} onChange={(zT) => set({ zT })} vars={['t']} texPrefix="z_T(t) =" hint="Usa z_T = 0 para un problema plano" />
      <VectorField label={<>Posición inicial del misil <Tex>{'\\mathbf r_M(0)'}</Tex></>} value={s.M0} onChange={(M0) => set({ M0 })} hint="x y z" />
      <FieldRow>
        <NumField label={<>Rapidez <Tex>{'v_M'}</Tex></>} value={s.vM} onChange={(vM) => set({ vM })} />
        <NumField label={<>Captura <Tex>\varepsilon</Tex></>} value={s.eps} onChange={(eps) => set({ eps })} />
      </FieldRow>
      <FieldRow>
        <NumField label={<Tex>{'t_{max}'}</Tex>} value={s.tMax} onChange={(tMax) => set({ tMax })} />
        <NumField label="Paso h (RK4)" value={s.h} onChange={(h) => set({ h })} />
      </FieldRow>
      <Examples items={EXAMPLES} onPick={(v) => set(v)} />
    </>
  )

  return (
    <MethodPage title={TITLES.misil} topic={TOPIC} description={DESCRIPTIONS.misil} theory={THEORY.misil} inputs={inputs}>
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <Results c={calc} s={d} />}
    </MethodPage>
  )
}

export interface Calc {
  res: A.PursuitResult
  target: (t: number) => number[]
  vM: number
  h: number
  eps: number
  vTmax: number
  vTmean: number
  warn: string[]
  cs: Compiled[]
}

export function compute(s: State): { error: string } | Calc {
  const cs = [s.xT, s.yT, s.zT].map((e) => compile(e, ['t']))
  for (let i = 0; i < 3; i++) {
    const c = cs[i]
    if (!c.ok) return { error: `${'xyz'[i]}_T(t): ${c.error}` }
  }
  const fs = (cs as Compiled[]).map((c) => c.f)
  const target = (t: number) => fs.map((f) => f(t))
  const M0 = parseVector(s.M0)
  if (!M0 || M0.length !== 3) return { error: 'La posición inicial del misil debe tener 3 componentes (x y z).' }
  const vM = evalNumber(s.vM), eps = evalNumber(s.eps), tMax = evalNumber(s.tMax), h = evalNumber(s.h)
  if (!(vM > 0)) return { error: 'La rapidez del misil v_M debe ser positiva.' }
  if (!(eps > 0)) return { error: 'El radio de captura ε debe ser positivo.' }
  if (!(tMax > 0)) return { error: 't_max debe ser positivo.' }
  if (!(h > 0)) return { error: 'El paso h debe ser positivo.' }
  if (tMax / h > A.MAX_STEPS) return { error: `Se necesitarían ${Math.ceil(tMax / h)} pasos (máximo ${A.MAX_STEPS}). Aumenta h o reduce t_max.` }
  const warn: string[] = []
  if (vM * h > eps) warn.push(`El misil avanza v_M·h = ${fmt(vM * h, 4)} por paso, más que ε = ${fmt(eps, 4)}: podría “saltarse” la captura. Reduce h.`)
  // rapidez del blanco (diferencias centradas)
  let vTmax = 0, vTsum = 0, cnt = 0
  const dt = 1e-5
  for (let k = 0; k <= 200; k++) {
    const t = (tMax * k) / 200
    const a = target(t + dt), b = target(t - dt)
    const v = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / (2 * dt)
    if (Number.isFinite(v)) {
      vTmax = Math.max(vTmax, v)
      vTsum += v
      cnt++
    }
  }
  const vTmean = cnt ? vTsum / cnt : NaN
  if (vM <= vTmax) warn.push(`La rapidez del misil (${fmt(vM, 4)}) no supera la rapidez máxima del blanco (≈ ${fmt(vTmax, 4)}): la captura no está garantizada.`)
  const res = A.pursuit(target, M0, vM, 0, tMax, h, eps)
  return { res, target, vM, h, eps, vTmax, vTmean, warn, cs: cs as Compiled[] }
}


function Pursuit3D({ res, idx, full }: { res: A.PursuitResult; idx: number[]; full: Record<'Mx' | 'My' | 'Mz' | 'Tx' | 'Ty' | 'Tz', number[]> }) {
  const nF = idx.length
  const [frame, setFrame] = useState(nF - 1)
  const [playing, setPlaying] = useState(false)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    setFrame(nF - 1)
    setPlaying(false)
  }, [res])
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const speed = nF / 8000 // ~8 s en total
    let f = frame >= nF - 1 ? 0 : frame
    const tick = (now: number) => {
      f = Math.min(nF - 1, f + (now - last) * speed)
      last = now
      setFrame(Math.floor(f))
      if (f >= nF - 1) setPlaying(false)
      else raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [playing])

  const fi = Math.min(frame, nF - 1)
  const cur = idx[fi]

  const data3d = useMemo(() => {
    const k = fi + 1
    const tr: Trace[] = [
      { x: full.Tx, y: full.Ty, z: full.Tz, type: 'scatter3d', mode: 'lines', name: 'blanco (ruta)', showlegend: false, line: { color: SERIES[1], width: 2 }, opacity: 0.25, hoverinfo: 'skip' },
      { x: full.Mx, y: full.My, z: full.Mz, type: 'scatter3d', mode: 'lines', name: 'misil (ruta)', showlegend: false, line: { color: SERIES[0], width: 2 }, opacity: 0.25, hoverinfo: 'skip' },
      { x: full.Tx.slice(0, k), y: full.Ty.slice(0, k), z: full.Tz.slice(0, k), type: 'scatter3d', mode: 'lines', name: 'blanco', line: { color: SERIES[1], width: 6 } },
      { x: full.Mx.slice(0, k), y: full.My.slice(0, k), z: full.Mz.slice(0, k), type: 'scatter3d', mode: 'lines', name: 'misil', line: { color: SERIES[0], width: 6 } },
      { x: [res.T[cur][0], res.M[cur][0]], y: [res.T[cur][1], res.M[cur][1]], z: [res.T[cur][2], res.M[cur][2]], type: 'scatter3d', mode: 'lines', name: 'línea de visión', line: { color: 'rgba(148,163,184,0.8)', width: 2, dash: 'dash' } },
      { x: [res.T[cur][0]], y: [res.T[cur][1]], z: [res.T[cur][2]], type: 'scatter3d', mode: 'markers', name: 'blanco (t)', showlegend: false, marker: { color: SERIES[1], size: 6, symbol: 'diamond' } },
      { x: [res.M[cur][0]], y: [res.M[cur][1]], z: [res.M[cur][2]], type: 'scatter3d', mode: 'markers', name: 'misil (t)', showlegend: false, marker: { color: SERIES[0], size: 5 } },
    ]
    if (res.captured && fi === nF - 1) tr.push({ x: [res.pCapture[0]], y: [res.pCapture[1]], z: [res.pCapture[2]], type: 'scatter3d', mode: 'markers', name: 'captura', marker: { color: SERIES[6], size: 8, symbol: 'x' } })
    return tr
  }, [full, fi, res])

  return (
              <Card>
                <div className="edo-anim">
                  <button className="btn sm primary" onClick={() => setPlaying(!playing)}>
                    {playing ? '❚❚ Pausa' : '▶ Animar'}
                  </button>
                  <input type="range" min={0} max={nF - 1} value={fi} onChange={(e) => (setPlaying(false), setFrame(Number(e.target.value)))} />
                  <span className="mono">t = {fmt(res.t[cur], 5)}</span>
                </div>
                <Plot data={data3d} height={540} layout={{ uirevision: 'misil', margin: { l: 0, r: 0, t: 10, b: 0 }, scene: { aspectmode: 'data', xaxis: { title: { text: 'x' } }, yaxis: { title: { text: 'y' } }, zaxis: { title: { text: 'z' } } } }} />
                <p className="muted edo-note">Arrastra para rotar. La línea discontinua es la línea de visión: la velocidad del misil siempre apunta en esa dirección.</p>
              </Card>
  )
}

function Results({ c, s }: { c: Calc; s: State }) {
  const { res } = c
  const idx = useMemo(() => A.thinIdx(res.t.length, 1200), [res])
  const nF = idx.length
  const full = useMemo(() => {
    const col = (arr: number[][], m: number) => idx.map((i) => arr[i][m])
    return { Mx: col(res.M, 0), My: col(res.M, 1), Mz: col(res.M, 2), Tx: col(res.T, 0), Ty: col(res.T, 1), Tz: col(res.T, 2) }
  }, [res, idx])

  const distPlot = useMemo(
    () =>
      [
        { x: idx.map((i) => res.t[i]), y: idx.map((i) => res.dist[i]), type: 'scatter', mode: 'lines', name: '|r_T − r_M|', line: { color: SERIES[2], width: 2 } },
        { x: [res.t[0], res.t[res.t.length - 1]], y: [c.eps, c.eps], type: 'scatter', mode: 'lines', name: 'ε', line: { color: SERIES[6], dash: 'dot' } },
      ] as Trace[],
    [res, idx],
  )

  const xyPlot = useMemo(
    () =>
      [
        { x: full.Tx, y: full.Ty, type: 'scatter', mode: 'lines', name: 'blanco', line: { color: SERIES[1], width: 2 } },
        { x: full.Mx, y: full.My, type: 'scatter', mode: 'lines', name: 'misil', line: { color: SERIES[0], width: 2 } },
        ...idx
          .filter((_, j) => j % Math.max(1, Math.floor(nF / 14)) === 0)
          .map((i, j) => ({ x: [res.M[i][0], res.T[i][0]], y: [res.M[i][1], res.T[i][1]], type: 'scatter', mode: 'lines', name: 'visual', showlegend: j === 0, legendgroup: 'v', line: { color: 'rgba(148,163,184,0.5)', width: 1, dash: 'dot' } })),
      ] as Trace[],
    [full, res, idx],
  )

  const rows = useMemo(
    () => A.thinIdx(res.t.length, 1001).map((i) => ({ i, t: res.t[i], mx: res.M[i][0], my: res.M[i][1], mz: res.M[i][2], tx: res.T[i][0], ty: res.T[i][1], tz: res.T[i][2], d: res.dist[i] })),
    [res],
  )
  const cols: Column<any>[] = [
    { key: 'i', tex: 'i', fmt: 'int', align: 'center' },
    { key: 't', tex: 't_i' },
    { key: 'mx', tex: 'x_M' },
    { key: 'my', tex: 'y_M' },
    { key: 'mz', tex: 'z_M' },
    { key: 'tx', tex: 'x_T' },
    { key: 'ty', tex: 'y_T' },
    { key: 'tz', tex: 'z_T' },
    { key: 'd', tex: '\\lVert \\mathbf r_T - \\mathbf r_M\\rVert' },
  ]

  const tEnd = res.captured ? res.tCapture : res.t[res.t.length - 1]
  return (
    <>
      <Stats
        items={[
          { label: 'Captura', value: res.captured ? `t ≈ ${fmt(res.tCapture, 8)}` : 'No', accent: true, hint: res.captured ? 'instante de intercepción' : `hasta t = ${fmt(res.t[res.t.length - 1], 5)}` },
          { label: res.captured ? 'Punto de captura' : 'Distancia mínima', value: res.captured ? res.pCapture.map((x) => fmt(x, 5)).join(', ') : fmt(res.minDist, 6), hint: res.captured ? '(x, y, z)' : `en t ≈ ${fmt(res.tMin, 5)}` },
          { label: 'Recorrido del misil', value: fmt(c.vM * tEnd, 6), hint: 'v_M · t (rapidez constante)' },
          { label: 'Rapidez del blanco', value: fmt(c.vTmax, 5), hint: `máxima (media ${fmt(c.vTmean, 4)})` },
        ]}
      />
      {c.warn.map((w, i) => (
        <Alert key={i} kind="warn">
          {w}
        </Alert>
      ))}
      <Alert kind={!res.ok ? 'error' : res.captured ? 'ok' : 'warn'}>{res.message}</Alert>
      <Tabs
        tabs={[
          {
            label: 'Trayectorias 3D',
            content: (
              <Pursuit3D res={res} idx={idx} full={full} />
            ),
          },
          { label: 'Distancia vs t', content: <Card><Plot data={distPlot} layout={{ xaxis: { title: { text: 't' } }, yaxis: { title: { text: 'distancia' }, rangemode: 'tozero' } }} /></Card> },
          { label: 'Proyección XY', content: <Card><Plot data={xyPlot} equalAxes height={440} layout={{ xaxis: { title: { text: 'x' } }, yaxis: { title: { text: 'y' } } }} /></Card> },
          { label: 'Paso a paso', content: <Card><Steps steps={steps(c, s)} /></Card> },
        ]}
      />
      <Card title="Tabla (misil y blanco)">
        {res.t.length > 1001 && <p className="muted edo-note">Se muestran 1001 de {res.t.length} filas (muestreo uniforme).</p>}
        <DataTable columns={cols} rows={rows} filename="misil" />
      </Card>
      <ScilabCode code={scilab(s)} filename="misil_persecucion" />
    </>
  )
}

export function steps(c: Calc, s: State): Step[] {
  const { res, h, vM, target } = c
  const out: Step[] = [
    { text: 'Modelo (persecución pura):', tex: `\\mathbf r_M' = \\mathbf F(t, \\mathbf r_M) = v_M\\frac{\\mathbf r_T(t) - \\mathbf r_M}{\\lVert\\mathbf r_T(t) - \\mathbf r_M\\rVert},\\qquad \\mathbf r_T(t) = \\begin{bmatrix}${c.cs.map((x) => x.tex).join('\\\\')}\\end{bmatrix},\\quad v_M = ${tn(vM)}` },
    { text: 'RK4 con paso h:', tex: `h = ${tn(h)},\\quad \\mathbf r_{i+1} = \\mathbf r_i + \\tfrac h6(\\mathbf k_1 + 2\\mathbf k_2 + 2\\mathbf k_3 + \\mathbf k_4)` },
  ]
  const cs = [0, 0.5, 0.5, 1]
  const as = [0, 0.5, 0.5, 1]
  for (let i = 0; i < Math.min(2, res.k.length); i++) {
    const ks = res.k[i]
    const ti = res.t[i], ri = res.M[i]
    out.push({ text: <>Paso {i + 1}: <Tex>{`t_{${i}} = ${tn(ti)},\\; \\mathbf r_{${i}} = ${vecTex(ri, 7)}`}</Tex></> })
    ks.forEach((k, j) => {
      const tj = ti + cs[j] * h
      const rj = j === 0 ? ri : ri.map((x, m) => x + as[j] * h * ks[j - 1][m])
      const T = target(tj)
      const dv = T.map((x, m) => x - rj[m])
      const nd = Math.hypot(...dv)
      out.push({
        tex: `\\mathbf k_{${j + 1}}:\\; t = ${tn(tj)},\\; \\mathbf r = ${vecTex(rj, 7)},\\; \\mathbf r_T = ${vecTex(T, 7)},\\; \\mathbf d = \\mathbf r_T - \\mathbf r = ${vecTex(dv, 7)},\\; \\lVert\\mathbf d\\rVert = ${tn(nd, 7)} \\Rightarrow \\mathbf k_{${j + 1}} = ${tn(vM)}\\frac{\\mathbf d}{\\lVert\\mathbf d\\rVert} = ${vecTex(k, 7)}`,
      })
    })
    out.push({ tex: `\\mathbf r_{${i + 1}} = ${vecTex(ri, 7)} + \\frac{${tn(h)}}{6}\\left(\\mathbf k_1 + 2\\mathbf k_2 + 2\\mathbf k_3 + \\mathbf k_4\\right) = ${vecTex(res.M[i + 1], 8)},\\qquad \\lVert \\mathbf r_T(t_{${i + 1}}) - \\mathbf r_{${i + 1}}\\rVert = ${tn(res.dist[i + 1], 7)}` })
  }
  out.push({ text: `Se repite hasta que la distancia sea menor que ε = ${s.eps}${res.captured ? ` (ocurre en el paso ${res.t.length - 1}; t ≈ ${fmt(res.tCapture, 8)} interpolando linealmente la distancia).` : '.'}` })
  return out
}

export function scilab(s: State): string {
  const X = (e: string) => toScilab(e, false)
  const M0 = parseVector(s.M0) ?? [0, 0, 0]
  return `// Misil de persecución en R^3 (curva de persecución pura) — RK4 — generado por NumLab
clear; clc;

vM = ${X(s.vM)};      // rapidez del misil
epsc = ${X(s.eps)};   // distancia de captura
h = ${X(s.h)}; tmax = ${X(s.tMax)};

function r = blanco(t)
  r = [${X(s.xT)}; ${X(s.yT)}; ${X(s.zT)}];
endfunction

function dr = F(t, r)
  d = blanco(t) - r;
  dr = vM * d / norm(d);
endfunction

t = 0; r = [${M0.join('; ')}];
T = t; RM = r; RT = blanco(t);
capturado = %f;
while t < tmax
  k1 = F(t, r);
  k2 = F(t + h/2, r + h/2*k1);
  k3 = F(t + h/2, r + h/2*k2);
  k4 = F(t + h, r + h*k3);
  r = r + h/6*(k1 + 2*k2 + 2*k3 + k4);
  t = t + h;
  T($+1) = t; RM(:,$+1) = r; RT(:,$+1) = blanco(t);
  if norm(blanco(t) - r) < epsc then
    capturado = %t;
    break;
  end
end

if capturado then
  mprintf('Captura en t = %.6f en el punto (%.4f, %.4f, %.4f)\\n', t, r(1), r(2), r(3));
else
  mprintf('Sin captura hasta t = %.4f\\n', t);
end

scf(0); clf();
param3d(RT(1,:), RT(2,:), RT(3,:));
e = gce(); e.foreground = color('orange'); e.thickness = 2;
param3d(RM(1,:), RM(2,:), RM(3,:));
e = gce(); e.foreground = color('blue'); e.thickness = 2;
legend('blanco', 'misil');
title('Persecución en R^3');

scf(1); clf();
D = sqrt(sum((RT - RM).^2, 'r'));
plot(T', D); xlabel('t'); ylabel('distancia');
`
}
