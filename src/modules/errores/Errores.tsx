import { useMemo } from 'react'
import { fmt, texNum } from '../../lib/format'
import { useDebounced, useLocalState } from '../../lib/useLocalState'
import { Plot, SERIES } from '../../components/Plot'
import { Alert, Card, DataTable, Examples, MethodPage, NumField, ScilabCode, SelectField, Stats, Steps } from '../../components/ui'
import { bigStr, evalBig, sigDigits, sigDigitsTexto, decimalDigits } from './numeric'
import { evalNumber } from '../../lib/expr'
import { THEORY, TITLES, TOPIC } from './theory'
import { L } from '../../i18n'
import './errores.css'

/** 'texto': Er ≤ 5·10^−(m+1) (Rojas, Cap. 1).  'burden': Er ≤ 5·10^−t. */
type SigDef = 'texto' | 'burden'

interface S {
  p: string
  approx: string
  def?: SigDef
}

const EXAMPLES: { label: string; value: S }[] = [
  { label: L('Ej. 1.12: −0.001234 ≈ −0.001229', 'Ex. 1.12: −0.001234 ≈ −0.001229'), value: { p: '-0.001234', approx: '-0.001229' } },
  { label: 'π: 3, 3.14, 22/7, 3.1416, 355/113', value: { p: 'pi', approx: '3\n3.14\n22/7\n3.1416\n355/113' } },
  { label: 'e ≈ 2.718', value: { p: 'e', approx: '2.718\n2.7183\n19/7\n(1 + 1/1000)^1000' } },
  { label: '√2', value: { p: 'sqrt(2)', approx: '1.4\n1.41\n1.414\n1.4142\n99/70' } },
  { label: L('Escala: 1 vs 10⁶', 'Scale: 1 vs 10⁶'), value: { p: '1', approx: '0.99\n1.01' } },
  { label: L('Escala grande', 'Large scale'), value: { p: '1000000', approx: '999990\n1000100' } },
  { label: L('Escala pequeña', 'Small scale'), value: { p: '0.000012', approx: '0.000009\n0.0000119' } },
]

export function Errores() {
  const [s, setS] = useLocalState<S>('errores:errores', { ...EXAMPLES[0].value, def: 'texto' })
  const set = (p: Partial<S>) => setS((v) => ({ ...v, ...p }))
  const d = useDebounced(s, 250)

  const calc = useMemo(() => {
    const pv = evalNumber(d.p)
    const pBig = evalBig(d.p)
    if (!Number.isFinite(pv) || !pBig) return { error: L('Valor exacto p inválido.', 'Invalid exact value p.') }
    const def: SigDef = d.def ?? 'texto'
    const lines = d.approx.split('\n').map((l) => l.trim()).filter(Boolean)
    const rows = lines.map((src) => {
      const big = evalBig(src)
      const v = evalNumber(src)
      if (!big || !Number.isFinite(v)) return { src, v: NaN, ea: NaN, er: NaN, pct: NaN, sig: NaN, dec: NaN, bad: true }
      const ea = big.minus(pBig).abs().toNumber()
      const er = pBig.isZero() ? NaN : big.minus(pBig).abs().div(pBig.abs()).toNumber()
      return { src, v, ea, er, pct: er * 100, sig: def === 'texto' ? sigDigitsTexto(er) : sigDigits(er), dec: decimalDigits(ea), bad: false }
    })
    return { pv, pBig, rows }
  }, [d])

  const inputs = (
    <>
      <NumField label={L('Valor exacto p', 'Exact value p')} value={s.p} onChange={(p) => set({ p })} hint={L('Acepta expresiones: pi, e, sqrt(2), 1/3…', 'Accepts expressions: pi, e, sqrt(2), 1/3…')} />
      <label className="field">
        <span className="field-label">{L('Aproximaciones p* (una por línea)', 'Approximations p* (one per line)')}</span>
        <textarea className="input mono" rows={6} value={s.approx} spellCheck={false} onChange={(e) => set({ approx: e.target.value })} />
        <span className="field-hint">{L('Se comparan todas contra p usando 100 dígitos de precisión.', 'All are compared against p using 100 digits of precision.')}</span>
      </label>
      <SelectField
        label={L('Definición de cifras significativas', 'Definition of significant digits')}
        value={s.def ?? 'texto'}
        onChange={(def) => set({ def })}
        options={[
          { value: 'texto', label: L('Texto de la materia: Eᵣ ≤ 5·10⁻⁽ᵐ⁺¹⁾', 'Course textbook: Eᵣ ≤ 5·10⁻⁽ᵐ⁺¹⁾') },
          { value: 'burden', label: 'Burden & Faires: Eᵣ ≤ 5·10⁻ᵗ' },
        ]}
        hint={L('La del texto da una cifra menos que la de Burden.', 'The textbook definition gives one digit fewer than Burden’s.')}
      />
      <Examples items={EXAMPLES} onPick={(v) => set({ p: v.p, approx: v.approx })} />
    </>
  )

  return (
    <MethodPage title={TITLES.errores} topic={TOPIC} theory={THEORY.errores} inputs={inputs} description={L('Mide la calidad de una aproximación: error absoluto, relativo, porcentual, cifras significativas y decimales correctos.', 'Measures the quality of an approximation: absolute, relative and percent error, significant digits and correct decimals.')}>
      {'error' in calc ? <Alert kind="error">{calc.error}</Alert> : <Results c={calc} s={d} />}
    </MethodPage>
  )
}

