import { useMemo } from 'react'
import { evalNumber } from '../../lib/expr'
import { fmt, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, SERIES, type Trace } from '../../components/Plot'
import { Tex } from '../../components/Tex'
import { Alert, Card, CheckField, DataTable, Examples, FieldRow, IntField, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps, Tabs } from '../../components/ui'
import './errores.css'
import * as F from './float'
import { THEORY, TITLES, TOPIC } from './theory'

interface S {
  beta: number
  t: number
  L: number
  U: number
  conv: F.Conv
  subnormals: boolean
  x: string
}

const EXAMPLES: { label: string; value: Partial<S> }[] = [
  { label: 'F(2, 3, −1, 2) (de juguete)', value: { beta: 2, t: 3, L: -1, U: 2, conv: '0.d', x: '0.7' } },
  { label: 'F(10, 3, −2, 2)', value: { beta: 10, t: 3, L: -2, U: 2, conv: '0.d', x: '3.14159' } },
  { label: 'F(10, 4, −5, 5)', value: { beta: 10, t: 4, L: -5, U: 5, conv: '0.d', x: '2/3' } },
  { label: 'F(2, 4, −3, 3) con subnormales', value: { beta: 2, t: 4, L: -3, U: 3, conv: '0.d', subnormals: true, x: '0.05' } },
  { label: 'Mini IEEE: F(2, 4, −2, 3) 1.d', value: { beta: 2, t: 4, L: -2, U: 3, conv: 'd.d', x: '1.3' } },
]

export function SistemaF() {
  const [s, setS] = useLocalState<S>('errores:sistema-f', { beta: 2, t: 3, L: -1, U: 2, conv: '0.d', subnormals: false, x: '0.7' })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 200)

  const calc = useMemo(() => {
    const S: F.ToySystem = { beta: d.beta, t: d.t, L: d.L, U: d.U, conv: d.conv, subnormals: d.subnormals }
    if (d.L > d.U) return { error: 'Debe cumplirse L ≤ U.' }
    const info = F.toyInfo(S)
    const en = F.toyEnumerate(S, 6000)
    const x = evalNumber(d.x)
    const rd = Number.isFinite(x) ? F.toyRound(S, x) : null
    return { S, info, en, x, rd }
  }, [d])

  const inputs = (
    <>
      <FieldRow>
        <IntField label="Base β" value={s.beta} onChange={(beta) => set({ beta })} min={2} max={16} />
        <IntField label="Dígitos t" value={s.t} onChange={(t) => set({ t })} min={1} max={12} />
      </FieldRow>
      <FieldRow>
        <IntField label="Exponente mín. L" value={s.L} onChange={(L) => set({ L })} min={-60} max={60} />
        <IntField label="Exponente máx. U" value={s.U} onChange={(U) => set({ U })} min={-60} max={60} />
      </FieldRow>
      <SelectField
        label="Convención de mantisa"
        value={s.conv}
        onChange={(conv) => set({ conv })}
        options={[
          { value: '0.d', label: '±0.d₁d₂…dₜ × βᵉ  (d₁ ≠ 0)' },
          { value: 'd.d', label: '±d₀.d₁…dₜ₋₁ × βᵉ  (estilo IEEE)' },
        ]}
      />
      <CheckField label="Incluir subnormales (desnormalizados)" value={s.subnormals} onChange={(subnormals) => set({ subnormals })} />
      <NumField label="Número x a representar" value={s.x} onChange={(x) => set({ x })} hint="Se calcula fl(x) por corte y por redondeo" />
      <Examples items={EXAMPLES} onPick={(v) => set({ subnormals: false, ...v })} />
    </>
  )

  return (
    <MethodPage title={TITLES['sistema-f']} topic={TOPIC} theory={THEORY['sistema-f']} inputs={inputs} description="Un sistema de punto flotante pequeño para ver TODOS sus números, cómo se reparten sobre la recta y cómo se redondea o corta un real.">
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <Results c={calc} s={d} />}
    </MethodPage>
  )
}

