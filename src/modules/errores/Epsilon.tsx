import { useMemo } from 'react'
import { evalNumber } from '../../lib/expr'
import { fmt } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, DataTable, Examples, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs } from '../../components/ui'
import './errores.css'
import * as F from './float'
import { THEORY, TITLES, TOPIC } from './theory'

interface S {
  x0: string
  factor: '2' | '10'
  view: 'ambas' | '64' | '32' | '16'
}

export function Epsilon() {
  const [s, setS] = useLocalState<S>('errores:epsilon', { x0: '1', factor: '2', view: 'ambas' })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 200)

  const calc = useMemo(() => {
    const x0 = evalNumber(d.x0)
    if (!Number.isFinite(x0) || x0 === 0) return { error: 'x₀ debe ser un número finito distinto de 0.' }
    const fac = Number(d.factor)
    const r64 = F.epsLoop(64, x0, fac)
    const r32 = F.epsLoop(32, x0, fac)
    const r16 = F.epsLoop(16, x0, fac)
    return { x0, r64, r32, r16, fac }
  }, [d])

  const inputs = (
    <>
      <NumField label="Punto base x₀" value={s.x0} onChange={(x0) => set({ x0 })} hint="El ε clásico usa x₀ = 1. Con otro x₀ el bucle mide el espaciado (ulp) cerca de x₀." />
      <SelectField
        label="Dividir ε en cada paso entre"
        value={s.factor}
        onChange={(factor) => set({ factor })}
        options={[
          { value: '2', label: '2 (potencias de 2: resultado exacto)' },
          { value: '10', label: '10 (sólo cota del orden de magnitud)' },
        ]}
      />
      <SelectField
        label="Tabla"
        value={s.view}
        onChange={(view) => set({ view })}
        options={[
          { value: 'ambas', label: 'Media, simple y doble lado a lado' },
          { value: '64', label: 'Sólo doble' },
          { value: '32', label: 'Sólo simple' },
          { value: '16', label: 'Sólo media' },
        ]}
      />
      <Examples
        items={[
          { label: 'ε clásico (x₀ = 1)', value: { x0: '1', factor: '2' as const } },
          { label: 'Espaciado cerca de 1000', value: { x0: '1000', factor: '2' as const } },
          { label: 'Cerca de 2⁵³', value: { x0: '2^53', factor: '2' as const } },
          { label: 'Dividiendo entre 10', value: { x0: '1', factor: '10' as const } },
        ]}
        onPick={(v) => set(v)}
      />
    </>
  )

  return (
    <MethodPage title={TITLES.epsilon} topic={TOPIC} theory={THEORY.epsilon} inputs={inputs} description="El menor ε tal que 1 + ε > 1 en la máquina: el bucle clásico en simple y doble precisión, y cómo cambia el espaciado de los flotantes con la magnitud.">
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <Results c={calc} s={d} />}
    </MethodPage>
  )
}