function Results({ c, s }: { c: any; s: S }) {
  const rows: any[] = c.rows
  const first = rows.find((r) => !r.bad)
  const pStr = bigStr(c.pBig, 20)
  const plot = useMemo(
    () => [
      { x: rows.map((r) => r.src), y: rows.map((r) => (r.er > 0 ? r.er : null)), type: 'bar', name: L('error relativo', 'relative error'), marker: { color: SERIES[0] } },
      { x: rows.map((r) => r.src), y: rows.map((r) => (r.ea > 0 ? r.ea : null)), type: 'scatter', mode: 'markers', name: L('error absoluto', 'absolute error'), marker: { color: SERIES[1], size: 10 } },
    ],
    [rows],
  )
  return (
    <>
      {first && (
        <Stats
          items={[
            { label: L('Valor exacto p', 'Exact value p'), value: pStr, accent: true },
            { label: L(`Error absoluto (${first.src})`, `Absolute error (${first.src})`), value: first.ea === 0 ? '0' : first.ea.toExponential(4) },
            { label: L('Error relativo', 'Relative error'), value: Number.isFinite(first.er) ? (first.er === 0 ? '0' : first.er.toExponential(4)) : '—', hint: Number.isFinite(first.pct) ? `${fmt(first.pct, 4)} %` : undefined },
            { label: L('Cifras significativas', 'Significant digits'), value: Number.isFinite(first.sig) ? String(first.sig) : first.sig === Infinity ? L('∞ (exacto)', '∞ (exact)') : '—', hint: (s.def ?? 'texto') === 'texto' ? L('Eᵣ ≤ 5·10⁻⁽ᵐ⁺¹⁾ (texto)', 'Eᵣ ≤ 5·10⁻⁽ᵐ⁺¹⁾ (textbook)') : 'Eᵣ ≤ 5·10⁻ᵗ (Burden)' },
          ]}
        />
      )}
      <Card title={L('Comparación de aproximaciones', 'Comparison of approximations')}>
        <DataTable
          filename="errores"
          columns={[
            { key: 'src', tex: 'p^*', align: 'left' },
            { key: 'v', label: L('Valor', 'Value'), get: (r) => (Number.isFinite(r.v) ? fmt(r.v, 12) : L('inválido', 'invalid')) },
            { key: 'ea', tex: 'E_a = |p-p^*|', fmt: 'err' },
            { key: 'er', tex: 'E_r = \\frac{|p-p^*|}{|p|}', fmt: 'err' },
            { key: 'pct', tex: 'E_\\%', get: (r) => (Number.isFinite(r.pct) ? fmt(r.pct, 4) + ' %' : '—') },
            { key: 'sig', label: L('Cifras sig.', 'Sig. digits'), get: (r) => (r.sig === Infinity ? '∞' : Number.isFinite(r.sig) ? String(r.sig) : '—'), align: 'center' },
            { key: 'dec', label: L('Decimales', 'Decimals'), get: (r) => (r.dec === Infinity ? '∞' : Number.isFinite(r.dec) ? String(Math.max(0, r.dec)) : '—'), align: 'center' },
          ]}
          rows={rows}
        />
      </Card>
      {rows.length > 1 && (
        <Card title={L('Errores (escala logarítmica)', 'Errors (log scale)')}>
          <Plot data={plot as any} height={300} layout={{ yaxis: { type: 'log', exponentformat: 'power' }, xaxis: { type: 'category' } }} />
        </Card>
      )}
      {first && (
        <Card title={L('Paso a paso (primera aproximación)', 'Step by step (first approximation)')}>
          <Steps steps={steps(s.p, pStr, first, s.def ?? 'texto')} />
        </Card>
      )}
      <Alert kind="info">
        {L(
          <>
            El error <b>absoluto</b> depende de la escala (un error de 10 es enorme si p = 1 y despreciable si p = 10⁶); el <b>relativo</b> no, por eso es el que se relaciona con las cifras significativas
            y con la precisión de la máquina (u ≈ 1.1·10⁻¹⁶ en doble).
          </>,
          <>
            The <b>absolute</b> error depends on the scale (an error of 10 is huge if p = 1 and negligible if p = 10⁶); the <b>relative</b> error does not, which is why it is the one related to significant
            digits and to machine precision (u ≈ 1.1·10⁻¹⁶ in double).
          </>,
        )}
      </Alert>
      <ScilabCode
        filename="errores"
        code={`// ${L('Error absoluto, relativo y cifras significativas — generado por NumLab', 'Absolute error, relative error and significant digits — generated by NumLab')}
clear; clc;
p = ${s.p.replace(/\bpi\b/g, '%pi').replace(/\be\b/g, '%e')};
aprox = [${rows.filter((r) => !r.bad).map((r) => r.src.replace(/\bpi\b/g, '%pi').replace(/\be\b/g, '%e')).join(', ')}];
for k = 1:length(aprox)
  ps = aprox(k);
  Ea = abs(p - ps);
  Er = Ea/abs(p);
  t = floor(log10(5/Er))${(s.def ?? 'texto') === 'texto' ? L(' - 1;   // cifras significativas (texto): Er <= 5*10^(-(m+1))', ' - 1;   // significant digits (textbook): Er <= 5*10^(-(m+1))') : L(';   // cifras significativas (Burden): Er <= 5*10^(-t)', ';   // significant digits (Burden): Er <= 5*10^(-t)')}
  mprintf('p* = %.10f  Ea = %.3e  Er = %.3e  (%.4f %%)  ${L('cifras', 'digits')} = %d\\n', ps, Ea, Er, 100*Er, max(0, t));
end
`}
      />
    </>
  )
}