function Results({ c, s }: { c: any; s: S }) {
  const S: F.ToySystem = c.S
  const info: F.ToyInfo = c.info
  const { beta: b, t, L, U } = S
  const zeroD = S.conv === '0.d'
  const pos: number[] = c.en.values
  const plot = useMemo(() => {
    const all = [...pos.map((v) => -v).reverse(), 0, ...pos]
    const ex = [...(c.en.exps as number[]).slice().reverse(), NaN, ...c.en.exps]
    const traces: Trace[] = [
      {
        x: all,
        y: all.map(() => 0),
        type: 'scatter',
        mode: 'markers',
        name: 'números de F',
        marker: { symbol: 'line-ns-open', size: 18, color: ex.map((e) => (Number.isNaN(e) ? SERIES[1] : SERIES[((e - L) % SERIES.length + SERIES.length) % SERIES.length])), line: { width: 2 } },
        text: all.map((v) => fmt(v, 10)),
        hovertemplate: '%{text}<extra></extra>',
      },
    ]
    if (c.rd && Number.isFinite(c.x)) {
      traces.push({ x: [c.x], y: [0.35], type: 'scatter', mode: 'markers+text', name: 'x', text: ['x'], textposition: 'top center', marker: { color: SERIES[3], size: 10, symbol: 'triangle-down' } })
      if (Number.isFinite(c.rd.round)) traces.push({ x: [c.rd.round], y: [-0.35], type: 'scatter', mode: 'markers+text', name: 'fl(x) redondeo', text: ['redondeo'], textposition: 'bottom center', marker: { color: SERIES[5], size: 10, symbol: 'triangle-up' } })
      if (Number.isFinite(c.rd.chop)) traces.push({ x: [c.rd.chop], y: [-0.35], type: 'scatter', mode: 'markers', name: 'fl(x) corte', marker: { color: SERIES[6], size: 9, symbol: 'x' } })
    }
    return traces
  }, [c])

  const spacing = useMemo(() => {
    const rows: { e: number; from: number; to: number; gap: number; count: number }[] = []
    for (let e = L; e <= U && rows.length < 40; e++) {
      const k = zeroD ? 0 : 1
      rows.push({ e, from: b ** (e - 1 + k), to: b ** (e + k), gap: b ** (e - t + k), count: (b - 1) * b ** (t - 1) })
    }
    return rows
  }, [S])

  const rd: F.ToyRound | null = c.rd
  const x: number = c.x
  const digitStr = (ds: number[]) => ds.map((dd) => F.DIGITS[dd]).join('')
  const mantTex = (ds: number[]) => (zeroD ? `0.${digitStr(ds)}` : `${F.DIGITS[ds[0]]}.${digitStr(ds.slice(1))}`)
  const errs = rd && rd.status !== 'cero' ? { chop: Math.abs(x - rd.chop), round: Math.abs(x - rd.round) } : null

  return (
    <>
      <Stats
        items={[
          { label: 'Cantidad de números', value: info.count, accent: true, hint: zeroD ? `2(β−1)β^(t−1)(U−L+1) + 1` : undefined },
          { label: 'ε de máquina', value: fmt(info.eps, 8), hint: `β^(1−t) = ${b}^${1 - t}` },
          { label: 'Menor positivo (UFL)', value: fmt(S.subnormals ? info.minSub! : info.minPos, 8), hint: S.subnormals ? `subnormal; menor normal ${fmt(info.minPos, 6)}` : zeroD ? `β^(L−1)` : 'β^L' },
          { label: 'Mayor (OFL)', value: fmt(info.max, 10), hint: zeroD ? '(1 − β^(−t)) β^U' : '(β − β^(1−t)) β^U' },
        ]}
      />
      <Card title="Los números del sistema sobre la recta real">
        {c.en.truncated && <Alert kind="warn">El sistema tiene demasiados números; se muestran sólo los primeros {pos.length} positivos.</Alert>}
        <Plot data={plot} height={260} layout={{ yaxis: { visible: false, range: [-1, 1] }, xaxis: { title: { text: 'x' }, zeroline: false }, showlegend: true, hovermode: 'closest' }} />
        <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0' }}>
          Cada color es un exponente distinto: dentro de cada uno el espaciado es constante (β^(e−t)), y se multiplica por β al pasar al siguiente. Cerca del cero queda un <b>hueco</b>{' '}
          {S.subnormals ? 'que rellenan los subnormales' : '(sin subnormales)'}. Usa el zoom del gráfico.
        </p>
      </Card>
      <Tabs
        tabs={[
          {
            label: 'Representar x',
            content: rd ? (
              <Card>
                {rd.status === 'cero' ? (
                  <Alert kind="info">x = 0 se representa exactamente.</Alert>
                ) : (
                  <>
                    {rd.status === 'overflow' && <Alert kind="error">OVERFLOW: |x| supera al mayor número del sistema ({fmt(info.max)}).</Alert>}
                    {rd.status === 'underflow' && <Alert kind="warn">UNDERFLOW: |x| es menor que el menor positivo normal; se redondea a 0{S.subnormals ? ' (el cálculo con subnormales no se muestra aquí)' : ''}.</Alert>}
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                      <span className="field-label">Dígitos de |x| en base {b}:</span>
                      <span className="digits">
                        {rd.digits.map((dd, i) => (
                          <span key={i} className={'digit ' + (i < t ? 'keep' : i === t ? 'guard' : 'drop')}>
                            {F.DIGITS[dd]}
                          </span>
                        ))}
                        <span className="muted">…</span>
                      </span>
                      <span className="muted mono">× {b}^{rd.e}</span>
                    </div>
                    <Steps
                      steps={[
                        { text: `Escribir x normalizado en base ${b}:`, tex: `x = ${x < 0 ? '-' : ''}(${zeroD ? '0.' : ''}${zeroD ? digitStr(rd.digits) : F.DIGITS[rd.digits[0]] + '.' + digitStr(rd.digits.slice(1))}\\ldots)_{${b}} \\times ${b}^{${rd.e}}` },
                        { text: `Corte (chopping): se descartan los dígitos desde la posición ${t + 1}:`, tex: `fl_c(x) = ${x < 0 ? '-' : ''}(${mantTex(rd.chopDigits)})_{${b}} \\times ${b}^{${rd.e}} = ${texNum(rd.chop, 12)}` },
                        { text: `Redondeo: se mira el dígito ${t + 1} (${F.DIGITS[rd.digits[t]]}) ${rd.digits[t] >= b / 2 ? `≥ β/2 ⇒ se suma 1 al dígito ${t}` : '< β/2 ⇒ se deja igual'}:`, tex: `fl_r(x) = ${x < 0 ? '-' : ''}(${mantTex(rd.roundDigits)})_{${b}} \\times ${b}^{${rd.roundE}} = ${texNum(rd.round, 12)}` },
                        ...(errs
                          ? [
                              { text: 'Errores:', tex: `\\begin{array}{lll} & E_a & E_r \\\\ \\text{corte} & ${texNum(errs.chop, 4)} & ${texNum(errs.chop / Math.abs(x), 4)} \\le \\beta^{1-t} = ${texNum(info.uChop, 4)} \\\\ \\text{redondeo} & ${texNum(errs.round, 4)} & ${texNum(errs.round / Math.abs(x), 4)} \\le \\tfrac12\\beta^{1-t} = ${texNum(info.uRound, 4)}\\end{array}` },
                            ]
                          : []),
                      ]}
                    />
                  </>
                )}
              </Card>
            ) : (
              <Alert kind="error">x inválido.</Alert>
            ),
          },
          {
            label: 'Espaciado por exponente',
            content: (
              <Card>
                <DataTable
                  filename="espaciado"
                  columns={[
                    { key: 'e', tex: 'e', fmt: 'int', align: 'center' },
                    { key: 'from', tex: '\\text{desde}' },
                    { key: 'to', tex: '\\text{hasta}' },
                    { key: 'gap', tex: '\\text{espaciado } \\beta^{e-t}' },
                    { key: 'count', label: 'Números', fmt: 'int' },
                  ]}
                  rows={spacing}
                />
              </Card>
            ),
          },
          {
            label: 'Lista de números',
            content: (
              <Card>
                <DataTable
                  filename="numeros_F"
                  maxHeight={360}
                  columns={[
                    { key: 'i', label: '#', fmt: 'int', align: 'center' },
                    { key: 'm', label: 'Mantisa', align: 'left' },
                    { key: 'e', tex: 'e', fmt: 'int', align: 'center' },
                    { key: 'v', label: 'Valor' },
                  ]}
                  rows={pos.slice(0, 2000).map((v, i) => ({ i: i + 1, v, e: c.en.exps[i], m: mantissaStr(v, S, c.en.exps[i]) }))}
                />
                <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>Sólo positivos; los negativos son simétricos y falta sumar el cero.</p>
              </Card>
            ),
          },
        ]}
      />
      <Card title="Fórmulas con estos parámetros">
        <Tex block>{`\\mathbb{F}(${b}, ${t}, ${L}, ${U}):\\quad \\#\\mathbb{F} = 2(${b}-1)\\cdot ${b}^{${t - 1}}\\cdot(${U}-(${L})+1)+1 = ${2 * (b - 1) * b ** (t - 1) * (U - L + 1) + 1}${S.subnormals ? `\\;(+${2 * (b ** (t - 1) - 1)}\\ \\text{subnormales})` : ''}`}</Tex>
        <Tex block>{zeroD ? `UFL = ${b}^{${L}-1} = ${texNum(info.minPos, 8)},\\qquad OFL = (1-${b}^{-${t}})\\,${b}^{${U}} = ${texNum(info.max, 10)}` : `UFL = ${b}^{${L}} = ${texNum(info.minPos, 8)},\\qquad OFL = (${b}-${b}^{${1 - t}})\\,${b}^{${U}} = ${texNum(info.max, 10)}`}</Tex>
        <Tex block>{`\\varepsilon_{mach} = ${b}^{1-${t}} = ${texNum(info.eps, 8)},\\qquad u_{\\text{redondeo}} = \\tfrac12\\varepsilon = ${texNum(info.uRound, 8)},\\qquad u_{\\text{corte}} = \\varepsilon = ${texNum(info.uChop, 8)}`}</Tex>
      </Card>
      <ScilabCode code={scilab(S)} filename="sistema_F" />
    </>
  )
}