function Results({ c, s }: { c: any; s: S }) {
  const r64: { rows: F.EpsRow[]; eps: number } = c.r64
  const r32: { rows: F.EpsRow[]; eps: number } = c.r32
  const r16: { rows: F.EpsRow[]; eps: number } = c.r16
  const x0: number = c.x0
  const classic = x0 === 1 && c.fac === 2
  const rows = useMemo(() => {
    const n = Math.max(r64.rows.length, r32.rows.length, r16.rows.length)
    return Array.from({ length: n }, (_, k) => ({ k, e64: r64.rows[k]?.eps, s64: r64.rows[k]?.sum, g64: r64.rows[k]?.greater, e32: r32.rows[k]?.eps, s32: r32.rows[k]?.sum, g32: r32.rows[k]?.greater, e16: r16.rows[k]?.eps, s16: r16.rows[k]?.sum, g16: r16.rows[k]?.greater }))
  }, [r64, r32, r16])
  const yes = (g: boolean | undefined) => (g === undefined ? '' : g ? '✓ sí' : '✗ no → parar')
  const cols =
    s.view === '16'
      ? [
          { key: 'k', tex: 'k', fmt: 'int' as const, align: 'center' as const },
          { key: 'e16', tex: '\\varepsilon_k', fmt: 'err' as const },
          { key: 's16', tex: 'fl(x_0+\\varepsilon_k)', get: (r: any) => (r.s16 === undefined ? '' : F.shortest(r.s16, 16)) },
          { key: 'g16', tex: '> x_0 ?', get: (r: any) => yes(r.g16), align: 'center' as const },
        ]
      : s.view === '32'
      ? [
          { key: 'k', tex: 'k', fmt: 'int' as const, align: 'center' as const },
          { key: 'e32', tex: '\\varepsilon_k', fmt: 'err' as const },
          { key: 's32', tex: 'fl(x_0+\\varepsilon_k)', get: (r: any) => (r.s32 === undefined ? '' : F.shortest(r.s32, 32)) },
          { key: 'g32', tex: '> x_0 ?', get: (r: any) => yes(r.g32), align: 'center' as const },
        ]
      : s.view === '64'
        ? [
            { key: 'k', tex: 'k', fmt: 'int' as const, align: 'center' as const },
            { key: 'e64', tex: '\\varepsilon_k', fmt: 'err' as const },
            { key: 's64', tex: 'fl(x_0+\\varepsilon_k)', get: (r: any) => (r.s64 === undefined ? '' : r.s64.toPrecision(17)) },
            { key: 'g64', tex: '> x_0 ?', get: (r: any) => yes(r.g64), align: 'center' as const },
          ]
        : [
            { key: 'k', tex: 'k', fmt: 'int' as const, align: 'center' as const },
            { key: 'e16', tex: '\\varepsilon_k\\ \\text{(media)}', fmt: 'err' as const },
            { key: 'g16', tex: '\\text{media: } >x_0?', get: (r: any) => yes(r.g16), align: 'center' as const },
            { key: 'e32', tex: '\\varepsilon_k\\ \\text{(simple)}', fmt: 'err' as const },
            { key: 'g32', tex: '\\text{simple: } >x_0?', get: (r: any) => yes(r.g32), align: 'center' as const },
            { key: 'e64', tex: '\\varepsilon_k\\ \\text{(doble)}', fmt: 'err' as const },
            { key: 'g64', tex: '\\text{doble: } >x_0?', get: (r: any) => yes(r.g64), align: 'center' as const },
          ]

  const plot = useMemo(() => {
    const xs: number[] = []
    for (let k = -30; k <= 30; k += 0.02) xs.push(10 ** k)
    const t: Trace[] = []
    const NAME = { 64: 'doble', 32: 'simple', 16: 'media' } as const
    const COL = { 64: SERIES[0], 32: SERIES[1], 16: SERIES[2] } as const
    for (const p of [64, 32, 16] as F.Prec[]) {
      const xx = p === 32 ? xs.filter((v) => v < 3e38 && v > 1.2e-38) : p === 16 ? xs.filter((v) => v < 65000 && v > 6.2e-5) : xs
      t.push({ x: xx, y: xx.map((v) => F.ulp(F.roundP(v, p), p) / F.roundP(v, p)), type: 'scatter', mode: 'lines', name: `ulp(x)/x ${NAME[p]}`, line: { color: COL[p], width: 1.5, shape: 'hv' } })
    }
    t.push({ x: [1e-30, 1e30], y: [F.EPS[64], F.EPS[64]], type: 'scatter', mode: 'lines', name: 'ε doble', line: { color: SERIES[0], dash: 'dot', width: 1 } })
    t.push({ x: [1e-30, 1e30], y: [F.EPS[32], F.EPS[32]], type: 'scatter', mode: 'lines', name: 'ε simple', line: { color: SERIES[1], dash: 'dot', width: 1 } })
    t.push({ x: [1e-30, 1e30], y: [F.EPS[16], F.EPS[16]], type: 'scatter', mode: 'lines', name: 'ε media', line: { color: SERIES[2], dash: 'dot', width: 1 } })
    return t
  }, [])

  const plotAbs = useMemo(() => {
    const xs: number[] = []
    for (let k = 0; k <= 400; k++) xs.push(0.25 + (k / 400) * 7.75)
    return [
      { x: xs, y: xs.map((v) => F.ulp(v, 32)), type: 'scatter', mode: 'lines', name: 'ulp(x) simple', line: { color: SERIES[1], shape: 'hv' } },
    ] as Trace[]
  }, [])

  return (
    <>
      <Stats
        items={[
          { label: 'ε doble (64 bits)', value: r64.eps.toExponential(6), accent: true, hint: classic ? '= 2^−52 = %eps de Scilab' : `ulp cerca de x₀: ${F.ulp(x0, 64).toExponential(4)}` },
          { label: 'ε simple (32 bits)', value: r32.eps.toExponential(6), hint: classic ? '= 2^−23' : `ulp cerca de x₀: ${F.ulp(Math.fround(x0), 32).toExponential(4)}` },
          { label: 'ε media (16 bits)', value: r16.eps.toExponential(6), hint: classic ? '= 2^−10' : `ulp cerca de x₀: ${F.ulp(F.roundP(x0, 16), 16).toExponential(4)}` },
          { label: 'Iteraciones', value: `${r64.rows.length} / ${r32.rows.length} / ${r16.rows.length}`, hint: 'doble / simple / media' },
          { label: 'Unidad de redondeo u', value: (F.EPS[64] / 2).toExponential(4), hint: 'ε/2 (doble)' },
        ]}
      />
      {classic ? (
        <Alert kind="ok">
          El bucle se detiene cuando <Tex>{'fl(1+\\varepsilon)=1'}</Tex>: el último ε que sí cambió a 1 es <Tex>{'2^{-52}\\approx 2.22\\times10^{-16}'}</Tex> en doble, <Tex>{'2^{-23}\\approx 1.19\\times 10^{-7}'}</Tex> en simple y <Tex>{'2^{-10}\\approx 9.77\\times 10^{-4}'}</Tex> en media.
          Observa que <Tex>{'1 + 2^{-53}'}</Tex> es un empate exacto que se redondea al par (1), por eso el bucle para ahí.
        </Alert>
      ) : c.fac === 10 ? (
        <Alert kind="warn">Dividiendo entre 10 los ε no son potencias de 2 (y ni siquiera son exactos): el resultado sólo da el orden de magnitud de ε.</Alert>
      ) : (
        <Alert kind="info">
          Con <Tex>{`x_0 = ${fmt(x0)}`}</Tex> el bucle encuentra el menor ε (potencia de 2) que altera a x₀: es del orden de <Tex>{'\\mathrm{ulp}(x_0)'}</Tex>, que crece con |x₀|. El ε de máquina es sólo el caso x₀ = 1.
        </Alert>
      )}
      <Tabs
        tabs={[
          {
            label: 'Tabla de iteraciones',
            content: (
              <Card>
                <DataTable filename="epsilon" columns={cols} rows={rows} highlight={(r) => (s.view === '32' ? r.g32 === false : s.view === '16' ? r.g16 === false : r.g64 === false || (s.view === 'ambas' && (r.g32 === false || r.g16 === false)))} maxHeight={460} />
              </Card>
            ),
          },
          {
            label: 'Espaciado relativo',
            content: (
              <Card>
                <Plot data={plot} layout={{ xaxis: { type: 'log', title: { text: 'x' }, exponentformat: 'power' }, yaxis: { type: 'log', title: { text: 'ulp(x) / x' }, exponentformat: 'power' } }} />
                <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                  El espaciado relativo entre flotantes consecutivos es un diente de sierra entre ε/2 y ε: por eso el error relativo de redondeo es siempre ≤ u = ε/2, sea cual sea la magnitud (mientras no haya
                  underflow/overflow).
                </p>
              </Card>
            ),
          },
          {
            label: 'Espaciado absoluto',
            content: (
              <Card>
                <Plot data={plotAbs} layout={{ xaxis: { title: { text: 'x' } }, yaxis: { title: { text: 'ulp(x) (simple)' }, exponentformat: 'power' } }} />
                <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>La distancia entre flotantes se duplica en cada potencia de 2: los flotantes son más densos cerca del 0.</p>
              </Card>
            ),
          },
          {
            label: 'Paso a paso',
            content: (
              <Card>
                <Steps
                  steps={[
                    { text: 'Inicializar:', tex: '\\varepsilon_0 = 1' },
                    ...r64.rows.slice(0, 3).map((r) => ({ tex: `k=${r.k}:\\ fl(${fmt(x0)} + ${fmt(r.eps, 6)}) = ${fmt(r.sum, 17)} > ${fmt(x0)}\\ \\Rightarrow\\ \\varepsilon_{${r.k + 1}} = \\varepsilon_{${r.k}}/${c.fac}` })),
                    { text: '… se sigue dividiendo …' },
                    ...r64.rows.slice(-2).map((r) => ({ tex: `k=${r.k}:\\ \\varepsilon_{${r.k}} = ${fmt(r.eps, 8)},\\ fl(${fmt(x0)} + \\varepsilon_{${r.k}}) = ${r.sum.toPrecision(17)}\\ ${r.greater ? '>' : '='}\\ ${fmt(x0)}` })),
                    { text: 'El bucle termina; el último ε que sí alteró a x₀ es:', tex: `\\varepsilon = ${r64.eps.toExponential(10)}${classic ? ' = 2^{-52}' : ''}` },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
      <ScilabCode
        code={`// Épsilon de máquina — generado por NumLab
clear; clc;
x0 = ${s.x0.replace(/\bpi\b/g, '%pi')};
eps = 1; k = 0;
mprintf('%4s %24s\\n', 'k', 'eps');
while x0 + eps > x0
  mprintf('%4d %24.16e\\n', k, eps);
  eps = eps/${c.fac}; k = k + 1;
end
eps = eps*${c.fac};   // último valor que sí alteró a x0
mprintf('eps calculado = %.16e\\n', eps);
mprintf('%%eps de Scilab = %.16e\\n', %eps);
mprintf('2^-52          = %.16e\\n', 2^-52);
// menor positivo normal y mayor número:
mprintf('realmin = %e, realmax = %e\\n', number_properties('tiny'), number_properties('huge'));
`}
        filename="epsilon"
      />
    </>
  )
}