function steps(pSrc: string, pStr: string, r: any, def: SigDef) {
  const out: { text?: string; tex?: string }[] = []
  out.push({ text: L('Error absoluto:', 'Absolute error:'), tex: `E_a = |p - p^*| = |${pStr} - ${r.v < 0 ? `(${fmt(r.v, 14)})` : fmt(r.v, 14)}| = ${texNum(r.ea, 6)}` })
  if (Number.isFinite(r.er)) {
    out.push({ text: L('Error relativo:', 'Relative error:'), tex: `E_r = \\frac{E_a}{|p|} = \\frac{${texNum(r.ea, 6)}}{${texNum(Math.abs(evalNumber(pSrc)), 10)}} = ${texNum(r.er, 6)}\\quad (${texNum(r.pct, 4)}\\,\\%)` })
    if (r.sig !== Infinity) {
      const t = r.sig
      // exponente k de la cota 5·10^(−k) que se cumple y la siguiente que falla
      const k = def === 'texto' ? t + 1 : t
      const v = def === 'texto' ? 'm' : 't'
      const kTex = (j: number) => (def === 'texto' ? `-(${j - 1}+1)` : `-${j}`)
      out.push({
        text:
          def === 'texto'
            ? L('Cifras significativas (texto): el mayor m con Eᵣ ≤ 5·10⁻⁽ᵐ⁺¹⁾:', 'Significant digits (textbook): the largest m with Eᵣ ≤ 5·10⁻⁽ᵐ⁺¹⁾:')
            : L('Cifras significativas (Burden): el mayor t con Eᵣ ≤ 5·10⁻ᵗ:', 'Significant digits (Burden): the largest t with Eᵣ ≤ 5·10⁻ᵗ:'),
        tex: `${texNum(r.er, 4)} \\le 5\\times10^{${kTex(k)}} = ${texNum(5 * 10 ** -k, 3)}\\ \\checkmark,\\qquad ${texNum(r.er, 4)} > 5\\times10^{${kTex(k + 1)}} = ${texNum(5 * 10 ** -(k + 1), 3)}\\ \\Rightarrow\\ ${v} = ${t}`,
      })
    }
  }
  if (Number.isFinite(r.dec) && r.dec >= 0)
    out.push({ text: L('Decimales correctos: mayor d con Eₐ ≤ 0.5·10⁻ᵈ:', 'Correct decimals: largest d with Eₐ ≤ 0.5·10⁻ᵈ:'), tex: `${texNum(r.ea, 4)} \\le 0.5\\times 10^{-${r.dec}}\\ \\Rightarrow\\ d = ${r.dec}` })
  return out
}

