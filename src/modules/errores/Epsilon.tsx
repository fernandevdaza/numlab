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
import { L } from '../../i18n'

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
    if (!Number.isFinite(x0) || x0 === 0) return { error: L('x₀ debe ser un número finito distinto de 0.', 'x₀ must be a finite nonzero number.') }
    const fac = Number(d.factor)
    const r64 = F.epsLoop(64, x0, fac)
    const r32 = F.epsLoop(32, x0, fac)
    const r16 = F.epsLoop(16, x0, fac)
    return { x0, r64, r32, r16, fac }
  }, [d])

  const inputs = (
    <>
      <NumField
        label={L('Punto base x₀', 'Base point x₀')}
        value={s.x0}
        onChange={(x0) => set({ x0 })}
        hint={L('El ε clásico usa x₀ = 1. Con otro x₀ el bucle mide el espaciado (ulp) cerca de x₀.', 'The classic ε uses x₀ = 1. With another x₀ the loop measures the spacing (ulp) near x₀.')}
      />
      <SelectField
        label={L('Dividir ε en cada paso entre', 'Divide ε at each step by')}
        value={s.factor}
        onChange={(factor) => set({ factor })}
        options={[
          { value: '2', label: L('2 (potencias de 2: resultado exacto)', '2 (powers of 2: exact result)') },
          { value: '10', label: L('10 (sólo cota del orden de magnitud)', '10 (order of magnitude only)') },
        ]}
      />
      <SelectField
        label={L('Tabla', 'Table')}
        value={s.view}
        onChange={(view) => set({ view })}
        options={[
          { value: 'ambas', label: L('Media, simple y doble lado a lado', 'Half, single and double side by side') },
          { value: '64', label: L('Sólo doble', 'Double only') },
          { value: '32', label: L('Sólo simple', 'Single only') },
          { value: '16', label: L('Sólo media', 'Half only') },
        ]}
      />
      <Examples
        items={[
          { label: L('ε clásico (x₀ = 1)', 'classic ε (x₀ = 1)'), value: { x0: '1', factor: '2' as const } },
          { label: L('Espaciado cerca de 1000', 'Spacing near 1000'), value: { x0: '1000', factor: '2' as const } },
          { label: L('Cerca de 2⁵³', 'Near 2⁵³'), value: { x0: '2^53', factor: '2' as const } },
          { label: L('Dividiendo entre 10', 'Dividing by 10'), value: { x0: '1', factor: '10' as const } },
        ]}
        onPick={(v) => set(v)}
      />
    </>
  )

  return (
    <MethodPage title={TITLES.epsilon} topic={TOPIC} theory={THEORY.epsilon} inputs={inputs} description={L('El menor ε tal que 1 + ε > 1 en la máquina: el bucle clásico en simple y doble precisión, y cómo cambia el espaciado de los flotantes con la magnitud.', 'The smallest ε such that 1 + ε > 1 on the machine: the classic loop in single and double precision, and how the spacing of floats changes with magnitude.')}>
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
  const yes = (g: boolean | undefined) => (g === undefined ? '' : g ? L('✓ sí', '✓ yes') : L('✗ no → parar', '✗ no → stop'))
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
            { key: 'e16', tex: L('\\varepsilon_k\\ \\text{(media)}', '\\varepsilon_k\\ \\text{(half)}'), fmt: 'err' as const },
            { key: 'g16', tex: L('\\text{media: } >x_0?', '\\text{half: } >x_0?'), get: (r: any) => yes(r.g16), align: 'center' as const },
            { key: 'e32', tex: L('\\varepsilon_k\\ \\text{(simple)}', '\\varepsilon_k\\ \\text{(single)}'), fmt: 'err' as const },
            { key: 'g32', tex: L('\\text{simple: } >x_0?', '\\text{single: } >x_0?'), get: (r: any) => yes(r.g32), align: 'center' as const },
            { key: 'e64', tex: L('\\varepsilon_k\\ \\text{(doble)}', '\\varepsilon_k\\ \\text{(double)}'), fmt: 'err' as const },
            { key: 'g64', tex: L('\\text{doble: } >x_0?', '\\text{double: } >x_0?'), get: (r: any) => yes(r.g64), align: 'center' as const },
          ]

  const plot = useMemo(() => {
    const xs: number[] = []
    for (let k = -30; k <= 30; k += 0.02) xs.push(10 ** k)
    const t: Trace[] = []
    const NAME = { 64: L('doble', 'double'), 32: L('simple', 'single'), 16: L('media', 'half') }
    const COL = { 64: SERIES[0], 32: SERIES[1], 16: SERIES[2] } as const
    for (const p of [64, 32, 16] as F.Prec[]) {
      const xx = p === 32 ? xs.filter((v) => v < 3e38 && v > 1.2e-38) : p === 16 ? xs.filter((v) => v < 65000 && v > 6.2e-5) : xs
      t.push({ x: xx, y: xx.map((v) => F.ulp(F.roundP(v, p), p) / F.roundP(v, p)), type: 'scatter', mode: 'lines', name: `ulp(x)/x ${NAME[p]}`, line: { color: COL[p], width: 1.5, shape: 'hv' } })
    }
    t.push({ x: [1e-30, 1e30], y: [F.EPS[64], F.EPS[64]], type: 'scatter', mode: 'lines', name: L('ε doble', 'ε double'), line: { color: SERIES[0], dash: 'dot', width: 1 } })
    t.push({ x: [1e-30, 1e30], y: [F.EPS[32], F.EPS[32]], type: 'scatter', mode: 'lines', name: L('ε simple', 'ε single'), line: { color: SERIES[1], dash: 'dot', width: 1 } })
    t.push({ x: [1e-30, 1e30], y: [F.EPS[16], F.EPS[16]], type: 'scatter', mode: 'lines', name: L('ε media', 'ε half'), line: { color: SERIES[2], dash: 'dot', width: 1 } })
    return t
  }, [])

  const plotAbs = useMemo(() => {
    const xs: number[] = []
    for (let k = 0; k <= 400; k++) xs.push(0.25 + (k / 400) * 7.75)
    return [
      { x: xs, y: xs.map((v) => F.ulp(v, 32)), type: 'scatter', mode: 'lines', name: L('ulp(x) simple', 'ulp(x) single'), line: { color: SERIES[1], shape: 'hv' } },
    ] as Trace[]
  }, [])

  return (
    <>
      <Stats
        items={[
          { label: L('ε doble (64 bits)', 'ε double (64 bits)'), value: r64.eps.toExponential(6), accent: true, hint: classic ? L('= 2^−52 = %eps de Scilab', '= 2^−52 = Scilab %eps') : L(`ulp cerca de x₀: ${F.ulp(x0, 64).toExponential(4)}`, `ulp near x₀: ${F.ulp(x0, 64).toExponential(4)}`) },
          { label: L('ε simple (32 bits)', 'ε single (32 bits)'), value: r32.eps.toExponential(6), hint: classic ? '= 2^−23' : L(`ulp cerca de x₀: ${F.ulp(Math.fround(x0), 32).toExponential(4)}`, `ulp near x₀: ${F.ulp(Math.fround(x0), 32).toExponential(4)}`) },
          { label: L('ε media (16 bits)', 'ε half (16 bits)'), value: r16.eps.toExponential(6), hint: classic ? '= 2^−10' : L(`ulp cerca de x₀: ${F.ulp(F.roundP(x0, 16), 16).toExponential(4)}`, `ulp near x₀: ${F.ulp(F.roundP(x0, 16), 16).toExponential(4)}`) },
          { label: L('Iteraciones', 'Iterations'), value: `${r64.rows.length} / ${r32.rows.length} / ${r16.rows.length}`, hint: L('doble / simple / media', 'double / single / half') },
          { label: L('Unidad de redondeo u', 'Unit round-off u'), value: (F.EPS[64] / 2).toExponential(4), hint: L('ε/2 (doble)', 'ε/2 (double)') },
        ]}
      />
      {classic ? (
        <Alert kind="ok">
          {L(
            <>
              El bucle se detiene cuando <Tex>{'fl(1+\\varepsilon)=1'}</Tex>: el último ε que sí cambió a 1 es <Tex>{'2^{-52}\\approx 2.22\\times10^{-16}'}</Tex> en doble, <Tex>{'2^{-23}\\approx 1.19\\times 10^{-7}'}</Tex> en simple y <Tex>{'2^{-10}\\approx 9.77\\times 10^{-4}'}</Tex> en media.
              Observa que <Tex>{'1 + 2^{-53}'}</Tex> es un empate exacto que se redondea al par (1), por eso el bucle para ahí.
            </>,
            <>
              The loop stops when <Tex>{'fl(1+\\varepsilon)=1'}</Tex>: the last ε that did change 1 is <Tex>{'2^{-52}\\approx 2.22\\times10^{-16}'}</Tex> in double, <Tex>{'2^{-23}\\approx 1.19\\times 10^{-7}'}</Tex> in single and <Tex>{'2^{-10}\\approx 9.77\\times 10^{-4}'}</Tex> in half.
              Note that <Tex>{'1 + 2^{-53}'}</Tex> is an exact tie that is rounded to even (1), which is why the loop stops there.
            </>,
          )}
        </Alert>
      ) : c.fac === 10 ? (
        <Alert kind="warn">
          {L(
            'Dividiendo entre 10 los ε no son potencias de 2 (y ni siquiera son exactos): el resultado sólo da el orden de magnitud de ε.',
            'Dividing by 10, the ε values are not powers of 2 (and are not even exact): the result only gives the order of magnitude of ε.',
          )}
        </Alert>
      ) : (
        <Alert kind="info">
          {L(
            <>
              Con <Tex>{`x_0 = ${fmt(x0)}`}</Tex> el bucle encuentra el menor ε (potencia de 2) que altera a x₀: es del orden de <Tex>{'\\mathrm{ulp}(x_0)'}</Tex>, que crece con |x₀|. El ε de máquina es sólo el caso x₀ = 1.
            </>,
            <>
              With <Tex>{`x_0 = ${fmt(x0)}`}</Tex> the loop finds the smallest ε (a power of 2) that changes x₀: it is of the order of <Tex>{'\\mathrm{ulp}(x_0)'}</Tex>, which grows with |x₀|. Machine ε is just the case x₀ = 1.
            </>,
          )}
        </Alert>
      )}
      <Tabs
        tabs={[
          {
            label: L('Tabla de iteraciones', 'Iteration table'),
            content: (
              <Card>
                <DataTable filename="epsilon" columns={cols} rows={rows} highlight={(r) => (s.view === '32' ? r.g32 === false : s.view === '16' ? r.g16 === false : r.g64 === false || (s.view === 'ambas' && (r.g32 === false || r.g16 === false)))} maxHeight={460} />
              </Card>
            ),
          },
          {
            label: L('Espaciado relativo', 'Relative spacing'),
            content: (
              <Card>
                <Plot data={plot} layout={{ xaxis: { type: 'log', title: { text: 'x' }, exponentformat: 'power' }, yaxis: { type: 'log', title: { text: 'ulp(x) / x' }, exponentformat: 'power' } }} />
                <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                  {L(
                    'El espaciado relativo entre flotantes consecutivos es un diente de sierra entre ε/2 y ε: por eso el error relativo de redondeo es siempre ≤ u = ε/2, sea cual sea la magnitud (mientras no haya underflow/overflow).',
                    'The relative spacing between consecutive floats is a sawtooth between ε/2 and ε: that is why the relative round-off error is always ≤ u = ε/2, whatever the magnitude (as long as there is no underflow/overflow).',
                  )}
                </p>
              </Card>
            ),
          },
          {
            label: L('Espaciado absoluto', 'Absolute spacing'),
            content: (
              <Card>
                <Plot data={plotAbs} layout={{ xaxis: { title: { text: 'x' } }, yaxis: { title: { text: L('ulp(x) (simple)', 'ulp(x) (single)') }, exponentformat: 'power' } }} />
                <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
                  {L('La distancia entre flotantes se duplica en cada potencia de 2: los flotantes son más densos cerca del 0.', 'The distance between floats doubles at each power of 2: floats are denser near 0.')}
                </p>
              </Card>
            ),
          },
          {
            label: L('Paso a paso', 'Step by step'),
            content: (
              <Card>
                <Steps
                  steps={[
                    { text: L('Inicializar:', 'Initialize:'), tex: '\\varepsilon_0 = 1' },
                    ...r64.rows.slice(0, 3).map((r) => ({ tex: `k=${r.k}:\\ fl(${fmt(x0)} + ${fmt(r.eps, 6)}) = ${fmt(r.sum, 17)} > ${fmt(x0)}\\ \\Rightarrow\\ \\varepsilon_{${r.k + 1}} = \\varepsilon_{${r.k}}/${c.fac}` })),
                    { text: L('… se sigue dividiendo …', '… keep dividing …') },
                    ...r64.rows.slice(-2).map((r) => ({ tex: `k=${r.k}:\\ \\varepsilon_{${r.k}} = ${fmt(r.eps, 8)},\\ fl(${fmt(x0)} + \\varepsilon_{${r.k}}) = ${r.sum.toPrecision(17)}\\ ${r.greater ? '>' : '='}\\ ${fmt(x0)}` })),
                    { text: L('El bucle termina; el último ε que sí alteró a x₀ es:', 'The loop ends; the last ε that did change x₀ is:'), tex: `\\varepsilon = ${r64.eps.toExponential(10)}${classic ? ' = 2^{-52}' : ''}` },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
      <ScilabCode
        code={`// ${L('Épsilon de máquina — generado por NumLab', 'Machine epsilon — generated by NumLab')}
clear; clc;
x0 = ${s.x0.replace(/\bpi\b/g, '%pi')};
eps = 1; k = 0;
mprintf('%4s %24s\\n', 'k', 'eps');
while x0 + eps > x0
  mprintf('%4d %24.16e\\n', k, eps);
  eps = eps/${c.fac}; k = k + 1;
end
eps = eps*${c.fac};   // ${L('último valor que sí alteró a x0', 'last value that did change x0')}
mprintf('${L('eps calculado ', 'computed eps  ')} = %.16e\\n', eps);
mprintf('${L('%%eps de Scilab', 'Scilab %%eps  ')} = %.16e\\n', %eps);
mprintf('2^-52          = %.16e\\n', 2^-52);
// ${L('menor positivo normal y mayor número', 'smallest positive normal and largest number')}:
mprintf('realmin = %e, realmax = %e\\n', number_properties('tiny'), number_properties('huge'));
`}
        filename="epsilon"
      />
    </>
  )
}