function mantissaStr(v: number, S: F.ToySystem, e: number): string {
  const off = S.conv === 'd.d' ? 1 : 0
  const isSub = e < S.L
  const ee = isSub ? S.L : e
  const M = Math.round(v / S.beta ** (ee - S.t + off))
  let ds = ''
  let m = M
  for (let k = 0; k < S.t; k++) {
    ds = F.DIGITS[m % S.beta] + ds
    m = Math.floor(m / S.beta)
  }
  return S.conv === '0.d' ? `0.${ds}` : `${ds[0]}.${ds.slice(1)}`
}

function scilab(S: F.ToySystem): string {
  const k = S.conv === '0.d' ? 0 : 1
  return `// Números del sistema F(${S.beta}, ${S.t}, ${S.L}, ${S.U}) — generado por NumLab
clear; clc;
b = ${S.beta}; t = ${S.t}; L = ${S.L}; U = ${S.U};
x = [];
for e = L:U
  for M = b^(t-1):(b^t - 1)      // mantisa entera normalizada
    x = [x, M * b^(e - t + ${k})];
  end
end
x = [-x($:-1:1), 0, x];
mprintf('Cantidad: %d\\n', length(x));
mprintf('UFL = %g, OFL = %g, eps = %g\\n', min(x(x>0)), max(x), b^(1-t));
plot(x, zeros(x), 'o'); xgrid();
title('Números del sistema F(' + string(b) + ',' + string(t) + ',' + string(L) + ',' + string(U) + ')');
`
}
